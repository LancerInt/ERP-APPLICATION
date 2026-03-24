"""HR Query Selectors - Read-only data access layer"""
from django.db.models import Q, Count, Sum, Avg
from django.utils import timezone
from datetime import timedelta

from .models import (
    Staff, AttendanceCapture, LeaveRequest, OvertimeRequest,
    ShiftDefinition, StaffBankAccount, StaffIDProof
)


class StaffSelector:
    """Staff queries"""

    @staticmethod
    def get_staff_for_warehouse(warehouse, status='ACTIVE'):
        """Get all active staff for a warehouse"""
        queryset = Staff.objects.filter(
            primary_location=warehouse,
            is_active=True
        )

        if status:
            queryset = queryset.filter(employment_status=status)

        return queryset.select_related(
            'company', 'primary_location', 'shift_assignment', 'hr_owner'
        )

    @staticmethod
    def get_staff_by_department(warehouse, department):
        """Get staff by department"""
        return Staff.objects.filter(
            primary_location=warehouse,
            department=department,
            is_active=True
        ).select_related('company', 'primary_location', 'shift_assignment')

    @staticmethod
    def get_staff_by_designation(warehouse, designation):
        """Get staff by designation"""
        return Staff.objects.filter(
            primary_location=warehouse,
            designation=designation,
            is_active=True
        ).select_related('company', 'primary_location')

    @staticmethod
    def get_contractors(warehouse):
        """Get contractor staff"""
        return Staff.objects.filter(
            primary_location=warehouse,
            contractor_flag=True,
            is_active=True
        ).select_related('contractor_vendor')

    @staticmethod
    def get_staff_by_hr_owner(hr_owner):
        """Get staff managed by specific HR owner"""
        return Staff.objects.filter(
            hr_owner=hr_owner,
            is_active=True
        ).select_related('company', 'primary_location')

    @staticmethod
    def get_staff_with_bank_account(warehouse):
        """Get staff with bank account details"""
        return Staff.objects.filter(
            primary_location=warehouse,
            is_active=True,
            bank_account__isnull=False
        ).select_related('bank_account')

    @staticmethod
    def get_staff_requiring_id_proofs(warehouse, document_type=None):
        """Get staff missing required ID proofs"""
        queryset = Staff.objects.filter(
            primary_location=warehouse,
            is_active=True
        )

        if document_type:
            queryset = queryset.annotate(
                has_doc=Count('id_proofs', filter=Q(id_proofs__document_type=document_type))
            ).filter(has_doc=0)

        return queryset

    @staticmethod
    def search_staff(query, warehouse=None):
        """Search staff by name or ID"""
        queryset = Staff.objects.filter(
            Q(staff_id__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(contact_number__icontains=query),
            is_active=True
        )

        if warehouse:
            queryset = queryset.filter(primary_location=warehouse)

        return queryset.select_related('company', 'primary_location')


class AttendanceSelector:
    """Attendance queries"""

    @staticmethod
    def get_attendance_for_period(staff, start_date, end_date):
        """Get attendance records for a period"""
        return AttendanceCapture.objects.filter(
            staff=staff,
            date__range=[start_date, end_date]
        ).order_by('-date')

    @staticmethod
    def get_attendance_for_warehouse(warehouse, date):
        """Get all attendance for warehouse on a date"""
        return AttendanceCapture.objects.filter(
            staff__primary_location=warehouse,
            date=date
        ).select_related('staff', 'shift')

    @staticmethod
    def get_attendance_summary(staff, period_days=30):
        """Get attendance summary for period"""
        start_date = timezone.now().date() - timedelta(days=period_days)
        end_date = timezone.now().date()

        records = AttendanceCapture.objects.filter(
            staff=staff,
            date__range=[start_date, end_date]
        )

        return {
            'total_days': (end_date - start_date).days + 1,
            'present': records.filter(attendance_status='PRESENT').count(),
            'absent': records.filter(attendance_status='ABSENT').count(),
            'half_day': records.filter(attendance_status='HALF_DAY').count(),
            'permission': records.filter(attendance_status='PERMISSION').count(),
            'avg_check_in': records.aggregate(Avg('check_in_time'))['check_in_time__avg'],
            'total_overtime': records.aggregate(Sum('overtime_hours'))['overtime_hours__sum'] or 0,
        }

    @staticmethod
    def get_staff_absent_on_date(warehouse, date):
        """Get staff absent on specific date"""
        all_staff = Staff.objects.filter(
            primary_location=warehouse,
            employment_status='ACTIVE',
            is_active=True
        ).values_list('id', flat=True)

        attended = AttendanceCapture.objects.filter(
            staff__primary_location=warehouse,
            date=date,
            attendance_status__in=['PRESENT', 'HALF_DAY', 'PERMISSION']
        ).values_list('staff_id', flat=True)

        absent_staff_ids = set(all_staff) - set(attended)
        return Staff.objects.filter(id__in=absent_staff_ids)

    @staticmethod
    def get_face_match_failures(warehouse, days=7):
        """Get attendance records with low face confidence"""
        start_date = timezone.now().date() - timedelta(days=days)
        return AttendanceCapture.objects.filter(
            staff__primary_location=warehouse,
            date__gte=start_date,
            face_match_confidence__lt=0.8
        ).select_related('staff')

    @staticmethod
    def get_device_logs(device_id, hours=24):
        """Get device sync logs"""
        from .models import AttendanceDeviceLog
        start_time = timezone.now() - timedelta(hours=hours)
        return AttendanceDeviceLog.objects.filter(
            device_id=device_id,
            event_time__gte=start_time
        ).order_by('-event_time')

    @staticmethod
    def get_device_failures(warehouse, days=7):
        """Get device failure logs"""
        from .models import AttendanceDeviceLog
        start_time = timezone.now() - timedelta(days=days)
        return AttendanceDeviceLog.objects.filter(
            status='FAILED',
            event_time__gte=start_time
        ).order_by('-event_time')


class LeaveSelector:
    """Leave request queries"""

    @staticmethod
    def get_leave_balance(staff):
        """Get leave balance for staff"""
        approved_leaves = LeaveRequest.objects.filter(
            staff=staff,
            status='APPROVED'
        ).aggregate(total=Sum('duration_hours'))['total'] or 0

        return {
            'total_approved_days': approved_leaves,
            'balance': 20 - approved_leaves,  # Placeholder: 20 days annual
        }

    @staticmethod
    def get_pending_leave_requests(approver):
        """Get pending leave requests for approver"""
        return LeaveRequest.objects.filter(
            staff__hr_owner=approver,
            status='PENDING'
        ).select_related('staff').order_by('-created_at')

    @staticmethod
    def get_staff_leave_history(staff, days=90):
        """Get leave request history"""
        start_date = timezone.now().date() - timedelta(days=days)
        return LeaveRequest.objects.filter(
            staff=staff,
            start_date__gte=start_date
        ).order_by('-created_at')

    @staticmethod
    def get_leave_requests_for_period(warehouse, start_date, end_date):
        """Get approved leaves for warehouse in period"""
        return LeaveRequest.objects.filter(
            staff__primary_location=warehouse,
            status='APPROVED',
            start_date__lte=end_date,
            end_date__gte=start_date
        ).select_related('staff')

    @staticmethod
    def check_leave_conflict(staff, start_date, end_date):
        """Check if leave dates conflict with existing approvals"""
        return LeaveRequest.objects.filter(
            staff=staff,
            status='APPROVED',
            start_date__lte=end_date,
            end_date__gte=start_date
        ).exists()

    @staticmethod
    def get_leaves_by_type(warehouse, leave_type, period_days=30):
        """Get approved leaves by type for period"""
        start_date = timezone.now().date() - timedelta(days=period_days)
        return LeaveRequest.objects.filter(
            staff__primary_location=warehouse,
            leave_type=leave_type,
            status='APPROVED',
            start_date__gte=start_date
        ).select_related('staff')


class OvertimeSelector:
    """Overtime request queries"""

    @staticmethod
    def get_pending_overtime_requests(approver):
        """Get pending overtime for approver"""
        return OvertimeRequest.objects.filter(
            staff__hr_owner=approver,
            approval_status='PENDING'
        ).select_related('staff', 'shift').order_by('-created_at')

    @staticmethod
    def get_staff_overtime_summary(staff, period_days=30):
        """Get overtime summary for staff"""
        start_date = timezone.now().date() - timedelta(days=period_days)
        records = OvertimeRequest.objects.filter(
            staff=staff,
            date__gte=start_date
        )

        return {
            'pending_hours': records.filter(approval_status='PENDING').aggregate(
                Sum('hours_worked'))['hours_worked__sum'] or 0,
            'approved_hours': records.filter(approval_status='APPROVED').aggregate(
                Sum('hours_worked'))['hours_worked__sum'] or 0,
            'rejected_count': records.filter(approval_status='REJECTED').count(),
            'total_requests': records.count(),
        }

    @staticmethod
    def get_warehouse_overtime(warehouse, period_days=30):
        """Get overtime for warehouse"""
        start_date = timezone.now().date() - timedelta(days=period_days)
        return OvertimeRequest.objects.filter(
            staff__primary_location=warehouse,
            date__gte=start_date
        ).select_related('staff').order_by('-date')

    @staticmethod
    def get_overtime_by_status(staff, approval_status):
        """Get overtime by approval status"""
        return OvertimeRequest.objects.filter(
            staff=staff,
            approval_status=approval_status
        ).order_by('-created_at')


class ShiftSelector:
    """Shift definition queries"""

    @staticmethod
    def get_shifts_for_warehouse(warehouse):
        """Get all shifts for warehouse"""
        return ShiftDefinition.objects.filter(
            warehouse=warehouse,
            is_active=True
        ).order_by('start_time')

    @staticmethod
    def get_shift_staff(shift):
        """Get all staff on shift"""
        return Staff.objects.filter(
            shift_assignment=shift,
            is_active=True
        ).select_related('company', 'primary_location')

    @staticmethod
    def get_shifts_requiring_approval(warehouse):
        """Get shifts that require approval"""
        return ShiftDefinition.objects.filter(
            warehouse=warehouse,
            approval_required=True,
            is_active=True
        )

    @staticmethod
    def get_overtime_eligible_shifts(warehouse):
        """Get shifts with overtime eligibility"""
        return ShiftDefinition.objects.filter(
            warehouse=warehouse,
            overtime_eligibility=True,
            is_active=True
        )
