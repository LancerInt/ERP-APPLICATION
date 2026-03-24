"""Business logic services for purchase app."""

from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, F, Q
from django.core.exceptions import ValidationError

from .models import (
    PurchaseRequest, PRLine, PRApprovalTrail,
    RFQHeader, QuoteResponse, QuoteLine,
    QuoteEvaluation, ComparisonEntry, EvalApprovalTrail,
    PurchaseOrder, POLine, POETAUpdate,
    ReceiptAdvice, ReceiptLine,
    VendorPaymentAdvice, PaymentTaxComponent
)


class PurchaseRequestService:
    """Service for managing purchase requests."""

    @staticmethod
    @transaction.atomic
    def create_purchase_request(
        warehouse,
        requested_by,
        requirement_type,
        priority='MEDIUM',
        required_by_date=None,
        justification='',
        visibility_scope=None,
        notes='',
        godown=None
    ):
        """Create a new purchase request."""
        if visibility_scope is None:
            visibility_scope = {}

        pr = PurchaseRequest.objects.create(
            warehouse=warehouse,
            requested_by=requested_by,
            requestor_role=requested_by.role if hasattr(requested_by, 'role') else 'User',
            requirement_type=requirement_type,
            priority=priority,
            required_by_date=required_by_date,
            justification=justification,
            visibility_scope=visibility_scope,
            notes=notes,
            godown=godown,
            approval_status='DRAFT'
        )
        return pr

    @staticmethod
    @transaction.atomic
    def add_pr_lines(purchase_request, lines_data: List[Dict]):
        """Add line items to a purchase request."""
        created_lines = []
        line_no = 1

        for line_data in lines_data:
            line = PRLine.objects.create(
                purchase_request=purchase_request,
                line_no=line_no,
                product_service=line_data['product_service'],
                description_override=line_data.get('description_override', ''),
                quantity_requested=line_data['quantity_requested'],
                uom=line_data.get('uom', 'PCS'),
                required_date=line_data.get('required_date'),
                purpose=line_data.get('purpose', 'PRODUCTION'),
                machine_reference=line_data.get('machine_reference'),
                allow_rfq_skip=line_data.get('allow_rfq_skip', False),
                status='PENDING'
            )
            created_lines.append(line)
            line_no += 1

        return created_lines

    @staticmethod
    @transaction.atomic
    def approve_purchase_request(
        purchase_request,
        actor,
        partial=False,
        approved_line_quantities: Optional[Dict] = None,
        remarks=''
    ):
        """Approve a purchase request (fully or partially)."""
        if partial and approved_line_quantities:
            # Partial approval
            for line_id, approved_qty in approved_line_quantities.items():
                try:
                    line = PRLine.objects.get(id=line_id, purchase_request=purchase_request)
                    if approved_qty > line.quantity_requested:
                        raise ValidationError(
                            f"Approved quantity exceeds requested for line {line.line_no}"
                        )
                    line.approved_quantity = approved_qty
                    line.status = 'APPROVED'
                    line.save()
                except PRLine.DoesNotExist:
                    raise ValidationError(f"Line {line_id} not found")

            purchase_request.approval_status = 'PARTIALLY_APPROVED'
        else:
            # Full approval
            for line in purchase_request.lines.all():
                line.approved_quantity = line.quantity_requested
                line.status = 'APPROVED'
                line.save()

            purchase_request.approval_status = 'APPROVED'

        purchase_request.save(update_fields=['approval_status'])

        # Log approval trail
        PRApprovalTrail.objects.create(
            purchase_request=purchase_request,
            action='PARTIAL' if partial else 'APPROVED',
            actor=actor,
            remarks=remarks
        )

        return purchase_request

    @staticmethod
    @transaction.atomic
    def reject_purchase_request(purchase_request, actor, remarks=''):
        """Reject a purchase request."""
        for line in purchase_request.lines.all():
            line.status = 'REJECTED'
            line.save()

        purchase_request.approval_status = 'REJECTED'
        purchase_request.save(update_fields=['approval_status'])

        PRApprovalTrail.objects.create(
            purchase_request=purchase_request,
            action='REJECTED',
            actor=actor,
            remarks=remarks
        )

        return purchase_request


