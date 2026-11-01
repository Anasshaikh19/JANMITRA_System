"""
Automated test suite for notifications app (JANMITRA - Nagpur Municipal Corporation).
"""

import uuid
from unittest.mock import MagicMock, patch
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from complaints.models import Category, Complaint, Department, Ward
from notifications.models import Notification
from notifications.tasks import (
    broadcast_ward_alert,
    dispatch_fcm_push,
    send_external_sms_alert,
    send_push_notification,
)

User = get_user_model()


class NotificationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ward = Ward.objects.first() or Ward.objects.create(id=1, name='Ward 1', ward_number=1)
        cls.user = User.objects.create_user(
            mobile='9820000099',
            full_name='Notification Tester',
            role=User.Role.CITIZEN,
            ward=cls.ward,
            password='TestPassword@123'
        )
        cls.other_user = User.objects.create_user(
            mobile='9820000098',
            full_name='Other Tester',
            role=User.Role.CITIZEN,
            ward=cls.ward,
            password='TestPassword@123'
        )
        cls.notification1 = Notification.objects.create(
            recipient=cls.user,
            title='Test Notice 1',
            message='This is test notification 1',
            notification_type=Notification.NotificationType.IN_APP
        )
        cls.notification2 = Notification.objects.create(
            recipient=cls.user,
            title='Test Notice 2',
            message='This is test notification 2',
            notification_type=Notification.NotificationType.IN_APP
        )
        cls.other_notification = Notification.objects.create(
            recipient=cls.other_user,
            title='Other User Notice',
            message='Should not be visible to first user'
        )

    def test_notification_str(self):
        self.assertIn('Test Notice 1', str(self.notification1))

    def test_list_notifications_unauthenticated(self):
        url = reverse('notifications:notification-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_notifications_scoped_to_user(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('notifications:notification-list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Handle paginated or direct list response
        results = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(results), 2)
        titles = [item['title'] for item in results]
        self.assertIn('Test Notice 1', titles)
        self.assertNotIn('Other User Notice', titles)

    def test_mark_single_notification_as_read(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('notifications:notification-mark-as-read', kwargs={'pk': self.notification1.pk})
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.notification1.refresh_from_db()
        self.assertTrue(self.notification1.is_read)

    def test_mark_all_notifications_as_read(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('notifications:notification-mark-all-as-read')
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        unread_count = Notification.objects.filter(recipient=self.user, is_read=False).count()
        self.assertEqual(unread_count, 0)

    def test_send_external_sms_task(self):
        res = send_external_sms_alert('9876543210', 'Emergency water supply cutoff')
        self.assertIn('SMS successfully sent', res)

    def test_broadcast_ward_alert_task(self):
        ward_num = self.ward.ward_number or 1
        res = broadcast_ward_alert(ward_num, 'Ward Cleanup Drive', 'Sunday 8 AM')
        self.assertIn('Broadcasted to', res)

    def test_send_push_notification_task(self):
        res = send_push_notification(self.user.id, 'Task Assigned', 'Your complaint has been acknowledged')
        self.assertTrue(res)
        # Check an in-app audit notification was logged
        notif = Notification.objects.filter(recipient=self.user, title='Task Assigned').first()
        self.assertIsNotNone(notif)


class SendPushNotificationRetryPolicyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ward = Ward.objects.first() or Ward.objects.create(id=1, name='Ward 1', ward_number=1)
        cls.dept = Department.objects.first() or Department.objects.create(id=1, name='PWD', short_name='PWD')
        cls.category = Category.objects.first() or Category.objects.create(id=1, name='Roads & Infrastructure', department=cls.dept)
        cls.user = User.objects.create_user(
            mobile='9820000088',
            full_name='Retry Test User',
            role=User.Role.CITIZEN,
            ward=cls.ward,
            password='TestPassword@123',
            fcm_token='mock_fcm_token_xyz_987654'
        )
        cls.complaint = Complaint.objects.create(
            title='Pothole in Ward 1',
            description='Test complaint for push retry policies',
            citizen=cls.user,
            category=cls.category,
            department=cls.dept,
            ward=cls.ward,
            address='Civil Lines, Nagpur',
        )

    def test_01_configuration_retry_limits_and_delay(self):
        """Verify task configuration: max_retries=3, default_retry_delay=60, bound=True."""
        self.assertEqual(send_push_notification.max_retries, 3)
        self.assertEqual(send_push_notification.default_retry_delay, 60)
        self.assertTrue(send_push_notification.bind)
        self.assertEqual(send_push_notification.name, "notifications.tasks.send_push_notification")

    def test_02_successful_execution_does_not_trigger_retry(self):
        """Successful push execution creates an audit record and never calls retry."""
        with patch('notifications.tasks.dispatch_fcm_push', return_value=True) as mock_dispatch:
            with patch.object(send_push_notification, 'retry') as mock_retry:
                result = send_push_notification(
                    self.user.id,
                    "Task Acknowledged",
                    "Your grievance is being addressed",
                    complaint_id=self.complaint.id
                )
                mock_retry.assert_not_called()
                mock_dispatch.assert_called_once()
                self.assertIn("Push notification sent to user", result)

        notification = Notification.objects.filter(
            recipient=self.user,
            complaint=self.complaint,
            title="Task Acknowledged"
        ).first()
        self.assertIsNotNone(notification)

    def test_03_transient_connection_error_triggers_retry(self):
        """Transient ConnectionError calls self.retry with countdown=60."""
        class MockRetryExc(Exception):
            pass

        with patch('notifications.tasks.dispatch_fcm_push', side_effect=ConnectionError("FCM gateway timeout")):
            with patch.object(send_push_notification, 'retry', side_effect=MockRetryExc("Retry called")) as mock_retry:
                with self.assertRaises(MockRetryExc):
                    send_push_notification(
                        self.user.id,
                        "Urgent Update",
                        "Water pipe maintenance scheduled",
                        complaint_id=self.complaint.id
                    )
                mock_retry.assert_called_once()
                self.assertEqual(mock_retry.call_args[1].get('countdown'), 60)
                self.assertIsInstance(mock_retry.call_args[1].get('exc'), ConnectionError)

    def test_04_transient_timeout_error_triggers_retry(self):
        """Transient TimeoutError calls self.retry with countdown=60."""
        class MockRetryExc(Exception):
            pass

        with patch('notifications.tasks.dispatch_fcm_push', side_effect=TimeoutError("FCM connection timed out")):
            with patch.object(send_push_notification, 'retry', side_effect=MockRetryExc("Retry called")) as mock_retry:
                with self.assertRaises(MockRetryExc):
                    send_push_notification(
                        self.user.id,
                        "Timeout Test",
                        "Testing timeout retry trigger"
                    )
                mock_retry.assert_called_once()
                self.assertEqual(mock_retry.call_args[1].get('countdown'), 60)
                self.assertIsInstance(mock_retry.call_args[1].get('exc'), TimeoutError)

    def test_05_permanent_failure_nonexistent_user_no_retry(self):
        """Permanent failure (nonexistent user) logs error and returns error string without retrying."""
        fake_id = 999999999
        with patch.object(send_push_notification, 'retry') as mock_retry:
            result = send_push_notification(fake_id, "Hello", "Should fail permanently")
            mock_retry.assert_not_called()
            self.assertEqual(result, "Recipient not found")

    def test_06_permanent_failure_missing_recipient_no_retry(self):
        """Missing or None recipient_id is permanent error and does not trigger retry."""
        with patch.object(send_push_notification, 'retry') as mock_retry:
            result = send_push_notification(None, "Hello", "Should fail permanently")
            mock_retry.assert_not_called()
            self.assertEqual(result, "Recipient not found")

    def test_07_exhausted_retries_produces_failure_log_and_raises(self):
        """When max_retries limit is reached, terminal failure is logged to celery.task.failure and re-raised."""
        send_push_notification.push_request(retries=3, id='test-exhausted-push')
        try:
            with patch('notifications.tasks.dispatch_fcm_push', side_effect=ConnectionError("Terminal FCM failure")):
                with patch('notifications.tasks.failure_logger.exception') as mock_fail_log:
                    with self.assertRaises(ConnectionError):
                        send_push_notification(
                            self.user.id,
                            "Terminal Push",
                            "Should log terminal failure"
                        )
                    mock_fail_log.assert_called_once()
                    log_text = mock_fail_log.call_args[0][0]
                    self.assertIn("exhausted all 3 retries", log_text)
                    self.assertIn("Terminal failure", log_text)
        finally:
            send_push_request = getattr(send_push_notification, 'pop_request', None)
            if send_push_request:
                send_push_notification.pop_request()

    def test_08_repeated_execution_does_not_duplicate_notification_records(self):
        """Repeated or retried executions do not create duplicate Notification audit rows."""
        title = "Idempotent Notice"
        message = "Testing notification duplicate avoidance"

        with patch('notifications.tasks.dispatch_fcm_push', return_value=True):
            send_push_notification(self.user.id, title, message, complaint_id=self.complaint.id)
            send_push_notification(self.user.id, title, message, complaint_id=self.complaint.id)

        matching_notifs = Notification.objects.filter(
            recipient=self.user,
            complaint=self.complaint,
            title=title
        )
        self.assertEqual(matching_notifs.count(), 1)

    def test_09_never_logs_fcm_token_or_credentials(self):
        """Verify FCM tokens or credentials are never exposed in log outputs."""
        with self.assertLogs('notifications', level='INFO') as cm:
            with patch('notifications.tasks.dispatch_fcm_push', return_value=True):
                send_push_notification(self.user.id, "Privacy Check", "Checking logs")
            full_log_output = "\n".join(cm.output)
            self.assertNotIn(self.user.fcm_token, full_log_output)
            self.assertIn("FCM registered: True", full_log_output)

