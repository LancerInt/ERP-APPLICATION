"""HR Serializers for REST API"""
from rest_framework import serializers
from django.utils import timezone
from decimal import Decimal

from .models import (
    Staff, StaffBankAccount, StaffIDProof, ShiftDefinition,
    AttendanceCapture, LeaveRequest, OvertimeRequest,
    PayrollExport, StaffSummary, AttendanceDeviceLog
)


class StaffBankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffBankAccount
        fields = ['id', 'account_holder', 'bank_name', 'ifsc_code', 'account_number', 'account_type']
        read_only_fields = ['id']
        extra_kwargs = {
            'account_holder': {'required': False, 'allow_blank': True},
            'bank_name': {'required': False, 'allow_blank': True},
            'ifsc_code': {'required': False, 'allow_blank': True},
            'account_number': {'required': False, 'allow_blank': True},
            'account_type': {'required': False, 'allow_blank': True},
        }


class StaffIDProofSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = StaffIDProof
        fields = ['id', 'document_type', 'document_type_display', 'document_number', 'expiry_date', 'attachment']
        read_only_fields = ['id']
        extra_kwargs = {
            'expiry_date': {'required': False},
            'attachment': {'required': False},
        }


class StaffListSerializer(serializers.ModelSerializer):
    """Staff serializer for lists and creation"""
    full_name = serializers.CharField(read_only=True)
    staff_type_display = serializers.CharField(source='get_staff_type_display', read_only=True)
    employment_status_display = serializers.CharField(source='get_employment_status_display', read_only=True)

    class Meta:
        model = Staff
        fields = [
            'id', 'staff_id', 'first_name', 'last_name', 'full_name',
            'staff_type', 'staff_type_display', 'gender', 'date_of_birth',
            'company', 'primary_location',
            'designation', 'department', 'employment_status', 'employment_status_display',
            'employment_start_date', 'employment_end_date',
            'overtime_eligible', 'contractor_flag', 'contractor_vendor',
            'contact_number', 'emergency_contact', 'address',
            'face_template_id', 'photo_reference', 'remarks',
            'is_active'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'company': {'required': True},
            'primary_location': {'required': True},
            'gender': {'required': False, 'allow_null': True},
            'date_of_birth': {'required': False, 'allow_null': True},
            'designation': {'required': False, 'allow_blank': True},
            'department': {'required': False, 'allow_blank': True},
            'employment_status': {'required': False, 'allow_blank': True},
            'employment_start_date': {'required': False, 'allow_null': True},
            'employment_end_date': {'required': False, 'allow_null': True},
            'contact_number': {'required': False, 'allow_blank': True},
            'emergency_contact': {'required': False, 'allow_blank': True, 'allow_null': True},
            'address': {'required': False, 'allow_null': True},
            'face_template_id': {'required': False, 'allow_blank': True, 'allow_null': True},
            'photo_reference': {'required': False, 'allow_null': True},
            'remarks': {'required': False, 'allow_blank': True},
            'contractor_vendor': {'required': False, 'allow_null': True},
        }


