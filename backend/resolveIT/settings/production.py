"""
Production settings for resolveIT project (JANMITRA).

Strict security settings with environment variable driven configurations.
"""

import os
import dj_database_url
from .base import *

# Production safety: DEBUG strictly False
DEBUG = False

# Secret key must be set via environment variable
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("The SECRET_KEY environment variable must be set in production.")

# Allowed Hosts from comma-separated environment variable and Render environment
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('ALLOWED_HOSTS', '').split(',')
    if host.strip()
]
render_host = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '').strip()
if render_host and render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_host)
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['janmitra.nagpur.gov.in', 'localhost', 'backend']

# ==============================================================================
# PostGIS Spatial Database Configuration (from env vars or DATABASE_URL)
# ==============================================================================
from urllib.parse import quote_plus, urlparse, parse_qs

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    pg_user = os.environ.get('POSTGRES_USER', 'janmitra_user')
    pg_pass = os.environ.get('POSTGRES_PASSWORD', '')
    pg_host = os.environ.get('POSTGRES_HOST', 'postgres')
    pg_port = os.environ.get('POSTGRES_PORT', '5432')
    pg_db = os.environ.get('POSTGRES_DB', 'janmitra_db')
    auth = f"{quote_plus(pg_user)}:{quote_plus(pg_pass)}@" if pg_pass else f"{quote_plus(pg_user)}@"
    DATABASE_URL = f"postgis://{auth}{pg_host}:{pg_port}/{pg_db}"

# Determine SSL mode:
# 1. If explicit POSTGRES_SSL_REQUIRE is set, honor it ('true'/'false').
# 2. If 'sslmode' query parameter is present in DATABASE_URL, honor the URL parameter.
# 3. Otherwise default to True for hosted production database security.
env_ssl = os.environ.get('POSTGRES_SSL_REQUIRE')
if env_ssl is not None:
    ssl_require = env_ssl.lower() in ('true', '1', 'yes')
else:
    parsed_url = urlparse(DATABASE_URL)
    query_params = parse_qs(parsed_url.query)
    if 'sslmode' in query_params:
        ssl_require = query_params['sslmode'][0].lower() in ('require', 'verify-ca', 'verify-full')
    else:
        ssl_require = True

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        ssl_require=ssl_require,
        engine='django.contrib.gis.db.backends.postgis',
    )
}

# ==============================================================================
# CORS Configuration (Derived from CORS_ALLOWED_ORIGINS and FRONTEND_URL)
# ==============================================================================
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]

FRONTEND_URL = os.environ.get('FRONTEND_URL', '').strip()
if FRONTEND_URL and FRONTEND_URL not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(FRONTEND_URL)

# ==============================================================================
# Production Security Headers & Proxy Configuration
# ==============================================================================
# Render and Cloudflare terminate SSL at their edge reverse proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# HTTPS Enforcement & Strict Transport Security (HSTS)
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', 31536000))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'True').lower() == 'true'
# HSTS preload is disabled pending a formal domain-readiness review
SECURE_HSTS_PRELOAD = os.environ.get('SECURE_HSTS_PRELOAD', 'False').lower() == 'true'
SILENCED_SYSTEM_CHECKS = ['security.W021']  # Preload intentionally deferred pending domain review

# Cookie Security (Transmit only over HTTPS)
SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'True').lower() == 'true'
CSRF_COOKIE_SECURE = os.environ.get('CSRF_COOKIE_SECURE', 'True').lower() == 'true'

# HTTP Header Defenses
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_BROWSER_XSS_FILTER = True

# ==============================================================================
# Logging Configuration
# ==============================================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} [{name}:{lineno}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'complaints': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
