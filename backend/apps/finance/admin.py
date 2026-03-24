"""Django admin configuration for finance application."""

from django.contrib import admin
from django.utils.html import format_html
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


class VendorTaxBreakdownInline(admin.TabularInline):
    """Inline admin for VendorTaxBreakdown."""

    model = VendorTaxBreakdown
    extra = 0


@admin.register(VendorLedger)
class VendorLedgerAdmin(admin.ModelAdmin):
    """Admin for VendorLedger."""

    list_display = [
        'vendor',
        'document_type',
        'document_date',
        'debit_amount',
        'credit_amount',
        'status_badge',
        'due_date',
    ]
    list_filter = [
        'document_type',
        'payment_status',
        'document_date',
        'due_date',
    ]
    search_fields = ['vendor__name', 'document_reference_id']
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
        'created_by',
        'updated_by',
    ]
    inlines = [VendorTaxBreakdownInline]

    def status_badge(self, obj):
        """Display payment status with color."""
        colors = {
            'NOT_DUE': 'blue',
            'PARTIALLY_PAID': 'orange',
            'PAID': 'green',
            'OVERDUE': 'red',
        }
        color = colors.get(obj.payment_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_payment_status_display()
        )
    status_badge.short_description = 'Payment Status'


@admin.register(CustomerLedger)
class CustomerLedgerAdmin(admin.ModelAdmin):
    """Admin for CustomerLedger."""

    list_display = [
        'customer',
        'document_type',
        'document_date',
        'debit_amount',
        'credit_amount',
        'status_badge',
        'due_date',
    ]
    list_filter = [
        'document_type',
        'payment_status',
        'document_date',
        'due_date',
    ]
    search_fields = ['customer__name', 'document_reference_id']
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
    ]

    def status_badge(self, obj):
        """Display payment status with color."""
        colors = {
            'NOT_DUE': 'blue',
            'PARTIALLY_PAID': 'orange',
            'PAID': 'green',
            'OVERDUE': 'red',
        }
        color = colors.get(obj.payment_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_payment_status_display()
        )
    status_badge.short_description = 'Payment Status'


class PaymentTDSTCSInline(admin.TabularInline):
    """Inline admin for PaymentTDSTCS."""

    model = PaymentTDSTCS
    extra = 0


@admin.register(PaymentAdviceWorkflow)
class PaymentAdviceWorkflowAdmin(admin.ModelAdmin):
    """Admin for PaymentAdviceWorkflow."""

    list_display = [
        'advice_no',
        'beneficiary_type',
        'amount',
        'due_date',
        'status_badge',
        'payment_method',
    ]
    list_filter = [
        'beneficiary_type',
        'payment_status',
        'payment_method',
        'prepared_date',
    ]
    search_fields = ['advice_no', 'beneficiary_id']
    readonly_fields = [
        'id',
        'advice_no',
        'prepared_date',
        'created_at',
        'updated_at',
    ]
    inlines = [PaymentTDSTCSInline]

    def status_badge(self, obj):
        """Display payment status with color."""
        colors = {
            'DRAFT': 'gray',
            'PENDING_FINANCE': 'orange',
            'PENDING_AUTHORIZATION': 'blue',
            'APPROVED': 'lightgreen',
            'PAID': 'green',
        }
        color = colors.get(obj.payment_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_payment_status_display()
        )
    status_badge.short_description = 'Payment Status'


@admin.register(BankStatementUpload)
class BankStatementUploadAdmin(admin.ModelAdmin):
    """Admin for BankStatementUpload."""

    list_display = [
        'bank_account',
        'statement_period_start',
        'statement_period_end',
        'status_badge',
        'upload_date',
    ]
    list_filter = [
        'bank_account',
        'parsing_status',
        'upload_date',
    ]
    search_fields = ['bank_account']
    readonly_fields = [
        'id',
        'upload_date',
        'created_at',
        'updated_at',
    ]

    def status_badge(self, obj):
        """Display parsing status."""
        colors = {
            'PENDING': 'orange',
            'PARSED': 'green',
            'ERROR': 'red',
        }
        color = colors.get(obj.parsing_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_parsing_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(FreightLedger)
class FreightLedgerAdmin(admin.ModelAdmin):
    """Admin for FreightLedger."""

    list_display = [
        'transporter',
        'direction',
        'amount',
        'discount',
        'balance',
        'created_at',
    ]
    list_filter = [
        'direction',
        'created_at',
    ]
    search_fields = ['transporter__name']
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
    ]


@admin.register(WageLedger)
class WageLedgerAdmin(admin.ModelAdmin):
    """Admin for WageLedger."""

    list_display = [
        'wage_voucher_id',
        'amount',
        'tds',
        'payment_week',
        'status_badge',
    ]
    list_filter = [
        'approval_status',
        'payment_week',
    ]
    search_fields = ['wage_voucher_id']
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
    ]

    def status_badge(self, obj):
        """Display approval status."""
        colors = {
            'DRAFT': 'gray',
            'PENDING': 'orange',
            'APPROVED': 'green',
            'PAID': 'darkgreen',
        }
        color = colors.get(obj.approval_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_approval_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(CreditDebitNote)
class CreditDebitNoteAdmin(admin.ModelAdmin):
    """Admin for CreditDebitNote."""

    list_display = [
        'note_no',
        'note_type_badge',
        'amount',
        'tax',
        'approval_badge',
    ]
    list_filter = [
        'note_type',
        'approval_status',
        'created_at',
    ]
    search_fields = ['note_no']
    readonly_fields = [
        'id',
        'note_no',
        'created_at',
        'updated_at',
    ]

    def note_type_badge(self, obj):
        """Display note type."""
        color = 'green' if obj.note_type == 'CREDIT' else 'red'
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_note_type_display()
        )
    note_type_badge.short_description = 'Type'

    def approval_badge(self, obj):
        """Display approval status."""
        colors = {
            'DRAFT': 'gray',
            'PENDING': 'orange',
            'APPROVED': 'green',
        }
        color = colors.get(obj.approval_status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; '
            'border-radius: 3px;">{}</span>',
            color,
            obj.get_approval_status_display()
        )
    approval_badge.short_description = 'Approval'


class GSTAdjustmentInline(admin.TabularInline):
    """Inline admin for GSTAdjustment."""

    model = GSTAdjustment
    extra = 0


@admin.register(GSTReconciliation)
class GSTReconciliationAdmin(admin.ModelAdmin):
    """Admin for GSTReconciliation."""

    list_display = [
        'report_id',
        'reporting_period_start',
        'reporting_period_end',
        'data_source',
        'created_at',
    ]
    list_filter = [
        'data_source',
        'reporting_period_end',
    ]
    search_fields = ['report_id']
    readonly_fields = [
        'id',
        'report_id',
        'created_at',
        'updated_at',
    ]
    inlines = [GSTAdjustmentInline]


class PettyCashTransactionInline(admin.TabularInline):
    """Inline admin for PettyCashTransaction."""

    model = PettyCashTransaction
    extra = 0
    readonly_fields = ['transaction_date', 'created_at']


@admin.register(PettyCashRegister)
class PettyCashRegisterAdmin(admin.ModelAdmin):
    """Admin for PettyCashRegister."""

    list_display = [
        'warehouse',
        'coordinator',
        'opening_balance',
        'current_balance',
        'last_reconciled_date',
    ]
    search_fields = ['warehouse__name', 'coordinator__user__username']
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
    ]
    inlines = [PettyCashTransactionInline]
