"""
Serializers for the communications app.
"""
from rest_framework import serializers
from .models import EmailTemplate, EmailLog


class EmailTemplateSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for EmailTemplate."""

    available_placeholders = serializers.SerializerMethodField()

    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'name', 'subject', 'body_html',
            'pdf_header_html', 'pdf_body_html', 'pdf_footer_html',
            'is_default', 'available_placeholders',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_available_placeholders(self, obj):
        return EmailTemplate.AVAILABLE_PLACEHOLDERS

    def validate_name(self, value):
        """Ensure template name is unique (case-insensitive)."""
        qs = EmailTemplate.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A template with this name already exists.'
            )
        return value


class EmailTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing templates."""

    class Meta:
        model = EmailTemplate
        fields = [
            'id', 'name', 'subject', 'is_default',
            'is_active', 'created_at',
        ]


class EmailLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for EmailLog."""

    rfq_number = serializers.CharField(source='rfq.rfq_no', read_only=True, default='')
    vendor_name = serializers.CharField(source='vendor.vendor_name', read_only=True, default='')
    template_name = serializers.CharField(source='template.name', read_only=True, default='')
    sent_by_username = serializers.CharField(source='sent_by.username', read_only=True, default='')

    class Meta:
        model = EmailLog
        fields = [
            'id', 'rfq', 'rfq_number', 'template', 'template_name',
            'vendor', 'vendor_name', 'vendor_email',
            'subject', 'body_preview',
            'pdf_generated', 'email_sent', 'sent_at',
            'sent_by', 'sent_by_username',
            'error_message',
            'created_at',
        ]
        read_only_fields = fields


class SendEmailRequestSerializer(serializers.Serializer):
    """Serializer for the send-emails action."""

    rfq_id = serializers.UUIDField(help_text="RFQ Header ID")
    template_id = serializers.UUIDField(help_text="Email Template ID")
    vendor_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        help_text="List of vendor IDs to send emails to"
    )


class PreviewRequestSerializer(serializers.Serializer):
    """Serializer for preview actions."""

    rfq_id = serializers.UUIDField(help_text="RFQ Header ID")
    template_id = serializers.UUIDField(help_text="Email Template ID")
    vendor_id = serializers.UUIDField(help_text="Vendor ID")
