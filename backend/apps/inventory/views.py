"""Views for inventory application."""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rbac.permissions import HasModulePermission
from django.db.models import Q

from .models import (
    InventoryLedger,
    StockTransferDC,
    StockTransferReceipt,
    WarehouseShifting,
    JobWorkOrder,
    JobWorkDC,
    JobWorkReceipt,
    SalesReturnAdvice,
    StockAdjustment,
)
from .serializers import (
    InventoryLedgerSerializer,
    StockTransferDCSerializer,
    StockTransferReceiptSerializer,
    WarehouseShiftingSerializer,
    JobWorkOrderSerializer,
    JobWorkDCSerializer,
    JobWorkReceiptSerializer,
    SalesReturnAdviceSerializer,
    StockAdjustmentSerializer,
)
from .services import InventoryService
from .selectors import InventorySelector


class InventoryLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for InventoryLedger (read-only - append-only)."""

    queryset = InventoryLedger.objects.select_related(
        'warehouse',
        'godown',
        'product'
    ).filter(is_active=True)
    serializer_class = InventoryLedgerSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Stock Transfer'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'warehouse',
        'godown',
        'product',
        'transaction_type',
        'status',
        'batch'
    ]
    search_fields = ['ledger_entry_id', 'batch', 'product__name']
    ordering_fields = ['transaction_date', 'created_at']
    ordering = ['-transaction_date']

    @action(detail=False, methods=['post'])
    def record_entry(self, request):
        """Record a new inventory ledger entry."""
        try:
            entry = InventoryService.record_stock_entry(
                warehouse_id=request.data.get('warehouse_id'),
                godown_id=request.data.get('godown_id'),
                product_id=request.data.get('product_id'),
                batch=request.data.get('batch'),
                quantity_in=request.data.get('quantity_in', 0),
                quantity_out=request.data.get('quantity_out', 0),
                uom=request.data.get('uom'),
                transaction_type=request.data.get('transaction_type'),
                source_document_type=request.data.get('source_document_type'),
                source_document_id=request.data.get('source_document_id'),
                cost=request.data.get('cost'),
                transaction_date=request.data.get('transaction_date'),
                created_by=request.user,
                remarks=request.data.get('remarks', '')
            )
            serializer = self.get_serializer(entry)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class StockTransferDCViewSet(viewsets.ModelViewSet):
    """ViewSet for StockTransferDC."""

    queryset = StockTransferDC.objects.prefetch_related('lines').filter(is_active=True)
    serializer_class = StockTransferDCSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Stock Transfer'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['from_warehouse', 'to_warehouse', 'status']
    ordering_fields = ['created_date', 'dispatch_date']
    ordering = ['-created_date']

    @action(detail=True, methods=['post'], url_path='mark-dispatched')
    def mark_dispatched(self, request, pk=None):
        """Mark transfer as dispatched."""
        transfer = self.get_object()
        if transfer.status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT transfers can be dispatched'},
                status=status.HTTP_400_BAD_REQUEST
            )
        transfer.status = 'IN_TRANSIT'
        transfer.dispatch_date = request.data.get('dispatch_date')
        transfer.save(update_fields=['status', 'dispatch_date', 'updated_at', 'updated_by'])
        return Response(self.get_serializer(transfer).data)


class StockTransferReceiptViewSet(viewsets.ModelViewSet):
    """ViewSet for StockTransferReceipt."""

    queryset = StockTransferReceipt.objects.prefetch_related(
        'lines',
        'freight_details',
        'loading_unloading_wages'
    ).filter(is_active=True)
    serializer_class = StockTransferReceiptSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Transfer Receipt'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['from_warehouse', 'to_warehouse', 'status']
    ordering_fields = ['receipt_date']
    ordering = ['-receipt_date']

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete transfer receipt and create ledger entries."""
        receipt = self.get_object()
        if receipt.status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT receipts can be completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            InventoryService.receive_stock_transfer(receipt, request.user)
            return Response(
                {'message': 'Transfer receipt completed'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class WarehouseShiftingViewSet(viewsets.ModelViewSet):
    """ViewSet for WarehouseShifting."""

    queryset = WarehouseShifting.objects.prefetch_related(
        'products',
        'freight_wages'
    ).filter(is_active=True)
    serializer_class = WarehouseShiftingSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Shifting'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'status', 'reason_code']
    ordering_fields = ['request_date']
    ordering = ['-request_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve warehouse shifting request."""
        shifting = self.get_object()
        if shifting.status != 'PENDING_APPROVAL':
            return Response(
                {'error': 'Only PENDING_APPROVAL shifting can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        shifting.status = 'APPROVED'
        shifting.save(update_fields=['status', 'updated_at', 'updated_by'])
        return Response(self.get_serializer(shifting).data)


class JobWorkOrderViewSet(viewsets.ModelViewSet):
    """ViewSet for JobWorkOrder."""

    queryset = JobWorkOrder.objects.prefetch_related(
        'materials_supplied',
        'outputs_expected'
    ).filter(is_active=True)
    serializer_class = JobWorkOrderSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Job Work Order'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'vendor', 'status']
    ordering_fields = ['start_date']
    ordering = ['-start_date']

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start job work order execution."""
        order = self.get_object()
        if order.status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT orders can be started'},
                status=status.HTTP_400_BAD_REQUEST
            )
        order.status = 'IN_PROGRESS'
        order.save(update_fields=['status', 'updated_at', 'updated_by'])
        return Response(self.get_serializer(order).data)


class JobWorkDCViewSet(viewsets.ModelViewSet):
    """ViewSet for JobWorkDC."""

    queryset = JobWorkDC.objects.prefetch_related('issued_materials').filter(is_active=True)
    serializer_class = JobWorkDCSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Job Work DC'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['job_work_order', 'vendor', 'status']
    ordering_fields = ['dispatch_date']
    ordering = ['-dispatch_date']


class JobWorkReceiptViewSet(viewsets.ModelViewSet):
    """ViewSet for JobWorkReceipt."""

    queryset = JobWorkReceipt.objects.prefetch_related(
        'returned_goods',
        'charges'
    ).filter(is_active=True)
    serializer_class = JobWorkReceiptSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Job Work Receipt'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['job_work_order', 'vendor', 'status']
    ordering_fields = ['receipt_date']
    ordering = ['-receipt_date']

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete job work receipt."""
        receipt = self.get_object()
        if receipt.status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT receipts can be completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        receipt.status = 'COMPLETED'
        receipt.save(update_fields=['status', 'updated_at', 'updated_by'])
        return Response(self.get_serializer(receipt).data)


class SalesReturnAdviceViewSet(viewsets.ModelViewSet):
    """ViewSet for SalesReturnAdvice."""

    queryset = SalesReturnAdvice.objects.prefetch_related(
        'lines',
        'freight_charges',
        'loading_unloading_charges',
        'approval_trails'
    ).filter(is_active=True)
    serializer_class = SalesReturnAdviceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Sales Return'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['customer', 'approval_status']
    ordering_fields = ['return_date']
    ordering = ['-return_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve sales return."""
        advice = self.get_object()
        if advice.approval_status != 'PENDING':
            return Response(
                {'error': 'Only PENDING advice can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            InventoryService.process_sales_return(advice, request.user)
            return Response(
                {'message': 'Sales return approved'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class StockAdjustmentViewSet(viewsets.ModelViewSet):
    """ViewSet for StockAdjustment."""

    queryset = StockAdjustment.objects.filter(is_active=True)
    serializer_class = StockAdjustmentSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Stock Adjustment'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'product', 'adjustment_type', 'approval_status']
    ordering_fields = ['adjustment_date']
    ordering = ['-adjustment_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve stock adjustment."""
        adjustment = self.get_object()
        if adjustment.approval_status != 'PENDING':
            return Response(
                {'error': 'Only PENDING adjustments can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            InventoryService.approve_stock_adjustment(
                adjustment,
                request.user,
                request.data.get('approval_remarks', '')
            )
            return Response(
                {'message': 'Stock adjustment approved'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
