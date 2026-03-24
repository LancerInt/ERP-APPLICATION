from rest_framework.permissions import BasePermission

from rbac.models import RolePermission, UserRoleAssignment


class HasModulePermission(BasePermission):
    """Check if user's ROLE has permission for the module.

    Set ``module_name`` on the view to the ERPModule.name value that
    should be checked.  The HTTP method is mapped to the corresponding
    permission flag (can_view, can_create, can_edit, can_delete).

    Superusers always pass.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers bypass all checks
        if request.user.is_superuser:
            return True

        module_name = getattr(view, 'module_name', None)
        if not module_name:
            return True

        # Get user's role
        try:
            assignment = UserRoleAssignment.objects.select_related('role').get(user=request.user)
            role = assignment.role
        except UserRoleAssignment.DoesNotExist:
            return False

        # Map HTTP method to permission field
        action_map = {
            'GET': 'can_view',
            'HEAD': 'can_view',
            'OPTIONS': 'can_view',
            'POST': 'can_create',
            'PUT': 'can_edit',
            'PATCH': 'can_edit',
            'DELETE': 'can_delete',
        }
        perm_field = action_map.get(request.method, 'can_view')

        return RolePermission.objects.filter(
            role=role,
            module__name=module_name,
            **{perm_field: True},
        ).exists()


def check_permission(user, module_name, action):
    """Utility to check role-based permission programmatically.

    Args:
        user: Django User instance.
        module_name: Name of the ERPModule.
        action: One of 'view', 'create', 'edit', 'delete'.

    Returns:
        bool
    """
    if user.is_superuser:
        return True
    try:
        assignment = UserRoleAssignment.objects.select_related('role').get(user=user)
    except UserRoleAssignment.DoesNotExist:
        return False

    field = f'can_{action}'
    return RolePermission.objects.filter(
        role=assignment.role,
        module__name=module_name,
        **{field: True},
    ).exists()


def get_user_role(user):
    """Get the ERP role for a user.

    Returns:
        ERPRole instance or None.
    """
    if user.is_superuser:
        return None  # superuser has all access
    try:
        return UserRoleAssignment.objects.select_related('role').get(user=user).role
    except UserRoleAssignment.DoesNotExist:
        return None
