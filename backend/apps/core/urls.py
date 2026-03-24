"""
URL routes for core app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet, WarehouseViewSet, GodownViewSet, MachineryViewSet,
    RoleDefinitionViewSet, StakeholderUserViewSet
)

# Create a router instance
router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'godowns', GodownViewSet, basename='godown')
router.register(r'machinery', MachineryViewSet, basename='machinery')
router.register(r'roles', RoleDefinitionViewSet, basename='role-definition')
router.register(r'stakeholder-users', StakeholderUserViewSet, basename='stakeholder-user')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]
