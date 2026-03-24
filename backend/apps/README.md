# ERP System Apps Documentation

Complete production-grade Django apps for an enterprise ERP system with HR, Workflow, Audit, and AI document parsing capabilities.

## Architecture Overview

All apps follow a clean, layered architecture:

```
├── models.py          # Data models (ORM)
├── serializers.py     # REST API serializers
├── views.py           # API viewsets
├── services.py        # Business logic layer
├── selectors.py       # Read-only data access (queries)
├── urls.py            # URL routing
├── admin.py           # Django admin interface
└── tasks.py           # (Optional) Async tasks
```

### Key Design Patterns

- **BaseModel**: All models inherit from `common.models.BaseModel` providing:
  - UUID primary key
  - `created_at`, `updated_at` timestamps
  - `created_by`, `updated_by` user tracking
  - `is_active` soft delete flag

- **Services Layer**: Contains business logic, validation, and complex operations
- **Selectors Layer**: Read-only queries with optimized select_related/prefetch_related
- **REST API**: DRF viewsets with comprehensive filtering and custom actions

---

## APP 1: HR (Human Resources)

### Purpose
Complete HR management system with attendance, leave, overtime, and payroll tracking.

### Models

#### Staff
Main employee/staff records with comprehensive details.
- **Fields**: staff_id, staff_type (EMPLOYEE/STAFF), personal info, employment dates/status
- **Relations**: company, warehouse, shift, hr_owner
- **Nested**: bank_account (1:1), id_proofs (1:N)
- **Indexes**: (company, status), (location, status), (staff_id, is_active)

#### ShiftDefinition
Shift schedules for warehouses.
- **Fields**: shift_code, timing, break duration, grace period, approval requirements
- **Calculations**: shift_duration_hours property with break deduction

#### AttendanceCapture
Daily biometric attendance with geofence validation.
- **Fields**: check-in/out times, geo coordinates, face confidence, device_id
- **Unique**: (staff, date) constraint
- **Status**: PRESENT, ABSENT, HALF_DAY, PERMISSION
- **Indexes**: (staff, date), (date, status), (device_id, date)

#### LeaveRequest
Leave request workflow with approval tracking.
- **Auto-fields**: request_no (unique)
- **Status**: PENDING, APPROVED, REJECTED
- **Relations**: staff, approver (FK StakeholderUser)

#### OvertimeRequest
Overtime request and wage integration.
- **Auto-fields**: request_no (unique)
- **Status**: PENDING, APPROVED, REJECTED
- **Integration**: wage_integration_flag for accounting module

#### PayrollExport
Payroll summary with staff breakdowns.
- **Auto-fields**: export_id (unique)
- **Aggregates**: attendance metrics, overtime totals
- **Relations**: staff_summaries (1:N)

#### AttendanceDeviceLog
Device sync and event logging.
- **Types**: CAPTURE, SYNC events
- **Status**: SUCCESS, FAILED tracking

### Services

```python
# Attendance
AttendanceService.mark_attendance()  # Geofence + face validation
AttendanceService.validate_geofence()  # Distance check

# Leave
LeaveService.request_leave()
LeaveService.approve_leave()
LeaveService.reject_leave()

# Overtime
OvertimeService.request_overtime()
OvertimeService.approve_overtime()  # Creates wage voucher if approved

# Payroll
PayrollService.generate_payroll_export()  # Aggregates attendance & overtime

# Shifts
ShiftService.assign_shift()
ShiftService.unassign_shift()
```

### Selectors (Queries)

```python
StaffSelector.get_staff_for_warehouse()
StaffSelector.get_staff_by_department()
StaffSelector.get_contractors()
StaffSelector.search_staff()

AttendanceSelector.get_attendance_for_period()
AttendanceSelector.get_attendance_summary()
AttendanceSelector.get_staff_absent_on_date()
AttendanceSelector.get_face_match_failures()

LeaveSelector.get_leave_balance()
LeaveSelector.get_pending_leave_requests()
LeaveSelector.get_leave_requests_for_period()

OvertimeSelector.get_pending_overtime_requests()
OvertimeSelector.get_staff_overtime_summary()
```

### API Endpoints

