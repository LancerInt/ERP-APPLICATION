from django.contrib.auth import get_user_model
from rest_framework import serializers

from rbac.models import (
    ERPRole,
    ERPModule,
    ERPPermission,
    RolePermission,
    UserRoleAssignment,
    AuditLog,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Existing serializers (kept as-is)
# ---------------------------------------------------------------------------

class ERPRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ERPRole
        fields = ['id', 'name', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class ERPModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ERPModule
        fields = ['id', 'name', 'slug', 'description', 'icon', 'order', 'is_active']
        read_only_fields = ['id']


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username', 'role_name', 'module_name',
            'action', 'details', 'ip_address', 'timestamp',
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Legacy serializers (kept for backward compatibility)
# ---------------------------------------------------------------------------

class ERPPermissionSerializer(serializers.ModelSerializer):
    """Read serializer with nested module info (LEGACY - user-based)."""

    module = ERPModuleSerializer(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    granted_by_username = serializers.CharField(
        source='granted_by.username', read_only=True, default=None
    )

    class Meta:
        model = ERPPermission
        fields = [
            'id', 'user', 'username', 'module',
            'can_view', 'can_create', 'can_edit', 'can_delete',
            'granted_by', 'granted_by_username', 'granted_at',
        ]
        read_only_fields = ['id', 'granted_at']


class ERPPermissionWriteSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating permissions (LEGACY - user-based)."""

    class Meta:
        model = ERPPermission
        fields = [
            'id', 'user', 'module',
            'can_view', 'can_create', 'can_edit', 'can_delete',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['granted_by'] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['granted_by'] = request.user
        return super().update(instance, validated_data)


# ---------------------------------------------------------------------------
# NEW: Role-based permission serializers
# ---------------------------------------------------------------------------

class RolePermissionSerializer(serializers.ModelSerializer):
    """Read serializer for role-based permissions with nested names."""

    role_name = serializers.CharField(source='role.name', read_only=True)
    module_name = serializers.CharField(source='module.name', read_only=True)
    module_slug = serializers.CharField(source='module.slug', read_only=True)

    class Meta:
        model = RolePermission
        fields = [
            'id', 'role', 'role_name', 'module', 'module_name', 'module_slug',
            'can_view', 'can_create', 'can_edit', 'can_delete',
            'can_approve', 'can_reject', 'can_send_email', 'can_export', 'can_print',
        ]
        read_only_fields = ['id']


class RolePermissionWriteSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating role-based permissions."""

    class Meta:
        model = RolePermission
        fields = [
            'id', 'role', 'module',
            'can_view', 'can_create', 'can_edit', 'can_delete',
            'can_approve', 'can_reject', 'can_send_email', 'can_export', 'can_print',
        ]
        read_only_fields = ['id']


class UserRoleAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for user-to-role assignments."""

    username = serializers.CharField(source='user.username', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    assigned_by_username = serializers.CharField(
        source='assigned_by.username', read_only=True, default=None
    )

    class Meta:
        model = UserRoleAssignment
        fields = [
            'id', 'user', 'username', 'role', 'role_name',
            'assigned_by', 'assigned_by_username', 'assigned_at',
        ]
        read_only_fields = ['id', 'assigned_at']


# ---------------------------------------------------------------------------
# NEW: User serializer with role info
# ---------------------------------------------------------------------------

class UserWithRoleSerializer(serializers.ModelSerializer):
    """Returns user info together with their ERP role and permissions."""

    role = serializers.SerializerMethodField()
    staff_name = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_staff', 'is_superuser',
            'role', 'staff_name', 'permissions',
        ]
        read_only_fields = ['id', 'role', 'staff_name', 'permissions']

    def get_role(self, obj):
        """Return the user's ERP role from UserRoleAssignment."""
        try:
            assignment = UserRoleAssignment.objects.select_related('role').get(user=obj)
            return {'id': assignment.role.id, 'name': assignment.role.name}
        except UserRoleAssignment.DoesNotExist:
            return None

    def get_staff_name(self, obj):
        """Return the user's display name."""
        full_name = obj.get_full_name()
        return full_name if full_name else obj.username

    def get_permissions(self, obj):
        if obj.is_superuser:
            # Superuser gets all modules with full permissions
            modules = ERPModule.objects.filter(is_active=True)
            return [
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

        # Get user's role-based permissions
        try:
            assignment = UserRoleAssignment.objects.select_related('role').get(user=obj)
        except UserRoleAssignment.DoesNotExist:
            return []

        role_perms = RolePermission.objects.filter(
            role=assignment.role
        ).select_related('module')
        return [
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


# ---------------------------------------------------------------------------
# Keep legacy serializer alias for backward compatibility
# ---------------------------------------------------------------------------
UserWithPermissionsSerializer = UserWithRoleSerializer
