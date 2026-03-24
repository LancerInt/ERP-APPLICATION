"""
Django management command to seed initial data for ERP system.

Usage:
    python manage.py seed_data
    python manage.py seed_data --full  # Includes sample data
    python manage.py seed_data --users-only
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.contrib.auth.models import Group, Permission
from django.db import transaction

import uuid
from datetime import datetime, timedelta


class Command(BaseCommand):
    help = "Seed initial data for ERP system"

    def add_arguments(self, parser):
        parser.add_argument(
            '--full',
            action='store_true',
            help='Include sample data (products, vendors, customers)',
        )
        parser.add_argument(
            '--users-only',
            action='store_true',
            help='Create only users and roles',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting database seeding...'))

        try:
            # Step 1: Create system settings
            self.create_system_settings()
            self.stdout.write(self.style.SUCCESS('✓ System settings created'))

            # Step 2: Create roles and permissions
            self.create_roles()
            self.stdout.write(self.style.SUCCESS('✓ Roles created'))

            # Step 3: Create admin user
            self.create_admin_user()
            self.stdout.write(self.style.SUCCESS('✓ Admin user created'))

            if options['users_only']:
                self.stdout.write(self.style.SUCCESS('\n✓ User creation complete'))
                return

            # Step 4: Create default company
            self.create_default_company()
            self.stdout.write(self.style.SUCCESS('✓ Default company created'))

            # Step 5: Create warehouse and godowns
            self.create_warehouse_structure()
            self.stdout.write(self.style.SUCCESS('✓ Warehouse structure created'))

            # Step 6: Create master data
            self.create_master_data()
            self.stdout.write(self.style.SUCCESS('✓ Master data created'))

            if options['full']:
                # Step 7: Create sample data
                self.create_sample_data()
                self.stdout.write(self.style.SUCCESS('✓ Sample data created'))

            # Final step: Create system parameters
            self.create_system_parameters()
            self.stdout.write(self.style.SUCCESS('✓ System parameters configured'))

            self.stdout.write(self.style.SUCCESS('\n✓ Database seeding completed successfully!'))
            self.print_summary()

        except Exception as e:
            raise CommandError(f'Error during seeding: {str(e)}')

    def create_system_settings(self):
        """Create or update system settings."""
        from django.contrib.sites.models import Site

        # Update default site
        Site.objects.update_or_create(
            pk=1,
            defaults={
                'domain': 'lancererp.local',
                'name': 'Lancer ERP',
            }
        )

    def create_roles(self):
        """Create system roles with appropriate permissions."""
        # Define role hierarchy
        roles = {
            'Super Admin': ['all'],
            'Admin': ['can_manage_users', 'can_manage_settings', 'can_view_reports'],
            'Manager': ['can_approve_documents', 'can_view_all_data'],
            'Supervisor': ['can_view_department_data', 'can_edit_own_data'],
            'Finance': ['can_view_finance', 'can_approve_payments'],
            'Purchase': ['can_create_po', 'can_approve_po'],
            'Store': ['can_manage_inventory', 'can_receive_goods'],
            'HR': ['can_manage_employees', 'can_manage_attendance'],
            'Sales': ['can_create_sales_order', 'can_manage_customers'],
            'Accounts': ['can_manage_accounts', 'can_view_finance'],
            'Production': ['can_manage_production', 'can_view_inventory'],
            'Quality': ['can_manage_quality', 'can_approve_receipt'],
            'Logistics': ['can_manage_logistics', 'can_track_shipments'],
            'Admin Officer': ['can_manage_general', 'can_manage_documents'],
            'Manager Executive': ['can_manage_strategic', 'can_view_all_data'],
            'Officer': ['can_view_own_data', 'can_edit_own_data'],
            'Executive': ['can_view_reports', 'can_manage_strategic'],
            'Viewer': ['can_view_all_data'],
        }

        for role_name, permissions in roles.items():
            group, created = Group.objects.get_or_create(name=role_name)
            if created:
                self.stdout.write(f'  Created role: {role_name}')

    def create_admin_user(self):
        """Create default admin user."""
        from django.contrib.auth import get_user_model

        User = get_user_model()

        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@lancererp.local',
                'first_name': 'System',
                'last_name': 'Administrator',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            }
        )

        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write(f'  Created admin user: admin (Password: admin123)')
        else:
            self.stdout.write(f'  Admin user already exists')

    def create_default_company(self):
        """Create default company configuration."""
        # Note: This assumes a Company model exists
        # Adjust import path as needed
        try:
            from apps.masters.models import Company

            company, created = Company.objects.get_or_create(
                code='DEFAULT',
                defaults={
                    'name': 'Default Company',
                    'email': 'company@lancererp.local',
                    'phone': '+1-800-LANCER-1',
                    'address': '123 Business St, Corporate City, ST 12345',
                    'country': 'United States',
                    'timezone': 'America/New_York',
                    'fiscal_year_start': '04-01',
                    'fiscal_year_end': '03-31',
                    'currency': 'USD',
                    'decimal_places': 2,
                    'is_active': True,
                }
            )

            if created:
                self.stdout.write(f'  Created company: {company.name}')
        except ImportError:
            self.stdout.write(self.style.WARNING('  Company model not found, skipping...'))

    def create_warehouse_structure(self):
        """Create default warehouse and godowns."""
        try:
            from apps.inventory.models import Warehouse, Godown

            warehouse, w_created = Warehouse.objects.get_or_create(
                code='WH-001',
                defaults={
                    'name': 'Main Warehouse',
                    'description': 'Primary warehouse for inventory storage',
                    'location': 'Main Facility',
                    'capacity': 10000,
                    'is_active': True,
                }
            )

            if w_created:
                self.stdout.write(f'  Created warehouse: {warehouse.name}')

            # Create default godowns
            godown_list = [
                {'code': 'GD-001', 'name': 'Ground Floor', 'location': 'WH-001'},
                {'code': 'GD-002', 'name': 'First Floor', 'location': 'WH-001'},
                {'code': 'GD-003', 'name': 'Cold Storage', 'location': 'WH-001'},
                {'code': 'GD-004', 'name': 'High Value Items', 'location': 'WH-001'},
            ]

            for godown_data in godown_list:
                godown, created = Godown.objects.get_or_create(
                    code=godown_data['code'],
                    defaults={
                        'warehouse': warehouse,
                        'name': godown_data['name'],
                        'location': godown_data['location'],
                        'capacity': 2500,
                        'is_active': True,
                    }
                )

                if created:
                    self.stdout.write(f'  Created godown: {godown.name}')

        except ImportError:
            self.stdout.write(self.style.WARNING('  Warehouse models not found, skipping...'))

    def create_master_data(self):
        """Create essential master data."""
        try:
            from apps.masters.models import (
                Unit, Category, HSNCode, TaxRate
            )

            # Create units
            units = [
                {'code': 'KG', 'name': 'Kilogram'},
                {'code': 'LTR', 'name': 'Liter'},
                {'code': 'PCS', 'name': 'Pieces'},
                {'code': 'BOX', 'name': 'Box'},
                {'code': 'CASE', 'name': 'Case'},
                {'code': 'MTR', 'name': 'Meter'},
                {'code': 'SQ.MTR', 'name': 'Square Meter'},
            ]

            for unit in units:
                obj, created = Unit.objects.get_or_create(
                    code=unit['code'],
                    defaults={'name': unit['name'], 'is_active': True}
                )
                if created:
                    self.stdout.write(f'  Created unit: {obj.name}')

            # Create categories
            categories = [
                {'code': 'RAW', 'name': 'Raw Materials'},
                {'code': 'FG', 'name': 'Finished Goods'},
                {'code': 'CONS', 'name': 'Consumables'},
                {'code': 'SER', 'name': 'Services'},
            ]

            for cat in categories:
                obj, created = Category.objects.get_or_create(
                    code=cat['code'],
                    defaults={'name': cat['name'], 'is_active': True}
                )
                if created:
                    self.stdout.write(f'  Created category: {obj.name}')

            # Create tax rates
            tax_rates = [
                {'rate': 0, 'name': 'No Tax'},
                {'rate': 5, 'name': 'SGST 5%'},
                {'rate': 9, 'name': 'SGST 9%'},
                {'rate': 14, 'name': 'SGST 14%'},
                {'rate': 28, 'name': 'SGST 28%'},
            ]

            for tax in tax_rates:
                obj, created = TaxRate.objects.get_or_create(
                    rate=tax['rate'],
                    defaults={'name': tax['name'], 'is_active': True}
                )
                if created:
                    self.stdout.write(f'  Created tax rate: {obj.name}')

        except ImportError:
            self.stdout.write(self.style.WARNING('  Master data models not found, skipping...'))

    def create_sample_data(self):
        """Create sample products, vendors, and customers."""
        try:
            from apps.masters.models import Product, Vendor, Customer, Company, Unit, Category

            company = Company.objects.filter(code='DEFAULT').first()
            if not company:
                return

            # Create sample vendors
            vendors = [
                {'code': 'VEND-001', 'name': 'Global Supplies Inc.', 'country': 'USA'},
                {'code': 'VEND-002', 'name': 'European Traders Ltd.', 'country': 'Germany'},
                {'code': 'VEND-003', 'name': 'Asian Imports Co.', 'country': 'China'},
            ]

            for vendor in vendors:
                obj, created = Vendor.objects.get_or_create(
                    code=vendor['code'],
                    defaults={
                        'company': company,
                        'name': vendor['name'],
                        'country': vendor['country'],
                        'email': f"contact@{vendor['code'].lower()}.com",
                        'payment_terms': 'Net 30',
                        'is_active': True,
                    }
                )
                if created:
                    self.stdout.write(f'  Created vendor: {obj.name}')

            # Create sample customers
            customers = [
                {'code': 'CUST-001', 'name': 'Acme Corporation', 'industry': 'Manufacturing'},
                {'code': 'CUST-002', 'name': 'Tech Solutions Ltd.', 'industry': 'IT'},
                {'code': 'CUST-003', 'name': 'Retail Network Inc.', 'industry': 'Retail'},
            ]

            for customer in customers:
                obj, created = Customer.objects.get_or_create(
                    code=customer['code'],
                    defaults={
                        'company': company,
                        'name': customer['name'],
                        'industry': customer['industry'],
                        'email': f"contact@{customer['code'].lower()}.com",
                        'credit_limit': 100000,
                        'is_active': True,
                    }
                )
                if created:
                    self.stdout.write(f'  Created customer: {obj.name}')

            # Create sample products
            try:
                unit = Unit.objects.filter(code='KG').first() or Unit.objects.first()
                category = Category.objects.filter(code='RAW').first() or Category.objects.first()

                if unit and category:
                    products = [
                        {'code': 'PROD-001', 'name': 'Steel Ingot', 'price': 500},
                        {'code': 'PROD-002', 'name': 'Aluminum Sheet', 'price': 300},
                        {'code': 'PROD-003', 'name': 'Copper Wire', 'price': 450},
                        {'code': 'PROD-004', 'name': 'Plastic Pellets', 'price': 150},
                        {'code': 'PROD-005', 'name': 'Glass Fiber', 'price': 600},
                    ]

                    for product in products:
                        obj, created = Product.objects.get_or_create(
                            code=product['code'],
                            defaults={
                                'company': company,
                                'name': product['name'],
                                'category': category,
                                'unit': unit,
                                'standard_price': product['price'],
                                'is_active': True,
                            }
                        )
                        if created:
                            self.stdout.write(f'  Created product: {obj.name}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  Could not create products: {e}'))

        except ImportError:
            self.stdout.write(self.style.WARNING('  Master data models not found, skipping sample data...'))

    def create_system_parameters(self):
        """Create system parameters and configurations."""
        try:
            from django.contrib.sites.models import Site
            from django.contrib.flatpages.models import FlatPage

            # Update site info
            site = Site.objects.get_current()
            site.name = 'Lancer ERP'
            site.save()

            self.stdout.write(f'  Updated site configuration')

        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  Could not create system parameters: {e}'))

    def print_summary(self):
        """Print summary of seeded data."""
        from django.contrib.auth import get_user_model

        User = get_user_model()

        self.stdout.write('\n' + '=' * 50)
        self.stdout.write('SEEDING SUMMARY')
        self.stdout.write('=' * 50)
        self.stdout.write(f'Total Users: {User.objects.count()}')
        self.stdout.write('=' * 50)
        self.stdout.write('\nDEFAULT CREDENTIALS:')
        self.stdout.write('  Username: admin')
        self.stdout.write('  Password: admin123')
        self.stdout.write('\n⚠️  Please change the default password immediately in production!')
        self.stdout.write('=' * 50)
