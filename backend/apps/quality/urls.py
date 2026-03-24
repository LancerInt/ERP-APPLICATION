"""URL routing for quality app."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    QCParameterLibraryViewSet, QCRequestViewSet, SelectedParameterViewSet,
    QCLabJobViewSet, AssignedParameterViewSet, QCFinalReportViewSet,
    CounterSampleRegisterViewSet
)

router = DefaultRouter()
router.register(r'parameters', QCParameterLibraryViewSet, basename='parameter')
router.register(r'requests', QCRequestViewSet, basename='qc-request')
router.register(r'selected-parameters', SelectedParameterViewSet, basename='selected-parameter')
router.register(r'lab-jobs', QCLabJobViewSet, basename='lab-job')
router.register(r'assigned-parameters', AssignedParameterViewSet, basename='assigned-parameter')
router.register(r'final-reports', QCFinalReportViewSet, basename='final-report')
router.register(r'counter-samples', CounterSampleRegisterViewSet, basename='counter-sample')

app_name = 'quality'

urlpatterns = [
    path('', include(router.urls)),
]
