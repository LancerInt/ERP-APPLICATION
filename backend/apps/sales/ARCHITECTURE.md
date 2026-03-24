# Sales App Architecture

## Overview

The Sales app is a production-grade Django ERP module managing the complete sales-to-cash workflow:
- Customer PO intake and AI parsing
- Sales order creation and approval
- Dispatch and logistics management
- Invoice verification and reconciliation
- Accounts receivable and payment tracking

## Data Model

### Core Entities

```
CustomerPOUpload
├── ParsedLine (extracted items)
└── SalesOrder (conversion)
    ├── SOLine (order items)
    ├── DispatchChallan (shipment)
    │   ├── DCLine (dispatch items)
    │   ├── DeliveryLocation (multi-stop)
    │   └── FreightAdviceOutbound (freight costs)
    │       └── OutboundPaymentSchedule (payment terms)
    └── SalesInvoiceCheck (verification)
        └── ReceivableLedger (A/R tracking)
            └── ReminderDate (dunning)
```

### Model Hierarchy

All models inherit from `BaseModel` providing:
- `id` (UUID primary key)
- `created_at`, `updated_at` (timestamps)
- `created_by`, `updated_by` (user tracking)
- `is_active` (soft delete flag)

## Service Layer

### POUploadService
Handles PO file management and async parsing:
- `upload_and_parse_customer_po()` - Queue AI parsing task

### SalesOrderService
Manages SO lifecycle:
- `create_sales_order_from_parsed_po()` - Convert parsed PO to SO with validation
- `approve_sales_order()` - Workflow approval
- `reject_sales_order()` - Rejection with audit trail

### DispatchService
Manages dispatch operations:
- `create_dispatch_challan()` - Create DC with stock validation
- `release_dispatch_challan()` - Release for shipment
- `mark_dispatch_delivered()` - Mark delivery
- Stock availability checking
- Freight amount calculation

### InvoiceService
Handles invoice verification:
- `process_invoice_check()` - Compare invoice vs SO with variance detection
- `accept_invoice()` - Acceptance with inventory deduction
- Variance flagging with tolerance (5% default)

### FreightService
Manages freight operations:
- `create_outbound_freight_advice()` - Create freight advice
- `approve_freight_advice()` - Approve freight
- `mark_freight_paid()` - Payment processing

### ReceivableService
Accounts receivable management:
- `record_payment_received()` - Payment recording with balance updates
- `create_reminder()` - Dunning creation
- `check_and_escalate_overdue()` - Overdue detection and escalation

## Selector Layer

Query optimization with prefetch_related and select_related:

### SalesOrderSelector
- `get_pending_sos_for_warehouse()` - Pending approval SOs
- `get_approved_sos_not_dispatched()` - Ready to dispatch
- `get_sales_order_by_customer_po()` - PO traceability

### DispatchSelector
- `get_open_dcs()` - Not yet delivered
- `get_delivered_dcs_without_invoice()` - Awaiting invoice
- `get_dcs_by_transporter()` - Transporter tracking

### ReceivableSelector
- `get_overdue_receivables()` - Aged A/R
- `get_aging_summary()` - Ageing buckets (30/60/90+ days)
- `get_receivables_by_status()` - Status filtering

### SalesReconciliationSelector
- `get_sales_reconciliation_trail()` - PO → SO → DC → Invoice → Payment trail
- `get_reconciliation_summary_by_customer()` - Customer-level summary
- `get_invoice_to_receivable_matching()` - Invoice-A/R matching

## REST API

### Endpoints

```
POST   /api/sales/po-uploads/                           # Create PO upload
POST   /api/sales/po-uploads/{id}/trigger_parsing/      # Queue parsing
POST   /api/sales/po-uploads/{id}/convert_to_sales_order/ # Create SO

GET    /api/sales/sales-orders/                         # List SOs
POST   /api/sales/sales-orders/                         # Create SO
POST   /api/sales/sales-orders/{id}/approve/            # Approve SO
POST   /api/sales/sales-orders/{id}/reject/             # Reject SO

GET    /api/sales/dispatch-challans/                    # List DCs
POST   /api/sales/dispatch-challans/                    # Create DC
POST   /api/sales/dispatch-challans/{id}/release/       # Release DC
POST   /api/sales/dispatch-challans/{id}/mark_delivered/ # Mark delivered

GET    /api/sales/invoice-checks/                       # List invoices
POST   /api/sales/invoice-checks/{id}/accept_invoice/   # Accept invoice

GET    /api/sales/freight-advices/                      # List freight
POST   /api/sales/freight-advices/{id}/approve/         # Approve freight
POST   /api/sales/freight-advices/{id}/mark_paid/       # Mark paid

GET    /api/sales/receivables/                          # List A/R
GET    /api/sales/receivables/overdue/                  # Get overdue
GET    /api/sales/receivables/aging_summary/            # Ageing summary
POST   /api/sales/receivables/{id}/record_payment/      # Record payment

GET    /api/sales/reconciliation/sales_order_trail/     # Full trail
GET    /api/sales/reconciliation/invoice_matching/      # Invoice matching
```

