"""Celery Tasks for AI Parser - Async document processing"""
import logging
from celery import shared_task
from django.core.files.base import ContentFile
from decimal import Decimal

from .models import ParserConfiguration, ParserLog
from .services import ParserService, OCRService, LLMService
from .selectors import ParserSelector

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def async_parse_document(self, parser_log_id, parser_type):
    """
    Asynchronously parse a document.

    Args:
        parser_log_id: ID of ParserLog instance
        parser_type: Type of document (CUSTOMER_PO, INVOICE, BANK_STATEMENT)

    Returns:
        dict with parsing results
    """
    try:
        parser_log = ParserLog.objects.get(id=parser_log_id)
        config = parser_log.configuration

        # Get file path
        file_path = parser_log.input_file.path

        # Parse based on type
        if parser_type == 'CUSTOMER_PO':
            parsed_data, confidence, success, error_msg = ParserService.parse_customer_po(file_path, config)
        elif parser_type == 'INVOICE':
            parsed_data, confidence, success, error_msg = ParserService.parse_invoice(file_path, config)
        elif parser_type == 'BANK_STATEMENT':
            parsed_data, confidence, success, error_msg = ParserService.parse_bank_statement(file_path, config)
        else:
            raise ValueError(f"Unknown parser type: {parser_type}")

        # Update log with results
        parser_log.llm_response = parsed_data
        parser_log.confidence_score = confidence
        parser_log.parsed_successfully = success
        parser_log.error_message = error_msg
        parser_log.save()

        logger.info(
            f"Async parsing complete: {parser_type} "
            f"(confidence={confidence}, success={success})"
        )

        return {
            'success': success,
            'confidence': float(confidence),
            'error': error_msg,
            'log_id': parser_log_id
        }

    except ParserLog.DoesNotExist:
        logger.error(f"ParserLog {parser_log_id} not found")
        raise
    except Exception as exc:
        logger.error(f"Error in async parsing: {str(exc)}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task
def batch_parse_documents(parser_type, config_id=None):
    """
    Batch parse documents of a specific type.
    Useful for periodic reprocessing or bulk operations.

    Args:
        parser_type: Type of documents to parse
        config_id: Optional specific configuration ID

    Returns:
        dict with batch results
    """
    try:
        queryset = ParserLog.objects.filter(
            configuration__parser_type=parser_type,
            parsed_successfully=False
        )

        if config_id:
            queryset = queryset.filter(configuration_id=config_id)

        total = queryset.count()
        successful = 0
        failed = 0

        for parser_log in queryset[:100]:  # Limit to 100 at a time
            try:
                async_parse_document.delay(parser_log.id, parser_type)
                successful += 1
            except Exception as e:
                logger.error(f"Failed to queue parsing for {parser_log.id}: {str(e)}")
                failed += 1

        logger.info(
            f"Batch parse initiated: type={parser_type}, "
            f"total={total}, queued={successful}, errors={failed}"
        )

        return {
            'parser_type': parser_type,
            'total_documents': total,
            'queued': successful,
            'errors': failed
        }

    except Exception as e:
        logger.error(f"Error in batch parsing: {str(e)}")
        raise


@shared_task
def analyze_parser_performance(config_id=None):
    """
    Analyze parsing performance and identify issues.
    Can be run periodically to monitor parser health.

    Args:
        config_id: Optional specific configuration ID

    Returns:
        dict with analysis results
    """
    try:
        if config_id:
            configs = ParserConfiguration.objects.filter(id=config_id)
        else:
            configs = ParserConfiguration.objects.filter(active=True)

        analysis = {
            'timestamp': timezone.now().isoformat(),
            'configurations': []
        }

        for config in configs:
            stats = ParserSelector.get_parser_statistics(config)

            # Identify issues
            issues = []
            if stats['success_rate'] < 70:
                issues.append('LOW_SUCCESS_RATE')
            if stats['avg_confidence_score'] < 0.75:
                issues.append('LOW_CONFIDENCE')
            if stats['avg_processing_time_ms'] > 30000:
                issues.append('SLOW_PROCESSING')

            config_analysis = {
                'configuration_id': config.id,
                'configuration_name': config.name,
                'parser_type': config.parser_type,
                'statistics': stats,
                'issues': issues,
                'needs_attention': len(issues) > 0
            }

            analysis['configurations'].append(config_analysis)

        logger.info(f"Parser performance analysis complete: {len(configs)} configurations analyzed")
        return analysis

    except Exception as e:
        logger.error(f"Error in performance analysis: {str(e)}")
        raise


@shared_task
def cleanup_old_parser_logs(days=90):
    """
    Clean up old parser logs to manage storage.

    Args:
        days: Delete logs older than this many days

    Returns:
        dict with cleanup results
    """
    try:
        from django.utils import timezone
        from datetime import timedelta

        cutoff_date = timezone.now() - timedelta(days=days)

        old_logs = ParserLog.objects.filter(created_at__lt=cutoff_date)
        count = old_logs.count()

        # Delete files
        for log in old_logs:
            if log.input_file:
                log.input_file.delete()

        # Delete records
        old_logs.delete()

        logger.info(f"Cleaned up {count} parser logs older than {days} days")

        return {
            'deleted_logs': count,
            'cutoff_date': cutoff_date.isoformat()
        }

    except Exception as e:
        logger.error(f"Error in cleanup: {str(e)}")
        raise


@shared_task
def retrain_parser_prompt(config_id):
    """
    Analyze low-confidence parses and suggest prompt improvements.
    Integration point for ML training pipeline.

    Args:
        config_id: Configuration ID to analyze

    Returns:
        dict with improvement suggestions
    """
    try:
        config = ParserConfiguration.objects.get(id=config_id)
        low_confidence_logs = ParserSelector.get_low_confidence_parses(threshold=0.7)

        suggestions = {
            'configuration_id': config_id,
            'configuration_name': config.name,
            'low_confidence_samples': low_confidence_logs.count(),
            'suggested_improvements': []
        }

        # Analyze patterns in low-confidence parses
        for log in low_confidence_logs[:10]:
            # This would integrate with ML analysis
            suggestion = {
                'log_id': log.id,
                'confidence': float(log.confidence_score),
                'error': log.error_message,
                'recommendation': 'Review prompt template or model'
            }
            suggestions['suggested_improvements'].append(suggestion)

        logger.info(f"Parser retraining analysis for {config.name}: {suggestions}")

        return suggestions

    except ParserConfiguration.DoesNotExist:
        logger.error(f"Configuration {config_id} not found")
        raise
    except Exception as e:
        logger.error(f"Error in retraining analysis: {str(e)}")
        raise
