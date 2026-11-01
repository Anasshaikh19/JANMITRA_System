"""
Automated unit and integration tests for Database Connection Failure,
Transactional Safety, Rollback Recovery, and Concurrency Protection.
JANMITRA - Nagpur Municipal Corporation Civic Issue System.

ENVIRONMENT NOTICE:
-------------------
These automated tests simulate transient database connection errors (such as
PostgreSQL connection drops, 'server closed the connection unexpectedly', and
socket resets) using mock-based database exceptions (django.db.OperationalError /
DatabaseError). They do NOT drop or alter the live or test database schema.
Real connection recovery against a live PostgreSQL server requires a dedicated
PostgreSQL container or cluster, which is verified separately where available.
"""

import uuid
from unittest.mock import MagicMock, call, patch
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import DatabaseError, OperationalError, transaction
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from complaints.models import Category, Complaint, ComplaintImage, Department, StatusHistory, Ward
from notifications.models import Notification


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ComplaintSubmissionTransactionRecoveryTests(TestCase):
    """
    Automated tests verifying transactional consistency, rollback on simulated
    transient database connection failures, post-commit Celery side effect isolation,
    and subsequent recovery for citizen complaint submission (POST /api/v1/complaints/).
    """

    def setUp(self):
        self.client = APIClient()

        # Seed municipal departments and wards
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1,
            defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})

        # Seed grievance category
        self.cat_pwd, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )

        # Authenticated citizen
        self.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Priya Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward_1,
            password='Citizen@123'
        )

        self.list_url = '/api/v1/complaints/'

    def _create_dummy_image(self, name='road_pothole.jpg'):
        """Creates an in-memory 1x1 GIF/JPEG upload."""
        content = (
            b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff'
            b'\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00'
            b'\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
        )
        return SimpleUploadedFile(name, content, content_type='image/jpeg')

    def _build_payload(self, description="Broken road causing major vehicle damage near Civil Lines"):
        return {
            'category': self.cat_pwd.id,
            'ward': self.ward_1.id,
            'description': description,
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [self._create_dummy_image()],
            'address': 'Civil Lines Square, Nagpur',
            'landmark': 'Near High Court',
        }

    # -------------------------------------------------------------------------
    # 1. Rollback on simulated transient connection failure during submission
    # -------------------------------------------------------------------------
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_complaint_submission_db_error_triggers_full_rollback_and_no_celery_dispatch(
        self, mock_ai_delay, mock_notify_delay
    ):
        """
        Verify that a transient database connection failure during complaint
        creation causes an atomic rollback of all records (Complaint, ComplaintImage,
        and StatusHistory) and suppresses Celery tasks / notifications.
        """
        self.client.force_authenticate(user=self.citizen)
        payload = self._build_payload(description="Simulated rollback pothole issue 001")

        initial_complaint_count = Complaint.objects.count()
        initial_image_count = ComplaintImage.objects.count()
        initial_history_count = StatusHistory.objects.count()

        # Simulate a transient connection drop / socket error on Complaint save
        simulated_error = OperationalError("server closed the connection unexpectedly")
        with patch.object(Complaint, 'save', side_effect=simulated_error):
            with self.assertRaises(OperationalError):
                self.client.post(self.list_url, payload, format='multipart')

        # Assert full database rollback: NO orphaned records created
        self.assertEqual(Complaint.objects.count(), initial_complaint_count)
        self.assertEqual(ComplaintImage.objects.count(), initial_image_count)
        self.assertEqual(StatusHistory.objects.count(), initial_history_count)

        # Assert side-effect safety: Celery tasks NOT dispatched
        mock_ai_delay.assert_not_called()
        mock_notify_delay.assert_not_called()

    # -------------------------------------------------------------------------
    # 2. Recovery: subsequent valid submission succeeds after transient failure
    # -------------------------------------------------------------------------
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_complaint_submission_recovery_after_transient_failure(
        self, mock_ai_delay, mock_notify_delay
    ):
        """
        Verify that after a simulated transient database failure is removed,
        the subsequent complaint submission succeeds completely with all related
        records transactionally consistent and Celery tasks properly dispatched.
        """
        self.client.force_authenticate(user=self.citizen)
        payload1 = self._build_payload(description="Failing complaint attempt 001")
        payload2 = self._build_payload(description="Successful complaint recovery attempt 002")

        # Step 1: Transient failure on first attempt
        simulated_error = OperationalError("connection reset by peer")
        with patch.object(Complaint, 'save', side_effect=simulated_error):
            with self.assertRaises(OperationalError):
                self.client.post(self.list_url, payload1, format='multipart')

        # Verify state after failure
        self.assertFalse(Complaint.objects.filter(description="Failing complaint attempt 001").exists())
        mock_ai_delay.assert_not_called()
        mock_notify_delay.assert_not_called()

        # Step 2: Connection restored - subsequent request succeeds
        response = self.client.post(self.list_url, payload2, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_complaint_id = response.data['id']

        # Verify persistent consistent database state
        complaint = Complaint.objects.get(id=new_complaint_id)
        self.assertEqual(complaint.description, "Successful complaint recovery attempt 002")
        self.assertEqual(complaint.status, Complaint.Status.SUBMITTED)
        self.assertEqual(complaint.images.count(), 1)
        self.assertTrue(complaint.status_history.filter(new_status=Complaint.Status.SUBMITTED).exists())

        # Verify Celery tasks are now dispatched for the successful complaint
        mock_ai_delay.assert_called_once_with(str(new_complaint_id))
        mock_notify_delay.assert_called_once_with(str(new_complaint_id))

    # -------------------------------------------------------------------------
    # 3. Related records consistency (image failure rolls back parent complaint)
    # -------------------------------------------------------------------------
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_related_image_failure_rolls_back_entire_complaint(
        self, mock_ai_delay, mock_notify_delay
    ):
        """
        Verify that if saving an image record fails due to a database exception,
        the parent complaint and audit history are rolled back atomically.
        """
        self.client.force_authenticate(user=self.citizen)
        payload = self._build_payload(description="Image failure rollback test")

        simulated_error = DatabaseError("Disk full or database write failed on complaint image")
        with patch.object(ComplaintImage, 'save', side_effect=simulated_error):
            with self.assertRaises(DatabaseError):
                self.client.post(self.list_url, payload, format='multipart')

        # Parent complaint must NOT exist in the database
        self.assertFalse(Complaint.objects.filter(description="Image failure rollback test").exists())
        self.assertFalse(StatusHistory.objects.filter(note__icontains="Image failure rollback test").exists())
        mock_ai_delay.assert_not_called()
        mock_notify_delay.assert_not_called()

    # -------------------------------------------------------------------------
    # 4. transaction.on_commit callback registration and execution guarantees
    # -------------------------------------------------------------------------
    def test_complaint_submission_on_commit_registered_and_safe(self):
        """
        Verify that complaint submission registers its side effects via
        transaction.on_commit, guaranteeing they fire after database commit.
        """
        self.client.force_authenticate(user=self.citizen)
        payload = self._build_payload(description="On commit registration test")

        with patch('django.db.transaction.on_commit') as mock_on_commit:
            response = self.client.post(self.list_url, payload, format='multipart')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            func_names = [call_args[0][0].__name__ for call_args in mock_on_commit.call_args_list]
            self.assertIn('_dispatch_post_commit_tasks', func_names)

    def test_post_commit_callbacks_run_only_after_successful_commit(self):
        """
        Verify that transaction.on_commit callbacks execute strictly after a
        successful commit and are discarded when an atomic block rolls back.
        """
        callback_executed = []

        def my_post_commit_callback():
            callback_executed.append("executed")

        # 1. Rollback case: callback must not execute
        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    transaction.on_commit(my_post_commit_callback)
                    raise OperationalError("Simulated database connection failure")
            except OperationalError:
                pass

        self.assertEqual(callback_executed, [])

        # 2. Commit case: callback executes
        with self.captureOnCommitCallbacks(execute=True):
            with transaction.atomic():
                transaction.on_commit(my_post_commit_callback)

        self.assertEqual(callback_executed, ["executed"])


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class WorkerAssignmentTransactionRecoveryTests(TestCase):
    """
    Automated tests verifying transactional consistency, rollback on simulated
    transient database connection failures, Celery/notification isolation,
    in-transaction revalidation, and recovery for worker assignment
    (POST /api/v1/complaints/<id>/assign/).
    """

    def setUp(self):
        self.client = APIClient()

        # Seed municipal departments (1-4)
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1,
            defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        self.dept_swm, _ = Department.objects.update_or_create(
            id=2,
            defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'}
        )

        # Seed municipal wards (1-4)
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward_2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})

        # Seed categories
        self.cat_pwd, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )

        # Users
        self.admin = User.objects.create_user(
            mobile='9800000000',
            full_name='Central Admin',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            password='Admin@12345'
        )

        self.officer_pwd = User.objects.create_user(
            mobile='9800000001',
            full_name='Rajesh Kumar PWD Officer',
            role=User.Role.DEPT_OFFICER,
            department=self.dept_pwd,
            ward=self.ward_1,
            password='Officer@123'
        )

        self.worker_pwd_w1 = User.objects.create_user(
            mobile='9810010001',
            full_name='Ramesh Field Worker Ward 1',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_1,
            status=User.Status.ACTIVE,
            password='Worker@123'
        )

        self.worker_pwd_w2 = User.objects.create_user(
            mobile='9810010002',
            full_name='Suresh Field Worker Ward 2',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_2,
            status=User.Status.ACTIVE,
            password='Worker@123'
        )

        self.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Priya Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward_1,
            password='Citizen@123'
        )

        # Base complaint
        self.complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_pwd,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Damaged Pavement Civil Lines',
            description='Severe pavement cracking requiring field worker inspection.',
            location=Point(79.0882, 21.1458, srid=4326),
            address='Civil Lines, Ward 1',
            status=Complaint.Status.SUBMITTED
        )

        self.assign_url = f'/api/v1/complaints/{self.complaint.id}/assign/'

    # -------------------------------------------------------------------------
    # 1. Rollback on simulated database failure during assignment
    # -------------------------------------------------------------------------
    @patch('complaints.tasks.trigger_task_assigned.delay')
    def test_worker_assignment_db_error_triggers_rollback_and_no_notification(
        self, mock_trigger_delay
    ):
        """
        Verify that a transient connection drop during worker assignment rolls
        back the assignment state, leaves the complaint at its original status,
        creates no StatusHistory row, and dispatches no Celery/FCM notifications.
        """
        self.client.force_authenticate(user=self.officer_pwd)
        payload = {'worker_id': str(self.worker_pwd_w1.id)}

        simulated_error = OperationalError("server closed the connection unexpectedly")
        with patch.object(Complaint, 'save', side_effect=simulated_error):
            with self.assertRaises(OperationalError):
                self.client.post(self.assign_url, payload, format='json')

        # Assert rollback: complaint remains unassigned and SUBMITTED
        self.complaint.refresh_from_db()
        self.assertIsNone(self.complaint.assigned_worker)
        self.assertEqual(self.complaint.status, Complaint.Status.SUBMITTED)

        # Assert no audit record or notification rows
        self.assertFalse(StatusHistory.objects.filter(complaint=self.complaint, new_status=Complaint.Status.ASSIGNED).exists())
        self.assertFalse(Notification.objects.filter(complaint=self.complaint, recipient=self.worker_pwd_w1).exists())

        # Assert Celery task NOT dispatched
        mock_trigger_delay.assert_not_called()

    # -------------------------------------------------------------------------
    # 2. Recovery: subsequent valid assignment succeeds after transient failure
    # -------------------------------------------------------------------------
    @patch('complaints.tasks.trigger_task_assigned.delay')
    def test_worker_assignment_recovery_after_transient_failure(
        self, mock_trigger_delay
    ):
        """
        Verify that after transient connection failure is removed,
        re-issuing the worker assignment succeeds, commits the new worker,
        creates StatusHistory, and dispatches the task.
        """
        self.client.force_authenticate(user=self.officer_pwd)
        payload = {'worker_id': str(self.worker_pwd_w1.id)}

        # 1. First attempt fails due to simulated network drop
        simulated_error = OperationalError("could not connect to server: Connection refused")
        with patch.object(Complaint, 'save', side_effect=simulated_error):
            with self.assertRaises(OperationalError):
                self.client.post(self.assign_url, payload, format='json')

        self.complaint.refresh_from_db()
        self.assertIsNone(self.complaint.assigned_worker)
        mock_trigger_delay.assert_not_called()

        # 2. Second attempt succeeds after recovery
        response = self.client.post(self.assign_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.assigned_worker, self.worker_pwd_w1)
        self.assertEqual(self.complaint.status, Complaint.Status.ASSIGNED)
        self.assertTrue(StatusHistory.objects.filter(complaint=self.complaint, new_status=Complaint.Status.ASSIGNED).exists())

        # Assert post-commit dispatch occurred
        mock_trigger_delay.assert_called_once_with(str(self.complaint.id), str(self.worker_pwd_w1.id))

    # -------------------------------------------------------------------------
    # 3. In-transaction revalidation: concurrent terminal status change
    # -------------------------------------------------------------------------
    def test_concurrent_status_change_revalidation_in_transaction(self):
        """
        Verify that if another concurrent transaction modifies the complaint to
        an ineligible status (e.g. Resolved), in-transaction revalidation
        rejects the assignment and prevents corrupting the resolved complaint.
        """
        self.client.force_authenticate(user=self.officer_pwd)
        payload = {'worker_id': str(self.worker_pwd_w1.id)}

        # Simulate concurrent update: complaint was resolved by another process
        # right after initial lookup
        original_get = Complaint.objects.select_for_update().select_related

        def mock_select_for_update(*args, **kwargs):
            qs = original_get(*args, **kwargs)
            # Mutate row to RESOLVED to simulate concurrent transition
            Complaint.objects.filter(id=self.complaint.id).update(status=Complaint.Status.RESOLVED)
            return qs

        with patch.object(Complaint.objects, 'select_for_update', side_effect=mock_select_for_update):
            response = self.client.post(self.assign_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)
        self.assertIn('Cannot assign worker', str(response.data['status']))

        # Ensure complaint remains Resolved and was not reassigned
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, Complaint.Status.RESOLVED)
        self.assertIsNone(self.complaint.assigned_worker)

    # -------------------------------------------------------------------------
    # 4. In-transaction revalidation: concurrent worker deactivation
    # -------------------------------------------------------------------------
    def test_concurrent_worker_deactivation_revalidation_in_transaction(self):
        """
        Verify that if a worker is deactivated or placed on leave concurrently,
        in-transaction revalidation catches it and rejects the assignment.
        """
        self.client.force_authenticate(user=self.officer_pwd)
        payload = {'worker_id': str(self.worker_pwd_w1.id)}

        original_sfu = User.objects.select_for_update

        def mock_worker_sfu(*args, **kwargs):
            # Deactivate worker right before row lock check
            User.objects.filter(id=self.worker_pwd_w1.id).update(status=User.Status.ON_LEAVE)
            return original_sfu(*args, **kwargs)

        with patch.object(User.objects, 'select_for_update', side_effect=mock_worker_sfu):
            response = self.client.post(self.assign_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('worker_id', response.data)
        self.assertIn('inactive', str(response.data['worker_id']).lower())

        self.complaint.refresh_from_db()
        self.assertIsNone(self.complaint.assigned_worker)

    # -------------------------------------------------------------------------
    # 5. Admin ward override preserved inside transaction
    # -------------------------------------------------------------------------
    def test_admin_ward_override_preserved_inside_transaction(self):
        """
        Verify that admin ward override rules, mandatory override reasons, and
        audit records are correctly validated and committed inside the transaction.
        """
        self.client.force_authenticate(user=self.admin)
        override_text = "Emergency deployment across adjacent ward"
        payload = {
            'worker_id': str(self.worker_pwd_w2.id),  # Ward 2 worker for Ward 1 complaint
            'override_reason': override_text
        }

        response = self.client.post(self.assign_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ward_override'))
        self.assertEqual(response.data.get('override_reason'), override_text)

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.assigned_worker, self.worker_pwd_w2)
        self.assertTrue(self.complaint.ward_override)
        self.assertEqual(self.complaint.override_reason, override_text)
        self.assertEqual(self.complaint.original_ward, self.ward_1)

        # Audit trail note verification
        history = self.complaint.status_history.latest('changed_at')
        self.assertIn('Override', history.note)
        self.assertIn(override_text, history.note)
