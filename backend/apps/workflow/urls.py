"""Workflow URL Configuration"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'definitions', views.WorkflowDefinitionViewSet, basename='workflow-definition')
router.register(r'instances', views.WorkflowInstanceViewSet, basename='workflow-instance')
router.register(r'actions', views.WorkflowActionViewSet, basename='workflow-action')

urlpatterns = [
    path('', include(router.urls)),
]
