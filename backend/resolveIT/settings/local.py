"""
Local development settings for resolveIT project (JANMITRA).

Configured for Dockerized development with PostGIS and Redis.
"""

import os
from .base import *

# Development mode enabled
DEBUG = True

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'backend',
    '*',
]

import sys

# ==============================================================================
# Database Configuration (PostGIS for Docker/dev, SQLite fallback for test runner/offline)
# ==============================================================================
postgres_host = os.environ.get('POSTGRES_HOST')
if not postgres_host:
    import socket
    try:
        with socket.create_connection(('127.0.0.1', 5432), timeout=0.3):
            postgres_host = '127.0.0.1'
    except OSError:
        postgres_host = None

use_sqlite = (
    os.environ.get('USE_SQLITE_FOR_TESTS', '').lower() == 'true' or
    ('test' in sys.argv and not os.environ.get('POSTGRES_HOST')) or
    (not postgres_host)
)

if use_sqlite:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
    import django.db.backends.sqlite3.base as sqlite_base
    sqlite_base.DatabaseOperations.geo_db_type = lambda self, field: 'TEXT'
    sqlite_base.DatabaseOperations.get_geom_placeholder = lambda self, f, val, compiler: '%s'
    sqlite_base.DatabaseOperations.Adapter = lambda self, val, geography=False: str(val.ewkt if hasattr(val, 'ewkt') else val)
    sqlite_base.DatabaseOperations.select = '%s'
    sqlite_base.DatabaseFeatures.supports_geography = False
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': os.environ.get('POSTGRES_DB', 'janmitra_db'),
            'USER': os.environ.get('POSTGRES_USER', 'janmitra_user'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'janmitra_secure_password_2024'),
            'HOST': postgres_host or 'postgres',
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': 60,
        }
    }

# Enable eager Celery execution strictly during test runs so local development is unaffected
if 'test' in sys.argv:
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True


# ==============================================================================
# CORS Configuration (Permissive in local development, env-driven origins supported)
# ==============================================================================
CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL_ORIGINS', 'True').lower() == 'true'
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:[0-9]+$",
    r"^http://127\.0\.0\.1:[0-9]+$",
]

# ==============================================================================
# Email Backend for Development (Outputs to console)
# ==============================================================================
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Debugging aids
INTERNAL_IPS = [
    '127.0.0.1',
]
