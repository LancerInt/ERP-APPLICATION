"""Query selectors for production app."""
from django.db.models import Q, Sum, F, DecimalField, Prefetch
from django.utils import timezone
from decimal import Decimal

from .models import (
    BOMRequest, WorkOrder, ProductionYieldLog, MaterialIssue, WageVoucher
)


class BOMRequestSelector:
    """Selectors for BOM request queries."""

    @staticmethod
    def get_pending_bom_requests(warehouse=None):
        """Get all pending BOM requests."""
        query = BOMRequest.objects.filter(
            approval_status__in=['DRAFT', 'PENDING'],
            is_active=True
        ).select_related(
            'warehouse', 'requested_by', 'production_template', 'output_product'
        ).prefetch_related('inputs')

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.order_by('-request_date')

    @staticmethod
    def get_bom_with_shortfall(warehouse=None):
        """Get BOM requests with material shortfalls."""
        query = BOMRequest.objects.filter(
            is_active=True
        ).select_related(
            'warehouse', 'production_template'
        ).prefetch_related(
            Prefetch('inputs', queryset=BOMRequest.objects.filter(inputs__shortfall_qty__gt=0))
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query

    @staticmethod
    def get_approved_bom_requests(start_date=None, end_date=None):
        """Get approved BOM requests within date range."""
        query = BOMRequest.objects.filter(
            approval_status='APPROVED',
            is_active=True
        ).select_related(
            'warehouse', 'requested_by', 'approved_by'
        )

        if start_date:
            query = query.filter(request_date__gte=start_date)
        if end_date:
            query = query.filter(request_date__lte=end_date)

        return query.order_by('-approved_date')


class WorkOrderSelector:
    """Selectors for work order queries."""

    @staticmethod
    def get_active_work_orders(warehouse=None, stage=None):
        """Get active work orders not in closed state."""
        query = WorkOrder.objects.filter(
            stage_status__in=['MATERIAL_ISSUE', 'MIXING', 'PACKING', 'QC'],
            is_active=True
        ).select_related(
            'warehouse', 'production_template', 'linked_sales_order'
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)
        if stage:
            query = query.filter(stage_status=stage)

        return query.order_by('-created_at')

    @staticmethod
    def get_open_work_orders(warehouse=None):
        """Get all open (non-closed) work orders."""
        return WorkOrderSelector.get_active_work_orders(warehouse)

    @staticmethod
    def get_work_orders_by_stage(warehouse, stage):
        """Get work orders in specific stage."""
        return WorkOrder.objects.filter(
            warehouse=warehouse,
            stage_status=stage,
            is_active=True
        ).select_related(
            'production_template',
            'linked_sales_order'
        )

    @staticmethod
    def get_overdue_work_orders(warehouse=None):
        """Get work orders past planned completion date."""
        now = timezone.now().date()
        query = WorkOrder.objects.filter(
            planned_end_date__lt=now,
            stage_status__in=['MATERIAL_ISSUE', 'MIXING', 'PACKING', 'QC'],
            is_active=True
        ).select_related(
            'warehouse', 'production_template'
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.order_by('planned_end_date')

    @staticmethod
    def get_rework_batches(parent_batch=None):
        """Get rework batches."""
        query = WorkOrder.objects.filter(
            rework_flag=True,
            is_active=True
        ).select_related(
            'parent_batch',
            'production_template'
        )

        if parent_batch:
            query = query.filter(parent_batch=parent_batch)

        return query

    @staticmethod
    def get_work_orders_by_sales_order(sales_order):
        """Get work orders linked to a sales order."""
        return WorkOrder.objects.filter(
            linked_sales_order=sales_order,
            is_active=True
        ).select_related(
            'production_template',
            'warehouse'
        )

    @staticmethod
    def get_work_orders_pending_qc(warehouse=None):
        """Get work orders awaiting QC."""
        query = WorkOrder.objects.filter(
            stage_status='QC',
            is_active=True
        ).select_related(
            'production_template',
            'warehouse'
        ).prefetch_related(
            'output_products',
            'qc_request'
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query

    @staticmethod
    def get_closed_work_orders(warehouse=None, start_date=None, end_date=None):
        """Get closed work orders within date range."""
        query = WorkOrder.objects.filter(
            stage_status='CLOSED',
            is_active=True
        ).select_related(
            'warehouse', 'production_template'
        )

        if warehouse:
            query = query.filter(warehouse=warehouse)
        if start_date:
            query = query.filter(actual_end_date__gte=start_date)
        if end_date:
            query = query.filter(actual_end_date__lte=end_date)

        return query.order_by('-actual_end_date')


class ProductionYieldSelector:
    """Selectors for yield and performance reports."""

    @staticmethod
    def get_yield_report(warehouse=None, start_date=None, end_date=None):
        """Get yield logs for reporting."""
        query = ProductionYieldLog.objects.select_related(
            'work_order', 'product'
        )

        if warehouse:
            query = query.filter(work_order__warehouse=warehouse)
        if start_date:
            query = query.filter(report_date__gte=start_date)
        if end_date:
            query = query.filter(report_date__lte=end_date)

        return query.order_by('-report_date')

    @staticmethod
    def get_product_yield_trends(product, warehouse=None, months=3):
        """Get yield trends for a product over months."""
        from datetime import timedelta
        cutoff_date = timezone.now() - timedelta(days=30 * months)

        query = ProductionYieldLog.objects.filter(
            product=product,
            report_date__gte=cutoff_date
        ).select_related('work_order')

        if warehouse:
            query = query.filter(work_order__warehouse=warehouse)

        return query.order_by('report_date')

    @staticmethod
    def get_yield_variance_summary(warehouse, start_date=None, end_date=None):
        """Get summary of yield variances."""
        query = ProductionYieldLog.objects.filter(
            work_order__warehouse=warehouse
        ).values(
            'product__product_code',
            'product__product_name'
        ).annotate(
            total_planned=Sum('planned_yield'),
            total_actual=Sum('actual_output_qty'),
            avg_variance=Sum('variance') / Sum('actual_output_qty'),
            count=Sum(1)
        )

        if start_date:
            query = query.filter(report_date__gte=start_date)
        if end_date:
            query = query.filter(report_date__lte=end_date)

        return query

    @staticmethod
    def get_low_yield_batches(warehouse=None, variance_threshold=Decimal('-10.00')):
        """Get batches with low yield (variance below threshold)."""
        query = ProductionYieldLog.objects.filter(
            variance__lt=variance_threshold
        ).select_related(
            'work_order', 'product'
        )

        if warehouse:
            query = query.filter(work_order__warehouse=warehouse)

        return query.order_by('variance')


class MaterialIssueSelector:
    """Selectors for material issue queries."""

    @staticmethod
    def get_pending_material_issues(warehouse=None):
        """Get material issues awaiting approval."""
        query = MaterialIssue.objects.filter(
            approved_by__isnull=True,
            is_active=True
        ).select_related(
            'warehouse', 'work_order', 'issued_by'
        ).prefetch_related('issue_lines')

        if warehouse:
            query = query.filter(warehouse=warehouse)

        return query.order_by('-issue_date')

    @staticmethod
    def get_material_issues_by_work_order(work_order):
        """Get all material issues for a work order."""
        return MaterialIssue.objects.filter(
            work_order=work_order,
            is_active=True
        ).select_related(
            'warehouse', 'issued_by'
        ).prefetch_related(
            'issue_lines__product',
            'issue_lines__godown'
        )

    @staticmethod
    def get_material_issues_by_date_range(warehouse, start_date, end_date):
        """Get material issues within date range."""
        return MaterialIssue.objects.filter(
            warehouse=warehouse,
            issue_date__date__gte=start_date,
            issue_date__date__lte=end_date,
            is_active=True
        ).select_related(
            'work_order', 'issued_by'
        ).order_by('-issue_date')


class WageVoucherSelector:
    """Selectors for wage voucher queries."""

    @staticmethod
    def get_pending_wage_vouchers(warehouse=None):
        """Get wage vouchers pending approval."""
        query = WageVoucher.objects.filter(
            status__in=['DRAFT', 'PENDING'],
            is_active=True
        ).select_related(
            'work_order', 'prepared_by', 'contractor_vendor'
        )

        if warehouse:
            query = query.filter(work_order__warehouse=warehouse)

        return query.order_by('-prepared_date')

    @staticmethod
    def get_unpaid_wage_vouchers(warehouse=None):
        """Get approved but unpaid wage vouchers."""
        query = WageVoucher.objects.filter(
            status__in=['APPROVED'],
            is_active=True
        ).select_related(
            'work_order', 'prepared_by'
        )

        if warehouse:
            query = query.filter(work_order__warehouse=warehouse)

        return query.order_by('-prepared_date')

    @staticmethod
    def get_wage_vouchers_by_work_order(work_order):
        """Get all wage vouchers for a work order."""
        return WageVoucher.objects.filter(
            work_order=work_order,
            is_active=True
        ).select_related(
            'prepared_by', 'contractor_vendor'
        ).prefetch_related('hours_tasks', 'staff_group')

    @staticmethod
    def get_wage_summary(warehouse, start_date=None, end_date=None):
        """Get wage expenditure summary."""
        query = WageVoucher.objects.filter(
            work_order__warehouse=warehouse,
            status__in=['APPROVED', 'PAID'],
            is_active=True
        ).values(
            'work_order__batch_id'
        ).annotate(
            total_wages=Sum('amount'),
            total_tds=Sum('tds'),
            net_wages=Sum(F('amount') - F('tds'), output_field=DecimalField())
        )

        if start_date:
            query = query.filter(prepared_date__gte=start_date)
        if end_date:
            query = query.filter(prepared_date__lte=end_date)

        return query
