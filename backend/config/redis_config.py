"""
Redis cache configuration for ERP system.

Defines cache keys, timeouts, and usage patterns for various components.
"""

import os
from datetime import timedelta

# Redis connection settings
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')
REDIS_URL = os.getenv('REDIS_URL', f'redis://{REDIS_HOST}:{REDIS_PORT}/0')

# Cache configuration
CACHE_CONFIG = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 50,
                'retry_on_timeout': True,
            },
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'COMPRESSOR': 'django_redis.compressors.zlib.ZlibCompressor',
            'IGNORE_EXCEPTIONS': True,
            'PARSER_CLASS': 'redis.connection.HiredisParser',
        },
        'KEY_PREFIX': 'erp',
        'TIMEOUT': 300,  # 5 minutes default
    }
}

# Cache timeout values (in seconds)
CACHE_TIMEOUTS = {
    'stock_balance': 300,  # 5 minutes - frequently changing
    'product_master': 3600,  # 1 hour - master data
    'vendor_master': 3600,  # 1 hour
    'customer_master': 3600,  # 1 hour
    'user_permissions': 1800,  # 30 minutes
    'system_settings': 86400,  # 24 hours
    'company_info': 86400,  # 24 hours
    'warehouse_data': 1800,  # 30 minutes
    'exchange_rates': 3600,  # 1 hour
    'tax_rates': 86400,  # 24 hours
    'report_data': 1800,  # 30 minutes
    'menu_structure': 86400,  # 24 hours
    'api_rate_limit': 60,  # 1 minute
    'session': 1800,  # 30 minutes
    'otp': 600,  # 10 minutes
    'password_reset': 1800,  # 30 minutes
}

# Cache key patterns
CACHE_KEYS = {
    'stock_balance': 'stock:balance:{warehouse_id}:{product_id}',
    'stock_valuation': 'stock:valuation:{warehouse_id}:{product_id}',
    'stock_aging': 'stock:aging:{warehouse_id}',
    'product': 'product:{product_id}',
    'product_list': 'product:list:{category_id}',
    'vendor': 'vendor:{vendor_id}',
    'vendor_list': 'vendor:list:active',
    'customer': 'customer:{customer_id}',
    'customer_list': 'customer:list:active',
    'customer_credit': 'customer:credit:{customer_id}',
    'user_permissions': 'user:permissions:{user_id}',
    'user_profile': 'user:profile:{user_id}',
    'company_settings': 'company:settings:{company_id}',
    'warehouse_godowns': 'warehouse:godowns:{warehouse_id}',
    'po_header': 'po:header:{po_id}',
    'pr_header': 'pr:header:{pr_id}',
    'grn_header': 'grn:header:{grn_id}',
    'sales_order': 'sales:order:{order_id}',
    'invoice': 'invoice:{invoice_id}',
    'receipt': 'receipt:{receipt_id}',
    'payment': 'payment:{payment_id}',
    'bank_balance': 'bank:balance:{account_id}',
    'bank_reconciliation': 'bank:reconciliation:{account_id}',
    'currency_rate': 'currency:rate:{from_currency}:{to_currency}',
    'exchange_rates': 'exchange:rates:all',
    'tax_rate': 'tax:rate:{tax_rate_id}',
    'tax_list': 'tax:list:active',
    'hsn_code': 'hsn:code:{hsn_code}',
    'menu_structure': 'menu:structure:{user_id}',
    'report_data': 'report:{report_type}:{filter_hash}',
    'dashboard_data': 'dashboard:{user_id}:{date}',
    'api_rate_limit': 'api:rate_limit:{user_id}:{endpoint}',
    'session_cache': 'session:{session_id}',
    'otp': 'otp:{user_id}',
    'password_reset': 'password_reset:{token}',
}

# Cache invalidation patterns
CACHE_INVALIDATION = {
    'stock_changed': [
        'stock:balance:*',
        'stock:valuation:*',
        'stock:aging:*',
    ],
    'product_changed': [
        'product:*',
        'stock:*',
        'report:*',
    ],
    'vendor_changed': [
        'vendor:*',
        'po:*',
    ],
    'customer_changed': [
        'customer:*',
        'sales:*',
        'invoice:*',
    ],
    'user_changed': [
        'user:permissions:*',
        'user:profile:*',
        'menu:*',
        'dashboard:*',
    ],
    'document_created': [
        'report:*',
        'dashboard:*',
    ],
}

