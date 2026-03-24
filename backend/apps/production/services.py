"""Business logic services for production app."""
import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, F, Q

from .models import (
    BOMRequest, BOMInput, MaterialIssue, IssueLine, WorkOrder,
    InputConsumption, OutputProduct, WorkOrderWageVoucherLink,
    WageVoucher, HoursTask, ProductionYieldLog, DamageReport
)


class BOMRequestService:
    """Service for BOM request operations."""

    @staticmethod
    @transaction.atomic
    def create_bom_request(warehouse, requested_by, production_template,
                          output_product, output_quantity, required_completion_date=None, notes=''):
        """Create a new BOM request and auto-calculate inputs from template."""
        request_no = f"BOM-{uuid.uuid4().hex[:8].upper()}"

        bom_request = BOMRequest.objects.create(
            request_no=request_no,
            warehouse=warehouse,
            requested_by=requested_by,
            production_template=production_template,
            output_product=output_product,
            output_quantity=output_quantity,
            required_completion_date=required_completion_date,
            notes=notes
        )

        # Auto-calculate inputs from template
        BOMRequestService._populate_inputs_from_template(bom_request, production_template, output_quantity)

        return bom_request

    @staticmethod
    def _populate_inputs_from_template(bom_request, template, output_qty):
        """Populate BOMInput items from template specifications."""
        # This assumes template has a method/relationship to get component requirements
        # Adjust based on actual TemplateLibrary model structure
        if hasattr(template, 'get_component_requirements'):
            requirements = template.get_component_requirements()
            for requirement in requirements:
                required_qty = requirement['qty_required'] * output_qty / requirement['output_qty']
                BOMInput.objects.create(
                    bom_request=bom_request,
                    product=requirement['product'],
                    required_qty=required_qty,
                    available_qty=Decimal('0.0000'),
                    shortfall_qty=required_qty,
                    purpose=requirement['purpose']
                )

    @staticmethod
    @transaction.atomic
    def approve_bom_request(bom_request, approved_by):
        """Approve BOM request and trigger shortfall PR creation if needed."""
        bom_request.mark_approved(approved_by)

        # Create purchase requisition for shortfall items
        shortfall_inputs = bom_request.inputs.filter(shortfall_qty__gt=0)
        if shortfall_inputs.exists():
            BOMRequestService._create_purchase_requisition(bom_request, shortfall_inputs)

        return bom_request

    @staticmethod
    def _create_purchase_requisition(bom_request, shortfall_inputs):
        """Create purchase requisition for items in shortfall."""
        # Implementation would depend on purchase app structure
        # Placeholder for purchase requisition creation
        pass

    @staticmethod
    def reject_bom_request(bom_request, rejected_by):
        """Reject BOM request."""
        bom_request.mark_rejected(rejected_by)
        return bom_request


class MaterialIssueService:
    """Service for material issue operations."""

    @staticmethod
    @transaction.atomic
    def create_material_issue(warehouse, work_order, issued_by, issue_lines_data, remarks=''):
        """Create a material issue with associated line items."""
        issue_no = f"MI-{uuid.uuid4().hex[:8].upper()}"

        material_issue = MaterialIssue.objects.create(
            issue_no=issue_no,
            warehouse=warehouse,
            work_order=work_order,
            issued_by=issued_by,
            remarks=remarks
        )

        # Create issue lines
        for line_data in issue_lines_data:
            IssueLine.objects.create(
                issue=material_issue,
                product=line_data['product'],
                batch_out=line_data.get('batch_out', ''),
                godown=line_data['godown'],
                quantity_issued=line_data['quantity_issued'],
                uom=line_data['uom'],
                reserved_for_template=line_data.get('reserved_for_template', False)
            )

        # Mark work order as started if not already
        if not work_order.actual_start_date:
            work_order.mark_started()

        return material_issue

    @staticmethod
    def approve_material_issue(material_issue, approved_by):
        """Approve material issue."""
        material_issue.approved_by = approved_by
        material_issue.save(update_fields=['approved_by', 'updated_at'])
        return material_issue


