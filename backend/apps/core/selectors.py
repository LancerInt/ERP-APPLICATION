"""
Query selectors and filters for core app.
Optimized queries with select_related and prefetch_related.
"""
from django.db.models import Prefetch, Q
from .models import Company, Warehouse, Godown, StakeholderUser, RoleDefinition, Machinery


def get_companies(is_active: bool = True, **filters):
    """
    Get companies with optional filters.
    Optimized for list views.
    """
    queryset = Company.objects.all()

    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)

    for key, value in filters.items():
        if value is not None:
            queryset = queryset.filter(**{key: value})

    return queryset.order_by('company_code')


def get_company_detail(company_id: int):
    """
    Get single company with related data.
    """
    return Company.objects.filter(id=company_id).prefetch_related(
        'warehouses'
    ).first()


def get_warehouses_for_company(company: Company):
    """
    Get all warehouses for a company.
    """
    return company.warehouses.select_related('company').filter(
        active_flag=True
    ).order_by('warehouse_code')


def get_warehouses_for_user(user):
    """
    Get warehouses accessible to a user based on stakeholder profile.
    Uses proper select_related for optimization.
    """
    if not hasattr(user, 'stakeholder_profile'):
        # User without stakeholder profile sees all active warehouses (for dropdown lookups)
        return Warehouse.objects.filter(active_flag=True).select_related('company').order_by('warehouse_code')

    stakeholder = user.stakeholder_profile

    # User's explicit warehouse scope
    explicit_warehouses = stakeholder.warehouse_scope.select_related('company')

    # If no explicit scope, check default warehouse
    if not explicit_warehouses.exists() and stakeholder.default_warehouse:
        return Warehouse.objects.filter(
            id=stakeholder.default_warehouse.id
        ).select_related('company')

    return explicit_warehouses.filter(active_flag=True).order_by('warehouse_code')


def warehouse_scope_filter(user):
    """
    Filter warehouses based on user's access scope.
    Returns QuerySet with proper optimizations.
    """
    if not user.is_authenticated:
        return Warehouse.objects.none()

    if user.is_superuser:
        return Warehouse.objects.select_related('company').filter(
            active_flag=True
        ).order_by('warehouse_code')

    # Regular user - check stakeholder profile
    warehouses = get_warehouses_for_user(user)
    return warehouses.select_related('company').prefetch_related(
        'warehouse_managers',
        'warehouse_coordinators',
        'warehouse_supervisors'
    )


def get_warehouse_detail(warehouse_id: int, prefetch_related_objects=None):
    """
    Get warehouse with all related data.
    """
    if prefetch_related_objects is None:
        prefetch_related_objects = [
            'godowns',
            'machinery',
            'warehouse_managers__user',
            'warehouse_coordinators__user',
            'warehouse_supervisors__user',
        ]

    return Warehouse.objects.filter(id=warehouse_id).select_related(
        'company',
        'warehouse_coordinator_office__user',
        'warehouse_hr_coordinator__user'
    ).prefetch_related(*prefetch_related_objects).first()


def get_godowns_for_warehouse(warehouse: Warehouse):
    """
    Get all godowns in a warehouse.
    """
    return warehouse.godowns.filter(
        active_flag=True
    ).order_by('godown_code')


def get_godown_detail(godown_id: int):
    """
    Get godown with related data.
    """
    return Godown.objects.filter(id=godown_id).select_related(
        'warehouse'
    ).first()


def get_machinery_by_warehouse(warehouse: Warehouse):
    """
    Get machinery in a warehouse.
    """
    return warehouse.machinery.select_related(
        'warehouse',
        'godown',
        'maintenance_vendor'
    ).order_by('machine_id')


def get_machinery_due_maintenance():
    """
    Get machinery that requires maintenance.
    """
    from django.utils import timezone
    return Machinery.objects.filter(
        status='ACTIVE',
        next_service_due__isnull=False,
        next_service_due__lte=timezone.now().date()
    ).select_related(
        'warehouse',
        'maintenance_vendor'
    ).order_by('next_service_due')


def get_stakeholder_users(status: str = 'ACTIVE', **filters):
    """
    Get stakeholder users with proper optimizations.
    """
    queryset = StakeholderUser.objects.select_related(
        'user',
        'default_warehouse',
        'employee_record'
    ).prefetch_related(
        'assigned_roles',
        'warehouse_scope'
    )

    if status:
        queryset = queryset.filter(status=status)

    for key, value in filters.items():
        if value is not None:
            queryset = queryset.filter(**{key: value})

    return queryset.order_by('user__username')