class StaffDetailSerializer(serializers.ModelSerializer):
    """Full staff details with related records"""
    full_name = serializers.CharField(read_only=True)
    bank_account = StaffBankAccountSerializer(read_only=True)
    id_proofs = StaffIDProofSerializer(many=True, read_only=True)
    shift_name = serializers.CharField(source='shift_assignment.shift_name', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    warehouse_name = serializers.CharField(source='primary_location.name', read_only=True)
    staff_type_display = serializers.CharField(source='get_staff_type_display', read_only=True)
    employment_status_display = serializers.CharField(source='get_employment_status_display', read_only=True)

    class Meta:
        model = Staff
        fields = [
            'id', 'staff_id', 'staff_type', 'staff_type_display', 'first_name', 'last_name', 'full_name',
            'gender', 'date_of_birth', 'company', 'company_name', 'primary_location', 'warehouse_name',
            'department', 'designation', 'employment_start_date', 'employment_end_date', 'employment_status',
            'employment_status_display', 'hr_owner', 'shift_assignment', 'shift_name', 'overtime_eligible',
            'contractor_flag', 'contractor_vendor', 'face_template_id', 'photo_reference', 'contact_number',
            'emergency_contact', 'address', 'remarks', 'bank_account', 'id_proofs', 'is_active'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'gender': {'required': False, 'allow_blank': True},
            'date_of_birth': {'required': False},
            'department': {'required': False, 'allow_blank': True},
            'designation': {'required': False, 'allow_blank': True},
            'employment_end_date': {'required': False},
            'employment_status': {'required': False, 'allow_blank': True},
            'hr_owner': {'required': False},
            'shift_assignment': {'required': False},
            'contractor_vendor': {'required': False},
            'face_template_id': {'required': False, 'allow_blank': True},
            'photo_reference': {'required': False},
            'contact_number': {'required': False, 'allow_blank': True},
            'emergency_contact': {'required': False, 'allow_blank': True},
            'address': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }


class ShiftDefinitionSerializer(serializers.ModelSerializer):
    shift_duration_hours = serializers.DecimalField(source='shift_duration_hours', read_only=True, max_digits=5, decimal_places=2)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    attendance_rule_display = serializers.CharField(source='get_attendance_calculation_rule_display', read_only=True)

    class Meta:
        model = ShiftDefinition
        fields = [
            'id', 'shift_code', 'warehouse', 'warehouse_name', 'shift_name', 'start_time', 'end_time',
            'shift_duration_hours', 'break_duration_mins', 'overtime_eligibility', 'attendance_calculation_rule',
            'attendance_rule_display', 'grace_period_minutes', 'approval_required', 'is_active'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'break_duration_mins': {'required': False},
            'attendance_calculation_rule': {'required': False, 'allow_blank': True},
            'grace_period_minutes': {'required': False},
        }


class AttendanceCaptureSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.full_name', read_only=True)
    staff_id_display = serializers.CharField(source='staff.staff_id', read_only=True)
    shift_name = serializers.CharField(source='shift.shift_name', read_only=True)
    attendance_status_display = serializers.CharField(source='get_attendance_status_display', read_only=True)
    duration_hours = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceCapture
        fields = [
            'id', 'staff', 'staff_id_display', 'staff_name', 'date', 'check_in_time', 'check_out_time',
            'duration_hours', 'entry_photo', 'exit_photo', 'geo_latitude', 'geo_longitude',
            'face_match_confidence', 'device_id', 'shift', 'shift_name', 'attendance_status',
            'attendance_status_display', 'overtime_hours', 'notes'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'check_out_time': {'required': False},
            'exit_photo': {'required': False},
            'shift': {'required': False},
            'overtime_hours': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def get_duration_hours(self, obj):
        if obj.check_out_time and obj.check_in_time:
            delta = obj.check_out_time - obj.check_in_time
            return Decimal(delta.total_seconds()) / Decimal(3600)
        return None


class LeaveRequestSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.full_name', read_only=True)
    staff_id_display = serializers.CharField(source='staff.staff_id', read_only=True)
    approver_name = serializers.CharField(source='approver.user.get_full_name', read_only=True, allow_null=True)
    leave_type_display = serializers.CharField(source='get_leave_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    days_requested = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'request_no', 'staff', 'staff_id_display', 'staff_name', 'leave_type', 'leave_type_display',
            'start_date', 'end_date', 'duration_hours', 'days_requested', 'reason', 'attachment',
            'status', 'status_display', 'approver', 'approver_name', 'approval_date', 'created_at'
        ]
        read_only_fields = ['id', 'request_no']
        extra_kwargs = {
            'end_date': {'required': False},
            'duration_hours': {'required': False},
            'reason': {'required': False, 'allow_blank': True},
            'attachment': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'approver': {'required': False},
            'approval_date': {'required': False},
        }

    def get_days_requested(self, obj):
        if obj.end_date:
            return (obj.end_date - obj.start_date).days + 1
        return 1


class OvertimeRequestSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.full_name', read_only=True)
    staff_id_display = serializers.CharField(source='staff.staff_id', read_only=True)
    shift_name = serializers.CharField(source='shift.shift_name', read_only=True, allow_null=True)
    approved_by_name = serializers.CharField(source='approved_by.user.get_full_name', read_only=True, allow_null=True)
    approval_status_display = serializers.CharField(source='get_approval_status_display', read_only=True)

    class Meta:
        model = OvertimeRequest
        fields = [
            'id', 'request_no', 'staff', 'staff_id_display', 'staff_name', 'date', 'shift', 'shift_name',
            'hours_worked', 'task_description', 'supporting_evidence', 'approval_status', 'approval_status_display',
            'approved_by', 'approved_by_name', 'wage_integration_flag', 'created_at'
        ]
        read_only_fields = ['id', 'request_no']
        extra_kwargs = {
            'shift': {'required': False},
            'task_description': {'required': False, 'allow_blank': True},
            'supporting_evidence': {'required': False},
            'approval_status': {'required': False, 'allow_blank': True},
            'approved_by': {'required': False},
        }


class StaffSummarySerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.full_name', read_only=True)
    staff_id_display = serializers.CharField(source='staff.staff_id', read_only=True)

    class Meta:
        model = StaffSummary
        fields = [
            'id', 'staff', 'staff_id_display', 'staff_name', 'present_days', 'absent_days',
            'overtime_hours', 'wages_amount'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'overtime_hours': {'required': False},
            'wages_amount': {'required': False},
        }


class PayrollExportSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    staff_summaries = StaffSummarySerializer(many=True, read_only=True)
    total_staff = serializers.SerializerMethodField()

    class Meta:
        model = PayrollExport
        fields = [
            'id', 'export_id', 'period_start', 'period_end', 'warehouse', 'warehouse_name',
            'attendance_metrics', 'overtime_hours_total', 'exceptions', 'export_file',
            'staff_summaries', 'total_staff', 'created_at'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'attendance_metrics': {'required': False, 'allow_blank': True},
            'overtime_hours_total': {'required': False},
            'exceptions': {'required': False, 'allow_blank': True},
            'export_file': {'required': False},
        }

    def get_total_staff(self, obj):
        return obj.staff_summaries.count()


class AttendanceDeviceLogSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AttendanceDeviceLog
        fields = [
            'id', 'device_id', 'event_time', 'event_type', 'event_type_display',
            'status', 'status_display', 'error_message'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'error_message': {'required': False, 'allow_blank': True},
        }
