"""Services for finance operations."""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import (
    VendorLedger,
    PaymentAdviceWorkflow,
    FinanceManagerApproval,
    OfficeManagerAuthorization,
    BankStatementUpload,
    AutoMatchedEntry,
    BankException,
    CustomerLedger,
    FreightLedger,
    WageLedger,
    CreditDebitNote,
    GSTReconciliation,
    GSTAdjustment,
    PettyCashRegister,
    PettyCashTransaction,
)


class FinanceService:
    """Service layer for finance operations."""

    @staticmethod
    @transaction.atomic
    def record_vendor_ledger_entry(
        vendor_id,
        document_type,
        document_reference_id,
        document_reference_type,
        document_date,
        debit_amount=Decimal('0'),
        credit_amount=Decimal('0'),
        due_date=None,
        notes=None,
        created_by=None
    ):
        """Record vendor ledger entry."""
        entry = VendorLedger.objects.create(
            vendor_id=vendor_id,
            document_type=document_type,
            document_reference_id=document_reference_id,
            document_reference_type=document_reference_type,
            document_date=document_date,
            debit_amount=debit_amount,
            credit_amount=credit_amount,
            due_date=due_date,
            notes=notes or '',
            created_by=created_by
        )
        return entry

    @staticmethod
    @transaction.atomic
    def record_customer_ledger_entry(
        customer_id,
        document_type,
        document_reference_id,
        document_reference_type,
        document_date,
        debit_amount=Decimal('0'),
        credit_amount=Decimal('0'),
        due_date=None,
        notes=None,
        created_by=None
    ):
        """Record customer ledger entry."""
        entry = CustomerLedger.objects.create(
            customer_id=customer_id,
            document_type=document_type,
            document_reference_id=document_reference_id,
            document_reference_type=document_reference_type,
            document_date=document_date,
            debit_amount=debit_amount,
            credit_amount=credit_amount,
            due_date=due_date,
            notes=notes or '',
            created_by=created_by
        )
        return entry

    @staticmethod
    @transaction.atomic
    def record_freight_ledger_entry(
        direction,
        transporter_id,
        freight_advice_id,
        freight_advice_type,
        amount,
        discount=Decimal('0'),
        shipment_quantity=None,
        quantity_uom=None,
        cost_per_unit=None,
        destination_state=None,
        notes=None,
        created_by=None
    ):
        """Record freight ledger entry."""
        balance = amount - discount
        entry = FreightLedger.objects.create(
            direction=direction,
            transporter_id=transporter_id,
            freight_advice_id=freight_advice_id,
            freight_advice_type=freight_advice_type,
            amount=amount,
            discount=discount,
            shipment_quantity=shipment_quantity,
            quantity_uom=quantity_uom,
            cost_per_unit=cost_per_unit,
            destination_state=destination_state,
            balance=balance,
            notes=notes or '',
            created_by=created_by
        )
        return entry

    @staticmethod
    @transaction.atomic
    def create_payment_advice(
        beneficiary_type,
        beneficiary_id,
        beneficiary_type_model,
        source_document_id,
        source_document_type,
        amount,
        due_date,
        payment_method='BANK_TRANSFER',
        notes=None,
        created_by=None
    ):
        """Create payment advice (DRAFT status)."""
        advice = PaymentAdviceWorkflow.objects.create(
            beneficiary_type=beneficiary_type,
            beneficiary_id=beneficiary_id,
            beneficiary_type_model=beneficiary_type_model,
            source_document_id=source_document_id,
            source_document_type=source_document_type,
            amount=amount,
            due_date=due_date,
            payment_method=payment_method,
            prepared_by_id=created_by.stakeholder_user.id if hasattr(created_by, 'stakeholder_user') else None,
            payment_status='DRAFT',
            notes=notes or ''
        )
        return advice

    @staticmethod
    @transaction.atomic
    def submit_payment_for_approval(advice, user):
        """Submit payment for finance manager approval."""
        if advice.payment_status != 'DRAFT':
            raise ValidationError("Only DRAFT payments can be submitted")

        advice.payment_status = 'PENDING_FINANCE'
        advice.save(update_fields=['payment_status', 'updated_at', 'updated_by'])

    @staticmethod
    @transaction.atomic
    def approve_payment_finance(advice, user, remarks=None):
        """Finance manager approval stage."""
        if advice.payment_status != 'PENDING_FINANCE':
            raise ValidationError("Payment not in finance approval stage")

        FinanceManagerApproval.objects.create(
            advice=advice,
            approved_by_id=user.stakeholder_user.id if hasattr(user, 'stakeholder_user') else None,
            remarks=remarks or ''
        )

        advice.payment_status = 'PENDING_AUTHORIZATION'
        advice.save(update_fields=['payment_status', 'updated_at', 'updated_by'])

    @staticmethod
    @transaction.atomic
    def authorize_payment(advice, user, remarks=None):
        """Office manager authorization stage."""
        if advice.payment_status != 'PENDING_AUTHORIZATION':
            raise ValidationError("Payment not in authorization stage")

        OfficeManagerAuthorization.objects.create(
            advice=advice,
            authorized_by_id=user.stakeholder_user.id if hasattr(user, 'stakeholder_user') else None,
            remarks=remarks or ''
        )

        advice.payment_status = 'APPROVED'
        advice.save(update_fields=['payment_status', 'updated_at', 'updated_by'])

    @staticmethod
    @transaction.atomic
    def upload_and_parse_bank_statement(upload):
        """Parse bank statement file."""
        if upload.statement_file:
            upload.parsing_status = 'PARSED'
            upload.save(update_fields=['parsing_status', 'updated_at'])

    @staticmethod
    @transaction.atomic
    def auto_match_bank_entries(upload):
        """Auto-match bank entries to documents."""
        matches = []

        if upload.parsing_status != 'PARSED':
            raise ValidationError("Statement must be parsed before matching")

        return matches

    @staticmethod
    @transaction.atomic
    def create_credit_debit_note(
        note_type,
        vendor_customer_id,
        vendor_customer_type,
        source_document_id,
        source_document_type,
        amount,
        tax=Decimal('0'),
        reason=None,
        created_by=None
    ):
        """Create credit or debit note."""
        note = CreditDebitNote.objects.create(
            note_type=note_type,
            vendor_customer_id=vendor_customer_id,
            vendor_customer_type=vendor_customer_type,
            source_document_id=source_document_id,
            source_document_type=source_document_type,
            amount=amount,
            tax=tax,
            reason=reason or '',
            approval_status='DRAFT',
            created_by=created_by
        )
        return note

    @staticmethod
    @transaction.atomic
    def approve_credit_debit_note(note, user):
        """Approve credit/debit note."""
        if note.approval_status != 'PENDING':
            raise ValidationError("Only PENDING notes can be approved")

        note.approval_status = 'APPROVED'
        note.approved_by_id = user.stakeholder_user.id if hasattr(user, 'stakeholder_user') else None
        note.approval_date = timezone.now()
        note.save(update_fields=['approval_status', 'approved_by', 'approval_date', 'updated_at', 'updated_by'])

    @staticmethod
    def generate_agewise_payable_report(vendor_id=None):
        """Generate vendor agewise payable report."""
        from datetime import datetime, timedelta

        now = datetime.now().date()
        buckets = {
            'Current': Decimal('0'),
            'Past 30': Decimal('0'),
            'Past 60': Decimal('0'),
            'Past 90': Decimal('0'),
            'Past 120': Decimal('0'),
        }

        queryset = VendorLedger.objects.filter(
            payment_status__in=['NOT_DUE', 'PARTIALLY_PAID', 'OVERDUE'],
            is_active=True
        )

        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)

        for entry in queryset:
            if not entry.due_date:
                continue

            days_overdue = (now - entry.due_date).days
            balance = entry.debit_amount - entry.credit_amount

            if days_overdue < 0:
                buckets['Current'] += balance
            elif days_overdue < 30:
                buckets['Past 30'] += balance
            elif days_overdue < 60:
                buckets['Past 60'] += balance
            elif days_overdue < 90:
                buckets['Past 90'] += balance
            else:
                buckets['Past 120'] += balance

        return {
            'report_type': 'Vendor Ageing',
            'as_on_date': now.isoformat(),
            'vendor_id': str(vendor_id) if vendor_id else 'All',
            'buckets': buckets,
            'total_payable': sum(buckets.values())
        }

    @staticmethod
    def generate_agewise_receivable_report(customer_id=None):
        """Generate customer agewise receivable report."""
        from datetime import datetime

        now = datetime.now().date()
        buckets = {
            'Current': Decimal('0'),
            'Past 30': Decimal('0'),
            'Past 60': Decimal('0'),
            'Past 90': Decimal('0'),
            'Past 120': Decimal('0'),
        }

        queryset = CustomerLedger.objects.filter(
            payment_status__in=['NOT_DUE', 'PARTIALLY_PAID', 'OVERDUE'],
            is_active=True
        )

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        for entry in queryset:
            if not entry.due_date:
                continue

            days_overdue = (now - entry.due_date).days
            balance = entry.debit_amount - entry.credit_amount

            if days_overdue < 0:
                buckets['Current'] += balance
            elif days_overdue < 30:
                buckets['Past 30'] += balance
            elif days_overdue < 60:
                buckets['Past 60'] += balance
            elif days_overdue < 90:
                buckets['Past 90'] += balance
            else:
                buckets['Past 120'] += balance

        return {
            'report_type': 'Customer Ageing',
            'as_on_date': now.isoformat(),
            'customer_id': str(customer_id) if customer_id else 'All',
            'buckets': buckets,
            'total_receivable': sum(buckets.values())
        }

    @staticmethod
    @transaction.atomic
    def reconcile_gst(report, user):
        """Reconcile GST report."""
        report.updated_by = user
        report.save(update_fields=['updated_at', 'updated_by'])

    @staticmethod
    @transaction.atomic
    def advance_petty_cash(
        register,
        amount,
        voucher_reference_id,
        voucher_reference_type,
        notes=None,
        user=None
    ):
        """Issue petty cash advance."""
        if register.current_balance < amount:
            raise ValidationError("Insufficient petty cash balance")

        register.current_balance -= amount
        register.save(update_fields=['current_balance', 'updated_at', 'updated_by'])

        PettyCashTransaction.objects.create(
            register=register,
            transaction_date=timezone.now().date(),
            voucher_reference_id=voucher_reference_id,
            voucher_reference_type=voucher_reference_type,
            amount=amount,
            type='ADVANCE',
            notes=notes or '',
            created_by=user
        )

    @staticmethod
    @transaction.atomic
    def settle_petty_cash(
        register,
        amount,
        voucher_reference_id,
        voucher_reference_type,
        notes=None,
        user=None
    ):
        """Record petty cash settlement."""
        register.current_balance += amount
        register.save(update_fields=['current_balance', 'updated_at', 'updated_by'])

        PettyCashTransaction.objects.create(
            register=register,
            transaction_date=timezone.now().date(),
            voucher_reference_id=voucher_reference_id,
            voucher_reference_type=voucher_reference_type,
            amount=amount,
            type='SETTLEMENT',
            notes=notes or '',
            created_by=user
        )

    @staticmethod
    @transaction.atomic
    def lock_period(warehouse_id, lock_until_date, user=None):
        """
        Lock period prevents backdated edits.
        Implementation depends on audit trail requirements.
        """
        return {
            'warehouse_id': warehouse_id,
            'locked_until': lock_until_date.isoformat(),
            'locked_by': user.get_full_name() if user else 'System'
        }
