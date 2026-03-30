from django.contrib.auth import get_user_model
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

from rbac.models import (
    ERPRole,
    ERPModule,
    ERPPermission,
    RolePermission,
    UserRoleAssignment,
    AuditLog,
)
from rbac.serializers import (
    ERPRoleSerializer,
    ERPModuleSerializer,
    ERPPermissionSerializer,
    ERPPermissionWriteSerializer,
    RolePermissionSerializer,
    RolePermissionWriteSerializer,
    UserRoleAssignmentSerializer,
    AuditLogSerializer,
    UserWithRoleSerializer,
    UserWithPermissionsSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _is_office_manager_or_admin(user):
    """Return True if user is superuser or has Office Manager / IT Admin role."""
    if user.is_superuser:
        return True
    try:
        assignment = UserRoleAssignment.objects.select_related('role').get(user=user)
        if assignment.role.name in ('Office Manager', 'IT Admin'):
            return True
    except UserRoleAssignment.DoesNotExist:
        pass
    return False


class IsAdminOrOfficeManager(permissions.BasePermission):
    """Allow access to superusers and Office Manager / IT Admin role holders."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and _is_office_manager_or_admin(request.user)
        )


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------

class ERPRoleViewSet(viewsets.ModelViewSet):
    """CRUD for ERP Roles.  Non-admin users get read-only access."""

    queryset = ERPRole.objects.all()
    serializer_class = ERPRoleSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminUser()]


class ERPModuleViewSet(viewsets.ModelViewSet):
    """List ERP Modules.  Returns only modules the user's role has access to
    (unless user is admin, in which case all are returned)."""

    serializer_class = ERPModuleSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'slug']
    ordering_fields = ['order', 'name']

    def get_queryset(self):
        qs = ERPModule.objects.filter(is_active=True)
        if self.request.user.is_superuser:
            return qs
        # Role-based: get user's role, then find modules with can_view
        try:
            assignment = UserRoleAssignment.objects.select_related('role').get(
                user=self.request.user
            )
            allowed_module_ids = RolePermission.objects.filter(
                role=assignment.role,
                can_view=True,
            ).values_list('module_id', flat=True)
            return qs.filter(id__in=allowed_module_ids)
        except UserRoleAssignment.DoesNotExist:
            return qs.none()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAdminUser()]


class ERPPermissionViewSet(viewsets.ModelViewSet):
    """Manage per-user module permissions (LEGACY).  Admin only."""

    queryset = ERPPermission.objects.select_related('user', 'module', 'granted_by').all()
    permission_classes = [IsAdminUser]
    filterset_fields = ['user', 'module', 'can_view', 'can_create', 'can_edit', 'can_delete']
    search_fields = ['user__username', 'module__name']
    ordering_fields = ['granted_at', 'module__order']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ERPPermissionWriteSerializer
        return ERPPermissionSerializer

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_assign(self, request):
        """Bulk-assign permissions (LEGACY user-based).

        Expects: { "user": <id>, "permissions": [ { "module": <id>, "can_view": true, ... }, ... ] }
        """
        user_id = request.data.get('user')
        perms_data = request.data.get('permissions', [])

        if not user_id or not perms_data:
            return Response(
                {'detail': 'user and permissions are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        results = []
        for perm in perms_data:
            module_id = perm.get('module')
            if not module_id:
                continue
            obj, _ = ERPPermission.objects.update_or_create(
                user=target_user,
                module_id=module_id,
                defaults={
                    'can_view': perm.get('can_view', False),
                    'can_create': perm.get('can_create', False),
                    'can_edit': perm.get('can_edit', False),
                    'can_delete': perm.get('can_delete', False),
                    'granted_by': request.user,
                },
            )
            results.append(ERPPermissionSerializer(obj).data)

        return Response(results, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# NEW: Role-based Permission ViewSet
# ---------------------------------------------------------------------------

class RolePermissionViewSet(viewsets.ModelViewSet):
    """Manage role-module permissions.  Admin only.

    Supports standard CRUD plus a bulk_assign action.
    """

    queryset = RolePermission.objects.select_related('role', 'module').all()
    permission_classes = [IsAdminUser]
    filterset_fields = ['role', 'module', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_reject', 'can_send_email', 'can_export', 'can_print']
    search_fields = ['role__name', 'module__name']
    ordering_fields = ['role__name', 'module__name']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return RolePermissionWriteSerializer
        return RolePermissionSerializer

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk_assign(self, request):
        """Bulk-assign permissions to a role.

        Expects:
        {
            "role_id": <id>,
            "permissions": [
                { "module_id": <id>, "can_view": true, "can_create": false, "can_edit": false, "can_delete": false },
                ...
            ]
        }
        """
        role_id = request.data.get('role_id')
        perms_data = request.data.get('permissions', [])

        if not role_id or not perms_data:
            return Response(
                {'detail': 'role_id and permissions are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            role = ERPRole.objects.get(pk=role_id)
        except ERPRole.DoesNotExist:
            return Response(
                {'detail': 'Role not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        results = []
        for perm in perms_data:
            module_id = perm.get('module_id')
            if not module_id:
                continue
            try:
                module = ERPModule.objects.get(pk=module_id)
            except ERPModule.DoesNotExist:
                continue

            obj, created = RolePermission.objects.update_or_create(
                role=role,
                module_id=module_id,
                defaults={
                    'can_view': perm.get('can_view', False),
                    'can_create': perm.get('can_create', False),
                    'can_edit': perm.get('can_edit', False),
                    'can_delete': perm.get('can_delete', False),
                    'can_approve': perm.get('can_approve', False),
                    'can_reject': perm.get('can_reject', False),
                    'can_send_email': perm.get('can_send_email', False),
                    'can_export': perm.get('can_export', False),
                    'can_print': perm.get('can_print', False),
                },
            )
            results.append(RolePermissionSerializer(obj).data)

            # Log to AuditLog
            AuditLog.objects.create(
                user=request.user,
                action='CREATE' if created else 'EDIT',
                module_name=module.name,
                details=(
                    f"{'Created' if created else 'Updated'} permission for role "
                    f"'{role.name}' on module '{module.name}': "
                    f"view={perm.get('can_view', False)}, "
                    f"create={perm.get('can_create', False)}, "
                    f"edit={perm.get('can_edit', False)}, "
                    f"delete={perm.get('can_delete', False)}, "
                    f"approve={perm.get('can_approve', False)}, "
                    f"reject={perm.get('can_reject', False)}, "
                    f"send_email={perm.get('can_send_email', False)}, "
                    f"export={perm.get('can_export', False)}, "
                    f"print={perm.get('can_print', False)}"
                ),
            )

        return Response(results, status=status.HTTP_200_OK)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to audit logs.  Admin and Office Manager only."""

    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrOfficeManager]
    filterset_fields = ['user', 'action', 'module_name']
    search_fields = ['user__username', 'module_name', 'details']
    ordering_fields = ['timestamp']


