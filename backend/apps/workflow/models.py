"""Workflow Models - Process automation and approval flows"""
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone

from common.models import BaseModel


class WorkflowDefinition(BaseModel):
    """Workflow process definitions"""

    name = models.CharField(max_length=100, unique=True, db_index=True)
    module = models.CharField(max_length=50, help_text="e.g., 'purchase', 'sales', 'expense'")
    document_type = models.CharField(max_length=100, help_text="e.g., 'PurchaseRequest', 'SalesOrder'")
    is_active = models.BooleanField(default=True, db_index=True)
    description = models.TextField(blank=True)

    class Meta:
        app_label = 'workflow'
        ordering = ['name']
        indexes = [
            models.Index(fields=['module', 'document_type']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class WorkflowStep(BaseModel):
    """Individual steps within a workflow"""

    ACTION_TYPE_CHOICES = [
        ('APPROVE', 'Approve'),
        ('REJECT', 'Reject'),
        ('REVIEW', 'Review'),
        ('AUTHORIZE', 'Authorize'),
    ]

    workflow = models.ForeignKey(WorkflowDefinition, on_delete=models.CASCADE, related_name='steps')
    step_order = models.IntegerField(validators=[MinValueValidator(1)])
    step_name = models.CharField(max_length=100)
    required_role = models.ForeignKey('core.RoleDefinition', on_delete=models.PROTECT)
    action_type = models.CharField(max_length=20, choices=ACTION_TYPE_CHOICES)
    auto_advance = models.BooleanField(default=False)
    timeout_hours = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    escalation_role = models.ForeignKey(
        'core.RoleDefinition',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalation_steps'
    )

    class Meta:
        app_label = 'workflow'
        unique_together = ('workflow', 'step_order')
        ordering = ['workflow', 'step_order']

    def __str__(self):
        return f"{self.workflow.name} - Step {self.step_order}: {self.step_name}"


class WorkflowInstance(BaseModel):
    """Active workflow instances for documents"""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('REJECTED', 'Rejected'),
        ('ESCALATED', 'Escalated'),
    ]

    workflow = models.ForeignKey(WorkflowDefinition, on_delete=models.PROTECT)
    document_id = models.UUIDField(db_index=True)
    document_type = models.CharField(max_length=100)
    current_step = models.ForeignKey(WorkflowStep, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    initiated_by = models.ForeignKey('core.StakeholderUser', on_delete=models.SET_NULL, null=True, related_name='initiated_workflows')
    initiated_date = models.DateTimeField(auto_now_add=True)
    completed_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'workflow'
        ordering = ['-initiated_date']
        indexes = [
            models.Index(fields=['document_id', 'document_type']),
            models.Index(fields=['status', 'workflow']),
            models.Index(fields=['initiated_date']),
        ]

    def __str__(self):
        return f"{self.workflow.name} - {self.document_id} ({self.status})"

    @property
    def is_pending_action(self):
        return self.status in ['PENDING', 'IN_PROGRESS']


class WorkflowAction(BaseModel):
    """Actions taken on workflow instances"""

    ACTION_CHOICES = [
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('ESCALATED', 'Escalated'),
        ('TIMED_OUT', 'Timed Out'),
    ]

    instance = models.ForeignKey(WorkflowInstance, on_delete=models.CASCADE, related_name='actions')
    step = models.ForeignKey(WorkflowStep, on_delete=models.SET_NULL, null=True, blank=True)
    actor = models.ForeignKey('core.StakeholderUser', on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    action_date = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True)
    next_step = models.ForeignKey(WorkflowStep, on_delete=models.SET_NULL, null=True, blank=True, related_name='previous_actions')

    class Meta:
        app_label = 'workflow'
        ordering = ['-action_date']
        indexes = [
            models.Index(fields=['instance', 'action_date']),
            models.Index(fields=['actor', 'action_date']),
        ]

    def __str__(self):
        return f"{self.instance} - {self.action} by {self.actor}"
