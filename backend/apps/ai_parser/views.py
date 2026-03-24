"""AI Parser API Views"""
import time
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import ParserConfiguration, ParserLog
from .serializers import ParserConfigurationSerializer, ParserLogDetailSerializer, ParserLogListSerializer, ParserResponseSerializer
from .services import ParserService, OCRService, LLMService
from .selectors import ParserSelector


class ParserConfigurationViewSet(viewsets.ModelViewSet):
    """Parser configuration management"""
    queryset = ParserConfiguration.objects.all()
    serializer_class = ParserConfigurationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = ParserConfiguration.objects.all()

        active = self.request.query_params.get('active')
        parser_type = self.request.query_params.get('parser_type')
        provider = self.request.query_params.get('provider')

        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')
        if parser_type:
            queryset = queryset.filter(parser_type=parser_type)
        if provider:
            queryset = queryset.filter(llm_provider=provider)

        return queryset.order_by('parser_type', 'name')

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get parser for document type"""
        parser_type = request.query_params.get('type')
        if not parser_type:
            return Response({'error': 'type required'}, status=status.HTTP_400_BAD_REQUEST)

        parser = ParserSelector.get_parser_by_type(parser_type)
        if not parser:
            return Response({'error': f'No parser found for type {parser_type}'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(parser)
        return Response(serializer.data)


class ParserLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Parser log and results"""
    queryset = ParserLog.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ParserLogDetailSerializer
        return ParserLogListSerializer

    def get_queryset(self):
        queryset = ParserLog.objects.select_related('configuration').order_by('-created_at')

        config_id = self.request.query_params.get('config_id')
        status_filter = self.request.query_params.get('status')

        if config_id:
            queryset = queryset.filter(configuration_id=config_id)
        if status_filter:
            if status_filter == 'success':
                queryset = queryset.filter(parsed_successfully=True)
            elif status_filter == 'error':
                queryset = queryset.filter(parsed_successfully=False)

        return queryset

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get parser statistics"""
        config_id = request.query_params.get('config_id')
        config = None

        if config_id:
            try:
                config = ParserConfiguration.objects.get(id=config_id)
            except ParserConfiguration.DoesNotExist:
                return Response({'error': 'Configuration not found'}, status=status.HTTP_404_NOT_FOUND)

        stats = ParserSelector.get_parser_statistics(config)
        return Response(stats)

    @action(detail=False, methods=['get'])
    def low_confidence(self, request):
        """Get low confidence parses"""
        threshold = float(request.query_params.get('threshold', 0.7))
        logs = ParserSelector.get_low_confidence_parses(threshold)
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


class DocumentParserViewSet(viewsets.ViewSet):
    """Document parsing endpoints"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def parse_po(self, request):
        """Parse customer purchase order"""
        try:
            config_id = request.data.get('config_id')
            if not config_id:
                config = ParserSelector.get_parser_by_type('CUSTOMER_PO')
                if not config:
                    return Response({'error': 'No PO parser configured'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                config = ParserConfiguration.objects.get(id=config_id)

            if 'file' not in request.FILES:
                return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)

            file = request.FILES['file']
            # Save temp file
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=file.name) as tmp:
                for chunk in file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            start_time = time.time()

            # Parse
            parsed_data, confidence, success, error_msg = ParserService.parse_customer_po(tmp_path, config)
            processing_time = int((time.time() - start_time) * 1000)

            # Log result
            ParserLog.objects.create(
                configuration=config,
                input_file=file,
                ocr_text="",  # Would be populated from OCR
                llm_response=parsed_data,
                confidence_score=confidence,
                parsed_successfully=success,
                error_message=error_msg,
                processing_time_ms=processing_time
            )

            # Cleanup
            import os
            os.unlink(tmp_path)

            result = {
                'success': success,
                'confidence_score': float(confidence),
                'parsed_data': parsed_data,
                'error': error_msg,
                'processing_time_ms': processing_time
            }

            serializer = ParserResponseSerializer(result)
            return Response(serializer.data)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def parse_invoice(self, request):
        """Parse invoice"""
        try:
            config_id = request.data.get('config_id')
            if not config_id:
                config = ParserSelector.get_parser_by_type('INVOICE')
                if not config:
                    return Response({'error': 'No invoice parser configured'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                config = ParserConfiguration.objects.get(id=config_id)

            if 'file' not in request.FILES:
                return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)

            file = request.FILES['file']
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=file.name) as tmp:
                for chunk in file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            start_time = time.time()

            parsed_data, confidence, success, error_msg = ParserService.parse_invoice(tmp_path, config)
            processing_time = int((time.time() - start_time) * 1000)

            ParserLog.objects.create(
                configuration=config,
                input_file=file,
                ocr_text="",
                llm_response=parsed_data,
                confidence_score=confidence,
                parsed_successfully=success,
                error_message=error_msg,
                processing_time_ms=processing_time
            )

            import os
            os.unlink(tmp_path)

            result = {
                'success': success,
                'confidence_score': float(confidence),
                'parsed_data': parsed_data,
                'error': error_msg,
                'processing_time_ms': processing_time
            }

            serializer = ParserResponseSerializer(result)
            return Response(serializer.data)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def parse_statement(self, request):
        """Parse bank statement"""
        try:
            config_id = request.data.get('config_id')
            if not config_id:
                config = ParserSelector.get_parser_by_type('BANK_STATEMENT')
                if not config:
                    return Response({'error': 'No bank statement parser configured'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                config = ParserConfiguration.objects.get(id=config_id)

            if 'file' not in request.FILES:
                return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)

            file = request.FILES['file']
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=file.name) as tmp:
                for chunk in file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            start_time = time.time()

            parsed_data, confidence, success, error_msg = ParserService.parse_bank_statement(tmp_path, config)
            processing_time = int((time.time() - start_time) * 1000)

            ParserLog.objects.create(
                configuration=config,
                input_file=file,
                ocr_text="",
                llm_response=parsed_data,
                confidence_score=confidence,
                parsed_successfully=success,
                error_message=error_msg,
                processing_time_ms=processing_time
            )

            import os
            os.unlink(tmp_path)

            result = {
                'success': success,
                'confidence_score': float(confidence),
                'parsed_data': parsed_data,
                'error': error_msg,
                'processing_time_ms': processing_time
            }

            serializer = ParserResponseSerializer(result)
            return Response(serializer.data)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
