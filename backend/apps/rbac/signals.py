import logging

from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from rbac.models import AuditLog, ERPPermission, RolePermission, UserRoleAssignment

logger = logging.getLogger(__name__)


def _get_client_ip(request):
    """Extract client IP from the request."""
    if request is None:
        return None
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ---------------------------------------------------------------------------
# Login / Logout audit signals
# ---------------------------------------------------------------------------

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    """Record a LOGIN audit entry when a user logs in."""
    try:
        AuditLog.objects.create(
            user=user,
            action='LOGIN',
            details=f'User {user.username} logged in.',
            ip_address=_get_client_ip(request),
        )
    except Exception:
        logger.exception('Failed to create login audit log.')


@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    """Record a LOGOUT audit entry when a user logs out."""
    try:
        if user and user.is_authenticated:
            AuditLog.objects.create(
                user=user,
                action='LOGOUT',
                details=f'User {user.username} logged out.',
                ip_address=_get_client_ip(request),
            )
    except Exception:
        logger.exception('Failed to create logout audit log.')


# ---------------------------------------------------------------------------
# Legacy: ERPPermission audit signals (kept for backward compat)
# ---------------------------------------------------------------------------

@receiver(post_save, sender=ERPPermission)
def log_permission_change(sender, instance, created, **kwargs):
    """Log when a user-based permission is created or updated."""
    try:
        action = 'CREATE' if created else 'EDIT'
        flags = []
        if instance.can_view:
            flags.append('view')
        if instance.can_create:
            flags.append('create')
        if instance.can_edit:
            flags.append('edit')
        if instance.can_delete:
            flags.append('delete')
        details = (
            f'Permission {"granted" if created else "updated"} for user '
            f'{instance.user} on module {instance.module}. '
            f'Flags: {", ".join(flags) if flags else "none"}.'
        )
        AuditLog.objects.create(
            user=instance.granted_by,
            module_name=instance.module.name if instance.module else '',
            action=action,
            details=details,
        )
    except Exception:
        logger.exception('Failed to create permission audit log.')


@receiver(post_delete, sender=ERPPermission)
def log_permission_delete(sender, instance, **kwargs):
    """Log when a user-based permission is revoked."""
    try:
        AuditLog.objects.create(
            user=instance.granted_by,
            module_name=instance.module.name if instance.module else '',
            action='DELETE',
            details=(
                f'Permission revoked for user {instance.user} '
                f'on module {instance.module}.'
            ),
        )
    except Exception:
        logger.exception('Failed to create permission delete audit log.')


# ---------------------------------------------------------------------------
# NEW: RolePermission audit signals
# ---------------------------------------------------------------------------

@receiver(post_save, sender=RolePermission)
def log_role_permission_change(sender, instance, created, **kwargs):
    """Log when a role-based permission is created or updated."""
    try:
        action = 'CREATE' if created else 'EDIT'
        flags = []
        if instance.can_view:
            flags.append('view')
        if instance.can_create:
            flags.append('create')
        if instance.can_edit:
            flags.append('edit')
        if instance.can_delete:
            flags.append('delete')
        details = (
            f'Role permission {"granted" if created else "updated"} for role '
            f'"{instance.role.name}" on module "{instance.module.name}". '
            f'Flags: {", ".join(flags) if flags else "none"}.'
        )
        AuditLog.objects.create(
            role_name=instance.role.name,
            module_name=instance.module.name if instance.module else '',
            action=action,
            details=details,
        )
    except Exception:
        logger.exception('Failed to create role permission audit log.')


@receiver(post_delete, sender=RolePermission)
def log_role_permission_delete(sender, instance, **kwargs):
    """Log when a role-based permission is revoked."""
    try:
        AuditLog.objects.create(
            role_name=instance.role.name,
            module_name=instance.module.name if instance.module else '',
            action='DELETE',
            details=(
                f'Role permission revoked for role "{instance.role.name}" '
                f'on module "{instance.module.name}".'
            ),
        )
    except Exception:
        logger.exception('Failed to create role permission delete audit log.')


# ---------------------------------------------------------------------------
# NEW: UserRoleAssignment audit signals
# ---------------------------------------------------------------------------

@receiver(post_save, sender=UserRoleAssignment)
def log_user_role_change(sender, instance, created, **kwargs):
    """Log when a user's role assignment is created or changed."""
    try:
        action = 'CREATE' if created else 'EDIT'
        details = (
            f'User "{instance.user.username}" '
            f'{"assigned to" if created else "role changed to"} '
            f'role "{instance.role.name}".'
        )
        AuditLog.objects.create(
            user=instance.assigned_by,
            role_name=instance.role.name,
            action=action,
            details=details,
        )
    except Exception:
        logger.exception('Failed to create user role assignment audit log.')


@receiver(post_delete, sender=UserRoleAssignment)
def log_user_role_delete(sender, instance, **kwargs):
    """Log when a user's role assignment is removed."""
    try:
        AuditLog.objects.create(
            user=instance.assigned_by,
            role_name=instance.role.name,
            action='DELETE',
            details=(
                f'Role assignment removed: user "{instance.user.username}" '
                f'from role "{instance.role.name}".'
            ),
        )
    except Exception:
        logger.exception('Failed to create user role delete audit log.')
