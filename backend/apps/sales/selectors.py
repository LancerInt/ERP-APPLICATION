from decimal import Decimal
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta

from django.db.models import Q, Sum, F, Case, When, Value, DecimalField, Prefetch
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import (
    SalesOrder,
    DispatchChallan,
    ReceivableLedger,
    SOLine,
)


class SalesOrderSelector:
    """Selectors for sales order queries."""

    @staticmethod
    def get_pending_sos_for_warehouse(warehouse_id: int) -> 'QuerySet':
        """
        Get pending approval SOs for specific warehouse.

        Args:
            warehouse_id: Warehouse ID

        Returns:
            QuerySet of SalesOrder
        """
        return (
            SalesOrder.objects
            .filter(
                warehouse_id=warehouse_id,
                approval_status__in=['DRAFT', 'PENDING'],
                is_active=True
            )
            .select_related('customer', 'company', 'warehouse', 'price_list', 'approved_by')
            .prefetch_related('so_lines__product')
            .order_by('-so_date')
        )

    @staticmethod
    def get_pending_sos_for_customer(customer_id: int) -> 'QuerySet':
        """
        Get pending SOs for specific customer.

        Args:
            customer_id: Customer ID

        Returns:
            QuerySet of SalesOrder
        """
        return (
            SalesOrder.objects
            .filter(
                customer_id=customer_id,
                approval_status__in=['DRAFT', 'PENDING'],
                is_active=True
            )
            .select_related('customer', 'company', 'warehouse', 'price_list')
            .prefetch_related('so_lines__product')
            .order_by('-so_date')
        )

    @staticmethod
    def get_approved_sos_not_dispatched(warehouse_id: int = None) -> 'QuerySet':
        """
        Get approved SOs with pending dispatch.

        Args:
            warehouse_id: Optional warehouse filter

        Returns:
            QuerySet of SalesOrder
        """
        from django.db.models import Count, Q

        query = (
            SalesOrder.objects
            .filter(
                approval_status='APPROVED',
                is_active=True
            )
            .annotate(
                total_ordered=Coalesce(
                    Sum('so_lines__quantity_ordered'),
                    Value(0),
                    output_field=DecimalField()
                ),
                total_reserved=Coalesce(
                    Sum('so_lines__reserved_qty'),
                    Value(0),
                    output_field=DecimalField()
                )
            )
            .filter(Q(total_ordered__gt=F('total_reserved')))
        )

        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)

        return (
            query
            .select_related('customer', 'warehouse')
            .prefetch_related('so_lines__product')
            .order_by('so_date')
        )

    @staticmethod
    def get_sales_order_by_customer_po(po_upload_id: int) -> Optional[SalesOrder]:
        """
        Get sales order created from specific PO upload.

        Args:
            po_upload_id: CustomerPOUpload ID

        Returns:
            SalesOrder or None
        """
        return (
            SalesOrder.objects
            .filter(customer_po_reference_id=po_upload_id)
            .select_related('customer', 'warehouse', 'company', 'price_list')
            .prefetch_related('so_lines__product')
            .first()
        )


