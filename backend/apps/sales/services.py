from decimal import Decimal
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
import logging

from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import (
    CustomerPOUpload,
    SalesOrder,
    SOLine,
    DispatchChallan,
    DCLine,
    SalesInvoiceCheck,
    FreightAdviceOutbound,
    ReceivableLedger,
    ReminderDate,
)
from .tasks import parse_customer_po_async

logger = logging.getLogger(__name__)

# Tolerance for invoice variance (in percentage)
INVOICE_VARIANCE_TOLERANCE = Decimal('5.00')


class POUploadService:
    """Service for handling customer PO uploads and parsing."""

    @staticmethod
    def upload_and_parse_customer_po(
        customer_po_upload: CustomerPOUpload,
    ) -> None:
        """
        Trigger async parsing of uploaded PO.
        Delegates actual parsing to Celery task.
        """
        logger.info(f"Queuing PO parsing for upload {customer_po_upload.upload_id}")
        parse_customer_po_async.delay(customer_po_upload.id)


class SalesOrderService:
    """Service for managing sales order operations."""

    @staticmethod
    @transaction.atomic
    def create_sales_order_from_parsed_po(
        po_upload: CustomerPOUpload,
        company_id: int,
        warehouse_id: int,
        price_list_id: int,
        credit_terms: str = "",
        freight_terms: str = "",
        required_ship_date=None,
    ) -> SalesOrder:
        """
        Create sales order from parsed PO.
        Validates parsed items against price list.

        Args:
            po_upload: CustomerPOUpload instance with parsed lines
            company_id: Target company ID
            warehouse_id: Target warehouse ID
            price_list_id: Price list to use
            credit_terms: Credit terms
            freight_terms: Freight terms
            required_ship_date: Required delivery date

        Returns:
            SalesOrder instance

        Raises:
            ValidationError: If price list validation fails
        """
        from core.models import Company, Warehouse
        from master.models import PriceList

        logger.info(f"Creating SO from PO {po_upload.upload_id}")

        # Validate references
        company = Company.objects.get(id=company_id)
        warehouse = Warehouse.objects.get(id=warehouse_id)
        price_list = PriceList.objects.get(id=price_list_id)

        # Create sales order
        so = SalesOrder.objects.create(
            so_no=SalesOrderService._generate_so_number(),
            customer=po_upload.customer,
            company=company,
            warehouse=warehouse,
            price_list=price_list,
            credit_terms=credit_terms,
            freight_terms=freight_terms,
            customer_po_reference=po_upload,
            required_ship_date=required_ship_date,
        )

        # Create SO lines from parsed PO lines
        line_no = 1
        for parsed_line in po_upload.parsed_lines.all():
            if not parsed_line.parsed_sku:
                logger.warning(
                    f"Skipping parsed line without SKU: {parsed_line.product_description}"
                )
                continue

            # Validate price availability
            price_item = price_list.get_price_for_product(
                parsed_line.parsed_sku,
                parsed_line.quantity or Decimal('1')
            )
            if not price_item:
                raise ValidationError(
                    f"Product {parsed_line.parsed_sku.sku} not in price list"
                )

            unit_price = price_item.get('unit_price', Decimal('0'))
            gst_rate = price_item.get('gst_rate', Decimal('0'))

            SOLine.objects.create(
                so=so,
                line_no=line_no,
                product=parsed_line.parsed_sku,
                quantity_ordered=parsed_line.quantity or Decimal('1'),
                uom=parsed_line.uom or 'PCS',
                unit_price=unit_price,
                gst=gst_rate,
            )
            line_no += 1

        logger.info(f"Created SO {so.so_no} with {line_no - 1} lines")

        # Link PO upload to SO
        po_upload.mark_as_converted(so)

        return so

    @staticmethod
    def _generate_so_number() -> str:
        """Generate unique SO number"""
        from datetime import datetime

        prefix = "SO"
        date_part = datetime.now().strftime("%Y%m%d")
        count = SalesOrder.objects.filter(
            so_no__startswith=f"{prefix}-{date_part}"
        ).count()
        return f"{prefix}-{date_part}-{count + 1:04d}"

    @staticmethod
    @transaction.atomic
    def approve_sales_order(
        sales_order: SalesOrder,
        approved_by,
    ) -> SalesOrder:
        """
        Approve sales order.

        Args:
            sales_order: SalesOrder instance
            approved_by: User/StakeholderUser approving the SO

        Returns:
            Updated SalesOrder
        """
        if sales_order.approval_status not in ['DRAFT', 'PENDING']:
            raise ValidationError(f"Cannot approve SO in {sales_order.approval_status} status")

        logger.info(f"Approving SO {sales_order.so_no}")
        sales_order.mark_approved(approved_by)

        return sales_order

    @staticmethod
    def reject_sales_order(sales_order: SalesOrder) -> SalesOrder:
        """
        Reject sales order.

        Args:
            sales_order: SalesOrder instance

        Returns:
            Updated SalesOrder
        """
        if sales_order.approval_status not in ['DRAFT', 'PENDING']:
            raise ValidationError(f"Cannot reject SO in {sales_order.approval_status} status")

        logger.info(f"Rejecting SO {sales_order.so_no}")
        sales_order.mark_rejected()

        return sales_order


