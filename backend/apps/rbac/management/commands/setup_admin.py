"""
Management command to set up the Admin user with IT Admin role and full permissions.

Steps:
1. Seed all ERP roles and modules
2. Ensure a Company and Warehouse exist (required for Staff)
3. Create Admin staff record in Staff master
4. Create Django User with password Admin@123
5. Create StakeholderUser linking user to staff
6. Assign IT Admin role via UserRoleAssignment
7. Grant full RolePermission on ALL modules for IT Admin role
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction

from core.models import Company, Warehouse, StakeholderUser
from hr.models import Staff
from rbac.models import ERPRole, ERPModule, UserRoleAssignment, RolePermission


# All 18 predefined roles
ROLES = [
    ('Office Manager', 'Overall office administration and management'),
    ('Purchase Manager', 'Manages purchase operations and approvals'),
    ('Purchase Coordinator', 'Coordinates purchase activities and follow-ups'),
    ('Sales Manager', 'Manages sales operations and approvals'),
    ('Sales Coordinator', 'Coordinates sales activities and follow-ups'),
    ('Finance Manager', 'Manages finance operations and approvals'),
    ('Accounts Manager', 'Manages accounting operations'),
    ('Freight Coordinator', 'Coordinates freight and logistics'),
    ('QC Manager', 'Manages quality control operations'),
    ('QC Coordinator', 'Coordinates quality control activities'),
    ('QC Analyst', 'Performs quality control analysis and testing'),
    ('Warehouse Manager', 'Manages warehouse operations'),
    ('Warehouse Coordinator', 'Coordinates warehouse activities'),
    ('Warehouse Supervisor', 'Supervises warehouse floor operations'),
    ('Warehouse Coordinator (Office)', 'Warehouse coordination from office side'),
    ('HR Coordinator (Office)', 'HR coordination from office side'),
    ('Warehouse HR Coordinator', 'HR coordination for warehouse staff'),
    ('IT Admin', 'IT administration and system management'),
]

# All 66 modules: (name, slug, description, icon, order)
MODULES = [
    ('Company', 'company', 'Company master data', 'building', 1),
    ('Warehouse', 'warehouse', 'Warehouse management', 'warehouse', 2),
    ('Godown', 'godown', 'Godown management', 'store', 3),
    ('Machinery', 'machinery', 'Machinery and equipment', 'settings', 4),
    ('Product', 'product', 'Product master', 'package', 5),
    ('Service Catalogue', 'service-catalogue', 'Service catalogue management', 'list', 6),
    ('Vendor', 'vendor', 'Vendor master', 'users', 7),
    ('Customer', 'customer', 'Customer master', 'user-check', 8),
    ('Transporter', 'transporter', 'Transporter master', 'truck', 9),
    ('Price List', 'price-list', 'Price list management', 'dollar-sign', 10),
    ('Tax Master', 'tax-master', 'Tax configuration', 'percent', 11),
    ('Template', 'template', 'Template library', 'file-text', 12),
    ('Purchase Request', 'purchase-request', 'Purchase requisitions', 'shopping-cart', 13),
    ('RFQ', 'rfq', 'Request for quotation', 'file-plus', 14),
    ('Quote', 'quote', 'Vendor quotes', 'file', 15),
    ('Quote Evaluation', 'quote-evaluation', 'Quote comparison and evaluation', 'bar-chart-2', 16),
    ('Purchase Order', 'purchase-order', 'Purchase orders', 'clipboard', 17),
    ('Receipt Advice', 'receipt-advice', 'Goods receipt', 'download', 18),
    ('Freight Advice', 'freight-advice', 'Freight management', 'navigation', 19),
    ('Vendor Bill', 'vendor-bill', 'Vendor bills and invoices', 'file-text', 19),
    ('Vendor Payment', 'vendor-payment', 'Vendor payment processing', 'credit-card', 20),
    ('Payment Made', 'payment-made', 'Payments made to vendors', 'credit-card', 20),
    ('Vendor Credit', 'vendor-credit', 'Vendor credit notes', 'file-minus', 20),
    ('Customer PO', 'customer-po', 'Customer purchase orders', 'file-minus', 21),
    ('Sales Order', 'sales-order', 'Sales orders', 'trending-up', 22),
    ('Dispatch Challan', 'dispatch-challan', 'Dispatch challans', 'send', 23),
    ('Sales Invoice', 'sales-invoice', 'Sales invoices', 'file-text', 24),
    ('Freight Advice (Outbound)', 'freight-advice-outbound', 'Outbound freight management', 'navigation', 24),
    ('Receivable', 'receivable', 'Accounts receivable', 'inbox', 25),
    ('BOM Request', 'bom-request', 'Bill of materials requests', 'layers', 26),
    ('Work Order', 'work-order', 'Production work orders', 'tool', 27),
    ('Wage Voucher', 'wage-voucher', 'Wage vouchers', 'file-text', 28),
    ('Material Issue', 'material-issue', 'Material issue notes', 'arrow-right', 29),
    ('Yield Log', 'yield-log', 'Production yield logs', 'activity', 30),
    ('QC Parameter', 'qc-parameter', 'Quality control parameters', 'sliders', 31),
    ('QC Request', 'qc-request', 'Quality control requests', 'check-circle', 32),
    ('QC Lab Job', 'qc-lab-job', 'QC laboratory jobs', 'thermometer', 33),
    ('QC Report', 'qc-report', 'Quality control reports', 'clipboard', 34),
    ('Counter Sample', 'counter-sample', 'Counter sample register', 'archive', 35),
    ('Stock Transfer', 'stock-transfer', 'Stock transfer challans', 'repeat', 36),
    ('Transfer Receipt', 'transfer-receipt', 'Stock transfer receipts', 'download', 37),
    ('Shifting', 'shifting', 'Warehouse shifting', 'move', 38),
    ('Job Work Order', 'job-work-order', 'Job work orders', 'briefcase', 39),
    ('Job Work DC', 'job-work-dc', 'Job work dispatch challans', 'external-link', 40),
    ('Job Work Receipt', 'job-work-receipt', 'Job work receipts', 'corner-down-left', 41),
    ('Sales Return', 'sales-return', 'Sales return advice', 'corner-up-left', 42),
    ('Stock Adjustment', 'stock-adjustment', 'Stock adjustments', 'edit-3', 43),
    ('Vendor Ledger', 'vendor-ledger', 'Vendor ledger', 'book', 44),
    ('Customer Ledger', 'customer-ledger', 'Customer ledger', 'book-open', 45),
    ('Payment Advice', 'payment-advice', 'Payment advice workflow', 'credit-card', 46),
    ('Bank Statement', 'bank-statement', 'Bank statement uploads', 'file-text', 47),
    ('Credit/Debit Note', 'credit-debit-note', 'Credit and debit notes', 'file-minus', 48),
    ('GST Report', 'gst-report', 'GST reconciliation and reports', 'pie-chart', 49),
    ('Petty Cash', 'petty-cash', 'Petty cash register', 'dollar-sign', 50),
    ('Freight Ledger', 'freight-ledger', 'Freight ledger', 'map', 51),
    ('Wage Ledger', 'wage-ledger', 'Wage ledger', 'book', 52),
    ('Staff', 'staff', 'Staff management', 'users', 53),
    ('Shift', 'shift', 'Shift definitions', 'clock', 54),
    ('Attendance', 'attendance', 'Attendance capture', 'check-square', 55),
    ('Leave', 'leave', 'Leave requests', 'calendar', 56),
    ('Overtime', 'overtime', 'Overtime requests', 'clock', 57),
    ('Payroll', 'payroll', 'Payroll export', 'dollar-sign', 58),
    ('Audit Log', 'audit-log', 'System audit logs', 'eye', 59),
    ('User Management', 'user-management', 'User administration', 'user-plus', 60),
    ('Role Management', 'role-management', 'Role administration', 'shield', 61),
    ('Permission Management', 'permission-management', 'Permission administration', 'lock', 62),
]


class Command(BaseCommand):
    help = 'Create Admin staff, user with IT Admin role, and full permissions'

    @transaction.atomic
    def handle(self, *args, **options):
        # --- 1. Seed all ERP Roles ---
        roles_created = 0
        for name, description in ROLES:
            _, created = ERPRole.objects.get_or_create(
                name=name,
                defaults={'description': description, 'is_active': True}
            )
            if created:
                roles_created += 1
        self.stdout.write(self.style.SUCCESS(f'Roles: {roles_created} created, {len(ROLES) - roles_created} existing'))

        # --- 2. Seed all ERP Modules ---
        modules_created = 0
        for name, slug, description, icon, order in MODULES:
            _, created = ERPModule.objects.get_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'description': description,
                    'icon': icon,
                    'order': order,
                    'is_active': True,
                }
            )
            if created:
                modules_created += 1
        self.stdout.write(self.style.SUCCESS(f'Modules: {modules_created} created, {len(MODULES) - modules_created} existing'))

        # --- 3. Ensure Company exists ---
        company, created = Company.objects.get_or_create(
            company_code='COMP01',
            defaults={
                'legal_name': 'Main Company',
                'trade_name': 'Main Company',
                'default_currency': 'INR',
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created Company: {company}'))
        else:
            self.stdout.write(f'Using existing Company: {company}')

        # --- 4. Ensure Warehouse exists ---
        warehouse, created = Warehouse.objects.get_or_create(
            warehouse_code='WH01',
            defaults={
                'company': company,
                'name': 'Head Office',
                'warehouse_type': 'HEAD_OFFICE',
                'city': 'Head Office',
                'country': 'India',
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created Warehouse: {warehouse}'))
        else:
            self.stdout.write(f'Using existing Warehouse: {warehouse}')

        # --- 5. Create Admin Staff record ---
        staff, created = Staff.objects.get_or_create(
            staff_id='ADM-001',
            defaults={
                'staff_type': 'STAFF',
                'first_name': 'Admin',
                'last_name': 'User',
                'company': company,
                'primary_location': warehouse,
                'department': 'IT',
                'designation': 'IT Administrator',
                'employment_status': 'ACTIVE',
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created Staff: {staff}'))
        else:
            self.stdout.write(f'Using existing Staff: {staff}')

        # --- 6. Create Django User ---
        if User.objects.filter(username='admin').exists():
            user = User.objects.get(username='admin')
            self.stdout.write(f'Using existing Django User: {user.username}')
        else:
            user = User.objects.create_user(
                username='admin',
                password='Admin@123',
                first_name='Admin',
                last_name='User',
                email='admin@company.com',
                is_staff=True,
                is_superuser=True,
            )
            self.stdout.write(self.style.SUCCESS(f'Created Django User: {user.username} (password: Admin@123)'))

        # --- 7. Create StakeholderUser ---
        stakeholder, created = StakeholderUser.objects.get_or_create(
            user=user,
            defaults={
                'employee_record': staff,
                'primary_email': 'admin@company.com',
                'default_warehouse': warehouse,
                'status': 'ACTIVE',
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created StakeholderUser: {stakeholder}'))
        else:
            self.stdout.write(f'Using existing StakeholderUser: {stakeholder}')

        # --- 8. Get IT Admin role and assign to user ---
        it_admin_role = ERPRole.objects.get(name='IT Admin')

        role_assignment, created = UserRoleAssignment.objects.get_or_create(
            user=user,
            defaults={
                'role': it_admin_role,
                'assigned_by': user,
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Assigned role: {user.username} -> {it_admin_role.name}'))
        else:
            self.stdout.write(f'Role already assigned: {user.username} -> {role_assignment.role.name}')

        # --- 9. Grant FULL permissions on ALL modules for IT Admin ---
        modules = ERPModule.objects.filter(is_active=True)
        permissions_created = 0
        permissions_updated = 0

        for module in modules:
            perm, created = RolePermission.objects.get_or_create(
                role=it_admin_role,
                module=module,
                defaults={
                    'can_view': True,
                    'can_create': True,
                    'can_edit': True,
                    'can_delete': True,
                    'can_approve': True,
                    'can_reject': True,
                    'can_send_email': True,
                    'can_export': True,
                    'can_print': True,
                }
            )
            if created:
                permissions_created += 1
            else:
                perm.can_view = True
                perm.can_create = True
                perm.can_edit = True
                perm.can_delete = True
                perm.can_approve = True
                perm.can_reject = True
                perm.can_send_email = True
                perm.can_export = True
                perm.can_print = True
                perm.save()
                permissions_updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'Permissions: {permissions_created} created, {permissions_updated} updated '
            f'(full access on {modules.count()} modules)'
        ))

        # --- Summary ---
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('ADMIN SETUP COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(f'  Staff ID    : ADM-001 (Admin User)')
        self.stdout.write(f'  Username    : admin')
        self.stdout.write(f'  Password    : Admin@123')
        self.stdout.write(f'  Role        : IT Admin')
        self.stdout.write(f'  Permissions : Full access on all {modules.count()} modules')
        self.stdout.write(self.style.SUCCESS('=' * 50))
