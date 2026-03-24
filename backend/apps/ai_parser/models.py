"""AI Parser Models - Document parsing and OCR"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from common.models import BaseModel


class ParserConfiguration(BaseModel):
    """Parser configuration for different document types"""

    PARSER_TYPE_CHOICES = [
        ('CUSTOMER_PO', 'Customer Purchase Order'),
        ('BANK_STATEMENT', 'Bank Statement'),
        ('INVOICE', 'Invoice'),
    ]

    LLM_PROVIDER_CHOICES = [
        ('OLLAMA', 'Ollama'),
        ('GEMINI', 'Google Gemini'),
        ('OPENAI', 'OpenAI'),
        ('ANTHROPIC', 'Anthropic Claude'),
    ]

    name = models.CharField(max_length=100, unique=True, db_index=True)
    parser_type = models.CharField(max_length=50, choices=PARSER_TYPE_CHOICES)
    llm_provider = models.CharField(max_length=50, choices=LLM_PROVIDER_CHOICES)
    llm_model = models.CharField(max_length=100, help_text="e.g., 'mistral:latest', 'gemini-1.5-pro'")
    prompt_template = models.TextField()
    confidence_threshold = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.8,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Minimum confidence score (0-1) to accept parsing result"
    )
    active = models.BooleanField(default=True, db_index=True)
    description = models.TextField(blank=True)

    class Meta:
        app_label = 'ai_parser'
        ordering = ['parser_type', 'name']

    def __str__(self):
        return f"{self.name} ({self.parser_type})"


class ParserLog(BaseModel):
    """Parsing operation logs and results"""

    configuration = models.ForeignKey(ParserConfiguration, on_delete=models.PROTECT, related_name='logs')
    input_file = models.FileField(upload_to='parser/inputs/')
    ocr_text = models.TextField(help_text="Raw OCR output")
    llm_response = models.JSONField(help_text="Structured LLM output")
    confidence_score = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )
    parsed_successfully = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    processing_time_ms = models.IntegerField(validators=[MinValueValidator(0)])

    class Meta:
        app_label = 'ai_parser'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['configuration', 'created_at']),
            models.Index(fields=['parsed_successfully', 'created_at']),
        ]

    def __str__(self):
        return f"{self.configuration.name} - {self.created_at}"

    @property
    def success_rate(self):
        """Calculate success rate for this configuration"""
        total = ParserLog.objects.filter(configuration=self.configuration).count()
        successful = ParserLog.objects.filter(
            configuration=self.configuration,
            parsed_successfully=True
        ).count()
        return (successful / total * 100) if total > 0 else 0
