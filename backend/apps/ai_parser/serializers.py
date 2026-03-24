"""AI Parser Serializers for REST API"""
from rest_framework import serializers

from .models import ParserConfiguration, ParserLog


class ParserConfigurationSerializer(serializers.ModelSerializer):
    parser_type_display = serializers.CharField(source='get_parser_type_display', read_only=True)
    llm_provider_display = serializers.CharField(source='get_llm_provider_display', read_only=True)

    class Meta:
        model = ParserConfiguration
        fields = [
            'id', 'name', 'parser_type', 'parser_type_display', 'llm_provider', 'llm_provider_display',
            'llm_model', 'prompt_template', 'confidence_threshold', 'active', 'description'
        ]
        read_only_fields = ['id']


class ParserLogDetailSerializer(serializers.ModelSerializer):
    configuration_name = serializers.CharField(source='configuration.name', read_only=True)
    parser_type = serializers.CharField(source='configuration.parser_type', read_only=True)
    parser_type_display = serializers.CharField(source='configuration.get_parser_type_display', read_only=True)

    class Meta:
        model = ParserLog
        fields = [
            'id', 'configuration', 'configuration_name', 'parser_type', 'parser_type_display',
            'input_file', 'ocr_text', 'llm_response', 'confidence_score', 'parsed_successfully',
            'error_message', 'processing_time_ms', 'created_at'
        ]
        read_only_fields = ['id', 'ocr_text', 'llm_response', 'confidence_score', 'processing_time_ms']


class ParserLogListSerializer(serializers.ModelSerializer):
    configuration_name = serializers.CharField(source='configuration.name', read_only=True)
    parser_type = serializers.CharField(source='configuration.parser_type', read_only=True)
    status_badge = serializers.SerializerMethodField()

    class Meta:
        model = ParserLog
        fields = [
            'id', 'configuration', 'configuration_name', 'parser_type',
            'confidence_score', 'parsed_successfully', 'status_badge',
            'processing_time_ms', 'created_at'
        ]
        read_only_fields = ['id']

    def get_status_badge(self, obj):
        if obj.parsed_successfully:
            return 'success'
        return 'error'


class ParserResponseSerializer(serializers.Serializer):
    """Response from parsing operations"""
    success = serializers.BooleanField()
    confidence_score = serializers.DecimalField(max_digits=5, decimal_places=4)
    parsed_data = serializers.JSONField()
    error = serializers.CharField(required=False, allow_blank=True)
    processing_time_ms = serializers.IntegerField()
