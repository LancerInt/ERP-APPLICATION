"""ViewSets for purchase app API endpoints."""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone

from rbac.permissions import HasModulePermission, check_permission
from rbac.models import AuditLog, UserRoleAssignment

from .models import (
    PurchaseRequest, PRLine, RFQHeader, QuoteResponse, QuoteLine,
    QuoteEvaluation, ComparisonEntry, PurchaseOrder, POLine,
    ReceiptAdvice, VendorPaymentAdvice
)
from .serializers import (
    PurchaseRequestSerializer, RFQHeaderSerializer,
    QuoteResponseSerializer, QuoteEvaluationSerializer,
    PurchaseOrderSerializer, ReceiptAdviceSerializer,
    VendorPaymentAdviceSerializer
)
from .services import (
    PurchaseRequestService, RFQService, QuoteEvaluationService,
    PurchaseOrderService, ReceiptService, PaymentService
)
from .selectors import (
    PurchaseRequestSelectors, RFQSelectors, QuoteSelectors,
    PurchaseOrderSelectors, ReceiptSelectors, PaymentSelectors
)
from .quote_parser import QuoteParser


def get_user_role_name(user):
    """Get ERP role name for audit logging."""
    try:
        return UserRoleAssignment.objects.get(user=user).role.name
    except Exception:
        return 'Unknown'


class PurchaseRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for Purchase Requests."""

    queryset = PurchaseRequest.objects.all()
    serializer_class = PurchaseRequestSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Purchase Request'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = [
        'approval_status', 'warehouse', 'priority',
        'requirement_type', 'requested_by'
    ]
    search_fields = ['pr_no', 'justification']
    ordering_fields = ['request_date', 'required_by_date', 'priority']
    ordering = ['-request_date']

    @action(detail=False, methods=['post'])
    def pending_for_warehouse(self, request):
        """Get pending PRs for a warehouse."""
        warehouse_id = request.query_params.get('warehouse_id')
        days = request.query_params.get('days', 30)

        if not warehouse_id:
            return Response(
                {'error': 'warehouse_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        prs = PurchaseRequestSelectors.get_pending_prs_for_warehouse(
            warehouse_id, int(days)
        )
        serializer = self.get_serializer(prs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a line item to this PR."""
        pr = self.get_object()
        if pr.approval_status == 'APPROVED':
            return Response({'error': 'Cannot add lines to approved request'}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        line_no = pr.lines.count() + 1
        product_id = data.get('product_service') or data.get('product')
        qty = data.get('quantity_requested', data.get('quantity', 1))

        if not product_id:
            return Response({'error': 'product_service is required'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import PRLine
        from master.models import Product
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_400_BAD_REQUEST)

        line = PRLine.objects.create(
            purchase_request=pr,
            line_no=data.get('line_no', line_no),
            product_service=product,
            quantity_requested=qty,
            uom=data.get('uom', product.uom or 'KG'),
            description_override=data.get('description_override', data.get('description', '')),
            purpose=data.get('purpose', ''),
            status='PENDING',
        )

        from .serializers import PRLineSerializer
        return Response(PRLineSerializer(line).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='update-line/(?P<line_id>[^/.]+)')
    def update_line(self, request, pk=None, line_id=None):
        """Update a line item on this PR."""
        pr = self.get_object()
        if pr.approval_status == 'APPROVED':
            return Response({'error': 'Cannot update lines on approved request'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            line = pr.lines.get(id=line_id)
            data = request.data
            if 'quantity_requested' in data:
                line.quantity_requested = data['quantity_requested']
            if 'uom' in data:
                line.uom = data['uom']
            if 'description_override' in data:
                line.description_override = data['description_override']
            if 'purpose' in data:
                line.purpose = data['purpose']
            if 'product_service' in data:
                from master.models import Product
                line.product_service = Product.objects.get(pk=data['product_service'])
            line.save()
            from .serializers import PRLineSerializer
            return Response(PRLineSerializer(line).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], url_path='remove-line/(?P<line_id>[^/.]+)')
    def remove_line(self, request, pk=None, line_id=None):
        """Remove a line item from this PR."""
        pr = self.get_object()
        if pr.approval_status == 'APPROVED':
            return Response({'error': 'Cannot remove lines from approved request'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            line = pr.lines.get(id=line_id)
            line.delete()
            return Response({'message': 'Line removed'})
        except Exception:
            return Response({'error': 'Line not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='edit')
    def edit_record(self, request, pk=None):
        """Mark PR as edited after modifications."""
        pr = self.get_object()
        if pr.approval_status == 'APPROVED':
            return Response(
                {'error': 'Cannot edit an approved request'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update fields from request.data
        serializer = self.get_serializer(pr, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Change status to EDITED
        pr.approval_status = 'EDITED'
        pr.save(update_fields=['approval_status'])

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            role_name=get_user_role_name(request.user),
            module_name='Purchase Request',
            action='EDIT',
            details=f'PR {pr.pr_no} edited and saved'
        )

        return Response(self.get_serializer(pr).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve PR and auto-create RFQ."""
        pr = self.get_object()

        # Validate state - must be EDITED or PENDING_APPROVAL
        if pr.approval_status not in ('EDITED', 'PENDING_APPROVAL', 'PENDING'):
            return Response(
                {'error': 'Only edited or pending requests can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already approved
        if pr.approval_status == 'APPROVED':
            return Response(
                {'error': 'Already approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check permission
        if not check_permission(request.user, 'Purchase Request', 'edit'):
            return Response(
                {'error': 'You do not have approval permission'},
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            # Approve the PR
            pr.approval_status = 'APPROVED'
            pr.approved_by = request.user
            pr.approved_at = timezone.now()
            pr.save(update_fields=['approval_status', 'approved_by', 'approved_at'])

            # Approve lines if service is available and user has stakeholder profile
            try:
                stakeholder = getattr(request.user, 'stakeholder_user', None)
                if stakeholder:
                    partial = request.data.get('partial', False)
                    approved_lines = request.data.get('approved_lines', {})
                    remarks = request.data.get('remarks', '')
                    PurchaseRequestService.approve_purchase_request(
                        pr, stakeholder, partial=partial,
                        approved_line_quantities=approved_lines, remarks=remarks
                    )
            except Exception:
                pass  # Line-level approval is optional

            # Auto-create RFQ from approved PR
            rfq = self._create_rfq_from_pr(pr, request.user)

            # Link RFQ to PR
            if rfq:
                pr.linked_rfq = rfq
                pr.save(update_fields=['linked_rfq'])

            # Audit log
            AuditLog.objects.create(
                user=request.user,
                role_name=get_user_role_name(request.user),
                module_name='Purchase Request',
                action='EDIT',
                details=f'PR {pr.pr_no} approved. RFQ {rfq.rfq_no} auto-created.'
            )

        return Response({
            'message': f'Purchase Request {pr.pr_no} approved successfully',
            'rfq_no': rfq.rfq_no,
            'rfq_id': str(rfq.id),
            'purchase_request': self.get_serializer(pr).data,
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a purchase request."""
        pr = self.get_object()
        if pr.approval_status == 'APPROVED':
            return Response(
                {'error': 'Cannot reject an approved request'},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '')

        with transaction.atomic():
            pr = PurchaseRequestService.reject_purchase_request(
                pr,
                request.user.stakeholder_user,
                remarks=remarks
            )

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            role_name=get_user_role_name(request.user),
            module_name='Purchase Request',
            action='EDIT',
            details=f'PR {pr.pr_no} rejected. Reason: {remarks}'
        )

        serializer = self.get_serializer(pr)
        return Response({
            'message': f'PR {pr.pr_no} rejected',
            'purchase_request': serializer.data,
        })

    def _create_rfq_from_pr(self, pr, user):
        """Auto-create RFQ from approved Purchase Request."""
        try:
            # Try using the RFQService if stakeholder profile exists
            stakeholder = getattr(user, 'stakeholder_user', None)
            if stakeholder:
                rfq = RFQService.generate_rfq_from_pr(
                    purchase_requests=[pr],
                    created_by=stakeholder,
                    rfq_mode='EMAIL',
                    quote_count_expected=3,
                )
                return rfq
        except Exception:
            pass

        # Fallback: create RFQ directly
        from django.utils import timezone as tz
        year = tz.now().year
        prefix = f'RFQ-{year}-'
        last = RFQHeader.objects.filter(rfq_no__startswith=prefix).order_by('-rfq_no').first()
        if last:
            try:
                num = int(last.rfq_no.split('-')[-1]) + 1
            except (ValueError, IndexError):
                num = 1
        else:
            num = 1
        rfq_no = f'{prefix}{num:04d}'

        rfq = RFQHeader(rfq_no=rfq_no, rfq_mode='EMAIL', rfq_status='OPEN', quote_count_expected=3)
        # Set created_by if the field accepts User or StakeholderUser
        try:
            rfq.created_by = getattr(user, 'stakeholder_user', None) or user
        except Exception:
            pass
        rfq.save()

        # Link PR to RFQ
        if hasattr(rfq, 'linked_prs'):
            rfq.linked_prs.add(pr)

        return rfq

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get PR summary for warehouse."""
        warehouse_id = request.query_params.get('warehouse_id')
        days = request.query_params.get('days', 30)

        if not warehouse_id:
            return Response(
                {'error': 'warehouse_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        summary = PurchaseRequestSelectors.get_pr_summary_for_warehouse(
            warehouse_id, int(days)
        )
        return Response(list(summary))


class RFQHeaderViewSet(viewsets.ModelViewSet):
    """ViewSet for RFQ Headers."""

    queryset = RFQHeader.objects.all()
    serializer_class = RFQHeaderSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'RFQ'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['rfq_status', 'rfq_mode', 'created_by']
    search_fields = ['rfq_no']
    ordering_fields = ['creation_date', 'rfq_status']
    ordering = ['-creation_date']

    def perform_create(self, serializer):
        """Set created_by to current user."""
        serializer.save(
            created_by=self.request.user.stakeholder_user
        )

    @action(detail=False, methods=['get'])
    def open_rfqs(self, request):
        """Get all open RFQs."""
        rfqs = RFQSelectors.get_open_rfqs()
        serializer = self.get_serializer(rfqs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_evaluation(self, request):
        """Get RFQs pending evaluation."""
        rfqs = RFQSelectors.get_rfqs_pending_evaluation()
        serializer = self.get_serializer(rfqs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='vendors')
    def get_vendors(self, request, pk=None):
        """
        Get auto-aggregated preferred vendors for this RFQ.
        Returns vendors from product preferences on linked PRs,
        plus validation warnings for missing emails.

        GET /api/purchase/rfq/{id}/vendors/
        """
        rfq = self.get_object()
        from purchase.vendor_aggregation import (
            get_rfq_auto_vendors, get_final_vendor_list, validate_vendor_emails
        )

        # Get auto vendors from product preferences
        auto_vendor_list = get_final_vendor_list(rfq)
        valid, errors = validate_vendor_emails(auto_vendor_list)

        return Response({
            'auto_vendors': auto_vendor_list,
            'valid_vendors': valid,
            'warnings': errors,
            'total_count': len(auto_vendor_list),
            'valid_count': len(valid),
        })

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Close an RFQ."""
        rfq = self.get_object()
        remarks = request.data.get('remarks', '')

        with transaction.atomic():
            rfq = RFQService.close_rfq(rfq, remarks)

        serializer = self.get_serializer(rfq)
        return Response(serializer.data)


class QuoteResponseViewSet(viewsets.ModelViewSet):
    """ViewSet for Quote Responses."""

    queryset = QuoteResponse.objects.all()
    serializer_class = QuoteResponseSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Quote'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['rfq', 'vendor', 'chosen_flag']
    search_fields = ['quote_id', 'vendor__name']
    ordering_fields = ['quote_date', 'evaluation_score']
    ordering = ['-quote_date']

    @action(detail=False, methods=['get'])
    def for_rfq(self, request):
        """Get quotes for specific RFQ."""
        rfq_id = request.query_params.get('rfq_id')
        if not rfq_id:
            return Response({'error': 'rfq_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        quotes = QuoteSelectors.get_quotes_for_rfq(rfq_id)
        serializer = self.get_serializer(quotes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a line item to this quote."""
        quote = self.get_object()
        data = request.data
        product_id = data.get('product_service') or data.get('product')
        if not product_id:
            return Response({'error': 'product_service is required'}, status=400)
        from master.models import Product
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=400)
        line = QuoteLine.objects.create(
            quote=quote,
            product_service=product,
            quantity_offered=data.get('quantity_offered', data.get('quantity', 1)),
            uom=data.get('uom', product.uom or 'KG'),
            unit_price=data.get('unit_price', 0),
            specification=data.get('specification', data.get('description', '')),
            gst=data.get('gst', 0),
            discount=data.get('discount', 0),
        )
        from .serializers import QuoteLineSerializer
        return Response(QuoteLineSerializer(line).data, status=201)

    @action(detail=True, methods=['delete'], url_path='remove-line/(?P<line_id>[^/.]+)')
    def remove_line(self, request, pk=None, line_id=None):
        """Remove a line item."""
        quote = self.get_object()
        try:
            line = quote.quote_lines.get(id=line_id)
            line.delete()
            return Response({'message': 'Line removed'})
        except Exception:
            return Response({'error': 'Line not found'}, status=404)


class QuoteEvaluationViewSet(viewsets.ModelViewSet):
    """ViewSet for Quote Evaluations."""

    queryset = QuoteEvaluation.objects.all()
    serializer_class = QuoteEvaluationSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Quote Evaluation'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['rfq', 'approval_status', 'best_quote_flag']
    search_fields = ['evaluation_id']
    ordering_fields = ['evaluation_date', 'approval_status']
    ordering = ['-evaluation_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an evaluation."""
        evaluation = self.get_object()
        remarks = request.data.get('remarks', '')

        with transaction.atomic():
            evaluation = QuoteEvaluationService.approve_evaluation(
                evaluation,
                request.user.stakeholder_user,
                remarks
            )

        serializer = self.get_serializer(evaluation)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending evaluations."""
        evaluations = QuoteSelectors.get_pending_quote_evaluations()
        serializer = self.get_serializer(evaluations, many=True)
        return Response(serializer.data)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """ViewSet for Purchase Orders."""

    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Purchase Order'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = [
        'status', 'vendor', 'warehouse', 'company'
    ]
    search_fields = ['po_no', 'vendor__name']
    ordering_fields = ['po_date', 'expected_delivery_end']
    ordering = ['-po_date']

    @action(detail=False, methods=['get'])
    def open_pos_for_vendor(self, request):
        """Get open POs for a vendor."""
        vendor_id = request.query_params.get('vendor_id')

        if not vendor_id:
            return Response(
                {'error': 'vendor_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pos = PurchaseOrderSelectors.get_open_pos_for_vendor(vendor_id)
        serializer = self.get_serializer(pos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue POs."""
        days = request.query_params.get('days', 7)
        pos = PurchaseOrderSelectors.get_overdue_pos(int(days))
        serializer = self.get_serializer(pos, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a PO."""
        po = self.get_object()

        with transaction.atomic():
            po = PurchaseOrderService.approve_po(
                po,
                request.user.stakeholder_user
            )

        serializer = self.get_serializer(po)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        """Issue a PO."""
        po = self.get_object()

        with transaction.atomic():
            po = PurchaseOrderService.issue_po(
                po,
                request.user.stakeholder_user
            )

        serializer = self.get_serializer(po)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get PO summary for warehouse."""
        warehouse_id = request.query_params.get('warehouse_id')
        days = request.query_params.get('days', 30)

        if not warehouse_id:
            return Response(
                {'error': 'warehouse_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        summary = PurchaseOrderSelectors.get_pos_summary_for_warehouse(
            warehouse_id, int(days)
        )
        return Response(list(summary))


class ReceiptAdviceViewSet(viewsets.ModelViewSet):
    """ViewSet for Receipt Advices."""

    queryset = ReceiptAdvice.objects.all()
    serializer_class = ReceiptAdviceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Receipt Advice'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['qc_status', 'warehouse', 'vendor']
    search_fields = ['receipt_advice_no', 'vehicle_number']
    ordering_fields = ['receipt_date', 'qc_status']
    ordering = ['-receipt_date']

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending receipts."""
        warehouse_id = request.query_params.get('warehouse_id')
        receipts = ReceiptSelectors.get_pending_receipts(warehouse_id)
        serializer = self.get_serializer(receipts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def process_qc(self, request, pk=None):
        """Process QC results for receipt."""
        receipt = self.get_object()
        qc_results = request.data.get('qc_results', {})

        with transaction.atomic():
            receipt = ReceiptService.process_qc_result(
                receipt,
                qc_results
            )

        serializer = self.get_serializer(receipt)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get receipt summary for warehouse."""
        warehouse_id = request.query_params.get('warehouse_id')
        days = request.query_params.get('days', 30)

        if not warehouse_id:
            return Response(
                {'error': 'warehouse_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        summary = ReceiptSelectors.get_receipt_summary_for_warehouse(
            warehouse_id, int(days)
        )
        return Response(list(summary))


class VendorPaymentAdviceViewSet(viewsets.ModelViewSet):
    """ViewSet for Vendor Payment Advices."""

    queryset = VendorPaymentAdvice.objects.all()
    serializer_class = VendorPaymentAdviceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Vendor Payment'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['status', 'vendor', 'payment_method']
    search_fields = ['advice_no', 'vendor__name']
    ordering_fields = ['due_date', 'created_at']
    ordering = ['due_date']

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending payments."""
        advices = PaymentSelectors.get_pending_payments()
        serializer = self.get_serializer(advices, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue payments."""
        days = request.query_params.get('days', 0)
        advices = PaymentSelectors.get_overdue_payments(int(days))
        serializer = self.get_serializer(advices, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a payment advice."""
        advice = self.get_object()

        with transaction.atomic():
            advice = PaymentService.approve_payment_advice(
                advice,
                request.user.stakeholder_user
            )

        serializer = self.get_serializer(advice)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark payment as done."""
        advice = self.get_object()

        with transaction.atomic():
            advice = PaymentService.mark_payment_done(
                advice,
                request.user.stakeholder_user
            )

        serializer = self.get_serializer(advice)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary_by_vendor(self, request):
        """Get payment summary by vendor."""
        summary = PaymentSelectors.get_payment_summary_by_vendor()
        return Response(list(summary))


class FreightAdviceInboundViewSet(viewsets.ModelViewSet):
    """ViewSet for Freight Advice (Inbound)."""
    from .models import FreightAdviceInbound
    from .serializers import FreightAdviceInboundSerializer

    queryset = FreightAdviceInbound.objects.filter(is_active=True)
    serializer_class = FreightAdviceInboundSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Freight Advice'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status']
    ordering = ['-created_at']


class QuoteUploadView(APIView):
    """Upload a quote document (PDF, image, Word, Excel, CSV, TXT) and extract structured data.

    POST /api/purchase/quotes/parse-upload/
    Content-Type: multipart/form-data
    Body: file=<uploaded file>

    Returns JSON with:
        - success: bool indicating if parsing succeeded
        - raw_text: the full extracted text
        - extracted: flat dict of fields (backward-compatible with frontend)
        - extracted_detailed: dict of fields with {value, confidence, source} per key
        - line_items: list of items with per-field confidence scores
        - confidence: 0-100 overall extraction quality score
        - warnings: list of warning messages
        - format: detected file format
        - pages: number of pages (for PDFs)
        - error: (optional) description of any issues
    """

    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {
                    'success': False,
                    'error': 'No file uploaded. Send a file with key "file".',
                    'extracted': {},
                    'extracted_detailed': {},
                    'line_items': [],
                    'warnings': [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size (max 20 MB)
        max_size = 20 * 1024 * 1024
        if file.size > max_size:
            return Response(
                {
                    'success': False,
                    'error': f'File too large ({file.size} bytes). Maximum is {max_size} bytes.',
                    'extracted': {},
                    'extracted_detailed': {},
                    'line_items': [],
                    'warnings': [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = QuoteParser.parse(file, file.name)

        # Return 200 even on parse errors — the frontend checks result.success / result.error
        return Response(result)


class EvaluationDashboardView(APIView):
    """Quote Evaluation Dashboard API.

    GET  /api/purchase/evaluation-dashboard/?pr_id={uuid}
        Returns all related quote responses grouped for comparison.

    POST /api/purchase/evaluation-dashboard/submit/
        Submits evaluation decisions and optionally auto-creates a PO.
    """

    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # GET — fetch comparison data for a Purchase Request
    # ------------------------------------------------------------------
    def get(self, request):
        pr_id = request.query_params.get('pr_id')
        if not pr_id:
            return Response(
                {'error': 'pr_id query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pr = PurchaseRequest.objects.select_related(
                'warehouse'
            ).prefetch_related('lines__product_service').get(pk=pr_id)
        except PurchaseRequest.DoesNotExist:
            return Response(
                {'error': 'Purchase Request not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ---- PR payload ------------------------------------------------
        pr_data = {
            'id': str(pr.id),
            'pr_no': pr.pr_no,
            'warehouse_name': pr.warehouse.name if pr.warehouse else '',
            'priority': pr.priority,
            'approval_status': pr.approval_status,
            'request_date': pr.request_date.date().isoformat() if pr.request_date else None,
            'lines': [
                {
                    'id': str(line.id),
                    'line_no': line.line_no,
                    'product_name': line.product_service.product_name if line.product_service else '',
                    'product_code': line.product_service.sku_code if line.product_service else '',
                    'quantity_requested': float(line.quantity_requested),
                    'uom': line.uom,
                }
                for line in pr.lines.all()
            ],
        }

        # ---- Collect all RFQs linked to this PR -------------------------
        # PR can be linked via PR.linked_rfq (FK) and via RFQHeader.linked_prs M2M
        rfq_ids = set()
        if pr.linked_rfq_id:
            rfq_ids.add(pr.linked_rfq_id)
        for rfq in RFQHeader.objects.filter(linked_prs=pr):
            rfq_ids.add(rfq.id)

        rfqs = RFQHeader.objects.filter(id__in=rfq_ids).prefetch_related(
            'quote_responses__vendor',
            'quote_responses__quote_lines__product_service',
        )

        rfq_list = []
        all_quotes_flat = []  # for the comparison block

        for rfq in rfqs:
            quotes_payload = []
            for quote in rfq.quote_responses.filter(is_active=True):
                lines_payload = []
                quote_total = 0
                for ql in quote.quote_lines.all():
                    lt = float(ql.get_line_total())
                    quote_total += lt
                    lines_payload.append({
                        'id': str(ql.id),
                        'product_name': ql.product_service.product_name if ql.product_service else '',
                        'product_code': ql.product_service.sku_code if ql.product_service else '',
                        'quantity_offered': float(ql.quantity_offered),
                        'uom': ql.uom,
                        'unit_price': float(ql.unit_price),
                        'gst': float(ql.gst),
                        'discount': float(ql.discount),
                        'total': lt,
                    })

                quote_data = {
                    'id': str(quote.id),
                    'quote_id': quote.quote_id,
                    'vendor_name': quote.vendor.vendor_name if quote.vendor else '',
                    'vendor_id': str(quote.vendor_id) if quote.vendor_id else None,
                    'quote_date': quote.quote_date.isoformat() if quote.quote_date else None,
                    'currency': quote.currency,
                    'payment_terms': quote.payment_terms,
                    'delivery_terms': quote.delivery_terms,
                    'lead_time_days': quote.lead_time_days,
                    'chosen_flag': quote.chosen_flag,
                    'evaluation_score': float(quote.evaluation_score) if quote.evaluation_score else None,
                    'total_cost': round(quote_total, 2),
                    'lines': lines_payload,
                }
                quotes_payload.append(quote_data)
                all_quotes_flat.append(quote_data)

            rfq_list.append({
                'id': str(rfq.id),
                'rfq_no': rfq.rfq_no,
                'rfq_status': rfq.rfq_status,
                'quotes': quotes_payload,
            })

        # ---- Comparison block -------------------------------------------
        comparison = self._build_comparison(pr_data, all_quotes_flat)

        return Response({
            'pr': pr_data,
            'rfqs': rfq_list,
            'comparison': comparison,
        })

    @staticmethod
    def _build_comparison(pr_data, all_quotes):
        """Build a product-level price comparison across all vendors."""
        if not all_quotes:
            return {
                'total_vendors': 0,
                'lowest_total': None,
                'products': [],
            }

        # Build comparison data
        comparison_products = []
        all_vendors = {}  # vendor_id -> vendor_info

        for quote_data in all_quotes:
            vid = quote_data['vendor_id']
            if vid not in all_vendors:
                all_vendors[vid] = {
                    'vendor_name': quote_data['vendor_name'],
                    'vendor_id': vid,
                    'quote_id': quote_data['quote_id'],
                    'quote_uuid': quote_data['id'],
                    'total_cost': quote_data['total_cost'],
                    'payment_terms': quote_data.get('payment_terms', ''),
                    'delivery_terms': quote_data.get('delivery_terms', ''),
                    'lead_time_days': quote_data.get('lead_time_days', 0),
                    'currency': quote_data.get('currency', 'INR'),
                    'lines': quote_data.get('lines', []),
                }

        # For each PR line item, build vendor price comparison
        for pr_line in pr_data['lines']:
            product_comparison = {
                'product_name': pr_line['product_name'],
                'product_code': pr_line.get('product_code', ''),
                'requested_qty': pr_line['quantity_requested'],
                'uom': pr_line.get('uom', ''),
                'vendor_prices': [],
            }

            best_price = None
            best_vendor = None

            for vid, vendor_info in all_vendors.items():
                # Try to find matching quote line
                matching_line = None
                for ql in vendor_info['lines']:
                    if (ql.get('product_code') == pr_line.get('product_code') or
                            ql.get('product_name') == pr_line['product_name']):
                        matching_line = ql
                        break

                if matching_line:
                    unit_price = float(matching_line.get('unit_price', 0))
                    qty = float(matching_line.get('quantity_offered', pr_line['quantity_requested']))
                    gst = float(matching_line.get('gst', 0))
                    total = unit_price * qty
                else:
                    # Fallback: use quote total divided by number of PR lines
                    num_lines = max(len(pr_data['lines']), 1)
                    total = float(vendor_info['total_cost'] or 0) / num_lines
                    unit_price = total / max(float(pr_line['quantity_requested']), 1)
                    qty = float(pr_line['quantity_requested'])
                    gst = 0

                vendor_price = {
                    'vendor_name': vendor_info['vendor_name'],
                    'vendor_id': vid,
                    'quote_id': vendor_info['quote_id'],
                    'quote_uuid': vendor_info['quote_uuid'],
                    'unit_price': round(unit_price, 2),
                    'quantity': qty,
                    'gst': gst,
                    'total': round(total, 2),
                    'delivery_days': vendor_info.get('lead_time_days', 0),
                    'payment_terms': vendor_info.get('payment_terms', ''),
                    'has_line_detail': matching_line is not None,
                }
                product_comparison['vendor_prices'].append(vendor_price)

                if total > 0 and (best_price is None or total < best_price):
                    best_price = total
                    best_vendor = vendor_info['vendor_name']

            product_comparison['best_price_vendor'] = best_vendor
            comparison_products.append(product_comparison)

        # Lowest total across all quotes
        lowest = min(all_quotes, key=lambda q: q['total_cost'])

        return {
            'total_vendors': len(all_vendors),
            'lowest_total': {
                'vendor_name': lowest['vendor_name'],
                'amount': lowest['total_cost'],
            },
            'products': comparison_products,
        }


class EvaluationDashboardSubmitView(APIView):
    """Submit evaluation decisions and optionally auto-create a PO.

    POST /api/purchase/evaluation-dashboard/submit/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        pr_id = request.data.get('pr_id')
        evaluations = request.data.get('evaluations', [])
        generate_po = request.data.get('generate_po', False)

        # ---------- basic validation ----------
        if not pr_id:
            return Response(
                {'error': 'pr_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not evaluations:
            return Response(
                {'error': 'evaluations list is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pr = PurchaseRequest.objects.select_related('warehouse').get(pk=pr_id)
        except PurchaseRequest.DoesNotExist:
            return Response(
                {'error': 'Purchase Request not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        accepted = [e for e in evaluations if e.get('status') == 'ACCEPTED']
        if not accepted:
            return Response(
                {'error': 'At least one quote must be ACCEPTED'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(accepted) > 1:
            return Response(
                {'error': 'Only one quote can be ACCEPTED per evaluation'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        accepted_quote_id = accepted[0]['quote_id']

        try:
            accepted_quote = QuoteResponse.objects.select_related(
                'vendor', 'rfq'
            ).prefetch_related('quote_lines__product_service').get(pk=accepted_quote_id)
        except QuoteResponse.DoesNotExist:
            return Response(
                {'error': f'Accepted quote {accepted_quote_id} not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check the quote hasn't already been chosen / evaluated
        if accepted_quote.chosen_flag:
            return Response(
                {'error': 'This quote has already been accepted in a prior evaluation'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rfq = accepted_quote.rfq

        # Check that the RFQ is linked to this PR
        rfq_linked = (
            (pr.linked_rfq_id and pr.linked_rfq_id == rfq.id)
            or rfq.linked_prs.filter(pk=pr.id).exists()
        )
        if not rfq_linked:
            return Response(
                {'error': 'The accepted quote does not belong to an RFQ linked to this PR'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # 1. Update chosen_flag on all evaluated quotes
            for ev in evaluations:
                qid = ev.get('quote_id')
                ev_status = ev.get('status', 'REJECTED')
                try:
                    q = QuoteResponse.objects.get(pk=qid)
                    q.chosen_flag = (ev_status == 'ACCEPTED')
                    q.save(update_fields=['chosen_flag'])
                except QuoteResponse.DoesNotExist:
                    pass  # silently skip unknown quotes

            # 2. Create QuoteEvaluation record
            stakeholder = getattr(request.user, 'stakeholder_user', None)
            evaluation_obj = QuoteEvaluation(
                rfq=rfq,
                best_quote_flag=True,
                recommended_vendor=accepted_quote.vendor,
                justification_notes=accepted[0].get('notes', ''),
                approval_status='APPROVED',
            )
            if stakeholder:
                evaluation_obj.evaluated_by = stakeholder
            evaluation_obj.save()

            # Create ComparisonEntry for each evaluated quote
            for ev in evaluations:
                qid = ev.get('quote_id')
                try:
                    q = QuoteResponse.objects.select_related('vendor').get(pk=qid)
                    total_cost = q.get_total_cost()
                    ComparisonEntry.objects.create(
                        evaluation=evaluation_obj,
                        vendor=q.vendor,
                        total_cost=total_cost,
                        lead_time=q.lead_time_days or 0,
                        freight_terms=q.freight_terms,
                        payment_terms=q.payment_terms,
                        score=q.evaluation_score or 0,
                        remarks=ev.get('notes', ''),
                    )
                except QuoteResponse.DoesNotExist:
                    pass

            # 3. Optionally auto-create PO
            po_data = None
            if generate_po:
                po = self._create_po_from_quote(accepted_quote, pr, request.user)
                po_data = {
                    'id': str(po.id),
                    'po_no': po.po_no,
                    'vendor_name': po.vendor.vendor_name if po.vendor else '',
                    'total_amount': float(po.get_total_order_value()),
                    'status': po.status,
                }

            # 4. Audit logging
            AuditLog.objects.create(
                user=request.user,
                role_name=get_user_role_name(request.user),
                module_name='Quote Evaluation',
                action='CREATE',
                details=(
                    f'Evaluation {evaluation_obj.evaluation_id} submitted for '
                    f'RFQ {rfq.rfq_no} (PR {pr.pr_no}). '
                    f'Accepted quote: {accepted_quote.quote_id} from '
                    f'{accepted_quote.vendor.vendor_name if accepted_quote.vendor else "N/A"}.'
                ),
            )

            if po_data:
                AuditLog.objects.create(
                    user=request.user,
                    role_name=get_user_role_name(request.user),
                    module_name='Purchase Order',
                    action='CREATE',
                    details=(
                        f'PO {po_data["po_no"]} auto-created from evaluation '
                        f'{evaluation_obj.evaluation_id} for vendor '
                        f'{po_data["vendor_name"]}.'
                    ),
                )

        response = {
            'success': True,
            'message': 'Evaluation submitted.' + (' PO created.' if po_data else ''),
            'evaluation_id': str(evaluation_obj.id),
            'evaluation_no': evaluation_obj.evaluation_id,
        }
        if po_data:
            response['po'] = po_data

        return Response(response, status=status.HTTP_201_CREATED)

    @staticmethod
    def _create_po_from_quote(quote, pr, user):
        """Create a PurchaseOrder from an accepted QuoteResponse.

        Uses the existing PO model's auto-numbering in save().
        """
        warehouse = pr.warehouse
        company = warehouse.company

        po = PurchaseOrder(
            vendor=quote.vendor,
            company=company,
            warehouse=warehouse,
            linked_rfq=quote.rfq,
            freight_terms=quote.freight_terms,
            payment_terms=quote.payment_terms,
            currency=quote.currency,
            terms_and_conditions=f'Delivery: {quote.delivery_terms}' if quote.delivery_terms else '',
            status='DRAFT',
            created_by=user,
        )
        po.save()

        # Create PO lines from quote lines
        line_no = 1
        quote_lines = list(quote.quote_lines.all())
        if quote_lines:
            for ql in quote_lines:
                POLine.objects.create(
                    po=po,
                    line_no=line_no,
                    product_service=ql.product_service,
                    description=ql.specification,
                    quantity_ordered=ql.quantity_offered,
                    uom=ql.uom,
                    unit_price=ql.unit_price,
                    discount=ql.discount,
                    gst=ql.gst,
                    freight_estimate=ql.freight_charge,
                    linked_pr_line=ql.pr_line,
                    linked_rfq_line=ql,
                )
                line_no += 1
        else:
            # Fallback: create PO lines from PR lines when quote has no line items
            pr_lines = list(pr.lines.select_related('product_service').all())
            num_lines = max(len(pr_lines), 1)
            total_cost = float(quote.get_total_cost() or 0)
            per_line_cost = total_cost / num_lines if total_cost > 0 else 0

            for pr_line in pr_lines:
                qty = float(pr_line.quantity_requested)
                unit_price = per_line_cost / qty if qty > 0 else 0
                POLine.objects.create(
                    po=po,
                    line_no=line_no,
                    product_service=pr_line.product_service,
                    description=pr_line.description_override or '',
                    quantity_ordered=pr_line.quantity_requested,
                    uom=pr_line.uom,
                    unit_price=round(unit_price, 2),
                    discount=0,
                    gst=0,
                    freight_estimate=0,
                    linked_pr_line=pr_line,
                )
                line_no += 1

        # Link PRs to PO
        po.linked_prs.add(pr)
        # Also link any other PRs attached to the RFQ
        for linked_pr in quote.rfq.linked_prs.all():
            po.linked_prs.add(linked_pr)

        return po
