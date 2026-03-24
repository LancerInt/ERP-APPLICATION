"""Workflow API Views"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import WorkflowDefinition, WorkflowInstance, WorkflowAction
from .serializers import (
    WorkflowDefinitionSerializer, WorkflowInstanceDetailSerializer,
    WorkflowInstanceListSerializer, WorkflowActionSerializer
)
from .services import WorkflowService
from .selectors import WorkflowSelector


class WorkflowDefinitionViewSet(viewsets.ModelViewSet):
    """Workflow definition management"""
    queryset = WorkflowDefinition.objects.all()
    serializer_class = WorkflowDefinitionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = WorkflowDefinition.objects.filter(is_active=True).prefetch_related('steps')

        module = self.request.query_params.get('module')
        if module:
            queryset = queryset.filter(module=module)

        return queryset

    @action(detail=False, methods=['get'])
    def by_module(self, request):
        """Get workflows by module"""
        module = request.query_params.get('module')
        if not module:
            return Response({'error': 'module required'}, status=status.HTTP_400_BAD_REQUEST)

        workflows = WorkflowDefinition.objects.filter(module=module, is_active=True)
        serializer = self.get_serializer(workflows, many=True)
        return Response(serializer.data)


class WorkflowInstanceViewSet(viewsets.ModelViewSet):
    """Workflow instance management"""
    queryset = WorkflowInstance.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return WorkflowInstanceDetailSerializer
        return WorkflowInstanceListSerializer

    def get_queryset(self):
        queryset = WorkflowInstance.objects.select_related(
            'workflow', 'current_step', 'initiated_by'
        )

        status_filter = self.request.query_params.get('status')
        workflow_id = self.request.query_params.get('workflow_id')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        return queryset.order_by('-initiated_date')

    def create(self, request, *args, **kwargs):
        """Initiate a workflow"""
        try:
            workflow_id = request.data.get('workflow_id')
            document_id = request.data.get('document_id')
            document_type = request.data.get('document_type')

            if not all([workflow_id, document_id, document_type]):
                return Response(
                    {'error': 'workflow_id, document_id, document_type required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            workflow = WorkflowDefinition.objects.get(id=workflow_id)
            from core.models import StakeholderUser
            initiator = StakeholderUser.objects.get(user=request.user)

            instance = WorkflowService.initiate_workflow(
                workflow, document_id, document_type, initiator
            )

            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request):
        """Approve workflow step"""
        try:
            instance = self.get_object()
            from core.models import StakeholderUser
            actor = StakeholderUser.objects.get(user=request.user)
            remarks = request.data.get('remarks', '')

            instance = WorkflowService.process_action(
                instance, 'APPROVED', actor, remarks, approval=True
            )

            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request):
        """Reject workflow"""
        try:
            instance = self.get_object()
            from core.models import StakeholderUser
            actor = StakeholderUser.objects.get(user=request.user)
            remarks = request.data.get('remarks', '')

            instance = WorkflowService.process_action(
                instance, 'REJECTED', actor, remarks, approval=False
            )

            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def my_pending(self, request):
        """Get pending workflows for current user"""
        pending = WorkflowSelector.get_my_pending_approvals(request.user)
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get workflow history for document"""
        document_id = request.query_params.get('document_id')
        document_type = request.query_params.get('document_type')

        if not all([document_id, document_type]):
            return Response(
                {'error': 'document_id and document_type required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        workflows = WorkflowSelector.get_workflow_history(document_id, document_type)
        serializer = self.get_serializer(workflows, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get workflow statistics"""
        stats = WorkflowService.get_workflow_statistics()
        return Response(stats)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue workflows"""
        hours = int(request.query_params.get('hours', 24))
        from .selectors import WorkflowSelector
        overdue = WorkflowSelector.get_overdue_workflows(hours)
        serializer = self.get_serializer(overdue, many=True)
        return Response(serializer.data)


class WorkflowActionViewSet(viewsets.ReadOnlyModelViewSet):
    """Workflow action history"""
    queryset = WorkflowAction.objects.all()
    serializer_class = WorkflowActionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = WorkflowAction.objects.select_related('instance', 'actor', 'step')

        instance_id = self.request.query_params.get('instance_id')
        if instance_id:
            queryset = queryset.filter(instance_id=instance_id)

        return queryset.order_by('-action_date')
