"""HR URL Configuration"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'staff', views.StaffViewSet, basename='staff')
router.register(r'shifts', views.ShiftDefinitionViewSet, basename='shift')
router.register(r'attendance', views.AttendanceCaptureViewSet, basename='attendance')
router.register(r'leaves', views.LeaveRequestViewSet, basename='leave')
router.register(r'overtime', views.OvertimeRequestViewSet, basename='overtime')
router.register(r'payroll', views.PayrollExportViewSet, basename='payroll')

urlpatterns = [
    path('', include(router.urls)),
]
