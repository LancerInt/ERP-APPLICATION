"""Audit Serializers for REST API"""
from rest_framework import serializers

from .models import SystemParameter, DecisionLog, AuditTrail


class SystemParameterSerializer(serializers.ModelSerializer):
    module_scope_display = serializers.CharField(source='get_module_scope_display', read_only=True)
    last_updated_by_name = serializers.CharField(source='last_updated_by.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = SystemParameter
        fields = [
            'id', 'parameter_name', 'parameter_value', 'module_scope', 'module_scope_display',
            'description', 'last_updated_by', 'last_updated_by_name', 'effective_date'
        ]
        read_only_fields = ['id', 'effective_date']


class DecisionLogSerializer(serializers.ModelSerializer):
    stakeholder_names = serializers.SerializerMethodField()
    stakeholder_count = serializers.SerializerMethodField()

    class Meta:
        model = DecisionLog
        fields = [
            'id', 'topic', 'decision_details', 'decision_date', 'follow_up_actions',
            'stakeholders', 'stakeholder_names', 'stakeholder_count', 'created_at'
        ]
        read_only_fields = ['id', 'decision_date']

    def get_stakeholder_names(self, obj):
        return [s.user.get_full_name() for s in obj.stakeholders.all()]

    def get_stakeholder_count(self, obj):
        return obj.stakeholders.count()


class AuditTrailSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    user_name = serializers.CharField(source='user.user.get_full_name', read_only=True, allow_null=True)
    change_summary = serializers.SerializerMethodField()

    class Meta:
        model = AuditTrail
        fields = [
            'id', 'module', 'record_id', 'action', 'action_display', 'user', 'user_name',
            'timestamp', 'before_snapshot', 'after_snapshot', 'change_summary', 'remarks',
            'ip_address', 'user_agent'
        ]
        read_only_fields = ['id', 'timestamp']

    def get_change_summary(self, obj):
        """Summarize changes between before and after snapshots"""
        if not obj.before_snapshot or not obj.after_snapshot:
            return None

        changes = {}
        for key in obj.after_snapshot:
            if key not in obj.before_snapshot:
                changes[key] = f"Added: {obj.after_snapshot[key]}"
            elif obj.before_snapshot[key] != obj.after_snapshot[key]:
                changes[key] = f"{obj.before_snapshot[key]} → {obj.after_snapshot[key]}"

        for key in obj.before_snapshot:
            if key not in obj.after_snapshot:
                changes[key] = f"Removed: {obj.before_snapshot[key]}"

        return changes if changes else None