class DispatchService:
    """Service for dispatch challan operations."""

    @staticmethod
    @transaction.atomic
    def create_dispatch_challan(
        so_lines: List[SOLine],
        warehouse_id: int,
        transporter_id: Optional[int] = None,
        freight_rate_type: str = "",
        freight_rate_value: Decimal = None,
        lorry_no: str = "",
        driver_contact: str = "",
    ) -> DispatchChallan:
        """
        Create dispatch challan with stock availability check.

        Args:
            so_lines: List of SOLine instances to dispatch
            warehouse_id: Warehouse ID for dispatch
            transporter_id: Optional transporter ID
            freight_rate_type: Type of freight rate (PER_KM/FLAT)
            freight_rate_value: Freight rate value
            lorry_no: Vehicle number
            driver_contact: Driver contact

        Returns:
            DispatchChallan instance

        Raises:
            ValidationError: If stock not available
        """
        from core.models import Warehouse
        from master.models import Transporter

        logger.info(f"Creating DC for {len(so_lines)} SO lines")

        warehouse = Warehouse.objects.get(id=warehouse_id)

        # Check stock availability
        for so_line in so_lines:
            available_qty = DispatchService._get_available_stock(
                so_line.product_id,
                warehouse_id
            )
            pending_qty = so_line.get_pending_qty()

            if available_qty < pending_qty:
                raise ValidationError(
                    f"Insufficient stock for {so_line.product.sku}. "
                    f"Available: {available_qty}, Required: {pending_qty}"
                )

        # Create dispatch challan
        dc = DispatchChallan.objects.create(
            dc_no=DispatchService._generate_dc_number(),
            warehouse=warehouse,
            transporter_id=transporter_id,
            freight_rate_type=freight_rate_type,
            freight_rate_value=freight_rate_value,
            lorry_no=lorry_no,
            driver_contact=driver_contact,
        )

        # Add SO lines to DC (M2M through DCLine)
        for so_line in so_lines:
            pending_qty = so_line.get_pending_qty()
            DCLine.objects.create(
                dc=dc,
                product=so_line.product,
                batch="",  # Set appropriately
                quantity_dispatched=pending_qty,
                uom=so_line.uom,
                linked_so_line=so_line,
            )
            # Update reserved quantity
            so_line.reserved_qty += pending_qty
            so_line.save(update_fields=['reserved_qty', 'updated_at'])

        # Calculate and set freight amount
        if freight_rate_type and freight_rate_value:
            dc.freight_amount_total = DispatchService._calculate_freight_amount(dc)
            dc.save(update_fields=['freight_amount_total'])

        logger.info(f"Created DC {dc.dc_no}")
        return dc

    @staticmethod
    def _get_available_stock(product_id: int, warehouse_id: int) -> Decimal:
        """
        Get available stock for product in warehouse.
        Integrates with inventory ledger.
        """
        from inventory.models import InventoryLedger

        stock = InventoryLedger.objects.filter(
            product_id=product_id,
            warehouse_id=warehouse_id
        ).aggregate(
            total=models.Sum('quantity')
        )['total'] or Decimal('0')

        return stock

    @staticmethod
    def _calculate_freight_amount(dc: DispatchChallan) -> Decimal:
        """Calculate total freight amount based on rate and quantity"""
        if not dc.freight_rate_value:
            return Decimal('0.00')

        total_qty = dc.get_total_dispatch_qty()

        if dc.freight_rate_type == 'PER_KM':
            return total_qty * dc.freight_rate_value
        elif dc.freight_rate_type == 'FLAT':
            return dc.freight_rate_value

        return Decimal('0.00')

    @staticmethod
    def _generate_dc_number() -> str:
        """Generate unique DC number"""
        from datetime import datetime

        prefix = "DC"
        date_part = datetime.now().strftime("%Y%m%d")
        count = DispatchChallan.objects.filter(
            dc_no__startswith=f"{prefix}-{date_part}"
        ).count()
        return f"{prefix}-{date_part}-{count + 1:04d}"

    @staticmethod
    def release_dispatch_challan(dc: DispatchChallan) -> DispatchChallan:
        """Release DC for shipment"""
        if dc.status != 'DRAFT':
            raise ValidationError(f"Cannot release DC in {dc.status} status")

        logger.info(f"Releasing DC {dc.dc_no}")
        dc.release()
        return dc

    @staticmethod
    def mark_dispatch_delivered(dc: DispatchChallan) -> DispatchChallan:
        """Mark DC as delivered"""
        if dc.status != 'RELEASED':
            raise ValidationError(f"Cannot deliver DC in {dc.status} status")

        logger.info(f"Marking DC {dc.dc_no} as delivered")
        dc.mark_delivered()
        return dc


