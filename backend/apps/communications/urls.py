from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import EmailTemplateViewSet, EmailLogViewSet, RFQEmailViewSet

router = DefaultRouter()
router.register(r'templates', EmailTemplateViewSet, basename='email-template')
router.register(r'email-logs', EmailLogViewSet, basename='email-log')
router.register(r'rfq-emails', RFQEmailViewSet, basename='rfq-email')

urlpatterns = [
    path('', include(router.urls)),
]
