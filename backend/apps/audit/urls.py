"""Audit URL Configuration"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'parameters', views.SystemParameterViewSet, basename='parameter')
router.register(r'trails', views.AuditTrailViewSet, basename='audit-trail')
router.register(r'decisions', views.DecisionLogViewSet, basename='decision')

urlpatterns = [
    path('', include(router.urls)),
]