class InvoiceService:
    """Service for invoice verification and processing."""

    @staticmethod
    @transaction.atomic
    def process_invoice_check(
        dc: DispatchChallan,
        invoice_file,
        invoice_number: str,
        invoice_date,
        total_value_upload: Decimal,
    ) -> SalesInvoiceCheck:
        """
        Process invoice check: compare uploaded invoice against SO totals.
        Flags variance if exceeds tolerance.

        Args:
            dc: DispatchChallan instance
            invoice_file: Uploaded invoice file
            invoice_number: Invoice number from document
            invoice_date: Invoice date
            total_value_upload: Total amount from uploaded invoice

        Returns:
            SalesInvoiceCheck instance
        """
        logger.info(f"Processing invoice {invoice_number} for DC {dc.dc_no}")

        # Calculate SO total for linked DC lines
        so_total = InvoiceService._calculate_so_total_for_dc(dc)

        # Calculate variance
        variance = (total_value_upload - so_total).copy_abs()
        variance_percent = (variance / so_total * Decimal('100')) if so_total > 0 else Decimal('0')

        # Determine flag
        variance_flag = (
            'WITHIN_TOLERANCE'
            if variance_percent <= INVOICE_VARIANCE_TOLERANCE
            else 'REQUIRES_REVIEW'
        )

        invoice_check = SalesInvoiceCheck.objects.create(
            invoice_check_id=InvoiceService._generate_invoice_check_id(),
            dc_reference=dc,
            statutory_invoice_upload=invoice_file,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            total_value_upload=total_value_upload,
            total_value_so=so_total,
            variance_amount=variance,
            variance_flag=variance_flag,
        )

        logger.info(
            f"Invoice check created: {invoice_check.invoice_check_id} "
            f"(variance: {variance_percent}%)"
        )
        return invoice_check

    @staticmethod
    def _calculate_so_total_for_dc(dc: DispatchChallan) -> Decimal:
        """Calculate SO total for items in DC"""
        total = Decimal('0.00')
        for dc_line in dc.dc_lines.all():
            if dc_line.linked_so_line:
                total += dc_line.linked_so_line.get_line_total()
        return total

    @staticmethod
    def _generate_invoice_check_id() -> str:
        """Generate unique invoice check ID"""
        from datetime import datetime

        prefix = "INV"
        date_part = datetime.now().strftime("%Y%m%d")
        count = SalesInvoiceCheck.objects.filter(
            invoice_check_id__startswith=f"{prefix}-{date_part}"
        ).count()
        return f"{prefix}-{date_part}-{count + 1:04d}"

    @staticmethod
    @transaction.atomic
    def accept_invoice(
        invoice_check: SalesInvoiceCheck,
        accepted_by,
    ) -> SalesInvoiceCheck:
        """
        Accept invoice: triggers stock deduction and creates receivable entry.

        Args:
            invoice_check: SalesInvoiceCheck instance
            accepted_by: User/StakeholderUser accepting the invoice

        Returns:
            Updated SalesInvoiceCheck
        """
        logger.info(f"Accepting invoice {invoice_check.invoice_check_id}")

        # Accept invoice
        invoice_check.accept(accepted_by)

        # Trigger stock deduction via inventory ledger
        InvoiceService._deduct_inventory(invoice_check.dc_reference)

        # Create receivable ledger entry
        InvoiceService._create_receivable_entry(invoice_check)

        logger.info(f"Invoice {invoice_check.invoice_check_id} accepted and processed")
        return invoice_check

    @staticmethod
    def _deduct_inventory(dc: DispatchChallan) -> None:
        """Deduct inventory based on dispatch challan"""
        from inventory.models import InventoryLedger

        for dc_line in dc.dc_lines.all():
            InventoryLedger.objects.create(
                product=dc_line.product,
                warehouse=dc.warehouse,
                movement_type='OUT',
                quantity=-dc_line.quantity_dispatched,
                reference_type='DISPATCH',
                reference_id=dc.id,
            )
        logger.info(f"Inventory deducted for DC {dc.dc_no}")

    @staticmethod
    def _create_receivable_entry(invoice_check: SalesInvoiceCheck) -> ReceivableLedger:
        """Create receivable ledger entry from invoice"""
        from master.models import Customer

        # Get customer from DC's SO
        so_lines = invoice_check.dc_reference.dc_lines.all()
        if not so_lines.first():
            raise ValidationError("No SO lines linked to DC")

        customer = so_lines.first().linked_so_line.so.customer

        # Determine due date (30 days default)
        due_date = invoice_check.invoice_date + timedelta(days=30)

        receivable = ReceivableLedger.objects.create(
            customer=customer,
            invoice_reference=invoice_check,
            invoice_date=invoice_check.invoice_date,
            due_date=due_date,
            amount=invoice_check.total_value_upload,
            balance=invoice_check.total_value_upload,
            payment_status='NOT_DUE',
        )

        logger.info(f"Created receivable {receivable.id} for customer {customer.name}")
        return receivable


