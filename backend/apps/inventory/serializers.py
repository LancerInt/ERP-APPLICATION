"""Serializers for inventory application."""

from rest_framework import serializers
from .models import (
    InventoryLedger,
    StockTransferDC,
    TransferLine,
    StockTransferReceipt,
    TransferReceiptLine,
    TransferFreightDetail,
    TransferLoadingUnloadingWage,
    WarehouseShifting,
    ShiftingProduct,
    ShiftingFreightWageDraft,
    JobWorkOrder,
    MaterialSupplied,
    OutputExpected,
    JobWorkDC,
    IssuedMaterial,
    JobWorkReceipt,
    ReturnedGood,
    JobWorkCharge,
    SalesReturnAdvice,
    ReturnLine,
    ReturnFreightCharge,
    ReturnLoadingUnloadingCharge,
    ReturnApprovalTrail,
    StockAdjustment,
)


class InventoryLedgerSerializer(serializers.ModelSerializer):
    """Serializer for InventoryLedger."""

    warehouse_name = serializers.CharField(
        source='warehouse.name',
        read_only=True
    )
    godown_name = serializers.CharField(
        source='godown.name',
        read_only=True
    )
    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = InventoryLedger
        fields = [
            'id',
            'ledger_entry_id',
            'transaction_date',
            'warehouse',
            'warehouse_name',
            'godown',
            'godown_name',
            'product',
            'product_name',
            'batch',
            'quantity_in',
            'quantity_out',
            'uom',
            'transaction_type',
            'source_document_type',
            'source_document_id',
            'cost',
            'status',
            'fifo_layer_id',
            'remarks',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'ledger_entry_id',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'quantity_in': {'required': False},
            'quantity_out': {'required': False},
            'uom': {'required': False, 'allow_blank': True},
            'source_document_type': {'required': False, 'allow_blank': True},
            'cost': {'required': False},
            'status': {'required': False, 'allow_blank': True},
            'fifo_layer_id': {'required': False},
            'remarks': {'required': False, 'allow_blank': True},
        }


class TransferLineSerializer(serializers.ModelSerializer):
    """Serializer for TransferLine."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = TransferLine
        fields = [
            'id',
            'transfer',
            'product',
            'product_name',
            'batch',
            'quantity',
            'uom',
            'source_godown',
            'destination_godown',
        ]
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
        }


class StockTransferDCSerializer(serializers.ModelSerializer):
    """Serializer for StockTransferDC."""

    lines = TransferLineSerializer(many=True, read_only=True)
    from_warehouse_name = serializers.CharField(
        source='from_warehouse.name',
        read_only=True
    )
    to_warehouse_name = serializers.CharField(
        source='to_warehouse.name',
        read_only=True
    )

    class Meta:
        model = StockTransferDC
        fields = [
            'id',
            'transfer_no',
            'created_date',
            'from_warehouse',
            'from_warehouse_name',
            'to_warehouse',
            'to_warehouse_name',
            'dispatch_date',
            'transporter',
            'freight_terms',
            'loading_wages',
            'freight_amount',
            'status',
            'lines',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'transfer_no',
            'created_date',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'dispatch_date': {'required': False},
            'transporter': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'loading_wages': {'required': False},
            'freight_amount': {'required': False},
            'status': {'required': False, 'allow_blank': True},
        }


class TransferReceiptLineSerializer(serializers.ModelSerializer):
    """Serializer for TransferReceiptLine."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = TransferReceiptLine
        fields = [
            'id',
            'receipt',
            'product',
            'product_name',
            'batch',
            'quantity_dispatched',
            'quantity_received',
            'uom',
            'received_godown',
            'condition',
        ]
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'condition': {'required': False, 'allow_blank': True},
        }


class TransferFreightDetailSerializer(serializers.ModelSerializer):
    """Serializer for TransferFreightDetail."""

    class Meta:
        model = TransferFreightDetail
        fields = [
            'id',
            'receipt',
            'charge_type',
            'amount',
        ]
        extra_kwargs = {
            'charge_type': {'required': False, 'allow_blank': True},
        }


class TransferLoadingUnloadingWageSerializer(serializers.ModelSerializer):
    """Serializer for TransferLoadingUnloadingWage."""

    class Meta:
        model = TransferLoadingUnloadingWage
        fields = [
            'id',
            'receipt',
            'charge_type',
            'amount',
        ]
        extra_kwargs = {
            'charge_type': {'required': False, 'allow_blank': True},
        }


class StockTransferReceiptSerializer(serializers.ModelSerializer):
    """Serializer for StockTransferReceipt."""

    lines = TransferReceiptLineSerializer(many=True, read_only=True)
    freight_details = TransferFreightDetailSerializer(many=True, read_only=True)
    loading_unloading_wages = TransferLoadingUnloadingWageSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = StockTransferReceipt
        fields = [
            'id',
            'receipt_no',
            'receipt_date',
            'from_warehouse',
            'to_warehouse',
            'linked_transfer',
            'received_by',
            'qc_result',
            'variance_notes',
            'status',
            'lines',
            'freight_details',
            'loading_unloading_wages',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'receipt_no',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'qc_result': {'required': False, 'allow_blank': True},
            'variance_notes': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }


