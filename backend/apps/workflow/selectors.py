"""Workflow Query Selectors - Read-only data access layer"""
from django.db.models import Q, Count
from django.utils import timezone
from datetime import timedelta

from .models import WorkflowDefinition, WorkflowInstance, WorkflowAction


class WorkflowSelector:
    """Workflow queries"""

    @staticmethod
    def get_my_pending_approvals(user):
        """Get pending workflows for current user based on roles"""
        from core.models import StakeholderUser

        try:
            stakeholder = StakeholderUser.objects.get(user=user)
        except StakeholderUser.DoesNotExist:
            return WorkflowInstance.objects.none()

        # Get user's roles via Django Groups
        user_roles = stakeholder.user.groups.values_list('id', flat=True)

        # Get pending workflows
        return WorkflowInstance.objects.filter(
            status__in=['PENDING', 'IN_PROGRESS'],
            current_step__required_role_id__in=user_roles
        ).select_related(
            'workflow', 'current_step', 'initiated_by'
        ).order_by('-initiated_date')

    @staticmethod
    def get_workflow_history(document_id, document_type):
        """Get complete workflow history for a document"""
        return WorkflowInstance.objects.filter(
            document_id=document_id,
            document_type=document_type
        ).select_related(
            'workflow', 'current_step', 'initiated_by'
        ).prefetch_related('actions').order_by('-initiated_date')

    @staticmethod
    def get_active_workflows(workflow_definition=None):
        """Get all active workflows"""
        queryset = WorkflowInstance.objects.filter(
            status__in=['PENDING', 'IN_PROGRESS']
        )

        if workflow_definition:
            queryset = queryset.filter(workflow=workflow_definition)

        return queryset.select_related(
            'workflow', 'current_step', 'initiated_by'
        ).order_by('-initiated_date')

    @staticmethod
    def get_workflows_by_status(status):
        """Get workflows by status"""
        return WorkflowInstance.objects.filter(
            status=status
        ).select_related('workflow', 'current_step').order_by('-initiated_date')

    @staticmethod
    def get_workflows_for_period(start_date, end_date):
        """Get workflows initiated in period"""
        return WorkflowInstance.objects.filter(
            initiated_date__range=[start_date, end_date]
        ).select_related('workflow', 'initiated_by').order_by('-initiated_date')

    @staticmethod
    def get_user_initiated_workflows(user, days=30):
        """Get workflows initiated by user"""
        from core.models import StakeholderUser

        try:
            stakeholder = StakeholderUser.objects.get(user=user)
        except StakeholderUser.DoesNotExist:
            return WorkflowInstance.objects.none()

        start_date = timezone.now() - timedelta(days=days)

        return WorkflowInstance.objects.filter(
            initiated_by=stakeholder,
            initiated_date__gte=start_date
        ).select_related('workflow').order_by('-initiated_date')

    @staticmethod
    def get_workflows_awaiting_user(user):
        """Get workflows currently awaiting action from user"""
        from core.models import StakeholderUser

        try:
            stakeholder = StakeholderUser.objects.get(user=user)
        except StakeholderUser.DoesNotExist:
            return WorkflowInstance.objects.none()

        user_roles = stakeholder.user.groups.values_list('id', flat=True)

        return WorkflowInstance.objects.filter(
            status__in=['PENDING', 'IN_PROGRESS'],
            current_step__required_role_id__in=user_roles
        ).select_related('workflow', 'current_step').order_by('initiated_date')

    @staticmethod
    def get_overdue_workflows(hours=24):
        """Get workflows overdue for action"""
        from django.utils import timezone
        from datetime import timedelta

        cutoff_time = timezone.now() - timedelta(hours=hours)

        return WorkflowInstance.objects.filter(
            status__in=['PENDING', 'IN_PROGRESS'],
            initiated_date__lt=cutoff_time
        ).select_related('workflow', 'current_step', 'initiated_by').order_by('initiated_date')

    @staticmethod
    def get_workflow_actions(instance):
        """Get all actions for workflow instance"""
        return instance.actions.select_related('actor', 'step').order_by('-action_date')

    @staticmethod
    def get_actions_by_user(user, days=30):
        """Get all actions taken by user"""
        from core.models import StakeholderUser

        try:
            stakeholder = StakeholderUser.objects.get(user=user)
        except StakeholderUser.DoesNotExist:
            return WorkflowAction.objects.none()

        start_date = timezone.now() - timedelta(days=days)

        return WorkflowAction.objects.filter(
            actor=stakeholder,
            action_date__gte=start_date
        ).select_related('instance', 'step').order_by('-action_date')

    @staticmethod
    def get_workflow_stats_by_module(module):
        """Get workflow statistics for module"""
        workflows = WorkflowDefinition.objects.filter(module=module)

        stats = {}
        for workflow in workflows:
            instances = WorkflowInstance.objects.filter(workflow=workflow)
            stats[workflow.name] = {
                'pending': instances.filter(status='PENDING').count(),
                'in_progress': instances.filter(status='IN_PROGRESS').count(),
                'completed': instances.filter(status='COMPLETED').count(),
                'rejected': instances.filter(status='REJECTED').count(),
                'escalated': instances.filter(status='ESCALATED').count(),
                'total': instances.count(),
            }

        return stats

    @staticmethod
    def get_escalated_workflows():
        """Get all escalated workflows"""
        return WorkflowInstance.objects.filter(
            status='ESCALATED'
        ).select_related('workflow', 'current_step', 'initiated_by').order_by('-initiated_date')
