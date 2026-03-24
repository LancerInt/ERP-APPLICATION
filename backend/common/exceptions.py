from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework import status
from django.utils.translation import gettext_lazy as _
from django.db import IntegrityError
import logging
import re

logger = logging.getLogger(__name__)


class WorkflowError(APIException):
    """Exception raised for workflow-related errors."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _('Workflow operation failed.')
    default_code = 'workflow_error'


class StockError(APIException):
    """Exception raised for inventory/stock-related errors."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _('Insufficient stock available.')
    default_code = 'stock_error'


class ValidationError(APIException):
    """Exception raised for validation errors."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _('Validation failed.')
    default_code = 'validation_error'


class ApprovalError(APIException):
    """Exception raised for approval workflow errors."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _('Approval operation not permitted.')
    default_code = 'approval_error'


class DocumentNotFoundError(APIException):
    """Exception raised when document is not found."""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = _('Document not found.')
    default_code = 'document_not_found'


class DuplicateError(APIException):
    """Exception raised for duplicate entries."""
    status_code = status.HTTP_409_CONFLICT
    default_detail = _('Record already exists.')
    default_code = 'duplicate_error'


class InsufficientPermissionError(APIException):
    """Exception raised for permission errors."""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = _('Insufficient permissions.')
    default_code = 'insufficient_permission'


class OperationNotAllowedError(APIException):
    """Exception raised when operation is not allowed."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _('Operation not allowed in current state.')
    default_code = 'operation_not_allowed'


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.
    Logs exceptions and formats response.
    """
    response = exception_handler(exc, context)

    if response is None:
        # Handle IntegrityError (duplicate keys, constraint violations)
        if isinstance(exc, IntegrityError):
            error_msg = str(exc)
            logger.warning(f"IntegrityError: {error_msg}")
            # Extract meaningful field name from UNIQUE constraint error
            match = re.search(r'UNIQUE constraint failed: \w+\.(\w+)', error_msg)
            if match:
                field = match.group(1)
                return Response(
                    {field: [f'A record with this {field.replace("_", " ")} already exists.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # NOT NULL constraint — show which field is missing
            match_null = re.search(r'NOT NULL constraint failed: \w+\.(\w+)', error_msg)
            if match_null:
                field = match_null.group(1)
                return Response(
                    {field: [f'This field is required.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'error': f'Database constraint error: {error_msg[:200]}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.error(
            f"Unhandled exception: {exc}",
            extra={
                'request': context.get('request'),
                'view': context.get('view'),
            },
            exc_info=True
        )
        return None

    # Log exceptions at appropriate levels
    if response.status_code >= 500:
        logger.error(
            f"Server error: {exc}",
            extra={
                'request': context.get('request'),
                'view': context.get('view'),
            },
            exc_info=True
        )
    elif response.status_code >= 400:
        logger.warning(
            f"Client error: {exc}",
            extra={
                'request': context.get('request'),
                'view': context.get('view'),
            }
        )

    # Format response — preserve field-level validation errors for 400s
    if response.status_code == 400:
        # DRF validation errors come as {"field": ["error"]} — keep them as-is
        # so frontend can display per-field messages
        if isinstance(response.data, dict) and 'detail' not in response.data:
            # Already field-level errors — pass through
            return response
        # Single error with 'detail' key
        if isinstance(response.data, dict) and 'detail' in response.data:
            response.data = {
                'error': str(response.data['detail']),
                'status_code': response.status_code,
            }
            return response

    # Non-400 errors — format as message
    response.data = {
        'error': response.data.get('detail', str(exc)) if hasattr(response.data, 'get') else str(response.data),
        'status_code': response.status_code,
    }

    return response
