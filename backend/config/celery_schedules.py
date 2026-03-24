"""
Celery periodic task schedules for ERP system.

Defines all scheduled background tasks and their execution frequency.
"""

from celery.schedules import crontab
from datetime import timedelta
import os

# Task schedule configuration
# Can be overridden by environment variables

CELERY_BEAT_SCHEDULE = {
    # ===== PURCHASE MANAGEMENT =====

    'check-po-overdue': {
        'task': 'apps.purchase.tasks.check_po_overdue',
        'schedule': timedelta(minutes=5),  # Every 5 minutes
        'options': {
            'queue': 'high_priority',
            'expires': 300,
            'time_limit': 60,
            'soft_time_limit': 50,
        },
        'enabled': True,
    },

    'auto-create-grn-from-po': {
        'task': 'apps.purchase.tasks.auto_create_grn_from_po',
        'schedule': timedelta(hours=1),  # Every hour
        'options': {
            'queue': 'default',
            'expires': 3600,
            'time_limit': 300,
            'soft_time_limit': 250,
        },
        'enabled': True,
    },

    # ===== INVENTORY MANAGEMENT =====

    'update-stock-valuation': {
        'task': 'apps.inventory.tasks.update_stock_valuation',
        'schedule': timedelta(hours=1),  # Every hour
        'options': {
            'queue': 'default',
            'expires': 3600,
            'time_limit': 600,
            'soft_time_limit': 550,
        },
        'enabled': True,
    },

    'stock-aging-analysis': {
        'task': 'apps.inventory.tasks.calculate_stock_aging',
        'schedule': timedelta(days=1),  # Daily at 2:00 AM
        'options': {
            'queue': 'reporting',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    'check-stock-reorder-level': {
        'task': 'apps.inventory.tasks.check_reorder_levels',
        'schedule': timedelta(hours=2),  # Every 2 hours
        'options': {
            'queue': 'default',
            'expires': 7200,
            'time_limit': 300,
            'soft_time_limit': 250,
        },
        'enabled': True,
    },

    # ===== FINANCE & ACCOUNTING =====

    'auto-match-bank-entries': {
        'task': 'apps.finance.tasks.auto_match_bank_entries',
        'schedule': timedelta(hours=1),  # Every hour
        'options': {
            'queue': 'finance',
            'expires': 3600,
            'time_limit': 600,
            'soft_time_limit': 550,
        },
        'enabled': True,
    },

    'generate-invoice-reminders': {
        'task': 'apps.finance.tasks.generate_invoice_reminders',
        'schedule': timedelta(hours=1),  # Every hour
        'options': {
            'queue': 'notifications',
            'expires': 3600,
            'time_limit': 300,
            'soft_time_limit': 250,
        },
        'enabled': True,
    },

    'process-recurring-invoices': {
        'task': 'apps.finance.tasks.process_recurring_invoices',
        'schedule': timedelta(days=1),  # Daily at 3:00 AM
        'options': {
            'queue': 'finance',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    # ===== COUNTER MANAGEMENT =====

    'counter-sample-reminder': {
        'task': 'apps.counter.tasks.send_sample_reminder',
        'schedule': timedelta(hours=1),  # Every hour
        'options': {
            'queue': 'notifications',
            'expires': 3600,
            'time_limit': 300,
            'soft_time_limit': 250,
        },
        'enabled': True,
    },

    'counter-stock-update': {
        'task': 'apps.counter.tasks.update_counter_stock',
        'schedule': timedelta(minutes=30),  # Every 30 minutes
        'options': {
            'queue': 'default',
            'expires': 1800,
            'time_limit': 300,
            'soft_time_limit': 250,
        },
        'enabled': True,
    },

    # ===== REPORTING & ANALYTICS =====

    'generate-agewise-reports': {
        'task': 'apps.reports.tasks.generate_agewise_reports',
        'schedule': crontab(hour=6, minute=0),  # Daily at 6:00 AM
        'options': {
            'queue': 'reporting',
            'expires': 86400,
            'time_limit': 3600,
            'soft_time_limit': 3500,
        },
        'enabled': True,
    },

    'generate-attendance-summary': {
        'task': 'apps.hr.tasks.generate_attendance_summary',
        'schedule': crontab(hour=18, minute=0),  # Daily at 6:00 PM
        'options': {
            'queue': 'reporting',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    'generate-sales-analysis': {
        'task': 'apps.sales.tasks.generate_sales_analysis',
        'schedule': crontab(hour=7, minute=0),  # Daily at 7:00 AM
        'options': {
            'queue': 'reporting',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    'generate-purchase-analysis': {
        'task': 'apps.purchase.tasks.generate_purchase_analysis',
        'schedule': crontab(hour=7, minute=30),  # Daily at 7:30 AM
        'options': {
            'queue': 'reporting',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    # ===== HR & PAYROLL =====

    'petty-cash-reconciliation': {
        'task': 'apps.hr.tasks.petty_cash_reconciliation',
        'schedule': crontab(day_of_week=0, hour=6, minute=0),  # Weekly Monday 6:00 AM
        'options': {
            'queue': 'finance',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    'wage-accumulation': {
        'task': 'apps.hr.tasks.wage_accumulation',
        'schedule': crontab(day_of_week=0, hour=6, minute=30),  # Weekly Monday 6:30 AM
        'options': {
            'queue': 'finance',
            'expires': 86400,
            'time_limit': 3600,
            'soft_time_limit': 3500,
        },
        'enabled': True,
    },

    'auto-generate-salary-slips': {
        'task': 'apps.hr.tasks.auto_generate_salary_slips',
        'schedule': crontab(day=1, hour=8, minute=0),  # Monthly on 1st at 8:00 AM
        'options': {
            'queue': 'finance',
            'expires': 86400,
            'time_limit': 3600,
            'soft_time_limit': 3500,
        },
        'enabled': True,
    },

    # ===== STOCK ADJUSTMENTS & RECONCILIATION =====

    'stock-adjustment-report': {
        'task': 'apps.inventory.tasks.generate_stock_adjustment_report',
        'schedule': crontab(day=1, hour=6, minute=0),  # Monthly on 1st at 6:00 AM
        'options': {
            'queue': 'reporting',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    'gst-reconciliation': {
        'task': 'apps.finance.tasks.gst_reconciliation',
        'schedule': crontab(day=1, hour=7, minute=0),  # Monthly on 1st at 7:00 AM
        'options': {
            'queue': 'finance',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    # ===== DATA CLEANUP & MAINTENANCE =====

    'cleanup-temporary-files': {
        'task': 'apps.core.tasks.cleanup_temporary_files',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
        'options': {
            'queue': 'maintenance',
            'expires': 86400,
            'time_limit': 1800,
            'soft_time_limit': 1700,
        },
        'enabled': True,
    },

    'archive-old-logs': {
        'task': 'apps.core.tasks.archive_old_logs',
        'schedule': crontab(day=1, hour=3, minute=0),  # Monthly on 1st at 3:00 AM
        'options': {
            'queue': 'maintenance',
            'expires': 86400,
            'time_limit': 3600,
            'soft_time_limit': 3500,
        },
        'enabled': True,
    },

    'vacuum-database': {
        'task': 'apps.core.tasks.vacuum_database',
        'schedule': crontab(day=1, hour=4, minute=0),  # Monthly on 1st at 4:00 AM
        'options': {
            'queue': 'maintenance',
            'expires': 86400,
            'time_limit': 3600,
            'soft_time_limit': 3500,
        },
        'enabled': True,
    },

    # ===== NOTIFICATIONS & ALERTS =====

    'send-pending-notifications': {
        'task': 'apps.notifications.tasks.send_pending_notifications',
        'schedule': timedelta(minutes=5),  # Every 5 minutes
        'options': {
            'queue': 'notifications',
            'expires': 300,
            'time_limit': 120,
            'soft_time_limit': 100,
        },
        'enabled': True,
    },

    'cleanup-old-notifications': {
        'task': 'apps.notifications.tasks.cleanup_old_notifications',
        'schedule': crontab(hour=1, minute=0),  # Daily at 1:00 AM
        'options': {
            'queue': 'maintenance',
            'expires': 86400,
            'time_limit': 600,
            'soft_time_limit': 550,
        },
        'enabled': True,
    },

    # ===== HEALTH CHECKS & MONITORING =====

    'system-health-check': {
        'task': 'apps.core.tasks.system_health_check',
        'schedule': timedelta(minutes=15),  # Every 15 minutes
        'options': {
            'queue': 'monitoring',
            'expires': 900,
            'time_limit': 60,
            'soft_time_limit': 50,
        },
        'enabled': True,
    },

    'generate-system-stats': {
        'task': 'apps.core.tasks.generate_system_statistics',
        'schedule': crontab(hour='*/1', minute=0),  # Every hour
        'options': {
            'queue': 'monitoring',
            'expires': 3600,
            'time_limit': 300,
            'soft_time_limit': 250,
        },
        'enabled': True,
    },
}

# Task queues configuration
CELERY_TASK_QUEUES = {
    'default': {
        'exchange': 'default',
        'routing_key': 'default',
        'priority': 5,
    },
    'high_priority': {
        'exchange': 'high_priority',
        'routing_key': 'high_priority',
        'priority': 10,
    },
    'low_priority': {
        'exchange': 'low_priority',
        'routing_key': 'low_priority',
        'priority': 1,
    },
    'finance': {
        'exchange': 'finance',
        'routing_key': 'finance',
        'priority': 8,
    },
    'reporting': {
        'exchange': 'reporting',
        'routing_key': 'reporting',
        'priority': 3,
    },
    'notifications': {
        'exchange': 'notifications',
        'routing_key': 'notifications',
        'priority': 7,
    },
    'maintenance': {
        'exchange': 'maintenance',
        'routing_key': 'maintenance',
        'priority': 2,
    },
    'monitoring': {
        'exchange': 'monitoring',
        'routing_key': 'monitoring',
        'priority': 6,
    },
}

# Celery configuration
CELERY_CONFIG = {
    'broker_url': os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/1'),
    'result_backend': os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/2'),
    'task_serializer': 'json',
    'accept_content': ['json'],
    'result_serializer': 'json',
    'timezone': 'UTC',
    'enable_utc': True,
    'task_track_started': True,
    'task_time_limit': 3600,  # 1 hour hard limit
    'task_soft_time_limit': 3500,  # 58.3 min soft limit
    'worker_prefetch_multiplier': 4,
    'worker_max_tasks_per_child': 1000,
    'result_expires': 3600,  # Results expire after 1 hour
    'beat_scheduler': 'django_celery_beat.schedulers:DatabaseScheduler',
}

# Function to get schedule for a task
def get_task_schedule(task_name: str) -> dict:
    """Get schedule configuration for a specific task."""
    return CELERY_BEAT_SCHEDULE.get(task_name, {})

# Function to check if task is enabled
def is_task_enabled(task_name: str) -> bool:
    """Check if a task is enabled."""
    schedule = get_task_schedule(task_name)
    return schedule.get('enabled', False)

# Function to disable/enable tasks
def set_task_enabled(task_name: str, enabled: bool) -> None:
    """Enable or disable a specific task."""
    if task_name in CELERY_BEAT_SCHEDULE:
        CELERY_BEAT_SCHEDULE[task_name]['enabled'] = enabled

# Monitor task execution
TASK_MONITORING = {
    'track_execution_time': True,
    'track_success_rate': True,
    'track_error_rate': True,
    'alert_on_failure': True,
    'alert_threshold': 3,  # Alert after 3 consecutive failures
}