```
POST   /staff/                    # Create staff
GET    /staff/                    # List staff
GET    /staff/:id/                # Staff details
POST   /staff/:id/assign_shift    # Assign shift
POST   /staff/:id/unassign_shift  # Remove shift

GET    /shifts/                   # List shifts
GET    /shifts/for_warehouse      # Warehouse shifts

POST   /attendance/               # Mark attendance
GET    /attendance/for_period     # Period attendance
GET    /attendance/summary        # Attendance summary
GET    /attendance/warehouse_summary

POST   /leaves/                   # Request leave
GET    /leaves/balance            # Leave balance
GET    /leaves/pending            # Pending approvals
POST   /leaves/:id/approve        # Approve leave
POST   /leaves/:id/reject         # Reject leave

POST   /overtime/                 # Request overtime
GET    /overtime/pending          # Pending approvals
POST   /overtime/:id/approve      # Approve OT
POST   /overtime/:id/reject       # Reject OT

POST   /payroll/generate          # Generate payroll export
GET    /payroll/                  # Payroll exports
```

### Configuration

**Geofence Settings**:
```python
AttendanceService.GEOFENCE_RADIUS_KM = 0.5  # 500m radius
AttendanceService.FACE_MATCH_THRESHOLD = 0.8  # Min 80% confidence
```

**Leave Defaults**:
```python
# Default 20 days annually (configurable)
balance = 20 - approved_days
```

---

## APP 2: Workflow (Process Automation)

### Purpose
Generic workflow engine for document approval processes across modules.

### Models

#### WorkflowDefinition
Process templates for different document types.
- **Fields**: name (unique), module, document_type, is_active
- **Relations**: steps (1:N WorkflowStep)
- **Examples**: "PurchaseRequest", "SalesOrder", "ExpenseReport"

#### WorkflowStep
Individual steps in a workflow sequence.
- **Fields**: step_order, step_name, action_type (APPROVE/REJECT/REVIEW/AUTHORIZE)
- **Relations**: required_role, escalation_role (both FK RoleDefinition)
- **Options**: auto_advance, timeout_hours, escalation rules
- **Unique**: (workflow, step_order)

#### WorkflowInstance
Active workflow instances for specific documents.
- **Fields**: workflow, document_id (UUID), document_type
- **Status**: PENDING, IN_PROGRESS, COMPLETED, REJECTED, ESCALATED
- **Relations**: current_step, initiated_by (StakeholderUser)
- **Tracking**: initiated_date, completed_date
- **Indexes**: (document_id, document_type), (status, workflow), (initiated_date)

#### WorkflowAction
Actions taken on workflow steps.
- **Fields**: action (APPROVED/REJECTED/ESCALATED/TIMED_OUT)
- **Relations**: instance, step, actor, next_step
- **Tracking**: action_date, remarks
- **Indexes**: (instance, action_date), (actor, action_date)

### Services

```python
# Workflow
WorkflowService.initiate_workflow()  # Start workflow for document
WorkflowService.process_action()     # Approve/reject/escalate
WorkflowService.check_timeouts()     # Escalate overdue workflows
WorkflowService.get_pending_approvals_for_user()

# Statistics
WorkflowService.get_workflow_statistics()
```

### Selectors

```python
WorkflowSelector.get_my_pending_approvals()
WorkflowSelector.get_workflow_history()
WorkflowSelector.get_active_workflows()
WorkflowSelector.get_workflows_by_status()
WorkflowSelector.get_workflows_awaiting_user()
WorkflowSelector.get_overdue_workflows()
WorkflowSelector.get_escalated_workflows()
```

### API Endpoints

```
GET    /definitions/              # Workflow definitions
GET    /definitions/by_module     # Workflows for module
POST   /definitions/              # Create workflow

POST   /instances/                # Initiate workflow
GET    /instances/                # List instances
GET    /instances/:id/            # Instance details
POST   /instances/:id/approve     # Approve step
POST   /instances/:id/reject      # Reject workflow
GET    /instances/my_pending      # Current user pending
GET    /instances/history         # Document history
GET    /instances/statistics      # Stats
GET    /instances/overdue         # Overdue workflows

GET    /actions/                  # Action history
GET    /actions/?instance_id=X    # Instance actions
```

### Workflow Execution Flow

```
1. Initiate: Create instance, set to first step
2. Process: User approves/rejects at current step
3. Advance: Move to next step or complete
4. Escalate: Auto-escalate if timeout exceeded
5. Complete: Mark as COMPLETED or REJECTED
```

### Configuration

**Timeout Handling**:
```python
# Celery task runs periodically
check_timeouts() # Escalates overdue workflows
```

---

## APP 3: Audit (Compliance & Auditing)

