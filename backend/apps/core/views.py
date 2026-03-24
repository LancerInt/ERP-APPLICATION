"""
Views for core app models.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rbac.permissions import HasModulePermission
from .models import (
    Company, Warehouse, Godown, Machinery, RoleDefinition,
    ApprovalLevel, StakeholderUser
)
from .serializers import (
    CompanySerializer, WarehouseSerializer, WarehouseDetailSerializer,
    GodownSerializer, MachinerySerializer, RoleDefinitionSerializer,
    RoleDefinitionWriteSerializer, StakeholderUserSerializer,
    StakeholderUserDetailSerializer
)
from .selectors import (
    get_warehouses_for_user, get_companies, warehouse_scope_filter
)


class CompanyViewSet(viewsets.ModelViewSet):
    """ViewSet for Company management."""

    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Company'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'default_currency']
    search_fields = ['company_code', 'legal_name', 'gstin', 'pan']
    ordering_fields = ['company_code', 'legal_name', 'created_at']
    ordering = ['company_code']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=False, methods=['get'])
    def active_companies(self, request):
        """Get all active companies."""
        companies = get_companies(is_active=True)
        serializer = self.get_serializer(companies, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def warehouses(self, request, pk=None):
        """Get all warehouses for a company."""
        company = self.get_object()
        warehouses = company.warehouses.filter(active_flag=True)
        serializer = WarehouseSerializer(warehouses, many=True)
        return Response(serializer.data)


class WarehouseViewSet(viewsets.ModelViewSet):
    """ViewSet for Warehouse management."""

    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Warehouse'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['company', 'warehouse_type', 'state', 'active_flag']
    search_fields = ['warehouse_code', 'name', 'city']
    ordering_fields = ['warehouse_code', 'city', 'created_at']
    ordering = ['warehouse_code']

    def get_queryset(self):
        """Filter warehouses based on user permissions."""
        return warehouse_scope_filter(self.request.user)

    def get_serializer_class(self):
        """Use detailed serializer for retrieve action."""
        if self.action == 'retrieve':
            return WarehouseDetailSerializer
        return self.serializer_class

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=True, methods=['get'])
    def godowns(self, request, pk=None):
        """Get all godowns in warehouse."""
        warehouse = self.get_object()
        godowns = warehouse.godowns.all()
        serializer = GodownSerializer(godowns, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def assign_managers(self, request, pk=None):
        """Assign warehouse managers."""
        warehouse = self.get_object()
        user_ids = request.data.get('user_ids', [])
        warehouse.warehouse_managers.set(user_ids)
        return Response(
            {'message': 'Managers assigned successfully'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def user_warehouses(self, request):
        """Get warehouses accessible to current user."""
        warehouses = get_warehouses_for_user(request.user)
        serializer = self.get_serializer(warehouses, many=True)
        return Response(serializer.data)


class GodownViewSet(viewsets.ModelViewSet):
    """ViewSet for Godown management."""

    queryset = Godown.objects.all()
    serializer_class = GodownSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Godown'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'storage_condition', 'active_flag']
    search_fields = ['godown_code', 'godown_name']
    ordering_fields = ['godown_code', 'storage_condition', 'created_at']
    ordering = ['godown_code']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=False, methods=['get'])
    def warehouse_godowns(self, request):
        """Get godowns for a specific warehouse."""
        warehouse_id = request.query_params.get('warehouse_id')
        if not warehouse_id:
            return Response(
                {'error': 'warehouse_id query parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        godowns = self.get_queryset().filter(warehouse_id=warehouse_id)
        serializer = self.get_serializer(godowns, many=True)
        return Response(serializer.data)


class MachineryViewSet(viewsets.ModelViewSet):
    """ViewSet for Machinery management."""

    queryset = Machinery.objects.all()
    serializer_class = MachinerySerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Machinery'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'category', 'status']
    search_fields = ['machine_id', 'machine_name']
    ordering_fields = ['machine_id', 'status', 'next_service_due', 'created_at']
    ordering = ['machine_id']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=False, methods=['get'])
    def maintenance_due(self, request):
        """Get machinery due for maintenance."""
        from django.utils import timezone
        machinery = self.get_queryset().filter(
            status='ACTIVE',
            next_service_due__lte=timezone.now().date()
        )
        serializer = self.get_serializer(machinery, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update machinery status."""
        machinery = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Machinery.STATUS_CHOICES):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        machinery.status = new_status
        machinery.save()
        return Response(self.get_serializer(machinery).data)


class RoleDefinitionViewSet(viewsets.ModelViewSet):
    """ViewSet for RoleDefinition management."""

    queryset = RoleDefinition.objects.prefetch_related('approval_levels')
    serializer_class = RoleDefinitionSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Role Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['data_scope', 'active_flag']
    search_fields = ['role_code', 'role_name']
    ordering_fields = ['role_code', 'data_scope', 'created_at']
    ordering = ['role_code']

    def get_serializer_class(self):
        """Use write serializer for create/update."""
        if self.action in ['create', 'update', 'partial_update']:
            return RoleDefinitionWriteSerializer
        return RoleDefinitionSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=False, methods=['get'])
    def by_scope(self, request):
        """Get roles by data scope."""
        scope = request.query_params.get('scope')
        if not scope:
            return Response(
                {'error': 'scope query parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        roles = self.get_queryset().filter(data_scope=scope, active_flag=True)
        serializer = self.get_serializer(roles, many=True)
        return Response(serializer.data)


class StakeholderUserViewSet(viewsets.ModelViewSet):
    """ViewSet for StakeholderUser management."""

    queryset = StakeholderUser.objects.select_related(
        'user', 'default_warehouse', 'employee_record'
    ).prefetch_related('assigned_roles', 'warehouse_scope')
    serializer_class = StakeholderUserSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'User Management'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'is_active']
    search_fields = ['user__username', 'primary_email', 'user__first_name', 'user__last_name']
    ordering_fields = ['user__username', 'primary_email', 'created_at']
    ordering = ['user__username']

    def get_serializer_class(self):
        """Use detailed serializer for retrieve action."""
        if self.action == 'retrieve':
            return StakeholderUserDetailSerializer
        return self.serializer_class

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    @action(detail=True, methods=['post'])
    def assign_roles(self, request, pk=None):
        """Assign roles to user."""
        stakeholder = self.get_object()
        role_ids = request.data.get('role_ids', [])
        stakeholder.assigned_roles.set(role_ids)
        return Response(
            {'message': 'Roles assigned successfully'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def assign_warehouse_scope(self, request, pk=None):
        """Assign warehouse scope to user."""
        stakeholder = self.get_object()
        warehouse_ids = request.data.get('warehouse_ids', [])
        stakeholder.warehouse_scope.set(warehouse_ids)
        return Response(
            {'message': 'Warehouse scope assigned successfully'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def active_users(self, request):
        """Get all active users."""
        users = self.get_queryset().filter(status='ACTIVE', is_active=True)
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_warehouses(self, request):
        """Get warehouses accessible to current user."""
        if not hasattr(request.user, 'stakeholder_profile'):
            return Response(
                {'error': 'User does not have stakeholder profile'},
                status=status.HTTP_400_BAD_REQUEST
            )
        warehouses = request.user.stakeholder_profile.warehouse_scope.all()
        from .serializers import WarehouseSerializer
        serializer = WarehouseSerializer(warehouses, many=True)
        return Response(serializer.data)
