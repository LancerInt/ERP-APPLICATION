"""Workflow Business Logic Services"""
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import WorkflowDefinition, WorkflowInstance, WorkflowAction, WorkflowStep

logger = logging.getLogger(__name__)


class WorkflowService:
    """Workflow management and processing"""

    @classmethod
    @transaction.atomic
    def initiate_workflow(cls, workflow_definition, document_id, document_type, initiated_by):
        """
        Initiate a workflow for a document.

        Args:
            workflow_definition: WorkflowDefinition instance
            document_id: UUID of the document
            document_type: Type of document (e.g., 'PurchaseRequest')
            initiated_by: StakeholderUser who initiated

        Returns:
            WorkflowInstance
        """
        if not workflow_definition.is_active:
            raise ValidationError(f"Workflow {workflow_definition.name} is not active")

        # Get first step
        first_step = workflow_definition.steps.filter(step_order=1).first()
        if not first_step:
            raise ValidationError(f"Workflow {workflow_definition.name} has no steps defined")

        # Create instance
        instance = WorkflowInstance.objects.create(
            workflow=workflow_definition,
            document_id=document_id,
            document_type=document_type,
            current_step=first_step,
            status='IN_PROGRESS',
            initiated_by=initiated_by
        )

        logger.info(
            f"Workflow '{workflow_definition.name}' initiated for {document_type} {document_id} "
            f"by {initiated_by.user.username}"
        )

        return instance

    @classmethod
    @transaction.atomic
    def process_action(cls, instance, action_type, actor, remarks='', approval=True):
        """
        Process an action on workflow instance.

        Args:
            instance: WorkflowInstance
            action_type: 'APPROVED', 'REJECTED', 'ESCALATED'
            actor: StakeholderUser performing action
            remarks: Additional remarks
            approval: True for approval, False for rejection

        Returns:
            Updated WorkflowInstance
        """
        if not instance.is_pending_action:
            raise ValidationError(f"Workflow is {instance.status}, cannot process action")

        current_step = instance.current_step
        if not current_step:
            raise ValidationError("Current step not found")

        # Create action record
        if approval:
            action = WorkflowAction.objects.create(
                instance=instance,
                step=current_step,
                actor=actor,
                action=action_type,
                remarks=remarks
            )

            # Get next step
            next_step = cls._get_next_step(instance.workflow, current_step)

            if next_step:
                # Advance to next step
                instance.current_step = next_step
                instance.status = 'IN_PROGRESS'
                action.next_step = next_step
                action.save()
                logger.info(f"Workflow {instance.id} advanced to step {next_step.step_name}")
            else:
                # Workflow completed
                instance.status = 'COMPLETED'
                instance.completed_date = timezone.now()
                logger.info(f"Workflow {instance.id} completed")

        else:
            # Rejection
            action = WorkflowAction.objects.create(
                instance=instance,
                step=current_step,
                actor=actor,
                action='REJECTED',
                remarks=remarks
            )
            instance.status = 'REJECTED'
            instance.completed_date = timezone.now()
            logger.info(f"Workflow {instance.id} rejected at step {current_step.step_name}")

        instance.save()
        return instance

    @classmethod
    def check_timeouts(cls, workflow_id=None):
        """
        Check for workflow timeouts and escalate if necessary.

        Args:
            workflow_id: Optional workflow ID to check specific workflow
        """
        queryset = WorkflowInstance.objects.filter(
            status__in=['PENDING', 'IN_PROGRESS']
        )

        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        now = timezone.now()
        escalated_count = 0

        for instance in queryset:
            if not instance.current_step or not instance.current_step.timeout_hours:
                continue

            # Check if timeout exceeded
            timeout_delta = timedelta(hours=instance.current_step.timeout_hours)
            timeout_time = instance.updated_at + timeout_delta

            if now > timeout_time:
                cls._escalate_workflow(instance)
                escalated_count += 1

        logger.info(f"Checked {queryset.count()} workflows, escalated {escalated_count}")
        return escalated_count

    @classmethod
    def _escalate_workflow(cls, instance):
        """Escalate workflow to next role"""
        current_step = instance.current_step
        if not current_step or not current_step.escalation_role:
            logger.warning(f"Cannot escalate workflow {instance.id}: no escalation role")
            return

        action = WorkflowAction.objects.create(
            instance=instance,
            step=current_step,
            action='TIMED_OUT',
            remarks='Workflow escalated due to timeout'
        )

        instance.status = 'ESCALATED'
        instance.save()

        logger.warning(
            f"Workflow {instance.id} escalated to {current_step.escalation_role.name} due to timeout"
        )

    @classmethod
    def get_pending_approvals_for_user(cls, user):
        """
        Get pending workflow actions for a user based on their roles.

        Args:
            user: Django User instance

        Returns:
            QuerySet of WorkflowInstance
        """
        from core.models import StakeholderUser

        try:
            stakeholder = StakeholderUser.objects.get(user=user)
        except StakeholderUser.DoesNotExist:
            return WorkflowInstance.objects.none()

        # Get user's roles via Django Groups
        user_roles = stakeholder.user.groups.values_list('id', flat=True)

        # Get pending workflows where current step requires user's role
        pending = WorkflowInstance.objects.filter(
            status__in=['PENDING', 'IN_PROGRESS'],
            current_step__required_role_id__in=user_roles
        ).select_related('workflow', 'current_step', 'initiated_by')

        return pending

    @staticmethod
    def _get_next_step(workflow, current_step):
        """Get next step in workflow sequence"""
        return workflow.steps.filter(
            step_order__gt=current_step.step_order
        ).order_by('step_order').first()

    @classmethod
    def get_workflow_statistics(cls, workflow_definition=None):
        """Get workflow statistics"""
        queryset = WorkflowInstance.objects.all()

        if workflow_definition:
            queryset = queryset.filter(workflow=workflow_definition)

        return {
            'pending': queryset.filter(status='PENDING').count(),
            'in_progress': queryset.filter(status='IN_PROGRESS').count(),
            'completed': queryset.filter(status='COMPLETED').count(),
            'rejected': queryset.filter(status='REJECTED').count(),
            'escalated': queryset.filter(status='ESCALATED').count(),
            'total': queryset.count(),
        }
