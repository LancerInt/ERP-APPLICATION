"""Views for finance application."""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rbac.permissions import HasModulePermission
from django.utils import timezone

from .models import (
    VendorLedger,
    PaymentAdviceWorkflow,
    BankStatementUpload,
    CustomerLedger,
    FreightLedger,
    WageLedger,
    CreditDebitNote,
    GSTReconciliation,
    PettyCashRegister,
    PettyCashTransaction,
)
from .serializers import (
    VendorLedgerSerializer,
    PaymentAdviceWorkflowSerializer,
    BankStatementUploadSerializer,
    CustomerLedgerSerializer,
    FreightLedgerSerializer,
    WageLedgerSerializer,
    CreditDebitNoteSerializer,
    GSTReconciliationSerializer,
    PettyCashRegisterSerializer,
    PettyCashTransactionSerializer,
)
from .services import FinanceService
from .selectors import FinanceSelector


class VendorLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for VendorLedger."""

    queryset = VendorLedger.objects.select_related('vendor').filter(is_active=True)
    serializer_class = VendorLedgerSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Vendor Ledger'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['vendor', 'document_type', 'payment_status']
    search_fields = ['vendor__name', 'document_reference_id']
    ordering_fields = ['document_date', 'due_date']
    ordering = ['-document_date']

    @action(detail=False, methods=['get'])
    def ageing_report(self, request):
        """Get vendor ageing report."""
        vendor_id = request.query_params.get('vendor_id')
        try:
            ageing = FinanceSelector.get_vendor_ageing(vendor_id)
            return Response(ageing, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class PaymentAdviceWorkflowViewSet(viewsets.ModelViewSet):
    """ViewSet for PaymentAdviceWorkflow."""

    queryset = PaymentAdviceWorkflow.objects.prefetch_related(
        'tax_deductions',
        'finance_approval',
        'office_authorization'
    ).filter(is_active=True)
    serializer_class = PaymentAdviceWorkflowSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Payment Advice'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['beneficiary_type', 'payment_status']
    ordering_fields = ['prepared_date', 'due_date']
    ordering = ['-prepared_date']

    @action(detail=True, methods=['post'])
    def submit_finance(self, request, pk=None):
        """Submit payment for finance manager approval."""
        advice = self.get_object()
        if advice.payment_status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT payments can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            FinanceService.submit_payment_for_approval(advice, request.user)
            return Response(
                {'message': 'Payment submitted for approval'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def approve_finance(self, request, pk=None):
        """Finance manager approval."""
        advice = self.get_object()
        if advice.payment_status != 'PENDING_FINANCE':
            return Response(
                {'error': 'Payment not in finance approval stage'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            FinanceService.approve_payment_finance(
                advice,
                request.user,
                request.data.get('remarks', '')
            )
            return Response(
                {'message': 'Payment approved by finance'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def authorize(self, request, pk=None):
        """Office manager authorization."""
        advice = self.get_object()
        if advice.payment_status != 'PENDING_AUTHORIZATION':
            return Response(
                {'error': 'Payment not in authorization stage'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            FinanceService.authorize_payment(
                advice,
                request.user,
                request.data.get('remarks', '')
            )
            return Response(
                {'message': 'Payment authorized'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark payment as paid."""
        advice = self.get_object()
        if advice.payment_status != 'APPROVED':
            return Response(
                {'error': 'Only APPROVED payments can be marked paid'},
                status=status.HTTP_400_BAD_REQUEST
            )
        advice.payment_status = 'PAID'
        advice.payment_reference = request.data.get('payment_reference', '')
        advice.save(update_fields=['payment_status', 'payment_reference', 'updated_at', 'updated_by'])
        return Response(self.get_serializer(advice).data)