### Purpose
System-wide audit trail, policy decisions, and configuration management.

### Models

#### SystemParameter
Configuration parameters for system modules.
- **Fields**: parameter_name (unique), parameter_value, module_scope
- **Scopes**: GLOBAL, HR, PURCHASE, SALES, INVENTORY, FINANCE, WORKFLOW
- **Tracking**: last_updated_by, effective_date
- **Caching**: 1-hour cache for performance

#### DecisionLog
Business decision and policy records.
- **Fields**: topic, decision_details, follow_up_actions
- **Relations**: stakeholders (M2M StakeholderUser)
- **Tracking**: decision_date (auto)
- **Indexes**: (topic, decision_date)

#### AuditTrail
Comprehensive audit log for all system operations.
- **Fields**: module, record_id, action (CREATE/UPDATE/DELETE/APPROVE)
- **Snapshots**: before_snapshot (JSONField), after_snapshot (JSONField)
- **Context**: user, timestamp, ip_address, user_agent, remarks
- **Read-only**: Cannot be modified after creation
- **Indexes**: (module, record_id), (action, timestamp), (user, timestamp), (timestamp)

### Services

```python
# Audit Logging
AuditService.log_audit()          # Manual audit entry
AuditService.log_model_change()   # Auto-log model operations

# System Parameters
SystemParameterService.get_system_parameter()  # With caching
SystemParameterService.set_system_parameter()  # Update & invalidate cache
SystemParameterService.get_parameters_by_module()
SystemParameterService.validate_parameter_value()

# Decisions
DecisionLogService.log_decision()
```

### Selectors

```python
AuditSelector.get_audit_trail()         # Complete history
AuditSelector.get_audit_by_user()       # User actions
AuditSelector.get_audit_by_action()     # Action type
AuditSelector.get_audit_by_module()     # Module audits
AuditSelector.get_recent_changes()      # Last N changes
AuditSelector.get_suspicious_activity() # Multiple rapid changes

DecisionLogSelector.get_decisions_by_topic()
DecisionLogSelector.get_decisions_for_period()
DecisionLogSelector.get_decisions_with_pending_actions()

SystemParameterSelector.get_parameters_by_module()
SystemParameterSelector.get_recently_updated_parameters()
```

### API Endpoints

```
GET    /parameters/               # List parameters
GET    /parameters/by_module      # Module parameters
GET    /parameters/value          # Get parameter value
POST   /parameters/set_parameter  # Set parameter

GET    /trails/                   # Audit logs
GET    /trails/for_record         # Record audit trail
GET    /trails/by_user            # User actions
GET    /trails/by_action          # Action type
GET    /trails/by_module          # Module audits

GET    /decisions/                # Decision logs
POST   /decisions/                # Create decision
GET    /decisions/by_topic        # Topic decisions
GET    /decisions/recent          # Recent decisions
GET    /decisions/pending_actions # Pending follow-ups
```

### Audit Mixin (for automatic logging)

Use in models to auto-log changes:

```python
from audit.mixins import AuditMixin

class MyModel(AuditMixin, BaseModel):
    # Changes automatically logged
    pass
```

---

## APP 4: AI Parser (Document Processing)

### Purpose
AI-powered document parsing with OCR, LLM, and confidence scoring.

### Models

#### ParserConfiguration
Parser setup for different document types.
- **Fields**: name (unique), parser_type, llm_provider, llm_model
- **Prompt**: prompt_template (full template text)
- **Threshold**: confidence_threshold (0.8 default)
- **Providers**: OLLAMA, GEMINI, OPENAI, ANTHROPIC
- **Types**: CUSTOMER_PO, BANK_STATEMENT, INVOICE

#### ParserLog
Parsing operation results and history.
- **Fields**: configuration, input_file, ocr_text, llm_response (JSON)
- **Metrics**: confidence_score, processing_time_ms
- **Status**: parsed_successfully (bool), error_message
- **Indexes**: (configuration, created_at), (parsed_successfully, created_at)

### Services

```python
# OCR
OCRService.run_ocr()  # Tesseract → raw text

# LLM
LLMService.parse_with_llm()  # Send to Ollama/Gemini/OpenAI/Claude

# Parsing
ParserService.parse_customer_po()      # Orchestrate PO parsing
ParserService.parse_bank_statement()   # Bank statement parsing
ParserService.parse_invoice()          # Invoice parsing

# Product Mapping
ParserService._map_products_to_sku()   # Fuzzy match to inventory
```

### Selectors

```python
ParserSelector.get_active_parsers()
ParserSelector.get_parser_by_type()
ParserSelector.get_parsers_by_provider()
ParserSelector.get_parser_statistics()
ParserSelector.get_low_confidence_parses()
ParserSelector.get_parser_performance_by_model()
ParserSelector.get_parsers_needing_training()
```

### API Endpoints

```
GET    /configurations/           # List parsers
GET    /configurations/by_type    # Parser for type
POST   /configurations/           # Create parser

GET    /logs/                      # Parsing history
GET    /logs/:id/                  # Parse result
GET    /logs/statistics            # Parse stats
GET    /logs/low_confidence        # Low confidence parses

POST   /parse/parse_po             # Parse PO
POST   /parse/parse_invoice        # Parse invoice
POST   /parse/parse_statement      # Parse bank statement
```

### Async Tasks (Celery)

```python
# Async parsing
async_parse_document(log_id, parser_type)

# Batch operations
batch_parse_documents(parser_type)
analyze_parser_performance(config_id)
retrain_parser_prompt(config_id)
cleanup_old_parser_logs(days=90)
```

### LLM Prompt Templates

**CUSTOMER_PO_PROMPT**: Extracts PO number, date, customer, address, line items with confidence scores.

**BANK_STATEMENT_PROMPT**: Extracts account info, transactions, dates, amounts.

**INVOICE_PROMPT**: Extracts invoice details, vendor, line items, totals.

### Output Format

All parsing returns:
```json
{
  "success": true,
  "confidence_score": 0.92,
  "parsed_data": {
    "field_name": {
      "value": "extracted_value",
      "confidence": 0.95
    },
    "overall_confidence": 0.92
  },
  "error": "",
  "processing_time_ms": 2543
}
```

### LLM Provider Configuration

**Environment Variables**:
```
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OLLAMA_HOST=http://localhost:11434
```

---

## Database Schema

### Key Relationships

```
Company
├── Staff (many)
└── Warehouse (many)

Warehouse
├── Shift (many)
├── Staff (many as primary_location)
└── PayrollExport (many)

Staff
├── LeaveRequest (many)
├── OvertimeRequest (many)
├── AttendanceCapture (many)
├── StaffBankAccount (1)
└── StaffIDProof (many)

WorkflowDefinition
├── WorkflowStep (many)
└── WorkflowInstance (many)

WorkflowInstance
├── WorkflowAction (many)
└── CurrentStep (FK to WorkflowStep)

ParserConfiguration
└── ParserLog (many)
```

---

## Performance Considerations

### Indexes
- All frequently queried fields indexed
- Composite indexes on (foreign_key, date/status)
- Date hierarchy in admin for date_hierarchy navigation

### Caching
- System parameters cached for 1 hour
- Configure in settings: `PARAMETER_CACHE_TIMEOUT`

### Query Optimization
- Selectors use `select_related()` for FK
- Selectors use `prefetch_related()` for M2M/reverse FK
- Pagination in listviews (default 20 items)

### Database Connections
- Connection pooling recommended for production
- Use `transaction.atomic()` for multi-step operations

---

## Testing

Each app includes:
- Model tests (validation, constraints)
- Service tests (business logic)
- Selector tests (query optimization)
- View tests (API endpoints)
- Integration tests

Run tests:
```bash
python manage.py test hr
python manage.py test workflow
python manage.py test audit
python manage.py test ai_parser
```

---

## Deployment Checklist

- [ ] Configure LLM providers (GEMINI_API_KEY, etc.)
- [ ] Set up Celery worker for async tasks
- [ ] Configure database indexes
- [ ] Set cache backend (Redis recommended)
- [ ] Configure static files (Django admin CSS)
- [ ] Set up logging to ELK/Splunk
- [ ] Enable SSL/TLS for all endpoints
- [ ] Configure CORS if needed
- [ ] Set up Sentry for error tracking
- [ ] Create superuser and initial staff records

---

## Support & Troubleshooting

**OCR Not Working**: Ensure Tesseract and PyPDF2 installed
```bash
apt-get install tesseract-ocr
pip install pytesseract PyPDF2
```

**LLM API Errors**: Check API keys and rate limits

**Workflow Stuck**: Use `check_timeouts()` to escalate stuck workflows

**Attendance Issues**: Verify geofence coordinates on warehouse

---

Generated for production ERP system. All code follows Django best practices and is ready for immediate deployment.