class ShiftingProductSerializer(serializers.ModelSerializer):
    """Serializer for ShiftingProduct."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = ShiftingProduct
        fields = [
            'id',
            'shifting',
            'product',
            'product_name',
            'batch',
            'quantity',
            'uom',
        ]
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
        }


class ShiftingFreightWageDraftSerializer(serializers.ModelSerializer):
    """Serializer for ShiftingFreightWageDraft."""

    class Meta:
        model = ShiftingFreightWageDraft
        fields = [
            'id',
            'shifting',
            'expense_type',
            'vendor',
            'amount',
            'payable_by',
            'approval_status',
        ]
        extra_kwargs = {
            'expense_type': {'required': False, 'allow_blank': True},
            'vendor': {'required': False},
            'payable_by': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
        }


class WarehouseShiftingSerializer(serializers.ModelSerializer):
    """Serializer for WarehouseShifting."""

    products = ShiftingProductSerializer(many=True, read_only=True)
    freight_wages = ShiftingFreightWageDraftSerializer(many=True, read_only=True)

    class Meta:
        model = WarehouseShifting
        fields = [
            'id',
            'shifting_no',
            'warehouse',
            'request_date',
            'from_godown',
            'to_godown',
            'reason_code',
            'other_reason',
            'status',
            'in_transit_flag',
            'products',
            'freight_wages',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'shifting_no',
            'request_date',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'reason_code': {'required': False, 'allow_blank': True},
            'other_reason': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }


class MaterialSuppliedSerializer(serializers.ModelSerializer):
    """Serializer for MaterialSupplied."""

    class Meta:
        model = MaterialSupplied
        fields = [
            'id',
            'order',
            'material_type',
            'product_machine_id',
            'product_machine_type',
            'batch',
            'quantity',
            'uom',
        ]
        extra_kwargs = {
            'product_machine_type': {'required': False, 'allow_blank': True},
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
        }


class OutputExpectedSerializer(serializers.ModelSerializer):
    """Serializer for OutputExpected."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = OutputExpected
        fields = [
            'id',
            'order',
            'product',
            'product_name',
            'expected_quantity',
            'uom',
            'expected_batch_suffix',
        ]
        extra_kwargs = {
            'uom': {'required': False, 'allow_blank': True},
            'expected_batch_suffix': {'required': False, 'allow_blank': True},
        }


class JobWorkOrderSerializer(serializers.ModelSerializer):
    """Serializer for JobWorkOrder."""

    materials_supplied = MaterialSuppliedSerializer(many=True, read_only=True)
    outputs_expected = OutputExpectedSerializer(many=True, read_only=True)

    class Meta:
        model = JobWorkOrder
        fields = [
            'id',
            'order_no',
            'warehouse',
            'vendor',
            'template',
            'template_revision',
            'start_date',
            'expected_completion_date',
            'turnaround_threshold',
            'status',
            'alerts_enabled',
            'materials_supplied',
            'outputs_expected',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'order_no',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'template': {'required': False},
            'template_revision': {'required': False},
            'expected_completion_date': {'required': False},
            'turnaround_threshold': {'required': False},
            'status': {'required': False, 'allow_blank': True},
        }


class IssuedMaterialSerializer(serializers.ModelSerializer):
    """Serializer for IssuedMaterial."""

    class Meta:
        model = IssuedMaterial
        fields = [
            'id',
            'dc',
            'material_type',
            'product_machine_id',
            'product_machine_type',
            'batch',
            'quantity',
            'uom',
            'expected_return_date',
        ]
        extra_kwargs = {
            'product_machine_type': {'required': False, 'allow_blank': True},
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'expected_return_date': {'required': False},
        }


class JobWorkDCSerializer(serializers.ModelSerializer):
    """Serializer for JobWorkDC."""

    issued_materials = IssuedMaterialSerializer(many=True, read_only=True)

    class Meta:
        model = JobWorkDC
        fields = [
            'id',
            'jw_dc_no',
            'job_work_order',
            'vendor',
            'dispatch_date',
            'transporter',
            'freight_terms',
            'status',
            'issued_materials',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'jw_dc_no',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'transporter': {'required': False},
            'freight_terms': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }


