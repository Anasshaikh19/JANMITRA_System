"""
Base settings for resolveIT project (JANMITRA - Nagpur Municipal Corporation).

These settings are shared across all environments (local, testing, production).
"""

import os
from datetime import timedelta
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# BASE_DIR points to backend/ directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Windows GDAL / GEOS auto-detection (from installed osgeo package)
if os.name == 'nt':
    try:
        import osgeo
        osgeo_dir = os.path.dirname(osgeo.__file__)
        if hasattr(os, 'add_dll_directory'):
            os.add_dll_directory(osgeo_dir)
        os.environ['PATH'] = osgeo_dir + ';' + os.environ.get('PATH', '')
        gdal_dll = os.path.join(osgeo_dir, 'gdal.dll')
        geos_dll = os.path.join(osgeo_dir, 'geos_c.dll')
        if os.path.exists(gdal_dll):
            GDAL_LIBRARY_PATH = gdal_dll
        if os.path.exists(geos_dll):
            GEOS_LIBRARY_PATH = geos_dll
        proj_data = os.path.join(osgeo_dir, 'data', 'proj')
        if os.path.exists(proj_data):
            os.environ['PROJ_LIB'] = proj_data
    except ImportError:
        pass

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure-change-this-in-production-janmitra-nmc-nagpur-2024'
)

# Check if GDAL is available on this system
HAS_GDAL = False
try:
    from django.contrib.gis.gdal.libgdal import lib_name
    HAS_GDAL = bool(lib_name)
except Exception:
    HAS_GDAL = False

if not HAS_GDAL:
    import sys, types
    from django.db import models as dj_models

    class MockPointField(dj_models.CharField):
        description = "Mock Point Field for non-GDAL environments"
        def __init__(self, *args, **kwargs):
            kwargs.pop('srid', None)
            kwargs.pop('geography', None)
            kwargs.pop('spatial_index', None)
            kwargs.setdefault('max_length', 255)
            kwargs.setdefault('default', '')
            super().__init__(*args, **kwargs)
        def deconstruct(self):
            name, path, args, kwargs = super().deconstruct()
            return name, path, args, kwargs

    gis_db_mod = types.ModuleType('django.contrib.gis.db')
    gis_models_mod = types.ModuleType('django.contrib.gis.db.models')
    for attr in dir(dj_models):
        setattr(gis_models_mod, attr, getattr(dj_models, attr))

    gis_fields_mod = types.ModuleType('django.contrib.gis.db.models.fields')
    gis_fields_mod.PointField = MockPointField
    gis_fields_mod.GeometryField = MockPointField
    gis_models_mod.PointField = MockPointField
    gis_models_mod.GeometryField = MockPointField
    gis_models_mod.fields = gis_fields_mod
    gis_db_mod.models = gis_models_mod

    sys.modules['django.contrib.gis.db'] = gis_db_mod
    sys.modules['django.contrib.gis.db.models'] = gis_models_mod
    sys.modules['django.contrib.gis.db.models.fields'] = gis_fields_mod
    try:
        import django.contrib.gis as gis_pkg
        gis_pkg.db = gis_db_mod
    except Exception:
        pass

# Application definition
INSTALLED_APPS = [
    # Django Built-in Apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

if HAS_GDAL:
    INSTALLED_APPS.append('django.contrib.gis')

INSTALLED_APPS.extend([
    # Third-Party Apps
    'rest_framework',
])

if HAS_GDAL:
    INSTALLED_APPS.append('rest_framework_gis')

INSTALLED_APPS.extend([
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'django_celery_beat',
    'django_celery_results',

    # JANMITRA Local Core Apps
    'accounts.apps.AccountsConfig',
    'complaints.apps.ComplaintsConfig',
    'dashboard.apps.DashboardConfig',
    'notifications.apps.NotificationsConfig',
])

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'resolveIT.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'resolveIT.wsgi.application'
ASGI_APPLICATION = 'resolveIT.asgi.application'

# Custom User Model for Civic Reporting Roles
AUTH_USER_MODEL = 'accounts.User'

# Authentication Backends (supports login via email or mobile)
AUTHENTICATION_BACKENDS = [
    'accounts.backends.EmailOrMobileBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# ==============================================================================
# Django REST Framework Configuration
# ==============================================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
}

# ==============================================================================
# SimpleJWT Configuration
# ==============================================================================
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=int(os.environ.get('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60))
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=int(os.environ.get('JWT_REFRESH_TOKEN_LIFETIME_DAYS', 7))
    ),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': 'JANMITRA-NMC',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# ==============================================================================
# CORS Configuration (Strictly environment-variable driven)
# ==============================================================================
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]

# ==============================================================================
# Celery Configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)
CELERY_ACCEPT_CONTENT = ['application/json', 'json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Kolkata'
CELERY_ENABLE_UTC = False
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes

from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'check-sla-escalations-every-hour': {
        'task': 'complaints.tasks.check_sla_escalations',
        'schedule': crontab(minute=0, hour='*'),  # Every hour
    },
    'aggregate-daily-ward-metrics-midnight': {
        'task': 'dashboard.tasks.aggregate_daily_ward_metrics',
        'schedule': crontab(minute=0, hour=0),  # Midnight every day
    },
}

# Internationalization
# Nagpur Municipal Corporation timezone: Asia/Kolkata
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'


# Media files (Complaint photos, geo-tagged uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
