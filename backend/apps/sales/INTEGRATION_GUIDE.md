# Sales App Integration Guide

## Installation

### 1. Add to Django Settings

```python
# settings.py

INSTALLED_APPS = [
    # ... other apps
    'apps.sales',
    'rest_framework',
    'django_filters',
    'corsheaders',
]

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'apps.sales.pagination.StandardPagination',
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}
```

### 2. Include URLs

```python
# urls.py (project)

from django.urls import path, include

urlpatterns = [
    # ... other patterns
    path('api/sales/', include('apps.sales.urls')),
]
```

### 3. Run Migrations

```bash
python manage.py makemigrations sales
python manage.py migrate sales
```

### 4. Configure Celery Tasks

```python
# celery.py or settings.py

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'auto-overdue-reminder': {
        'task': 'apps.sales.tasks.auto_overdue_reminder',
        'schedule': crontab(hour=9, minute=0),  # Daily 9 AM
    },
    'daily-sales-reconciliation': {
        'task': 'apps.sales.tasks.daily_sales_reconciliation_report',
        'schedule': crontab(hour=18, minute=0),  # Daily 6 PM
    },
    'cleanup-po-uploads': {
        'task': 'apps.sales.tasks.cleanup_expired_po_uploads',
        'schedule': crontab(day_of_month=1, hour=3),  # Monthly
    },
    'calculate-freight-allocations': {
        'task': 'apps.sales.tasks.calculate_freight_allocations',
        'schedule': crontab(hour='*/6'),  # Every 6 hours
    },
}
```

### 5. Configure AI Parser

```python
# settings.py

# AWS Textract example
import boto3

class AWSTextractParser:
    @staticmethod
    def parse_document(file_obj):
        client = boto3.client('textract')
        # Implementation for parsing
        pass

AI_PARSER_SERVICE = AWSTextractParser()

# Or use any other AI service (Google Vision, OpenAI, etc.)
```

## Database Dependencies

The app requires these models from other apps:

```python
# In models.py imports:
from master.models import (
    Customer,
    Product,
    PriceList,
    Transporter,
    ShippingAddress,
)
from core.models import (
    Company,
    Warehouse,
    StakeholderUser,
)
```

Ensure these apps are installed:
- `apps.master` - Product/customer master data
- `apps.core` - Company/warehouse configuration
- `apps.inventory` - Stock management (for dispatch validation)

## API Usage Examples

### 1. Upload Customer PO

```bash
curl -X POST http://localhost:8000/api/sales/po-uploads/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "customer=1" \
  -F "po_file=@invoice.pdf"
```

Response:
```json
{
  "id": "uuid",
  "upload_id": "PO-20240321-001",
  "customer": 1,
  "status": "UPLOADED",
  "upload_date": "2024-03-21T10:30:00Z"
}
```

### 2. Trigger PO Parsing

```bash
curl -X POST http://localhost:8000/api/sales/po-uploads/uuid/trigger_parsing/ \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "detail": "Parsing queued successfully"
}
```

Check parsing status after ~30 seconds:
```bash
curl -X GET http://localhost:8000/api/sales/po-uploads/uuid/ \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Create Sales Order from Parsed PO

```bash
curl -X POST http://localhost:8000/api/sales/po-uploads/uuid/convert_to_sales_order/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company": 1,
    "warehouse": 1,
    "price_list": 1,
    "credit_terms": "Net 30",
    "freight_terms": "FOB Destination",
    "required_ship_date": "2024-04-01"
  }'
```

Response:
```json
{
  "detail": "Sales order created",
  "sales_order_id": "uuid",
  "sales_order_no": "SO-20240321-0001"
}
```

### 4. List and Approve Sales Orders

```bash
# List pending SOs
curl -X GET 'http://localhost:8000/api/sales/sales-orders/?approval_status=DRAFT' \
  -H "Authorization: Bearer $TOKEN"

# Approve SO
curl -X POST http://localhost:8000/api/sales/sales-orders/uuid/approve/ \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Create Dispatch Challan

