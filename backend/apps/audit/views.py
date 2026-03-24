"""Audit API Views"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import SystemParameter, DecisionLog, AuditTrail
from .serializers import SystemParameterSerializer, DecisionLogSerializer, AuditTrailSerializer
from .services import SystemParameterService, DecisionLogService
from .selectors import AuditSelector, DecisionLogSelector, SystemParameterSelector


class SystemParameterViewSet(viewsets.ModelViewSet):
    """System parameter management"""
    queryset = SystemParameter.objects.all()
    serializer_class = SystemParameterSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = SystemParameter.objects.all()

        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(module_scope=module)

        return queryset.order_by('parameter_name')

    @action(detail=False, methods=['get'])
    def by_module(self, request):
        """Get parameters by module"""
        module = request.query_params.get('module')
        if not module:
            return Response({'error': 'module required'}, status=status.HTTP_400_BAD_REQUEST)

        params = SystemParameterSelector.get_parameters_by_module(module)
        serializer = self.get_serializer(params, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def value(self, request):
        """Get parameter value"""
        param_name = request.query_params.get('name')
        if not param_name:
            return Response({'error': 'name required'}, status=status.HTTP_400_BAD_REQUEST)

        value = SystemParameterService.get_system_parameter(param_name)
        return Response({'value': value})

    @action(detail=False, methods=['post'])
    def set_parameter(self, request):
        """Set parameter value"""
        try:
            from core.models import StakeholderUser
            user = StakeholderUser.objects.get(user=request.user)

            param = SystemParameterService.set_system_parameter(
                parameter_name=request.data.get('parameter_name'),
                parameter_value=request.data.get('parameter_value'),
                module_scope=request.data.get('module_scope'),
                user=user,
                description=request.data.get('description', '')
            )

            serializer = self.get_serializer(param)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AuditTrailViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit trail viewing"""
    queryset = AuditTrail.objects.all()
    serializer_class = AuditTrailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AuditTrail.objects.select_related('user').order_by('-timestamp')

        module = self.request.query_params.get('module')
        record_id = self.request.query_params.get('record_id')
        action = self.request.query_params.get('action')

        if module:
            queryset = queryset.filter(module=module)
        if record_id:
            queryset = queryset.filter(record_id=str(record_id))
        if action:
            queryset = queryset.filter(action=action)

        return queryset

    @action(detail=False, methods=['get'])
    def for_record(self, request):
        """Get audit trail for specific record"""
        module = request.query_params.get('module')
        record_id = request.query_params.get('record_id')

        if not all([module, record_id]):
            return Response(
                {'error': 'module and record_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        audits = AuditSelector.get_audit_trail(module, record_id)
        serializer = self.get_serializer(audits, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_user(self, request):
        """Get audits by user"""
        days = int(request.query_params.get('days', 30))
        from core.models import StakeholderUser
        user = StakeholderUser.objects.get(user=request.user)

        audits = AuditSelector.get_audit_by_user(user, days)
        serializer = self.get_serializer(audits, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_action(self, request):
        """Get audits by action type"""
        action_type = request.query_params.get('action')
        if not action_type:
            return Response({'error': 'action required'}, status=status.HTTP_400_BAD_REQUEST)

        days = int(request.query_params.get('days', 30))
        audits = AuditSelector.get_audit_by_action(action_type, days=days)
        serializer = self.get_serializer(audits, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_module(self, request):
        """Get audits by module"""
        module = request.query_params.get('module')
        if not module:
            return Response({'error': 'module required'}, status=status.HTTP_400_BAD_REQUEST)

        days = int(request.query_params.get('days', 30))
        audits = AuditSelector.get_audit_by_module(module, days)
        serializer = self.get_serializer(audits, many=True)
        return Response(serializer.data)


class DecisionLogViewSet(viewsets.ModelViewSet):
    """Decision and policy logs"""
    queryset = DecisionLog.objects.all()
    serializer_class = DecisionLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DecisionLog.objects.prefetch_related('stakeholders').order_by('-decision_date')

    def create(self, request, *args, **kwargs):
        """Create decision log"""
        try:
            stakeholder_ids = request.data.get('stakeholder_ids', [])
            from core.models import StakeholderUser
            stakeholders = StakeholderUser.objects.filter(id__in=stakeholder_ids)

            decision = DecisionLogService.log_decision(
                topic=request.data.get('topic'),
                decision_details=request.data.get('decision_details'),
                stakeholders=stakeholders,
                follow_up_actions=request.data.get('follow_up_actions', '')
            )

            serializer = self.get_serializer(decision)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def by_topic(self, request):
        """Get decisions by topic"""
        topic = request.query_params.get('topic')
        if not topic:
            return Response({'error': 'topic required'}, status=status.HTTP_400_BAD_REQUEST)

        decisions = DecisionLogSelector.get_decisions_by_topic(topic)
        serializer = self.get_serializer(decisions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """Get recent decisions"""
        days = int(request.query_params.get('days', 30))
        decisions = DecisionLogSelector.get_recent_decisions(days)
        serializer = self.get_serializer(decisions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_actions(self, request):
        """Get decisions with pending actions"""
        decisions = DecisionLogSelector.get_decisions_with_pending_actions()
        serializer = self.get_serializer(decisions, many=True)
        return Response(serializer.data)
