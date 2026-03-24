import os
from celery import Celery
from celery.schedules import crontab
from django.conf import settings

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('erp_project')

# Load configuration from Django settings with CELERY namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all apps
app.autodiscover_tasks()

# Timezone
app.conf.timezone = 'UTC'

# Task routing
app.conf.task_routes = {
    'core.tasks.*': {'queue': 'default'},
    'purchase.tasks.*': {'queue': 'purchase'},
    'sales.tasks.*': {'queue': 'sales'},
    'inventory.tasks.*': {'queue': 'inventory'},
    'finance.tasks.*': {'queue': 'finance'},
    'production.tasks.*': {'queue': 'production'},
    'quality.tasks.*': {'queue': 'quality'},
    'hr.tasks.*': {'queue': 'hr'},
    'workflow.tasks.*': {'queue': 'workflow'},
    'audit.tasks.*': {'queue': 'audit'},
    'ai_parser.tasks.*': {'queue': 'ai'},
}

# Periodic Tasks
app.conf.beat_schedule = {
    # Common tasks
    'cleanup-expired-tokens': {
        'task': 'common.tasks.cleanup_expired_tokens',
        'schedule': crontab(minute=0, hour='*/1'),  # Every hour
    },
    # Inventory tasks
    'sync-inventory-cache': {
        'task': 'inventory.tasks.sync_inventory_cache',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'calculate-inventory-aging': {
        'task': 'inventory.tasks.calculate_inventory_aging',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    },
    # Finance tasks
    'generate-daily-summary': {
        'task': 'finance.tasks.generate_daily_summary',
        'schedule': crontab(hour=1, minute=0),  # Daily at 1 AM
    },
    'reconcile-accounts': {
        'task': 'finance.tasks.reconcile_accounts',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
    },
    # Production tasks
    'check-production-status': {
        'task': 'production.tasks.check_production_status',
        'schedule': crontab(minute='*/30'),  # Every 30 minutes
    },
    # Quality tasks
    'generate-quality-report': {
        'task': 'quality.tasks.generate_quality_report',
        'schedule': crontab(hour=4, minute=0),  # Daily at 4 AM
    },
    # HR tasks
    'process-attendance': {
        'task': 'hr.tasks.process_attendance',
        'schedule': crontab(hour=23, minute=59),  # Daily at 11:59 PM
    },
    # Workflow tasks
    'check-pending-approvals': {
        'task': 'workflow.tasks.check_pending_approvals',
        'schedule': crontab(minute='*/10'),  # Every 10 minutes
    },
    'process-auto-approvals': {
        'task': 'workflow.tasks.process_auto_approvals',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
    # Audit tasks
    'archive-old-logs': {
        'task': 'audit.tasks.archive_old_logs',
        'schedule': crontab(day_of_week=0, hour=0, minute=0),  # Weekly on Sunday at 00:00
    },
}

# Task result backend configuration
app.conf.result_backend_transport_options = {
    'retry_on_timeout': True,
    'max_retries': 3,
}

# Task execution configuration
app.conf.task_acks_late = True
app.conf.task_reject_on_worker_lost = True
app.conf.worker_prefetch_multiplier = 4
app.conf.worker_max_tasks_per_child = 1000

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
