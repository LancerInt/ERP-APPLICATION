"""HR Business Logic Services"""
import logging
from decimal import Decimal
from datetime import datetime, timedelta
from math import radians, cos, sin, asin, sqrt

from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import (
    Staff, ShiftDefinition, AttendanceCapture, LeaveRequest, OvertimeRequest,
    PayrollExport, StaffSummary, AttendanceDeviceLog
)

logger = logging.getLogger(__name__)


class AttendanceService:
    """Handle attendance marking and validation"""

    # Geofence radius in kilometers
    GEOFENCE_RADIUS_KM = 0.5
    FACE_MATCH_THRESHOLD = 0.8

    @staticmethod
    def haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two coordinates in kilometers"""
        lat1, lon1, lat2, lon2 = map(radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        return c * 6371  # Radius of earth in kilometers

    @classmethod
    def validate_geofence(cls, warehouse, latitude, longitude):
        """Verify location is within warehouse geofence"""
        if not warehouse.geo_latitude or not warehouse.geo_longitude:
            logger.warning(f"Warehouse {warehouse.id} missing geofence coordinates")
            return True

        distance = cls.haversine_distance(
            warehouse.geo_latitude, warehouse.geo_longitude,
            latitude, longitude
        )

        if distance > cls.GEOFENCE_RADIUS_KM:
            raise ValidationError(
                f"Location {distance:.2f}km outside geofence. Max allowed: {cls.GEOFENCE_RADIUS_KM}km"
            )
        return True

    @classmethod
    def mark_attendance(cls, staff, check_in_time, entry_photo, latitude, longitude,
                       face_confidence, device_id, shift=None, check_out_time=None,
                       exit_photo=None, notes=''):
        """
        Mark attendance for staff with validation.

        Args:
            staff: Staff instance
            check_in_time: datetime of check-in
            entry_photo: photo file for check-in
            latitude: geo latitude
            longitude: geo longitude
            face_confidence: face match confidence score (0-1)
            device_id: device identifier
            shift: ShiftDefinition instance (optional)
            check_out_time: datetime of check-out (optional)
            exit_photo: photo file for check-out (optional)
            notes: additional notes

        Returns:
            AttendanceCapture instance
        """
        if not staff.is_active:
            raise ValidationError(f"Staff {staff.staff_id} is not active")

        if staff.employment_status != 'ACTIVE':
            raise ValidationError(f"Staff {staff.staff_id} is {staff.employment_status}")

        # Validate geofence
        cls.validate_geofence(staff.primary_location, latitude, longitude)

        # Validate face confidence
        if face_confidence < cls.FACE_MATCH_THRESHOLD:
            raise ValidationError(
                f"Face match confidence {face_confidence} below threshold {cls.FACE_MATCH_THRESHOLD}"
            )

        attendance_date = check_in_time.date()

        with transaction.atomic():
            # Get or create attendance record
            attendance, created = AttendanceCapture.objects.get_or_create(
                staff=staff,
                date=attendance_date,
                defaults={
                    'check_in_time': check_in_time,
                    'entry_photo': entry_photo,
                    'geo_latitude': latitude,
                    'geo_longitude': longitude,
                    'face_match_confidence': face_confidence,
                    'device_id': device_id,
                    'shift': shift,
                    'attendance_status': 'PRESENT',
                    'notes': notes,
                }
            )

            if not created and check_out_time:
                # Update with check-out
                attendance.check_out_time = check_out_time
                if exit_photo:
                    attendance.exit_photo = exit_photo

            attendance.save()

            # Log device event
            AttendanceDeviceLog.objects.create(
                device_id=device_id,
                event_time=timezone.now(),
                event_type='CAPTURE',
                status='SUCCESS'
            )

        logger.info(f"Attendance marked for {staff.staff_id} on {attendance_date}")
        return attendance


class LeaveService:
    """Handle leave requests and approvals"""

    @classmethod
    def request_leave(cls, staff, leave_type, start_date, reason, attachment=None,
                     end_date=None, duration_hours=None):
        """Create a leave request"""
        request_no = cls._generate_request_no('LR')

        leave_request = LeaveRequest.objects.create(
            request_no=request_no,
            staff=staff,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            duration_hours=duration_hours,
            reason=reason,
            attachment=attachment,
            status='PENDING'
        )

        logger.info(f"Leave request {request_no} created for {staff.staff_id}")
        return leave_request

    @classmethod
    def approve_leave(cls, leave_request, approver, approval_remarks=''):
        """Approve a leave request"""
        if leave_request.status != 'PENDING':
            raise ValidationError(f"Cannot approve {leave_request.status} leave request")

        leave_request.status = 'APPROVED'
        leave_request.approver = approver
        leave_request.approval_date = timezone.now()
        leave_request.save()

        logger.info(f"Leave request {leave_request.request_no} approved by {approver.user.username}")
        return leave_request

    @classmethod
    def reject_leave(cls, leave_request, approver, rejection_reason=''):
        """Reject a leave request"""
        if leave_request.status != 'PENDING':
            raise ValidationError(f"Cannot reject {leave_request.status} leave request")

        leave_request.status = 'REJECTED'
        leave_request.approver = approver
        leave_request.approval_date = timezone.now()
        leave_request.save()

        logger.info(f"Leave request {leave_request.request_no} rejected")
        return leave_request

    @staticmethod
    def _generate_request_no(prefix):
        """Generate unique request number"""
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        return f"{prefix}-{timestamp}"


class OvertimeService:
    """Handle overtime requests and wage integration"""

    @classmethod
    def request_overtime(cls, staff, date, hours_worked, task_description, shift=None, evidence=None):
        """Create overtime request"""
        request_no = cls._generate_request_no('OT')

        overtime_request = OvertimeRequest.objects.create(
            request_no=request_no,
            staff=staff,
            date=date,
            shift=shift,
            hours_worked=hours_worked,
            task_description=task_description,
            supporting_evidence=evidence,
            approval_status='PENDING'
        )

        logger.info(f"Overtime request {request_no} created for {staff.staff_id}")
        return overtime_request

    @classmethod
    def approve_overtime(cls, overtime_request, approved_by, create_wage_voucher=True):
        """Approve overtime and optionally create wage voucher"""
        if overtime_request.approval_status != 'PENDING':
            raise ValidationError(f"Cannot approve {overtime_request.approval_status} overtime request")

        with transaction.atomic():
            overtime_request.approval_status = 'APPROVED'
            overtime_request.approved_by = approved_by
            overtime_request.save()

            if create_wage_voucher:
                cls._create_wage_voucher(overtime_request)

        logger.info(f"Overtime request {overtime_request.request_no} approved")
        return overtime_request

    @classmethod
    def reject_overtime(cls, overtime_request, approved_by):
        """Reject overtime request"""
        if overtime_request.approval_status != 'PENDING':
            raise ValidationError(f"Cannot reject {overtime_request.approval_status} overtime request")

        overtime_request.approval_status = 'REJECTED'
        overtime_request.approved_by = approved_by
        overtime_request.save()

        logger.info(f"Overtime request {overtime_request.request_no} rejected")
        return overtime_request

    @staticmethod
    def _create_wage_voucher(overtime_request):
        """Create wage voucher for approved overtime"""
        # Integration point with accounting module
        logger.info(f"Wage voucher would be created for OT request {overtime_request.request_no}")

    @staticmethod
    def _generate_request_no(prefix):
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        return f"{prefix}-{timestamp}"


class PayrollService:
    """Handle payroll processing and exports"""

    @classmethod
    def generate_payroll_export(cls, warehouse, period_start, period_end):
        """
        Generate payroll export for a warehouse and period.
        Aggregates attendance and overtime data.
        """
        export_id = cls._generate_export_id()

        # Get all staff in warehouse
        staff_list = Staff.objects.filter(
            primary_location=warehouse,
            employment_status='ACTIVE',
            is_active=True
        )

        # Aggregate metrics
        attendance_records = AttendanceCapture.objects.filter(
            staff__primary_location=warehouse,
            date__range=[period_start, period_end]
        )

        metrics = {
            'total_records': attendance_records.count(),
            'present_count': attendance_records.filter(attendance_status='PRESENT').count(),
            'absent_count': attendance_records.filter(attendance_status='ABSENT').count(),
            'half_day_count': attendance_records.filter(attendance_status='HALF_DAY').count(),
        }

        overtime_total = Decimal('0')
        overtime_records = OvertimeRequest.objects.filter(
            staff__primary_location=warehouse,
            date__range=[period_start, period_end],
            approval_status='APPROVED'
        )
        overtime_total = sum([r.hours_worked for r in overtime_records], Decimal('0'))

        with transaction.atomic():
            payroll = PayrollExport.objects.create(
                export_id=export_id,
                period_start=period_start,
                period_end=period_end,
                warehouse=warehouse,
                attendance_metrics=str(metrics),
                overtime_hours_total=overtime_total
            )

            # Create staff summaries
            for staff in staff_list:
                staff_attendance = AttendanceCapture.objects.filter(
                    staff=staff,
                    date__range=[period_start, period_end]
                )

                present_days = staff_attendance.filter(attendance_status='PRESENT').count()
                absent_days = staff_attendance.filter(attendance_status='ABSENT').count()

                staff_overtime = OvertimeRequest.objects.filter(
                    staff=staff,
                    date__range=[period_start, period_end],
                    approval_status='APPROVED'
                )
                ot_hours = sum([r.hours_worked for r in staff_overtime], Decimal('0'))

                StaffSummary.objects.create(
                    export=payroll,
                    staff=staff,
                    present_days=present_days,
                    absent_days=absent_days,
                    overtime_hours=ot_hours,
                    wages_amount=Decimal('0')  # To be calculated by accounting module
                )

        logger.info(f"Payroll export {export_id} generated for {warehouse.name}")
        return payroll

    @staticmethod
    def _generate_export_id():
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        return f"PE-{timestamp}"


class ShiftService:
    """Handle shift assignments and management"""

    @classmethod
    def assign_shift(cls, staff, shift):
        """Assign shift to staff"""
        if not shift.is_active:
            raise ValidationError(f"Shift {shift.shift_code} is not active")

        staff.shift_assignment = shift
        staff.save()

        logger.info(f"Shift {shift.shift_code} assigned to {staff.staff_id}")
        return staff

    @classmethod
    def unassign_shift(cls, staff):
        """Remove shift assignment from staff"""
        staff.shift_assignment = None
        staff.save()

        logger.info(f"Shift unassigned from {staff.staff_id}")
        return staff
