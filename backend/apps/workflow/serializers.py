"""Workflow Serializers for REST API"""
from rest_framework import serializers

from .models import WorkflowDefinition, WorkflowStep, WorkflowInstance, WorkflowAction


class WorkflowStepSerializer(serializers.ModelSerializer):
    required_role_name = serializers.CharField(source='required_role.name', read_only=True)
    escalation_role_name = serializers.CharField(source='escalation_role.name', read_only=True, allow_null=True)
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)

    class Meta:
        model = WorkflowStep
        fields = [
            'id', 'step_order', 'step_name', 'required_role', 'required_role_name',
            'action_type', 'action_type_display', 'auto_advance', 'timeout_hours',
            'escalation_role', 'escalation_role_name'
        ]
        read_only_fields = ['id']


class WorkflowDefinitionSerializer(serializers.ModelSerializer):
    steps = WorkflowStepSerializer(many=True, read_only=True)

    class Meta:
        model = WorkflowDefinition
        fields = [
            'id', 'name', 'module', 'document_type', 'is_active', 'description', 'steps'
        ]
        read_only_fields = ['id']


class WorkflowActionSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.user.get_full_name', read_only=True, allow_null=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    step_name = serializers.CharField(source='step.step_name', read_only=True, allow_null=True)

    class Meta:
        model = WorkflowAction
        fields = [
            'id', 'step', 'step_name', 'actor', 'actor_name', 'action', 'action_display',
            'action_date', 'remarks', 'next_step'
        ]
        read_only_fields = ['id', 'action_date']


class WorkflowInstanceDetailSerializer(serializers.ModelSerializer):
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    current_step_name = serializers.CharField(source='current_step.step_name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    initiated_by_name = serializers.CharField(source='initiated_by.user.get_full_name', read_only=True, allow_null=True)
    actions = WorkflowActionSerializer(many=True, read_only=True)
    is_pending = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowInstance
        fields = [
            'id', 'workflow', 'workflow_name', 'document_id', 'document_type', 'current_step',
            'current_step_name', 'status', 'status_display', 'initiated_by', 'initiated_by_name',
            'initiated_date', 'completed_date', 'actions', 'is_pending', 'created_at'
        ]
        read_only_fields = ['id']

    def get_is_pending(self, obj):
        return obj.is_pending_action


class WorkflowInstanceListSerializer(serializers.ModelSerializer):
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    current_step_name = serializers.CharField(source='current_step.step_name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = WorkflowInstance
        fields = [
            'id', 'workflow', 'workflow_name', 'document_id', 'document_type',
            'current_step_name', 'status', 'status_display', 'initiated_date',
            'completed_date'
        ]
        read_only_fields = ['id']
