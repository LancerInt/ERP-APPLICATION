from rest_framework import permissions
from django.db.models import Q


class IsAuthenticated(permissions.IsAuthenticated):
    """
    Ensure user is authenticated.
    """
    pass


class WarehouseScopedPermission(permissions.BasePermission):
    """
    Permission to filter objects by user's assigned warehouse(s).
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Check if user has access to the warehouse
        if hasattr(obj, 'warehouse'):
            return obj.warehouse in request.user.warehouses.all()

        return True


class CompanyScopedPermission(permissions.BasePermission):
    """
    Permission to filter objects by user's assigned company/ies.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Check if user has access to the company
        if hasattr(obj, 'company'):
            return obj.company in request.user.companies.all()

        return True


class RoleBasedPermission(permissions.BasePermission):
    """
    Permission based on user's role and module-level permissions.
    Role should have module_permissions JSON field with action permissions.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers have full access
        if request.user.is_superuser:
            return True

        # Get user's role
        if not hasattr(request.user, 'role') or not request.user.role:
            return False

        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers have full access
        if request.user.is_superuser:
            return True

        # Get module and action from view
        module = getattr(view, 'module_name', None)
        action = self._get_action(request.method)

        if not module or not action:
            return False

        # Check if role has permission
        if hasattr(request.user, 'role') and request.user.role:
            permissions = request.user.role.module_permissions or {}
            module_perms = permissions.get(module, {})
            return module_perms.get(action, False)

        return False

    @staticmethod
    def _get_action(method):
        """Map HTTP method to action."""
        method_action_map = {
            'GET': 'view',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }
        return method_action_map.get(method, None)


class ApprovalPermission(permissions.BasePermission):
    """
    Permission for approval workflow operations.
    Users can only approve/reject documents assigned to them.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers can approve anything
        if request.user.is_superuser:
            return True

        # Check if current step is assigned to user
        if hasattr(obj, 'current_approval_step'):
            step = obj.current_approval_step
            if step and hasattr(step, 'assigned_to'):
                return request.user in step.assigned_to.all()

        return False


class IsSuperUser(permissions.BasePermission):
    """
    Permission for superusers only.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_superuser


class ReadOnlyPermission(permissions.BasePermission):
    """
    Permission for read-only access.
    """
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Permission to allow only owners to edit their own records.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.created_by == request.user
