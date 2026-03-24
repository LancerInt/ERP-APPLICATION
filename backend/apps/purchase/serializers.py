"""Serializers for purchase app."""

from decimal import Decimal
from rest_framework import serializers
from django.utils import timezone
from django.db import transaction

from .models import (
    PurchaseRequest, PRLine, PRApprovalTrail,
    RFQHeader, DispatchETAUpdate,
    QuoteResponse, QuoteLine, QuoteEvaluation, ComparisonEntry, EvalApprovalTrail,
    PurchaseOrder, POLine, POETAUpdate,
    ReceiptAdvice, ReceiptLine, PackingMaterialLine, FreightDetail,
    LoadingUnloadingWage, FreightPaymentSchedule, FreightAdviceInbound,
    VendorPaymentAdvice, PaymentTaxComponent
)


class PRLineSerializer(serializers.ModelSerializer):
    """Serializer for PR line items."""

    product_name = serializers.CharField(
        source='product_service.product_name',
        read_only=True
    )
    product_code = serializers.CharField(
        source='product_service.sku_code',
        read_only=True
    )
    machine_name = serializers.CharField(
        source='machine_reference.name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = PRLine
        fields = [
            'id', 'line_no', 'product_service', 'product_name', 'product_code',
            'description_override', 'quantity_requested', 'uom', 'required_date',
            'purpose', 'machine_reference', 'machine_name', 'allow_rfq_skip',
            'status', 'approved_quantity', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'description_override': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'required_date': {'required': False},
            'purpose': {'required': False, 'allow_blank': True},
            'machine_reference': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'approved_quantity': {'required': False},
        }

    def validate_quantity_requested(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value

    def validate_approved_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Approved quantity cannot be negative")
        return value


class PRApprovalTrailSerializer(serializers.ModelSerializer):
    """Serializer for PR approval trails."""

    actor_name = serializers.CharField(
        source='actor.user.get_full_name',
        read_only=True
    )
    action_display = serializers.CharField(
        source='get_action_display',
        read_only=True
    )

    class Meta:
        model = PRApprovalTrail
        fields = [
            'id', 'purchase_request', 'action', 'action_display', 'actor',
            'actor_name', 'action_date', 'remarks'
        ]
        read_only_fields = ['id', 'action_date']
        extra_kwargs = {
            'remarks': {'required': False, 'allow_blank': True},
        }


class PurchaseRequestSerializer(serializers.ModelSerializer):
    """Serializer for purchase requests with nested lines."""

    lines = PRLineSerializer(many=True, read_only=True)
    approval_trails = PRApprovalTrailSerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(
        source='warehouse.name',
        read_only=True
    )
    godown_name = serializers.CharField(
        source='godown.name',
        read_only=True,
        allow_null=True
    )
    requested_by_name = serializers.CharField(
        source='requested_by.user.get_full_name',
        read_only=True
    )
    requirement_type_display = serializers.CharField(
        source='get_requirement_type_display',
        read_only=True
    )
    priority_display = serializers.CharField(
        source='get_priority_display',
        read_only=True
    )
    approval_status_display = serializers.CharField(
        source='get_approval_status_display',
        read_only=True
    )
    approved_by_name = serializers.SerializerMethodField()
    linked_rfq_no = serializers.SerializerMethodField()

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def get_linked_rfq_no(self, obj):
        if obj.linked_rfq:
            return obj.linked_rfq.rfq_no
        return None

    class Meta:
        model = PurchaseRequest
        fields = [
            'id', 'pr_no', 'request_date', 'warehouse', 'warehouse_name',
            'godown', 'godown_name', 'requested_by', 'requested_by_name',
            'requestor_role', 'requirement_type', 'requirement_type_display',
            'priority', 'priority_display', 'required_by_date', 'justification',
            'approval_status', 'approval_status_display', 'visibility_scope',
            'notes', 'approved_by', 'approved_by_name', 'approved_at',
            'linked_rfq', 'linked_rfq_no',
            'lines', 'approval_trails', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'pr_no', 'request_date', 'approved_by', 'approved_at',
            'linked_rfq', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'requested_by': {'required': False, 'allow_null': True},
            'godown': {'required': False, 'allow_null': True},
            'requestor_role': {'required': False, 'allow_blank': True},
            'requirement_type': {'required': False, 'allow_blank': True},
            'priority': {'required': False, 'allow_blank': True},
            'required_by_date': {'required': False},
            'justification': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
            'visibility_scope': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def validate_required_by_date(self, value):
        if value and value < timezone.now().date():
            raise serializers.ValidationError("Required date cannot be in the past")
        return value

    def validate_visibility_scope(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Visibility scope must be a JSON object")
        return value


class DispatchETAUpdateSerializer(serializers.ModelSerializer):
    """Serializer for RFQ ETA updates."""

    updated_by_name = serializers.CharField(
        source='updated_by.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = DispatchETAUpdate
        fields = [
            'id', 'rfq', 'update_date', 'updated_by', 'updated_by_name',
            'expected_arrival', 'remarks'
        ]
        read_only_fields = ['id', 'update_date']
        extra_kwargs = {
            'expected_arrival': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }


class RFQHeaderSerializer(serializers.ModelSerializer):
    """Serializer for RFQ headers."""

    eta_updates = DispatchETAUpdateSerializer(
        source='eta_updates.all',
        many=True,
        read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.user.get_full_name',
        read_only=True
    )
    purchase_manager_approval_name = serializers.CharField(
        source='purchase_manager_approval.user.get_full_name',
        read_only=True,
        allow_null=True
    )
    quote_count = serializers.SerializerMethodField()
    linked_pr_numbers = serializers.SerializerMethodField()
    rfq_mode_display = serializers.CharField(
        source='get_rfq_mode_display',
        read_only=True
    )
    rfq_status_display = serializers.CharField(
        source='get_rfq_status_display',
        read_only=True
    )

    class Meta:
        model = RFQHeader
        fields = [
            'id', 'rfq_no', 'creation_date', 'created_by', 'created_by_name',
            'rfq_mode', 'rfq_mode_display', 'rfq_status', 'rfq_status_display',
            'quote_count_expected', 'quote_count', 'skip_rfq_flag',
            'skip_rfq_justification', 'purchase_manager_approval',
            'purchase_manager_approval_name', 'linked_prs', 'linked_pr_numbers', 'eta_updates',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'rfq_no', 'creation_date', 'created_at', 'updated_at']
        extra_kwargs = {
            'rfq_mode': {'required': False, 'allow_blank': True},
            'rfq_status': {'required': False, 'allow_blank': True},
            'quote_count_expected': {'required': False},
            'skip_rfq_justification': {'required': False, 'allow_blank': True},
            'purchase_manager_approval': {'required': False},
        }

    def get_quote_count(self, obj):
        return obj.get_active_quote_count()

    def get_linked_pr_numbers(self, obj):
        """Return PR numbers instead of UUIDs for linked purchase requests."""
        prs = obj.source_purchase_requests.all() if hasattr(obj, 'source_purchase_requests') else []
        if prs:
            return [pr.pr_no for pr in prs]
        # Fallback: check linked_prs M2M if it exists
        if hasattr(obj, 'linked_prs'):
            return [pr.pr_no for pr in obj.linked_prs.all()]
        return []


class QuoteLineSerializer(serializers.ModelSerializer):
    """Serializer for quote line items."""

    product_name = serializers.CharField(
        source='product_service.product_name',
        read_only=True
    )
    pr_line_description = serializers.CharField(
        source='pr_line.description_override',
        read_only=True
    )
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = QuoteLine
        fields = [
            'id', 'quote', 'pr_line', 'pr_line_description', 'product_service',
            'product_name', 'specification', 'quantity_offered', 'uom',
            'unit_price', 'discount', 'gst', 'freight_charge',
            'delivery_timeline', 'line_total'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'pr_line': {'required': False},
            'specification': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'discount': {'required': False},
            'gst': {'required': False},
            'freight_charge': {'required': False},
            'delivery_timeline': {'required': False},
        }

    def get_line_total(self, obj):
        return str(obj.get_line_total())

    def validate_quantity_offered(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative")
        return value


class QuoteResponseSerializer(serializers.ModelSerializer):
    """Serializer for quote responses."""

    quote_lines = QuoteLineSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True, default='')
    vendor_code = serializers.CharField(source='vendor.vendor_code', read_only=True, default='')
    rfq_no = serializers.CharField(source='rfq.rfq_no', read_only=True, default='')
    total_cost = serializers.SerializerMethodField()
    pr_numbers = serializers.SerializerMethodField()

    class Meta:
        model = QuoteResponse
        fields = [
            'id', 'quote_id', 'rfq', 'rfq_no', 'pr_numbers', 'vendor', 'vendor_name', 'vendor_code', 'quote_date',
            'price_valid_till', 'currency', 'freight_terms', 'payment_terms',
            'delivery_terms', 'lead_time_days', 'remarks', 'evaluation_score',
            'chosen_flag', 'quote_lines', 'total_cost', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'quote_id', 'quote_date', 'created_at', 'updated_at']
        extra_kwargs = {
            'price_valid_till': {'required': False},
            'currency': {'required': False, 'allow_blank': True},
            'freight_terms': {'required': False, 'allow_blank': True},
            'payment_terms': {'required': False, 'allow_blank': True},
            'delivery_terms': {'required': False, 'allow_blank': True},
            'lead_time_days': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
            'evaluation_score': {'required': False},
        }

    def get_total_cost(self, obj):
        return str(obj.get_total_cost())

    def get_pr_numbers(self, obj):
        """Get PR numbers linked through the RFQ."""
        if obj.rfq:
            prs = obj.rfq.linked_prs.all()
            return [pr.pr_no for pr in prs]
        return []


class ComparisonEntrySerializer(serializers.ModelSerializer):
    """Serializer for quote comparison entries."""

    vendor_name = serializers.CharField(
        source='vendor.name',
        read_only=True
    )

    class Meta:
        model = ComparisonEntry
        fields = [
            'id', 'evaluation', 'vendor', 'vendor_name', 'total_cost',
            'lead_time', 'freight_terms', 'payment_terms', 'score', 'remarks'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'total_cost': {'required': False},
            'lead_time': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'payment_terms': {'required': False, 'allow_blank': True},
            'score': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }


class EvalApprovalTrailSerializer(serializers.ModelSerializer):
    """Serializer for evaluation approval trails."""

    actor_name = serializers.CharField(
        source='actor.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = EvalApprovalTrail
        fields = [
            'id', 'evaluation', 'actor', 'actor_name', 'action',
            'action_date', 'remarks'
        ]
        read_only_fields = ['id', 'action_date']
        extra_kwargs = {
            'remarks': {'required': False, 'allow_blank': True},
        }


class QuoteEvaluationSerializer(serializers.ModelSerializer):
    """Serializer for quote evaluations."""

    comparison_entries = ComparisonEntrySerializer(many=True, read_only=True)
    approval_trails = EvalApprovalTrailSerializer(many=True, read_only=True)
    evaluated_by_name = serializers.CharField(
        source='evaluated_by.user.get_full_name',
        read_only=True
    )
    recommended_vendor_name = serializers.CharField(
        source='recommended_vendor.name',
        read_only=True,
        allow_null=True
    )
    approval_status_display = serializers.CharField(
        source='get_approval_status_display',
        read_only=True
    )

    class Meta:
        model = QuoteEvaluation
        fields = [
            'id', 'evaluation_id', 'rfq', 'evaluation_date', 'evaluated_by',
            'evaluated_by_name', 'best_quote_flag', 'recommended_vendor',
            'recommended_vendor_name', 'justification_notes', 'approval_status',
            'approval_status_display', 'comparison_entries', 'approval_trails',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'evaluation_id', 'evaluation_date', 'created_at', 'updated_at']
        extra_kwargs = {
            'recommended_vendor': {'required': False},
            'justification_notes': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
        }


class POLineSerializer(serializers.ModelSerializer):
    """Serializer for PO line items."""

    product_name = serializers.CharField(
        source='product_service.product_name',
        read_only=True
    )
    product_code = serializers.CharField(
        source='product_service.sku_code',
        read_only=True
    )
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = POLine
        fields = [
            'id', 'po', 'line_no', 'product_service', 'product_name',
            'product_code', 'description', 'quantity_ordered', 'uom',
            'unit_price', 'discount', 'gst', 'extra_commission',
            'agent_commission', 'freight_estimate', 'delivery_schedule',
            'linked_pr_line', 'linked_rfq_line', 'batch_requirement_notes',
            'line_total', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'discount': {'required': False},
            'gst': {'required': False},
            'extra_commission': {'required': False},
            'agent_commission': {'required': False},
            'freight_estimate': {'required': False},
            'delivery_schedule': {'required': False},
            'linked_pr_line': {'required': False},
            'linked_rfq_line': {'required': False},
            'batch_requirement_notes': {'required': False, 'allow_blank': True},
        }

    def get_line_total(self, obj):
        return str(obj.get_line_total())


class POETAUpdateSerializer(serializers.ModelSerializer):
    """Serializer for PO ETA updates."""

    updated_by_name = serializers.CharField(
        source='updated_by.user.get_full_name',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )

    class Meta:
        model = POETAUpdate
        fields = [
            'id', 'po', 'update_date', 'updated_by', 'updated_by_name',
            'expected_arrival_date', 'status', 'status_display', 'remarks'
        ]
        read_only_fields = ['id', 'update_date']
        extra_kwargs = {
            'expected_arrival_date': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Serializer for purchase orders."""

    po_lines = POLineSerializer(many=True, read_only=True)
    eta_updates = POETAUpdateSerializer(
        source='eta_updates.all',
        many=True,
        read_only=True
    )
    vendor_name = serializers.CharField(
        source='vendor.name',
        read_only=True
    )
    company_name = serializers.CharField(
        source='company.name',
        read_only=True
    )
    warehouse_name = serializers.CharField(
        source='warehouse.name',
        read_only=True
    )
    total_order_value = serializers.SerializerMethodField()
    total_received = serializers.SerializerMethodField()
    is_fully_received = serializers.SerializerMethodField()
    linked_pr_numbers = serializers.SerializerMethodField()
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_no', 'revision_no', 'vendor', 'vendor_name', 'company',
            'company_name', 'warehouse', 'warehouse_name', 'linked_rfq',
            'po_date', 'expected_delivery_start', 'expected_delivery_end',
            'freight_terms', 'payment_terms', 'currency', 'terms_and_conditions',
            'status', 'status_display', 'partial_receipt_flag', 'linked_prs',
            'linked_pr_numbers',
            'po_lines', 'eta_updates', 'total_order_value', 'total_received',
            'is_fully_received', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'po_no', 'revision_no', 'po_date', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'linked_rfq': {'required': False},
            'expected_delivery_start': {'required': False},
            'expected_delivery_end': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'payment_terms': {'required': False, 'allow_blank': True},
            'currency': {'required': False, 'allow_blank': True},
            'terms_and_conditions': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }

    def get_total_order_value(self, obj):
        return str(obj.get_total_order_value())

    def get_total_received(self, obj):
        return str(obj.get_total_received())

    def get_is_fully_received(self, obj):
        return obj.is_fully_received()

    def get_linked_pr_numbers(self, obj):
        """Return PR numbers for linked purchase requests."""
        return [pr.pr_no for pr in obj.linked_prs.all()]


class ReceiptLineSerializer(serializers.ModelSerializer):
    """Serializer for receipt line items."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )
    godown_name = serializers.CharField(
        source='godown_location.name',
        read_only=True
    )
    po_line_info = serializers.SerializerMethodField()

    class Meta:
        model = ReceiptLine
        fields = [
            'id', 'receipt', 'line_no', 'po_line', 'po_line_info', 'product',
            'product_name', 'batch_no', 'expiry_date', 'quantity_received', 'uom',
            'extra_commission', 'agent_commission', 'quantity_accepted',
            'quantity_rejected', 'godown_location', 'godown_name', 'remarks',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'batch_no': {'required': False, 'allow_blank': True},
            'expiry_date': {'required': False},
            'uom': {'required': False, 'allow_blank': True},
            'extra_commission': {'required': False},
            'agent_commission': {'required': False},
            'quantity_accepted': {'required': False},
            'quantity_rejected': {'required': False},
            'godown_location': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }

    def get_po_line_info(self, obj):
        return f"PO {obj.po_line.po.po_no} - Line {obj.po_line.line_no}"


class PackingMaterialLineSerializer(serializers.ModelSerializer):
    """Serializer for packing materials."""

    packaging_sku_name = serializers.CharField(
        source='packaging_sku.name',
        read_only=True
    )
    condition_display = serializers.CharField(
        source='get_condition_display',
        read_only=True
    )

    class Meta:
        model = PackingMaterialLine
        fields = [
            'id', 'receipt', 'packaging_sku', 'packaging_sku_name', 'quantity',
            'uom', 'condition', 'condition_display'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'uom': {'required': False, 'allow_blank': True},
            'condition': {'required': False, 'allow_blank': True},
        }


class FreightDetailSerializer(serializers.ModelSerializer):
    """Serializer for freight details."""

    transporter_name = serializers.CharField(
        source='transporter.name',
        read_only=True,
        allow_null=True
    )
    freight_type_display = serializers.CharField(
        source='get_freight_type_display',
        read_only=True
    )
    payable_by_display = serializers.CharField(
        source='get_payable_by_display',
        read_only=True
    )
    payable_amount = serializers.SerializerMethodField()

    class Meta:
        model = FreightDetail
        fields = [
            'id', 'receipt', 'freight_type', 'freight_type_display', 'transporter',
            'transporter_name', 'freight_terms', 'tentative_charge', 'discount',
            'payable_by', 'payable_by_display', 'quantity_basis', 'quantity_uom',
            'destination_state', 'cost_per_unit_calc', 'payable_amount'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'transporter': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'tentative_charge': {'required': False},
            'discount': {'required': False},
            'payable_by': {'required': False, 'allow_blank': True},
            'quantity_basis': {'required': False},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'destination_state': {'required': False, 'allow_blank': True},
            'cost_per_unit_calc': {'required': False},
        }

    def get_payable_amount(self, obj):
        return str(obj.get_payable_amount())


class LoadingUnloadingWageSerializer(serializers.ModelSerializer):
    """Serializer for loading/unloading wages."""

    contractor_vendor_name = serializers.CharField(
        source='contractor_vendor.name',
        read_only=True,
        allow_null=True
    )
    wage_type_display = serializers.CharField(
        source='get_wage_type_display',
        read_only=True
    )
    payable_by_display = serializers.CharField(
        source='get_payable_by_display',
        read_only=True
    )
    tds_amount = serializers.SerializerMethodField()
    net_payable = serializers.SerializerMethodField()

    class Meta:
        model = LoadingUnloadingWage
        fields = [
            'id', 'receipt', 'wage_type', 'wage_type_display', 'contractor_vendor',
            'contractor_vendor_name', 'amount', 'tds_applicable', 'payable_by',
            'payable_by_display', 'remarks', 'tds_amount', 'net_payable'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'contractor_vendor': {'required': False},
            'payable_by': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }

    def get_tds_amount(self, obj):
        return str(obj.get_tds_amount())

    def get_net_payable(self, obj):
        return str(obj.get_net_payable())


class FreightPaymentScheduleSerializer(serializers.ModelSerializer):
    """Serializer for freight payment schedules."""

    transporter_name = serializers.CharField(
        source='transporter.name',
        read_only=True,
        allow_null=True
    )
    freight_type_display = serializers.CharField(
        source='get_freight_type_display',
        read_only=True
    )

    class Meta:
        model = FreightPaymentSchedule
        fields = [
            'id', 'receipt', 'freight_type', 'freight_type_display', 'transporter',
            'transporter_name', 'due_date', 'amount', 'tds', 'reminder_flag'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'transporter': {'required': False},
            'tds': {'required': False},
        }


class ReceiptAdviceSerializer(serializers.ModelSerializer):
    """Serializer for receipt advices."""

    receipt_lines = ReceiptLineSerializer(many=True, read_only=True)
    packing_materials = PackingMaterialLineSerializer(many=True, read_only=True)
    freight_details = FreightDetailSerializer(many=True, read_only=True)
    loading_unloading_wages = LoadingUnloadingWageSerializer(many=True, read_only=True)
    freight_payment_schedules = FreightPaymentScheduleSerializer(
        many=True,
        read_only=True
    )
    warehouse_name = serializers.CharField(
        source='warehouse.name',
        read_only=True
    )
    godown_name = serializers.CharField(
        source='godown.name',
        read_only=True
    )
    vendor_name = serializers.CharField(
        source='vendor.name',
        read_only=True
    )
    qc_routing_display = serializers.CharField(
        source='get_qc_routing_display',
        read_only=True
    )
    qc_status_display = serializers.CharField(
        source='get_qc_status_display',
        read_only=True
    )
    total_received = serializers.SerializerMethodField()

    class Meta:
        model = ReceiptAdvice
        fields = [
            'id', 'receipt_advice_no', 'receipt_date', 'warehouse', 'warehouse_name',
            'godown', 'godown_name', 'vendor', 'vendor_name', 'vehicle_number',
            'driver_name', 'qc_routing', 'qc_routing_display', 'qc_status',
            'qc_status_display', 'partial_receipt_flag', 'remarks', 'linked_pos',
            'receipt_lines', 'packing_materials', 'freight_details',
            'loading_unloading_wages', 'freight_payment_schedules', 'total_received',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'receipt_advice_no', 'receipt_date', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'godown': {'required': False},
            'vehicle_number': {'required': False, 'allow_blank': True},
            'driver_name': {'required': False, 'allow_blank': True},
            'qc_routing': {'required': False, 'allow_blank': True},
            'qc_status': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }

    def get_total_received(self, obj):
        return str(obj.get_total_received())


class FreightAdviceInboundSerializer(serializers.ModelSerializer):
    """Serializer for freight advices."""

    transporter_name = serializers.CharField(
        source='transporter.name',
        read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.user.get_full_name',
        read_only=True
    )
    freight_type_display = serializers.CharField(
        source='get_freight_type_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    total_payable = serializers.SerializerMethodField()

    class Meta:
        model = FreightAdviceInbound
        fields = [
            'id', 'advice_no', 'direction', 'receipt_advice', 'transporter',
            'transporter_name', 'freight_type', 'freight_type_display', 'created_by',
            'created_by_name', 'created_date', 'base_amount', 'discount',
            'loading_wages_amount', 'unloading_wages_amount', 'quantity_basis',
            'quantity_uom', 'cost_per_unit_calc', 'destination_state',
            'payable_amount', 'status', 'status_display', 'total_payable',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'advice_no', 'direction', 'created_date', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'discount': {'required': False},
            'loading_wages_amount': {'required': False},
            'unloading_wages_amount': {'required': False},
            'quantity_basis': {'required': False},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'cost_per_unit_calc': {'required': False},
            'destination_state': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }

    def get_total_payable(self, obj):
        return str(obj.get_total_payable())


class PaymentTaxComponentSerializer(serializers.ModelSerializer):
    """Serializer for payment tax components."""

    tax_type_display = serializers.CharField(
        source='get_tax_type_display',
        read_only=True
    )

    class Meta:
        model = PaymentTaxComponent
        fields = [
            'id', 'advice', 'tax_type', 'tax_type_display', 'rate', 'amount'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'rate': {'required': False},
        }


class VendorPaymentAdviceSerializer(serializers.ModelSerializer):
    """Serializer for vendor payment advices."""

    tax_components = PaymentTaxComponentSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(
        source='vendor.name',
        read_only=True
    )
    prepared_by_name = serializers.CharField(
        source='prepared_by.user.get_full_name',
        read_only=True
    )
    source_document_type_display = serializers.CharField(
        source='get_source_document_type_display',
        read_only=True
    )
    payment_method_display = serializers.CharField(
        source='get_payment_method_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    net_payable = serializers.SerializerMethodField()

    class Meta:
        model = VendorPaymentAdvice
        fields = [
            'id', 'advice_no', 'vendor', 'vendor_name', 'source_document_type',
            'source_document_type_display', 'source_document_id', 'amount', 'due_date',
            'payment_method', 'payment_method_display', 'prepared_by',
            'prepared_by_name', 'status', 'status_display', 'notes', 'tax_components',
            'net_payable', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'advice_no', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'source_document_type': {'required': False, 'allow_blank': True},
            'due_date': {'required': False},
            'payment_method': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }

    def get_net_payable(self, obj):
        return str(obj.get_net_payable())
