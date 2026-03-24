"""HR API Views"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from rbac.permissions import HasModulePermission
from datetime import timedelta

from .models import (
    Staff, ShiftDefinition, AttendanceCapture, LeaveRequest, OvertimeRequest,
    PayrollExport, AttendanceDeviceLog
)
from .serializers import (
    StaffListSerializer, StaffDetailSerializer, ShiftDefinitionSerializer,
    AttendanceCaptureSerializer, LeaveRequestSerializer, OvertimeRequestSerializer,
    PayrollExportSerializer, AttendanceDeviceLogSerializer
)
from .services import (
    AttendanceService, LeaveService, OvertimeService, PayrollService, ShiftService
)
from .selectors import (
    StaffSelector, AttendanceSelector, LeaveSelector, OvertimeSelector, ShiftSelector
)


class StaffViewSet(viewsets.ModelViewSet):
    """Staff management endpoints"""
    queryset = Staff.objects.all()
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Staff'

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return StaffDetailSerializer
        return StaffListSerializer

    def get_queryset(self):
        queryset = Staff.objects.select_related(
            'company', 'primary_location', 'shift_assignment', 'hr_owner'
        )

        warehouse = self.request.query_params.get('warehouse')
        department = self.request.query_params.get('department')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if warehouse:
            queryset = queryset.filter(primary_location_id=warehouse)
        if department:
            queryset = queryset.filter(department=department)
        if status_filter:
            queryset = queryset.filter(employment_status=status_filter)
        if search:
            queryset = StaffSelector.search_staff(search, warehouse=warehouse if warehouse else None)

        return queryset.filter(is_active=True)

    @action(detail=False, methods=['get'])
    def warehouse_staff(self, request):
        """Get all staff for a warehouse"""
        warehouse_id = request.query_params.get('warehouse_id')
        if not warehouse_id:
            return Response({'error': 'warehouse_id required'}, status=status.HTTP_400_BAD_REQUEST)

        staff = StaffSelector.get_staff_for_warehouse(warehouse_id)
        serializer = self.get_serializer(staff, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def assign_shift(self, request):
        """Assign shift to staff"""
        shift_id = request.data.get('shift_id')
        if not shift_id:
            return Response({'error': 'shift_id required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            shift = ShiftDefinition.objects.get(id=shift_id)
            staff = self.get_object()
            ShiftService.assign_shift(staff, shift)
            return Response({'message': 'Shift assigned successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def unassign_shift(self, request):
        """Remove shift assignment"""
        staff = self.get_object()
        ShiftService.unassign_shift(staff)
        return Response({'message': 'Shift unassigned'})


class ShiftDefinitionViewSet(viewsets.ModelViewSet):
    """Shift definition management"""
    queryset = ShiftDefinition.objects.all()
    serializer_class = ShiftDefinitionSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Shift'

    def get_queryset(self):
        warehouse = self.request.query_params.get('warehouse')
        queryset = ShiftDefinition.objects.filter(is_active=True)

        if warehouse:
            queryset = queryset.filter(warehouse_id=warehouse)

        return queryset.select_related('warehouse')

    @action(detail=False, methods=['get'])
    def for_warehouse(self, request):
        """Get shifts for warehouse"""
        warehouse_id = request.query_params.get('warehouse_id')
        if not warehouse_id:
            return Response({'error': 'warehouse_id required'}, status=status.HTTP_400_BAD_REQUEST)

        shifts = ShiftSelector.get_shifts_for_warehouse(warehouse_id)
        serializer = self.get_serializer(shifts, many=True)
        return Response(serializer.data)


class AttendanceCaptureViewSet(viewsets.ModelViewSet):
    """Attendance capture and management"""
    queryset = AttendanceCapture.objects.all()
    serializer_class = AttendanceCaptureSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Attendance'

    def get_queryset(self):
        return AttendanceCapture.objects.select_related('staff', 'shift').order_by('-date')

    def create(self, request, *args, **kwargs):
        """Mark attendance"""
        try:
            staff_id = request.data.get('staff_id')
            staff = Staff.objects.get(id=staff_id)

            attendance = AttendanceService.mark_attendance(
                staff=staff,
                check_in_time=timezone.now(),
                entry_photo=request.FILES.get('entry_photo'),
                latitude=float(request.data.get('latitude')),
                longitude=float(request.data.get('longitude')),
                face_confidence=float(request.data.get('face_confidence')),
                device_id=request.data.get('device_id'),
                notes=request.data.get('notes', '')
            )

            serializer = self.get_serializer(attendance)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def for_period(self, request):
        """Get attendance for period"""
        staff_id = request.query_params.get('staff_id')
        days = int(request.query_params.get('days', 30))

        if not staff_id:
            return Response({'error': 'staff_id required'}, status=status.HTTP_400_BAD_REQUEST)

        staff = Staff.objects.get(id=staff_id)
        start_date = timezone.now().date() - timedelta(days=days)
        end_date = timezone.now().date()

        records = AttendanceSelector.get_attendance_for_period(staff, start_date, end_date)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get attendance summary"""
        staff_id = request.query_params.get('staff_id')
        days = int(request.query_params.get('days', 30))

        if not staff_id:
            return Response({'error': 'staff_id required'}, status=status.HTTP_400_BAD_REQUEST)

        staff = Staff.objects.get(id=staff_id)
        summary = AttendanceSelector.get_attendance_summary(staff, days)
        return Response(summary)

    @action(detail=False, methods=['get'])
    def warehouse_summary(self, request):
        """Get warehouse attendance summary"""
        warehouse_id = request.query_params.get('warehouse_id')
        date_str = request.query_params.get('date')

        if not warehouse_id:
            return Response({'error': 'warehouse_id required'}, status=status.HTTP_400_BAD_REQUEST)

        from core.models import Warehouse
        warehouse = Warehouse.objects.get(id=warehouse_id)
        attendance_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else timezone.now().date()

        records = AttendanceSelector.get_attendance_for_warehouse(warehouse, attendance_date)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """Leave request management"""
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Leave'

    def get_queryset(self):
        return LeaveRequest.objects.select_related('staff', 'approver').order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create leave request"""
        try:
            staff_id = request.data.get('staff_id')
            staff = Staff.objects.get(id=staff_id)

            leave_request = LeaveService.request_leave(
                staff=staff,
                leave_type=request.data.get('leave_type'),
                start_date=request.data.get('start_date'),
                reason=request.data.get('reason'),
                attachment=request.FILES.get('attachment'),
                end_date=request.data.get('end_date'),
                duration_hours=request.data.get('duration_hours')
            )

            serializer = self.get_serializer(leave_request)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request):
        """Approve leave request"""
        try:
            leave_request = self.get_object()
            from core.models import StakeholderUser
            approver = StakeholderUser.objects.get(user=request.user)

            LeaveService.approve_leave(leave_request, approver)
            serializer = self.get_serializer(leave_request)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request):
        """Reject leave request"""
        try:
            leave_request = self.get_object()
            from core.models import StakeholderUser
            approver = StakeholderUser.objects.get(user=request.user)

            LeaveService.reject_leave(leave_request, approver)
            serializer = self.get_serializer(leave_request)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def balance(self, request):
        """Get leave balance"""
        staff_id = request.query_params.get('staff_id')
        if not staff_id:
            return Response({'error': 'staff_id required'}, status=status.HTTP_400_BAD_REQUEST)

        staff = Staff.objects.get(id=staff_id)
        balance = LeaveSelector.get_leave_balance(staff)
        return Response(balance)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending leaves for approver"""
        from core.models import StakeholderUser
        approver = StakeholderUser.objects.get(user=request.user)
        leaves = LeaveSelector.get_pending_leave_requests(approver)
        serializer = self.get_serializer(leaves, many=True)
        return Response(serializer.data)


class OvertimeRequestViewSet(viewsets.ModelViewSet):
    """Overtime request management"""
    queryset = OvertimeRequest.objects.all()
    serializer_class = OvertimeRequestSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Overtime'

    def get_queryset(self):
        return OvertimeRequest.objects.select_related('staff', 'approved_by', 'shift').order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create overtime request"""
        try:
            staff_id = request.data.get('staff_id')
            staff = Staff.objects.get(id=staff_id)

            overtime = OvertimeService.request_overtime(
                staff=staff,
                date=request.data.get('date'),
                hours_worked=float(request.data.get('hours_worked')),
                task_description=request.data.get('task_description'),
                evidence=request.FILES.get('supporting_evidence')
            )

            serializer = self.get_serializer(overtime)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request):
        """Approve overtime"""
        try:
            overtime = self.get_object()
            from core.models import StakeholderUser
            approver = StakeholderUser.objects.get(user=request.user)

            OvertimeService.approve_overtime(overtime, approver)
            serializer = self.get_serializer(overtime)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request):
        """Reject overtime"""
        try:
            overtime = self.get_object()
            from core.models import StakeholderUser
            approver = StakeholderUser.objects.get(user=request.user)

            OvertimeService.reject_overtime(overtime, approver)
            serializer = self.get_serializer(overtime)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending overtime for approver"""
        from core.models import StakeholderUser
        approver = StakeholderUser.objects.get(user=request.user)
        overtime = OvertimeSelector.get_pending_overtime_requests(approver)
        serializer = self.get_serializer(overtime, many=True)
        return Response(serializer.data)


class PayrollExportViewSet(viewsets.ModelViewSet):
    """Payroll export management"""
    queryset = PayrollExport.objects.all()
    serializer_class = PayrollExportSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'Payroll'

    def get_queryset(self):
        return PayrollExport.objects.select_related('warehouse').prefetch_related('staff_summaries').order_by('-period_end')

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate payroll export"""
        try:
            from core.models import Warehouse
            warehouse_id = request.data.get('warehouse_id')
            period_start = request.data.get('period_start')
            period_end = request.data.get('period_end')

            if not all([warehouse_id, period_start, period_end]):
                return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

            warehouse = Warehouse.objects.get(id=warehouse_id)
            payroll = PayrollService.generate_payroll_export(warehouse, period_start, period_end)

            serializer = self.get_serializer(payroll)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
