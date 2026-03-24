"""Serializers for finance application."""

from rest_framework import serializers
from .models import (
    VendorLedger,
    VendorTaxBreakdown,
    PaymentAdviceWorkflow,
    PaymentTDSTCS,
    FinanceManagerApproval,
    OfficeManagerAuthorization,
    BankStatementUpload,
    AutoMatchedEntry,
    BankException,
    CustomerLedger,
    FreightLedger,
    FreightPaymentScheduleEntry,
    WageLedger,
    CreditDebitNote,
    GSTReconciliation,
    GSTAdjustment,
    PettyCashRegister,
    PettyCashTransaction,
)


class VendorTaxBreakdownSerializer(serializers.ModelSerializer):
    """Serializer for VendorTaxBreakdown."""

    class Meta:
        model = VendorTaxBreakdown
        fields = ['id', 'ledger', 'tax_type', 'rate', 'amount']
        extra_kwargs = {
            'tax_type': {'required': False, 'allow_blank': True},
        }


class VendorLedgerSerializer(serializers.ModelSerializer):
    """Serializer for VendorLedger."""

    tax_breakdowns = VendorTaxBreakdownSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)

    class Meta:
        model = VendorLedger
        fields = [
            'id',
            'vendor',
            'vendor_name',
            'document_type',
            'document_reference_id',
            'document_date',
            'debit_amount',
            'credit_amount',
            'due_date',
            'payment_status',
            'ageing_bucket',
            'notes',
            'tax_breakdowns',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'debit_amount': {'required': False},
            'credit_amount': {'required': False},
            'due_date': {'required': False},
            'payment_status': {'required': False, 'allow_blank': True},
            'ageing_bucket': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class PaymentTDSTCSSerializer(serializers.ModelSerializer):
    """Serializer for PaymentTDSTCS."""

    class Meta:
        model = PaymentTDSTCS
        fields = ['id', 'advice', 'tax_type', 'section', 'rate', 'amount']
        extra_kwargs = {
            'tax_type': {'required': False, 'allow_blank': True},
            'section': {'required': False, 'allow_blank': True},
        }


class FinanceManagerApprovalSerializer(serializers.ModelSerializer):
    """Serializer for FinanceManagerApproval."""

    approved_by_name = serializers.CharField(
        source='approved_by.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = FinanceManagerApproval
        fields = ['id', 'advice', 'approved_by', 'approved_by_name', 'approval_date', 'remarks']
        read_only_fields = ['id', 'approval_date']
        extra_kwargs = {
            'remarks': {'required': False, 'allow_blank': True},
        }


class OfficeManagerAuthorizationSerializer(serializers.ModelSerializer):
    """Serializer for OfficeManagerAuthorization."""

    authorized_by_name = serializers.CharField(
        source='authorized_by.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = OfficeManagerAuthorization
        fields = [
            'id',
            'advice',
            'authorized_by',
            'authorized_by_name',
            'authorization_date',
            'remarks'
        ]
        read_only_fields = ['id', 'authorization_date']
        extra_kwargs = {
            'remarks': {'required': False, 'allow_blank': True},
        }


class PaymentAdviceWorkflowSerializer(serializers.ModelSerializer):
    """Serializer for PaymentAdviceWorkflow."""

    tax_deductions = PaymentTDSTCSSerializer(many=True, read_only=True)
    finance_approval = FinanceManagerApprovalSerializer(read_only=True)
    office_authorization = OfficeManagerAuthorizationSerializer(read_only=True)
    prepared_by_name = serializers.CharField(
        source='prepared_by.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = PaymentAdviceWorkflow
        fields = [
            'id',
            'advice_no',
            'beneficiary_type',
            'beneficiary_id',
            'source_document_id',
            'amount',
            'due_date',
            'payment_method',
            'prepared_by',
            'prepared_by_name',
            'prepared_date',
            'payment_status',
            'payment_reference',
            'notes',
            'tax_deductions',
            'finance_approval',
            'office_authorization',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'advice_no', 'prepared_date', 'created_at', 'updated_at']
        extra_kwargs = {
            'payment_method': {'required': False, 'allow_blank': True},
            'payment_status': {'required': False, 'allow_blank': True},
            'payment_reference': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class AutoMatchedEntrySerializer(serializers.ModelSerializer):
    """Serializer for AutoMatchedEntry."""

    class Meta:
        model = AutoMatchedEntry
        fields = [
            'id',
            'upload',
            'statement_line_id',
            'match_type',
            'linked_document_id',
            'amount',
            'status',
        ]
        extra_kwargs = {
            'statement_line_id': {'required': False, 'allow_blank': True},
            'match_type': {'required': False, 'allow_blank': True},
            'status': {'required': False, 'allow_blank': True},
        }


class BankExceptionSerializer(serializers.ModelSerializer):
    """Serializer for BankException."""

    class Meta:
        model = BankException
        fields = [
            'id',
            'upload',
            'statement_line_id',
            'transaction_date',
            'amount',
            'suggested_match_id',
            'exception_notes',
            'resolution_status',
        ]
        extra_kwargs = {
            'statement_line_id': {'required': False, 'allow_blank': True},
            'suggested_match_id': {'required': False},
            'exception_notes': {'required': False, 'allow_blank': True},
            'resolution_status': {'required': False, 'allow_blank': True},
        }


class BankStatementUploadSerializer(serializers.ModelSerializer):
    """Serializer for BankStatementUpload."""

    matched_entries = AutoMatchedEntrySerializer(many=True, read_only=True)
    exceptions = BankExceptionSerializer(many=True, read_only=True)

    class Meta:
        model = BankStatementUpload
        fields = [
            'id',
            'bank_account',
            'statement_period_start',
            'statement_period_end',
            'upload_date',
            'statement_file',
            'parsing_status',
            'remarks',
            'matched_entries',
            'exceptions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'upload_date', 'created_at', 'updated_at']
        extra_kwargs = {
            'parsing_status': {'required': False, 'allow_blank': True},
            'remarks': {'required': False, 'allow_blank': True},
        }


class CustomerLedgerSerializer(serializers.ModelSerializer):
    """Serializer for CustomerLedger."""

    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = CustomerLedger
        fields = [
            'id',
            'customer',
            'customer_name',
            'document_type',
            'document_reference_id',
            'document_date',
            'debit_amount',
            'credit_amount',
            'due_date',
            'payment_status',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'debit_amount': {'required': False},
            'credit_amount': {'required': False},
            'due_date': {'required': False},
            'payment_status': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class FreightPaymentScheduleEntrySerializer(serializers.ModelSerializer):
    """Serializer for FreightPaymentScheduleEntry."""

    class Meta:
        model = FreightPaymentScheduleEntry
        fields = ['id', 'ledger', 'due_date', 'amount', 'paid']
        extra_kwargs = {
            'paid': {'required': False},
        }


class FreightLedgerSerializer(serializers.ModelSerializer):
    """Serializer for FreightLedger."""

    payment_schedule = FreightPaymentScheduleEntrySerializer(many=True, read_only=True)
    transporter_name = serializers.CharField(source='transporter.name', read_only=True)

    class Meta:
        model = FreightLedger
        fields = [
            'id',
            'direction',
            'transporter',
            'transporter_name',
            'freight_advice_id',
            'amount',
            'discount',
            'shipment_quantity',
            'quantity_uom',
            'cost_per_unit',
            'destination_state',
            'amount_paid',
            'balance',
            'reminder_flag',
            'notes',
            'payment_schedule',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'discount': {'required': False},
            'shipment_quantity': {'required': False},
            'quantity_uom': {'required': False, 'allow_blank': True},
            'cost_per_unit': {'required': False},
            'destination_state': {'required': False, 'allow_blank': True},
            'amount_paid': {'required': False},
            'balance': {'required': False},
            'notes': {'required': False, 'allow_blank': True},
        }


class WageLedgerSerializer(serializers.ModelSerializer):
    """Serializer for WageLedger."""

    class Meta:
        model = WageLedger
        fields = [
            'id',
            'wage_voucher_id',
            'wage_voucher_type',
            'contractor_staff_group_id',
            'amount',
            'tds',
            'payment_week',
            'approval_status',
            'settlement_method',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'wage_voucher_type': {'required': False, 'allow_blank': True},
            'tds': {'required': False},
            'payment_week': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
            'settlement_method': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class CreditDebitNoteSerializer(serializers.ModelSerializer):
    """Serializer for CreditDebitNote."""

    approved_by_name = serializers.CharField(
        source='approved_by.user.get_full_name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = CreditDebitNote
        fields = [
            'id',
            'note_no',
            'note_type',
            'vendor_customer_id',
            'source_document_id',
            'amount',
            'tax',
            'reason',
            'approval_status',
            'approved_by',
            'approved_by_name',
            'approval_date',
            'ledger_posting_reference_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'note_no', 'created_at', 'updated_at']
        extra_kwargs = {
            'tax': {'required': False},
            'reason': {'required': False, 'allow_blank': True},
            'approval_status': {'required': False, 'allow_blank': True},
            'approved_by': {'required': False},
            'approval_date': {'required': False},
            'ledger_posting_reference_id': {'required': False},
        }


class GSTAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer for GSTAdjustment."""

    class Meta:
        model = GSTAdjustment
        fields = [
            'id',
            'report',
            'adjustment_type',
            'amount',
            'notes',
            'approved_by',
        ]
        extra_kwargs = {
            'notes': {'required': False, 'allow_blank': True},
            'approved_by': {'required': False},
        }


class GSTReconciliationSerializer(serializers.ModelSerializer):
    """Serializer for GSTReconciliation."""

    adjustments = GSTAdjustmentSerializer(many=True, read_only=True)

    class Meta:
        model = GSTReconciliation
        fields = [
            'id',
            'report_id',
            'reporting_period_start',
            'reporting_period_end',
            'data_source',
            'variance_summary',
            'export_file',
            'adjustments',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'report_id', 'created_at', 'updated_at']
        extra_kwargs = {
            'variance_summary': {'required': False, 'allow_blank': True},
            'export_file': {'required': False},
        }


class PettyCashTransactionSerializer(serializers.ModelSerializer):
    """Serializer for PettyCashTransaction."""

    class Meta:
        model = PettyCashTransaction
        fields = [
            'id',
            'register',
            'transaction_date',
            'voucher_reference_id',
            'voucher_reference_type',
            'amount',
            'type',
            'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'voucher_reference_type': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class PettyCashRegisterSerializer(serializers.ModelSerializer):
    """Serializer for PettyCashRegister."""

    transactions = PettyCashTransactionSerializer(many=True, read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    coordinator_name = serializers.CharField(
        source='coordinator.user.get_full_name',
        read_only=True
    )

    class Meta:
        model = PettyCashRegister
        fields = [
            'id',
            'warehouse',
            'warehouse_name',
            'coordinator',
            'coordinator_name',
            'opening_balance',
            'current_balance',
            'last_reconciled_date',
            'transactions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'current_balance': {'required': False},
            'last_reconciled_date': {'required': False},
        }
