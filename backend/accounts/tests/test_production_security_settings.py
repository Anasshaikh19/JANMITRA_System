"""
Focused unit tests for JANMITRA production HTTP security settings and headers.
Validates production.py configuration against strict municipal and OWASP standards.
"""

import importlib
import os
from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from django.test.client import RequestFactory
from django.middleware.security import SecurityMiddleware
from django.http import HttpResponse


class ProductionSecuritySettingsTests(SimpleTestCase):
    """
    Validates that production settings enforce HTTPS, HSTS, secure cookies,
    and anti-clickjacking headers while deferring HSTS preload.
    """

    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    def test_production_security_settings_values(self):
        """
        Verify the exact values of security settings in production.py.
        """
        env_vars = {
            'SECRET_KEY': 'production-test-key-with-sufficient-length-for-testing-1234567890',
            'DATABASE_URL': 'sqlite:///db.sqlite3',
            'POSTGRES_SSL_REQUIRE': 'false',
        }
        with patch.dict(os.environ, env_vars, clear=False):
            # Reload production settings to inspect module values
            prod_settings = importlib.import_module('resolveIT.settings.production')
            importlib.reload(prod_settings)

            self.assertTrue(prod_settings.SECURE_SSL_REDIRECT)
            self.assertEqual(prod_settings.SECURE_HSTS_SECONDS, 31536000)
            self.assertTrue(prod_settings.SECURE_HSTS_INCLUDE_SUBDOMAINS)
            self.assertFalse(prod_settings.SECURE_HSTS_PRELOAD)
            self.assertTrue(prod_settings.SECURE_CONTENT_TYPE_NOSNIFF)
            self.assertEqual(prod_settings.X_FRAME_OPTIONS, 'DENY')
            self.assertTrue(prod_settings.SECURE_BROWSER_XSS_FILTER)
            self.assertTrue(prod_settings.SESSION_COOKIE_SECURE)
            self.assertTrue(prod_settings.CSRF_COOKIE_SECURE)
            self.assertEqual(prod_settings.SECURE_PROXY_SSL_HEADER, ('HTTP_X_FORWARDED_PROTO', 'https'))

    @override_settings(
        SECURE_HSTS_SECONDS=31536000,
        SECURE_HSTS_INCLUDE_SUBDOMAINS=True,
        SECURE_HSTS_PRELOAD=False,
        SECURE_CONTENT_TYPE_NOSNIFF=True,
        X_FRAME_OPTIONS='DENY',
        SECURE_BROWSER_XSS_FILTER=True,
        SECURE_SSL_REDIRECT=False,  # Keep redirect False for testing response headers on mock get
    )
    def test_security_middleware_headers_emitted(self):
        """
        Verify SecurityMiddleware emits nosniff, DENY, and HSTS headers.
        """
        from django.middleware.clickjacking import XFrameOptionsMiddleware

        security_mw = SecurityMiddleware(lambda req: HttpResponse("OK"))
        clickjacking_mw = XFrameOptionsMiddleware(lambda req: HttpResponse("OK"))

        request = self.factory.get('/', secure=True)

        sec_response = security_mw(request)
        click_response = clickjacking_mw(request)

        # X-Content-Type-Options (from SecurityMiddleware)
        self.assertEqual(sec_response.headers.get('X-Content-Type-Options'), 'nosniff')

        # X-Frame-Options (from XFrameOptionsMiddleware)
        self.assertEqual(click_response.headers.get('X-Frame-Options'), 'DENY')

        # Strict-Transport-Security (from SecurityMiddleware)
        hsts_header = sec_response.headers.get('Strict-Transport-Security')
        self.assertIsNotNone(hsts_header)
        self.assertIn('max-age=31536000', hsts_header)
        self.assertIn('includeSubDomains', hsts_header)
        # Ensure preload is NOT present
        self.assertNotIn('preload', hsts_header)

    @override_settings(
        SECURE_SSL_REDIRECT=True,
        SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO', 'https'),
    )
    def test_secure_ssl_redirect_with_proxy_header(self):
        """
        Verify non-HTTPS requests redirect to HTTPS, but HTTPS forwarded requests pass.
        """
        middleware = SecurityMiddleware(lambda req: HttpResponse("OK"))

        # Insecure HTTP request -> 301 Redirect to HTTPS
        insecure_request = self.factory.get('/api/v1/health/')
        redirect_resp = middleware(insecure_request)
        self.assertEqual(redirect_resp.status_code, 301)
        self.assertTrue(redirect_resp.url.startswith('https://'))

        # Secure forwarded request via proxy header -> 200 OK
        secure_forwarded_request = self.factory.get(
            '/api/v1/health/',
            HTTP_X_FORWARDED_PROTO='https'
        )
        ok_resp = middleware(secure_forwarded_request)
        self.assertEqual(ok_resp.status_code, 200)
