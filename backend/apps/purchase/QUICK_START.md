# Purchase App Quick Start Guide

## Installation

1. **Add to Django INSTALLED_APPS:**
```python
INSTALLED_APPS = [
    ...
    'purchase',
]
```

2. **Include URLs:**
```python
# urls.py
from django.urls import path, include

urlpatterns = [
    ...
    path('api/purchase/', include('purchase.urls')),
]
```

3. **Run Migrations:**
```bash
python manage.py makemigrations purchase
python manage.py migrate purchase
```

4. **Configure Celery Tasks** (in celery.py):
```python
from celery.schedules import crontab

app.conf.beat_schedule = {
    'check-po-overdue': {
        'task': 'purchase.tasks.check_po_overdue',
        'schedule': crontab(hour=9, minute=0),  # Daily at 9 AM
    },
    'auto-reminder-freight': {
        'task': 'purchase.tasks.auto_reminder_freight',
        'schedule': crontab(hour=8, minute=0),  # Daily at 8 AM
    },
    'check-pending-qc': {
        'task': 'purchase.tasks.check_pending_qc_receipts',
        'schedule': crontab(hour=10, minute=0),  # Daily at 10 AM
    },
    'payment-due-notifications': {
        'task': 'purchase.tasks.process_payment_due_notifications',
        'schedule': crontab(hour=7, minute=0),  # Daily at 7 AM
    },
}
```

## Common Usage Patterns

### 1. Create a Purchase Request
```python
from purchase.services import PurchaseRequestService
from core.models import Warehouse, StakeholderUser

warehouse = Warehouse.objects.get(code='WH001')
user = StakeholderUser.objects.get(user__username='buyer1')

pr = PurchaseRequestService.create_purchase_request(
    warehouse=warehouse,
    requested_by=user,
    requirement_type='GOODS',
    priority='HIGH',
    justification='Stock replenishment'
)

# Add lines
lines_data = [
    {
        'product_service': Product.objects.get(code='SKU001'),
        'quantity_requested': Decimal('100.00'),
        'uom': 'PCS',
    }
]

PurchaseRequestService.add_pr_lines(pr, lines_data)
```

### 2. Approve a Purchase Request
```python
from purchase.services import PurchaseRequestService

# Full approval
PurchaseRequestService.approve_purchase_request(
    purchase_request=pr,
    actor=approver_user,
    remarks='Approved - urgent need'
)

# Partial approval
PurchaseRequestService.approve_purchase_request(
    purchase_request=pr,
    actor=approver_user,
    partial=True,
    approved_line_quantities={
        'line-uuid-1': Decimal('50.00'),  # Approve only 50 of 100
    },
    remarks='Partial approval - budget constraints'
)
```

### 3. Generate RFQ from Approved PR
```python
from purchase.services import RFQService

prs = [pr]  # List of approved PurchaseRequests
rfq = RFQService.generate_rfq_from_pr(
    purchase_requests=prs,
    created_by=procurement_user,
    rfq_mode='EMAIL',
    quote_count_expected=3
)

# Send RFQ via email
from purchase.tasks import send_rfq_email
send_rfq_email.delay(rfq.id, vendor_emails=['vendor1@email.com'])
```

### 4. Create Quote Response
```python
from purchase.services import RFQService
from master.models import Vendor

vendor = Vendor.objects.get(code='VENDOR001')

quote = RFQService.create_quote_response(
    rfq=rfq,
    vendor=vendor,
    price_valid_till=date(2026, 4, 21),
    lead_time_days=7,
    quote_lines_data=[
        {
            'pr_line': pr_line,
            'product_service': product,
            'quantity_offered': Decimal('100.00'),
            'unit_price': Decimal('150.00'),
            'gst': Decimal('5.00'),
        }
    ]
)
```

### 5. Evaluate Quotes
```python
from purchase.services import QuoteEvaluationService

evaluation = QuoteEvaluationService.evaluate_quotes(
    rfq=rfq,
    evaluated_by=evaluator_user,
    comparison_data=[
        {
            'vendor': vendor1,
            'total_cost': Decimal('15000.00'),
            'lead_time': 7,
            'score': Decimal('85.00'),
            'remarks': 'Good quality, reliable vendor'
        },
        {
            'vendor': vendor2,
            'total_cost': Decimal('14500.00'),
            'lead_time': 10,
            'score': Decimal('78.00'),
            'remarks': 'Cheaper but longer lead time'
        }
    ]
)

# Approve evaluation
QuoteEvaluationService.approve_evaluation(
    evaluation=evaluation,
    actor=approval_user,
    remarks='Approved - vendor1 selected'
)
```

### 6. Create Purchase Order from Evaluation
```python
from purchase.services import PurchaseOrderService
from master.models import Company

company = Company.objects.get(code='COMP001')

po = PurchaseOrderService.create_po_from_evaluation(
    evaluation=evaluation,
    company=company,
    warehouse=warehouse,
    created_by=po_creator,
    payment_terms='Net 30',
    freight_terms='FOB'
)

# Approve PO
po = PurchaseOrderService.approve_po(po, approval_user)

# Issue PO (send to vendor)
po = PurchaseOrderService.issue_po(po, issuer_user)
```

### 7. Create Receipt Advice (GRN)
```python
from purchase.services import ReceiptService
from core.models import Godown

godown = Godown.objects.get(code='GD001')

receipt = ReceiptService.create_receipt_advice(
    purchase_order=po,
    warehouse=warehouse,
    godown=godown,
    vendor=vendor,
    vehicle_number='KA-01-AB-1234',
    driver_name='John Doe',
    qc_routing='QC_MANAGER'
)

# Add receipt lines
receipt_lines = ReceiptService.add_receipt_lines(
    receipt=receipt,
    receipt_lines_data=[
        {
            'po_line': po_line,
            'product': product,
            'quantity_received': Decimal('100.00'),
            'batch_no': 'BATCH-001',
            'expiry_date': date(2027, 12, 31),
            'godown_location': godown
        }
    ]
)
```

