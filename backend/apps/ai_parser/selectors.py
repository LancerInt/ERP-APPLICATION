"""AI Parser Query Selectors - Read-only data access layer"""
from django.db.models import Q, Count, Avg
from django.utils import timezone
from datetime import timedelta

from .models import ParserConfiguration, ParserLog


class ParserSelector:
    """Parser configuration and log queries"""

    @staticmethod
    def get_active_parsers():
        """Get all active parser configurations"""
        return ParserConfiguration.objects.filter(active=True).order_by('parser_type')

    @staticmethod
    def get_parser_by_type(parser_type):
        """Get parser for specific document type"""
        return ParserConfiguration.objects.filter(
            parser_type=parser_type,
            active=True
        ).first()

    @staticmethod
    def get_parsers_by_provider(llm_provider):
        """Get parsers using specific LLM provider"""
        return ParserConfiguration.objects.filter(
            llm_provider=llm_provider,
            active=True
        )

    @staticmethod
    def get_parser_logs(configuration=None, days=30):
        """Get parser logs"""
        start_date = timezone.now() - timedelta(days=days)
        queryset = ParserLog.objects.filter(created_at__gte=start_date)

        if configuration:
            queryset = queryset.filter(configuration=configuration)

        return queryset.select_related('configuration').order_by('-created_at')

    @staticmethod
    def get_successful_parses(configuration=None, days=30):
        """Get successful parsing logs"""
        start_date = timezone.now() - timedelta(days=days)
        queryset = ParserLog.objects.filter(
            created_at__gte=start_date,
            parsed_successfully=True
        )

        if configuration:
            queryset = queryset.filter(configuration=configuration)

        return queryset.select_related('configuration').order_by('-created_at')

    @staticmethod
    def get_failed_parses(configuration=None, days=30):
        """Get failed parsing logs"""
        start_date = timezone.now() - timedelta(days=days)
        queryset = ParserLog.objects.filter(
            created_at__gte=start_date,
            parsed_successfully=False
        )

        if configuration:
            queryset = queryset.filter(configuration=configuration)

        return queryset.select_related('configuration').order_by('-created_at')

    @staticmethod
    def get_parser_statistics(configuration=None):
        """Get parsing statistics"""
        queryset = ParserLog.objects.all()

        if configuration:
            queryset = queryset.filter(configuration=configuration)

        total = queryset.count()
        successful = queryset.filter(parsed_successfully=True).count()
        failed = queryset.filter(parsed_successfully=False).count()
        avg_confidence = queryset.aggregate(Avg('confidence_score'))['confidence_score__avg'] or 0
        avg_processing_time = queryset.aggregate(Avg('processing_time_ms'))['processing_time_ms__avg'] or 0

        return {
            'total_parses': total,
            'successful_parses': successful,
            'failed_parses': failed,
            'success_rate': (successful / total * 100) if total > 0 else 0,
            'avg_confidence_score': float(avg_confidence),
            'avg_processing_time_ms': avg_processing_time,
        }

    @staticmethod
    def get_low_confidence_parses(threshold=0.7, days=30):
        """Get parses with low confidence scores"""
        start_date = timezone.now() - timedelta(days=days)
        return ParserLog.objects.filter(
            created_at__gte=start_date,
            confidence_score__lt=threshold
        ).select_related('configuration').order_by('confidence_score')

    @staticmethod
    def get_parser_performance_by_model(llm_model, days=30):
        """Get performance stats by LLM model"""
        start_date = timezone.now() - timedelta(days=days)
        configs = ParserConfiguration.objects.filter(llm_model=llm_model)

        logs = ParserLog.objects.filter(
            configuration__in=configs,
            created_at__gte=start_date
        )

        total = logs.count()
        successful = logs.filter(parsed_successfully=True).count()
        avg_confidence = logs.aggregate(Avg('confidence_score'))['confidence_score__avg'] or 0
        avg_time = logs.aggregate(Avg('processing_time_ms'))['processing_time_ms__avg'] or 0

        return {
            'model': llm_model,
            'total_parses': total,
            'success_rate': (successful / total * 100) if total > 0 else 0,
            'avg_confidence': float(avg_confidence),
            'avg_processing_time_ms': avg_time,
        }

    @staticmethod
    def search_parser_logs(query, configuration=None):
        """Search parser logs"""
        queryset = ParserLog.objects.filter(
            Q(error_message__icontains=query) |
            Q(configuration__name__icontains=query)
        )

        if configuration:
            queryset = queryset.filter(configuration=configuration)

        return queryset.select_related('configuration').order_by('-created_at')

    @staticmethod
    def get_parsers_needing_training():
        """Get parsers with low success rate that need tuning"""
        parsers_with_stats = []

        for config in ParserConfiguration.objects.filter(active=True):
            stats = ParserSelector.get_parser_statistics(config)
            if stats['success_rate'] < 80 and stats['total_parses'] > 10:
                parsers_with_stats.append({
                    'configuration': config,
                    'stats': stats
                })

        return parsers_with_stats
