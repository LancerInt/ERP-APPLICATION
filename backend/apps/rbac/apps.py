from django.apps import AppConfig


class RbacConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'rbac'
    verbose_name = 'Role-Based Access Control'

    def ready(self):
        import rbac.signals  # noqa: F401
