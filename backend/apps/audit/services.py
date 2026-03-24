"""Audit Business Logic Services"""
import logging
import json
from decimal import Decimal

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from .models import SystemParameter, AuditTrail

logger = logging.getLogger(__name__)

# Cache timeout in seconds (1 hour)
PARAMETER_CACHE_TIMEOUT = 3600


class AuditService:
    """Audit logging and tracking"""

    @classmethod
    def log_audit(cls, module, record_id, action, user, before_snapshot=None,
                 after_snapshot=None, remarks='', ip_address=None, user_agent=None):
        """
        Log an audit trail entry.

        Args:
            module: Module name (e.g., 'hr', 'purchase')
            record_id: ID of the record being audited
            action: CREATE, UPDATE, DELETE, APPROVE
            user: StakeholderUser performing action
            before_snapshot: Dict of state before action
            after_snapshot: Dict of state after action
            remarks: Additional remarks
            ip_address: Client IP address
            user_agent: User agent string

        Returns:
            AuditTrail instance
        """
        audit = AuditTrail.objects.create(
            module=module,
            record_id=str(record_id),
            action=action,
            user=user,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            remarks=remarks,
            ip_address=ip_address,
            user_agent=user_agent
        )

        logger.info(
            f"Audit: {module}.{record_id} {action} by {user.user.username if user else 'system'}"
        )

        return audit

    @classmethod
    def log_model_change(cls, instance, action, user, request=None):
        """
        Log model changes automatically.

        Args:
            instance: Model instance
            action: CREATE, UPDATE, or DELETE
            user: StakeholderUser
            request: HTTP request (optional, to extract IP and user agent)
        """
        model_name = instance.__class__.__name__
        module = instance.__class__._meta.app_label

        ip_address = None
        user_agent = None

        if request:
            ip_address = cls._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')

        after_snapshot = None
        if action != 'DELETE':
            after_snapshot = cls._model_to_dict(instance)

        cls.log_audit(
            module=module,
            record_id=str(instance.pk),
            action=action,
            user=user,
            before_snapshot=None,
            after_snapshot=after_snapshot,
            ip_address=ip_address,
            user_agent=user_agent
        )

    @staticmethod
    def _model_to_dict(instance):
        """Convert model instance to dict for snapshot"""
        result = {}
        for field in instance._meta.get_fields():
            if field.name in ['created_by', 'updated_by', 'created_at', 'updated_at']:
                continue

            try:
                value = getattr(instance, field.name)

                # Handle special types
                if isinstance(value, Decimal):
                    value = float(value)
                elif hasattr(value, 'isoformat'):
                    value = value.isoformat()
                elif hasattr(value, 'pk'):
                    value = value.pk

                result[field.name] = value
            except Exception:
                pass

        return result

    @staticmethod
    def _get_client_ip(request):
        """Extract client IP from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class SystemParameterService:
    """System parameter management"""

    @classmethod
    def get_system_parameter(cls, parameter_name, default=None):
        """
        Get system parameter value.
        Uses caching to reduce database queries.

        Args:
            parameter_name: Name of parameter
            default: Default value if not found

        Returns:
            Parameter value
        """
        cache_key = f"sys_param:{parameter_name}"
        cached_value = cache.get(cache_key)

        if cached_value is not None:
            return cached_value

        try:
            param = SystemParameter.objects.get(parameter_name=parameter_name)
            cache.set(cache_key, param.parameter_value, PARAMETER_CACHE_TIMEOUT)
            return param.parameter_value
        except SystemParameter.DoesNotExist:
            return default

    @classmethod
    def set_system_parameter(cls, parameter_name, parameter_value, module_scope, user,
                           description=''):
        """
        Set or update system parameter.

        Args:
            parameter_name: Name of parameter
            parameter_value: Value to set
            module_scope: Scope of parameter
            user: StakeholderUser making change
            description: Description of parameter

        Returns:
            SystemParameter instance
        """
        param, created = SystemParameter.objects.update_or_create(
            parameter_name=parameter_name,
            defaults={
                'parameter_value': parameter_value,
                'module_scope': module_scope,
                'description': description,
                'last_updated_by': user,
                'effective_date': timezone.now(),
            }
        )

        # Invalidate cache
        cache_key = f"sys_param:{parameter_name}"
        cache.delete(cache_key)

        action = 'CREATE' if created else 'UPDATE'
        logger.info(f"System parameter '{parameter_name}' {action} by {user.user.username}")

        return param

    @classmethod
    def get_parameters_by_module(cls, module_scope):
        """Get all parameters for module"""
        return SystemParameter.objects.filter(module_scope=module_scope)

    @classmethod
    def get_all_parameters(cls):
        """Get all system parameters"""
        return SystemParameter.objects.all()

    @classmethod
    def validate_parameter_value(cls, parameter_name, value):
        """
        Validate parameter value against rules.
        Can be overridden for specific parameters.
        """
        return True


class DecisionLogService:
    """Decision and policy logging"""

    @classmethod
    def log_decision(cls, topic, decision_details, stakeholders, follow_up_actions=''):
        """
        Log a business decision.

        Args:
            topic: Decision topic
            decision_details: Details of decision
            stakeholders: List of StakeholderUser instances
            follow_up_actions: Actions to follow up

        Returns:
            DecisionLog instance
        """
        from .models import DecisionLog

        decision = DecisionLog.objects.create(
            topic=topic,
            decision_details=decision_details,
            follow_up_actions=follow_up_actions
        )

        decision.stakeholders.set(stakeholders)

        logger.info(f"Decision logged: {topic}")
        return decision
