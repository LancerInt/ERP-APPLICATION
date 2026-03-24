"""Audit Models - Compliance, parameters, and decision logs"""
from django.db import models

from common.models import BaseModel


class SystemParameter(BaseModel):
    """System configuration parameters"""

    MODULE_SCOPE_CHOICES = [
        ('GLOBAL', 'Global'),
        ('HR', 'HR'),
        ('PURCHASE', 'Purchase'),
        ('SALES', 'Sales'),
        ('INVENTORY', 'Inventory'),
        ('FINANCE', 'Finance'),
        ('WORKFLOW', 'Workflow'),
    ]

    parameter_name = models.CharField(max_length=100, unique=True, db_index=True)
    parameter_value = models.TextField()
    module_scope = models.CharField(max_length=50, choices=MODULE_SCOPE_CHOICES)
    description = models.TextField(blank=True)
    last_updated_by = models.ForeignKey('core.StakeholderUser', on_delete=models.SET_NULL, null=True, blank=True)
    effective_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'audit'
        ordering = ['parameter_name']
        indexes = [
            models.Index(fields=['module_scope']),
            models.Index(fields=['parameter_name']),
        ]

    def __str__(self):
        return f"{self.parameter_name} ({self.module_scope})"


class DecisionLog(BaseModel):
    """Business decision and policy logs"""

    topic = models.CharField(max_length=200, db_index=True)
    decision_details = models.TextField()
    decision_date = models.DateTimeField(auto_now_add=True)
    follow_up_actions = models.TextField(blank=True)
    stakeholders = models.ManyToManyField('core.StakeholderUser', related_name='decision_logs')

    class Meta:
        app_label = 'audit'
        ordering = ['-decision_date']
        indexes = [
            models.Index(fields=['topic', 'decision_date']),
        ]

    def __str__(self):
        return f"{self.topic} - {self.decision_date.date()}"


class AuditTrail(BaseModel):
    """Comprehensive audit trail for all operations"""

    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('APPROVE', 'Approve'),
    ]

    module = models.CharField(max_length=100, db_index=True)
    record_id = models.CharField(max_length=100, db_index=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    user = models.ForeignKey('core.StakeholderUser', on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    before_snapshot = models.JSONField(null=True, blank=True, help_text="State before action")
    after_snapshot = models.JSONField(null=True, blank=True, help_text="State after action")
    remarks = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        app_label = 'audit'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['module', 'record_id']),
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"{self.module}.{self.record_id} - {self.action} at {self.timestamp}"
