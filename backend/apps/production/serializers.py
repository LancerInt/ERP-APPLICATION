"""Serializers for production app models."""
from rest_framework import serializers
from django.utils import timezone
from .models import (
    BOMRequest, BOMInput, MaterialIssue, IssueLine, WorkOrder,
    InputConsumption, OutputProduct, DamageReport, WorkOrderWageVoucherLink,
    WageVoucher, HoursTask, ProductionYieldLog
)


class BOMInputSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)

    class Meta:
        model = BOMInput
        fields = [
            'id', 'product', 'product_code', 'product_name', 'required_qty',
            'available_qty', 'shortfall_qty', 'purpose', 'created_at'
        ]
        extra_kwargs = {
            'available_qty': {'required': False},
            'shortfall_qty': {'required': False},
        }


class BOMRequestListSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source='warehouse.warehouse_code', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.user.get_full_name', read_only=True)
    product_code = serializers.CharField(source='output_product.product_code', read_only=True)

    class Meta:
        model = BOMRequest
        fields = [
            'id', 'request_no', 'request_date', 'warehouse', 'warehouse_code',
            'requested_by_name', 'output_product', 'product_code', 'output_quantity',
            'approval_status', 'required_completion_date'
        ]
        extra_kwargs = {
            'approval_status': {'required': False, 'allow_blank': True},
            'required_completion_date': {'required': False},
        }


