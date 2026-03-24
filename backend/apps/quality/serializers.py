"""Serializers for quality app models."""
from rest_framework import serializers
from .models import (
    QCParameterLibrary, QCRequest, SelectedParameter, QCLabJob,
    AssignedParameter, QCFinalReport, CounterSampleRegister
)


class QCParameterLibrarySerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='applicable_template.template_name', read_only=True, allow_null=True)
    product_code = serializers.CharField(source='applicable_product.product_code', read_only=True, allow_null=True)

    class Meta:
        model = QCParameterLibrary
        fields = [
            'id', 'parameter_code', 'parameter_name', 'unit',
            'applicable_template', 'template_name', 'applicable_product', 'product_code',
            'acceptable_min', 'acceptable_max', 'critical_flag', 'notes', 'is_active'
        ]
        extra_kwargs = {
            'unit': {'required': False, 'allow_blank': True},
            'applicable_template': {'required': False},
            'applicable_product': {'required': False},
            'acceptable_min': {'required': False},
            'acceptable_max': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class SelectedParameterSerializer(serializers.ModelSerializer):
    parameter_code = serializers.CharField(source='parameter.parameter_code', read_only=True)
    parameter_name = serializers.CharField(source='parameter.parameter_name', read_only=True)
    unit = serializers.CharField(source='parameter.unit', read_only=True)

    class Meta:
        model = SelectedParameter
        fields = [
            'id', 'parameter', 'parameter_code', 'parameter_name', 'unit',
            'override_range_min', 'override_range_max', 'notes', 'created_at'
        ]
        extra_kwargs = {
            'override_range_min': {'required': False},
            'override_range_max': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class QCRequestListSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source='warehouse.warehouse_code', read_only=True)
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.user.get_full_name', read_only=True)

    class Meta:
        model = QCRequest
        fields = [
            'id', 'request_no', 'request_date', 'warehouse', 'warehouse_code',
            'product', 'product_code', 'batch', 'stage', 'priority', 'status', 'lab_code',
            'requested_by_name', 'counter_sample_required'
        ]
        extra_kwargs = {
            'stage': {'required': False, 'allow_blank': True},
            'priority': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'lab_code': {'required': False, 'allow_blank': True},
        }


class QCRequestDetailSerializer(serializers.ModelSerializer):
    selected_parameters = SelectedParameterSerializer(many=True, read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.warehouse_code', read_only=True)
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.user.get_full_name', read_only=True)
    template_name = serializers.CharField(source='qc_template.template_name', read_only=True)

    class Meta:
        model = QCRequest
        fields = [
            'id', 'request_no', 'request_date', 'requested_by', 'requested_by_name',
            'requestor_role', 'warehouse', 'warehouse_code', 'product', 'product_code',
            'batch', 'stage', 'qc_template', 'template_name', 'sample_photo', 'sample_qty',
            'priority', 'remarks', 'status', 'lab_code', 'counter_sample_required',
            'selected_parameters', 'created_at', 'updated_at'
        ]
        read_only_fields = ['request_no', 'request_date', 'lab_code']
        extra_kwargs = {
            'requestor_role': {'required': False, 'allow_blank': True},
            'stage': {'required': False, 'allow_blank': True},
            'sample_photo': {'required': False},
            'sample_qty': {'required': False},
            'priority': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }


class QCRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QCRequest
        fields = [
            'warehouse', 'product', 'batch', 'stage', 'qc_template',
            'sample_photo', 'sample_qty', 'priority', 'remarks', 'counter_sample_required'
        ]
        extra_kwargs = {
            'stage': {'required': False, 'allow_blank': True},
            'sample_photo': {'required': False},
            'sample_qty': {'required': False},
            'priority': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }


class AssignedParameterSerializer(serializers.ModelSerializer):
    parameter_code = serializers.CharField(source='parameter.parameter_code', read_only=True)
    parameter_name = serializers.CharField(source='parameter.parameter_name', read_only=True)
    unit = serializers.CharField(source='parameter.unit', read_only=True)

    class Meta:
        model = AssignedParameter
        fields = [
            'id', 'parameter', 'parameter_code', 'parameter_name', 'unit',
            'result_value', 'result_text', 'result_photo', 'pass_fail', 'created_at'
        ]
        extra_kwargs = {
            'result_value': {'required': False},
            'result_text': {'required': False, 'allow_blank': True},
            'result_photo': {'required': False},
            'pass_fail': {'required': False, 'allow_blank': True},
        }


class QCLabJobListSerializer(serializers.ModelSerializer):
    qc_request_no = serializers.CharField(source='qc_request.request_no', read_only=True)
    analyst_name = serializers.CharField(source='analyst.user.get_full_name', read_only=True)

    class Meta:
        model = QCLabJob
        fields = [
            'id', 'job_no', 'qc_request', 'qc_request_no', 'analyst', 'analyst_name',
            'sample_received_date', 'status', 'created_at'
        ]
        extra_kwargs = {
            'sample_received_date': {'required': False},
            'status': {'required': False, 'allow_blank': True},
        }


class QCLabJobDetailSerializer(serializers.ModelSerializer):
    assigned_parameters = AssignedParameterSerializer(many=True, read_only=True)
    analyst_name = serializers.CharField(source='analyst.user.get_full_name', read_only=True)
    qc_request_detail = QCRequestListSerializer(source='qc_request', read_only=True)

    class Meta:
        model = QCLabJob
        fields = [
            'id', 'job_no', 'qc_request', 'qc_request_detail', 'analyst', 'analyst_name',
            'sample_received_date', 'results_attachment', 'comments', 'status',
            'assigned_parameters', 'created_at', 'updated_at'
        ]
        read_only_fields = ['job_no']
        extra_kwargs = {
            'sample_received_date': {'required': False},
            'results_attachment': {'required': False},
            'comments': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }


class QCLabJobCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QCLabJob
        fields = ['qc_request', 'analyst', 'sample_received_date', 'comments']
        extra_kwargs = {
            'sample_received_date': {'required': False},
            'comments': {'required': False, 'allow_blank': True},
        }


class QCFinalReportSerializer(serializers.ModelSerializer):
    qc_request_batch = serializers.CharField(source='qc_request.batch', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.user.get_full_name', read_only=True)
    distribution_list_users = serializers.StringRelatedField(
        source='distribution_list',
        many=True,
        read_only=True
    )

    class Meta:
        model = QCFinalReport
        fields = [
            'id', 'report_no', 'qc_request', 'qc_request_batch', 'template_revision',
            'prepared_by', 'prepared_by_name', 'prepared_date', 'overall_result',
            'remarks', 'digital_signature', 'attachments', 'distribution_list',
            'distribution_list_users', 'created_at', 'updated_at'
        ]
        read_only_fields = ['report_no', 'prepared_date']
        extra_kwargs = {
            'template_revision': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
            'digital_signature': {'required': False},
            'attachments': {'required': False},
        }


class QCFinalReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = QCFinalReport
        fields = [
            'qc_request', 'overall_result', 'remarks', 'digital_signature', 'attachments'
        ]
        extra_kwargs = {
            'remarks': {'required': False, 'allow_blank': True},
            'digital_signature': {'required': False},
            'attachments': {'required': False},
        }


class CounterSampleRegisterSerializer(serializers.ModelSerializer):
    qc_request_no = serializers.CharField(source='qc_request.request_no', read_only=True)
    batch = serializers.CharField(source='qc_request.batch', read_only=True)
    issued_to_name = serializers.CharField(source='issued_to.user.get_full_name', read_only=True, allow_null=True)
    disposal_approved_by_name = serializers.CharField(source='disposal_approved_by.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = CounterSampleRegister
        fields = [
            'id', 'qc_request', 'qc_request_no', 'batch', 'storage_location', 'shelf', 'bin',
            'issued_to', 'issued_to_name', 'issue_date', 'expected_return_date',
            'actual_return_date', 'reminder_sent', 'disposal_date', 'disposal_approved_by',
            'disposal_approved_by_name', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'storage_location': {'required': False, 'allow_blank': True},
            'shelf': {'required': False, 'allow_blank': True},
            'bin': {'required': False, 'allow_blank': True},
            'issued_to': {'required': False},
            'issue_date': {'required': False},
            'expected_return_date': {'required': False},
            'actual_return_date': {'required': False},
            'disposal_date': {'required': False},
            'disposal_approved_by': {'required': False},
        }
