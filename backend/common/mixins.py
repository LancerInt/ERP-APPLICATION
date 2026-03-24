from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth import get_user_model
from audit.models import AuditLog
import json
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class AuditMixin(models.Model):
    """
    Mixin to automatically log model changes to audit trail.
    Tracks create, update, and delete operations.
    """

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Override save to log changes."""
        is_new = self.pk is None
        old_values = {}
        new_values = {}

        if not is_new:
            # Get old values
            try:
                old_instance = self.__class__.objects.get(pk=self.pk)
                old_values = self._get_changed_fields(old_instance)
            except self.__class__.DoesNotExist:
                pass

        super().save(*args, **kwargs)

        # Log audit trail
        if hasattr(self, '_audit_user'):
            user = self._audit_user
        else:
            user = None

        new_values = self._get_field_values()

        action = 'CREATE' if is_new else 'UPDATE'

        self._create_audit_log(
            action=action,
            user=user,
            old_values=old_values,
            new_values=new_values,
        )

    def delete(self, *args, **kwargs):
        """Override delete to log deletion."""
        if hasattr(self, '_audit_user'):
            user = self._audit_user
        else:
            user = None

        old_values = self._get_field_values()

        super().delete(*args, **kwargs)

        self._create_audit_log(
            action='DELETE',
            user=user,
            old_values=old_values,
            new_values={},
        )

    def _get_changed_fields(self, old_instance):
        """Get changed field values."""
        changed = {}
        for field in self._meta.get_fields():
            if field.name in ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']:
                continue

            if hasattr(self, field.name):
                old_value = getattr(old_instance, field.name, None)
                new_value = getattr(self, field.name, None)

                if old_value != new_value:
                    changed[field.name] = self._serialize_value(old_value)

        return changed

    def _get_field_values(self):
        """Get all field values."""
        values = {}
        for field in self._meta.get_fields():
            if field.name in ['created_at', 'updated_at', 'created_by', 'updated_by']:
                continue

            if hasattr(self, field.name):
                value = getattr(self, field.name, None)
                values[field.name] = self._serialize_value(value)

        return values

    def _serialize_value(self, value):
        """Serialize value for JSON storage."""
        if value is None:
            return None
        if hasattr(value, 'isoformat'):
            return value.isoformat()
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value
        return str(value)

    def _create_audit_log(self, action, user, old_values, new_values):
        """Create audit log entry."""
        try:
            AuditLog.objects.create(
                content_type=ContentType.objects.get_for_model(self.__class__),
                object_id=str(self.pk),
                action=action,
                user=user,
                old_values=old_values,
                new_values=new_values,
            )
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}", exc_info=True)


class SoftDeleteMixin(models.Model):
    """
    Mixin to implement soft delete functionality.
    """
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True

    def soft_delete(self):
        """Soft delete the instance."""
        self.is_active = False
        self.save(update_fields=['is_active'])

    def restore(self):
        """Restore soft-deleted instance."""
        self.is_active = True
        self.save(update_fields=['is_active'])

    @classmethod
    def active_objects(cls):
        """Return active objects only."""
        return cls.objects.filter(is_active=True)

    @classmethod
    def deleted_objects(cls):
        """Return deleted objects only."""
        return cls.objects.filter(is_active=False)


class TimestampMixin(models.Model):
    """
    Mixin to add created and updated timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UserTrackingMixin(models.Model):
    """
    Mixin to track creating and updating user.
    """
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='%(class)s_created_by',
        null=True,
        blank=True,
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='%(class)s_updated_by',
        null=True,
        blank=True,
    )

    class Meta:
        abstract = True


class VersionMixin(models.Model):
    """
    Mixin to track version number for optimistic locking.
    """
    version = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """Increment version on save."""
        if self.pk:
            self.version += 1
        super().save(*args, **kwargs)
