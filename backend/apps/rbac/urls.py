from django.urls import path, include
from rest_framework.routers import DefaultRouter

from rbac.views import (
    ERPRoleViewSet,
    ERPModuleViewSet,
    ERPPermissionViewSet,
    RolePermissionViewSet,
    AuditLogViewSet,
    UserManagementViewSet,
    user_permissions_view,
)

router = DefaultRouter()
router.register(r'roles', ERPRoleViewSet, basename='erp-role')
router.register(r'modules', ERPModuleViewSet, basename='erp-module')
router.register(r'permissions', ERPPermissionViewSet, basename='erp-permission')
router.register(r'role-permissions', RolePermissionViewSet, basename='role-permission')
router.register(r'audit-logs', AuditLogViewSet, basename='rbac-audit-log')
router.register(r'users', UserManagementViewSet, basename='rbac-user')

urlpatterns = [
    path('', include(router.urls)),
    path('my-permissions/', user_permissions_view, name='my-permissions'),
]