class FreightService:
    """Service for outbound freight advice management."""

    @staticmethod
    @transaction.atomic
    def create_outbound_freight_advice(
        dc: DispatchChallan,
        transporter_id: int,
        freight_type: str,
        base_amount: Decimal,
        discount: Decimal = Decimal('0'),
        loading_wages: Decimal = Decimal('0'),
        unloading_wages: Decimal = Decimal('0'),
        shipment_quantity: Decimal = None,
        quantity_uom: str = "",
        destination_state: str = "",
        created_by=None,
    ) -> FreightAdviceOutbound:
        """
        Create outbound freight advice.

        Args:
            dc: DispatchChallan instance
            transporter_id: Transporter ID
            freight_type: Type of freight (LOCAL_DRAYAGE/LINEHAUL)
            base_amount: Base freight amount
            discount: Discount amount
            loading_wages: Loading charges
            unloading_wages: Unloading charges
            shipment_quantity: Shipment quantity
            quantity_uom: Unit of measure
            destination_state: Destination state
            created_by: User creating the advice

        Returns:
            FreightAdviceOutbound instance
        """
        from master.models import Transporter

        logger.info(f"Creating freight advice for DC {dc.dc_no}")

        transporter = Transporter.objects.get(id=transporter_id)

        # Calculate payable amount
        payable = (
            base_amount
            - discount
            + loading_wages
            + unloading_wages
        )

        advice = FreightAdviceOutbound.objects.create(
            advice_no=FreightService._generate_advice_number(),
            dispatch_challan=dc,
            transporter=transporter,
            freight_type=freight_type,
            created_by=created_by,
            base_amount=base_amount,
            discount=discount,
            loading_wages_amount=loading_wages,
            unloading_wages_amount=unloading_wages,
            shipment_quantity=shipment_quantity,
            quantity_uom=quantity_uom,
            destination_state=destination_state,
            payable_amount=payable,
        )

        # Link to DC
        dc.freight_advice_link = advice
        dc.save(update_fields=['freight_advice_link'])

        logger.info(f"Created freight advice {advice.advice_no}")
        return advice

    @staticmethod
    def _generate_advice_number() -> str:
        """Generate unique freight advice number"""
        from datetime import datetime

        prefix = "FADV"
        date_part = datetime.now().strftime("%Y%m%d")
        count = FreightAdviceOutbound.objects.filter(
            advice_no__startswith=f"{prefix}-{date_part}"
        ).count()
        return f"{prefix}-{date_part}-{count + 1:04d}"

    @staticmethod
    def approve_freight_advice(advice: FreightAdviceOutbound) -> FreightAdviceOutbound:
        """Approve freight advice"""
        if advice.status != 'DRAFT':
            raise ValidationError(f"Cannot approve advice in {advice.status} status")

        logger.info(f"Approving freight advice {advice.advice_no}")
        advice.approve()
        return advice

    @staticmethod
    def mark_freight_paid(advice: FreightAdviceOutbound) -> FreightAdviceOutbound:
        """Mark freight advice as paid"""
        if advice.status != 'APPROVED':
            raise ValidationError(f"Cannot mark paid advice in {advice.status} status")

        logger.info(f"Marking freight advice {advice.advice_no} as paid")
        advice.mark_paid()
        return advice