class ReturnedGoodSerializer(serializers.ModelSerializer):
    """Serializer for ReturnedGood."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = ReturnedGood
        fields = [
            'id',
            'receipt',
            'product',
            'product_name',
            'batch',
            'quantity_received',
            'uom',
            'viability',
        ]
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'viability': {'required': False, 'allow_blank': True},
        }


class JobWorkChargeSerializer(serializers.ModelSerializer):
    """Serializer for JobWorkCharge."""

    class Meta:
        model = JobWorkCharge
        fields = [
            'id',
            'receipt',
            'charge_type',
            'amount',
            'tds',
            'payable_by',
        ]
        extra_kwargs = {
            'tds': {'required': False},
            'payable_by': {'required': False, 'allow_blank': True},
        }


class JobWorkReceiptSerializer(serializers.ModelSerializer):
    """Serializer for JobWorkReceipt."""

    returned_goods = ReturnedGoodSerializer(many=True, read_only=True)
    charges = JobWorkChargeSerializer(many=True, read_only=True)

    class Meta:
        model = JobWorkReceipt
        fields = [
            'id',
            'receipt_no',
            'receipt_date',
            'job_work_order',
            'jw_dc_reference',
            'vendor',
            'new_batch_id',
            'qc_result',
            'pending_quantity',
            'status',
            'returned_goods',
            'charges',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'receipt_no',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'jw_dc_reference': {'required': False},
            'new_batch_id': {'required': False, 'allow_blank': True},
            'qc_result': {'required': False, 'allow_blank': True},
            'pending_quantity': {'required': False},
            'status': {'required': False, 'allow_blank': True},
        }


class ReturnLineSerializer(serializers.ModelSerializer):
    """Serializer for ReturnLine."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = ReturnLine
        fields = [
            'id',
            'return_advice',
            'product',
            'product_name',
            'batch',
            'quantity_returned',
            'uom',
            'condition',
            'viability_notes',
            'packing_material_captured',
        ]
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'condition': {'required': False, 'allow_blank': True},
            'viability_notes': {'required': False, 'allow_blank': True},
            'packing_material_captured': {'required': False},
        }


class ReturnFreightChargeSerializer(serializers.ModelSerializer):
    """Serializer for ReturnFreightCharge."""

    class Meta:
        model = ReturnFreightCharge
        fields = [
            'id',
            'return_advice',
            'freight_type',
            'transporter',
            'amount',
            'discount',
            'payable_by',
        ]
        extra_kwargs = {
            'freight_type': {'required': False, 'allow_blank': True},
            'transporter': {'required': False},
            'discount': {'required': False},
            'payable_by': {'required': False, 'allow_blank': True},
        }


class ReturnLoadingUnloadingChargeSerializer(serializers.ModelSerializer):
    """Serializer for ReturnLoadingUnloadingCharge."""

    class Meta:
        model = ReturnLoadingUnloadingCharge
        fields = [
            'id',
            'return_advice',
            'charge_type',
            'contractor_vendor',
            'amount',
            'tds',
            'payable_by',
        ]
        extra_kwargs = {
            'charge_type': {'required': False, 'allow_blank': True},
            'contractor_vendor': {'required': False},
            'tds': {'required': False},
            'payable_by': {'required': False, 'allow_blank': True},
        }


class ReturnApprovalTrailSerializer(serializers.ModelSerializer):
    """Serializer for ReturnApprovalTrail."""

    actor_name = serializers.CharField(
        source='actor.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = ReturnApprovalTrail
        fields = [
            'id',
            'return_advice',
            'actor',
            'actor_name',
            'action',
            'action_date',
            'remarks',
        ]
        extra_kwargs = {
            'action': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }


class SalesReturnAdviceSerializer(serializers.ModelSerializer):
    """Serializer for SalesReturnAdvice."""

    lines = ReturnLineSerializer(many=True, read_only=True)
    freight_charges = ReturnFreightChargeSerializer(many=True, read_only=True)
    loading_unloading_charges = ReturnLoadingUnloadingChargeSerializer(
        many=True,
        read_only=True
    )
    approval_trails = ReturnApprovalTrailSerializer(many=True, read_only=True)

    class Meta:
        model = SalesReturnAdvice
        fields = [
            'id',
            'return_no',
            'return_date',
            'customer',
            'original_invoice',
            'returned_by',
            'received_warehouse',
            'freight_terms',
            'qc_requirement',
            'approval_status',
            'remarks',
            'lines',
            'freight_charges',
            'loading_unloading_charges',
            'approval_trails',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'return_no',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'original_invoice': {'required': False},
            'returned_by': {'required': False, 'allow_blank': True},
            'freight_terms': {'required': False, 'allow_blank': True},
            'qc_requirement': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }


class StockAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer for StockAdjustment."""

    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.user.get_full_name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = StockAdjustment
        fields = [
            'id',
            'adjustment_no',
            'adjustment_date',
            'warehouse',
            'godown',
            'product',
            'product_name',
            'batch',
            'adjustment_type',
            'quantity',
            'uom',
            'reason_code',
            'other_reason',
            'value_impact',
            'finance_review_required',
            'approval_status',
            'approved_by',
            'approved_by_name',
            'approval_date',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'adjustment_no',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'batch': {'required': False, 'allow_blank': True},
            'uom': {'required': False, 'allow_blank': True},
            'other_reason': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
            'approved_by': {'required': False},
            'approval_date': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }
