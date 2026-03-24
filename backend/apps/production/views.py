"""API views for production app."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rbac.permissions import HasModulePermission
from django.db import transaction
from django.utils import timezone

from .models import (
    BOMRequest, MaterialIssue, WorkOrder, WageVoucher, ProductionYieldLog
)
from .serializers import (
    BOMRequestListSerializer, BOMRequestDetailSerializer, BOMRequestCreateSerializer,
    MaterialIssueListSerializer, MaterialIssueDetailSerializer, MaterialIssueCreateSerializer,
    WorkOrderListSerializer, WorkOrderDetailSerializer, WorkOrderCreateSerializer,
    WageVoucherListSerializer, WageVoucherDetailSerializer, WageVoucherCreateSerializer,
    ProductionYieldLogSerializer, DamageReportSerializer, InputConsumptionSerializer,
    OutputProductSerializer
)
from .services import (
    BOMRequestService, MaterialIssueService, WorkOrderService,
    WageVoucherService, ProductionReportService
)
from .selectors import (
    BOMRequestSelector, WorkOrderSelector, ProductionYieldSelector, MaterialIssueSelector,
    WageVoucherSelector
)


class BOMRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for BOM request management."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'BOM Request'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'approval_status', 'requested_by']
    search_fields = ['request_no', 'output_product__product_code', 'output_product__product_name']
    ordering_fields = ['request_date', 'approval_status']
    ordering = ['-request_date']

    def get_queryset(self):
        user = self.request.user
        base_query = BOMRequest.objects.select_related(
            'warehouse', 'requested_by', 'approved_by', 'production_template', 'output_product'
        ).prefetch_related('inputs')

        # Filter by user's warehouse scope if applicable
        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(warehouse__in=warehouses)

        return base_query

    def get_serializer_class(self):
        if self.action == 'create':
            return BOMRequestCreateSerializer
        elif self.action == 'retrieve':
            return BOMRequestDetailSerializer
        return BOMRequestListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create new BOM request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user.stakeholder_profile
        bom_request = BOMRequestService.create_bom_request(
            warehouse=serializer.validated_data['warehouse'],
            requested_by=user,
            production_template=serializer.validated_data['production_template'],
            output_product=serializer.validated_data['output_product'],
            output_quantity=serializer.validated_data['output_quantity'],
            required_completion_date=serializer.validated_data.get('required_completion_date'),
            notes=serializer.validated_data.get('notes', '')
        )

        return Response(
            BOMRequestDetailSerializer(bom_request).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve(self, request, pk=None):
        """Approve BOM request."""
        bom_request = self.get_object()
        user = request.user.stakeholder_profile

        if bom_request.approval_status != 'PENDING':
            return Response(
                {'error': f'Cannot approve {bom_request.approval_status} request'},
                status=status.HTTP_400_BAD_REQUEST
            )

        bom_request = BOMRequestService.approve_bom_request(bom_request, user)
        return Response(
            BOMRequestDetailSerializer(bom_request).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject BOM request."""
        bom_request = self.get_object()
        user = request.user.stakeholder_profile

        bom_request = BOMRequestService.reject_bom_request(bom_request, user)
        return Response(
            BOMRequestDetailSerializer(bom_request).data,
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending BOM requests."""
        warehouse = request.query_params.get('warehouse')
        queryset = BOMRequestSelector.get_pending_bom_requests(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class MaterialIssueViewSet(viewsets.ModelViewSet):
    """ViewSet for material issue management."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Material Issue'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'work_order']
    ordering_fields = ['issue_date']
    ordering = ['-issue_date']

    def get_queryset(self):
        user = self.request.user
        base_query = MaterialIssue.objects.select_related(
            'warehouse', 'work_order', 'issued_by', 'approved_by'
        ).prefetch_related('issue_lines')

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(warehouse__in=warehouses)

        return base_query

    def get_serializer_class(self):
        if self.action == 'create':
            return MaterialIssueCreateSerializer
        elif self.action == 'retrieve':
            return MaterialIssueDetailSerializer
        return MaterialIssueListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create material issue."""
        serializer = MaterialIssueCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user.stakeholder_profile
        issue_lines = request.data.get('issue_lines', [])

        material_issue = MaterialIssueService.create_material_issue(
            warehouse=serializer.validated_data['warehouse'],
            work_order=serializer.validated_data['work_order'],
            issued_by=user,
            issue_lines_data=issue_lines,
            remarks=serializer.validated_data.get('remarks', '')
        )

        return Response(
            MaterialIssueDetailSerializer(material_issue).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve material issue."""
        material_issue = self.get_object()
        user = request.user.stakeholder_profile

        material_issue = MaterialIssueService.approve_material_issue(material_issue, user)
        return Response(
            MaterialIssueDetailSerializer(material_issue).data,
            status=status.HTTP_200_OK
        )


class WorkOrderViewSet(viewsets.ModelViewSet):
    """ViewSet for work order management."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Work Order'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'stage_status', 'rework_flag']
    search_fields = ['batch_id', 'work_order_no', 'production_template__template_name']
    ordering_fields = ['created_at', 'planned_start_date']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        base_query = WorkOrder.objects.select_related(
            'warehouse', 'production_template', 'linked_sales_order', 'qc_request'
        ).prefetch_related(
            'input_consumptions', 'output_products', 'material_issues', 'wage_vouchers'
        )

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(warehouse__in=warehouses)

        return base_query

    def get_serializer_class(self):
        if self.action == 'create':
            return WorkOrderCreateSerializer
        elif self.action == 'retrieve':
            return WorkOrderDetailSerializer
        return WorkOrderListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create work order."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        work_order = WorkOrderService.create_work_order(
            warehouse=serializer.validated_data['warehouse'],
            production_template=serializer.validated_data['production_template'],
            planned_start_date=serializer.validated_data['planned_start_date'],
            planned_end_date=serializer.validated_data.get('planned_end_date'),
            linked_sales_order=serializer.validated_data.get('linked_sales_order'),
            linked_dispatch_challan=serializer.validated_data.get('linked_dispatch_challan'),
            wage_method=serializer.validated_data.get('wage_method', 'TEMPLATE_RATE'),
            notes=serializer.validated_data.get('notes', '')
        )

        return Response(
            WorkOrderDetailSerializer(work_order).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def advance_stage(self, request, pk=None):
        """Advance work order to next stage."""
        work_order = self.get_object()
        new_stage = request.data.get('stage')

        if not new_stage:
            return Response(
                {'error': 'Stage is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        work_order = WorkOrderService.advance_stage(work_order, new_stage)
        return Response(
            WorkOrderDetailSerializer(work_order).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def record_output(self, request, pk=None):
        """Record output product."""
        work_order = self.get_object()
        data = request.data

        output = WorkOrderService.record_output(
            work_order=work_order,
            product=data['product'],
            batch_id=data['batch_id'],
            quantity_produced=data['quantity_produced'],
            uom=data['uom'],
            purity=data.get('purity'),
            ai_content=data.get('ai_content')
        )

        return Response(
            OutputProductSerializer(output).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def request_rework(self, request, pk=None):
        """Request rework for batch."""
        work_order = self.get_object()
        data = request.data

        rework_batch = WorkOrderService.request_rework(
            work_order=work_order,
            description=data.get('description', ''),
            quantity_to_rework=data['quantity_to_rework']
        )

        return Response(
            WorkOrderListSerializer(rework_batch).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active work orders."""
        warehouse = request.query_params.get('warehouse')
        stage = request.query_params.get('stage')
        queryset = WorkOrderSelector.get_active_work_orders(warehouse, stage)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue work orders."""
        warehouse = request.query_params.get('warehouse')
        queryset = WorkOrderSelector.get_overdue_work_orders(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_qc(self, request):
        """Get work orders awaiting QC."""
        warehouse = request.query_params.get('warehouse')
        queryset = WorkOrderSelector.get_work_orders_pending_qc(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class WageVoucherViewSet(viewsets.ModelViewSet):
    """ViewSet for wage voucher management."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Wage Voucher'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['work_order__warehouse', 'status', 'wage_type']
    ordering_fields = ['prepared_date', 'amount']
    ordering = ['-prepared_date']

    def get_queryset(self):
        user = self.request.user
        base_query = WageVoucher.objects.select_related(
            'work_order', 'prepared_by', 'contractor_vendor'
        ).prefetch_related('hours_tasks', 'staff_group')

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(work_order__warehouse__in=warehouses)

        return base_query

    def get_serializer_class(self):
        if self.action == 'create':
            return WageVoucherCreateSerializer
        elif self.action == 'retrieve':
            return WageVoucherDetailSerializer
        return WageVoucherListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create wage voucher."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user.stakeholder_profile
        wage_voucher = WageVoucherService.create_wage_voucher(
            work_order=serializer.validated_data['work_order'],
            wage_type=serializer.validated_data['wage_type'],
            prepared_by=user,
            contractor_vendor=serializer.validated_data.get('contractor_vendor'),
            amount=serializer.validated_data.get('amount'),
            tds=serializer.validated_data.get('tds'),
            remarks=serializer.validated_data.get('remarks', '')
        )

        return Response(
            WageVoucherDetailSerializer(wage_voucher).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve wage voucher."""
        wage_voucher = self.get_object()

        if wage_voucher.status != 'PENDING':
            return Response(
                {'error': f'Cannot approve {wage_voucher.status} voucher'},
                status=status.HTTP_400_BAD_REQUEST
            )

        wage_voucher = WageVoucherService.approve_wage_voucher(wage_voucher)
        return Response(
            WageVoucherDetailSerializer(wage_voucher).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark wage voucher as paid."""
        wage_voucher = self.get_object()

        wage_voucher = WageVoucherService.mark_wage_paid(wage_voucher)
        return Response(
            WageVoucherDetailSerializer(wage_voucher).data,
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending wage vouchers."""
        warehouse = request.query_params.get('warehouse')
        queryset = WageVoucherSelector.get_pending_wage_vouchers(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ProductionYieldLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for production yield logs."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Yield Log'
    serializer_class = ProductionYieldLogSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['work_order', 'product']
    ordering_fields = ['report_date']
    ordering = ['-report_date']

    def get_queryset(self):
        user = self.request.user
        base_query = ProductionYieldLog.objects.select_related('work_order', 'product')

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(work_order__warehouse__in=warehouses)

        return base_query

    @action(detail=False, methods=['get'])
    def yield_report(self, request):
        """Get yield report."""
        warehouse_id = request.query_params.get('warehouse')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        queryset = ProductionYieldSelector.get_yield_report(warehouse_id, start_date, end_date)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def variance_summary(self, request):
        """Get yield variance summary."""
        warehouse_id = request.query_params.get('warehouse')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        summary = ProductionYieldSelector.get_yield_variance_summary(
            warehouse_id, start_date, end_date
        )
        return Response(list(summary))
