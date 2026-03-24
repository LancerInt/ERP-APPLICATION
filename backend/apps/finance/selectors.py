"""Selectors for finance queries."""

from decimal import Decimal
from django.db.models import Sum, Q, F
from datetime import datetime, timedelta

from .models import (
    VendorLedger,
    CustomerLedger,
    FreightLedger,
    PettyCashRegister,
    PettyCashTransaction,
)


class FinanceSelector:
    """Selector for finance read operations."""

    @staticmethod
    def get_vendor_ageing(vendor_id=None):
        """Get vendor ageing breakdown."""
        now = datetime.now().date()
        buckets = {
            'Current': Decimal('0'),
            'Past 30': Decimal('0'),
            'Past 60': Decimal('0'),
            'Past 90': Decimal('0'),
            'Past 120+': Decimal('0'),
        }

        queryset = VendorLedger.objects.filter(
            payment_status__in=['NOT_DUE', 'PARTIALLY_PAID', 'OVERDUE'],
            is_active=True
        )

        if vendor_id:
            queryset = queryset.filter(vendor_id=vendor_id)

        entries = queryset.select_related('vendor')

        for entry in entries:
            if not entry.due_date:
                continue

            days_overdue = (now - entry.due_date).days
            balance = entry.debit_amount - entry.credit_amount

            if balance <= 0:
                continue

            if days_overdue < 0:
                buckets['Current'] += balance
            elif days_overdue < 30:
                buckets['Past 30'] += balance
            elif days_overdue < 60:
                buckets['Past 60'] += balance
            elif days_overdue < 90:
                buckets['Past 90'] += balance
            else:
                buckets['Past 120+'] += balance

        return {
            'report_type': 'Vendor Ageing',
            'as_on_date': now.isoformat(),
            'vendor_id': str(vendor_id) if vendor_id else 'All Vendors',
            'ageing_buckets': buckets,
            'total_payable': sum(buckets.values())
        }

    @staticmethod
    def get_customer_ageing(customer_id=None):
        """Get customer ageing breakdown."""
        now = datetime.now().date()
        buckets = {
            'Current': Decimal('0'),
            'Past 30': Decimal('0'),
            'Past 60': Decimal('0'),
            'Past 90': Decimal('0'),
            'Past 120+': Decimal('0'),
        }

        queryset = CustomerLedger.objects.filter(
            payment_status__in=['NOT_DUE', 'PARTIALLY_PAID', 'OVERDUE'],
            is_active=True
        )

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        entries = queryset.select_related('customer')

        for entry in entries:
            if not entry.due_date:
                continue

            days_overdue = (now - entry.due_date).days
            balance = entry.debit_amount - entry.credit_amount

            if balance <= 0:
                continue

            if days_overdue < 0:
                buckets['Current'] += balance
            elif days_overdue < 30:
                buckets['Past 30'] += balance
            elif days_overdue < 60:
                buckets['Past 60'] += balance
            elif days_overdue < 90:
                buckets['Past 90'] += balance
            else:
                buckets['Past 120+'] += balance

        return {
            'report_type': 'Customer Ageing',
            'as_on_date': now.isoformat(),
            'customer_id': str(customer_id) if customer_id else 'All Customers',
            'ageing_buckets': buckets,
            'total_receivable': sum(buckets.values())
        }

    @staticmethod
    def get_freight_balance(transporter_id=None):
        """Get freight balance for transporter."""
        queryset = FreightLedger.objects.filter(is_active=True)

        if transporter_id:
            queryset = queryset.filter(transporter_id=transporter_id)

        total_balance = Decimal('0')
        by_direction = {
            'INBOUND': Decimal('0'),
            'OUTBOUND': Decimal('0'),
            'TRANSFER': Decimal('0'),
        }

        for entry in queryset.select_related('transporter'):
            total_balance += entry.balance
            by_direction[entry.direction] += entry.balance

        return {
            'transporter_id': str(transporter_id) if transporter_id else 'All Transporters',
            'total_balance': total_balance,
            'by_direction': by_direction,
            'pending_payment': total_balance
        }

    @staticmethod
    def get_petty_cash_balance(register_id):
        """Get petty cash balance for register."""
        register = PettyCashRegister.objects.get(id=register_id)

        total_advances = Decimal('0')
        total_settlements = Decimal('0')

        transactions = PettyCashTransaction.objects.filter(
            register_id=register_id,
            is_active=True
        )

        for txn in transactions:
            if txn.type == 'ADVANCE':
                total_advances += txn.amount
            else:
                total_settlements += txn.amount

        return {
            'warehouse_id': str(register.warehouse_id),
            'warehouse_name': register.warehouse.name,
            'opening_balance': register.opening_balance,
            'current_balance': register.current_balance,
            'total_advances': total_advances,
            'total_settlements': total_settlements,
            'transaction_count': transactions.count(),
            'last_reconciled': register.last_reconciled_date.isoformat() if register.last_reconciled_date else None
        }

    @staticmethod
    def get_overdue_payables(days_overdue=0):
        """Get overdue payables."""
        now = datetime.now().date()
        cutoff_date = now - timedelta(days=days_overdue)

        overdue = VendorLedger.objects.filter(
            payment_status='OVERDUE',
            due_date__lte=cutoff_date,
            is_active=True
        ).select_related('vendor').values(
            'vendor__name'
        ).annotate(
            total_balance=Sum(F('debit_amount') - F('credit_amount'))
        )

        result = []
        for item in overdue:
            result.append({
                'vendor_name': item['vendor__name'],
                'balance': item['total_balance'],
                'days_overdue': (now - cutoff_date).days
            })

        return result

    @staticmethod
    def get_overdue_receivables(days_overdue=0):
        """Get overdue receivables."""
        now = datetime.now().date()
        cutoff_date = now - timedelta(days=days_overdue)

        overdue = CustomerLedger.objects.filter(
            payment_status='OVERDUE',
            due_date__lte=cutoff_date,
            is_active=True
        ).select_related('customer').values(
            'customer__name'
        ).annotate(
            total_balance=Sum(F('debit_amount') - F('credit_amount'))
        )

        result = []
        for item in overdue:
            result.append({
                'customer_name': item['customer__name'],
                'balance': item['total_balance'],
                'days_overdue': (now - cutoff_date).days
            })

        return result

    @staticmethod
    def get_payment_advice_summary(status=None):
        """Get payment advice summary."""
        from .models import PaymentAdviceWorkflow

        queryset = PaymentAdviceWorkflow.objects.filter(is_active=True)

        if status:
            queryset = queryset.filter(payment_status=status)

        summary = {
            'total_advice': queryset.count(),
            'total_amount': Decimal('0'),
            'by_status': {},
            'by_method': {},
        }

        for advice in queryset:
            summary['total_amount'] += advice.amount

            if advice.payment_status not in summary['by_status']:
                summary['by_status'][advice.payment_status] = {
                    'count': 0,
                    'amount': Decimal('0')
                }
            summary['by_status'][advice.payment_status]['count'] += 1
            summary['by_status'][advice.payment_status]['amount'] += advice.amount

            if advice.payment_method not in summary['by_method']:
                summary['by_method'][advice.payment_method] = {
                    'count': 0,
                    'amount': Decimal('0')
                }
            summary['by_method'][advice.payment_method]['count'] += 1
            summary['by_method'][advice.payment_method]['amount'] += advice.amount

        return summary

    @staticmethod
    def get_bank_reconciliation_status():
        """Get bank reconciliation status."""
        from .models import BankStatementUpload

        uploads = BankStatementUpload.objects.filter(is_active=True)

        status_summary = {
            'total_uploads': uploads.count(),
            'parsed': uploads.filter(parsing_status='PARSED').count(),
            'pending': uploads.filter(parsing_status='PENDING').count(),
            'errors': uploads.filter(parsing_status='ERROR').count(),
        }

        return status_summary