### 8. Process QC Results
```python
from purchase.services import ReceiptService

# QC passed - accepted 100, rejected 0
ReceiptService.process_qc_result(
    receipt=receipt,
    qc_results={
        1: (Decimal('100.00'), Decimal('0.00'))  # line_no: (accepted, rejected)
    }
)
```

### 9. Generate Payment Advice
```python
from purchase.services import PaymentService
import uuid

payment = PaymentService.generate_payment_advice(
    vendor=vendor,
    source_document_type='RECEIPT',
    source_document_id=uuid.UUID(receipt.id),
    amount=Decimal('15000.00'),
    due_date=date(2026, 4, 30),
    payment_method='BANK_TRANSFER',
    prepared_by=finance_user,
    tax_components=[
        {
            'tax_type': 'TDS',
            'rate': Decimal('2.00'),
            'amount': Decimal('300.00')
        }
    ]
)

# Approve payment
PaymentService.approve_payment_advice(payment, approver_user)

# Mark as paid
PaymentService.mark_payment_done(payment, finance_user)
```

## API Endpoints

### Purchase Requests
- `GET /api/purchase/purchase-requests/` - List all PRs
- `POST /api/purchase/purchase-requests/` - Create PR
- `GET /api/purchase/purchase-requests/{id}/` - Get PR details
- `POST /api/purchase/purchase-requests/{id}/approve/` - Approve PR
- `POST /api/purchase/purchase-requests/{id}/reject/` - Reject PR

### RFQs
- `GET /api/purchase/rfqs/` - List RFQs
- `POST /api/purchase/rfqs/` - Create RFQ
- `GET /api/purchase/rfqs/open_rfqs/` - Get open RFQs
- `POST /api/purchase/rfqs/{id}/close/` - Close RFQ

### Quotes
- `GET /api/purchase/quotes/` - List quotes
- `POST /api/purchase/quotes/` - Create quote
- `GET /api/purchase/quotes/for_rfq/?rfq_id=xxx` - Get quotes for RFQ

### Purchase Orders
- `GET /api/purchase/purchase-orders/` - List POs
- `POST /api/purchase/purchase-orders/` - Create PO
- `POST /api/purchase/purchase-orders/{id}/approve/` - Approve PO
- `POST /api/purchase/purchase-orders/{id}/issue/` - Issue PO
- `GET /api/purchase/purchase-orders/overdue/` - Get overdue POs

### Receipts
- `GET /api/purchase/receipts/` - List receipts
- `POST /api/purchase/receipts/` - Create receipt
- `POST /api/purchase/receipts/{id}/process_qc/` - Process QC
- `GET /api/purchase/receipts/pending/` - Get pending receipts

### Payments
- `GET /api/purchase/payment-advices/` - List payments
- `POST /api/purchase/payment-advices/` - Create payment advice
- `POST /api/purchase/payment-advices/{id}/approve/` - Approve
- `POST /api/purchase/payment-advices/{id}/mark_paid/` - Mark as paid
- `GET /api/purchase/payment-advices/pending/` - Get pending payments

## Data Selectors (Query Helpers)

```python
from purchase.selectors import (
    PurchaseRequestSelectors,
    PurchaseOrderSelectors,
    ReceiptSelectors,
    PaymentSelectors
)

# Get pending PRs
pending_prs = PurchaseRequestSelectors.get_pending_prs_for_warehouse(
    warehouse=warehouse,
    days=30
)

# Get overdue POs
overdue_pos = PurchaseOrderSelectors.get_overdue_pos(days=7)

# Get pending receipts
pending_receipts = ReceiptSelectors.get_pending_receipts(warehouse=warehouse)

# Get overdue payments
overdue_payments = PaymentSelectors.get_overdue_payments(days=0)

# Get payment summary
summary = PaymentSelectors.get_payment_summary_by_vendor()
```

## Admin Interface

Access Django admin at `/admin/`:
1. Purchase Requests - with line items and approval trails
2. RFQs - with ETA updates
3. Quote Responses - with line items
4. Quote Evaluations - with comparison entries
5. Purchase Orders - with line items and ETA updates
6. Receipt Advices - with comprehensive line items, packing, freight
7. Vendor Payment Advices - with tax components

## Permissions

All endpoints require:
- `IsAuthenticated` permission
- User must have `core.StakeholderUser` instance

## Error Handling

All services raise `ValidationError` for business logic violations:
```python
from django.core.exceptions import ValidationError

try:
    PurchaseRequestService.approve_purchase_request(pr, user)
except ValidationError as e:
    print(f"Error: {e.message}")
```

## Troubleshooting

**Issue: Auto-generated numbers not working**
- Ensure `common.utils.generate_unique_number()` exists
- Check database sequence

**Issue: Foreign key errors**
- Verify relationships exist (Warehouse, Product, Vendor, etc.)
- Use PROTECT foreign keys - don't delete referenced records

**Issue: Celery tasks not running**
- Ensure Redis/RabbitMQ is running
- Check Celery worker logs
- Verify CELERY_BROKER_URL in settings

**Issue: Serializer validation errors**
- Check decimal precision (DecimalField max_digits=18)
- Validate quantity > 0
- Ensure foreign key IDs exist
