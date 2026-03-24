"""Data selectors/queries for purchase app."""

from datetime import timedelta
from django.utils import timezone
from django.db.models import Q, Sum, Count, F, Value, DecimalField
from django.db.models.functions import Coalesce

from .models import (
    PurchaseRequest, RFQHeader, QuoteResponse, QuoteEvaluation,
    PurchaseOrder, ReceiptAdvice, VendorPaymentAdvice
)


class PurchaseRequestSelectors:
    """Queries for purchase requests."""

    @staticmethod
    def get_pending_prs_for_warehouse(warehouse, days=30):
        """Get pending PRs for a warehouse in last N days."""
        cutoff_date = timezone.now() - timedelta(days=days)
        return PurchaseRequest.objects.filter(
            warehouse=warehouse,
            approval_status__in=['PENDING', 'PARTIALLY_APPROVED'],
            request_date__gte=cutoff_date
        ).select_related(
            'warehouse', 'godown', 'requested_by'
        ).prefetch_related(
            'lines', 'approval_trails'
        ).order_by('-request_date')

    @staticmethod
    def get_approved_prs_without_rfq(warehouse=None):
        """Get approved PRs that don't have linked RFQs yet."""
        query = PurchaseRequest.objects.filter(
            approval_status__in=['APPROVED', 'PARTIALLY_APPROVED']
        ).exclude(
            rfqs__isnull=False
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.select_related(
            'warehouse', 'requested_by'
        ).prefetch_related(
            'lines'
        ).order_by('-request_date')

    @staticmethod
    def get_pr_summary_for_warehouse(warehouse, days=30):
        """Get PR summary for warehouse (last N days)."""
        cutoff_date = timezone.now() - timedelta(days=days)
        return PurchaseRequest.objects.filter(
            warehouse=warehouse,
            request_date__gte=cutoff_date
        ).values(
            'requirement_type',
            'priority',
            'approval_status'
        ).annotate(
            count=Count('id'),
            total_quantity=Sum('lines__quantity_requested')
        ).order_by('requirement_type', 'priority')

    @staticmethod
    def get_prs_by_status(status, warehouse=None):
        """Get PRs by approval status."""
        query = PurchaseRequest.objects.filter(approval_status=status)

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.select_related(
            'warehouse', 'godown', 'requested_by'
        ).order_by('-request_date')

    @staticmethod
    def get_overdue_prs(days=7):
        """Get PRs with required_by_date approaching or overdue."""
        today = timezone.now().date()
        return PurchaseRequest.objects.filter(
            required_by_date__lte=today + timedelta(days=days),
            approval_status__in=['APPROVED', 'PARTIALLY_APPROVED']
        ).exclude(
            rfqs__isnull=False
        ).order_by('required_by_date')


class RFQSelectors:
    """Queries for RFQs."""

    @staticmethod
    def get_open_rfqs():
        """Get all open RFQs."""
        return RFQHeader.objects.filter(
            rfq_status='OPEN'
        ).select_related(
            'created_by'
        ).prefetch_related(
            'linked_prs', 'quote_responses', 'evaluations'
        ).order_by('-creation_date')

    @staticmethod
    def get_rfqs_pending_evaluation():
        """Get RFQs with quotes but no evaluation yet."""
        return RFQHeader.objects.filter(
            rfq_status='OPEN'
        ).annotate(
            quote_count=Count('quote_responses'),
            eval_count=Count('evaluations')
        ).filter(
            quote_count__gt=0,
            eval_count=0
        ).select_related(
            'created_by'
        ).prefetch_related(
            'quote_responses'
        )

    @staticmethod
    def get_rfq_summary():
        """Get RFQ summary statistics."""
        return {
            'total_open': RFQHeader.objects.filter(rfq_status='OPEN').count(),
            'total_closed': RFQHeader.objects.filter(rfq_status='CLOSED').count(),
            'pending_evaluation': RFQHeader.objects.filter(
                rfq_status='OPEN',
                evaluations__isnull=True
            ).distinct().count(),
            'with_quotes': RFQHeader.objects.filter(
                rfq_status='OPEN',
                quote_responses__isnull=False
            ).distinct().count(),
        }


class QuoteSelectors:
    """Queries for quotes."""

    @staticmethod
    def get_quotes_for_rfq(rfq):
        """Get all quotes for an RFQ."""
        return QuoteResponse.objects.filter(
            rfq=rfq
        ).select_related(
            'vendor'
        ).prefetch_related(
            'quote_lines'
        ).order_by('vendor__name')

    @staticmethod
    def get_chosen_quote_for_rfq(rfq):
        """Get the chosen quote for RFQ."""
        return QuoteResponse.objects.filter(
            rfq=rfq,
            chosen_flag=True
        ).select_related(
            'vendor'
        ).prefetch_related(
            'quote_lines'
        ).first()

    @staticmethod
    def get_quotes_by_vendor(vendor):
        """Get all quotes from a vendor."""
        return QuoteResponse.objects.filter(
            vendor=vendor
        ).select_related(
            'rfq'
        ).order_by('-quote_date')

    @staticmethod
    def get_pending_quote_evaluations():
        """Get evaluations pending approval."""
        return QuoteEvaluation.objects.filter(
            approval_status='PENDING'
        ).select_related(
            'rfq', 'evaluated_by', 'recommended_vendor'
        ).prefetch_related(
            'comparison_entries'
        ).order_by('-evaluation_date')


class PurchaseOrderSelectors:
    """Queries for purchase orders."""

    @staticmethod
    def get_open_pos_for_vendor(vendor):
        """Get open/issued POs for a vendor."""
        return PurchaseOrder.objects.filter(
            vendor=vendor,
            status__in=['APPROVED', 'ISSUED']
        ).select_related(
            'company', 'warehouse', 'vendor'
        ).prefetch_related(
            'po_lines', 'linked_prs'
        ).order_by('-po_date')

    @staticmethod
    def get_pos_by_status(status, warehouse=None):
        """Get POs by status."""
        query = PurchaseOrder.objects.filter(status=status)

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.select_related(
            'vendor', 'company', 'warehouse'
        ).prefetch_related(
            'po_lines'
        ).order_by('-po_date')

    @staticmethod
    def get_overdue_pos(days=7):
        """Get POs with expected delivery approaching or overdue (not fully received)."""
        today = timezone.now().date()
        return PurchaseOrder.objects.filter(
            status__in=['APPROVED', 'ISSUED'],
            expected_delivery_end__lte=today + timedelta(days=days)
        ).select_related(
            'vendor', 'warehouse'
        ).prefetch_related(
            'po_lines'
        ).exclude(
            receipt_advices__isnull=False
        ).order_by('expected_delivery_end')

    @staticmethod
    def get_pos_summary_for_warehouse(warehouse, days=30):
        """Get PO summary for warehouse (last N days)."""
        cutoff_date = timezone.now() - timedelta(days=days)
        return PurchaseOrder.objects.filter(
            warehouse=warehouse,
            po_date__gte=cutoff_date
        ).values(
            'status',
            'vendor__name'
        ).annotate(
            count=Count('id'),
            total_value=Sum(
                F('po_lines__quantity_ordered') * F('po_lines__unit_price'),
                output_field=DecimalField()
            ),
            total_received=Sum(
                F('receipt_advices__receipt_lines__quantity_received'),
                output_field=DecimalField()
            )
        ).order_by('-count')

    @staticmethod
    def get_partially_received_pos():
        """Get POs that are partially received."""
        return PurchaseOrder.objects.filter(
            status__in=['ISSUED', 'CLOSED'],
            partial_receipt_flag=True
        ).select_related(
            'vendor', 'warehouse'
        ).prefetch_related(
            'po_lines', 'receipt_advices'
        ).order_by('-po_date')

    @staticmethod
    def get_po_by_vendor_date_range(vendor, start_date, end_date):
        """Get POs for vendor within date range."""
        return PurchaseOrder.objects.filter(
            vendor=vendor,
            po_date__gte=start_date,
            po_date__lte=end_date
        ).select_related(
            'company', 'warehouse'
        ).prefetch_related(
            'po_lines'
        ).order_by('-po_date')


class ReceiptSelectors:
    """Queries for receipt advices."""

    @staticmethod
    def get_pending_receipts(warehouse=None):
        """Get receipts pending QC."""
        query = ReceiptAdvice.objects.filter(qc_status='PENDING')

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.select_related(
            'warehouse', 'godown', 'vendor'
        ).prefetch_related(
            'receipt_lines', 'linked_pos'
        ).order_by('-receipt_date')

    @staticmethod
    def get_receipts_by_status(qc_status, warehouse=None):
        """Get receipts by QC status."""
        query = ReceiptAdvice.objects.filter(qc_status=qc_status)

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.select_related(
            'warehouse', 'vendor'
        ).order_by('-receipt_date')

    @staticmethod
    def get_receipts_for_po(po):
        """Get all receipts linked to a PO."""
        return ReceiptAdvice.objects.filter(
            linked_pos=po
        ).select_related(
            'warehouse', 'godown', 'vendor'
        ).prefetch_related(
            'receipt_lines'
        ).order_by('-receipt_date')

    @staticmethod
    def get_receipt_summary_for_warehouse(warehouse, days=30):
        """Get receipt summary for warehouse (last N days)."""
        cutoff_date = timezone.now() - timedelta(days=days)
        return ReceiptAdvice.objects.filter(
            warehouse=warehouse,
            receipt_date__gte=cutoff_date
        ).values(
            'qc_status',
            'vendor__name'
        ).annotate(
            count=Count('id'),
            total_received=Sum('receipt_lines__quantity_received')
        ).order_by('qc_status')

    @staticmethod
    def get_receipts_with_batch_expiry(warehouse=None):
        """Get receipts with batch/expiry items."""
        query = ReceiptAdvice.objects.filter(
            receipt_lines__batch_no__isnull=False
        ) | ReceiptAdvice.objects.filter(
            receipt_lines__expiry_date__isnull=False
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.distinct().select_related(
            'warehouse', 'vendor'
        ).prefetch_related(
            'receipt_lines'
        ).order_by('-receipt_date')


class PaymentSelectors:
    """Queries for payment advices."""

    @staticmethod
    def get_pending_payments():
        """Get payment advices pending approval."""
        return VendorPaymentAdvice.objects.filter(
            status='PENDING'
        ).select_related(
            'vendor', 'prepared_by'
        ).prefetch_related(
            'tax_components'
        ).order_by('due_date')

    @staticmethod
    def get_payment_advices_for_vendor(vendor):
        """Get all payment advices for a vendor."""
        return VendorPaymentAdvice.objects.filter(
            vendor=vendor
        ).select_related(
            'prepared_by'
        ).order_by('-created_at')

    @staticmethod
    def get_overdue_payments(days=0):
        """Get overdue payment advices."""
        today = timezone.now().date()
        return VendorPaymentAdvice.objects.filter(
            due_date__lte=today - timedelta(days=days),
            status__in=['PENDING', 'APPROVED']
        ).select_related(
            'vendor'
        ).order_by('due_date')

    @staticmethod
    def get_payment_summary_by_vendor():
        """Get payment summary grouped by vendor."""
        return VendorPaymentAdvice.objects.values(
            'vendor__name'
        ).annotate(
            total_pending=Sum(
                'amount',
                filter=Q(status__in=['PENDING', 'APPROVED'])
            ),
            total_paid=Sum(
                'amount',
                filter=Q(status='PAID')
            ),
            count_pending=Count(
                'id',
                filter=Q(status__in=['PENDING', 'APPROVED'])
            ),
            count_paid=Count(
                'id',
                filter=Q(status='PAID')
            )
        ).order_by('-total_pending')

    @staticmethod
    def get_payments_due_soon(days=7):
        """Get payments due within N days."""
        today = timezone.now().date()
        return VendorPaymentAdvice.objects.filter(
            due_date__gte=today,
            due_date__lte=today + timedelta(days=days),
            status__in=['PENDING', 'APPROVED']
        ).select_related(
            'vendor'
        ).order_by('due_date')

    @staticmethod
    def get_payment_summary_for_period(start_date, end_date):
        """Get payment summary for a date range."""
        return VendorPaymentAdvice.objects.filter(
            created_at__gte=start_date,
            created_at__lte=end_date
        ).values(
            'status'
        ).annotate(
            count=Count('id'),
            total_amount=Sum('amount')
        ).order_by('status')
