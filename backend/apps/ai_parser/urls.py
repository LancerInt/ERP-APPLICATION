"""AI Parser URL Configuration"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'configurations', views.ParserConfigurationViewSet, basename='parser-config')
router.register(r'logs', views.ParserLogViewSet, basename='parser-log')
router.register(r'parse', views.DocumentParserViewSet, basename='document-parser')

urlpatterns = [
    path('', include(router.urls)),
]
