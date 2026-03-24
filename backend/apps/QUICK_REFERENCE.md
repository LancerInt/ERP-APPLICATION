# Quick Reference Guide

## File Locations

```
/apps/
├── hr/
│   ├── models.py          → Staff, AttendanceCapture, LeaveRequest, etc.
│   ├── services.py        → mark_attendance(), request_leave(), approve_overtime()
│   ├── selectors.py       → get_staff_for_warehouse(), get_attendance_for_period()
│   ├── views.py           → REST API endpoints
│   └── admin.py           → Django admin interface
│
├── workflow/
│   ├── models.py          → WorkflowDefinition, WorkflowInstance, WorkflowAction
│   ├── services.py        → initiate_workflow(), process_action(), check_timeouts()
│   ├── selectors.py       → get_my_pending_approvals(), get_workflow_history()
│   ├── views.py           → REST API endpoints
│   └── admin.py           → Django admin interface
│
├── audit/
│   ├── models.py          → SystemParameter, DecisionLog, AuditTrail
│   ├── services.py        → log_audit(), get_system_parameter(), log_decision()
│   ├── selectors.py       → get_audit_trail(), get_suspicious_activity()
│   ├── views.py           → REST API endpoints
│   └── admin.py           → Read-only audit admin
│
├── ai_parser/
│   ├── models.py          → ParserConfiguration, ParserLog
│   ├── services.py        → run_ocr(), parse_with_llm(), parse_customer_po()
│   ├── selectors.py       → get_parser_statistics(), get_low_confidence_parses()
│   ├── tasks.py           → async_parse_document(), batch_parse_documents()
│   ├── views.py           → REST API endpoints
│   └── admin.py           → Parser admin interface
│
├── README.md              → Full documentation (2,000+ lines)
├── IMPLEMENTATION_SUMMARY.md → This summary
└── QUICK_REFERENCE.md     → This file
```

## Quick API Examples

### HR - Mark Attendance
```bash
curl -X POST http://localhost:8000/api/hr/attendance/ \
  -H "Authorization: Bearer TOKEN" \
  -F "staff_id=550e8400-e29b-41d4-a716-446655440000" \
  -F "latitude=28.6139" \
  -F "longitude=77.2090" \
  -F "face_confidence=0.95" \
  -F "device_id=DEVICE-001" \
  -F "entry_photo=@/path/to/photo.jpg"
```

### HR - Request Leave
```bash
curl -X POST http://localhost:8000/api/hr/leaves/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staff_id": "550e8400-e29b-41d4-a716-446655440000",
    "leave_type": "FULL_DAY",
    "start_date": "2024-04-15",
    "end_date": "2024-04-17",
    "reason": "Personal leave"
  }'
```

### Workflow - Initiate
```bash
curl -X POST http://localhost:8000/api/workflow/instances/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "123",
    "document_id": "po-12345",
    "document_type": "PurchaseRequest"
  }'
```

### Workflow - Approve Step
```bash
curl -X POST http://localhost:8000/api/workflow/instances/456/approve/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "remarks": "Approved as per budget"
  }'
```

### Audit - Get Audit Trail
```bash
curl -X GET "http://localhost:8000/api/audit/trails/for_record?module=hr&record_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer TOKEN"
```

### AI Parser - Parse PO
```bash
curl -X POST http://localhost:8000/api/ai_parser/parse/parse_po/ \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/path/to/po.pdf"
```

## Common Service Calls

### HR Services
```python
from hr.services import AttendanceService, LeaveService, OvertimeService, PayrollService

# Mark attendance
attendance = AttendanceService.mark_attendance(
    staff=staff_obj,
    check_in_time=timezone.now(),
    entry_photo=file,
    latitude=28.6139,
    longitude=77.2090,
    face_confidence=0.95,
    device_id='DEVICE-001'
)

# Request leave
leave = LeaveService.request_leave(
    staff=staff_obj,
    leave_type='FULL_DAY',
    start_date='2024-04-15',
    reason='Personal leave'
)

# Approve leave
LeaveService.approve_leave(leave, approver_stakeholder)

# Generate payroll
payroll = PayrollService.generate_payroll_export(
    warehouse=warehouse_obj,
    period_start='2024-04-01',
    period_end='2024-04-30'
)
```

### Workflow Services
```python
from workflow.services import WorkflowService

# Initiate workflow
instance = WorkflowService.initiate_workflow(
    workflow_definition=workflow_obj,
    document_id=uuid.uuid4(),
    document_type='PurchaseRequest',
    initiated_by=stakeholder_user
)

# Process action
WorkflowService.process_action(
    instance=instance,
    action_type='APPROVED',
    actor=approver_stakeholder,
    remarks='Looks good'
)

# Check for timeouts
escalated = WorkflowService.check_timeouts()
```

### Audit Services
```python
from audit.services import AuditService, SystemParameterService

# Log audit
AuditService.log_audit(
    module='hr',
    record_id=staff_id,
    action='UPDATE',
    user=stakeholder_user,
    before_snapshot={...},
    after_snapshot={...}
)

# Get parameter
value = SystemParameterService.get_system_parameter(
    'GEOFENCE_RADIUS_KM',
    default='0.5'
)

# Set parameter
SystemParameterService.set_system_parameter(
    'GEOFENCE_RADIUS_KM',
    '0.75',
    'HR',
    user=stakeholder_user
)
```

### AI Parser Services
```python
from ai_parser.services import ParserService

# Parse PO
parsed, confidence, success, error = ParserService.parse_customer_po(
    file_path='/tmp/po.pdf',
    config=parser_config
)

# Result structure:
{
    'po_number': {'value': 'PO-12345', 'confidence': 0.95},
    'po_date': {'value': '2024-04-15', 'confidence': 0.92},
    'customer_name': {'value': 'Acme Corp', 'confidence': 0.98},
    'line_items': [...],
    'overall_confidence': 0.94
}
```

## Common Selector Queries

### HR Selectors
```python
from hr.selectors import StaffSelector, AttendanceSelector, LeaveSelector

# Get warehouse staff
staff_list = StaffSelector.get_staff_for_warehouse(warehouse_obj)

# Get attendance for period
attendance = AttendanceSelector.get_attendance_for_period(
    staff_obj, 
    '2024-04-01', 
    '2024-04-30'
)

# Get leave balance
balance = LeaveSelector.get_leave_balance(staff_obj)

# Get pending leave requests
pending = LeaveSelector.get_pending_leave_requests(approver_stakeholder)
```

### Workflow Selectors
```python
from workflow.selectors import WorkflowSelector

# Get my pending approvals
pending = WorkflowSelector.get_my_pending_approvals(user)

# Get workflow history
history = WorkflowSelector.get_workflow_history(
    document_id='po-12345',
    document_type='PurchaseRequest'
)

# Get overdue workflows
overdue = WorkflowSelector.get_overdue_workflows(hours=24)
```

### Audit Selectors
```python
from audit.selectors import AuditSelector, SystemParameterSelector

# Get record audit trail
trail = AuditSelector.get_audit_trail('hr', staff_id)

# Get suspicious activity
suspicious = AuditSelector.get_suspicious_activity(hours=24)

# Get parameters
params = SystemParameterSelector.get_parameters_by_module('HR')
```

### AI Parser Selectors
```python
from ai_parser.selectors import ParserSelector

# Get parser statistics
stats = ParserSelector.get_parser_statistics(config_obj)

# Get low confidence parses
low_conf = ParserSelector.get_low_confidence_parses(threshold=0.7)

# Get parser performance
perf = ParserSelector.get_parser_performance_by_model('mistral:latest')
```

## Key Model Fields

### Staff Model
- `staff_id` (unique) - Employee ID
- `staff_type` - EMPLOYEE or STAFF
- `employment_status` - ACTIVE, ON_LEAVE, RESIGNED
- `shift_assignment` - FK to ShiftDefinition
- `face_template_id` - Biometric template ID
- `overtime_eligible` - Boolean

### AttendanceCapture Model
- `staff` - FK Staff
- `date` - Unique with staff
- `check_in_time` - DateTime
- `check_out_time` - DateTime (nullable)
- `face_match_confidence` - Decimal (0-1)
- `attendance_status` - PRESENT, ABSENT, HALF_DAY, PERMISSION
- `overtime_hours` - Decimal

### WorkflowInstance Model
- `workflow` - FK WorkflowDefinition
- `document_id` - UUID (indexed)
- `document_type` - CharField
- `current_step` - FK WorkflowStep
- `status` - PENDING, IN_PROGRESS, COMPLETED, REJECTED, ESCALATED
- `initiated_by` - FK StakeholderUser

### AuditTrail Model
- `module` - CharField (indexed)
- `record_id` - CharField (indexed)
- `action` - CREATE, UPDATE, DELETE, APPROVE
- `user` - FK StakeholderUser
- `before_snapshot` - JSONField
- `after_snapshot` - JSONField
- `timestamp` - DateTime (auto, indexed)

### ParserConfiguration Model
- `parser_type` - CUSTOMER_PO, BANK_STATEMENT, INVOICE
- `llm_provider` - OLLAMA, GEMINI, OPENAI, ANTHROPIC
- `llm_model` - Model identifier
- `confidence_threshold` - Decimal (0-1), default 0.8
- `active` - Boolean

## Admin URLs

```
http://localhost:8000/admin/hr/staff/
http://localhost:8000/admin/hr/attendancecapture/
http://localhost:8000/admin/hr/leaverequest/
http://localhost:8000/admin/workflow/workflowinstance/
http://localhost:8000/admin/audit/audittrail/
http://localhost:8000/admin/ai_parser/parserconfiguration/
```

## Environment Variables

```bash
# LLM Providers
export GEMINI_API_KEY=your_key
export OPENAI_API_KEY=your_key
export ANTHROPIC_API_KEY=your_key
export OLLAMA_HOST=http://localhost:11434

# Cache
export CACHES_DEFAULT_LOCATION=redis://localhost:6379/0

# Celery
export CELERY_BROKER_URL=redis://localhost:6379/1
export CELERY_RESULT_BACKEND=redis://localhost:6379/2
```

## Celery Tasks

```python
from ai_parser.tasks import (
    async_parse_document,
    batch_parse_documents,
    analyze_parser_performance,
    cleanup_old_parser_logs
)

# Parse document async
async_parse_document.delay(parser_log_id, 'CUSTOMER_PO')

# Batch reprocess
batch_parse_documents.delay('CUSTOMER_PO')

# Analyze performance
analyze_parser_performance.delay()

# Cleanup old logs
cleanup_old_parser_logs.delay(days=90)
```

## Testing

```bash
# Run all tests
python manage.py test

# Run specific app
python manage.py test hr
python manage.py test workflow
python manage.py test audit
python manage.py test ai_parser

# With coverage
coverage run --source='.' manage.py test
coverage report
```

## Common Errors & Solutions

| Error | Solution |
|-------|----------|
| Face confidence below threshold | Increase camera angle, better lighting |
| Geofence validation failed | Verify warehouse coordinates, increase radius |
| LLM API timeout | Check API key, reduce document size |
| Workflow stuck at step | Run `check_timeouts()` to escalate |
| OCR produces garbage text | Use higher resolution image, better quality scan |

---

For detailed documentation, see **README.md**
For implementation details, see **IMPLEMENTATION_SUMMARY.md**
