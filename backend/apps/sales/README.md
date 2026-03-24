# Django Sales App - Production ERP Module

Complete, production-grade sales management system for Django ERPs handling PO intake through accounts receivable.

## Quick Start

### Files Overview

| File | Purpose |
|------|---------|
| `models.py` | 12 models covering PO → SO → DC → Invoice → A/R workflow |
| `serializers.py` | DRF serializers with nested relationships |
| `views.py` | 7 ViewSets with 20+ API endpoints |
| `services.py` | 6 service classes with business logic |
| `selectors.py` | 4 selector classes for optimized queries |
| `urls.py` | URL routing configuration |
| `admin.py` | Production-grade Django admin |
| `tasks.py` | 6 Celery async tasks with retry logic |
| `permissions.py` | Custom permission classes |
| `filters.py` | Advanced filtering for all models |
| `pagination.py` | REST pagination classes |
| `tests.py` | Test structure templates |
| `ARCHITECTURE.md` | Detailed technical architecture |
| `INTEGRATION_GUIDE.md` | Installation and usage guide |

### Models (12 total)

**PO Intake:**
- `CustomerPOUpload` - PO file management
- `ParsedLine` - AI-extracted line items

**Sales Orders:**
- `SalesOrder` - Main sales document
- `SOLine` - Order line items

**Dispatch:**
- `DispatchChallan` - Shipment document
- `DCLine` - Dispatch line items
- `DeliveryLocation` - Multi-location delivery support

**Invoicing:**
- `SalesInvoiceCheck` - Invoice verification with variance detection

**Freight:**
- `FreightAdviceOutbound` - Freight cost tracking
- `OutboundPaymentSchedule` - Freight payment terms

**Accounts Receivable:**
- `ReceivableLedger` - A/R tracking with aging
- `ReminderDate` - Dunning/reminder management

### Key Services

```python
POUploadService          # PO parsing orchestration
SalesOrderService        # SO lifecycle (create, approve, reject)
DispatchService          # DC management with stock validation
InvoiceService           # Invoice reconciliation with variance detection
FreightService           # Freight advice and payment management
ReceivableService        # A/R tracking and dunning
```

### Workflow

```
Upload PO → Parse (AI) → Create SO → Approve → Dispatch → 
Invoice → Accept → Receivable → Payment → Close
```

### API Endpoints (20+)

```
/api/sales/po-uploads/                    # PO management
/api/sales/sales-orders/                  # Sales orders
/api/sales/dispatch-challans/              # Dispatch & shipment
/api/sales/invoice-checks/                 # Invoice verification
/api/sales/freight-advices/                # Freight tracking
/api/sales/receivables/                    # Accounts receivable
/api/sales/reconciliation/                 # Full trail visibility
```

### Installation

```bash
# 1. Add to INSTALLED_APPS
INSTALLED_APPS = ['apps.sales', ...]

# 2. Include URLs
path('api/sales/', include('apps.sales.urls'))

# 3. Run migrations
python manage.py migrate sales

# 4. Configure Celery (optional but recommended)
# See INTEGRATION_GUIDE.md for task scheduling
```

### Usage Example

```python
from apps.sales.services import SalesOrderService
from apps.sales.selectors import ReceivableSelector

# Get pending SOs
pending_sos = SalesOrderSelector.get_pending_sos_for_warehouse(1)

# Approve SO
SalesOrderService.approve_sales_order(so, approved_by_user)

# Get overdue receivables
overdue = ReceivableSelector.get_overdue_receivables(days_overdue=30)

# Get aging summary
aging = ReceivableSelector.get_aging_summary()
```

### Core Features

✅ **Comprehensive PO Management**
- File upload with validation
- AI-powered document parsing
- Manual review for low-confidence extractions
- Product matching against price lists

✅ **Sales Order Workflow**
- Multi-level approval workflow
- Stock availability validation
- Quantity tracking (ordered vs reserved vs dispatched)
- Auto-generated SO numbers

