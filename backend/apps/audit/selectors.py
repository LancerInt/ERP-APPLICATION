"""Audit Query Selectors - Read-only data access layer"""
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta

from .models import SystemParameter, DecisionLog, AuditTrail


class AuditSelector:
    """Audit trail queries"""

    @staticmethod
    def get_audit_trail(module, record_id):
        """Get complete audit trail for a record"""
        return AuditTrail.objects.filter(
            module=module,
            record_id=str(record_id)
        ).select_related('user').order_by('-timestamp')

    @staticmethod
    def get_audit_by_user(user, days=30):
        """Get all audits created by user"""
        start_date = timezone.now() - timedelta(days=days)
        return AuditTrail.objects.filter(
            user=user,
            timestamp__gte=start_date
        ).order_by('-timestamp')

    @staticmethod
    def get_audit_by_action(action, module=None, days=30):
        """Get audits by action type"""
        start_date = timezone.now() - timedelta(days=days)
        queryset = AuditTrail.objects.filter(
            action=action,
            timestamp__gte=start_date
        )

        if module:
            queryset = queryset.filter(module=module)

        return queryset.order_by('-timestamp')

    @staticmethod
    def get_audit_by_module(module, days=30):
        """Get all audits for module"""
        start_date = timezone.now() - timedelta(days=days)
        return AuditTrail.objects.filter(
            module=module,
            timestamp__gte=start_date
        ).order_by('-timestamp')

    @staticmethod
    def get_audit_for_period(start_date, end_date, module=None):
        """Get audits for date range"""
        queryset = AuditTrail.objects.filter(
            timestamp__range=[start_date, end_date]
        )

        if module:
            queryset = queryset.filter(module=module)

        return queryset.order_by('-timestamp')

    @staticmethod
    def get_recent_changes(module, record_id, limit=10):
        """Get recent changes to a record"""
        return AuditTrail.objects.filter(
            module=module,
            record_id=str(record_id),
            action__in=['UPDATE', 'DELETE']
        ).order_by('-timestamp')[:limit]

    @staticmethod
    def get_suspicious_activity(hours=24):
        """Get suspicious activity (multiple changes in short time)"""
        cutoff_time = timezone.now() - timedelta(hours=hours)
        suspicious = {}

        audits = AuditTrail.objects.filter(
            timestamp__gte=cutoff_time,
            action='UPDATE'
        ).values('record_id', 'module').annotate(
            count=Count('id'),
            first_change=Min('timestamp'),
            last_change=Max('timestamp')
        ).filter(count__gt=5)

        return audits

    @staticmethod
    def search_audits(query, module=None):
        """Search audit records"""
        queryset = AuditTrail.objects.filter(
            Q(record_id__icontains=query) |
            Q(remarks__icontains=query) |
            Q(user__user__username__icontains=query)
        )

        if module:
            queryset = queryset.filter(module=module)

        return queryset.order_by('-timestamp')


class DecisionLogSelector:
    """Decision log queries"""

    @staticmethod
    def get_decisions_by_topic(topic):
        """Get decisions by topic"""
        return DecisionLog.objects.filter(
            topic__icontains=topic
        ).prefetch_related('stakeholders').order_by('-decision_date')

    @staticmethod
    def get_decisions_for_period(start_date, end_date):
        """Get decisions in date range"""
        return DecisionLog.objects.filter(
            decision_date__range=[start_date, end_date]
        ).prefetch_related('stakeholders').order_by('-decision_date')

    @staticmethod
    def get_decisions_by_stakeholder(stakeholder):
        """Get decisions involving stakeholder"""
        return DecisionLog.objects.filter(
            stakeholders=stakeholder
        ).prefetch_related('stakeholders').order_by('-decision_date')

    @staticmethod
    def get_recent_decisions(days=30):
        """Get recent decisions"""
        start_date = timezone.now() - timedelta(days=days)
        return DecisionLog.objects.filter(
            decision_date__gte=start_date
        ).prefetch_related('stakeholders').order_by('-decision_date')

    @staticmethod
    def get_decisions_with_pending_actions():
        """Get decisions with follow-up actions"""
        return DecisionLog.objects.exclude(
            follow_up_actions=''
        ).prefetch_related('stakeholders').order_by('-decision_date')

    @staticmethod
    def search_decisions(query):
        """Search decisions"""
        return DecisionLog.objects.filter(
            Q(topic__icontains=query) |
            Q(decision_details__icontains=query) |
            Q(follow_up_actions__icontains=query)
        ).prefetch_related('stakeholders').order_by('-decision_date')


class SystemParameterSelector:
    """System parameter queries"""

    @staticmethod
    def get_parameter(parameter_name):
        """Get single parameter"""
        return SystemParameter.objects.filter(parameter_name=parameter_name).first()

    @staticmethod
    def get_parameters_by_module(module_scope):
        """Get all parameters for module"""
        return SystemParameter.objects.filter(module_scope=module_scope)

    @staticmethod
    def get_all_parameters():
        """Get all parameters"""
        return SystemParameter.objects.all().order_by('parameter_name')

    @staticmethod
    def get_recently_updated_parameters(days=7):
        """Get recently updated parameters"""
        start_date = timezone.now() - timedelta(days=days)
        return SystemParameter.objects.filter(
            effective_date__gte=start_date
        ).order_by('-effective_date')

    @staticmethod
    def search_parameters(query):
        """Search parameters"""
        return SystemParameter.objects.filter(
            Q(parameter_name__icontains=query) |
            Q(description__icontains=query)
        ).order_by('parameter_name')