class WorkOrderService:
    """Service for work order operations."""

    @staticmethod
    @transaction.atomic
    def create_work_order(warehouse, production_template, planned_start_date,
                         planned_end_date=None, linked_sales_order=None,
                         linked_dispatch_challan=None, wage_method='TEMPLATE_RATE', notes=''):
        """Create a new work order."""
        batch_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
        work_order_no = f"WO-{uuid.uuid4().hex[:8].upper()}"

        work_order = WorkOrder.objects.create(
            batch_id=batch_id,
            work_order_no=work_order_no,
            warehouse=warehouse,
            production_template=production_template,
            planned_start_date=planned_start_date,
            planned_end_date=planned_end_date,
            linked_sales_order=linked_sales_order,
            linked_dispatch_challan=linked_dispatch_challan,
            wage_method=wage_method,
            notes=notes
        )

        return work_order

    @staticmethod
    @transaction.atomic
    def advance_stage(work_order, new_stage):
        """Advance work order to next stage."""
        if new_stage in dict(WorkOrder.STAGE_CHOICES):
            work_order.advance_stage(new_stage)

            if new_stage == 'CLOSED':
                work_order.actual_end_date = timezone.now()
                work_order.save(update_fields=['actual_end_date', 'updated_at'])

        return work_order

    @staticmethod
    @transaction.atomic
    def record_output(work_order, product, batch_id, quantity_produced, uom,
                     purity=None, ai_content=None):
        """Record output product and create stock entry."""
        output = OutputProduct.objects.create(
            work_order=work_order,
            product=product,
            batch_id=batch_id,
            quantity_produced=quantity_produced,
            uom=uom,
            purity=purity,
            ai_content=ai_content
        )

        # Calculate yield and create yield log
        planned_qty = work_order.input_consumptions.filter(
            product=product
        ).aggregate(total=Sum('planned_qty'))['total'] or Decimal('0.0000')

        variance = quantity_produced - planned_qty if planned_qty else quantity_produced

        ProductionYieldLog.objects.create(
            work_order=work_order,
            product=product,
            planned_yield=planned_qty if planned_qty > 0 else None,
            actual_output_qty=quantity_produced,
            purity=purity,
            ai_content=ai_content,
            variance=variance
        )

        return output

    @staticmethod
    @transaction.atomic
    def request_rework(work_order, description, quantity_to_rework):
        """Create a rework batch linked to parent batch."""
        # Create damage report for original batch
        DamageReport.objects.create(
            work_order=work_order,
            stage=work_order.stage_status,
            description=description,
            quantity_lost=quantity_to_rework,
            handling_action='REWORK'
        )

        # Create new rework work order
        rework_batch = WorkOrderService.create_work_order(
            warehouse=work_order.warehouse,
            production_template=work_order.production_template,
            planned_start_date=timezone.now().date(),
            wage_method=work_order.wage_method,
            notes=f"Rework for {work_order.batch_id}"
        )
        rework_batch.parent_batch = work_order
        rework_batch.rework_flag = True
        rework_batch.save(update_fields=['parent_batch', 'rework_flag', 'updated_at'])

        return rework_batch


class WageVoucherService:
    """Service for wage voucher operations."""

    @staticmethod
    @transaction.atomic
    def create_wage_voucher(work_order, wage_type, prepared_by, amount=None,
                           contractor_vendor=None, tds=None, remarks=''):
        """Create a wage voucher for work order."""
        voucher_no = f"WV-{uuid.uuid4().hex[:8].upper()}"

        # Auto-calculate amount from template if not provided
        if not amount and wage_type == 'TEMPLATE_RATE':
            amount = WageVoucherService._calculate_wage_from_template(work_order)

        wage_voucher = WageVoucher.objects.create(
            voucher_no=voucher_no,
            work_order=work_order,
            wage_type=wage_type,
            contractor_vendor=contractor_vendor,
            amount=amount or Decimal('0.00'),
            tds=tds,
            prepared_by=prepared_by,
            remarks=remarks
        )

        return wage_voucher

    @staticmethod
    def _calculate_wage_from_template(work_order):
        """Calculate wage amount from production template."""
        # Implementation depends on TemplateLibrary structure
        # Placeholder for wage calculation logic
        return Decimal('0.00')

    @staticmethod
    @transaction.atomic
    def approve_wage_voucher(wage_voucher, approved_by=None):
        """Approve wage voucher."""
        wage_voucher.status = 'APPROVED'
        wage_voucher.save(update_fields=['status', 'updated_at'])
        return wage_voucher

    @staticmethod
    @transaction.atomic
    def mark_wage_paid(wage_voucher):
        """Mark wage voucher as paid."""
        wage_voucher.status = 'PAID'
        wage_voucher.save(update_fields=['status', 'updated_at'])
        return wage_voucher

    @staticmethod
    @transaction.atomic
    def add_hours_task(wage_voucher, staff=None, task_description='',
                       hours_worked=None, quantity_produced=None):
        """Add task hours to wage voucher."""
        hours_task = HoursTask.objects.create(
            voucher=wage_voucher,
            staff=staff,
            task_description=task_description,
            hours_worked=hours_worked,
            quantity_produced=quantity_produced
        )
        return hours_task


class InputConsumptionService:
    """Service for tracking input consumption."""

    @staticmethod
    @transaction.atomic
    def record_consumption(work_order, product, planned_qty, actual_qty, uom,
                          batch_used, godown, yield_loss=None):
        """Record actual input consumption."""
        consumption = InputConsumption.objects.create(
            work_order=work_order,
            product=product,
            planned_qty=planned_qty,
            actual_qty=actual_qty,
            uom=uom,
            batch_used=batch_used,
            godown=godown,
            yield_loss=yield_loss
        )
        return consumption


class ProductionReportService:
    """Service for production reporting and analytics."""

    @staticmethod
    def get_yield_report(warehouse, start_date=None, end_date=None):
        """Generate yield report for specified period."""
        query = ProductionYieldLog.objects.filter(work_order__warehouse=warehouse)

        if start_date:
            query = query.filter(report_date__gte=start_date)
        if end_date:
            query = query.filter(report_date__lte=end_date)

        return query.select_related('work_order', 'product')

    @staticmethod
    def get_work_order_summary(work_order):
        """Get comprehensive summary of work order performance."""
        return {
            'batch_id': work_order.batch_id,
            'stage': work_order.stage_status,
            'planned_duration': (work_order.planned_end_date - work_order.planned_start_date).days if work_order.planned_end_date else None,
            'actual_duration': (work_order.actual_end_date - work_order.actual_start_date).days if work_order.actual_end_date and work_order.actual_start_date else None,
            'total_inputs': work_order.input_consumptions.count(),
            'total_outputs': work_order.output_products.count(),
            'qc_status': work_order.output_products.values('qc_status').annotate(count=Sum('quantity_produced')),
            'total_yield_variance': work_order.yield_logs.aggregate(total=Sum('variance'))['total'] or Decimal('0.0000'),
        }
