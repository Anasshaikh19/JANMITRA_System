"""
Unit and integration tests for JANMITRA System Health Check API.
Endpoint: GET /api/v1/health/ and GET /api/health/
"""

from datetime import datetime
from unittest.mock import MagicMock, patch
from django.db import OperationalError
from rest_framework import status
from rest_framework.test import APITestCase
import redis


class HealthCheckTests(APITestCase):
    """
    Test suite for HealthCheckView (/api/v1/health/ and /api/health/).
    Verifies independent monitoring of Database, Redis, and Celery,
    HTTP 200/503 status code behavior, ISO-8601 timestamps, and zero credential leaks.
    """

    def setUp(self):
        super().setUp()
        self.endpoint_v1 = '/api/v1/health/'
        self.endpoint_legacy = '/api/health/'

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_all_services_healthy(self, mock_redis_ping, mock_celery_ping):
        """
        1. All services connected -> HTTP 200, status 'healthy'.
        All subsystem statuses must report 'connected'.
        """
        mock_redis_ping.return_value = True
        mock_celery_ping.return_value = [{'celery@worker1': {'ok': 'pong'}}]

        response = self.client.get(self.endpoint_v1)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['database'], 'connected')
        self.assertEqual(response.data['redis'], 'connected')
        self.assertEqual(response.data['celery'], 'connected')
        self.assertIn('timestamp', response.data)

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_legacy_endpoint_healthy(self, mock_redis_ping, mock_celery_ping):
        """
        Verify /api/health/ also routes to HealthCheckView and returns HTTP 200.
        """
        mock_redis_ping.return_value = True
        mock_celery_ping.return_value = [{'celery@worker1': {'ok': 'pong'}}]

        response = self.client.get(self.endpoint_legacy)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['database'], 'connected')
        self.assertEqual(response.data['redis'], 'connected')
        self.assertEqual(response.data['celery'], 'connected')

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    @patch('accounts.models.User.objects.count')
    def test_database_failure(self, mock_user_count, mock_redis_ping, mock_celery_ping):
        """
        2. Database failure -> HTTP 503, status 'unhealthy'.
        Redis and Celery continue to run and report 'connected'.
        """
        mock_user_count.side_effect = OperationalError("Database connection lost")
        mock_redis_ping.return_value = True
        mock_celery_ping.return_value = [{'celery@worker1': {'ok': 'pong'}}]

        response = self.client.get(self.endpoint_v1)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['status'], 'unhealthy')
        self.assertEqual(response.data['database'], 'unavailable')
        self.assertEqual(response.data['redis'], 'connected')
        self.assertEqual(response.data['celery'], 'connected')

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_redis_failure_exception(self, mock_redis_ping, mock_celery_ping):
        """
        3. Redis failure (connection error exception) -> HTTP 503, status 'unhealthy'.
        Database and Celery report independently.
        """
        mock_redis_ping.side_effect = redis.exceptions.ConnectionError("Redis offline")
        mock_celery_ping.return_value = [{'celery@worker1': {'ok': 'pong'}}]

        response = self.client.get(self.endpoint_v1)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['status'], 'unhealthy')
        self.assertEqual(response.data['database'], 'connected')
        self.assertEqual(response.data['redis'], 'unavailable')
        self.assertEqual(response.data['celery'], 'connected')

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_redis_failure_falsy_return(self, mock_redis_ping, mock_celery_ping):
        """
        Redis failure (ping returns False) -> HTTP 503, status 'unhealthy'.
        """
        mock_redis_ping.return_value = False
        mock_celery_ping.return_value = [{'celery@worker1': {'ok': 'pong'}}]

        response = self.client.get(self.endpoint_v1)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['status'], 'unhealthy')
        self.assertEqual(response.data['redis'], 'unavailable')

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_celery_worker_unavailable_empty_response(self, mock_redis_ping, mock_celery_ping):
        """
        4. Celery worker unavailable or no response (empty list) -> HTTP 503, status 'unhealthy'.
        Database and Redis report 'connected'.
        """
        mock_redis_ping.return_value = True
        mock_celery_ping.return_value = []

        response = self.client.get(self.endpoint_v1)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['status'], 'unhealthy')
        self.assertEqual(response.data['database'], 'connected')
        self.assertEqual(response.data['redis'], 'connected')
        self.assertEqual(response.data['celery'], 'unavailable')

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_celery_worker_exception(self, mock_redis_ping, mock_celery_ping):
        """
        Celery ping raises an exception -> HTTP 503, celery marked 'unavailable'.
        """
        mock_redis_ping.return_value = True
        mock_celery_ping.side_effect = Exception("Celery broker error")

        response = self.client.get(self.endpoint_v1)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['status'], 'unhealthy')
        self.assertEqual(response.data['celery'], 'unavailable')

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_public_access_without_authentication(self, mock_redis_ping, mock_celery_ping):
        """
        5. Public access without authentication.
        Anonymous request must succeed without 401 or 403.
        """
        mock_redis_ping.return_value = True
        mock_celery_ping.return_value = [{'celery@worker1': {'ok': 'pong'}}]

        self.client.credentials()  # Clear any authorization headers
        response = self.client.get(self.endpoint_v1)

        self.assertNotEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    def test_timestamp_presence_and_iso8601_format(self, mock_redis_ping, mock_celery_ping):
        """
        6. Timestamp presence, ISO-8601 format verification, and no credential leakage.
        """
        mock_redis_ping.return_value = True
        mock_celery_ping.return_value = [{'celery@worker1': {'ok': 'pong'}}]

        response = self.client.get(self.endpoint_v1)

        self.assertIn('timestamp', response.data)
        raw_ts = response.data['timestamp']

        # Parse timestamp according to ISO-8601
        parsed_dt = datetime.fromisoformat(raw_ts)
        self.assertIsInstance(parsed_dt, datetime)

        # Verify only public schema keys are exposed
        allowed_keys = {'status', 'database', 'redis', 'celery', 'timestamp'}
        self.assertEqual(set(response.data.keys()), allowed_keys)

        # Verify no sensitive keywords exist in values
        for val in response.data.values():
            val_str = str(val).lower()
            self.assertNotIn('password', val_str)
            self.assertNotIn('secret', val_str)
            self.assertNotIn('postgres://', val_str)
            self.assertNotIn('redis://', val_str)
            self.assertNotIn('traceback', val_str)

    @patch('accounts.views.celery_app.control.ping')
    @patch('accounts.views.redis_client.ping')
    @patch('accounts.models.User.objects.count')
    def test_multiple_failures_independent_reporting(self, mock_user_count, mock_redis_ping, mock_celery_ping):
        """
        Verify that multiple concurrent failures report all failed services independently.
        """
        mock_user_count.side_effect = OperationalError("DB down")
        mock_redis_ping.side_effect = redis.exceptions.ConnectionError("Redis down")
        mock_celery_ping.return_value = []

        response = self.client.get(self.endpoint_v1)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data['status'], 'unhealthy')
        self.assertEqual(response.data['database'], 'unavailable')
        self.assertEqual(response.data['redis'], 'unavailable')
        self.assertEqual(response.data['celery'], 'unavailable')