## Async Tasks

### parse_customer_po_async
- Triggered: When PO file uploaded
- Integrates with AI parser (AWS Textract, Google Vision, OpenAI)
- Creates ParsedLine entries
- Flags low-confidence extractions for manual review
- Retries up to 3x with exponential backoff

### auto_overdue_reminder
- Schedule: Daily (configurable)
- Escalates overdue receivables
- Generates EMAIL/CALL reminders
- Sends notification emails

### daily_sales_reconciliation_report
- Schedule: Daily end-of-day
- Validates SO → DC → Invoice → Payment trail
- Reports discrepancies
- Logs for audit trail

### cleanup_expired_po_uploads
- Schedule: Monthly
- Soft-deletes PO uploads >1 year old
- Maintains database hygiene

### calculate_freight_allocations
- Schedule: Daily
- Allocates freight costs to SO lines
- Ensures accurate costing

## Workflow Examples

### PO to Cash Flow

```
1. Upload PO File
   - CustomerPOUpload created
   - Status: UPLOADED

2. Parse PO (Async)
   - AI parser extracts details
   - ParsedLine items created
   - Status: PARSED
   - Flag if low confidence

3. Create Sales Order
   - Validate against price list
   - Create SO with SOLine items
   - Status: DRAFT
   - PO marked CONVERTED

4. Approve Sales Order
   - Validate stock availability
   - Set status: APPROVED
   - Record approver & timestamp

5. Create Dispatch Challan
   - Create DC from approved SO
   - Create DCLine items
   - Update SO.reserved_qty
   - Status: DRAFT

6. Release Dispatch Challan
   - Create DeliveryLocation entries
   - Finalize freight
   - Status: RELEASED

7. Mark Delivered
   - Status: DELIVERED
   - Ready for invoicing

8. Upload & Check Invoice
   - Upload statutory invoice
   - Compare with SO total
   - Flag variance if >5%
   - Create SalesInvoiceCheck

9. Accept Invoice
   - Deduct inventory
   - Create ReceivableLedger entry
   - Status: PAID (when received)

10. Record Payment
    - Update receivable.amount_paid
    - Calculate balance
    - Update payment_status

11. Dunning (if overdue)
    - Auto-escalate after due date
    - Create ReminderDate entries
    - Send email reminders
```

## Key Features

### Stock Validation
- Pre-dispatch stock availability check
- Prevents over-commitment
- Tracks reserved quantities

### Invoice Reconciliation
- Automatic variance detection
- Configurable tolerance (5% default)
- Manual review flagging for large variances

### Accounts Receivable
- Aging analysis (30/60/90+ days)
- Escalation workflow
- Payment tracking and reconciliation
- Dunning management

### Audit Trail
- User tracking (created_by, updated_by)
- Timestamp tracking
- Status change history
- Soft deletes (is_active flag)

### Production Readiness
- Transaction-safe operations
- Optimized queries (prefetch_related)
- Input validation
- Comprehensive error handling
- Logging at key points
- Retry logic for async tasks

## Configuration

### Settings

```python
# settings.py

# Invoice variance tolerance (percentage)
INVOICE_VARIANCE_TOLERANCE = Decimal('5.00')

# AI Parser service
AI_PARSER_SERVICE = 'path.to.AIParserService'

# Email settings
EMAIL_FROM = 'noreply@erpsystem.com'
OVERDUE_EMAIL_TEMPLATE = 'sales/overdue_reminder_email.html'

# Celery tasks
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
}
```

## Testing

### Test Structure
- Unit tests for services
- Integration tests for workflows
- Fixture-based test data
- Mock external services (AI parser)

### Run Tests
```bash
python manage.py test apps.sales
```

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields:
  - `status` fields
  - `created_at`, `updated_at`
  - `customer`, `warehouse`
  - Foreign keys

- Batch operations for bulk updates
- Transaction boundaries for data consistency

### Query Optimization
- `select_related()` for one-to-one, ForeignKey
- `prefetch_related()` for ManyToMany, reverse FK
- Pagination for large result sets
- Field filtering to reduce data transfer

### Caching Opportunities
- Price list caching
- Customer master data
- Transporter details

## Security

### Permissions
- `IsSalesUser` - Sales app access
- `IsApprovalUser` - SO approval authority
- `CanApproveSalesOrder` - Per-SO approval check
- `CanAcceptInvoice` - Invoice acceptance authority

### Input Validation
- Decimal validators (quantities, amounts)
- Choice field validation
- Foreign key integrity
- Custom business logic validation

## Error Handling

All operations include:
- ValidationError for business rule violations
- Proper HTTP status codes
- Detailed error messages
- Logging of exceptions
- Transaction rollback on failure

## Future Enhancements

1. Advanced forecasting based on SO trends
2. EDI integration for PO exchange
3. Real-time shipment tracking
4. Multi-currency support
5. Advanced reporting and analytics
6. Automated payment matching
7. Credit limit enforcement
8. Discount tier automation
