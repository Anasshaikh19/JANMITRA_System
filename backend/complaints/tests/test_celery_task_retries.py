"""
Unit and integration test suite for Celery task retry policies (JANMITRA).

Verifies:
1. Correct retry limits, delays, and task configurations.
2. Transient failure retry triggering via explicit self.retry(exc=exc).
3. Successful execution does not trigger retries.
4. Permanent errors (e.g. non-existent records, invalid IDs) fail safely without retrying.
5. Retries exhaustion produces terminal failure logs via failure_logger.
6. Repeated/retried execution is idempotent with no duplicate database records or routing side effects.
7. External AI and FCM services are fully mocked.
"""

import uuid
from unittest.mock import MagicMock, patch
from django.contrib.auth import get_user_model
from django.test import TestCase

from complaints.models import Category, Complaint, Department, StatusHistory, Ward
from complaints.tasks import (
    analyze_complaint_ai,
    failure_logger,
    process_complaint_ai,
    route_complaint_task,
)

User = get_user_model()


class ProcessComplaintAIRetryPolicyTests(TestCase):
    """
    Dedicated test suite for process_complaint_ai Celery task retry policies and resilience.
    """

    @classmethod
    def setUpTestData(cls):
        cls.dept_pwd = Department.objects.first() or Department.objects.create(
            id=1, name='Public Works Department', short_name='PWD'
        )
        cls.ward_1 = Ward.objects.first() or Ward.objects.create(
            id=1, name='Ward 1', ward_number=1
        )
        cls.cat_roads = Category.objects.first() or Category.objects.create(
            id=1, name='Roads & Infrastructure', department=cls.dept_pwd
        )
        cls.citizen = User.objects.create_user(
            mobile='9820000077',
            full_name='Aarav Deshmukh',
            role=User.Role.CITIZEN,
            ward=cls.ward_1,
            password='TestPassword@123',
            fcm_token='mock_citizen_fcm_token_12345'
        )

    def _create_test_complaint(self, **kwargs):
        defaults = {
            'title': 'Severe Pothole on Ward 1 Main Road',
            'description': 'Deep road cavity causing severe traffic slowdowns near Civil Lines.',
            'citizen': self.citizen,
            'category': self.cat_roads,
            'department': self.dept_pwd,
            'ward': self.ward_1,
            'address': 'Civil Lines, Nagpur',
            'status': Complaint.Status.SUBMITTED,
            'priority_level': Complaint.Priority.MEDIUM,
            'priority_score': 0.0,
            'fake_detected': False,
            'fake_detection_score': 0.1,
        }
        defaults.update(kwargs)
        return Complaint.objects.create(**defaults)

    def test_01_configuration_retry_limits_and_delay(self):
        """Verify task configuration: max_retries=2, default_retry_delay=30, bound=True."""
        self.assertEqual(process_complaint_ai.max_retries, 2)
        self.assertEqual(process_complaint_ai.default_retry_delay, 30)
        self.assertTrue(process_complaint_ai.bind)
        self.assertEqual(process_complaint_ai.name, "complaints.tasks.process_complaint_ai")

    def test_02_successful_execution_validates_complaint(self):
        """Successful execution validates complaint, sets priority score, and routes without retrying."""
        complaint = self._create_test_complaint(priority_score=0.0)

        with patch('complaints.tasks.route_complaint_task.delay') as mock_route:
            with patch.object(process_complaint_ai, 'retry') as mock_retry:
                with self.captureOnCommitCallbacks(execute=True):
                    result = process_complaint_ai(str(complaint.id))

                mock_retry.assert_not_called()
                self.assertIn("AI processing completed", result)
                mock_route.assert_called_once_with(str(complaint.id))

        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Validated')
        self.assertEqual(complaint.priority_score, 50.0)

        history = StatusHistory.objects.filter(complaint=complaint)
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().new_status, 'Validated')

    def test_03_successful_execution_fraud_flagged_pending_validation(self):
        """Flagged/fraud complaint transitions to 'Pending Validation' and does not trigger routing."""
        complaint = self._create_test_complaint(
            fake_detected=True,
            fake_detection_score=0.85
        )

        with patch('complaints.tasks.route_complaint_task.delay') as mock_route:
            with patch.object(process_complaint_ai, 'retry') as mock_retry:
                with self.captureOnCommitCallbacks(execute=True):
                    result = process_complaint_ai(str(complaint.id))

                mock_retry.assert_not_called()
                mock_route.assert_not_called()
                self.assertIn("AI processing completed", result)

        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Pending Validation')

        history = StatusHistory.objects.filter(complaint=complaint)
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().new_status, 'Pending Validation')

    def test_04_transient_connection_error_triggers_retry(self):
        """Transient ConnectionError calls self.retry with countdown=30."""
        complaint = self._create_test_complaint()

        class MockRetryExc(Exception):
            pass

        with patch('complaints.tasks.analyze_complaint_ai', side_effect=ConnectionError("AI service unavailable")):
            with patch.object(process_complaint_ai, 'retry', side_effect=MockRetryExc("Retry invoked")) as mock_retry:
                with self.assertRaises(MockRetryExc):
                    process_complaint_ai(str(complaint.id))

                mock_retry.assert_called_once()
                self.assertEqual(mock_retry.call_args[1].get('countdown'), 30)
                self.assertIsInstance(mock_retry.call_args[1].get('exc'), ConnectionError)

    def test_05_transient_timeout_error_triggers_retry(self):
        """Transient TimeoutError calls self.retry with countdown=30."""
        complaint = self._create_test_complaint()

        class MockRetryExc(Exception):
            pass

        with patch('complaints.tasks.analyze_complaint_ai', side_effect=TimeoutError("AI inference read timeout")):
            with patch.object(process_complaint_ai, 'retry', side_effect=MockRetryExc("Retry invoked")) as mock_retry:
                with self.assertRaises(MockRetryExc):
                    process_complaint_ai(str(complaint.id))

                mock_retry.assert_called_once()
                self.assertEqual(mock_retry.call_args[1].get('countdown'), 30)
                self.assertIsInstance(mock_retry.call_args[1].get('exc'), TimeoutError)

    def test_06_transient_os_error_triggers_retry(self):
        """Transient OSError (e.g. broken network pipe) calls self.retry."""
        complaint = self._create_test_complaint()

        class MockRetryExc(Exception):
            pass

        with patch('complaints.tasks.analyze_complaint_ai', side_effect=OSError("Network interface reset")):
            with patch.object(process_complaint_ai, 'retry', side_effect=MockRetryExc("Retry invoked")) as mock_retry:
                with self.assertRaises(MockRetryExc):
                    process_complaint_ai(str(complaint.id))

                mock_retry.assert_called_once()
                self.assertEqual(mock_retry.call_args[1].get('countdown'), 30)
                self.assertIsInstance(mock_retry.call_args[1].get('exc'), OSError)

    def test_07_permanent_failure_missing_complaint_id_no_retry(self):
        """Missing or None complaint_id returns error string without retrying."""
        with patch.object(process_complaint_ai, 'retry') as mock_retry:
            result = process_complaint_ai(None)
            mock_retry.assert_not_called()
            self.assertEqual(result, "Complaint not found")

    def test_08_permanent_failure_nonexistent_complaint_no_retry(self):
        """Non-existent complaint UUID returns error string without retrying."""
        random_uuid = str(uuid.uuid4())
        with patch.object(process_complaint_ai, 'retry') as mock_retry:
            result = process_complaint_ai(random_uuid)
            mock_retry.assert_not_called()
            self.assertEqual(result, "Complaint not found")

    def test_09_exhausted_retries_produces_failure_log_and_raises(self):
        """When max_retries limit is reached, terminal failure is logged to celery.task.failure and re-raised."""
        complaint = self._create_test_complaint()

        process_complaint_ai.push_request(retries=2, id='test-exhausted-ai-task')
        try:
            with patch('complaints.tasks.analyze_complaint_ai', side_effect=ConnectionError("Terminal AI outage")):
                with patch('complaints.tasks.failure_logger.exception') as mock_fail_log:
                    with self.assertRaises(ConnectionError):
                        process_complaint_ai(str(complaint.id))

                    mock_fail_log.assert_called_once()
                    log_text = mock_fail_log.call_args[0][0]
                    self.assertIn("exhausted all 2 retries", log_text)
                    self.assertIn("Terminal failure", log_text)
                    self.assertIn(str(complaint.id), log_text)
        finally:
            pop_fn = getattr(process_complaint_ai, 'pop_request', None)
            if pop_fn:
                process_complaint_ai.pop_request()

    def test_10_repeated_execution_does_not_duplicate_status_history(self):
        """Repeated task execution does not duplicate StatusHistory audit entries."""
        complaint = self._create_test_complaint()

        with patch('complaints.tasks.route_complaint_task.delay'):
            with self.captureOnCommitCallbacks(execute=True):
                res1 = process_complaint_ai(str(complaint.id))
                res2 = process_complaint_ai(str(complaint.id))

        self.assertIn("AI processing completed", res1)
        self.assertIn("AI processing completed", res2)

        history_count = StatusHistory.objects.filter(complaint=complaint).count()
        self.assertEqual(history_count, 1)

    def test_11_repeated_execution_does_not_retrigger_routing_task(self):
        """Repeated or retried execution does not dispatch route_complaint_task multiple times."""
        complaint = self._create_test_complaint()

        with patch('complaints.tasks.route_complaint_task.delay') as mock_route:
            with self.captureOnCommitCallbacks(execute=True):
                process_complaint_ai(str(complaint.id))
                process_complaint_ai(str(complaint.id))

            # Dispatched only on first validation, second execution is skipped
            mock_route.assert_called_once_with(str(complaint.id))

    def test_12_downstream_status_complaint_not_reverted(self):
        """Complaint already in Assigned or In Progress status is not reverted by repeated AI processing."""
        complaint = self._create_test_complaint(status=Complaint.Status.ASSIGNED)

        with patch('complaints.tasks.route_complaint_task.delay') as mock_route:
            result = process_complaint_ai(str(complaint.id))

        self.assertIn("AI processing completed", result)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, Complaint.Status.ASSIGNED)
        mock_route.assert_not_called()
        self.assertEqual(StatusHistory.objects.filter(complaint=complaint).count(), 0)

    def test_13_never_logs_sensitive_citizen_info(self):
        """Verify no sensitive citizen information (passwords, auth tokens) is exposed in task logs."""
        complaint = self._create_test_complaint()

        with self.assertLogs('complaints', level='INFO') as cm:
            with patch('complaints.tasks.route_complaint_task.delay'):
                process_complaint_ai(str(complaint.id))

            log_output = "\n".join(cm.output)
            self.assertNotIn("TestPassword@123", log_output)
            self.assertNotIn(self.citizen.fcm_token, log_output)
            self.assertIn(complaint.tracking_id, log_output)