class RFQService:
    """Service for managing RFQs."""

    @staticmethod
    @transaction.atomic
    def generate_rfq_from_pr(
        purchase_requests: List[PurchaseRequest],
        created_by,
        rfq_mode='EMAIL',
        quote_count_expected=3
    ) -> RFQHeader:
        """Generate RFQ from approved PR lines."""
        # Validate PRs are approved
        for pr in purchase_requests:
            if pr.approval_status not in ['APPROVED', 'PARTIALLY_APPROVED']:
                raise ValidationError(
                    f"PR {pr.pr_no} is not approved for RFQ generation"
                )

        rfq = RFQHeader.objects.create(
            created_by=created_by,
            rfq_mode=rfq_mode,
            rfq_status='OPEN',
            quote_count_expected=quote_count_expected,
            skip_rfq_flag=False
        )

        # Link PRs to RFQ
        rfq.linked_prs.set(purchase_requests)

        return rfq

    @staticmethod
    @transaction.atomic
    def close_rfq(rfq: RFQHeader, remarks=''):
        """Close an RFQ."""
        rfq.rfq_status = 'CLOSED'
        rfq.save(update_fields=['rfq_status'])
        return rfq

    @staticmethod
    @transaction.atomic
    def create_quote_response(
        rfq: RFQHeader,
        vendor,
        price_valid_till,
        currency='INR',
        freight_terms='',
        payment_terms='',
        delivery_terms='',
        lead_time_days=0,
        remarks='',
        quote_lines_data: Optional[List[Dict]] = None
    ) -> QuoteResponse:
        """Create a quote response from vendor."""
        quote = QuoteResponse.objects.create(
            rfq=rfq,
            vendor=vendor,
            price_valid_till=price_valid_till,
            currency=currency,
            freight_terms=freight_terms,
            payment_terms=payment_terms,
            delivery_terms=delivery_terms,
            lead_time_days=lead_time_days,
            remarks=remarks
        )

        if quote_lines_data:
            for line_data in quote_lines_data:
                QuoteLine.objects.create(
                    quote=quote,
                    pr_line=line_data['pr_line'],
                    product_service=line_data['product_service'],
                    specification=line_data.get('specification', ''),
                    quantity_offered=line_data['quantity_offered'],
                    uom=line_data.get('uom', 'PCS'),
                    unit_price=line_data['unit_price'],
                    discount=line_data.get('discount', Decimal('0.00')),
                    gst=line_data.get('gst', Decimal('0.00')),
                    freight_charge=line_data.get('freight_charge', Decimal('0.00')),
                    delivery_timeline=line_data.get('delivery_timeline', 0)
                )

        return quote


class QuoteEvaluationService:
    """Service for quote evaluation."""

    @staticmethod
    @transaction.atomic
    def evaluate_quotes(
        rfq: RFQHeader,
        evaluated_by,
        comparison_data: List[Dict]
    ) -> QuoteEvaluation:
        """Evaluate quotes and create comparison."""
        evaluation = QuoteEvaluation.objects.create(
            rfq=rfq,
            evaluated_by=evaluated_by,
            approval_status='PENDING'
        )

        best_score = Decimal('0.00')
        best_vendor = None

        for comp_data in comparison_data:
            vendor = comp_data['vendor']
            score = comp_data.get('score', Decimal('0.00'))

            ComparisonEntry.objects.create(
                evaluation=evaluation,
                vendor=vendor,
                total_cost=comp_data['total_cost'],
                lead_time=comp_data.get('lead_time', 0),
                freight_terms=comp_data.get('freight_terms', ''),
                payment_terms=comp_data.get('payment_terms', ''),
                score=score,
                remarks=comp_data.get('remarks', '')
            )

            if score > best_score:
                best_score = score
                best_vendor = vendor

        evaluation.best_quote_flag = True
        evaluation.recommended_vendor = best_vendor
        evaluation.save(update_fields=['best_quote_flag', 'recommended_vendor'])

        return evaluation

    @staticmethod
    @transaction.atomic
    def approve_evaluation(
        evaluation: QuoteEvaluation,
        actor,
        remarks=''
    ) -> QuoteEvaluation:
        """Approve evaluation and mark best quote."""
        evaluation.approval_status = 'APPROVED'
        evaluation.save(update_fields=['approval_status'])

        # Mark chosen quote
        best_entry = evaluation.comparison_entries.order_by('-score').first()
        if best_entry:
            quotes = QuoteResponse.objects.filter(
                rfq=evaluation.rfq,
                vendor=best_entry.vendor
            )
            quotes.update(chosen_flag=True)

        EvalApprovalTrail.objects.create(
            evaluation=evaluation,
            actor=actor,
            action='APPROVED',
            remarks=remarks
        )

        return evaluation