def get_stakeholder_user_detail(user_id: int):
    """
    Get single stakeholder user with all related data.
    """
    return StakeholderUser.objects.filter(id=user_id).select_related(
        'user',
        'default_warehouse',
        'employee_record'
    ).prefetch_related(
        'assigned_roles__approval_levels',
        'warehouse_scope'
    ).first()


def get_user_permissions_scope(stakeholder_user: StakeholderUser):
    """
    Get complete permission and scope information for a user.
    """
    return {
        'warehouses': stakeholder_user.warehouse_scope.select_related(
            'company'
        ).values_list('id', 'warehouse_code', 'company__company_code'),
        'roles': stakeholder_user.assigned_roles.prefetch_related(
            'approval_levels'
        ).values('id', 'role_code', 'data_scope'),
        'default_warehouse': (
            stakeholder_user.default_warehouse.id
            if stakeholder_user.default_warehouse else None
        ),
    }


def get_roles_by_scope(data_scope: str):
    """
    Get roles by data scope.
    """
    return RoleDefinition.objects.filter(
        data_scope=data_scope,
        active_flag=True
    ).prefetch_related(
        'approval_levels'
    ).order_by('role_code')


def get_role_detail(role_id: int):
    """
    Get role with approval levels.
    """
    return RoleDefinition.objects.filter(id=role_id).prefetch_related(
        'approval_levels'
    ).first()


def search_users_by_warehouse(warehouse: Warehouse):
    """
    Get all users associated with a warehouse.
    """
    return StakeholderUser.objects.filter(
        Q(warehouse_scope=warehouse) |
        Q(default_warehouse=warehouse) |
        Q(managed_warehouses=warehouse) |
        Q(coordinated_warehouses=warehouse) |
        Q(supervised_warehouses=warehouse)
    ).select_related(
        'user',
        'default_warehouse'
    ).prefetch_related(
        'assigned_roles'
    ).distinct().order_by('user__username')


def get_active_warehouses_by_company(company: Company):
    """
    Get all active warehouses for a company with staff information.
    """
    return company.warehouses.filter(
        active_flag=True
    ).prefetch_related(
        'warehouse_managers__user',
        'warehouse_coordinators__user',
        'warehouse_supervisors__user'
    ).order_by('warehouse_code')


def get_company_overview(company: Company):
    """
    Get comprehensive company overview with counts.
    """
    from django.db.models import Count

    warehouses = company.warehouses.annotate(
        manager_count=Count('warehouse_managers'),
        coordinator_count=Count('warehouse_coordinators'),
        supervisor_count=Count('warehouse_supervisors'),
        godown_count=Count('godowns'),
        machinery_count=Count('machinery')
    )

    return {
        'company_code': company.company_code,
        'legal_name': company.legal_name,
        'is_active': company.is_active,
        'warehouse_count': warehouses.count(),
        'active_warehouse_count': warehouses.filter(active_flag=True).count(),
        'total_staff': StakeholderUser.objects.filter(
            warehouse_scope__company=company
        ).distinct().count(),
        'warehouses': [
            {
                'code': w.warehouse_code,
                'name': w.name,
                'managers': w.manager_count,
                'coordinators': w.coordinator_count,
                'supervisors': w.supervisor_count,
                'godowns': w.godown_count,
                'machinery': w.machinery_count,
            }
            for w in warehouses
        ]
    }


def filter_warehouses_by_location(city: str = None, state: str = None):
    """
    Filter warehouses by location.
    """
    queryset = Warehouse.objects.filter(active_flag=True).select_related('company')

    if city:
        queryset = queryset.filter(city__icontains=city)

    if state:
        queryset = queryset.filter(state=state)

    return queryset.order_by('city', 'warehouse_code')


def get_warehouse_hierarchy(warehouse: Warehouse):
    """
    Get complete warehouse hierarchy: warehouse -> godowns -> machinery.
    """
    godown_prefetch = Prefetch(
        'godowns',
        Godown.objects.filter(active_flag=True).prefetch_related(
            Prefetch(
                'machinery',
                Machinery.objects.filter(status='ACTIVE')
            )
        )
    )

    return Warehouse.objects.filter(id=warehouse.id).select_related(
        'company'
    ).prefetch_related(
        godown_prefetch
    ).first()