class DispatchSelector:
    """Selectors for dispatch challan queries."""

    @staticmethod
    def get_open_dcs(warehouse_id: int = None) -> 'QuerySet':
        """
        Get open (not yet delivered) dispatch challans.

        Args:
            warehouse_id: Optional warehouse filter

        Returns:
            QuerySet of DispatchChallan
        """
        query = (
            DispatchChallan.objects
            .filter(
                status__in=['DRAFT', 'RELEASED'],
                is_active=True
            )
        )

        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)

        return (
            query
            .select_related('warehouse', 'transporter')
            .prefetch_related('dc_lines__product', 'dc_lines__linked_so_line')
            .order_by('-dispatch_date')
        )

    @staticmethod
    def get_delivered_dcs_without_invoice(warehouse_id: int = None) -> 'QuerySet':
        """
        Get delivered DCs awaiting invoice.

        Args:
            warehouse_id: Optional warehouse filter

        Returns:
            QuerySet of DispatchChallan
        """
        from .models import SalesInvoiceCheck

        # DCs without accepted invoice
        dcs_without_invoice = (
            DispatchChallan.objects
            .filter(
                status='DELIVERED',
                is_active=True,
            )
            .exclude(
                invoice_checks__acceptance_timestamp__isnull=False
            )
        )

        if warehouse_id:
            dcs_without_invoice = dcs_without_invoice.filter(warehouse_id=warehouse_id)

        return (
            dcs_without_invoice
            .select_related('warehouse', 'transporter')
            .prefetch_related('dc_lines__product')
            .order_by('-dispatch_date')
        )

    @staticmethod
    def get_dcs_by_transporter(transporter_id: int) -> 'QuerySet':
        """
        Get all DCs for specific transporter.

        Args:
            transporter_id: Transporter ID

        Returns:
            QuerySet of DispatchChallan
        """
        return (
            DispatchChallan.objects
            .filter(
                transporter_id=transporter_id,
                is_active=True
            )
            .select_related('warehouse', 'transporter')
            .prefetch_related('dc_lines__product')
            .order_by('-dispatch_date')
        )


class ReceivableSelector:
    """Selectors for accounts receivable queries."""

    @staticmethod
    def get_overdue_receivables(
        days_overdue: int = 0,
    ) -> 'QuerySet':
        """
        Get overdue receivables grouped by customer.

        Args:
            days_overdue: Days past due date (0 = any overdue)

        Returns:
            QuerySet of ReceivableLedger
        """
        cutoff_date = timezone.now().date() - timedelta(days=days_overdue)

        return (
            ReceivableLedger.objects
            .filter(
                payment_status__in=['NOT_DUE', 'PARTIALLY_PAID'],
                due_date__lt=cutoff_date,
                is_active=True
            )
            .select_related('customer', 'invoice_reference')
            .prefetch_related('reminders')
            .order_by('customer', '-due_date')
        )

    @staticmethod
    def get_receivables_by_customer(customer_id: int) -> 'QuerySet':
        """
        Get all receivables for specific customer.

        Args:
            customer_id: Customer ID

        Returns:
            QuerySet of ReceivableLedger
        """
        return (
            ReceivableLedger.objects
            .filter(
                customer_id=customer_id,
                is_active=True
            )
            .select_related('invoice_reference')
            .prefetch_related('reminders')
            .order_by('-due_date')
        )

    @staticmethod
    def get_aging_summary(
        as_of_date=None,
    ) -> List[Dict]:
        """
        Get aging bucket summary (30/60/90+ days overdue).

        Args:
            as_of_date: Reference date (default: today)

        Returns:
            List of dicts with aging summary per customer
        """
        if not as_of_date:
            as_of_date = timezone.now().date()

        bucket_30 = as_of_date - timedelta(days=30)
        bucket_60 = as_of_date - timedelta(days=60)
        bucket_90 = as_of_date - timedelta(days=90)

        aging_data = (
            ReceivableLedger.objects
            .filter(is_active=True)
            .values('customer__id', 'customer__name')
            .annotate(
                current=Coalesce(
                    Sum(
                        Case(
                            When(due_date__gte=bucket_30, then='balance'),
                            output_field=DecimalField()
                        )
                    ),
                    Value(Decimal('0')),
                    output_field=DecimalField()
                ),
                overdue_30=Coalesce(
                    Sum(
                        Case(
                            When(due_date__lt=bucket_30, due_date__gte=bucket_60, then='balance'),
                            output_field=DecimalField()
                        )
                    ),
                    Value(Decimal('0')),
                    output_field=DecimalField()
                ),
                overdue_60=Coalesce(
                    Sum(
                        Case(
                            When(due_date__lt=bucket_60, due_date__gte=bucket_90, then='balance'),
                            output_field=DecimalField()
                        )
                    ),
                    Value(Decimal('0')),
                    output_field=DecimalField()
                ),
                overdue_90=Coalesce(
                    Sum(
                        Case(
                            When(due_date__lt=bucket_90, then='balance'),
                            output_field=DecimalField()
                        )
                    ),
                    Value(Decimal('0')),
                    output_field=DecimalField()
                ),
                total_due=Coalesce(
                    Sum('balance'),
                    Value(Decimal('0')),
                    output_field=DecimalField()
                )
            )
            .order_by('customer__name')
        )

        return list(aging_data)

    @staticmethod
    def get_receivables_by_status(
        payment_status: str,
    ) -> 'QuerySet':
        """
        Get receivables filtered by payment status.

        Args:
            payment_status: Status code (NOT_DUE/PARTIALLY_PAID/PAID/OVERDUE)

        Returns:
            QuerySet of ReceivableLedger
        """
        return (
            ReceivableLedger.objects
            .filter(
                payment_status=payment_status,
                is_active=True
            )
            .select_related('customer', 'invoice_reference')
            .order_by('customer', '-due_date')
        )