class PurchaseOrderService:
    """Service for PO management."""

    @staticmethod
    @transaction.atomic
    def create_po_from_evaluation(
        evaluation: QuoteEvaluation,
        company,
        warehouse,
        created_by,
        freight_terms='',
        payment_terms='',
        currency='INR'
    ) -> PurchaseOrder:
        """Create PO from approved quote evaluation."""
        if evaluation.approval_status != 'APPROVED':
            raise ValidationError("Evaluation must be approved before PO creation")

        if not evaluation.recommended_vendor:
            raise ValidationError("No recommended vendor in evaluation")

        # Get the chosen quote
        chosen_quote = QuoteResponse.objects.filter(
            rfq=evaluation.rfq,
            vendor=evaluation.recommended_vendor,
            chosen_flag=True
        ).first()

        if not chosen_quote:
            raise ValidationError("No chosen quote found for vendor")

        po = PurchaseOrder.objects.create(
            vendor=evaluation.recommended_vendor,
            company=company,
            warehouse=warehouse,
            linked_rfq=evaluation.rfq,
            created_by=created_by,
            freight_terms=freight_terms,
            payment_terms=payment_terms,
            currency=currency,
            status='DRAFT'
        )

        # Create PO lines from quote lines
        line_no = 1
        for q_line in chosen_quote.quote_lines.all():
            POLine.objects.create(
                po=po,
                line_no=line_no,
                product_service=q_line.product_service,
                description=q_line.specification,
                quantity_ordered=q_line.quantity_offered,
                uom=q_line.uom,
                unit_price=q_line.unit_price,
                discount=q_line.discount,
                gst=q_line.gst,
                freight_estimate=q_line.freight_charge,
                linked_pr_line=q_line.pr_line,
                linked_rfq_line=q_line
            )
            line_no += 1

        # Link PRs to PO
        po.linked_prs.set(evaluation.rfq.linked_prs.all())

        return po

    @staticmethod
    @transaction.atomic
    def approve_po(po: PurchaseOrder, actor) -> PurchaseOrder:
        """Approve a PO."""
        po.status = 'APPROVED'
        po.save(update_fields=['status'])
        return po

    @staticmethod
    @transaction.atomic
    def issue_po(po: PurchaseOrder, actor) -> PurchaseOrder:
        """Issue a PO (ready to send to vendor)."""
        if po.status != 'APPROVED':
            raise ValidationError("PO must be approved before issuing")

        po.status = 'ISSUED'
        po.save(update_fields=['status'])
        return po

    @staticmethod
    @transaction.atomic
    def amend_po(
        po: PurchaseOrder,
        amended_data: Dict,
        actor
    ) -> PurchaseOrder:
        """Create amendment to PO (creates new revision)."""
        # Create new revision
        po.revision_no += 1
        for key, value in amended_data.items():
            if hasattr(po, key):
                setattr(po, key, value)
        po.updated_by = actor
        po.save()

        return po


