"""
Serializers for core app models.
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Company, Warehouse, Godown, Machinery, RoleDefinition,
    ApprovalLevel, StakeholderUser
)


class CompanySerializer(serializers.ModelSerializer):
    """Serializer for Company model."""

    class Meta:
        model = Company
        fields = [
            'id', 'company_code', 'legal_name', 'trade_name', 'gstin', 'pan', 'cin',
            'registered_address', 'billing_address', 'contact_email', 'contact_phone',
            'default_currency', 'books_export_flag', 'active_from', 'active_to',
            'notes', 'is_active', 'created_at', 'updated_at', 'created_by', 'updated_by'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']
        extra_kwargs = {
            'pan': {'required': False, 'allow_blank': True},
            'cin': {'required': False, 'allow_blank': True},
            'trade_name': {'required': False, 'allow_blank': True},
            'gstin': {'required': False, 'allow_null': True},
            'contact_email': {'required': False, 'allow_blank': True},
            'contact_phone': {'required': False, 'allow_blank': True},
            'registered_address': {'required': False},
            'billing_address': {'required': False},
            'active_from': {'required': False},
            'active_to': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class GodownSerializer(serializers.ModelSerializer):
    """Serializer for Godown model."""

    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = Godown
        fields = [
            'id', 'godown_code', 'warehouse', 'warehouse_name', 'godown_name',
            'storage_condition', 'capacity_uom', 'capacity_value',
            'batch_tracking_enabled', 'default_qc_hold_area', 'active_flag',
            'notes', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'storage_condition': {'required': False, 'allow_blank': True},
            'capacity_uom': {'required': False, 'allow_blank': True},
            'capacity_value': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class MachinerySerializer(serializers.ModelSerializer):
    """Serializer for Machinery model."""

    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    godown_name = serializers.CharField(source='godown.godown_name', read_only=True)
    vendor_name = serializers.CharField(source='maintenance_vendor.vendor_name', read_only=True)

    class Meta:
        model = Machinery
        fields = [
            'id', 'machine_id', 'warehouse', 'warehouse_name', 'godown', 'godown_name',
            'machine_name', 'category', 'commission_date', 'maintenance_vendor',
            'vendor_name', 'next_service_due', 'status', 'notes',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'godown': {'required': False},
            'category': {'required': False, 'allow_blank': True},
            'commission_date': {'required': False},
            'maintenance_vendor': {'required': False},
            'next_service_due': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class ApprovalLevelSerializer(serializers.ModelSerializer):
    """Serializer for ApprovalLevel model."""

    class Meta:
        model = ApprovalLevel
        fields = [
            'id', 'role', 'module', 'stage', 'min_amount', 'max_amount',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'min_amount': {'required': False},
            'max_amount': {'required': False},
        }


class RoleDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for RoleDefinition with nested ApprovalLevels."""

    approval_levels = ApprovalLevelSerializer(many=True, read_only=True)

    class Meta:
        model = RoleDefinition
        fields = [
            'id', 'role_code', 'role_name', 'module_permissions', 'data_scope',
            'active_flag', 'approval_levels', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'module_permissions': {'required': False},
            'data_scope': {'required': False, 'allow_blank': True},
        }


class RoleDefinitionWriteSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating RoleDefinition with nested writes."""

    approval_levels = ApprovalLevelSerializer(many=True, required=False)

    class Meta:
        model = RoleDefinition
        fields = [
            'id', 'role_code', 'role_name', 'module_permissions', 'data_scope',
            'active_flag', 'approval_levels'
        ]
        extra_kwargs = {
            'module_permissions': {'required': False},
            'data_scope': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        approval_levels_data = validated_data.pop('approval_levels', [])
        role = RoleDefinition.objects.create(**validated_data)

        for level_data in approval_levels_data:
            ApprovalLevel.objects.create(role=role, **level_data)

        return role

    def update(self, instance, validated_data):
        approval_levels_data = validated_data.pop('approval_levels', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if approval_levels_data is not None:
            instance.approval_levels.all().delete()
            for level_data in approval_levels_data:
                ApprovalLevel.objects.create(role=instance, **level_data)

        return instance


class WarehouseSerializer(serializers.ModelSerializer):
    """Serializer for Warehouse model."""

    company_name = serializers.CharField(source='company.legal_name', read_only=True)
    warehouse_managers_count = serializers.SerializerMethodField()
    godowns_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = [
            'id', 'warehouse_code', 'company', 'company_name', 'name', 'warehouse_type',
            'address', 'city', 'state', 'country', 'pincode', 'geo_latitude',
            'geo_longitude', 'time_zone', 'default_currency', 'active_flag', 'notes',
            'warehouse_coordinator_office', 'warehouse_hr_coordinator',
            'warehouse_managers_count', 'godowns_count',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'warehouse_managers_count', 'godowns_count']
        extra_kwargs = {
            'warehouse_type': {'required': False, 'allow_blank': True},
            'address': {'required': False},
            'city': {'required': False, 'allow_blank': True},
            'state': {'required': False, 'allow_blank': True},
            'country': {'required': False, 'allow_blank': True},
            'pincode': {'required': False, 'allow_blank': True},
            'geo_latitude': {'required': False},
            'geo_longitude': {'required': False},
            'time_zone': {'required': False, 'allow_blank': True},
            'default_currency': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
            'warehouse_coordinator_office': {'required': False},
            'warehouse_hr_coordinator': {'required': False},
        }

    def get_warehouse_managers_count(self, obj):
        return obj.warehouse_managers.count()

    def get_godowns_count(self, obj):
        return obj.godowns.count()


class WarehouseDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Warehouse with related data."""

    company_name = serializers.CharField(source='company.legal_name', read_only=True)
    godowns = GodownSerializer(many=True, read_only=True)
    warehouse_managers = serializers.StringRelatedField(many=True, read_only=True)
    warehouse_coordinators = serializers.StringRelatedField(many=True, read_only=True)
    warehouse_supervisors = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Warehouse
        fields = [
            'id', 'warehouse_code', 'company', 'company_name', 'name', 'warehouse_type',
            'address', 'city', 'state', 'country', 'pincode', 'geo_latitude',
            'geo_longitude', 'time_zone', 'default_currency', 'active_flag', 'notes',
            'warehouse_coordinator_office', 'warehouse_hr_coordinator',
            'godowns', 'warehouse_managers', 'warehouse_coordinators',
            'warehouse_supervisors', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'godowns']
        extra_kwargs = {
            'warehouse_type': {'required': False, 'allow_blank': True},
            'address': {'required': False},
            'city': {'required': False, 'allow_blank': True},
            'state': {'required': False, 'allow_blank': True},
            'country': {'required': False, 'allow_blank': True},
            'pincode': {'required': False, 'allow_blank': True},
            'geo_latitude': {'required': False},
            'geo_longitude': {'required': False},
            'time_zone': {'required': False, 'allow_blank': True},
            'default_currency': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
            'warehouse_coordinator_office': {'required': False},
            'warehouse_hr_coordinator': {'required': False},
        }


class StakeholderUserSerializer(serializers.ModelSerializer):
    """Serializer for StakeholderUser model."""

    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    assigned_roles_data = serializers.StringRelatedField(
        source='assigned_roles',
        many=True,
        read_only=True
    )
    warehouse_count = serializers.SerializerMethodField()

    class Meta:
        model = StakeholderUser
        fields = [
            'id', 'user', 'username', 'full_name', 'employee_record', 'primary_email',
            'mobile', 'default_warehouse', 'status', 'last_accessed', 'notes',
            'assigned_roles_data', 'warehouse_count',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'username', 'full_name', 'warehouse_count'
        ]
        extra_kwargs = {
            'employee_record': {'required': False},
            'primary_email': {'required': False, 'allow_blank': True},
            'mobile': {'required': False, 'allow_blank': True},
            'default_warehouse': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'last_accessed': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def get_warehouse_count(self, obj):
        return obj.warehouse_scope.count()


class StakeholderUserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for StakeholderUser with related data."""

    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    assigned_roles = RoleDefinitionSerializer(many=True, read_only=True)
    warehouse_scope = WarehouseSerializer(many=True, read_only=True)

    class Meta:
        model = StakeholderUser
        fields = [
            'id', 'user', 'username', 'full_name', 'email', 'employee_record',
            'primary_email', 'mobile', 'default_warehouse', 'status', 'last_accessed',
            'notes', 'assigned_roles', 'warehouse_scope',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'employee_record': {'required': False},
            'primary_email': {'required': False, 'allow_blank': True},
            'mobile': {'required': False, 'allow_blank': True},
            'default_warehouse': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'last_accessed': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }
