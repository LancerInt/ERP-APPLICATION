"""
Views for the communications app.
Handles email template CRUD, email sending, PDF preview, and email logs.
"""
import logging

from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import EmailTemplate, EmailLog
from .serializers import (
    EmailTemplateSerializer,
    EmailTemplateListSerializer,
    EmailLogSerializer,
    SendEmailRequestSerializer,
    PreviewRequestSerializer,
)
from .services import TemplateEngine, PDFGenerator, EmailService

logger = logging.getLogger(__name__)


class EmailTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for email templates.

    list:   GET    /api/communications/templates/
    create: POST   /api/communications/templates/
    read:   GET    /api/communications/templates/{id}/
    update: PUT    /api/communications/templates/{id}/
    patch:  PATCH  /api/communications/templates/{id}/
    delete: DELETE /api/communications/templates/{id}/

    Custom actions:
    - preview:      POST /api/communications/templates/{id}/preview/
    - preview-pdf:  POST /api/communications/templates/{id}/preview-pdf/
    """

    queryset = EmailTemplate.objects.filter(is_active=True)
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return EmailTemplateListSerializer
        return EmailTemplateSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        # If marked as default, un-default others
        if instance.is_default:
            EmailTemplate.objects.filter(is_default=True).exclude(
                pk=instance.pk
            ).update(is_default=False)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        if instance.is_default:
            EmailTemplate.objects.filter(is_default=True).exclude(
                pk=instance.pk
            ).update(is_default=False)

    @action(detail=True, methods=['post'], url_path='preview')
    def preview(self, request, pk=None):
        """
        Preview rendered email HTML for a specific RFQ + vendor combination.
        POST with {rfq_id, vendor_id}
        """
        template = self.get_object()
        serializer = PreviewRequestSerializer(data={
            'rfq_id': request.data.get('rfq_id'),
            'template_id': str(template.id),
            'vendor_id': request.data.get('vendor_id'),
        })
        serializer.is_valid(raise_exception=True)

        rfq, vendor, company = _resolve_entities(serializer.validated_data)

        engine = TemplateEngine()
        context = engine.build_context(rfq, vendor, company)
        rendered_subject = engine.render(template.subject, context)
        rendered_body = engine.render(template.body_html, context)

        return Response({
            'subject': rendered_subject,
            'body_html': rendered_body,
            'context_data': {
                k: v for k, v in context.items() if k != 'product_table'
            },
        })

    @action(detail=True, methods=['post'], url_path='preview-pdf')
    def preview_pdf(self, request, pk=None):
        """
        Generate and return a PDF preview.
        POST with {rfq_id, vendor_id}
        """
        template = self.get_object()
        serializer = PreviewRequestSerializer(data={
            'rfq_id': request.data.get('rfq_id'),
            'template_id': str(template.id),
            'vendor_id': request.data.get('vendor_id'),
        })
        serializer.is_valid(raise_exception=True)

        rfq, vendor, company = _resolve_entities(serializer.validated_data)

        engine = TemplateEngine()
        context = engine.build_context(rfq, vendor, company)
        full_html = PDFGenerator.build_full_html(template, context)
        pdf_buffer = PDFGenerator.generate(full_html)

        response = HttpResponse(
            pdf_buffer.read(), content_type='application/pdf'
        )
        response['Content-Disposition'] = (
            f'inline; filename="{rfq.rfq_no}_preview.pdf"'
        )
        return response


class EmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for email logs.

    list: GET /api/communications/email-logs/
    read: GET /api/communications/email-logs/{id}/

    Filterable by rfq_id, vendor_id, email_sent.
    """

    queryset = EmailLog.objects.select_related(
        'rfq', 'template', 'vendor', 'sent_by'
    ).all()
    serializer_class = EmailLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['rfq', 'vendor', 'email_sent', 'pdf_generated']
    search_fields = ['vendor_email', 'subject']
    ordering_fields = ['created_at', 'sent_at']


class RFQEmailViewSet(viewsets.ViewSet):
    """
    Actions for sending RFQ emails and viewing logs per RFQ.

    - send-emails:  POST /api/communications/rfq-emails/send-emails/
    - rfq-logs:     GET  /api/communications/rfq-emails/{rfq_id}/logs/
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'], url_path='send-emails')
    def send_emails(self, request):
        """
        Send RFQ emails to selected vendors with PDF attachments.
        POST with {rfq_id, template_id, vendor_ids: [...]}
        """
        serializer = SendEmailRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from purchase.models import RFQHeader
        from master.models import Vendor

        try:
            rfq = RFQHeader.objects.get(id=data['rfq_id'])
        except RFQHeader.DoesNotExist:
            return Response(
                {'error': 'RFQ not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            template = EmailTemplate.objects.get(id=data['template_id'])
        except EmailTemplate.DoesNotExist:
            return Response(
                {'error': 'Email template not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        vendors = Vendor.objects.filter(
            id__in=data['vendor_ids'], active_flag=True
        )
        if not vendors.exists():
            return Response(
                {'error': 'No valid vendors found.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine company from vendor or RFQ context
        company = _get_company(rfq, vendors.first())

        result = EmailService.send_bulk_rfq_emails(
            rfq=rfq,
            vendors=vendors,
            template=template,
            company=company,
            sent_by=request.user,
        )

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='logs')
    def rfq_logs(self, request, pk=None):
        """Get all email logs for a specific RFQ."""
        logs = EmailLog.objects.filter(rfq_id=pk).select_related(
            'template', 'vendor', 'sent_by'
        )
        serializer = EmailLogSerializer(logs, many=True)
        return Response(serializer.data)


def _resolve_entities(validated_data):
    """Resolve RFQ, Vendor, and Company from validated request data."""
    from purchase.models import RFQHeader
    from master.models import Vendor

    rfq = RFQHeader.objects.get(id=validated_data['rfq_id'])
    vendor = Vendor.objects.get(id=validated_data['vendor_id'])
    company = _get_company(rfq, vendor)

    return rfq, vendor, company


def _get_company(rfq, vendor):
    """Determine the company from vendor or RFQ context."""
    from core.models import Company

    # Try to get company from vendor first
    if vendor and hasattr(vendor, 'company') and vendor.company:
        return vendor.company

    # Fall back to first company in the system
    return Company.objects.first()