class ReceiptService:
    """Service for receipt/GRN management."""

    @staticmethod
    @transaction.atomic
    def create_receipt_advice(
        purchase_order: PurchaseOrder,
        warehouse,
        godown,
        vendor,
        vehicle_number='',
        driver_name='',
        qc_routing='WAREHOUSE',
        remarks=''
    ) -> ReceiptAdvice:
        """Create goods receipt advice."""
        receipt = ReceiptAdvice.objects.create(
            warehouse=warehouse,
            godown=godown,
            vendor=vendor,
            vehicle_number=vehicle_number,
            driver_name=driver_name,
            qc_routing=qc_routing,
            remarks=remarks,
            qc_status='PENDING'
        )

        receipt.linked_pos.add(purchase_order)

        return receipt

    @staticmethod
    @transaction.atomic
    def add_receipt_lines(
        receipt: ReceiptAdvice,
        receipt_lines_data: List[Dict]
    ):
        """Add lines to receipt advice."""
        created_lines = []
        line_no = 1

        for line_data in receipt_lines_data:
            line = ReceiptLine.objects.create(
                receipt=receipt,
                line_no=line_no,
                po_line=line_data['po_line'],
                product=line_data['product'],
                batch_no=line_data.get('batch_no', ''),
                expiry_date=line_data.get('expiry_date'),
                quantity_received=line_data['quantity_received'],
                uom=line_data.get('uom', 'PCS'),
                extra_commission=line_data.get('extra_commission', Decimal('0.00')),
                agent_commission=line_data.get('agent_commission', Decimal('0.00')),
                godown_location=line_data['godown_location'],
                remarks=line_data.get('remarks', '')
            )
            created_lines.append(line)
            line_no += 1

        return created_lines

    @staticmethod
    @transaction.atomic
    def process_qc_result(
        receipt: ReceiptAdvice,
        qc_results: Dict[int, Tuple[Decimal, Decimal]]
    ):
        """Process QC results: {line_id: (accepted_qty, rejected_qty)}."""
        for line_id, (accepted, rejected) in qc_results.items():
            try:
                line = ReceiptLine.objects.get(
                    receipt=receipt,
                    line_no=line_id
                )
                line.quantity_accepted = accepted
                line.quantity_rejected = rejected
                line.save()
            except ReceiptLine.DoesNotExist:
                raise ValidationError(f"Line {line_id} not found in receipt")

        # Update receipt QC status
        all_lines_processed = all(
            line.quantity_accepted is not None
            for line in receipt.receipt_lines.all()
        )

        if all_lines_processed:
            receipt.qc_status = 'PASS'
            receipt.save(update_fields=['qc_status'])

        return receipt


class PaymentService:
    """Service for payment processing."""

    @staticmethod
    @transaction.atomic
    def generate_payment_advice(
        vendor,
        source_document_type: str,
        source_document_id,
        amount: Decimal,
        due_date,
        payment_method='BANK_TRANSFER',
        prepared_by=None,
        tax_components: Optional[List[Dict]] = None
    ) -> VendorPaymentAdvice:
        """Generate payment advice based on document."""
        advice = VendorPaymentAdvice.objects.create(
            vendor=vendor,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            amount=amount,
            due_date=due_date,
            payment_method=payment_method,
            prepared_by=prepared_by,
            status='DRAFT'
        )

        # Add tax components if provided
        if tax_components:
            for tax_data in tax_components:
                PaymentTaxComponent.objects.create(
                    advice=advice,
                    tax_type=tax_data['tax_type'],
                    rate=tax_data['rate'],
                    amount=tax_data['amount']
                )

        return advice

    @staticmethod
    @transaction.atomic
    def approve_payment_advice(advice: VendorPaymentAdvice, actor) -> VendorPaymentAdvice:
        """Approve a payment advice."""
        advice.status = 'APPROVED'
        advice.save(update_fields=['status'])
        return advice

    @staticmethod
    @transaction.atomic
    def mark_payment_done(advice: VendorPaymentAdvice, actor) -> VendorPaymentAdvice:
        """Mark payment as done."""
        advice.status = 'PAID'
        advice.save(update_fields=['status'])
        return advice