class BankStatementUploadViewSet(viewsets.ModelViewSet):
    """ViewSet for BankStatementUpload."""

    queryset = BankStatementUpload.objects.prefetch_related(
        'matched_entries',
        'exceptions'
    ).filter(is_active=True)
    serializer_class = BankStatementUploadSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Bank Statement'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['bank_account', 'parsing_status']
    ordering_fields = ['statement_period_end']
    ordering = ['-statement_period_end']

    @action(detail=True, methods=['post'])
    def parse(self, request, pk=None):
        """Parse bank statement file."""
        upload = self.get_object()
        try:
            FinanceService.upload_and_parse_bank_statement(upload)
            return Response(
                {'message': 'Bank statement parsed successfully'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def auto_match(self, request, pk=None):
        """Auto-match bank entries."""
        upload = self.get_object()
        try:
            matches = FinanceService.auto_match_bank_entries(upload)
            return Response(
                {'matched_count': len(matches), 'matches': matches},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class CustomerLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for CustomerLedger."""

    queryset = CustomerLedger.objects.select_related('customer').filter(is_active=True)
    serializer_class = CustomerLedgerSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Customer Ledger'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['customer', 'document_type', 'payment_status']
    ordering_fields = ['document_date', 'due_date']
    ordering = ['-document_date']

    @action(detail=False, methods=['get'])
    def ageing_report(self, request):
        """Get customer ageing report."""
        customer_id = request.query_params.get('customer_id')
        try:
            ageing = FinanceSelector.get_customer_ageing(customer_id)
            return Response(ageing, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class FreightLedgerViewSet(viewsets.ModelViewSet):
    """ViewSet for FreightLedger."""

    queryset = FreightLedger.objects.prefetch_related(
        'payment_schedule'
    ).filter(is_active=True)
    serializer_class = FreightLedgerSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Freight Ledger'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['direction', 'transporter']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def get_balance(self, request):
        """Get freight balance for transporter."""
        transporter_id = request.query_params.get('transporter_id')
        try:
            balance = FinanceSelector.get_freight_balance(transporter_id)
            return Response(balance, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class WageLedgerViewSet(viewsets.ModelViewSet):
    """ViewSet for WageLedger."""

    queryset = WageLedger.objects.filter(is_active=True)
    serializer_class = WageLedgerSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Wage Ledger'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['approval_status', 'wage_voucher_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']


class CreditDebitNoteViewSet(viewsets.ModelViewSet):
    """ViewSet for CreditDebitNote."""

    queryset = CreditDebitNote.objects.filter(is_active=True)
    serializer_class = CreditDebitNoteSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Credit/Debit Note'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['note_type', 'approval_status']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve credit/debit note."""
        note = self.get_object()
        if note.approval_status != 'PENDING':
            return Response(
                {'error': 'Only PENDING notes can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            FinanceService.approve_credit_debit_note(note, request.user)
            return Response(
                {'message': 'Note approved'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class GSTReconciliationViewSet(viewsets.ModelViewSet):
    """ViewSet for GSTReconciliation."""

    queryset = GSTReconciliation.objects.prefetch_related('adjustments').filter(is_active=True)
    serializer_class = GSTReconciliationSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'GST Report'
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['data_source']
    ordering_fields = ['reporting_period_end']
    ordering = ['-reporting_period_end']

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        """Reconcile GST."""
        report = self.get_object()
        try:
            FinanceService.reconcile_gst(report, request.user)
            return Response(
                {'message': 'GST reconciled'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class PettyCashRegisterViewSet(viewsets.ModelViewSet):
    """ViewSet for PettyCashRegister."""

    queryset = PettyCashRegister.objects.prefetch_related('transactions').filter(is_active=True)
    serializer_class = PettyCashRegisterSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Petty Cash'

    @action(detail=True, methods=['post'])
    def advance(self, request, pk=None):
        """Issue petty cash advance."""
        register = self.get_object()
        try:
            FinanceService.advance_petty_cash(
                register,
                request.data.get('amount'),
                request.data.get('voucher_reference_id'),
                request.data.get('voucher_reference_type'),
                request.data.get('notes', ''),
                request.user
            )
            return Response(
                {'message': 'Advance issued'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def settlement(self, request, pk=None):
        """Settle petty cash."""
        register = self.get_object()
        try:
            FinanceService.settle_petty_cash(
                register,
                request.data.get('amount'),
                request.data.get('voucher_reference_id'),
                request.data.get('voucher_reference_type'),
                request.data.get('notes', ''),
                request.user
            )
            return Response(
                {'message': 'Settlement recorded'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get'])
    def balance(self, request, pk=None):
        """Get petty cash balance."""
        register = self.get_object()
        balance = FinanceSelector.get_petty_cash_balance(register.id)
        return Response(balance, status=status.HTTP_200_OK)