# Redis database selection
REDIS_DATABASES = {
    'cache': 0,  # Default cache
    'celery_broker': 1,  # Celery task queue
    'celery_result': 2,  # Celery result backend
    'sessions': 3,  # Session storage
    'rate_limiting': 4,  # Rate limiting
    'locks': 5,  # Distributed locks
    'temporary': 6,  # Temporary data
}

# Rate limiting configuration
RATE_LIMIT_CONFIG = {
    'api_default': {
        'rate': '100/hour',
        'key_func': lambda request: request.user.id or request.META.get('REMOTE_ADDR'),
    },
    'auth_login': {
        'rate': '10/hour',
        'key_func': lambda request: request.POST.get('username', request.META.get('REMOTE_ADDR')),
    },
    'file_upload': {
        'rate': '5/hour',
        'key_func': lambda request: request.user.id or request.META.get('REMOTE_ADDR'),
    },
    'export': {
        'rate': '20/hour',
        'key_func': lambda request: request.user.id or request.META.get('REMOTE_ADDR'),
    },
    'search': {
        'rate': '50/minute',
        'key_func': lambda request: request.user.id or request.META.get('REMOTE_ADDR'),
    },
}

# Session cache backend configuration
SESSION_CACHE_BACKEND = 'django_redis.cache.RedisCache'
SESSION_CACHE_LOCATION = REDIS_URL
SESSION_CACHE_KEY_PREFIX = 'session'

# Cache warming configuration (data to pre-load on startup)
CACHE_WARMING = {
    'enabled': True,
    'data_to_warm': [
        'tax_rates',
        'company_settings',
        'system_settings',
        'exchange_rates',
    ],
    'schedule': 'daily',  # daily, weekly, monthly
    'time': '00:30',  # Time to run (HH:MM)
}

# Cache statistics and monitoring
CACHE_MONITORING = {
    'enabled': True,
    'track_hits': True,
    'track_misses': True,
    'track_evictions': True,
    'stats_key': 'cache:stats',
    'stats_retention': 86400,  # 24 hours
}

# Redis persistence configuration for production
REDIS_PERSISTENCE = {
    'aof_enabled': True,  # Append-only file
    'rdb_enabled': True,  # RDB snapshots
    'rdb_save_rules': [
        '900 1',  # Save if 1 key changed in 900 sec
        '300 10',  # Save if 10 keys changed in 300 sec
        '60 10000',  # Save if 10000 keys changed in 60 sec
    ],
}

# Cache key expiration settings
CACHE_EXPIRATION_POLICIES = {
    'stock_data': {
        'ttl': 300,
        'grace_period': 60,  # Extended TTL before final expiration
        'refresh_threshold': 240,  # Refresh if less than this time remains
    },
    'master_data': {
        'ttl': 3600,
        'grace_period': 300,
        'refresh_threshold': 3000,
    },
    'reports': {
        'ttl': 1800,
        'grace_period': 300,
        'refresh_threshold': 1500,
    },
}

# Connection pool settings for high-traffic scenarios
CONNECTION_POOL_SETTINGS = {
    'max_connections': 50,
    'socket_connect_timeout': 5,
    'socket_timeout': 5,
    'retry_on_timeout': True,
    'health_check_interval': 30,
}

# Utility functions for cache management
def get_cache_key(key_pattern: str, **kwargs) -> str:
    """Generate a cache key from pattern."""
    try:
        return key_pattern.format(**kwargs)
    except KeyError as e:
        raise ValueError(f"Missing required parameter for cache key: {e}")

def get_cache_timeout(key_type: str) -> int:
    """Get timeout for a cache key type."""
    return CACHE_TIMEOUTS.get(key_type, 300)

def get_redis_db(connection_type: str) -> int:
    """Get Redis database number for connection type."""
    return REDIS_DATABASES.get(connection_type, 0)

def should_cache(key_type: str) -> bool:
    """Determine if caching should be used for a key type."""
    return key_type in CACHE_TIMEOUTS

# Cache invalidation helper
def get_invalidation_patterns(change_type: str) -> list:
    """Get cache invalidation patterns for a change type."""
    return CACHE_INVALIDATION.get(change_type, [])
