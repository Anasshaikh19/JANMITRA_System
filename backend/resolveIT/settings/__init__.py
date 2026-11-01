"""
Django settings package initialization for resolveIT.

Dynamically selects settings based on the ENVIRONMENT variable,
defaulting to local development settings.
"""

import os

env = os.environ.get('ENVIRONMENT', 'local').lower()

if env == 'production':
    from .production import *
else:
    from .local import *
