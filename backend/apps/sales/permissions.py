from rest_framework import permissions


class IsSalesUser(permissions.BasePermission):
    """
    Allows access only to users with sales permissions.
    """

    def has_permission(self, request, view):
        """Check if user has sales access"""
        return (
            request.user
            and request.user.is_authenticated
            and (
                request.user.groups.filter(name='Sales').exists()
                or request.user.is_staff
            )
        )


class IsApprovalUser(permissions.BasePermission):
    """
    Allows access only to users who can approve sales orders.
    """

    def has_permission(self, request, view):
        """Check if user can approve"""
        return (
            request.user
            and request.user.is_authenticated
            and (
                request.user.groups.filter(name__in=['Sales Manager', 'Director']).exists()
                or request.user.is_staff
            )
        )


class CanApproveSalesOrder(permissions.BasePermission):
    """
    Allows SO approval only to authorized users.
    """

    def has_object_permission(self, request, view, obj):
        """Check if user can approve specific SO"""
        if request.method not in permissions.SAFE_METHODS:
            return (
                request.user.groups.filter(
                    name__in=['Sales Manager', 'Director']
                ).exists()
                or request.user.is_staff
            )
        return True


class CanAcceptInvoice(permissions.BasePermission):
    """
    Allows invoice acceptance only to authorized users.
    """

    def has_object_permission(self, request, view, obj):
        """Check if user can accept invoice"""
        if request.method not in permissions.SAFE_METHODS:
            return (
                request.user.groups.filter(
                    name__in=['Finance', 'Director']
                ).exists()
                or request.user.is_staff
            )
        return True
