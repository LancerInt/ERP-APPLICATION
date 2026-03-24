from django_filters import rest_framework as filters
from django.db.models import Q

from .models import (
    CustomerPOUpload,
    SalesOrder,
    DispatchChallan,
    SalesInvoiceCheck,
    FreightAdviceOutbound,
    ReceivableLedger,
)


class CustomerPOUploadFilter(filters.FilterSet):
    """Filters for PO uploads"""
    status_exact = filters.CharFilter(field_name='status', lookup_expr='exact')
    customer_name = filters.CharFilter(
        field_name='customer__name',
        lookup_expr='icontains'
    )
    upload_date_from = filters.DateTimeFilter(
        field_name='upload_date',
        lookup_expr='gte'
    )
    upload_date_to = filters.DateTimeFilter(
        field_name='upload_date',
        lookup_expr='lte'
    )

    class Meta:
        model = CustomerPOUpload
        fields = ['customer', 'status', 'manual_review_required']


class SalesOrderFilter(filters.FilterSet):
    """Filters for sales orders"""
    approval_status_exact = filters.CharFilter(
        field_name='approval_status',
        lookup_expr='exact'
    )
    so_date_from = filters.DateFilter(
        field_name='so_date',
        lookup_expr='gte'
    )
    so_date_to = filters.DateFilter(
        field_name='so_date',
        lookup_expr='lte'
    )
    customer_name = filters.CharFilter(
        field_name='customer__name',
        lookup_expr='icontains'
    )
    so_number = filters.CharFilter(
        field_name='so_no',
        lookup_expr='icontains'
    )

    class Meta:
        model = SalesOrder
        fields = ['customer', 'warehouse', 'company', 'approval_status']


class DispatchChallanFilter(filters.FilterSet):
    """Filters for dispatch challans"""
    status_exact = filters.CharFilter(field_name='status', lookup_expr='exact')
    dispatch_date_from = filters.DateTimeFilter(
        field_name='dispatch_date',
        lookup_expr='gte'
    )
    dispatch_date_to = filters.DateTimeFilter(
        field_name='dispatch_date',
        lookup_expr='lte'
    )
    dc_number = filters.CharFilter(
        field_name='dc_no',
        lookup_expr='icontains'
    )

    class Meta:
        model = DispatchChallan
        fields = ['warehouse', 'transporter', 'status']


class SalesInvoiceCheckFilter(filters.FilterSet):
    """Filters for invoice checks"""
    invoice_date_from = filters.DateFilter(
        field_name='invoice_date',
        lookup_expr='gte'
    )
    invoice_date_to = filters.DateFilter(
        field_name='invoice_date',
        lookup_expr='lte'
    )
    invoice_number = filters.CharFilter(
        field_name='invoice_number',
        lookup_expr='icontains'
    )
    variance_flag_exact = filters.CharFilter(
        field_name='variance_flag',
        lookup_expr='exact'
    )

    class Meta:
        model = SalesInvoiceCheck
        fields = ['variance_flag', 'dc_reference']


class FreightAdviceOutboundFilter(filters.FilterSet):
    """Filters for freight advices"""
    status_exact = filters.CharFilter(field_name='status', lookup_expr='exact')
    created_date_from = filters.DateTimeFilter(
        field_name='created_date',
        lookup_expr='gte'
    )
    created_date_to = filters.DateTimeFilter(
        field_name='created_date',
        lookup_expr='lte'
    )
    freight_type_exact = filters.CharFilter(
        field_name='freight_type',
        lookup_expr='exact'
    )

    class Meta:
        model = FreightAdviceOutbound
        fields = ['status', 'freight_type', 'transporter', 'dispatch_challan']


class ReceivableLedgerFilter(filters.FilterSet):
    """Filters for receivable ledger"""
    payment_status_exact = filters.CharFilter(
        field_name='payment_status',
        lookup_expr='exact'
    )
    due_date_from = filters.DateFilter(
        field_name='due_date',
        lookup_expr='gte'
    )
    due_date_to = filters.DateFilter(
        field_name='due_date',
        lookup_expr='lte'
    )
    customer_name = filters.CharFilter(
        field_name='customer__name',
        lookup_expr='icontains'
    )
    invoice_number = filters.CharFilter(
        field_name='invoice_reference__invoice_number',
        lookup_expr='icontains'
    )
    is_overdue = filters.BooleanFilter(method='filter_is_overdue')

    def filter_is_overdue(self, queryset, name, value):
        """Filter by overdue status"""
        from django.utils import timezone
        from django.db.models import Q

        if value:
            return queryset.filter(
                due_date__lt=timezone.now().date(),
                payment_status__in=['NOT_DUE', 'PARTIALLY_PAID']
            )
        return queryset

    class Meta:
        model = ReceivableLedger
        fields = ['customer', 'payment_status', 'escalation_flag']