class BOMRequestDetailSerializer(serializers.ModelSerializer):
    inputs = BOMInputSerializer(many=True, read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.warehouse_code', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.user.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user.get_full_name', read_only=True, allow_null=True)
    template_name = serializers.CharField(source='production_template.template_name', read_only=True)

    class Meta:
        model = BOMRequest
        fields = [
            'id', 'request_no', 'request_date', 'warehouse', 'warehouse_code',
            'requested_by', 'requested_by_name', 'production_template', 'template_name',
            'output_product', 'output_quantity', 'required_completion_date',
            'shortfall_summary', 'approval_status', 'approved_by', 'approved_by_name',
            'approved_date', 'notes', 'inputs', 'created_at', 'updated_at'
        ]
        read_only_fields = ['request_no', 'request_date', 'approved_by', 'approved_date']
        extra_kwargs = {
            'required_completion_date': {'required': False},
            'shortfall_summary': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class BOMRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BOMRequest
        fields = [
            'warehouse', 'production_template', 'output_product', 'output_quantity',
            'required_completion_date', 'notes'
        ]
        extra_kwargs = {
            'required_completion_date': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class IssueLineSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    godown_code = serializers.CharField(source='godown.godown_code', read_only=True)

    class Meta:
        model = IssueLine
        fields = [
            'id', 'product', 'product_code', 'product_name', 'batch_out',
            'godown', 'godown_code', 'quantity_issued', 'uom', 'reserved_for_template', 'created_at'
        ]
        extra_kwargs = {
            'batch_out': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
        }


class MaterialIssueListSerializer(serializers.ModelSerializer):
    warehouse_code = serializers.CharField(source='warehouse.warehouse_code', read_only=True)
    work_order_batch = serializers.CharField(source='work_order.batch_id', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.user.get_full_name', read_only=True)

    class Meta:
        model = MaterialIssue
        fields = [
            'id', 'issue_no', 'issue_date', 'warehouse', 'warehouse_code',
            'work_order', 'work_order_batch', 'issued_by_name', 'issued_at'
        ]
        extra_kwargs = {
            'issued_at': {'required': False},
        }


class MaterialIssueDetailSerializer(serializers.ModelSerializer):
    issue_lines = IssueLineSerializer(many=True, read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.warehouse_code', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.user.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = MaterialIssue
        fields = [
            'id', 'issue_no', 'issue_date', 'warehouse', 'warehouse_code',
            'work_order', 'issued_by', 'issued_by_name', 'approved_by', 'approved_by_name',
            'remarks', 'issue_lines', 'created_at', 'updated_at'
        ]
        read_only_fields = ['issue_no', 'issue_date']
        extra_kwargs = {
            'approved_by': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }


class MaterialIssueCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialIssue
        fields = ['warehouse', 'work_order', 'remarks']
        extra_kwargs = {
            'remarks': {'required': False, 'allow_blank': True},
        }


class InputConsumptionSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    godown_code = serializers.CharField(source='godown.godown_code', read_only=True)

    class Meta:
        model = InputConsumption
        fields = [
            'id', 'product', 'product_code', 'product_name', 'planned_qty',
            'actual_qty', 'uom', 'batch_used', 'godown', 'godown_code', 'yield_loss', 'created_at'
        ]
        extra_kwargs = {
            'uom': {'required': False, 'allow_blank': True},
            'batch_used': {'required': False, 'allow_blank': True},
            'yield_loss': {'required': False},
        }


class OutputProductSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)

    class Meta:
        model = OutputProduct
        fields = [
            'id', 'product', 'product_code', 'product_name', 'batch_id',
            'quantity_produced', 'uom', 'purity', 'ai_content', 'qc_status', 'created_at'
        ]
        extra_kwargs = {
            'uom': {'required': False, 'allow_blank': True},
            'purity': {'required': False},
            'ai_content': {'required': False},
            'qc_status': {'required': False, 'allow_blank': True},
        }


class DamageReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DamageReport
        fields = [
            'id', 'work_order', 'stage', 'description', 'quantity_lost',
            'uom', 'handling_action', 'created_at'
        ]
        extra_kwargs = {
            'stage': {'required': False, 'allow_blank': True},
            'quantity_lost': {'required': False},
            'uom': {'required': False, 'allow_blank': True},
        }


class HoursTaskSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.staff_name', read_only=True, allow_null=True)

    class Meta:
        model = HoursTask
        fields = [
            'id', 'staff', 'staff_name', 'task_description', 'hours_worked', 'quantity_produced', 'created_at'
        ]
        extra_kwargs = {
            'staff': {'required': False},
            'hours_worked': {'required': False},
            'quantity_produced': {'required': False},
        }


class WageVoucherListSerializer(serializers.ModelSerializer):
    work_order_batch = serializers.CharField(source='work_order.batch_id', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.user.get_full_name', read_only=True)

    class Meta:
        model = WageVoucher
        fields = [
            'id', 'voucher_no', 'work_order', 'work_order_batch', 'wage_type',
            'amount', 'prepared_by_name', 'status', 'prepared_date'
        ]
        extra_kwargs = {
            'status': {'required': False, 'allow_blank': True},
        }


class WageVoucherDetailSerializer(serializers.ModelSerializer):
    hours_tasks = HoursTaskSerializer(many=True, read_only=True)
    work_order_batch = serializers.CharField(source='work_order.batch_id', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.user.get_full_name', read_only=True)
    contractor_name = serializers.CharField(source='contractor_vendor.vendor_name', read_only=True, allow_null=True)

    class Meta:
        model = WageVoucher
        fields = [
            'id', 'voucher_no', 'work_order', 'work_order_batch', 'wage_type',
            'contractor_vendor', 'contractor_name', 'amount', 'tds', 'prepared_by',
            'prepared_by_name', 'status', 'remarks', 'hours_tasks', 'prepared_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['voucher_no', 'prepared_date']
        extra_kwargs = {
            'contractor_vendor': {'required': False},
            'tds': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }


class WageVoucherCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WageVoucher
        fields = [
            'work_order', 'wage_type', 'contractor_vendor', 'amount', 'tds', 'remarks'
        ]
        extra_kwargs = {
            'contractor_vendor': {'required': False},
            'tds': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }


class ProductionYieldLogSerializer(serializers.ModelSerializer):
    work_order_batch = serializers.CharField(source='work_order.batch_id', read_only=True)
    product_code = serializers.CharField(source='product.product_code', read_only=True)

    class Meta:
        model = ProductionYieldLog
        fields = [
            'id', 'work_order', 'work_order_batch', 'product', 'product_code',
            'planned_yield', 'actual_output_qty', 'purity', 'ai_content', 'variance',
            'remarks', 'report_date', 'created_at'
        ]
        read_only_fields = ['report_date']
        extra_kwargs = {
            'planned_yield': {'required': False},
            'purity': {'required': False},
            'ai_content': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }


class WorkOrderListSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source='production_template.template_name', read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.warehouse_code', read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            'id', 'batch_id', 'work_order_no', 'warehouse', 'warehouse_code',
            'production_template', 'template_name', 'planned_start_date',
            'actual_start_date', 'stage_status', 'rework_flag', 'created_at'
        ]
        extra_kwargs = {
            'actual_start_date': {'required': False},
            'stage_status': {'required': False, 'allow_blank': True},
        }


class WorkOrderDetailSerializer(serializers.ModelSerializer):
    input_consumptions = InputConsumptionSerializer(many=True, read_only=True)
    output_products = OutputProductSerializer(many=True, read_only=True)
    damage_reports = DamageReportSerializer(many=True, read_only=True)
    yield_logs = ProductionYieldLogSerializer(many=True, read_only=True)
    material_issues = MaterialIssueListSerializer(many=True, read_only=True)
    wage_vouchers = WageVoucherListSerializer(many=True, read_only=True)
    template_name = serializers.CharField(source='production_template.template_name', read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            'id', 'batch_id', 'work_order_no', 'warehouse', 'production_template',
            'template_name', 'template_revision', 'linked_sales_order', 'linked_dispatch_challan',
            'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date',
            'stage_status', 'qc_request', 'wage_method', 'rework_flag', 'parent_batch', 'notes',
            'input_consumptions', 'output_products', 'damage_reports', 'yield_logs',
            'material_issues', 'wage_vouchers', 'created_at', 'updated_at'
        ]
        read_only_fields = ['batch_id', 'work_order_no']
        extra_kwargs = {
            'template_revision': {'required': False},
            'linked_sales_order': {'required': False},
            'linked_dispatch_challan': {'required': False},
            'planned_end_date': {'required': False},
            'actual_start_date': {'required': False},
            'actual_end_date': {'required': False},
            'stage_status': {'required': False, 'allow_blank': True},
            'qc_request': {'required': False},
            'wage_method': {'required': False, 'allow_blank': True},
            'parent_batch': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class WorkOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkOrder
        fields = [
            'work_order_no', 'warehouse', 'production_template',
            'linked_sales_order', 'linked_dispatch_challan',
            'planned_start_date', 'planned_end_date', 'wage_method', 'notes'
        ]
        extra_kwargs = {
            'linked_sales_order': {'required': False},
            'linked_dispatch_challan': {'required': False},
            'planned_end_date': {'required': False},
            'wage_method': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }
