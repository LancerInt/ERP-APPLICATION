"""HR Models - Staff, Attendance, Leave, Overtime, Payroll"""
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

from common.models import BaseModel


class Staff(BaseModel):
    """Employee/Staff Records with comprehensive details"""

    STAFF_TYPE_CHOICES = [
        ('EMPLOYEE', 'Employee'),
        ('STAFF', 'Staff'),
    ]

    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]

    EMPLOYMENT_STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('ON_LEAVE', 'On Leave'),
        ('RESIGNED', 'Resigned'),
    ]

    staff_id = models.CharField(max_length=50, unique=True, db_index=True)
    staff_type = models.CharField(max_length=20, choices=STAFF_TYPE_CHOICES)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

    company = models.ForeignKey('core.Company', on_delete=models.PROTECT)
    primary_location = models.ForeignKey('core.Warehouse', on_delete=models.PROTECT)
    department = models.CharField(max_length=100, blank=True, default='')
    designation = models.CharField(max_length=100, blank=True, default='')
    employment_start_date = models.DateField(null=True, blank=True)
    employment_end_date = models.DateField(null=True, blank=True)
    employment_status = models.CharField(max_length=20, choices=EMPLOYMENT_STATUS_CHOICES)

    hr_owner = models.ForeignKey('core.StakeholderUser', on_delete=models.SET_NULL, null=True, blank=True)
    shift_assignment = models.ForeignKey('ShiftDefinition', on_delete=models.SET_NULL, null=True, blank=True)

    overtime_eligible = models.BooleanField(default=True)
    contractor_flag = models.BooleanField(default=False)
    contractor_vendor = models.ForeignKey('master.Vendor', on_delete=models.SET_NULL, null=True, blank=True)

    face_template_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    photo_reference = models.ImageField(upload_to='staff/photos/', null=True, blank=True)

    contact_number = models.CharField(max_length=20, blank=True, default='')
    emergency_contact = models.CharField(max_length=255, null=True, blank=True)
    address = models.JSONField(null=True, blank=True, help_text="Address components: street, city, state, postal_code, country")
    remarks = models.TextField(blank=True, default='')

    class Meta:
        app_label = 'hr'
        ordering = ['staff_id']
        indexes = [
            models.Index(fields=['company', 'employment_status']),
            models.Index(fields=['primary_location', 'employment_status']),
            models.Index(fields=['staff_id', 'is_active']),
        ]

    def __str__(self):
        return f"{self.staff_id} - {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class StaffBankAccount(BaseModel):
    """Bank account details for staff"""

    ACCOUNT_TYPE_CHOICES = [
        ('SAVINGS', 'Savings'),
        ('CURRENT', 'Current'),
        ('SALARY', 'Salary'),
    ]

    staff = models.OneToOneField(Staff, on_delete=models.CASCADE, related_name='bank_account')
    account_holder = models.CharField(max_length=100)
    bank_name = models.CharField(max_length=100)
    ifsc_code = models.CharField(max_length=11)
    account_number = models.CharField(max_length=50)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES)

    class Meta:
        app_label = 'hr'

    def __str__(self):
        return f"{self.staff.staff_id} - {self.bank_name} ({self.account_number[-4:]})"


class StaffIDProof(BaseModel):
    """ID proof documents for staff"""

    DOCUMENT_TYPE_CHOICES = [
        ('AADHAAR', 'Aadhaar'),
        ('PAN', 'PAN'),
        ('LICENSE', 'Driving License'),
        ('PASSPORT', 'Passport'),
        ('OTHER', 'Other'),
    ]

    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='id_proofs')
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES)
    document_number = models.CharField(max_length=100)
    expiry_date = models.DateField(null=True, blank=True)
    attachment = models.FileField(upload_to='staff/id_proofs/')

    class Meta:
        app_label = 'hr'
        unique_together = ('staff', 'document_type')

    def __str__(self):
        return f"{self.staff.staff_id} - {self.get_document_type_display()}"


class ShiftDefinition(BaseModel):
    """Shift schedules for warehouses"""

    ATTENDANCE_RULE_CHOICES = [
        ('EIGHT_HOUR', 'Eight Hour'),
        ('CUSTOM', 'Custom'),
    ]

    shift_code = models.CharField(max_length=50, unique=True, db_index=True)
    warehouse = models.ForeignKey('core.Warehouse', on_delete=models.CASCADE, related_name='shift_definitions')
    shift_name = models.CharField(max_length=100)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    break_duration_mins = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    overtime_eligibility = models.BooleanField(default=True)
    attendance_calculation_rule = models.CharField(max_length=20, choices=ATTENDANCE_RULE_CHOICES)
    grace_period_minutes = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    approval_required = models.BooleanField(default=False)

    class Meta:
        app_label = 'hr'
        ordering = ['shift_code']

    def __str__(self):
        return f"{self.shift_code} - {self.shift_name}"

    @property
    def shift_duration_hours(self):
        """Calculate shift duration in hours"""
        from datetime import datetime, timedelta
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        if end <= start:
            end += timedelta(days=1)
        duration = (end - start).total_seconds() / 3600
        return duration - (self.break_duration_mins / 60)


class AttendanceCapture(BaseModel):
    """Daily attendance records with biometric data"""

    ATTENDANCE_STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('HALF_DAY', 'Half Day'),
        ('PERMISSION', 'Permission'),
    ]

    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField(db_index=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    entry_photo = models.ImageField(upload_to='attendance/entry/', null=True, blank=True)
    exit_photo = models.ImageField(upload_to='attendance/exit/', null=True, blank=True)
    geo_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(-90), MaxValueValidator(90)])
    geo_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(-180), MaxValueValidator(180)])
    face_match_confidence = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(1)])
    device_id = models.CharField(max_length=100, db_index=True, blank=True, default='')
    shift = models.ForeignKey(ShiftDefinition, on_delete=models.SET_NULL, null=True, blank=True)
    attendance_status = models.CharField(max_length=20, choices=ATTENDANCE_STATUS_CHOICES)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    notes = models.TextField(blank=True, default='')

    class Meta:
        app_label = 'hr'
        unique_together = ('staff', 'date')
        indexes = [
            models.Index(fields=['staff', 'date']),
            models.Index(fields=['date', 'attendance_status']),
            models.Index(fields=['device_id', 'date']),
        ]

    def __str__(self):
        return f"{self.staff.staff_id} - {self.date} ({self.attendance_status})"


class LeaveRequest(BaseModel):
    """Leave request and approval workflow"""

    LEAVE_TYPE_CHOICES = [
        ('FULL_DAY', 'Full Day'),
        ('HALF_DAY', 'Half Day'),
        ('PERMISSION', 'Permission'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    request_no = models.CharField(max_length=50, unique=True, db_index=True)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    duration_hours = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    reason = models.TextField(blank=True, default='')
    attachment = models.FileField(upload_to='leave/attachments/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    approver = models.ForeignKey('core.StakeholderUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    approval_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'hr'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['staff', 'status']),
            models.Index(fields=['start_date', 'status']),
        ]

    def __str__(self):
        return f"{self.request_no} - {self.staff.staff_id}"


class OvertimeRequest(BaseModel):
    """Overtime request and approval"""

    APPROVAL_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    request_no = models.CharField(max_length=50, unique=True, db_index=True)
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name='overtime_requests')
    date = models.DateField(db_index=True)
    shift = models.ForeignKey(ShiftDefinition, on_delete=models.SET_NULL, null=True, blank=True)
    hours_worked = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(0)])
    task_description = models.TextField(blank=True, default='')
    supporting_evidence = models.FileField(upload_to='overtime/evidence/', null=True, blank=True)
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey('core.StakeholderUser', on_delete=models.SET_NULL, null=True, blank=True)
    wage_integration_flag = models.BooleanField(default=False)

    class Meta:
        app_label = 'hr'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['staff', 'approval_status']),
            models.Index(fields=['date', 'approval_status']),
        ]

    def __str__(self):
        return f"{self.request_no} - {self.staff.staff_id}"


class PayrollExport(BaseModel):
    """Payroll summary exports"""

    export_id = models.CharField(max_length=50, unique=True, db_index=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    warehouse = models.ForeignKey('core.Warehouse', on_delete=models.PROTECT, related_name='payroll_exports')
    attendance_metrics = models.TextField(blank=True, default='')
    overtime_hours_total = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    exceptions = models.TextField(blank=True, default='')
    export_file = models.FileField(upload_to='payroll/exports/', null=True, blank=True)

    class Meta:
        app_label = 'hr'
        ordering = ['-period_end']
        indexes = [
            models.Index(fields=['warehouse', 'period_start', 'period_end']),
        ]

    def __str__(self):
        return f"{self.export_id} - {self.period_start} to {self.period_end}"


class StaffSummary(BaseModel):
    """Payroll summary per staff member"""

    export = models.ForeignKey(PayrollExport, on_delete=models.CASCADE, related_name='staff_summaries')
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE)
    present_days = models.IntegerField(validators=[MinValueValidator(0)])
    absent_days = models.IntegerField(validators=[MinValueValidator(0)])
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    wages_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, validators=[MinValueValidator(0)])

    class Meta:
        app_label = 'hr'
        unique_together = ('export', 'staff')

    def __str__(self):
        return f"{self.export.export_id} - {self.staff.staff_id}"


class AttendanceDeviceLog(BaseModel):
    """Device synchronization and event logs"""

    EVENT_TYPE_CHOICES = [
        ('CAPTURE', 'Capture'),
        ('SYNC', 'Sync'),
    ]

    STATUS_CHOICES = [
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]

    device_id = models.CharField(max_length=100, db_index=True)
    event_time = models.DateTimeField(db_index=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    error_message = models.TextField(blank=True, default='')

    class Meta:
        app_label = 'hr'
        ordering = ['-event_time']
        indexes = [
            models.Index(fields=['device_id', 'event_time']),
        ]

    def __str__(self):
        return f"{self.device_id} - {self.event_time} ({self.status})"
