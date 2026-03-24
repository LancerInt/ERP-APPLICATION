from django.contrib import admin

from rbac.models import ERPRole, ERPModule, ERPPermission, RolePermission, UserRoleAssignment, AuditLog


@admin.register(ERPRole)
class ERPRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(ERPModule)
class ERPModuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug')
    ordering = ('order', 'name')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(ERPPermission)
class ERPPermissionAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'module', 'can_view', 'can_create',
        'can_edit', 'can_delete', 'granted_by', 'granted_at',
    )
    list_filter = ('can_view', 'can_create', 'can_edit', 'can_delete', 'module')
    search_fields = ('user__username', 'module__name')
    raw_id_fields = ('user', 'granted_by')
    ordering = ('user__username', 'module__order')


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = (
        'role', 'module', 'can_view', 'can_create',
        'can_edit', 'can_delete',
    )
    list_filter = ('can_view', 'can_create', 'can_edit', 'can_delete', 'role', 'module')
    search_fields = ('role__name', 'module__name')
    ordering = ('role__name', 'module__name')


@admin.register(UserRoleAssignment)
class UserRoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'assigned_by', 'assigned_at')
    list_filter = ('role',)
    search_fields = ('user__username', 'role__name')
    raw_id_fields = ('user', 'assigned_by')
    ordering = ('user__username',)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'module_name', 'role_name', 'ip_address', 'timestamp')
    list_filter = ('action', 'module_name')
    search_fields = ('user__username', 'module_name', 'details')
    readonly_fields = (
        'user', 'role_name', 'module_name', 'action',
        'details', 'ip_address', 'timestamp',
    )
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
