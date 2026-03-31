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

    id = serializers.UUIDField(required=False, allow_null=True)
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
        read_only_fields = ['created_at', 'updated_at']
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

    lines = PRLineSerializer(many=True, required=False)
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
    has_po = serializers.SerializerMethodField()

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def get_linked_rfq_no(self, obj):
        if obj.linked_rfq:
            return obj.linked_rfq.rfq_no
        return None

    def get_has_po(self, obj):
        return obj.purchase_orders.filter(is_active=True).exists()

    class Meta:
        model = PurchaseRequest
        fields = [
            'id', 'pr_no', 'request_date', 'warehouse', 'warehouse_name',
            'godown', 'godown_name', 'requested_by', 'requested_by_name',
            'requestor_role', 'requirement_type', 'requirement_type_display',
            'priority', 'priority_display', 'required_by_date', 'justification',
            'approval_status', 'approval_status_display', 'visibility_scope',
            'notes', 'approved_by', 'approved_by_name', 'approved_at',
            'linked_rfq', 'linked_rfq_no', 'has_po',
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

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            existing_lines = {line.id: line for line in instance.lines.all()}
            incoming_ids = set()

            for line_data in lines_data:
                line_data.pop('purchase_request', None)
                line_id = line_data.pop('id', None)

                if line_id and line_id in existing_lines:
                    line_obj = existing_lines[line_id]
                    for attr, value in line_data.items():
                        setattr(line_obj, attr, value)
                    line_obj.save()
                    incoming_ids.add(line_id)
                else:
                    new_line = PRLine.objects.create(purchase_request=instance, **line_data)
                    incoming_ids.add(new_line.id)

            for line_id, line_obj in existing_lines.items():
                if line_id not in incoming_ids:
                    line_obj.delete()

        return instance


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
    rfq_no = serializers.CharField(source='rfq.rfq_no', read_only=True, default='')
    evaluated_by_name = serializers.SerializerMethodField()
    recommended_vendor_name = serializers.CharField(
        source='recommended_vendor.vendor_name',
        read_only=True,
        default=''
    )
    approval_status_display = serializers.CharField(
        source='get_approval_status_display',
        read_only=True
    )

    class Meta:
        model = QuoteEvaluation
        fields = [
            'id', 'evaluation_id', 'rfq', 'rfq_no', 'evaluation_date', 'evaluated_by',
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

    def get_evaluated_by_name(self, obj):
        if obj.evaluated_by and hasattr(obj.evaluated_by, 'user'):
            return obj.evaluated_by.user.get_full_name() or obj.evaluated_by.user.username
        return '-'


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
    received_quantity = serializers.SerializerMethodField()

    class Meta:
        model = POLine
        fields = [
            'id', 'po', 'line_no', 'product_service', 'product_name',
            'product_code', 'description', 'quantity_ordered', 'uom',
            'unit_price', 'discount', 'gst', 'extra_commission',
            'agent_commission', 'freight_estimate', 'delivery_schedule',
            'linked_pr_line', 'linked_rfq_line', 'batch_requirement_notes',
            'line_total', 'received_quantity', 'created_at', 'updated_at'
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

    def get_received_quantity(self, obj):
        """Total quantity already received across all receipt advices."""
        from django.db.models import Sum
        total = ReceiptLine.objects.filter(po_line=obj).aggregate(
            total=Sum('quantity_received')
        )['total'] or 0
        return float(total)


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
        source='vendor.vendor_name',
        read_only=True,
        default=''
    )
    company_name = serializers.CharField(
        source='company.legal_name',
        read_only=True,
        default=''
    )
    warehouse_name = serializers.CharField(
        source='warehouse.name',
        read_only=True,
        default=''
    )
    transporter_name = serializers.CharField(
        source='transporter.name',
        read_only=True,
        default=''
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
            'freight_terms', 'transporter', 'transporter_name', 'payment_terms', 'currency', 'terms_and_conditions',
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

    id = serializers.UUIDField(required=False, allow_null=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True, default='')
    godown_name = serializers.CharField(source='godown_location.godown_name', read_only=True, default='')
    po_line_info = serializers.SerializerMethodField()

    class Meta:
        model = ReceiptLine
        fields = [
            'id', 'line_no', 'po_line', 'po_line_info', 'product',
            'product_name', 'batch_no', 'expiry_date', 'quantity_received', 'uom',
            'extra_commission', 'agent_commission', 'quantity_accepted',
            'quantity_rejected', 'godown_location', 'godown_name', 'remarks',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'po_line': {'required': False, 'allow_null': True},
            'batch_no': {'required': False, 'allow_blank': True},
            'expiry_date': {'required': False},
            'uom': {'required': False, 'allow_blank': True},
            'extra_commission': {'required': False},
            'agent_commission': {'required': False},
            'quantity_accepted': {'required': False},
            'quantity_rejected': {'required': False},
            'godown_location': {'required': False, 'allow_null': True},
            'remarks': {'required': False, 'allow_blank': True},
        }

    def get_po_line_info(self, obj):
        if obj.po_line:
            return f"PO Line {obj.po_line.line_no}"
        return '-'


class PackingMaterialLineSerializer(serializers.ModelSerializer):
    """Serializer for packing materials."""

    id = serializers.UUIDField(required=False, allow_null=True)
    packaging_sku_name = serializers.CharField(source='packaging_sku.product_name', read_only=True, default='')
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)

    class Meta:
        model = PackingMaterialLine
        fields = [
            'id', 'packaging_sku', 'packaging_sku_name', 'quantity',
            'uom', 'condition', 'condition_display'
        ]
        extra_kwargs = {
            'packaging_sku': {'required': False, 'allow_null': True},
            'uom': {'required': False, 'allow_blank': True},
            'condition': {'required': False, 'allow_blank': True},
            'quantity': {'required': False, 'default': 0},
        }


class FreightDetailSerializer(serializers.ModelSerializer):
    """Serializer for freight details."""

    id = serializers.UUIDField(required=False, allow_null=True)
    transporter_name = serializers.CharField(source='transporter.name', read_only=True, default='')
    freight_type_display = serializers.CharField(source='get_freight_type_display', read_only=True)
    payable_by_display = serializers.CharField(source='get_payable_by_display', read_only=True)
    payable_amount = serializers.SerializerMethodField()

    class Meta:
        model = FreightDetail
        fields = [
            'id', 'freight_type', 'freight_type_display', 'transporter',
            'transporter_name', 'freight_terms', 'tentative_charge', 'discount',
            'payable_by', 'payable_by_display', 'quantity_basis', 'quantity_uom',
            'destination_state', 'cost_per_unit_calc', 'payable_amount'
        ]
        extra_kwargs = {
            'freight_type': {'required': False},
            'transporter': {'required': False, 'allow_null': True},
            'freight_terms': {'required': False, 'allow_blank': True},
            'tentative_charge': {'required': False},
            'discount': {'required': False},
            'payable_by': {'required': False},
            'quantity_basis': {'required': False, 'allow_null': True},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'destination_state': {'required': False, 'allow_blank': True},
            'cost_per_unit_calc': {'required': False, 'allow_null': True},
        }

    def get_payable_amount(self, obj):
        return str(obj.get_payable_amount())


class LoadingUnloadingWageSerializer(serializers.ModelSerializer):
    """Serializer for loading/unloading wages."""

    id = serializers.UUIDField(required=False, allow_null=True)
    contractor_vendor_name = serializers.CharField(source='contractor_vendor.vendor_name', read_only=True, default='')
    wage_type_display = serializers.CharField(source='get_wage_type_display', read_only=True)
    payable_by_display = serializers.CharField(source='get_payable_by_display', read_only=True)
    tds_amount = serializers.SerializerMethodField()
    net_payable = serializers.SerializerMethodField()

    class Meta:
        model = LoadingUnloadingWage
        fields = [
            'id', 'wage_type', 'wage_type_display', 'contractor_vendor',
            'contractor_vendor_name', 'amount', 'tds_applicable', 'payable_by',
            'payable_by_display', 'remarks', 'tds_amount', 'net_payable'
        ]
        extra_kwargs = {
            'wage_type': {'required': False},
            'contractor_vendor': {'required': False, 'allow_null': True},
            'amount': {'required': False, 'default': 0},
            'tds_applicable': {'required': False, 'default': 0},
            'payable_by': {'required': False},
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


class ReceiptFreightAdviceSummarySerializer(serializers.ModelSerializer):
    """Lightweight read-only serializer for freight advices linked to a receipt."""
    transporter_name = serializers.CharField(source='transporter.name', read_only=True, default='')
    freight_type_display = serializers.CharField(source='get_freight_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    freight_terms_display = serializers.CharField(source='get_freight_terms_display', read_only=True)

    class Meta:
        from .models import FreightAdviceInbound
        model = FreightAdviceInbound
        fields = [
            'id', 'advice_no', 'freight_type', 'freight_type_display',
            'transporter', 'transporter_name', 'freight_terms', 'freight_terms_display',
            'base_amount', 'discount', 'payable_amount', 'destination_state',
            'quantity_basis', 'quantity_uom', 'lorry_no',
            'status', 'status_display',
        ]
        read_only_fields = fields


class ReceiptAdviceSerializer(serializers.ModelSerializer):
    """Serializer for receipt advices."""

    receipt_lines = ReceiptLineSerializer(many=True, required=False)
    packing_materials = PackingMaterialLineSerializer(many=True, required=False)
    freight_details = FreightDetailSerializer(many=True, required=False)
    loading_unloading_wages = LoadingUnloadingWageSerializer(many=True, required=False)
    freight_payment_schedules = FreightPaymentScheduleSerializer(
        many=True,
        read_only=True
    )
    freight_advices = ReceiptFreightAdviceSummarySerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default='')
    godown_name = serializers.CharField(source='godown.godown_name', read_only=True, default='')
    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True, default='')
    qc_routing_display = serializers.CharField(source='get_qc_routing_display', read_only=True)
    qc_status_display = serializers.CharField(source='get_qc_status_display', read_only=True)
    total_received = serializers.SerializerMethodField()
    linked_po_numbers = serializers.SerializerMethodField()
    receipt_status = serializers.SerializerMethodField()

    class Meta:
        model = ReceiptAdvice
        fields = [
            'id', 'receipt_advice_no', 'receipt_date', 'warehouse', 'warehouse_name',
            'godown', 'godown_name', 'vendor', 'vendor_name', 'vehicle_number',
            'driver_name', 'qc_routing', 'qc_routing_display', 'qc_status',
            'qc_status_display', 'partial_receipt_flag', 'remarks', 'linked_pos',
            'linked_po_numbers', 'receipt_lines', 'packing_materials', 'freight_details',
            'loading_unloading_wages', 'freight_payment_schedules', 'freight_advices',
            'total_received', 'receipt_status', 'created_at', 'updated_at'
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
            'linked_pos': {'required': False},
        }

    def get_total_received(self, obj):
        return str(obj.get_total_received())

    def get_linked_po_numbers(self, obj):
        return [po.po_no for po in obj.linked_pos.all()]

    def get_receipt_status(self, obj):
        """Compute receipt status based on PO state."""
        linked_pos = obj.linked_pos.all()
        if not linked_pos.exists():
            return 'Full' if not obj.partial_receipt_flag else 'Partial'

        all_closed = all(po.status == 'CLOSED' for po in linked_pos)
        if all_closed:
            return 'Completed'

        return 'Partial' if obj.partial_receipt_flag else 'Full'

    def create(self, validated_data):
        receipt_lines_data = validated_data.pop('receipt_lines', [])
        packing_materials_data = validated_data.pop('packing_materials', [])
        freight_details_data = validated_data.pop('freight_details', [])
        wages_data = validated_data.pop('loading_unloading_wages', [])
        linked_pos = validated_data.pop('linked_pos', [])

        with transaction.atomic():
            receipt = ReceiptAdvice.objects.create(**validated_data)

            if linked_pos:
                receipt.linked_pos.set(linked_pos)

            for line_data in receipt_lines_data:
                line_data.pop('receipt', None)
                ReceiptLine.objects.create(receipt=receipt, **line_data)

            for packing_data in packing_materials_data:
                packing_data.pop('receipt', None)
                PackingMaterialLine.objects.create(receipt=receipt, **packing_data)

            for freight_data in freight_details_data:
                freight_data.pop('receipt', None)
                FreightDetail.objects.create(receipt=receipt, **freight_data)

            for wage_data in wages_data:
                wage_data.pop('receipt', None)
                LoadingUnloadingWage.objects.create(receipt=receipt, **wage_data)

        return receipt

    def update(self, instance, validated_data):
        receipt_lines_data = validated_data.pop('receipt_lines', None)
        packing_materials_data = validated_data.pop('packing_materials', None)
        freight_details_data = validated_data.pop('freight_details', None)
        wages_data = validated_data.pop('loading_unloading_wages', None)
        linked_pos = validated_data.pop('linked_pos', None)

        with transaction.atomic():
            # Update header fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if linked_pos is not None:
                instance.linked_pos.set(linked_pos)

            # Update receipt lines: match by id, create new, delete removed
            if receipt_lines_data is not None:
                existing_lines = {line.id: line for line in instance.receipt_lines.all()}
                incoming_ids = set()

                for line_data in receipt_lines_data:
                    line_data.pop('receipt', None)
                    line_id = line_data.pop('id', None)

                    if line_id and line_id in existing_lines:
                        # Update existing line
                        line_obj = existing_lines[line_id]
                        for attr, value in line_data.items():
                            setattr(line_obj, attr, value)
                        line_obj.save()
                        incoming_ids.add(line_id)
                    else:
                        # Create new line
                        new_line = ReceiptLine.objects.create(receipt=instance, **line_data)
                        incoming_ids.add(new_line.id)

                # Delete lines not in incoming data
                for line_id, line_obj in existing_lines.items():
                    if line_id not in incoming_ids:
                        line_obj.delete()

            # Update packing materials
            if packing_materials_data is not None:
                existing = {obj.id: obj for obj in instance.packing_materials.all()}
                incoming_ids = set()

                for data in packing_materials_data:
                    data.pop('receipt', None)
                    obj_id = data.pop('id', None)
                    if obj_id and obj_id in existing:
                        obj = existing[obj_id]
                        for attr, value in data.items():
                            setattr(obj, attr, value)
                        obj.save()
                        incoming_ids.add(obj_id)
                    else:
                        new_obj = PackingMaterialLine.objects.create(receipt=instance, **data)
                        incoming_ids.add(new_obj.id)

                for obj_id in existing:
                    if obj_id not in incoming_ids:
                        existing[obj_id].delete()

            # Update freight details
            if freight_details_data is not None:
                existing = {obj.id: obj for obj in instance.freight_details.all()}
                incoming_ids = set()

                for data in freight_details_data:
                    data.pop('receipt', None)
                    obj_id = data.pop('id', None)
                    if obj_id and obj_id in existing:
                        obj = existing[obj_id]
                        for attr, value in data.items():
                            setattr(obj, attr, value)
                        obj.save()
                        incoming_ids.add(obj_id)
                    else:
                        new_obj = FreightDetail.objects.create(receipt=instance, **data)
                        incoming_ids.add(new_obj.id)

                for obj_id in existing:
                    if obj_id not in incoming_ids:
                        existing[obj_id].delete()

            # Update loading/unloading wages
            if wages_data is not None:
                existing = {obj.id: obj for obj in instance.loading_unloading_wages.all()}
                incoming_ids = set()

                for data in wages_data:
                    data.pop('receipt', None)
                    obj_id = data.pop('id', None)
                    if obj_id and obj_id in existing:
                        obj = existing[obj_id]
                        for attr, value in data.items():
                            setattr(obj, attr, value)
                        obj.save()
                        incoming_ids.add(obj_id)
                    else:
                        new_obj = LoadingUnloadingWage.objects.create(receipt=instance, **data)
                        incoming_ids.add(new_obj.id)

                for obj_id in existing:
                    if obj_id not in incoming_ids:
                        existing[obj_id].delete()

        instance.refresh_from_db()
        return instance


class FreightAdviceInboundSerializer(serializers.ModelSerializer):
    """Serializer for freight advices."""

    transporter_name = serializers.CharField(
        source='transporter.name',
        read_only=True,
        default=''
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
    freight_terms_display = serializers.CharField(
        source='get_freight_terms_display',
        read_only=True
    )
    receipt_advice_no = serializers.CharField(
        source='receipt_advice.receipt_advice_no',
        read_only=True
    )
    vendor_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    po_numbers = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    total_payable = serializers.SerializerMethodField()
    total_freight_cost = serializers.SerializerMethodField()

    class Meta:
        model = FreightAdviceInbound
        fields = [
            'id', 'advice_no', 'direction', 'receipt_advice', 'receipt_advice_no',
            'transporter', 'transporter_name', 'freight_type', 'freight_type_display',
            'created_by', 'created_by_name', 'created_date', 'base_amount', 'discount',
            'loading_wages_amount', 'unloading_wages_amount', 'other_charges',
            'quantity_basis', 'quantity_uom', 'cost_per_unit_calc', 'destination_state',
            'payable_amount', 'status', 'status_display',
            'lorry_no', 'driver_name', 'driver_contact',
            'dispatch_date', 'expected_arrival_date', 'actual_arrival_date',
            'freight_terms', 'freight_terms_display',
            'transport_document_no', 'delivery_remarks', 'remarks',
            'approved_by', 'approved_by_name', 'approved_at',
            'vendor_name', 'warehouse_name', 'po_numbers',
            'total_payable', 'total_freight_cost',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'advice_no', 'direction', 'created_date', 'created_at', 'updated_at',
            'approved_by', 'approved_at'
        ]
        extra_kwargs = {
            'created_by': {'required': False, 'allow_null': True},
            'transporter': {'required': False, 'allow_null': True},
            'freight_type': {'required': False, 'allow_blank': True},
            'base_amount': {'required': False},
            'payable_amount': {'required': False},
            'discount': {'required': False},
            'loading_wages_amount': {'required': False},
            'unloading_wages_amount': {'required': False},
            'other_charges': {'required': False},
            'quantity_basis': {'required': False},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'cost_per_unit_calc': {'required': False},
            'destination_state': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'lorry_no': {'required': False, 'allow_blank': True},
            'driver_name': {'required': False, 'allow_blank': True},
            'driver_contact': {'required': False, 'allow_blank': True},
            'dispatch_date': {'required': False},
            'expected_arrival_date': {'required': False},
            'actual_arrival_date': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'transport_document_no': {'required': False, 'allow_blank': True},
            'delivery_remarks': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }

    def get_total_payable(self, obj):
        return str(obj.get_total_payable())

    def get_total_freight_cost(self, obj):
        return str(obj.get_total_payable())

    def get_vendor_name(self, obj):
        try:
            return obj.receipt_advice.vendor.name if obj.receipt_advice and obj.receipt_advice.vendor else ''
        except Exception:
            return ''

    def get_warehouse_name(self, obj):
        try:
            return obj.receipt_advice.warehouse.name if obj.receipt_advice and obj.receipt_advice.warehouse else ''
        except Exception:
            return ''

    def get_po_numbers(self, obj):
        try:
            if obj.receipt_advice:
                return list(obj.receipt_advice.linked_pos.values_list('po_number', flat=True))
        except Exception:
            pass
        return []

    def get_approved_by_name(self, obj):
        try:
            if obj.approved_by:
                return obj.approved_by.user.get_full_name()
        except Exception:
            pass
        return ''


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
    prepared_by_name = serializers.SerializerMethodField()
    source_document_type_display = serializers.CharField(
        source='get_source_document_type_display',
        read_only=True,
        default=''
    )
    payment_method_display = serializers.CharField(
        source='get_payment_method_display',
        read_only=True,
        default=''
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    receipt_advice_no = serializers.SerializerMethodField()
    po_numbers = serializers.SerializerMethodField()
    net_payable_amount = serializers.SerializerMethodField()
    balance_amount = serializers.SerializerMethodField()

    class Meta:
        model = VendorPaymentAdvice
        fields = [
            'id', 'advice_no', 'vendor', 'vendor_name',
            'receipt_advice', 'receipt_advice_no',
            'source_document_type', 'source_document_type_display',
            'source_document_id',
            'invoice_no', 'invoice_date',
            'amount', 'tds_amount', 'other_deductions',
            'net_payable_amount', 'paid_amount', 'balance_amount',
            'due_date',
            'payment_method', 'payment_method_display',
            'payment_reference', 'payment_date', 'bank_name', 'transaction_id',
            'prepared_by', 'prepared_by_name',
            'status', 'status_display', 'notes', 'tax_components',
            'po_numbers',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'advice_no', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'source_document_type': {'required': False, 'allow_blank': True},
            'source_document_id': {'required': False, 'allow_null': True},
            'due_date': {'required': False, 'allow_null': True},
            'payment_method': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
            'invoice_no': {'required': False, 'allow_blank': True},
            'invoice_date': {'required': False, 'allow_null': True},
            'tds_amount': {'required': False},
            'other_deductions': {'required': False},
            'paid_amount': {'required': False},
            'payment_reference': {'required': False, 'allow_blank': True},
            'payment_date': {'required': False, 'allow_null': True},
            'bank_name': {'required': False, 'allow_blank': True},
            'transaction_id': {'required': False, 'allow_blank': True},
            'receipt_advice': {'required': False, 'allow_null': True},
            'prepared_by': {'required': False, 'allow_null': True},
        }

    def get_prepared_by_name(self, obj):
        try:
            if obj.prepared_by:
                return obj.prepared_by.user.get_full_name()
        except Exception:
            pass
        return ''

    def get_receipt_advice_no(self, obj):
        try:
            if obj.receipt_advice:
                return obj.receipt_advice.receipt_advice_no
        except Exception:
            pass
        return ''

    def get_po_numbers(self, obj):
        try:
            if obj.receipt_advice:
                return list(
                    obj.receipt_advice.linked_pos.values_list('po_number', flat=True)
                )
        except Exception:
            pass
        return []

    def get_net_payable_amount(self, obj):
        return str(obj.net_payable)

    def get_balance_amount(self, obj):
        return str(obj.balance_amount)


# ──────────────────────────────────────────────────────────────
#  Vendor Bills, Payments Made, Vendor Credits
# ──────────────────────────────────────────────────────────────

class VendorBillLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)

    class Meta:
        from .models import VendorBillLine
        model = VendorBillLine
        fields = [
            'id', 'product', 'product_name', 'description', 'quantity',
            'uom', 'rate', 'discount_percent', 'tax_percent', 'amount',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'discount_percent': {'required': False},
            'tax_percent': {'required': False},
        }


class VendorBillSerializer(serializers.ModelSerializer):
    bill_lines = VendorBillLineSerializer(many=True, required=False)
    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True, default='')
    po_no = serializers.SerializerMethodField()
    receipt_no = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    balance_due = serializers.SerializerMethodField()
    payment_history = serializers.SerializerMethodField()

    class Meta:
        from .models import VendorBill
        model = VendorBill
        fields = [
            'id', 'bill_no', 'vendor', 'vendor_name', 'vendor_invoice_no',
            'bill_date', 'due_date', 'purchase_order', 'po_no',
            'receipt_advice', 'receipt_no',
            'subtotal', 'discount_amount', 'tax_amount', 'tds_amount',
            'shipping_charges', 'adjustment', 'total_amount', 'amount_paid',
            'balance_due', 'status', 'status_display',
            'notes', 'terms_and_conditions',
            'bill_lines', 'payment_history',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'bill_no', 'created_at', 'updated_at']
        extra_kwargs = {
            'vendor_invoice_no': {'required': False, 'allow_blank': True},
            'due_date': {'required': False, 'allow_null': True},
            'purchase_order': {'required': False, 'allow_null': True},
            'receipt_advice': {'required': False, 'allow_null': True},
            'subtotal': {'required': False},
            'discount_amount': {'required': False},
            'tax_amount': {'required': False},
            'tds_amount': {'required': False},
            'shipping_charges': {'required': False},
            'adjustment': {'required': False},
            'total_amount': {'required': False},
            'amount_paid': {'required': False},
            'status': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
            'terms_and_conditions': {'required': False, 'allow_blank': True},
        }

    def get_po_no(self, obj):
        try:
            return obj.purchase_order.po_no if obj.purchase_order else ''
        except Exception:
            return ''

    def get_receipt_no(self, obj):
        try:
            return obj.receipt_advice.receipt_advice_no if obj.receipt_advice else ''
        except Exception:
            return ''

    def get_balance_due(self, obj):
        return str(obj.balance_due)

    def get_payment_history(self, obj):
        from .models import PaymentMade
        payments = PaymentMade.objects.filter(bill=obj).order_by('-payment_date')
        return [{
            'id': str(p.id),
            'payment_no': p.payment_no,
            'payment_date': str(p.payment_date) if p.payment_date else '',
            'amount': str(p.amount),
            'payment_mode': p.payment_mode,
            'reference_no': p.reference_no,
            'status': p.status,
        } for p in payments]

    def create(self, validated_data):
        lines_data = validated_data.pop('bill_lines', [])
        from .models import VendorBill, VendorBillLine
        bill = VendorBill.objects.create(**validated_data)
        for line_data in lines_data:
            VendorBillLine.objects.create(bill=bill, **line_data)
        return bill

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('bill_lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            from .models import VendorBillLine
            instance.bill_lines.all().delete()
            for line_data in lines_data:
                VendorBillLine.objects.create(bill=instance, **line_data)
        return instance


class PaymentMadeSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True, default='')
    bill_no = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_mode_display = serializers.CharField(source='get_payment_mode_display', read_only=True)

    class Meta:
        from .models import PaymentMade
        model = PaymentMade
        fields = [
            'id', 'payment_no', 'vendor', 'vendor_name',
            'payment_date', 'payment_mode', 'payment_mode_display',
            'amount', 'reference_no', 'bank_name',
            'bill', 'bill_no', 'status', 'status_display', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'payment_no', 'created_at', 'updated_at']
        extra_kwargs = {
            'payment_mode': {'required': False},
            'reference_no': {'required': False, 'allow_blank': True},
            'bank_name': {'required': False, 'allow_blank': True},
            'bill': {'required': False, 'allow_null': True},
            'status': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def get_bill_no(self, obj):
        try:
            return obj.bill.bill_no if obj.bill else ''
        except Exception:
            return ''

    def create(self, validated_data):
        from .models import PaymentMade
        payment = PaymentMade.objects.create(**validated_data)
        # Auto-update bill amount_paid and status
        if payment.bill:
            bill = payment.bill
            bill.amount_paid = bill.amount_paid + payment.amount
            if bill.amount_paid >= bill.total_amount:
                bill.status = 'PAID'
            elif bill.amount_paid > 0:
                bill.status = 'PARTIALLY_PAID'
            bill.save(update_fields=['amount_paid', 'status'])
        return payment


class VendorCreditLineSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)

    class Meta:
        from .models import VendorCreditLine
        model = VendorCreditLine
        fields = [
            'id', 'product', 'product_name', 'description', 'quantity',
            'uom', 'rate', 'tax_percent', 'amount',
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'tax_percent': {'required': False},
        }


class VendorCreditSerializer(serializers.ModelSerializer):
    credit_lines = VendorCreditLineSerializer(many=True, required=False)
    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True, default='')
    bill_no = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    credit_type_display = serializers.CharField(source='get_credit_type_display', read_only=True)
    balance = serializers.SerializerMethodField()

    class Meta:
        from .models import VendorCredit
        model = VendorCredit
        fields = [
            'id', 'credit_no', 'vendor', 'vendor_name',
            'credit_date', 'credit_type', 'credit_type_display',
            'reason', 'bill', 'bill_no',
            'subtotal', 'tax_amount', 'total_amount', 'amount_applied',
            'balance', 'status', 'status_display', 'notes',
            'credit_lines',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'credit_no', 'created_at', 'updated_at']
        extra_kwargs = {
            'credit_type': {'required': False},
            'reason': {'required': False, 'allow_blank': True},
            'bill': {'required': False, 'allow_null': True},
            'subtotal': {'required': False},
            'tax_amount': {'required': False},
            'total_amount': {'required': False},
            'amount_applied': {'required': False},
            'status': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }

    def get_bill_no(self, obj):
        try:
            return obj.bill.bill_no if obj.bill else ''
        except Exception:
            return ''

    def get_balance(self, obj):
        return str(obj.balance)

    def create(self, validated_data):
        lines_data = validated_data.pop('credit_lines', [])
        from .models import VendorCredit, VendorCreditLine
        credit = VendorCredit.objects.create(**validated_data)
        for line_data in lines_data:
            VendorCreditLine.objects.create(credit=credit, **line_data)
        return credit

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('credit_lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            from .models import VendorCreditLine
            instance.credit_lines.all().delete()
            for line_data in lines_data:
                VendorCreditLine.objects.create(credit=instance, **line_data)
        return instance
