"""API views for quality app."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rbac.permissions import HasModulePermission
from django.db import transaction
from django.utils import timezone

from .models import (
    QCParameterLibrary, QCRequest, SelectedParameter, QCLabJob,
    AssignedParameter, QCFinalReport, CounterSampleRegister
)
from .serializers import (
    QCParameterLibrarySerializer, QCRequestListSerializer, QCRequestDetailSerializer,
    QCRequestCreateSerializer, SelectedParameterSerializer, QCLabJobListSerializer,
    QCLabJobDetailSerializer, QCLabJobCreateSerializer, AssignedParameterSerializer,
    QCFinalReportSerializer, QCFinalReportCreateSerializer, CounterSampleRegisterSerializer
)
from .services import (
    QCRequestService, QCLabJobService, QCFinalReportService, CounterSampleService,
    QCReportingService
)
from .selectors import (
    QCRequestSelector, QCLabJobSelector, QCFinalReportSelector, AssignedParameterSelector,
    CounterSampleSelector, QCParameterSelector
)


class QCParameterLibraryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for QC parameter library (read-only)."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'QC Parameter'
    serializer_class = QCParameterLibrarySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['critical_flag', 'applicable_template', 'applicable_product']
    search_fields = ['parameter_code', 'parameter_name']

    def get_queryset(self):
        return QCParameterLibrary.objects.select_related(
            'applicable_template', 'applicable_product'
        ).filter(is_active=True)

    @action(detail=False, methods=['get'])
    def critical_parameters(self, request):
        """Get all critical parameters."""
        template = request.query_params.get('template')
        product = request.query_params.get('product')
        queryset = QCParameterSelector.get_critical_parameters(template, product)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class QCRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for QC request management."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'QC Request'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'product', 'stage', 'priority', 'status']
    search_fields = ['request_no', 'batch', 'product__product_code']
    ordering_fields = ['request_date', 'priority']
    ordering = ['-request_date']

    def get_queryset(self):
        user = self.request.user
        base_query = QCRequest.objects.select_related(
            'warehouse', 'product', 'requested_by', 'qc_template'
        ).prefetch_related('selected_parameters', 'lab_jobs')

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(warehouse__in=warehouses)

        return base_query

    def get_serializer_class(self):
        if self.action == 'create':
            return QCRequestCreateSerializer
        elif self.action == 'retrieve':
            return QCRequestDetailSerializer
        return QCRequestListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create new QC request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user.stakeholder_profile
        qc_request = QCRequestService.create_qc_request(
            warehouse=serializer.validated_data['warehouse'],
            product=serializer.validated_data['product'],
            batch=serializer.validated_data['batch'],
            stage=serializer.validated_data['stage'],
            qc_template=serializer.validated_data['qc_template'],
            requested_by=user,
            requestor_role=user.user.get_full_name(),
            sample_photo=serializer.validated_data.get('sample_photo'),
            sample_qty=serializer.validated_data.get('sample_qty'),
            priority=serializer.validated_data.get('priority', 'NORMAL'),
            counter_sample_required=serializer.validated_data.get('counter_sample_required', False),
            remarks=serializer.validated_data.get('remarks', '')
        )

        return Response(
            QCRequestDetailSerializer(qc_request).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def assign_lab_jobs(self, request, pk=None):
        """Create and assign lab jobs for QC request."""
        qc_request = self.get_object()
        analyst_assignments = request.data.get('analyst_assignments', [])

        lab_jobs = QCLabJobService.create_lab_jobs(qc_request, analyst_assignments)

        serializer = QCLabJobListSerializer(lab_jobs, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending QC requests."""
        warehouse = request.query_params.get('warehouse')
        stage = request.query_params.get('stage')
        queryset = QCRequestSelector.get_pending_qc_requests(warehouse, stage)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def urgent(self, request):
        """Get urgent QC requests."""
        queryset = QCRequestSelector.get_urgent_qc_requests()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue QC requests."""
        queryset = QCRequestSelector.get_overdue_qc_requests()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class SelectedParameterViewSet(viewsets.ModelViewSet):
    """ViewSet for selected parameters in QC requests."""
    permission_classes = [IsAuthenticated]
    serializer_class = SelectedParameterSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['qc_request', 'parameter']

    def get_queryset(self):
        return SelectedParameter.objects.select_related(
            'qc_request', 'parameter'
        ).filter(is_active=True)


class QCLabJobViewSet(viewsets.ModelViewSet):
    """ViewSet for QC lab job management."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'QC Lab Job'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['qc_request', 'analyst', 'status']
    ordering_fields = ['sample_received_date', 'status']
    ordering = ['-sample_received_date']

    def get_queryset(self):
        user = self.request.user
        base_query = QCLabJob.objects.select_related(
            'qc_request', 'analyst'
        ).prefetch_related('assigned_parameters')

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(qc_request__warehouse__in=warehouses)

        return base_query

    def get_serializer_class(self):
        if self.action == 'create':
            return QCLabJobCreateSerializer
        elif self.action == 'retrieve':
            return QCLabJobDetailSerializer
        return QCLabJobListSerializer

    @action(detail=True, methods=['post'])
    def start_work(self, request, pk=None):
        """Mark lab job as in progress."""
        lab_job = self.get_object()
        lab_job.mark_in_progress()

        return Response(
            QCLabJobDetailSerializer(lab_job).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def record_result(self, request, pk=None):
        """Record test result for a parameter."""
        lab_job = self.get_object()
        data = request.data

        assigned_param = QCLabJobService.record_parameter_result(
            lab_job=lab_job,
            parameter=data['parameter'],
            result_value=data.get('result_value'),
            result_text=data.get('result_text', ''),
            result_photo=data.get('result_photo'),
            pass_fail=data.get('pass_fail')
        )

        return Response(
            AssignedParameterSerializer(assigned_param).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def complete_job(self, request, pk=None):
        """Complete lab job with all results."""
        lab_job = self.get_object()
        data = request.data

        lab_job = QCLabJobService.complete_lab_job(
            lab_job=lab_job,
            comments=data.get('comments', ''),
            results_attachment=data.get('results_attachment')
        )

        return Response(
            QCLabJobDetailSerializer(lab_job).data,
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending lab jobs."""
        warehouse = request.query_params.get('warehouse')
        queryset = QCLabJobSelector.get_pending_lab_jobs(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class AssignedParameterViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for assigned parameter results."""
    permission_classes = [IsAuthenticated]
    serializer_class = AssignedParameterSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lab_job', 'parameter', 'pass_fail']

    def get_queryset(self):
        return AssignedParameter.objects.select_related(
            'lab_job', 'parameter'
        ).filter(is_active=True)

    @action(detail=False, methods=['get'])
    def failed_parameters(self, request):
        """Get failed parameters."""
        warehouse = request.query_params.get('warehouse')
        queryset = AssignedParameterSelector.get_failed_parameters(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class QCFinalReportViewSet(viewsets.ModelViewSet):
    """ViewSet for final QC report management."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'QC Report'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['qc_request', 'overall_result']
    ordering_fields = ['prepared_date']
    ordering = ['-prepared_date']

    def get_queryset(self):
        user = self.request.user
        base_query = QCFinalReport.objects.select_related(
            'qc_request', 'prepared_by'
        ).prefetch_related('distribution_list')

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(qc_request__warehouse__in=warehouses)

        return base_query

    def get_serializer_class(self):
        if self.action == 'create':
            return QCFinalReportCreateSerializer
        return QCFinalReportSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Generate final QC report."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user.stakeholder_profile
        distribution_list = request.data.get('distribution_list', [])

        final_report = QCFinalReportService.generate_final_report(
            qc_request=serializer.validated_data['qc_request'],
            prepared_by=user,
            overall_result=serializer.validated_data['overall_result'],
            remarks=serializer.validated_data.get('remarks', ''),
            digital_signature=serializer.validated_data.get('digital_signature'),
            attachments=serializer.validated_data.get('attachments'),
            distribution_list=distribution_list
        )

        return Response(
            QCFinalReportSerializer(final_report).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def failed_batches(self, request):
        """Get failed QC batches."""
        warehouse = request.query_params.get('warehouse')
        days = int(request.query_params.get('days', 30))
        queryset = QCFinalReportSelector.get_failed_batches(warehouse, days)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pass_rate(self, request):
        """Get pass rate statistics by warehouse."""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        summary = QCFinalReportSelector.get_pass_rate_by_warehouse(start_date, end_date)

        return Response(list(summary))


class CounterSampleRegisterViewSet(viewsets.ModelViewSet):
    """ViewSet for counter sample register."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Counter Sample'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['qc_request', 'storage_location']
    ordering_fields = ['expected_return_date', 'created_at']
    ordering = ['expected_return_date']

    def get_queryset(self):
        user = self.request.user
        base_query = CounterSampleRegister.objects.select_related(
            'qc_request', 'issued_to', 'disposal_approved_by'
        )

        if hasattr(user, 'stakeholder_profile'):
            warehouses = user.stakeholder_profile.warehouse_scope.all()
            if warehouses.exists():
                base_query = base_query.filter(qc_request__warehouse__in=warehouses)

        return base_query

    serializer_class = CounterSampleRegisterSerializer

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def issue(self, request, pk=None):
        """Issue counter sample to user."""
        counter_sample = self.get_object()
        data = request.data

        counter_sample = CounterSampleService.issue_counter_sample(
            counter_sample=counter_sample,
            issued_to=data['issued_to'],
            expected_return_date=data.get('expected_return_date')
        )

        return Response(
            self.get_serializer(counter_sample).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def mark_returned(self, request, pk=None):
        """Mark counter sample as returned."""
        counter_sample = self.get_object()
        data = request.data

        counter_sample = CounterSampleService.mark_counter_sample_returned(
            counter_sample=counter_sample,
            actual_return_date=data.get('actual_return_date')
        )

        return Response(
            self.get_serializer(counter_sample).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def request_disposal(self, request, pk=None):
        """Request disposal approval for counter sample."""
        counter_sample = self.get_object()
        user = request.user.stakeholder_profile

        counter_sample = CounterSampleService.request_counter_sample_disposal(
            counter_sample=counter_sample,
            disposed_by=user
        )

        return Response(
            self.get_serializer(counter_sample).data,
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get active counter samples."""
        warehouse = request.query_params.get('warehouse')
        queryset = CounterSampleSelector.get_active_counter_samples(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue counter samples."""
        warehouse = request.query_params.get('warehouse')
        queryset = CounterSampleSelector.get_overdue_counter_samples(warehouse)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