class ReceivableService:
    """Service for managing accounts receivable."""

    @staticmethod
    @transaction.atomic
    def record_payment_received(
        receivable: ReceivableLedger,
        amount: Decimal,
    ) -> ReceivableLedger:
        """
        Record payment received against receivable.

        Args:
            receivable: ReceivableLedger instance
            amount: Payment amount

        Returns:
            Updated ReceivableLedger
        """
        if amount <= 0:
            raise ValidationError("Payment amount must be positive")

        if amount > receivable.balance:
            raise ValidationError(
                f"Payment amount ({amount}) exceeds balance ({receivable.balance})"
            )

        logger.info(
            f"Recording payment of {amount} for receivable {receivable.id}"
        )
        receivable.record_payment(amount)

        return receivable

    @staticmethod
    def create_reminder(
        receivable: ReceivableLedger,
        reminder_date,
        reminder_method: str,
        reminder_sent_by=None,
    ) -> ReminderDate:
        """
        Create reminder for overdue receivable.

        Args:
            receivable: ReceivableLedger instance
            reminder_date: Date for reminder
            reminder_method: EMAIL/CALL
            reminder_sent_by: User sending reminder

        Returns:
            ReminderDate instance
        """
        logger.info(
            f"Creating {reminder_method} reminder for {receivable.customer.name}"
        )

        reminder = ReminderDate.objects.create(
            ledger=receivable,
            reminder_date=reminder_date,
            reminder_method=reminder_method,
            reminder_sent_by=reminder_sent_by,
        )

        return reminder

    @staticmethod
    def check_and_escalate_overdue() -> Dict[str, int]:
        """
        Check all receivables and escalate overdue ones.

        Returns:
            Dict with count of escalated receivables
        """
        logger.info("Checking and escalating overdue receivables")

        overdue_ledgers = ReceivableLedger.objects.filter(
            payment_status__in=['NOT_DUE', 'PARTIALLY_PAID'],
            escalation_flag=False
        )

        count_checked = 0
        count_escalated = 0

        for ledger in overdue_ledgers:
            count_checked += 1
            ledger.check_escalation()
            if ledger.escalation_flag:
                count_escalated += 1

        logger.info(
            f"Escalation check complete: {count_checked} checked, "
            f"{count_escalated} escalated"
        )

        return {
            'checked': count_checked,
            'escalated': count_escalated,
        }
