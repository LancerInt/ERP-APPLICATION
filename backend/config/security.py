"""
Security configuration for ERP system.

Consolidated security settings including CORS, CSP headers, rate limiting,
password validators, and session configuration.
"""

import os
from datetime import timedelta

# ===== CORS Configuration =====
# Cross-Origin Resource Sharing

CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000'
    ).split(',')
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'HEAD',
    'OPTIONS',
    'POST',
    'PUT',
    'PATCH',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-api-key',
]

CORS_EXPOSE_HEADERS = [
    'content-length',
    'content-range',
    'x-total-count',
    'x-page-number',
    'x-page-size',
]

CORS_PREFLIGHT_MAX_AGE = 3600

# ===== Content Security Policy (CSP) =====

CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = (
    "'self'",
    "'unsafe-inline'",  # Required for Next.js development
    "'unsafe-eval'",    # Required for some dev tools
)
CSP_STYLE_SRC = (
    "'self'",
    "'unsafe-inline'",  # Tailwind CSS requires inline styles
)
CSP_IMG_SRC = (
    "'self'",
    'data:',
    'https:',
)
CSP_FONT_SRC = (
    "'self'",
    'data:',
)
CSP_CONNECT_SRC = (
    "'self'",
    'https:',
)
CSP_FRAME_ANCESTORS = ("'none'",)
CSP_BASE_URI = ("'self'",)
CSP_FORM_ACTION = ("'self'",)

# Build CSP header string
def get_csp_header() -> str:
    """Build Content Security Policy header."""
    policies = {
        'default-src': CSP_DEFAULT_SRC,
        'script-src': CSP_SCRIPT_SRC,
        'style-src': CSP_STYLE_SRC,
        'img-src': CSP_IMG_SRC,
        'font-src': CSP_FONT_SRC,
        'connect-src': CSP_CONNECT_SRC,
        'frame-ancestors': CSP_FRAME_ANCESTORS,
        'base-uri': CSP_BASE_URI,
        'form-action': CSP_FORM_ACTION,
    }

    csp_parts = []
    for directive, sources in policies.items():
        sources_str = ' '.join(sources)
        csp_parts.append(f'{directive} {sources_str}')

    return '; '.join(csp_parts)

# ===== Security Headers =====

SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', 31536000))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'True') == 'True'
SECURE_HSTS_PRELOAD = os.getenv('SECURE_HSTS_PRELOAD', 'True') == 'True'
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False') == 'True'
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False') == 'True'
CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', 'False') == 'True'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ===== Cookie Security =====

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 1800  # 30 minutes
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_SAVE_EVERY_REQUEST = False

CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in os.getenv(
        'CSRF_TRUSTED_ORIGINS',
        'http://localhost:8000,http://127.0.0.1:8000'
    ).split(',')
]

# ===== Password Validation =====

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': int(os.getenv('PASSWORD_MIN_LENGTH', 12)),
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom password policy requirements
PASSWORD_POLICY = {
    'min_length': int(os.getenv('PASSWORD_MIN_LENGTH', 12)),
    'require_uppercase': os.getenv('PASSWORD_REQUIRE_UPPERCASE', 'True') == 'True',
    'require_lowercase': os.getenv('PASSWORD_REQUIRE_LOWERCASE', 'True') == 'True',
    'require_numbers': os.getenv('PASSWORD_REQUIRE_NUMBERS', 'True') == 'True',
    'require_special': os.getenv('PASSWORD_REQUIRE_SPECIAL', 'True') == 'True',
    'special_characters': '!@#$%^&*()_+-=[]{}|;:,.<>?',
    'expiry_days': int(os.getenv('PASSWORD_EXPIRY_DAYS', 90)),
    'history_count': int(os.getenv('PASSWORD_HISTORY_COUNT', 5)),
}

# ===== Authentication & Login =====

LOGIN_URL = '/api/auth/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/'
SESSION_TIMEOUT_SECONDS = int(os.getenv('SESSION_TIMEOUT_SECONDS', 1800))

# Login attempt limiting
MAX_LOGIN_ATTEMPTS = int(os.getenv('MAX_LOGIN_ATTEMPTS', 5))
LOGIN_ATTEMPT_TIMEOUT = int(os.getenv('LOGIN_ATTEMPT_TIMEOUT', 900))  # 15 minutes

LOGIN_SECURITY = {
    'max_attempts': MAX_LOGIN_ATTEMPTS,
    'lockout_duration': LOGIN_ATTEMPT_TIMEOUT,
    'reset_attempts_on_success': True,
    'track_ip': True,
    'track_user_agent': True,
    'require_password_change_on_first_login': True,
    'session_per_user': True,
}

# ===== Two-Factor Authentication =====

TWO_FACTOR_AUTH = {
    'enabled': os.getenv('ENABLE_2FA', 'False') == 'True',
    'enforced': os.getenv('ENFORCE_2FA', 'False') == 'True',
    'methods': ['email', 'sms', 'totp'],
    'otp_length': 6,
    'otp_timeout': 300,  # 5 minutes
    'backup_codes_count': 10,
}

# ===== Rate Limiting =====

RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'True') == 'True'

RATE_LIMITS = {
    'api_default': os.getenv('RATE_LIMIT_API', '100/hour'),
    'auth_login': os.getenv('RATE_LIMIT_AUTH', '10/hour'),
    'file_upload': os.getenv('RATE_LIMIT_FILE_UPLOAD', '5/hour'),
    'export': '20/hour',
    'search': '50/minute',
    'password_reset': '3/hour',
}

