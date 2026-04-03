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
    ReceiptAdvice, ReceiptLine, FreightDetail,
    VendorPaymentAdvice, FreightAdviceInbound,
    VendorBill, PaymentMade, VendorCredit,
    PurchaseAttachment,
)
from .serializers import (
    PurchaseRequestSerializer, RFQHeaderSerializer,
    QuoteResponseSerializer, QuoteEvaluationSerializer,
    PurchaseOrderSerializer, ReceiptAdviceSerializer,
    VendorPaymentAdviceSerializer, FreightAdviceInboundSerializer,
    PurchaseAttachmentSerializer
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

        # Validate state - must be DRAFT, EDITED or PENDING_APPROVAL
        if pr.approval_status not in ('DRAFT', 'EDITED', 'PENDING_APPROVAL', 'PENDING'):
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

            # Approve all lines
            pr.lines.update(status='APPROVED')

            # Line-level approval via service (partial approval, trail logging)
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
                pass

            # If allow_rfq_skip, create PO directly instead of RFQ
            if pr.allow_rfq_skip:
                company = pr.warehouse.company if pr.warehouse and hasattr(pr.warehouse, 'company') else None
                if company:
                    po = PurchaseOrder(
                        vendor=pr.preferred_vendor,
                        company=company,
                        warehouse=pr.warehouse,
                        currency='INR',
                        status='DRAFT',
                        terms_and_conditions=pr.notes or '',
                    )
                    po.save()
                    po.linked_prs.add(pr)

                    # Create PO lines from PR lines
                    for idx, pr_line in enumerate(pr.lines.all().select_related('product_service'), start=1):
                        POLine.objects.create(
                            po=po,
                            line_no=idx,
                            product_service=pr_line.product_service,
                            description=pr_line.description_override or '',
                            quantity_ordered=pr_line.quantity_requested,
                            uom=pr_line.uom or 'KG',
                            unit_price=0,
                            delivery_schedule=pr_line.required_date or pr.required_by_date,
                            linked_pr_line=pr_line,
                        )

                    AuditLog.objects.create(
                        user=request.user,
                        role_name=get_user_role_name(request.user),
                        module_name='Purchase Order',
                        action='CREATE',
                        details=f'PR {pr.pr_no} approved. PO {po.po_no} created (RFQ Skipped).'
                    )

                    return Response({
                        'message': f'PR {pr.pr_no} approved. PO {po.po_no} created (RFQ Skipped)',
                        'po_no': po.po_no,
                        'po_id': str(po.id),
                        'purchase_request': self.get_serializer(pr).data,
                    })

            # Normal flow: Auto-create RFQ from approved PR
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
            'rfq_no': rfq.rfq_no if rfq else None,
            'rfq_id': str(rfq.id) if rfq else None,
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
        stakeholder = getattr(request.user, 'stakeholder_user', None)

        with transaction.atomic():
            if stakeholder:
                pr = PurchaseRequestService.reject_purchase_request(pr, stakeholder, remarks=remarks)
            else:
                # Handle rejection without StakeholderUser
                for line in pr.lines.all():
                    line.status = 'REJECTED'
                    line.save()
                pr.approval_status = 'REJECTED'
                pr.save(update_fields=['approval_status'])

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

    @action(detail=True, methods=['get'], url_path='skip-rfq-po-data')
    def skip_rfq_po_data(self, request, pk=None):
        """Return PR data formatted for direct PO creation (skip RFQ flow)."""
        pr = self.get_object()

        if pr.approval_status != 'APPROVED':
            return Response(
                {'error': 'Only approved PRs can skip RFQ to create PO'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if PO already exists for this PR via skip-RFQ
        existing_skip_pos = PurchaseOrder.objects.filter(
            linked_prs=pr,
            linked_rfq__isnull=True
        )
        if existing_skip_pos.exists():
            return Response(
                {'error': f'A skip-RFQ PO already exists for this PR: {existing_skip_pos.first().po_no}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get warehouse company
        company_id = str(pr.warehouse.company_id) if pr.warehouse and hasattr(pr.warehouse, 'company_id') and pr.warehouse.company_id else ''
        company_name = ''
        if company_id:
            try:
                company_name = pr.warehouse.company.legal_name
            except Exception:
                pass

        # Build line items from PR lines
        lines = []
        for line in pr.lines.all().select_related('product_service'):
            lines.append({
                'product': str(line.product_service_id) if line.product_service_id else '',
                'product_name': line.product_service.product_name if line.product_service else '',
                'product_code': line.product_service.sku_code if line.product_service else '',
                'description': line.description_override or '',
                'quantity': str(line.quantity_requested),
                'uom': line.uom or 'KG',
                'required_date': str(line.required_date) if line.required_date else '',
                'pr_line_id': str(line.id),
            })

        data = {
            'pr_id': str(pr.id),
            'pr_no': pr.pr_no,
            'warehouse': str(pr.warehouse_id) if pr.warehouse_id else '',
            'warehouse_name': pr.warehouse.name if pr.warehouse else '',
            'company': company_id,
            'company_name': company_name,
            'currency': 'INR',
            'notes': pr.notes or '',
            'required_by_date': str(pr.required_by_date) if pr.required_by_date else '',
            'lines': lines,
        }

        return Response(data)

    @action(detail=True, methods=['post'], url_path='skip-rfq-create-po')
    def skip_rfq_create_po(self, request, pk=None):
        """Approve PR (if needed) and create PO directly, skipping RFQ."""
        pr = self.get_object()

        with transaction.atomic():
            # 1. Approve if not already approved
            if pr.approval_status != 'APPROVED':
                if pr.approval_status in ('REJECTED', 'CANCELLED'):
                    return Response(
                        {'error': 'Cannot skip RFQ on rejected/cancelled PR'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                pr.approval_status = 'APPROVED'
                pr.approved_by = request.user
                pr.approved_at = timezone.now()
                pr.save(update_fields=['approval_status', 'approved_by', 'approved_at'])

                # Approve lines
                try:
                    stakeholder = getattr(request.user, 'stakeholder_user', None)
                    if stakeholder:
                        PurchaseRequestService.approve_purchase_request(pr, stakeholder)
                except Exception:
                    pass

            # 2. Prevent duplicate PO
            existing_skip_pos = PurchaseOrder.objects.filter(
                linked_prs=pr,
                linked_rfq__isnull=True
            )
            if existing_skip_pos.exists():
                return Response(
                    {'error': f'A skip-RFQ PO already exists: {existing_skip_pos.first().po_no}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 3. Get company from warehouse
            company = pr.warehouse.company if pr.warehouse and hasattr(pr.warehouse, 'company') else None
            if not company:
                return Response(
                    {'error': 'Cannot determine company from warehouse'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 4. Create PO
            po = PurchaseOrder(
                company=company,
                warehouse=pr.warehouse,
                currency='INR',
                status='DRAFT',
                terms_and_conditions=pr.notes or '',
            )
            po.save()

            # 5. Link PR to PO
            po.linked_prs.add(pr)

            # 6. Create PO lines from PR lines
            for idx, pr_line in enumerate(pr.lines.all().select_related('product_service'), start=1):
                POLine.objects.create(
                    po=po,
                    line_no=idx,
                    product_service=pr_line.product_service,
                    description=pr_line.description_override or '',
                    quantity_ordered=pr_line.quantity_requested,
                    uom=pr_line.uom or 'KG',
                    unit_price=0,
                    delivery_schedule=pr_line.required_date or pr.required_by_date,
                    linked_pr_line=pr_line,
                )

            # 7. Audit log
            AuditLog.objects.create(
                user=request.user,
                role_name=get_user_role_name(request.user),
                module_name='Purchase Order',
                action='CREATE',
                details=f'PO {po.po_no} created via RFQ Skip from PR {pr.pr_no}'
            )

        # Return PO data
        po_serializer = PurchaseOrderSerializer(po)
        return Response({
            'message': f'PO {po.po_no} created from PR {pr.pr_no} (RFQ Skipped)',
            'po': po_serializer.data,
            'po_id': str(po.id),
            'po_no': po.po_no,
        }, status=status.HTTP_201_CREATED)

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
            created_by=getattr(self.request.user, "stakeholder_user", None)
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
                getattr(request.user, "stakeholder_user", None),
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

    queryset = PurchaseOrder.objects.filter(is_active=True)
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

    def get_queryset(self):
        qs = super().get_queryset()
        # Support status__in filter (comma-separated statuses)
        status_in = self.request.query_params.get('status__in')
        if status_in:
            statuses = [s.strip() for s in status_in.split(',') if s.strip()]
            qs = qs.filter(status__in=statuses)
        return qs

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
            actor = getattr(request.user, 'stakeholder_user', None) or request.user
            po = PurchaseOrderService.approve_po(po, actor)

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            role_name=get_user_role_name(request.user),
            module_name='Purchase Order',
            action='EDIT',
            details=f'PO {po.po_no} approved'
        )

        serializer = self.get_serializer(po)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a line item to this PO."""
        po = self.get_object()
        data = request.data
        product_id = data.get('product_service') or data.get('product')
        if not product_id:
            return Response({'error': 'product_service is required'}, status=status.HTTP_400_BAD_REQUEST)

        from master.models import Product
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_400_BAD_REQUEST)

        line_no = data.get('line_no', po.po_lines.count() + 1)
        line = POLine.objects.create(
            po=po,
            line_no=line_no,
            product_service=product,
            description=data.get('description', ''),
            quantity_ordered=data.get('quantity_ordered', data.get('quantity', 1)),
            uom=data.get('uom', product.uom or 'KG'),
            unit_price=data.get('unit_price', 0),
            gst=data.get('gst', 0),
            delivery_schedule=data.get('delivery_schedule') or None,
            linked_pr_line_id=data.get('linked_pr_line') or None,
        )
        from .serializers import POLineSerializer
        return Response(POLineSerializer(line).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def issue(self, request, pk=None):
        """Issue a PO."""
        po = self.get_object()

        with transaction.atomic():
            actor = getattr(request.user, 'stakeholder_user', None) or request.user
            po = PurchaseOrderService.issue_po(po, actor)

        serializer = self.get_serializer(po)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a PO."""
        po = self.get_object()

        if po.status not in ('DRAFT', 'APPROVED'):
            return Response(
                {'error': 'Only DRAFT or APPROVED POs can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not check_permission(request.user, 'Purchase Order', 'edit'):
            return Response(
                {'error': 'You do not have permission to reject POs'},
                status=status.HTTP_403_FORBIDDEN
            )

        po.status = 'CANCELLED'
        po.save(update_fields=['status'])

        AuditLog.objects.create(
            user=request.user,
            role_name=get_user_role_name(request.user),
            module_name='Purchase Order',
            action='EDIT',
            details=f'PO {po.po_no} rejected/cancelled. Reason: {request.data.get("reason", "")}'
        )

        serializer = self.get_serializer(po)
        return Response({
            'message': f'PO {po.po_no} has been rejected',
            'purchase_order': serializer.data,
        })

    def destroy(self, request, *args, **kwargs):
        """Soft-delete PO: sets is_active=False, releases PO for re-generation in Quote Evaluation."""
        po = self.get_object()

        with transaction.atomic():
            # Collect info before soft delete
            linked_pr_nos = ", ".join(pr.pr_no for pr in po.linked_prs.all())
            linked_rfq_no = po.linked_rfq.rfq_no if po.linked_rfq else "None"

            # Soft delete the PO and its lines
            po.soft_delete()
            po.po_lines.update(is_active=False)

            # Reset chosen_flag on quotes linked to this PO's RFQ
            if po.linked_rfq:
                QuoteResponse.objects.filter(
                    rfq=po.linked_rfq,
                    chosen_flag=True
                ).update(chosen_flag=False)

            # Reset quote chosen_flag via PO lines → linked quote lines
            for po_line in po.po_lines.all():
                if po_line.linked_rfq_line:
                    quote = po_line.linked_rfq_line.quote
                    if quote and quote.chosen_flag:
                        quote.chosen_flag = False
                        quote.save(update_fields=['chosen_flag'])

            # Soft-delete evaluations linked to this PO's RFQ so they can be re-done
            if po.linked_rfq:
                QuoteEvaluation.objects.filter(
                    rfq=po.linked_rfq,
                    is_active=True
                ).update(is_active=False)

            # Audit log
            AuditLog.objects.create(
                user=request.user,
                role_name=get_user_role_name(request.user),
                module_name='Purchase Order',
                action='DELETE',
                details=f'PO {po.po_no} deleted (soft). '
                        f'Quote chosen_flag and evaluations reset. '
                        f'PO released for re-generation. '
                        f'Linked PRs: {linked_pr_nos}. '
                        f'Linked RFQ: {linked_rfq_no}.'
            )

        return Response(
            {'message': f'PO {po.po_no} deleted. PO number is now available for re-generation in Quote Evaluation.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='preview-email')
    def preview_email(self, request, pk=None):
        """Preview rendered PO email HTML before sending."""
        po = self.get_object()
        template_id = request.data.get('template_id')

        if not template_id:
            return Response({'error': 'template_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from communications.models import EmailTemplate
            from communications.services import TemplateEngine, PDFGenerator

            template = EmailTemplate.objects.get(pk=template_id)
            company = po.company
            vendor = po.vendor

            context = {
                'company_name': company.legal_name if company else '',
                'company_address': str(getattr(company, 'registered_address', '') or '') if company else '',
                'company_gstin': getattr(company, 'gstin', '') or '' if company else '',
                'company_phone': getattr(company, 'contact_phone', '') or '' if company else '',
                'company_email': getattr(company, 'contact_email', '') or '' if company else '',
                'po_number': po.po_no,
                'po_date': po.po_date.strftime('%d-%m-%Y') if po.po_date else '',
                'vendor_name': vendor.vendor_name if vendor else 'N/A',
                'vendor_address': str(getattr(vendor, 'address', '') or '') if vendor else '',
                'vendor_email': getattr(vendor, 'contact_email', '') or '' if vendor else '',
                'date': po.po_date.strftime('%d-%m-%Y') if po.po_date else '',
                'payment_terms': po.payment_terms or '',
                'freight_terms': po.freight_terms or '',
                'notes': po.terms_and_conditions or '',
                'product_table': self._build_po_product_table(po),
            }

            engine = TemplateEngine()
            rendered_subject = engine.render(template.subject, context)
            rendered_body = engine.render(template.body_html, context)

            # Also build full PDF HTML for preview
            full_html = PDFGenerator.build_full_html(template, context)

            return Response({
                'subject': rendered_subject,
                'body_html': rendered_body,
                'pdf_html': full_html,
                'context_data': {k: v for k, v in context.items() if k != 'product_table'},
            })

        except EmailTemplate.DoesNotExist:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': f'Preview failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='send-email')
    def send_email(self, request, pk=None):
        """Send PO to vendor via email."""
        po = self.get_object()
        template_id = request.data.get('template_id')

        if not template_id:
            return Response({'error': 'template_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from communications.models import EmailTemplate, EmailLog
            from communications.services import TemplateEngine, PDFGenerator

            template = EmailTemplate.objects.get(pk=template_id)
            company = po.company
            vendor = po.vendor

            # Build context with PO data
            context = {
                'company_name': company.legal_name,
                'company_address': str(getattr(company, 'registered_address', '') or ''),
                'company_gstin': getattr(company, 'gstin', '') or '',
                'company_phone': getattr(company, 'contact_phone', '') or '',
                'company_email': getattr(company, 'contact_email', '') or '',
                'po_number': po.po_no,
                'po_date': po.po_date.strftime('%d-%m-%Y') if po.po_date else '',
                'vendor_name': vendor.vendor_name,
                'vendor_address': str(getattr(vendor, 'address', '') or ''),
                'vendor_email': getattr(vendor, 'contact_email', '') or '',
                'date': po.po_date.strftime('%d-%m-%Y') if po.po_date else '',
                'payment_terms': po.payment_terms or '',
                'freight_terms': po.freight_terms or '',
                'notes': po.terms_and_conditions or '',
                'product_table': self._build_po_product_table(po),
            }

            # Render template
            engine = TemplateEngine()
            subject = engine.render(template.subject, context)
            body = engine.render(template.body_html, context)
            full_html = PDFGenerator.build_full_html(template, context)
            pdf_buffer = PDFGenerator.generate(full_html)

            # Create email log
            log = EmailLog.objects.create(
                template=template,
                vendor=vendor,
                vendor_email=getattr(vendor, 'contact_email', '') or '',
                subject=subject,
                body_preview=body[:500],
                pdf_generated=True,
                sent_by=request.user,
            )

            # Send the email
            from django.core.mail import EmailMessage as DjangoEmail
            from django.conf import settings

            recipient_email = getattr(vendor, 'contact_email', '') or ''
            if not recipient_email:
                log.error_message = 'Vendor has no email address'
                log.save()
                return Response({'success': False, 'error': 'Vendor has no email address'}, status=status.HTTP_400_BAD_REQUEST)

            email = DjangoEmail(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[recipient_email],
            )
            email.content_subtype = 'html'
            email.attach(f'{po.po_no}.pdf', pdf_buffer.read(), 'application/pdf')
            email.send(fail_silently=False)

            log.email_sent = True
            log.sent_at = timezone.now()
            log.save()

            AuditLog.objects.create(
                user=request.user,
                role_name=get_user_role_name(request.user),
                module_name='Purchase Order',
                action='EDIT',
                details=f'PO {po.po_no} emailed to {vendor.vendor_name} ({recipient_email})'
            )

            return Response({'success': True, 'message': f'PO sent to {vendor.vendor_name}'})

        except EmailTemplate.DoesNotExist:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _build_po_product_table(self, po):
        """Build HTML product table from PO lines."""
        html = '<table style="width:100%;border-collapse:collapse;border:1px solid #ddd;">'
        html += '<thead><tr style="background:#f5f5f5;">'
        html += '<th style="border:1px solid #ddd;padding:8px;">#</th>'
        html += '<th style="border:1px solid #ddd;padding:8px;">Product</th>'
        html += '<th style="border:1px solid #ddd;padding:8px;">Qty</th>'
        html += '<th style="border:1px solid #ddd;padding:8px;">UOM</th>'
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:right;">Unit Price</th>'
        html += '<th style="border:1px solid #ddd;padding:8px;text-align:right;">Total</th>'
        html += '</tr></thead><tbody>'
        for line in po.po_lines.all():
            total = float(line.quantity_ordered) * float(line.unit_price)
            html += '<tr>'
            html += f'<td style="border:1px solid #ddd;padding:8px;">{line.line_no}</td>'
            html += f'<td style="border:1px solid #ddd;padding:8px;">{line.product_service.product_name}</td>'
            html += f'<td style="border:1px solid #ddd;padding:8px;">{line.quantity_ordered}</td>'
            html += f'<td style="border:1px solid #ddd;padding:8px;">{line.uom}</td>'
            html += f'<td style="border:1px solid #ddd;padding:8px;text-align:right;">&#8377;{float(line.unit_price):,.2f}</td>'
            html += f'<td style="border:1px solid #ddd;padding:8px;text-align:right;">&#8377;{total:,.2f}</td>'
            html += '</tr>'
        html += '</tbody></table>'
        return html

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

    def perform_create(self, serializer):
        receipt = serializer.save()
        self._check_po_completion(receipt)

    def _check_po_completion(self, receipt):
        """Auto-close PO when all quantities are received."""
        from django.db.models import Sum, Q
        for po in receipt.linked_pos.all():
            all_received = True
            for po_line in po.po_lines.all():
                # Sum received qty: match by po_line FK or by product
                total_received = ReceiptLine.objects.filter(
                    Q(po_line=po_line) | Q(
                        po_line__isnull=True,
                        product=po_line.product_service,
                        receipt__linked_pos=po
                    )
                ).aggregate(total=Sum('quantity_received'))['total'] or 0

                if total_received < po_line.quantity_ordered:
                    all_received = False
                    break

            if all_received and po.po_lines.exists():
                po.status = 'CLOSED'
                po.save(update_fields=['status'])

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

    queryset = VendorPaymentAdvice.objects.select_related(
        'vendor', 'receipt_advice', 'prepared_by'
    ).prefetch_related('tax_components').all()
    serializer_class = VendorPaymentAdviceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Vendor Payment'
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter
    ]
    filterset_fields = ['status', 'vendor', 'payment_method']
    search_fields = ['advice_no', 'vendor__name', 'invoice_no']
    ordering_fields = ['due_date', 'created_at', 'invoice_date']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        """Auto-set prepared_by to current user."""
        try:
            prepared_by = getattr(self.request.user, "stakeholder_user", None)
        except Exception:
            prepared_by = None
        serializer.save(prepared_by=prepared_by)

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
        if advice.status not in ('DRAFT', 'PENDING'):
            return Response(
                {'error': f'Cannot approve payment in {advice.get_status_display()} status.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            advice = PaymentService.approve_payment_advice(
                advice,
                getattr(request.user, "stakeholder_user", None)
            )

        serializer = self.get_serializer(advice)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        """Record a payment against this bill."""
        advice = self.get_object()
        from decimal import Decimal, InvalidOperation

        amount_paid_str = request.data.get('amount_paid', '0')
        try:
            new_payment = Decimal(str(amount_paid_str))
        except (InvalidOperation, ValueError):
            return Response(
                {'error': 'Invalid amount_paid value.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_payment <= 0:
            return Response(
                {'error': 'Payment amount must be greater than zero.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        net = advice.net_payable
        current_paid = advice.paid_amount or Decimal('0.00')
        remaining = net - current_paid

        if new_payment > remaining:
            return Response(
                {'error': f'Payment amount ({new_payment}) exceeds balance ({remaining}).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            advice.paid_amount = current_paid + new_payment
            advice.payment_method = request.data.get('payment_mode', advice.payment_method) or advice.payment_method
            advice.payment_reference = request.data.get('payment_reference', advice.payment_reference) or advice.payment_reference
            advice.bank_name = request.data.get('bank_name', advice.bank_name) or advice.bank_name
            advice.transaction_id = request.data.get('transaction_id', advice.transaction_id) or advice.transaction_id

            payment_date = request.data.get('payment_date')
            if payment_date:
                advice.payment_date = payment_date

            # Determine status
            if advice.paid_amount >= net:
                advice.status = 'PAID'
            elif advice.paid_amount > Decimal('0.00'):
                advice.status = 'PARTIALLY_PAID'

            advice.save()

        serializer = self.get_serializer(advice)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark payment as done."""
        advice = self.get_object()

        with transaction.atomic():
            advice = PaymentService.mark_payment_done(
                advice,
                getattr(request.user, "stakeholder_user", None)
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

    queryset = FreightAdviceInbound.objects.select_related(
        'receipt_advice', 'receipt_advice__vendor', 'receipt_advice__warehouse',
        'transporter', 'created_by__user', 'approved_by__user'
    ).filter(is_active=True)
    serializer_class = FreightAdviceInboundSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Freight Advice'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'freight_terms', 'freight_type']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        freight = self.get_object()
        if freight.status not in ('DRAFT', 'PENDING_APPROVAL'):
            return Response(
                {'error': 'Only DRAFT or PENDING_APPROVAL freight can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        freight.status = 'APPROVED'
        # Use the StakeholderUser linked to the request user
        try:
            from apps.core.models import StakeholderUser
            freight.approved_by = StakeholderUser.objects.get(user=request.user)
        except Exception:
            pass
        freight.approved_at = timezone.now()
        freight.save()

        # Update linked receipt's freight details: TO_PAY → PAID
        if freight.receipt_advice_id:
            FreightDetail.objects.filter(
                receipt=freight.receipt_advice,
                freight_terms='TO_PAY',
            ).update(freight_terms='PAID')

        return Response(self.get_serializer(freight).data)

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        freight = self.get_object()
        new_status = request.data.get('status')
        valid_statuses = dict(freight.FREIGHT_ADVICE_STATUS).keys()
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Define valid transitions
        valid_transitions = {
            'DRAFT': ['PENDING_APPROVAL', 'CANCELLED'],
            'PENDING_APPROVAL': ['APPROVED', 'DRAFT', 'CANCELLED'],
            'APPROVED': ['IN_TRANSIT', 'CANCELLED'],
            'IN_TRANSIT': ['COMPLETED', 'CANCELLED'],
            'COMPLETED': ['PAID'],
            'PAID': [],
            'CANCELLED': ['DRAFT'],
        }
        allowed = valid_transitions.get(freight.status, [])
        if new_status not in allowed:
            return Response(
                {'error': f'Cannot transition from {freight.status} to {new_status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        freight.status = new_status
        freight.save()
        return Response(self.get_serializer(freight).data)


# ──────────────────────────────────────────────────────────────
#  Vendor Bills, Payments Made, Vendor Credits
# ──────────────────────────────────────────────────────────────

class VendorBillViewSet(viewsets.ModelViewSet):
    """ViewSet for Vendor Bills."""

    from .models import VendorBill
    from .serializers import VendorBillSerializer

    queryset = VendorBill.objects.select_related(
        'vendor', 'purchase_order', 'receipt_advice'
    ).all()
    serializer_class = VendorBillSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Vendor Payment'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor']
    search_fields = ['bill_no', 'vendor__name', 'vendor_invoice_no']
    ordering_fields = ['bill_date', 'due_date', 'total_amount', 'created_at']
    ordering = ['-bill_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Move bill from DRAFT to OPEN."""
        bill = self.get_object()
        if bill.status != 'DRAFT':
            return Response({'error': f'Cannot approve bill in {bill.get_status_display()} status.'}, status=status.HTTP_400_BAD_REQUEST)
        bill.status = 'OPEN'
        bill.save(update_fields=['status'])
        return Response(self.get_serializer(bill).data)

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        """Create a PaymentMade record against this bill."""
        bill = self.get_object()
        from decimal import Decimal, InvalidOperation

        amount_str = request.data.get('amount', '0')
        try:
            amount = Decimal(str(amount_str))
        except (InvalidOperation, ValueError):
            return Response({'error': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'error': 'Amount must be > 0.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount > bill.balance_due:
            return Response({'error': f'Amount ({amount}) exceeds balance ({bill.balance_due}).'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import PaymentMade
        with transaction.atomic():
            payment = PaymentMade.objects.create(
                vendor=bill.vendor,
                payment_date=request.data.get('payment_date', timezone.now().date()),
                payment_mode=request.data.get('payment_mode', 'BANK_TRANSFER'),
                amount=amount,
                reference_no=request.data.get('reference_no', ''),
                bank_name=request.data.get('bank_name', ''),
                bill=bill,
                status='APPROVED',
                notes=request.data.get('notes', ''),
            )
            bill.amount_paid = bill.amount_paid + amount
            if bill.amount_paid >= bill.total_amount:
                bill.status = 'PAID'
            elif bill.amount_paid > 0:
                bill.status = 'PARTIALLY_PAID'
            bill.save(update_fields=['amount_paid', 'status'])

        return Response(self.get_serializer(bill).data)


class PaymentMadeViewSet(viewsets.ModelViewSet):
    """ViewSet for Payments Made."""

    from .models import PaymentMade
    from .serializers import PaymentMadeSerializer

    queryset = PaymentMade.objects.select_related('vendor', 'bill').all()
    serializer_class = PaymentMadeSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Vendor Payment'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor', 'payment_mode']
    search_fields = ['payment_no', 'vendor__name', 'reference_no']
    ordering_fields = ['payment_date', 'amount', 'created_at']
    ordering = ['-payment_date']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        payment = self.get_object()
        if payment.status != 'DRAFT':
            return Response({'error': f'Cannot approve in {payment.get_status_display()} status.'}, status=status.HTTP_400_BAD_REQUEST)
        payment.status = 'APPROVED'
        payment.save(update_fields=['status'])
        return Response(self.get_serializer(payment).data)


class VendorCreditViewSet(viewsets.ModelViewSet):
    """ViewSet for Vendor Credits."""

    from .models import VendorCredit
    from .serializers import VendorCreditSerializer

    queryset = VendorCredit.objects.select_related('vendor', 'bill').all()
    serializer_class = VendorCreditSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Vendor Payment'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor', 'credit_type']
    search_fields = ['credit_no', 'vendor__name', 'reason']
    ordering_fields = ['credit_date', 'total_amount', 'created_at']
    ordering = ['-credit_date']

    @action(detail=True, methods=['post'], url_path='apply-to-bill')
    def apply_to_bill(self, request, pk=None):
        """Apply credit to a vendor bill."""
        credit = self.get_object()
        from decimal import Decimal, InvalidOperation

        bill_id = request.data.get('bill_id')
        amount_str = request.data.get('amount', '0')
        try:
            amount = Decimal(str(amount_str))
        except (InvalidOperation, ValueError):
            return Response({'error': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'error': 'Amount must be > 0.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount > credit.balance:
            return Response({'error': f'Amount exceeds credit balance ({credit.balance}).'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import VendorBill
        try:
            bill = VendorBill.objects.get(pk=bill_id)
        except VendorBill.DoesNotExist:
            return Response({'error': 'Bill not found.'}, status=status.HTTP_404_NOT_FOUND)

        if amount > bill.balance_due:
            return Response({'error': f'Amount exceeds bill balance ({bill.balance_due}).'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import PaymentMade

        with transaction.atomic():
            credit.amount_applied = credit.amount_applied + amount
            if credit.amount_applied >= credit.total_amount:
                credit.status = 'APPLIED'
            else:
                credit.status = 'OPEN'
            credit.bill = bill
            credit.save(update_fields=['amount_applied', 'status', 'bill'])

            bill.amount_paid = bill.amount_paid + amount
            if bill.amount_paid >= bill.total_amount:
                bill.status = 'PAID'
            elif bill.amount_paid > 0:
                bill.status = 'PARTIALLY_PAID'
            bill.save(update_fields=['amount_paid', 'status'])

            # Create PaymentMade record for tracking
            credit_type_label = credit.get_credit_type_display()
            payment_mode = 'ADVANCE' if credit.credit_type == 'ADVANCE' else 'CREDIT'
            PaymentMade.objects.create(
                vendor=bill.vendor,
                payment_date=timezone.now().date(),
                payment_mode=payment_mode,
                amount=amount,
                reference_no=credit.credit_no,
                bill=bill,
                status='APPROVED',
                notes=f'{credit_type_label} {credit.credit_no} applied to {bill.bill_no}',
            )

        return Response(self.get_serializer(credit).data)

    @action(detail=False, methods=['get'], url_path='vendor-advances')
    def vendor_advances(self, request):
        """Get advance balance per vendor."""
        vendor_id = request.query_params.get('vendor_id')
        from .models import VendorCredit
        from django.db.models import Sum, F
        qs = VendorCredit.objects.filter(credit_type='ADVANCE', status__in=['OPEN', 'DRAFT'])
        if vendor_id:
            qs = qs.filter(vendor_id=vendor_id)
        advances = qs.values('vendor', 'vendor__vendor_name').annotate(
            total_advance=Sum('total_amount'),
            total_applied=Sum('amount_applied'),
        )
        result = []
        for a in advances:
            balance = (a['total_advance'] or 0) - (a['total_applied'] or 0)
            if balance > 0:
                result.append({
                    'vendor_id': str(a['vendor']),
                    'vendor_name': a['vendor__vendor_name'],
                    'total_advance': float(a['total_advance'] or 0),
                    'total_applied': float(a['total_applied'] or 0),
                    'balance': float(balance),
                })
        return Response(result)

    @action(detail=False, methods=['get'], url_path='available-for-bill')
    def available_for_bill(self, request):
        """Get available credits/advances for a specific vendor to apply to a bill."""
        vendor_id = request.query_params.get('vendor_id')
        if not vendor_id:
            return Response({'error': 'vendor_id required'}, status=400)
        from .models import VendorCredit
        credits = VendorCredit.objects.filter(
            vendor_id=vendor_id,
            status__in=['DRAFT', 'OPEN'],
        )
        data = []
        for c in credits:
            balance = c.total_amount - c.amount_applied
            if balance > 0:
                data.append({
                    'id': str(c.id),
                    'credit_no': c.credit_no,
                    'credit_type': c.credit_type,
                    'credit_type_display': c.get_credit_type_display(),
                    'total_amount': float(c.total_amount),
                    'amount_applied': float(c.amount_applied),
                    'balance': float(balance),
                    'credit_date': c.credit_date.isoformat() if c.credit_date else None,
                })
        return Response(data)


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


class DocumentExtractorView(APIView):
    """Extract structured data from raw text or uploaded files.

    POST /api/purchase/extract-document/
    Body (JSON):  { "text": "raw text here" }
    Body (multipart): file=<uploaded file>
    Body (multipart): file=<uploaded file> + text=<additional context>

    Returns the structured extraction schema with confidence scores.
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')
        text = request.data.get('text', '') or request.POST.get('text', '')

        if file:
            # File-based: parse file first, then also run structured extraction
            file_result = QuoteParser.parse(file, file.name)
            raw_text = file_result.get('raw_text', '')
            if text:
                raw_text = text + '\n\n' + raw_text
            if not raw_text.strip():
                error_msg = file_result.get('error', 'No text could be extracted from file')
                hint = file_result.get('hint', '')
                return Response({
                    'status': 'failed',
                    'success': False,
                    'reason': error_msg,
                    'hint': hint or 'Try copying the text from the document and pasting it in the text input instead.',
                    'warnings': file_result.get('warnings', []),
                })
            structured = QuoteParser.parse_raw_text(raw_text)
            # Merge file parser data
            if structured.get('status') == 'success' and file_result.get('success'):
                structured['raw_parser']['format'] = file_result.get('format')
                structured['raw_parser']['pages'] = file_result.get('pages')
            return Response(structured)

        if text:
            result = QuoteParser.parse_raw_text(text)
            return Response(result)

        return Response({
            'status': 'failed',
            'reason': 'Provide either "text" (JSON body) or "file" (multipart upload)'
        }, status=status.HTTP_400_BAD_REQUEST)


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
                    ComparisonEntry.objects.update_or_create(
                        evaluation=evaluation_obj,
                        vendor=q.vendor,
                        defaults={
                            'total_cost': total_cost,
                            'lead_time': q.lead_time_days or 0,
                            'freight_terms': q.freight_terms or '',
                            'payment_terms': q.payment_terms or '',
                            'score': q.evaluation_score or 0,
                            'remarks': ev.get('notes', ''),
                        }
                    )
                except QuoteResponse.DoesNotExist:
                    pass

            # 3. Optionally auto-create PO (prevent duplicates — only if no active PO exists for this PR)
            po_data = None
            if generate_po:
                existing_po = PurchaseOrder.objects.filter(linked_prs=pr, is_active=True).first()
                if existing_po:
                    po_data = {
                        'id': str(existing_po.id),
                        'po_no': existing_po.po_no,
                        'vendor_name': existing_po.vendor.vendor_name if existing_po.vendor else '',
                        'total_amount': float(existing_po.get_total_order_value()),
                        'status': existing_po.status,
                        'already_existed': True,
                    }
                else:
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


# ──────────────────────────────────────────────────────────────
#  Purchase Flow Lifecycle Graph API
# ──────────────────────────────────────────────────────────────

class PurchaseLifecycleGraphView(APIView):
    """Returns the complete lifecycle graph for a Purchase Request.

    GET /api/purchase/lifecycle-graph/?pr_id={uuid}
    GET /api/purchase/lifecycle-graph/?pr_no={PR-2026-00001}
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        pr_id = request.query_params.get('pr_id')
        pr_no = request.query_params.get('pr_no')

        if not pr_id and not pr_no:
            return Response({'error': 'pr_id or pr_no is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if pr_id:
                pr = PurchaseRequest.objects.select_related(
                    'warehouse', 'requested_by__user', 'approved_by'
                ).prefetch_related('lines__product_service', 'approval_trails__actor__user').get(pk=pr_id)
            else:
                pr = PurchaseRequest.objects.select_related(
                    'warehouse', 'requested_by__user', 'approved_by'
                ).prefetch_related('lines__product_service', 'approval_trails__actor__user').get(pr_no=pr_no)
        except PurchaseRequest.DoesNotExist:
            return Response({'error': 'Purchase Request not found'}, status=status.HTTP_404_NOT_FOUND)

        nodes = []
        edges = []
        timeline = []
        kpis = {'total_ordered_value': 0, 'total_received_qty': 0, 'total_billed': 0, 'total_paid': 0,
                'pending_approvals': 0, 'pending_receipts': 0, 'pending_payments': 0}
        anomalies = []

        # ── 1. PR NODE ─────────────────────────────────────────
        pr_data = {
            'id': f'pr-{pr.id}', 'type': 'pr', 'label': pr.pr_no,
            'status': pr.approval_status,
            'date': pr.request_date.isoformat() if pr.request_date else None,
            'data': {
                'warehouse': pr.warehouse.name if pr.warehouse else '',
                'priority': pr.priority,
                'requested_by': pr.requested_by.user.get_full_name() if pr.requested_by and pr.requested_by.user else '',
                'approved_by': pr.approved_by.get_full_name() if pr.approved_by else '',
                'approved_at': pr.approved_at.isoformat() if pr.approved_at else None,
                'required_by': pr.required_by_date.isoformat() if pr.required_by_date else None,
                'justification': pr.justification or '',
                'items': [{
                    'product': l.product_service.product_name if l.product_service else '',
                    'qty': float(l.quantity_requested), 'uom': l.uom,
                    'status': l.status,
                } for l in pr.lines.all()],
                'approvals': [{
                    'action': a.action,
                    'actor': a.actor.user.get_full_name() if a.actor and a.actor.user else '',
                    'date': a.action_date.isoformat() if a.action_date else None,
                    'remarks': a.remarks or '',
                } for a in pr.approval_trails.all()],
            },
        }
        nodes.append(pr_data)
        timeline.append({'date': pr_data['date'], 'label': f'{pr.pr_no} created', 'type': 'pr', 'status': pr.approval_status})

        if pr.approval_status in ('DRAFT', 'PENDING', 'PENDING_APPROVAL'):
            kpis['pending_approvals'] += 1

        # ── 2. RFQ NODES ───────────────────────────────────────
        rfq_ids = set()
        if pr.linked_rfq_id:
            rfq_ids.add(pr.linked_rfq_id)
        for rfq in RFQHeader.objects.filter(linked_prs=pr):
            rfq_ids.add(rfq.id)

        rfqs = RFQHeader.objects.filter(id__in=rfq_ids).prefetch_related(
            'quote_responses__vendor', 'quote_responses__quote_lines__product_service',
            'evaluations__recommended_vendor', 'evaluations__comparison_entries__vendor',
        )

        if pr.approval_status == 'APPROVED' and not rfq_ids:
            anomalies.append({'type': 'missing_step', 'message': 'PR approved but no RFQ created', 'severity': 'warning'})

        for rfq in rfqs:
            rfq_node_id = f'rfq-{rfq.id}'
            nodes.append({
                'id': rfq_node_id, 'type': 'rfq', 'label': rfq.rfq_no,
                'status': rfq.rfq_status,
                'date': rfq.creation_date.isoformat() if rfq.creation_date else None,
                'data': {
                    'mode': rfq.rfq_mode, 'quote_count': rfq.get_active_quote_count(),
                    'expected_quotes': rfq.quote_count_expected,
                },
            })
            edges.append({'from': pr_data['id'], 'to': rfq_node_id, 'label': 'RFQ Created'})
            timeline.append({'date': rfq.creation_date.isoformat() if rfq.creation_date else None,
                             'label': f'{rfq.rfq_no} created', 'type': 'rfq', 'status': rfq.rfq_status})

            # ── 3. QUOTE NODES ──────────────────────────────────
            for quote in rfq.quote_responses.filter(is_active=True):
                q_node_id = f'quote-{quote.id}'
                quote_total = sum(float(ql.get_line_total()) for ql in quote.quote_lines.all())
                nodes.append({
                    'id': q_node_id, 'type': 'quote', 'label': quote.quote_id,
                    'status': 'CHOSEN' if quote.chosen_flag else 'RECEIVED',
                    'date': quote.quote_date.isoformat() if quote.quote_date else None,
                    'data': {
                        'vendor': quote.vendor.vendor_name if quote.vendor else '',
                        'total': round(quote_total, 2),
                        'payment_terms': quote.payment_terms or '',
                        'lead_time': quote.lead_time_days,
                        'chosen': quote.chosen_flag,
                        'lines': [{
                            'product': ql.product_service.product_name if ql.product_service else '',
                            'qty': float(ql.quantity_offered), 'price': float(ql.unit_price),
                            'total': float(ql.get_line_total()),
                        } for ql in quote.quote_lines.all()],
                    },
                })
                edges.append({'from': rfq_node_id, 'to': q_node_id, 'label': quote.vendor.vendor_name if quote.vendor else 'Quote'})

            # ── 4. EVALUATION NODES ─────────────────────────────
            for ev in rfq.evaluations.all():
                ev_node_id = f'eval-{ev.id}'
                nodes.append({
                    'id': ev_node_id, 'type': 'evaluation', 'label': ev.evaluation_id,
                    'status': ev.approval_status,
                    'date': ev.evaluation_date.isoformat() if ev.evaluation_date else None,
                    'data': {
                        'recommended_vendor': ev.recommended_vendor.vendor_name if ev.recommended_vendor else '',
                        'justification': ev.justification_notes or '',
                        'comparisons': [{
                            'vendor': c.vendor.vendor_name if c.vendor else '',
                            'total_cost': float(c.total_cost), 'score': float(c.score),
                            'lead_time': c.lead_time,
                        } for c in ev.comparison_entries.all()],
                    },
                })
                edges.append({'from': rfq_node_id, 'to': ev_node_id, 'label': 'Evaluated'})

        # ── 5. PO NODES ────────────────────────────────────────
        pos = PurchaseOrder.objects.filter(linked_prs=pr).select_related(
            'vendor', 'warehouse', 'transporter'
        ).prefetch_related('po_lines__product_service')

        if pr.approval_status == 'APPROVED' and rfq_ids and not pos.exists():
            anomalies.append({'type': 'missing_step', 'message': 'RFQ exists but no PO created', 'severity': 'warning'})

        for po in pos:
            po_node_id = f'po-{po.id}'
            po_total = float(po.get_total_order_value())
            kpis['total_ordered_value'] += po_total
            nodes.append({
                'id': po_node_id, 'type': 'po', 'label': po.po_no,
                'status': po.status,
                'date': po.po_date.isoformat() if po.po_date else None,
                'data': {
                    'vendor': po.vendor.vendor_name if po.vendor else '',
                    'warehouse': po.warehouse.name if po.warehouse else '',
                    'total_value': round(po_total, 2),
                    'payment_terms': po.payment_terms or '',
                    'expected_delivery': po.expected_delivery_end.isoformat() if po.expected_delivery_end else None,
                    'is_fully_received': po.is_fully_received(),
                    'lines': [{
                        'product': pl.product_service.product_name if pl.product_service else '',
                        'qty_ordered': float(pl.quantity_ordered),
                        'unit_price': float(pl.unit_price), 'uom': pl.uom,
                    } for pl in po.po_lines.all()],
                },
            })
            # Link PO to RFQ or directly to PR
            linked = False
            if po.linked_rfq_id and f'rfq-{po.linked_rfq_id}' in [n['id'] for n in nodes]:
                edges.append({'from': f'rfq-{po.linked_rfq_id}', 'to': po_node_id, 'label': 'PO Created'})
                linked = True
            if not linked:
                edges.append({'from': pr_data['id'], 'to': po_node_id, 'label': 'PO Created'})
            timeline.append({'date': po.po_date.isoformat() if po.po_date else None,
                             'label': f'{po.po_no} ({po.vendor.vendor_name if po.vendor else ""})', 'type': 'po', 'status': po.status})

            if po.status in ('APPROVED', 'ISSUED') and not po.is_fully_received():
                kpis['pending_receipts'] += 1

            # ── 6. RECEIPT / GRN NODES ──────────────────────────
            receipts = po.receipt_advices.select_related('vendor', 'warehouse').prefetch_related(
                'receipt_lines__product', 'freight_advices__transporter',
            )
            for ra in receipts.all():
                ra_node_id = f'grn-{ra.id}'
                total_rcvd = float(ra.get_total_received())
                kpis['total_received_qty'] += total_rcvd
                # Avoid duplicate nodes if receipt is linked to multiple POs
                if not any(n['id'] == ra_node_id for n in nodes):
                    nodes.append({
                        'id': ra_node_id, 'type': 'grn', 'label': ra.receipt_advice_no,
                        'status': ra.qc_status or ('PARTIAL' if ra.partial_receipt_flag else 'RECEIVED'),
                        'date': ra.receipt_date.isoformat() if ra.receipt_date else None,
                        'data': {
                            'vendor': ra.vendor.vendor_name if ra.vendor else '',
                            'warehouse': ra.warehouse.name if ra.warehouse else '',
                            'total_received': total_rcvd,
                            'qc_status': ra.qc_status, 'partial': ra.partial_receipt_flag,
                            'vehicle': ra.vehicle_number or '',
                            'lines': [{
                                'product': rl.product.product_name if rl.product else '',
                                'qty_received': float(rl.quantity_received), 'uom': rl.uom,
                                'batch': rl.batch_no or '',
                            } for rl in ra.receipt_lines.all()],
                        },
                    })
                    timeline.append({'date': ra.receipt_date.isoformat() if ra.receipt_date else None,
                                     'label': f'{ra.receipt_advice_no} received', 'type': 'grn', 'status': ra.qc_status or 'RECEIVED'})
                edges.append({'from': po_node_id, 'to': ra_node_id, 'label': 'Received'})

                # ── 7. FREIGHT NODES ────────────────────────────
                for fa in ra.freight_advices.filter(is_active=True):
                    fa_node_id = f'freight-{fa.id}'
                    if not any(n['id'] == fa_node_id for n in nodes):
                        nodes.append({
                            'id': fa_node_id, 'type': 'freight', 'label': fa.advice_no,
                            'status': fa.status,
                            'date': fa.created_date.isoformat() if fa.created_date else None,
                            'data': {
                                'transporter': fa.transporter.name if fa.transporter else '',
                                'amount': float(fa.payable_amount), 'freight_terms': fa.freight_terms,
                                'lorry': fa.lorry_no or '',
                            },
                        })
                        timeline.append({'date': fa.created_date.isoformat() if fa.created_date else None,
                                         'label': f'{fa.advice_no}', 'type': 'freight', 'status': fa.status})
                    edges.append({'from': ra_node_id, 'to': fa_node_id, 'label': 'Freight'})

                # ── 8. VENDOR BILL from Receipt ─────────────────
                for bill in VendorBill.objects.filter(receipt_advice=ra, is_active=True):
                    bill_node_id = f'bill-{bill.id}'
                    if not any(n['id'] == bill_node_id for n in nodes):
                        kpis['total_billed'] += float(bill.total_amount)
                        nodes.append({
                            'id': bill_node_id, 'type': 'bill', 'label': bill.bill_no,
                            'status': bill.status,
                            'date': bill.bill_date.isoformat() if bill.bill_date else None,
                            'data': {
                                'vendor': bill.vendor.vendor_name if bill.vendor else '',
                                'invoice_no': bill.vendor_invoice_no or '',
                                'total': float(bill.total_amount), 'paid': float(bill.amount_paid),
                                'due_date': bill.due_date.isoformat() if bill.due_date else None,
                            },
                        })
                        timeline.append({'date': bill.bill_date.isoformat() if bill.bill_date else None,
                                         'label': f'{bill.bill_no}', 'type': 'bill', 'status': bill.status})
                    edges.append({'from': ra_node_id, 'to': bill_node_id, 'label': 'Billed'})
                    self._add_payment_nodes(bill, bill_node_id, nodes, edges, timeline, kpis)

            # ── 8b. VENDOR BILL from PO (no receipt link) ───────
            for bill in VendorBill.objects.filter(purchase_order=po, is_active=True):
                bill_node_id = f'bill-{bill.id}'
                if not any(n['id'] == bill_node_id for n in nodes):
                    kpis['total_billed'] += float(bill.total_amount)
                    nodes.append({
                        'id': bill_node_id, 'type': 'bill', 'label': bill.bill_no,
                        'status': bill.status,
                        'date': bill.bill_date.isoformat() if bill.bill_date else None,
                        'data': {
                            'vendor': bill.vendor.vendor_name if bill.vendor else '',
                            'invoice_no': bill.vendor_invoice_no or '',
                            'total': float(bill.total_amount), 'paid': float(bill.amount_paid),
                            'due_date': bill.due_date.isoformat() if bill.due_date else None,
                        },
                    })
                    timeline.append({'date': bill.bill_date.isoformat() if bill.bill_date else None,
                                     'label': f'{bill.bill_no}', 'type': 'bill', 'status': bill.status})
                    edges.append({'from': po_node_id, 'to': bill_node_id, 'label': 'Billed'})
                    self._add_payment_nodes(bill, bill_node_id, nodes, edges, timeline, kpis)

        # ── Anomalies ──────────────────────────────────────────
        if kpis['total_billed'] > 0 and kpis['total_paid'] < kpis['total_billed']:
            kpis['pending_payments'] = round(kpis['total_billed'] - kpis['total_paid'], 2)

        # Sort timeline by date, then by lifecycle stage order
        _stage_order = {'pr': 0, 'rfq': 1, 'quote': 2, 'evaluation': 3, 'po': 4, 'grn': 5, 'freight': 6, 'bill': 7, 'payment': 8, 'credit': 9}
        timeline.sort(key=lambda t: (t.get('date') or '', _stage_order.get(t.get('type'), 99)))

        # ── Status funnel ───────────────────────────────────────
        funnel = [
            {'stage': 'Purchase Request', 'status': pr.approval_status, 'done': pr.approval_status == 'APPROVED'},
            {'stage': 'RFQ Sent', 'status': 'DONE' if rfq_ids else 'PENDING', 'done': bool(rfq_ids)},
            {'stage': 'Quotes Received', 'status': 'DONE' if any(n['type'] == 'quote' for n in nodes) else 'PENDING',
             'done': any(n['type'] == 'quote' for n in nodes)},
            {'stage': 'PO Created', 'status': 'DONE' if pos.exists() else 'PENDING', 'done': pos.exists()},
            {'stage': 'Goods Received', 'status': 'DONE' if any(n['type'] == 'grn' for n in nodes) else 'PENDING',
             'done': any(n['type'] == 'grn' for n in nodes)},
            {'stage': 'Billed', 'status': 'DONE' if any(n['type'] == 'bill' for n in nodes) else 'PENDING',
             'done': any(n['type'] == 'bill' for n in nodes)},
            {'stage': 'Paid', 'status': 'DONE' if any(n['type'] == 'payment' for n in nodes) else 'PENDING',
             'done': any(n['type'] == 'payment' for n in nodes)},
        ]

        return Response({
            'pr': {'id': str(pr.id), 'pr_no': pr.pr_no, 'status': pr.approval_status},
            'nodes': nodes,
            'edges': edges,
            'timeline': timeline,
            'funnel': funnel,
            'kpis': kpis,
            'anomalies': anomalies,
        })

    @staticmethod
    def _add_payment_nodes(bill, bill_node_id, nodes, edges, timeline, kpis):
        """Add payment and credit nodes for a bill."""
        for pay in PaymentMade.objects.filter(bill=bill, is_active=True):
            pay_node_id = f'payment-{pay.id}'
            if not any(n['id'] == pay_node_id for n in nodes):
                kpis['total_paid'] += float(pay.amount)
                nodes.append({
                    'id': pay_node_id, 'type': 'payment', 'label': pay.payment_no,
                    'status': pay.status,
                    'date': pay.payment_date.isoformat() if pay.payment_date else None,
                    'data': {
                        'amount': float(pay.amount), 'mode': pay.payment_mode,
                        'reference': pay.reference_no or '',
                    },
                })
                timeline.append({'date': pay.payment_date.isoformat() if pay.payment_date else None,
                                 'label': f'{pay.payment_no}', 'type': 'payment', 'status': pay.status})
            edges.append({'from': bill_node_id, 'to': pay_node_id, 'label': 'Paid'})

        for cr in VendorCredit.objects.filter(bill=bill, is_active=True):
            cr_node_id = f'credit-{cr.id}'
            if not any(n['id'] == cr_node_id for n in nodes):
                nodes.append({
                    'id': cr_node_id, 'type': 'credit', 'label': cr.credit_no,
                    'status': cr.status,
                    'date': cr.credit_date.isoformat() if cr.credit_date else None,
                    'data': {
                        'type': cr.credit_type, 'amount': float(cr.total_amount),
                        'reason': cr.reason or '',
                    },
                })
            edges.append({'from': bill_node_id, 'to': cr_node_id, 'label': cr.credit_type})


class PurchaseAttachmentViewSet(viewsets.ModelViewSet):
    """ViewSet for uploading, listing, and deleting attachments for any purchase document."""

    serializer_class = PurchaseAttachmentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        qs = PurchaseAttachment.objects.filter(is_active=True)
        module = self.request.query_params.get('module')
        record_id = self.request.query_params.get('record_id')
        if module:
            qs = qs.filter(module=module)
        if record_id:
            qs = qs.filter(record_id=record_id)
        return qs

    def perform_create(self, serializer):
        f = self.request.FILES.get('file')
        if not f:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'file': 'File is required'})
        serializer.save(
            file=f,
            file_name=f.name,
            file_size=f.size,
            file_type=f.content_type or '',
            uploaded_by=self.request.user,
        )

    def perform_destroy(self, instance):
        instance.soft_delete()