class SalesReconciliationSelector:
    """Selectors for sales reconciliation (PO → SO → DC → Invoice → Payment trail)."""

    @staticmethod
    def get_sales_reconciliation_trail(so_id: int) -> Dict:
        """
        Get complete reconciliation trail for a sales order.

        PO → SO → DC → Invoice → Receivable → Payment

        Args:
            so_id: SalesOrder ID

        Returns:
            Dict with complete trail information
        """
        sales_order = (
            SalesOrder.objects
            .select_related(
                'customer',
                'customer_po_reference',
                'warehouse',
                'company'
            )
            .prefetch_related(
                'so_lines__product',
                'so_lines__dc_lines__dc',
            )
            .get(id=so_id)
        )

        # Get linked PO
        po_upload = sales_order.customer_po_reference

        # Get dispatch challans for this SO
        dcs = DispatchChallan.objects.filter(
            dc_lines__linked_so_line__so=sales_order
        ).distinct()

        # Get invoices and receivables
        invoices = []
        receivables = []

        for dc in dcs:
            dc_invoices = dc.invoice_checks.all()
            invoices.extend(dc_invoices)

            for invoice in dc_invoices:
                ar = ReceivableLedger.objects.filter(
                    invoice_reference=invoice
                ).first()
                if ar:
                    receivables.append(ar)

        # Calculate totals
        so_total = sales_order.get_total_amount()
        dispatch_total = sum(
            dc.get_total_dispatch_qty() for dc in dcs
        )
        invoice_total = sum(
            inv.total_value_upload for inv in invoices
        ) or Decimal('0')
        paid_total = sum(
            ar.amount_paid for ar in receivables
        ) or Decimal('0')
        outstanding = invoice_total - paid_total

        return {
            'sales_order': {
                'so_no': sales_order.so_no,
                'customer': sales_order.customer.name,
                'total_amount': so_total,
                'approval_status': sales_order.approval_status,
                'created_date': sales_order.created_at,
            },
            'po_upload': {
                'upload_id': po_upload.upload_id if po_upload else None,
                'status': po_upload.status if po_upload else None,
            },
            'dispatch_challans': [
                {
                    'dc_no': dc.dc_no,
                    'status': dc.status,
                    'dispatch_date': dc.dispatch_date,
                    'quantity': dc.get_total_dispatch_qty(),
                }
                for dc in dcs
            ],
            'invoices': [
                {
                    'invoice_number': inv.invoice_number,
                    'invoice_date': inv.invoice_date,
                    'total_value': inv.total_value_upload,
                    'variance_flag': inv.variance_flag,
                    'acceptance_status': 'ACCEPTED' if inv.accepted_by else 'PENDING',
                }
                for inv in invoices
            ],
            'receivables': [
                {
                    'invoice_ref': ar.invoice_reference.invoice_number,
                    'due_date': ar.due_date,
                    'amount': ar.amount,
                    'paid': ar.amount_paid,
                    'balance': ar.balance,
                    'status': ar.payment_status,
                }
                for ar in receivables
            ],
            'summary': {
                'so_total': so_total,
                'dispatch_total': dispatch_total,
                'invoice_total': invoice_total,
                'paid_total': paid_total,
                'outstanding': outstanding,
            }
        }

    @staticmethod
    def get_reconciliation_summary_by_customer(customer_id: int) -> Dict:
        """
        Get reconciliation summary for all SOs of a customer.

        Args:
            customer_id: Customer ID

        Returns:
            Dict with aggregated reconciliation data
        """
        from master.models import Customer

        customer = Customer.objects.get(id=customer_id)

        sales_orders = SalesOrder.objects.filter(
            customer_id=customer_id,
            is_active=True
        ).prefetch_related('so_lines')

        total_so_amount = sum(so.get_total_amount() for so in sales_orders) or Decimal('0')

        # Get total dispatched
        dcs = DispatchChallan.objects.filter(
            dc_lines__linked_so_line__so__customer_id=customer_id
        ).distinct()
        total_dispatch_qty = sum(dc.get_total_dispatch_qty() for dc in dcs)

        # Get receivables
        receivables = ReceivableLedger.objects.filter(
            customer_id=customer_id,
            is_active=True
        )
        total_invoiced = sum(ar.amount for ar in receivables) or Decimal('0')
        total_paid = sum(ar.amount_paid for ar in receivables) or Decimal('0')
        total_outstanding = total_invoiced - total_paid

        overdue_receivables = receivables.filter(
            payment_status__in=['NOT_DUE', 'PARTIALLY_PAID'],
            due_date__lt=timezone.now().date()
        )
        overdue_amount = sum(ar.balance for ar in overdue_receivables) or Decimal('0')

        return {
            'customer_name': customer.name,
            'total_so_amount': total_so_amount,
            'total_dispatched_qty': total_dispatch_qty,
            'total_invoiced': total_invoiced,
            'total_paid': total_paid,
            'total_outstanding': total_outstanding,
            'overdue_amount': overdue_amount,
            'overdue_count': overdue_receivables.count(),
            'pending_so_count': SalesOrderSelector.get_pending_sos_for_customer(
                customer_id
            ).count(),
            'open_dc_count': DispatchSelector.get_open_dcs().filter(
                dc_lines__linked_so_line__so__customer_id=customer_id
            ).distinct().count(),
        }

    @staticmethod
    def get_invoice_to_receivable_matching(invoice_check_id: int) -> Dict:
        """
        Get matching data between invoice and receivable ledger.

        Args:
            invoice_check_id: SalesInvoiceCheck ID

        Returns:
            Dict with matching information
        """
        from .models import SalesInvoiceCheck

        invoice = SalesInvoiceCheck.objects.select_related(
            'dc_reference'
        ).get(id=invoice_check_id)

        receivable = ReceivableLedger.objects.filter(
            invoice_reference=invoice
        ).first()

        if not receivable:
            return {'status': 'NO_RECEIVABLE_ENTRY'}

        return {
            'invoice_number': invoice.invoice_number,
            'invoice_date': invoice.invoice_date,
            'invoice_total': invoice.total_value_upload,
            'so_total': invoice.total_value_so,
            'variance': invoice.variance_amount,
            'variance_flag': invoice.variance_flag,
            'receivable_id': receivable.id,
            'customer': receivable.customer.name,
            'due_date': receivable.due_date,
            'amount': receivable.amount,
            'amount_paid': receivable.amount_paid,
            'balance': receivable.balance,
            'payment_status': receivable.payment_status,
            'days_overdue': (
                (timezone.now().date() - receivable.due_date).days
                if receivable.is_overdue() else 0
            ),
        }