✅ **Logistics & Dispatch**
- Dispatch challan creation from approved SOs
- Multi-location delivery support
- Freight tracking and payment scheduling
- Transporter integration

✅ **Invoice Reconciliation**
- Automatic SO-to-invoice matching
- Variance detection with configurable tolerance
- Low-confidence invoices flagged for review
- Inventory deduction on acceptance

✅ **Accounts Receivable**
- Aging analysis (30/60/90+ days)
- Automatic overdue escalation
- Payment recording with balance updates
- Dunning management with email reminders

✅ **Full Reconciliation Trail**
- PO → SO → DC → Invoice → Payment tracking
- Customer-level summary views
- Discrepancy detection
- Audit trail with user tracking

✅ **Production Ready**
- Transactional operations (all-or-nothing)
- Query optimization (prefetch_related, select_related)
- Comprehensive error handling
- Logging at key operations
- Celery async tasks with retry logic
- Django admin integration
- Custom permissions system

## Architecture Highlights

### Layered Design
```
Views (DRF ViewSets)
  ↓
Serializers (DRF)
  ↓
Services (Business Logic)
  ↓
Selectors (Query Optimization)
  ↓
Models (Data Layer)
```

### Key Patterns
- **Service Layer:** Encapsulates business rules
- **Selector Layer:** Optimized query patterns
- **Transaction Safety:** @transaction.atomic on all mutations
- **Async Tasks:** Celery for long-running operations
- **Soft Deletes:** is_active flag for data retention

### Performance Optimizations
- Database indexes on high-traffic fields
- Prefetch_related for ManyToMany
- Select_related for ForeignKey
- Pagination for large result sets
- Custom filters for complex queries

## Configuration

### Required Settings

```python
# settings.py
INSTALLED_APPS = ['apps.sales', 'rest_framework', 'django_filters']

# Invoice variance tolerance
INVOICE_VARIANCE_TOLERANCE = Decimal('5.00')

# AI Parser (configure your service)
AI_PARSER_SERVICE = YourParserService()
```

### Optional Celery Tasks

```python
CELERY_BEAT_SCHEDULE = {
    'auto-overdue-reminder': {...},
    'daily-reconciliation': {...},
    'cleanup-archives': {...},
    'freight-allocation': {...},
}
```

## Testing

```bash
# Run tests
python manage.py test apps.sales

# With coverage
coverage run --source='apps.sales' manage.py test apps.sales
coverage report
```

## Documentation

- **ARCHITECTURE.md** - Technical details, workflows, features
- **INTEGRATION_GUIDE.md** - Installation, API examples, troubleshooting
- **README.md** - This file
- **Code comments** - Docstrings on all public methods

## Admin Interface

Full Django admin support with:
- Inline editing for related models
- Search and filtering
- Read-only fields for audit trails
- Custom display methods
- Batch actions

## Support

For issues or questions:
1. Review ARCHITECTURE.md for design details
2. Check INTEGRATION_GUIDE.md for setup issues
3. See code docstrings for method details
4. Review logs for runtime errors

## Production Checklist

- [ ] Run full test suite
- [ ] Configure AI parser service
- [ ] Set up Celery workers
- [ ] Configure email for reminders
- [ ] Set up database backups
- [ ] Configure monitoring/alerting
- [ ] Load test critical flows
- [ ] Review security permissions
- [ ] Test disaster recovery
- [ ] Document custom configurations

## Database Schema

12 models with comprehensive relationships:
- Foreign keys with PROTECT to prevent data loss
- Indexes on performance-critical fields
- Soft deletes via is_active flag
- User tracking (created_by, updated_by)
- Timestamps on all records

Total Fields: 150+
Total Relationships: 40+
Total Indexes: 20+

## Version

Django 3.2+
Python 3.8+
DRF 3.12+

## License

See project LICENSE file.