class UserManagementViewSet(viewsets.ModelViewSet):
    """Admin-only user management.

    Provides list, create (with optional ERP role assignment), and
    role assignment helpers.  Users are returned with their ERP role info.
    """

    queryset = User.objects.all().order_by('username')
    serializer_class = UserWithRoleSerializer
    permission_classes = [IsAdminUser]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined']

    def create(self, request, *args, **kwargs):
        """Create a new Django user with optional ERP role assignment.

        Expects:
        {
            "username": "...",
            "password": "...",
            "email": "...",
            "first_name": "...",
            "last_name": "...",
            "role_id": 1   // optional - ERPRole ID
        }
        """
        data = request.data
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return Response(
                {'detail': 'username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {'detail': 'A user with that username already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=username,
            password=password,
            email=data.get('email', ''),
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
        )

        # Assign ERP role if provided (accept both 'role_id' and 'role')
        role_id = data.get('role_id') or data.get('role')
        if role_id:
            try:
                role = ERPRole.objects.get(pk=role_id)
                UserRoleAssignment.objects.create(
                    user=user,
                    role=role,
                    assigned_by=request.user,
                )
            except ERPRole.DoesNotExist:
                pass  # silently skip if role doesn't exist

        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        """Handle user update including role change and password hashing."""
        # Extract password before serializer.save() to avoid saving plain text
        password = self.request.data.get('password')
        user = serializer.save()

        # Hash the password properly if it was provided
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])

        # Handle role assignment if role_id is in the request
        role_id = self.request.data.get('role_id') or self.request.data.get('role')
        if role_id:
            try:
                role = ERPRole.objects.get(pk=role_id)
                UserRoleAssignment.objects.update_or_create(
                    user=user,
                    defaults={'role': role, 'assigned_by': self.request.user}
                )
            except ERPRole.DoesNotExist:
                pass

    @action(detail=True, methods=['post'], url_path='assign-role')
    def assign_role(self, request, pk=None):
        """Assign or change a user's ERP role.

        Expects: { "role_id": 1 }
        """
        user = self.get_object()
        role_id = request.data.get('role_id')
        if not role_id:
            return Response(
                {'detail': 'role_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            role = ERPRole.objects.get(pk=role_id)
        except ERPRole.DoesNotExist:
            return Response(
                {'detail': 'Role not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        assignment, created = UserRoleAssignment.objects.update_or_create(
            user=user,
            defaults={
                'role': role,
                'assigned_by': request.user,
            },
        )

        return Response(
            UserWithRoleSerializer(user).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='assign-permissions')
    def assign_permissions(self, request, pk=None):
        """Assign module permissions to a user (LEGACY - kept for backward compat).

        Expects: { "permissions": [ { "module": <id>, "can_view": true, ... }, ... ] }
        """
        user = self.get_object()
        perms_data = request.data.get('permissions', [])

        results = []
        for perm in perms_data:
            module_id = perm.get('module')
            if not module_id:
                continue
            obj, _ = ERPPermission.objects.update_or_create(
                user=user,
                module_id=module_id,
                defaults={
                    'can_view': perm.get('can_view', False),
                    'can_create': perm.get('can_create', False),
                    'can_edit': perm.get('can_edit', False),
                    'can_delete': perm.get('can_delete', False),
                    'granted_by': request.user,
                },
            )
            results.append(ERPPermissionSerializer(obj).data)

        return Response(results, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Standalone view - current user's permissions (for sidebar rendering)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_permissions_view(request):
    """Return the current user's role and module permissions.

    Response format:
    {
        "is_superuser": true/false,
        "is_admin": true/false,
        "role": {"id": 1, "name": "IT Admin"} or null,
        "permissions": [
            {"module_name": "Company", "module_slug": "company",
             "can_view": true, "can_create": true, "can_edit": true, "can_delete": true},
            ...
        ]
    }
    """
    user = request.user

    # Determine role
    role_data = None
    try:
        assignment = UserRoleAssignment.objects.select_related('role').get(user=user)
        role_data = {'id': assignment.role.id, 'name': assignment.role.name}
    except UserRoleAssignment.DoesNotExist:
        pass

    # Build permissions list
    if user.is_superuser:
        modules = ERPModule.objects.filter(is_active=True)
        perms = [
            {
                'module_name': m.name,
                'module_slug': m.slug,
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
            for m in modules
        ]
    elif role_data:
        role_perms = RolePermission.objects.filter(
            role_id=role_data['id'],
            can_view=True,
        ).select_related('module').filter(module__is_active=True)
        perms = [
            {
                'module_name': rp.module.name,
                'module_slug': rp.module.slug,
                'can_view': rp.can_view,
                'can_create': rp.can_create,
                'can_edit': rp.can_edit,
                'can_delete': rp.can_delete,
                'can_approve': rp.can_approve,
                'can_reject': rp.can_reject,
                'can_send_email': rp.can_send_email,
                'can_export': rp.can_export,
                'can_print': rp.can_print,
            }
            for rp in role_perms
        ]
    else:
        perms = []

    return Response({
        'is_superuser': user.is_superuser,
        'is_admin': user.is_superuser or _is_office_manager_or_admin(user),
        'role': role_data,
        'permissions': perms,
    })