# ===== File Upload Security =====

FILE_UPLOAD_SECURITY = {
    'max_upload_size': int(os.getenv('MAX_UPLOAD_SIZE', 52428800)),  # 50 MB
    'allowed_extensions': os.getenv(
        'ALLOWED_FILE_TYPES',
        'pdf,xls,xlsx,csv,doc,docx,jpg,jpeg,png'
    ).split(','),
    'scan_uploads': os.getenv('SCAN_UPLOADS', 'True') == 'True',
    'virus_scan_enabled': os.getenv('VIRUS_SCAN_ENABLED', 'False') == 'True',
    'temp_upload_dir': '/tmp/erp_uploads',
    'cleanup_days': int(os.getenv('TEMP_FILE_CLEANUP_DAYS', 7)),
}

# ===== API Security =====

API_SECURITY = {
    'require_https': os.getenv('REQUIRE_HTTPS', 'True') == 'True',
    'api_key_required': os.getenv('API_KEY_REQUIRED', 'False') == 'True',
    'api_key_rotation_days': 90,
    'version_required': os.getenv('API_VERSION_REQUIRED', 'False') == 'True',
    'min_api_version': 'v1',
    'deprecated_api_versions': ['v0'],
}

# ===== Encryption =====

ENCRYPTION = {
    'enabled': True,
    'algorithm': 'AES-256-GCM',
    'cipher_suite': [
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
    ],
    'key_rotation_days': 90,
    'sensitive_fields': [
        'password',
        'api_key',
        'secret',
        'token',
        'credit_card',
        'bank_account',
        'ssn',
    ],
}

# ===== Session Management =====

SESSION_ENGINE = 'django_contrib_sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
SESSION_COOKIE_NAME = 'erp_sessionid'
SESSION_COOKIE_PATH = '/'
SESSION_COOKIE_DOMAIN = None
SESSION_COOKIE_SECURE = SESSION_COOKIE_SECURE
SESSION_COOKIE_HTTPONLY = SESSION_COOKIE_HTTPONLY
SESSION_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE

SESSION_SECURITY = {
    'session_timeout': SESSION_TIMEOUT_SECONDS,
    'idle_timeout': 900,  # 15 minutes
    'warn_before_timeout': 60,  # 1 minute warning
    'concurrent_sessions': 1,  # Only one session per user
    'invalidate_on_ip_change': True,
    'invalidate_on_user_agent_change': True,
    'log_sessions': True,
}

# ===== Audit Logging =====

AUDIT_LOG = {
    'enabled': os.getenv('ENABLE_AUDIT_LOG', 'True') == 'True',
    'log_changes': True,
    'log_access': True,
    'log_login': True,
    'log_errors': True,
    'log_api_calls': True,
    'retention_days': int(os.getenv('AUDIT_LOG_RETENTION_DAYS', 365)),
    'sensitive_fields': ENCRYPTION['sensitive_fields'],
}

# ===== IP Whitelisting =====

IP_WHITELIST_ENABLED = os.getenv('IP_WHITELIST_ENABLED', 'False') == 'True'
IP_WHITELIST = [
    ip.strip() for ip in os.getenv('IP_WHITELIST', '').split(',') if ip.strip()
]

IP_BLACKLIST_ENABLED = True
IP_BLACKLIST = []

# ===== Brute Force Protection =====

BRUTE_FORCE_PROTECTION = {
    'enabled': True,
    'max_attempts': MAX_LOGIN_ATTEMPTS,
    'lockout_duration': LOGIN_ATTEMPT_TIMEOUT,
    'track_by_ip': True,
    'track_by_username': True,
    'reset_on_success': True,
    'send_alert_on_lockout': True,
}

# ===== OWASP Security Headers =====

SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': f'max-age={SECURE_HSTS_SECONDS}; includeSubDomains; preload',
    'Content-Security-Policy': get_csp_header(),
}

# ===== Additional Security Middleware =====

SECURITY_MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django_cors_headers.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'csp.middleware.CSPMiddleware',
]

# ===== Token & Secret Management =====

TOKEN_SECURITY = {
    'secret_key_rotation_days': 30,
    'api_token_expiry_days': 365,
    'refresh_token_expiry_days': 30,
    'token_prefix': 'erp_',
}

# ===== DRF Security =====

REST_FRAMEWORK_SECURITY = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    },
}

# JWT Token Configuration
JWT_CONFIG = {
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': os.getenv('SECRET_KEY'),
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# ===== Security Checklist & Compliance =====

SECURITY_CHECKLIST = {
    'https_enabled': SECURE_SSL_REDIRECT,
    'csrf_protection': True,
    'xss_protection': True,
    'sql_injection_protection': True,
    'clickjacking_protection': True,
    'cors_configured': True,
    'headers_configured': True,
    'rate_limiting': RATE_LIMIT_ENABLED,
    'audit_logging': AUDIT_LOG['enabled'],
    'encryption_enabled': ENCRYPTION['enabled'],
    '2fa_available': TWO_FACTOR_AUTH['enabled'],
}

# Compliance requirements
COMPLIANCE = {
    'gdpr_compliant': True,
    'pci_dss_compliant': True,
    'hipaa_compliant': False,
    'soc2_compliant': False,
    'iso27001_compliant': False,
}