```bash
curl -X POST http://localhost:8000/api/sales/dispatch-challans/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse": 1,
    "linked_so_lines": [1, 2, 3],
    "transporter": 1,
    "freight_rate_type": "FLAT",
    "freight_rate_value": "5000.00",
    "lorry_no": "KA-01-AB-1234",
    "driver_contact": "+91-9876543210"
  }'
```

### 6. Process Invoice

```bash
curl -X POST http://localhost:8000/api/sales/invoice-checks/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "dc_reference=1" \
  -F "statutory_invoice_upload=@invoice.pdf" \
  -F "invoice_number=INV-2024-001" \
  -F "invoice_date=2024-03-21" \
  -F "total_value_upload=150000"

# Accept invoice
curl -X POST http://localhost:8000/api/sales/invoice-checks/uuid/accept_invoice/ \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Get Receivables Summary

```bash
# Get overdue receivables
curl -X GET http://localhost:8000/api/sales/receivables/overdue/ \
  -H "Authorization: Bearer $TOKEN"

# Get aging summary
curl -X GET http://localhost:8000/api/sales/receivables/aging_summary/ \
  -H "Authorization: Bearer $TOKEN"

# Record payment
curl -X POST http://localhost:8000/api/sales/receivables/uuid/record_payment/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": "50000.00"}'
```

### 8. Get Reconciliation Trail

```bash
# Full SO to payment trail
curl -X GET 'http://localhost:8000/api/sales/reconciliation/sales_order_trail/?so_id=1' \
  -H "Authorization: Bearer $TOKEN"

# Invoice-receivable matching
curl -X GET 'http://localhost:8000/api/sales/reconciliation/invoice_matching/?invoice_check_id=1' \
  -H "Authorization: Bearer $TOKEN"
```

## Python Client Examples

### Using Django ORM

```python
from apps.sales.models import SalesOrder, ReceivableLedger
from apps.sales.services import SalesOrderService, ReceivableService
from apps.sales.selectors import SalesOrderSelector, ReceivableSelector

# Get pending SOs for warehouse
pending_sos = SalesOrderSelector.get_pending_sos_for_warehouse(warehouse_id=1)
for so in pending_sos:
    print(f"{so.so_no}: {so.customer.name} - ₹{so.get_total_amount()}")

# Approve SO
user = request.user.stakeholderuser
SalesOrderService.approve_sales_order(sales_order, user)

# Get overdue receivables with aging
overdue = ReceivableSelector.get_overdue_receivables(days_overdue=30)
aging = ReceivableSelector.get_aging_summary()

for bucket in aging:
    print(f"{bucket['customer__name']}: Current: ₹{bucket['current']}, "
          f"30 days: ₹{bucket['overdue_30']}, "
          f"60 days: ₹{bucket['overdue_60']}, "
          f"90+ days: ₹{bucket['overdue_90']}")

# Record payment
from decimal import Decimal
ReceivableService.record_payment_received(
    receivable=receivable_ledger,
    amount=Decimal('50000.00')
)
```

### Using Services Directly

```python
from apps.sales.services import (
    DispatchService,
    InvoiceService,
    FreightService,
)

# Create dispatch challan with validation
dc = DispatchService.create_dispatch_challan(
    so_lines=so.so_lines.all(),
    warehouse_id=1,
    transporter_id=1,
    freight_rate_type='FLAT',
    freight_rate_value=Decimal('5000.00'),
)

# Process invoice with variance detection
invoice_check = InvoiceService.process_invoice_check(
    dc=dc,
    invoice_file=file_obj,
    invoice_number='INV-2024-001',
    invoice_date=timezone.now().date(),
    total_value_upload=Decimal('150000.00'),
)

# Accept invoice (triggers inventory deduction & A/R creation)
InvoiceService.accept_invoice(invoice_check, accepted_by=user)

# Create freight advice
freight = FreightService.create_outbound_freight_advice(
    dc=dc,
    transporter_id=1,
    freight_type='LINEHAUL',
    base_amount=Decimal('10000.00'),
    loading_wages=Decimal('2000.00'),
    unloading_wages=Decimal('2000.00'),
)
```

## Admin Interface

### Access Admin

1. Navigate to: `http://localhost:8000/admin/`
2. Go to "Sales" section
3. Available models:
   - Customer PO Uploads
   - Parsed Lines
   - Sales Orders
   - SO Lines
   - Dispatch Challans
   - DC Lines
   - Delivery Locations
   - Sales Invoice Checks
   - Freight Advice Outbound
   - Outbound Payment Schedules
   - Receivable Ledger
   - Reminder Dates

