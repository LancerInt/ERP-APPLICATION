from rest_framework.permissions import BasePermission

from rbac.models import RolePermission, UserRoleAssignment


class HasModulePermission(BasePermission):
    """Check if user's ROLE has permission for the module.

    Set ``module_name`` on the view to the ERPModule.name value that
    should be checked.  The HTTP method is mapped to the corresponding
    permission flag (can_view, can_create, can_edit, can_delete).

    Superusers always pass.
    """

    # Master modules that should allow read-only access for any authenticated user
    # so that dropdown lookups work on form pages
    LOOKUP_MODULES = {
        'Company', 'Warehouse', 'Godown', 'Machinery', 'Product',
        'Service Catalogue', 'Vendor', 'Customer', 'Transporter',
        'Price List', 'Tax Master', 'Template',
    }

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers bypass all checks
        if request.user.is_superuser:
            return True

        module_name = getattr(view, 'module_name', None)
        if not module_name:
            return True

        # Allow read-only access to master/lookup modules for any authenticated user
        if request.method in ('GET', 'HEAD', 'OPTIONS') and module_name in self.LOOKUP_MODULES:
            return True

        # Get user's role
        try:
            assignment = UserRoleAssignment.objects.select_related('role').get(user=request.user)
            role = assignment.role
        except UserRoleAssignment.DoesNotExist:
            return False

        # Check view action name for custom actions (edit, approve, reject, etc.)
        view_action = getattr(view, 'action', None)
        action_perm_map = {
            'edit_record': 'can_edit',
            'edit': 'can_edit',
            'approve': 'can_approve',
            'reject': 'can_reject',
            'send_email': 'can_send_email',
            'issue': 'can_edit',
            'record_payment': 'can_create',
            'update_status': 'can_edit',
            'apply_to_bill': 'can_edit',
        }

        if view_action and view_action in action_perm_map:
            perm_field = action_perm_map[view_action]
        else:
            # Default: map HTTP method to permission field
            method_map = {
                'GET': 'can_view',
                'HEAD': 'can_view',
                'OPTIONS': 'can_view',
                'POST': 'can_create',
                'PUT': 'can_edit',
                'PATCH': 'can_edit',
                'DELETE': 'can_delete',
            }
            perm_field = method_map.get(request.method, 'can_view')

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
