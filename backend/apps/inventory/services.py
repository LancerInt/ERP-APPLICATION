"""Services for inventory operations."""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import (
    InventoryLedger,
    StockTransferDC,
    StockTransferReceipt,
    WarehouseShifting,
    JobWorkOrder,
    JobWorkDC,
    JobWorkReceipt,
    SalesReturnAdvice,
    ReturnApprovalTrail,
    StockAdjustment,
)


class InventoryService:
    """Service layer for inventory operations."""

    @staticmethod
    @transaction.atomic
    def record_stock_entry(
        warehouse_id,
        godown_id,
        product_id,
        batch,
        quantity_in=Decimal('0'),
        quantity_out=Decimal('0'),
        uom=None,
        transaction_type=None,
        source_document_type=None,
        source_document_id=None,
        cost=None,
        transaction_date=None,
        created_by=None,
        remarks=''
    ):
        """
        Record a stock entry in the append-only ledger.
        This is the ONLY method that creates inventory movements.
        """
        if not transaction_date:
            transaction_date = timezone.now().date()

        if quantity_in == 0 and quantity_out == 0:
            raise ValidationError("At least one quantity (in or out) must be non-zero")

        entry = InventoryLedger.objects.create(
            warehouse_id=warehouse_id,
            godown_id=godown_id,
            product_id=product_id,
            batch=batch,
            quantity_in=quantity_in,
            quantity_out=quantity_out,
            uom=uom,
            transaction_type=transaction_type,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            cost=cost,
            transaction_date=transaction_date,
            created_by=created_by,
            remarks=remarks
        )
        return entry

    @staticmethod
    def get_stock_balance(warehouse_id, product_id, batch=None, godown_id=None):
        """
        Calculate stock balance by deriving from ledger entries.
        Never stored - always computed to ensure accuracy.
        """
        queryset = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            product_id=product_id,
            is_active=True
        )

        if batch:
            queryset = queryset.filter(batch=batch)
        if godown_id:
            queryset = queryset.filter(godown_id=godown_id)

        total_in = sum(
            entry.quantity_in for entry in queryset
        )
        total_out = sum(
            entry.quantity_out for entry in queryset
        )

        return {
            'balance': total_in - total_out,
            'total_in': total_in,
            'total_out': total_out,
            'product_id': product_id,
            'warehouse_id': warehouse_id,
            'batch': batch,
        }

    @staticmethod
    def get_stock_by_batch_and_godown(warehouse_id, product_id):
        """Get stock breakdown by batch and godown."""
        entries = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            product_id=product_id,
            is_active=True
        ).values('batch', 'godown_id').annotate(
            total_in=models.Sum('quantity_in'),
            total_out=models.Sum('quantity_out')
        )

        result = []
        for entry in entries:
            balance = (entry['total_in'] or 0) - (entry['total_out'] or 0)
            if balance > 0:
                result.append({
                    'batch': entry['batch'],
                    'godown_id': entry['godown_id'],
                    'balance': balance,
                })

        return result

    @staticmethod
    def get_fifo_layers(product_id, warehouse_id=None):
        """Get FIFO layers for stock valuation."""
        queryset = InventoryLedger.objects.filter(
            product_id=product_id,
            quantity_in__gt=0,
            is_active=True
        ).order_by('transaction_date', 'created_at')

        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)

        layers = []
        for entry in queryset:
            layers.append({
                'layer_id': entry.fifo_layer_id or entry.id,
                'transaction_date': entry.transaction_date,
                'quantity': entry.quantity_in,
                'cost': entry.cost,
                'batch': entry.batch,
            })

        return layers

    @staticmethod
    @transaction.atomic
    def create_stock_transfer(
        from_warehouse_id,
        to_warehouse_id,
        lines_data,
        transporter_id=None,
        freight_terms=None,
        freight_amount=Decimal('0'),
        loading_wages=Decimal('0'),
        created_by=None
    ):
        """
        Create a stock transfer DC with lines.
        Marks inventory as IN_TRANSIT.
        """
        transfer = StockTransferDC.objects.create(
            from_warehouse_id=from_warehouse_id,
            to_warehouse_id=to_warehouse_id,
            transporter_id=transporter_id,
            freight_terms=freight_terms or '',
            freight_amount=freight_amount,
            loading_wages=loading_wages,
            status='DRAFT',
            created_by=created_by
        )

        for line in lines_data:
            transfer.lines.create(**line)

        return transfer

    @staticmethod
    @transaction.atomic
    def receive_stock_transfer(receipt, user):
        """
        Process stock transfer receipt.
        Creates ledger entries for received goods.
        """
        if receipt.status != 'DRAFT':
            raise ValidationError("Only DRAFT receipts can be processed")

        transfer = receipt.linked_transfer

        for line in receipt.lines.all():
            if line.quantity_received > 0:
                InventoryService.record_stock_entry(
                    warehouse_id=receipt.to_warehouse_id,
                    godown_id=line.received_godown_id,
                    product_id=line.product_id,
                    batch=line.batch,
                    quantity_in=line.quantity_received,
                    uom=line.uom,
                    transaction_type='TRANSFER',
                    source_document_type='StockTransferReceipt',
                    source_document_id=receipt.id,
                    transaction_date=receipt.receipt_date,
                    created_by=user,
                    remarks=f'Transfer from {transfer.from_warehouse.name}'
                )

        receipt.status = 'COMPLETED'
        receipt.save(update_fields=['status', 'updated_at', 'updated_by'])

        transfer.status = 'RECEIVED'
        transfer.save(update_fields=['status', 'updated_at', 'updated_by'])

    @staticmethod
    @transaction.atomic
    def create_warehouse_shifting(
        warehouse_id,
        from_godown_id,
        to_godown_id,
        products_data,
        reason_code,
        other_reason=None,
        created_by=None
    ):
        """Create warehouse shifting request."""
        shifting = WarehouseShifting.objects.create(
            warehouse_id=warehouse_id,
            from_godown_id=from_godown_id,
            to_godown_id=to_godown_id,
            reason_code=reason_code,
            other_reason=other_reason or '',
            status='DRAFT',
            created_by=created_by
        )

        for product_data in products_data:
            shifting.products.create(**product_data)

        return shifting

    @staticmethod
    @transaction.atomic
    def create_job_work_flow(
        warehouse_id,
        vendor_id,
        materials_data,
        outputs_data,
        start_date,
        expected_completion_date=None,
        template_id=None,
        created_by=None
    ):
        """Create complete job work flow."""
        order = JobWorkOrder.objects.create(
            warehouse_id=warehouse_id,
            vendor_id=vendor_id,
            template_id=template_id,
            start_date=start_date,
            expected_completion_date=expected_completion_date,
            status='DRAFT',
            created_by=created_by
        )

        for material in materials_data:
            order.materials_supplied.create(**material)

        for output in outputs_data:
            order.outputs_expected.create(**output)

        return order

    @staticmethod
    @transaction.atomic
    def process_sales_return(advice, user):
        """
        Process sales return approval and QC.
        Creates stock entries for returned goods.
        """
        if advice.approval_status != 'PENDING':
            raise ValidationError("Only PENDING advice can be processed")

        for line in advice.lines.all():
            InventoryService.record_stock_entry(
                warehouse_id=advice.received_warehouse_id,
                godown_id=None,
                product_id=line.product_id,
                batch=line.batch,
                quantity_in=line.quantity_returned,
                uom=line.uom,
                transaction_type='SALES_RETURN',
                source_document_type='SalesReturnAdvice',
                source_document_id=advice.id,
                transaction_date=advice.return_date,
                created_by=user,
                remarks=f'Sales return from {advice.customer.name} - {line.condition}'
            )

        advice.approval_status = 'APPROVED'
        advice.save(update_fields=['approval_status', 'updated_at', 'updated_by'])

        ReturnApprovalTrail.objects.create(
            return_advice=advice,
            actor_id=user.stakeholder_user.id if hasattr(user, 'stakeholder_user') else None,
            action='APPROVED',
            remarks=f'Approved by {user.get_full_name()}'
        )

    @staticmethod
    @transaction.atomic
    def create_stock_adjustment(
        warehouse_id,
        godown_id,
        product_id,
        batch,
        adjustment_type,
        quantity,
        uom,
        reason_code,
        value_impact,
        other_reason=None,
        finance_review_required=False,
        created_by=None,
        notes=None
    ):
        """Create stock adjustment draft."""
        adjustment = StockAdjustment.objects.create(
            warehouse_id=warehouse_id,
            godown_id=godown_id,
            product_id=product_id,
            batch=batch,
            adjustment_type=adjustment_type,
            quantity=quantity,
            uom=uom,
            reason_code=reason_code,
            other_reason=other_reason or '',
            value_impact=value_impact,
            finance_review_required=finance_review_required,
            approval_status='DRAFT',
            created_by=created_by,
            notes=notes or ''
        )
        return adjustment

    @staticmethod
    @transaction.atomic
    def approve_stock_adjustment(adjustment, user, remarks=None):
        """Approve and process stock adjustment."""
        if adjustment.approval_status != 'PENDING':
            raise ValidationError("Only PENDING adjustments can be approved")

        adjustment.approval_status = 'APPROVED'
        adjustment.approved_by_id = user.stakeholder_user.id if hasattr(user, 'stakeholder_user') else None
        adjustment.approval_date = timezone.now()
        adjustment.save(update_fields=[
            'approval_status',
            'approved_by',
            'approval_date',
            'updated_at',
            'updated_by'
        ])

        quantity = adjustment.quantity if adjustment.adjustment_type == 'POSITIVE' else -adjustment.quantity

        InventoryService.record_stock_entry(
            warehouse_id=adjustment.warehouse_id,
            godown_id=adjustment.godown_id,
            product_id=adjustment.product_id,
            batch=adjustment.batch,
            quantity_in=quantity if quantity > 0 else Decimal('0'),
            quantity_out=-quantity if quantity < 0 else Decimal('0'),
            uom=adjustment.uom,
            transaction_type='ADJUSTMENT',
            source_document_type='StockAdjustment',
            source_document_id=adjustment.id,
            transaction_date=adjustment.adjustment_date,
            created_by=user,
            remarks=remarks or f'Stock adjustment: {adjustment.reason_code}'
        )

    @staticmethod
    def generate_monthly_adjustment_report(warehouse_id, month, year):
        """Generate monthly stock adjustment report."""
        from django.db.models import Sum, Q
        from datetime import date

        adjustments = StockAdjustment.objects.filter(
            warehouse_id=warehouse_id,
            adjustment_date__month=month,
            adjustment_date__year=year,
            approval_status='APPROVED',
            is_active=True
        )

        report = {
            'period': f"{month}/{year}",
            'warehouse_id': warehouse_id,
            'total_positive_value': Decimal('0'),
            'total_negative_value': Decimal('0'),
            'adjustments_by_reason': {},
            'details': []
        }

        for adjustment in adjustments:
            if adjustment.adjustment_type == 'POSITIVE':
                report['total_positive_value'] += adjustment.value_impact
            else:
                report['total_negative_value'] += adjustment.value_impact

            reason = adjustment.reason_code
            if reason not in report['adjustments_by_reason']:
                report['adjustments_by_reason'][reason] = Decimal('0')
            report['adjustments_by_reason'][reason] += adjustment.value_impact

            report['details'].append({
                'adjustment_no': adjustment.adjustment_no,
                'product_id': str(adjustment.product_id),
                'batch': adjustment.batch,
                'adjustment_type': adjustment.adjustment_type,
                'quantity': str(adjustment.quantity),
                'value_impact': str(adjustment.value_impact),
                'reason_code': adjustment.reason_code,
                'approval_date': adjustment.approval_date.isoformat(),
            })

        return report
