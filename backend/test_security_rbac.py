#!/usr/bin/env python
"""
JANMITRA - Security & RBAC Audit Runner.

This script executes the Security & RBAC Audit test suite.
It can be executed directly:
    python test_security_rbac.py
or via Django's test runner:
    python manage.py test test_security_rbac

Verifications:
1. DRF SimpleJWT token refresh rotation: ROTATE_REFRESH_TOKENS = True and blacklist verification.
2. CORS_ALLOWED_ORIGINS reads strictly from environment variables without hardcoded fallbacks.
3. Permission denial returns HTTP 403 Forbidden with clean JSON error message across all roles.
"""

import os
import sys

# Ensure backend directory is in path and Django settings are configured
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'resolveIT.settings.local')

import django
django.setup()

# Re-export all test classes for Django test runner discovery
from accounts.tests.test_security_rbac import (
    CORSSettingsSecurityTests,
    RBACPermissionDenialTests,
    SimpleJWTSecurityTests,
)

__all__ = [
    'SimpleJWTSecurityTests',
    'CORSSettingsSecurityTests',
    'RBACPermissionDenialTests',
]


def run_audit():
    """
    Sets up Django environment and runs the test suite.
    """
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'resolveIT.settings.local')

    # Add virtual environment paths if running standalone
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    import django
    django.setup()

    from django.test.runner import DiscoverRunner

    print("=" * 70)
    print("JANMITRA Civic Reporting System - Security & RBAC Audit")
    print("=" * 70)
    print("Running Security & RBAC Test Suite...\n")

    test_runner = DiscoverRunner(verbosity=2, interactive=False)
    failures = test_runner.run_tests(['accounts.tests.test_security_rbac'])
    
    if failures:
        print("\n[FAILED] Security & RBAC Audit detected vulnerabilities or regressions.")
        sys.exit(1)
    else:
        print("\n[SUCCESS] All Security & RBAC audit checks passed cleanly.")
        sys.exit(0)


if __name__ == '__main__':
    run_audit()
