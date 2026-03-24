"""
Business logic services for core app.
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import (
    Company, Warehouse, Godown, Machinery, RoleDefinition,
    ApprovalLevel, StakeholderUser
)


class CompanyService:
    """Service for Company business logic."""

    @staticmethod
    @transaction.atomic
    def create_company(
        company_code: str,
        legal_name: str,
        gstin: str,
        pan: str,
        contact_email: str,
        contact_phone: str,
        active_from,
        **kwargs
    ) -> Company:
        """Create new company with validation."""
        if Company.objects.filter(company_code=company_code).exists():
            raise ValidationError(f"Company code {company_code} already exists")

        if Company.objects.filter(gstin=gstin).exists():
            raise ValidationError(f"GSTIN {gstin} already registered")

        company = Company.objects.create(
            company_code=company_code,
            legal_name=legal_name,
            gstin=gstin,
            pan=pan,
            contact_email=contact_email,
            contact_phone=contact_phone,
            active_from=active_from,
            **kwargs
        )
        return company

    @staticmethod
    def deactivate_company(company: Company, active_to=None) -> Company:
        """Deactivate company and cascade."""
        if active_to is None:
            active_to = timezone.now().date()

        company.active_to = active_to
        company.is_active = False
        company.save()

        # Deactivate related warehouses
        company.warehouses.all().update(active_flag=False)

        return company

    @staticmethod
    def get_company_summary(company: Company) -> dict:
        """Get company overview."""
        return {
            'company_code': company.company_code,
            'legal_name': company.legal_name,
            'warehouse_count': company.warehouses.count(),
            'active_warehouse_count': company.warehouses.filter(active_flag=True).count(),
            'user_count': StakeholderUser.objects.filter(
                warehouse_scope__company=company
            ).distinct().count(),
            'status': 'ACTIVE' if company.is_active else 'INACTIVE',
            'default_currency': company.default_currency,
        }


class WarehouseService:
    """Service for Warehouse business logic."""

    @staticmethod
    @transaction.atomic
    def create_warehouse(
        warehouse_code: str,
        company: Company,
        name: str,
        warehouse_type: str,
        city: str,
        state: str,
        pincode: str,
        **kwargs
    ) -> Warehouse:
        """Create warehouse with validation."""
        if Warehouse.objects.filter(
            company=company,
            warehouse_code=warehouse_code
        ).exists():
            raise ValidationError(
                f"Warehouse {warehouse_code} already exists in {company.company_code}"
            )

        warehouse = Warehouse.objects.create(
            warehouse_code=warehouse_code,
            company=company,
            name=name,
            warehouse_type=warehouse_type,
            city=city,
            state=state,
            pincode=pincode,
            **kwargs
        )
        return warehouse

    @staticmethod
    @transaction.atomic
    def assign_warehouse_manager(warehouse: Warehouse, user: StakeholderUser):
        """Assign manager to warehouse."""
        warehouse.warehouse_managers.add(user)
        if user.default_warehouse is None:
            user.default_warehouse = warehouse
            user.save()

    @staticmethod
    @transaction.atomic
    def assign_warehouse_coordinators(warehouse: Warehouse, users: list):
        """Bulk assign coordinators."""
        warehouse.warehouse_coordinators.set(users)

    @staticmethod
    def get_warehouse_inventory_snapshot(warehouse: Warehouse) -> dict:
        """Get warehouse inventory status."""
        from django.db.models import Count

        godowns = warehouse.godowns.annotate(
            item_count=Count('stocklocation')  # Assumes inventory app
        )

        return {
            'warehouse_code': warehouse.warehouse_code,
            'name': warehouse.name,
            'godown_count': godowns.count(),
            'active_godown_count': godowns.filter(active_flag=True).count(),
            'machinery_count': warehouse.machinery.count(),
            'machinery_active': warehouse.machinery.filter(status='ACTIVE').count(),
            'machinery_maintenance_due': warehouse.machinery.filter(
                status='ACTIVE',
                next_service_due__isnull=False
            ).count(),
        }

    @staticmethod
    def get_warehouse_staff(warehouse: Warehouse) -> dict:
        """Get warehouse staff assignments."""
        return {
            'managers': list(warehouse.warehouse_managers.values_list('user__username', flat=True)),
            'coordinators': list(warehouse.warehouse_coordinators.values_list('user__username', flat=True)),
            'supervisors': list(warehouse.warehouse_supervisors.values_list('user__username', flat=True)),
            'office_coordinator': (
                warehouse.warehouse_coordinator_office.user.username
                if warehouse.warehouse_coordinator_office else None
            ),
            'hr_coordinator': (
                warehouse.warehouse_hr_coordinator.user.username
                if warehouse.warehouse_hr_coordinator else None
            ),
        }


class GodownService:
    """Service for Godown business logic."""

    @staticmethod
    @transaction.atomic
    def create_godown(
        godown_code: str,
        warehouse: Warehouse,
        godown_name: str,
        storage_condition: str,
        capacity_uom: str,
        capacity_value: Decimal,
        **kwargs
    ) -> Godown:
        """Create godown with validation."""
        if Godown.objects.filter(
            warehouse=warehouse,
            godown_code=godown_code
        ).exists():
            raise ValidationError(
                f"Godown {godown_code} already exists in {warehouse.warehouse_code}"
            )

        if capacity_value <= 0:
            raise ValidationError("Capacity value must be positive")

        godown = Godown.objects.create(
            godown_code=godown_code,
            warehouse=warehouse,
            godown_name=godown_name,
            storage_condition=storage_condition,
            capacity_uom=capacity_uom,
            capacity_value=capacity_value,
            **kwargs
        )
        return godown

    @staticmethod
    def get_godown_utilization(godown: Godown) -> dict:
        """Calculate godown utilization."""
        # Placeholder - integrate with inventory app
        return {
            'godown_code': godown.godown_code,
            'capacity': float(godown.capacity_value),
            'capacity_uom': godown.capacity_uom,
            'storage_condition': godown.storage_condition,
            'utilization_percent': 0,  # To be calculated from inventory
            'batch_tracking_enabled': godown.batch_tracking_enabled,
        }


class MachineryService:
    """Service for Machinery business logic."""

    @staticmethod
    @transaction.atomic
    def create_machinery(
        machine_id: str,
        warehouse: Warehouse,
        machine_name: str,
        category: str,
        commission_date,
        **kwargs
    ) -> Machinery:
        """Create machinery record with validation."""
        if Machinery.objects.filter(machine_id=machine_id).exists():
            raise ValidationError(f"Machine ID {machine_id} already exists")

        machinery = Machinery.objects.create(
            machine_id=machine_id,
            warehouse=warehouse,
            machine_name=machine_name,
            category=category,
            commission_date=commission_date,
            **kwargs
        )
        return machinery

    @staticmethod
    def schedule_maintenance(
        machinery: Machinery,
        vendor,
        next_service_date
    ) -> Machinery:
        """Schedule machinery maintenance."""
        machinery.maintenance_vendor = vendor
        machinery.next_service_due = next_service_date
        machinery.status = 'ACTIVE'
        machinery.save()
        return machinery

    @staticmethod
    def retire_machinery(machinery: Machinery) -> Machinery:
        """Retire machinery from service."""
        machinery.status = 'RETIRED'
        machinery.save()
        return machinery


class RoleService:
    """Service for role and permission management."""

    @staticmethod
    @transaction.atomic
    def create_role_with_approvals(
        role_code: str,
        role_name: str,
        data_scope: str,
        module_permissions: dict,
        approval_levels_data: list = None,
        **kwargs
    ) -> RoleDefinition:
        """Create role with approval levels."""
        if RoleDefinition.objects.filter(role_code=role_code).exists():
            raise ValidationError(f"Role code {role_code} already exists")

        role = RoleDefinition.objects.create(
            role_code=role_code,
            role_name=role_name,
            data_scope=data_scope,
            module_permissions=module_permissions,
            **kwargs
        )

        if approval_levels_data:
            for level_data in approval_levels_data:
                ApprovalLevel.objects.create(role=role, **level_data)

        return role

    @staticmethod
    def get_role_permissions(role: RoleDefinition) -> dict:
        """Get all permissions for role."""
        return {
            'role_code': role.role_code,
            'role_name': role.role_name,
            'data_scope': role.data_scope,
            'module_permissions': role.module_permissions,
            'approval_levels': list(role.approval_levels.values(
                'module', 'stage', 'min_amount', 'max_amount'
            )),
        }

    @staticmethod
    def check_approval_authority(
        role: RoleDefinition,
        module: str,
        amount: Decimal
    ) -> bool:
        """Check if role can approve transaction."""
        approval = ApprovalLevel.objects.filter(
            role=role,
            module=module
        ).first()

        if not approval:
            return False

        if approval.min_amount and amount < approval.min_amount:
            return False

        if approval.max_amount and amount > approval.max_amount:
            return False

        return True


class StakeholderUserService:
    """Service for user and role assignment."""

    @staticmethod
    @transaction.atomic
    def create_stakeholder_user(
        user,
        primary_email: str,
        mobile: str,
        **kwargs
    ) -> StakeholderUser:
        """Create stakeholder user profile."""
        if StakeholderUser.objects.filter(user=user).exists():
            raise ValidationError(f"Stakeholder profile already exists for {user.username}")

        stakeholder = StakeholderUser.objects.create(
            user=user,
            primary_email=primary_email,
            mobile=mobile,
            **kwargs
        )
        return stakeholder

    @staticmethod
    @transaction.atomic
    def assign_roles(
        stakeholder_user: StakeholderUser,
        roles: list
    ) -> StakeholderUser:
        """Assign roles to user."""
        stakeholder_user.assigned_roles.set(roles)
        return stakeholder_user

    @staticmethod
    @transaction.atomic
    def set_warehouse_scope(
        stakeholder_user: StakeholderUser,
        warehouses: list
    ) -> StakeholderUser:
        """Set warehouse access scope for user."""
        stakeholder_user.warehouse_scope.set(warehouses)
        return stakeholder_user

    @staticmethod
    def get_user_permissions(user) -> dict:
        """Get all permissions for a user."""
        if not hasattr(user, 'stakeholder_profile'):
            return {'error': 'User has no stakeholder profile'}

        stakeholder = user.stakeholder_profile
        roles = stakeholder.assigned_roles.all()
        warehouses = stakeholder.warehouse_scope.all()

        permissions = {}
        for role in roles:
            permissions.update(role.module_permissions)

        return {
            'username': user.username,
            'roles': [r.role_code for r in roles],
            'warehouses': [w.warehouse_code for w in warehouses],
            'permissions': permissions,
            'data_scope': roles.first().data_scope if roles.exists() else None,
        }

    @staticmethod
    def update_last_accessed(stakeholder_user: StakeholderUser):
        """Update user's last access timestamp."""
        stakeholder_user.last_accessed = timezone.now()
        stakeholder_user.save(update_fields=['last_accessed'])

    @staticmethod
    def suspend_user(stakeholder_user: StakeholderUser) -> StakeholderUser:
        """Suspend user access."""
        stakeholder_user.status = 'SUSPENDED'
        stakeholder_user.save()
        return stakeholder_user

    @staticmethod
    def activate_user(stakeholder_user: StakeholderUser) -> StakeholderUser:
        """Activate suspended user."""
        stakeholder_user.status = 'ACTIVE'
        stakeholder_user.save()
        return stakeholder_user