### Quick Actions
- Trigger PO parsing
- Approve/reject SOs
- Release/deliver DCs
- Accept invoices
- Record payments
- Create reminders

## Testing

### Unit Tests

```bash
# Run all sales tests
python manage.py test apps.sales

# Run specific test
python manage.py test apps.sales.tests.SalesOrderServiceTest

# With coverage
coverage run --source='apps.sales' manage.py test apps.sales
coverage report
```

### Manual Testing Checklist

```
[ ] Upload PO file
[ ] Check parsing completes
[ ] Convert parsed PO to SO
[ ] Approve SO
[ ] Create dispatch challan
[ ] Release challan
[ ] Mark delivered
[ ] Upload invoice
[ ] Accept invoice
[ ] Check receivable created
[ ] Record payment
[ ] Verify balance updated
[ ] Check overdue escalation
[ ] Verify reminder created
[ ] Get reconciliation trail
```

## Monitoring & Logging

### Log Configuration

```python
# settings.py

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'logs/sales.log',
        },
    },
    'loggers': {
        'apps.sales': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
    },
}
```

### Key Metrics to Monitor

- PO parsing success rate
- SO approval turnaround time
- Invoice variance percentage
- Payment collection rate
- Days sales outstanding (DSO)
- Overdue aging trend
- Dispatch on-time percentage

## Troubleshooting

### Issue: PO Parsing Fails

**Solution:**
1. Check AI service configuration
2. Verify file format is supported
3. Review logs for AI service errors
4. Check manual_review_required flag
5. Use review_comments to identify issue

### Issue: Invoice Variance High

**Solution:**
1. Verify SO line items and prices
2. Check currency conversion if multi-currency
3. Review discount/tax calculations
4. Increase INVOICE_VARIANCE_TOLERANCE if acceptable
5. Flag for manual review

### Issue: Overdue Reminders Not Sending

**Solution:**
1. Verify Celery worker is running
2. Check email configuration
3. Review task logs: `celery -A project logs`
4. Verify customer email addresses are valid
5. Check OVERDUE_EMAIL_TEMPLATE exists

### Issue: Stock Validation Failing

**Solution:**
1. Check inventory ledger integration
2. Verify warehouse stock levels
3. Check quantity units match
4. Review reserved quantity calculations

## Production Deployment

### Pre-Deployment Checklist

- [ ] Run all tests (`python manage.py test apps.sales`)
- [ ] Check code quality (`pylint apps/sales`)
- [ ] Review logs for errors
- [ ] Backup database
- [ ] Test Celery tasks
- [ ] Verify email configuration
- [ ] Test AI parser integration
- [ ] Load test API endpoints
- [ ] Review security permissions
- [ ] Set up monitoring/alerting

### Initial Data Setup

```python
# Create required masters
from apps.master.models import Customer, Product, PriceList
from apps.core.models import Company, Warehouse

# Create default company
company = Company.objects.create(name='Main Company')

# Create warehouses
warehouse = Warehouse.objects.create(
    company=company,
    name='Main Warehouse'
)

# Create customers, products, price lists
# ...
```

## Performance Tuning

### Database Optimization

```python
# Create indexes
from django.db import models

class SalesOrder(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['customer', '-so_date']),
            models.Index(fields=['approval_status']),
        ]
```

### Query Optimization

```python
# Use select_related/prefetch_related
sales_orders = (
    SalesOrder.objects
    .select_related('customer', 'warehouse')
    .prefetch_related('so_lines__product')
    .filter(is_active=True)
)
```

### Caching

```python
from django.views.decorators.cache import cache_page

@cache_page(60 * 5)  # Cache for 5 minutes
def get_aging_summary(request):
    # ...
```

## Support & Documentation

- Architecture: See `ARCHITECTURE.md`
- API Documentation: Access via DRF Browsable API
- Code Examples: See integration examples above
- Issues: Check logs and use Django debug toolbar

## License

See project LICENSE file.
