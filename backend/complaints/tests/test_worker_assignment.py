"""
Comprehensive unit and integration tests for Worker Assignment API.
JANMITRA - Nagpur Municipal Corporation Civic Issue System.

Endpoint: POST /api/v1/complaints/<id>/assign/
"""

import uuid
from unittest.mock import MagicMock, patch
from django.contrib.gis.geos import Point
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from complaints.models import Category, Complaint, Department, StatusHistory, Ward
from notifications.models import Notification


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class WorkerAssignmentAPITests(TestCase):
    """
    Focused tests for POST /api/v1/complaints/<id>/assign/
    Covers all RBAC permissions, validations, atomic assignment,
    lifecycle status guards, audit trails, and notification behavior.
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
            defaults={'name': 'Roads & Potholes', 'department': self.dept_pwd}
        )
        self.cat_swm, _ = Category.objects.update_or_create(
            id=2,
            defaults={'name': 'Garbage & Waste Disposal', 'department': self.dept_swm}
        )

        # 1. Admin
        self.admin = User.objects.create_user(
            mobile='9800000000',
            full_name='NMC Central Admin',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            password='Admin@12345'
        )

        # 2. Dept Officers
        self.officer_pwd = User.objects.create_user(
            mobile='9800000001',
            full_name='Rajesh Kumar PWD Officer',
            role=User.Role.DEPT_OFFICER,
            department=self.dept_pwd,
            ward=self.ward_1,
            password='Officer@123'
        )
        self.officer_swm = User.objects.create_user(
            mobile='9800000002',
            full_name='Sunita SWM Officer',
            role=User.Role.DEPT_OFFICER,
            department=self.dept_swm,
            ward=self.ward_2,
            password='Officer@123'
        )

        # 3. Field Workers
        # PWD Worker in Ward 1
        self.worker_pwd_w1 = User.objects.create_user(
            mobile='9810010001',
            full_name='Ramesh PWD Ward 1 Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_1,
            fcm_token='token_pwd_w1',
            status=User.Status.ACTIVE
        )
        # PWD Worker in Ward 2 (adjacent ward)
        self.worker_pwd_w2 = User.objects.create_user(
            mobile='9810010002',
            full_name='Suresh PWD Ward 2 Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_2,
            status=User.Status.ACTIVE
        )
        # SWM Worker in Ward 1 (different department)
        self.worker_swm_w1 = User.objects.create_user(
            mobile='9810010003',
            full_name='Amit SWM Ward 1 Worker',
            role=User.Role.WORKER,
            department=self.dept_swm,
            ward=self.ward_1,
            status=User.Status.ACTIVE
        )
        # Inactive worker
        self.inactive_worker = User.objects.create_user(
            mobile='9810010004',
            full_name='Inactive Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_1,
            is_active=False
        )
        # Worker on leave
        self.leave_worker = User.objects.create_user(
            mobile='9810010005',
            full_name='On Leave Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_1,
            status=User.Status.ON_LEAVE
        )
        # Worker with no department
        self.worker_no_dept = User.objects.create_user(
            mobile='9810010006',
            full_name='No Dept Worker',
            role=User.Role.WORKER,
            department=None,
            ward=self.ward_1,
            status=User.Status.ACTIVE
        )

        # 4. Citizen
        self.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Priya Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward_1
        )

    def _create_complaint(self, category=None, ward=None, status_val=Complaint.Status.SUBMITTED):
        """Helper to create test complaints with spatial coordinates."""
        cat = category or self.cat_pwd
        w = ward or self.ward_1
        return Complaint.objects.create(
            citizen=self.citizen,
            category=cat,
            department=cat.department,
            ward=w,
            title='Dangerous Pothole on Ward 1 Main Road',
            description='A large pothole has formed causing traffic and safety issues.',
            location=Point(79.0882, 21.1458, srid=4326),
            address='Civil Lines, Ward 1',
            status=status_val
        )

    # -------------------------------------------------------------------------
    # 1. Valid assignment by authorized department officer
    # -------------------------------------------------------------------------
    def test_valid_assignment_by_authorized_dept_officer(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_pwd_w1.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('complaint_id', response.data)
        self.assertEqual(response.data['complaint_id'], str(complaint.id))
        self.assertEqual(response.data['assigned_worker_id'], self.worker_pwd_w1.id)
        self.assertEqual(response.data['status'], Complaint.Status.ASSIGNED)
        self.assertIn('Worker assigned successfully', response.data['message'])

        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_worker, self.worker_pwd_w1)
        self.assertEqual(complaint.status, Complaint.Status.ASSIGNED)

    # -------------------------------------------------------------------------
    # 2. Valid assignment by admin
    # -------------------------------------------------------------------------
    def test_valid_assignment_by_admin(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_pwd_w1.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_worker, self.worker_pwd_w1)
        self.assertEqual(complaint.status, Complaint.Status.ASSIGNED)

    # -------------------------------------------------------------------------
    # 3. Worker UUID does not exist
    # -------------------------------------------------------------------------
    def test_worker_uuid_does_not_exist(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'
        non_existent_uuid = str(uuid.uuid4())

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {'worker_id': non_existent_uuid},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('worker_id', response.data)

    # -------------------------------------------------------------------------
    # 4. Selected user is not a worker
    # -------------------------------------------------------------------------
    def test_selected_user_is_not_a_worker(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {'worker_id': str(self.citizen.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('worker_id', response.data)
        self.assertIn('not a municipal field worker', str(response.data['worker_id']))

    # -------------------------------------------------------------------------
    # 5. Inactive worker and worker on leave rejected
    # -------------------------------------------------------------------------
    def test_inactive_worker_rejected(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)

        # Account is_active=False
        res_inactive = self.client.post(
            assign_url,
            {'worker_id': str(self.inactive_worker.id)},
            format='json'
        )
        self.assertEqual(res_inactive.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('worker_id', res_inactive.data)
        self.assertIn('inactive', str(res_inactive.data['worker_id']))

        # Status on_leave
        res_leave = self.client.post(
            assign_url,
            {'worker_id': str(self.leave_worker.id)},
            format='json'
        )
        self.assertEqual(res_leave.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('worker_id', res_leave.data)

    # -------------------------------------------------------------------------
    # 6. Worker without department rejected
    # -------------------------------------------------------------------------
    def test_worker_without_department_rejected(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_no_dept.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('worker_id', response.data)
        self.assertIn('department', str(response.data['worker_id']))

    # -------------------------------------------------------------------------
    # 7. Department mismatch rejected, including for admins
    # -------------------------------------------------------------------------
    def test_department_mismatch_rejected_for_officers_and_admins(self):
        complaint = self._create_complaint()  # PWD complaint
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        # Department Officer attempting mismatch
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_swm_w1.id)},  # SWM worker
            format='json'
        )
        self.assertEqual(res_officer.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', res_officer.data)

        # Admin attempting department mismatch (even with override reason) -> strictly rejected
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.post(
            assign_url,
            {
                'worker_id': str(self.worker_swm_w1.id),
                'override_reason': 'Emergency inter-department allocation attempted'
            },
            format='json'
        )
        self.assertEqual(res_admin.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', res_admin.data)
        self.assertIn('department', res_admin.data)

    # -------------------------------------------------------------------------
    # 8. Ward mismatch rejected for non-admin
    # -------------------------------------------------------------------------
    def test_ward_mismatch_rejected_for_non_admin(self):
        complaint = self._create_complaint(ward=self.ward_1)
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_pwd_w2.id)},  # Ward 2 worker
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', response.data)
        self.assertIn('ward', response.data)

    # -------------------------------------------------------------------------
    # 9. Non-admin cannot bypass ward restrictions by supplying override_reason
    # -------------------------------------------------------------------------
    def test_non_admin_cannot_bypass_ward_restrictions(self):
        complaint = self._create_complaint(ward=self.ward_1)
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {
                'worker_id': str(self.worker_pwd_w2.id),
                'override_reason': 'Officer attempting to support adjacent ward'
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', response.data)

        # Also verify explicit override: True from officer returns 403 Forbidden
        res_override_flag = self.client.post(
            assign_url,
            {
                'worker_id': str(self.worker_pwd_w2.id),
                'override': True,
                'override_reason': 'Officer override attempt'
            },
            format='json'
        )
        self.assertEqual(res_override_flag.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 10. Ward mismatch accepted for admin only with valid override reason
    # -------------------------------------------------------------------------
    def test_ward_mismatch_accepted_for_admin_with_valid_override_reason(self):
        complaint = self._create_complaint(ward=self.ward_1)
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'
        override_text = "Worker assigned to support an adjacent ward due to surge"

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            assign_url,
            {
                'worker_id': str(self.worker_pwd_w2.id),  # Ward 2 worker
                'override_reason': override_text
            },
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ward_override'))
        self.assertEqual(response.data.get('override_reason'), override_text)

        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_worker, self.worker_pwd_w2)
        self.assertEqual(complaint.status, Complaint.Status.ASSIGNED)
        self.assertTrue(complaint.ward_override)
        self.assertEqual(complaint.override_reason, override_text)
        self.assertEqual(complaint.original_ward, self.ward_1)

        # StatusHistory audit remarks check
        history = complaint.status_history.latest('changed_at')
        self.assertIn('Override', history.note)
        self.assertIn(override_text, history.note)

    # -------------------------------------------------------------------------
    # 11. Missing or blank override reason rejected for admin ward override
    # -------------------------------------------------------------------------
    def test_admin_ward_override_missing_or_blank_reason_rejected(self):
        complaint = self._create_complaint(ward=self.ward_1)
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.admin)

        # Missing override_reason
        res_missing = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_pwd_w2.id)},
            format='json'
        )
        self.assertEqual(res_missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('override_reason', res_missing.data)

        # Blank/whitespace override_reason
        res_blank = self.client.post(
            assign_url,
            {
                'worker_id': str(self.worker_pwd_w2.id),
                'override_reason': '    '
            },
            format='json'
        )
        self.assertEqual(res_blank.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('override_reason', res_blank.data)

    # -------------------------------------------------------------------------
    # 12. Unauthorized user and unauthenticated request
    # -------------------------------------------------------------------------
    def test_unauthenticated_and_unauthorized_roles_rejected(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        # Unauthenticated request -> 401
        self.client.force_authenticate(user=None)
        res_unauth = self.client.post(assign_url, {'worker_id': str(self.worker_pwd_w1.id)}, format='json')
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Citizen role -> 403
        self.client.force_authenticate(user=self.citizen)
        res_citizen = self.client.post(assign_url, {'worker_id': str(self.worker_pwd_w1.id)}, format='json')
        self.assertEqual(res_citizen.status_code, status.HTTP_403_FORBIDDEN)

        # Worker role -> 403
        self.client.force_authenticate(user=self.worker_pwd_w1)
        res_worker = self.client.post(assign_url, {'worker_id': str(self.worker_pwd_w1.id)}, format='json')
        self.assertEqual(res_worker.status_code, status.HTTP_403_FORBIDDEN)

        # Department Officer from different department (SWM officer on PWD complaint) -> 403
        self.client.force_authenticate(user=self.officer_swm)
        res_diff_dept = self.client.post(assign_url, {'worker_id': str(self.worker_pwd_w1.id)}, format='json')
        self.assertEqual(res_diff_dept.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 13. Complaint does not exist
    # -------------------------------------------------------------------------
    def test_complaint_does_not_exist(self):
        non_existent_id = str(uuid.uuid4())
        assign_url = f'/api/v1/complaints/{non_existent_id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(assign_url, {'worker_id': str(self.worker_pwd_w1.id)}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -------------------------------------------------------------------------
    # 14. Invalid complaint status (respecting lifecycle)
    # -------------------------------------------------------------------------
    def test_invalid_complaint_status_rejected(self):
        invalid_statuses = [
            'Closed',
            'REJECTED',
            'INVALID',
            'RESOLVED',
            'Work Done',
            'Pending Validation',
        ]

        self.client.force_authenticate(user=self.officer_pwd)

        for invalid_status in invalid_statuses:
            complaint = self._create_complaint(status_val=invalid_status)
            assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

            response = self.client.post(
                assign_url,
                {'worker_id': str(self.worker_pwd_w1.id)},
                format='json'
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Status '{invalid_status}' should have been rejected."
            )
            self.assertIn('status', response.data)

    # -------------------------------------------------------------------------
    # 15. Repeated identical assignment does not duplicate history or notifications
    # -------------------------------------------------------------------------
    def test_repeated_identical_assignment_idempotent(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)

        # 1. First assignment
        res1 = self.client.post(assign_url, {'worker_id': str(self.worker_pwd_w1.id)}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        initial_history_count = StatusHistory.objects.filter(complaint=complaint).count()
        initial_notif_count = Notification.objects.filter(recipient=self.worker_pwd_w1, complaint=complaint).count()
        self.assertGreaterEqual(initial_history_count, 1)
        self.assertEqual(initial_notif_count, 1)

        # 2. Repeated identical assignment
        res2 = self.client.post(assign_url, {'worker_id': str(self.worker_pwd_w1.id)}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertIn('already assigned', res2.data['message'].lower())

        # Assert no duplicate StatusHistory or Notification entries created
        current_history_count = StatusHistory.objects.filter(complaint=complaint).count()
        current_notif_count = Notification.objects.filter(recipient=self.worker_pwd_w1, complaint=complaint).count()
        self.assertEqual(initial_history_count, current_history_count)
        self.assertEqual(initial_notif_count, current_notif_count)

    # -------------------------------------------------------------------------
    # 16. StatusHistory records correct details
    # -------------------------------------------------------------------------
    def test_status_history_records_correct_details(self):
        complaint = self._create_complaint(status_val=Complaint.Status.SUBMITTED)
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_pwd_w1.id)},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        history = complaint.status_history.latest('changed_at')
        self.assertEqual(history.old_status, Complaint.Status.SUBMITTED)
        self.assertEqual(history.new_status, Complaint.Status.ASSIGNED)
        self.assertEqual(history.changed_by, self.officer_pwd)
        self.assertIn(self.worker_pwd_w1.full_name, history.note)

    # -------------------------------------------------------------------------
    # 17. Notification dispatch happens after transaction commit
    # -------------------------------------------------------------------------
    def test_notification_dispatch_happens_after_transaction_commit(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)

        # Verify transaction.on_commit is registered during assignment
        with patch('django.db.transaction.on_commit') as mock_on_commit:
            response = self.client.post(
                assign_url,
                {'worker_id': str(self.worker_pwd_w1.id)},
                format='json'
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            mock_on_commit.assert_called_once()

    # -------------------------------------------------------------------------
    # 18. Notification failure does not corrupt the assignment
    # -------------------------------------------------------------------------
    def test_notification_failure_does_not_corrupt_assignment(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)

        # Mock notification delivery to simulate network or external push failure
        with patch('complaints.tasks.trigger_task_assigned.delay', side_effect=Exception("FCM service unavailable")):
            with patch('complaints.tasks.trigger_task_assigned', side_effect=Exception("FCM service unavailable")):
                response = self.client.post(
                    assign_url,
                    {'worker_id': str(self.worker_pwd_w1.id)},
                    format='json'
                )

        # The assignment itself must remain valid and committed
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_worker, self.worker_pwd_w1)
        self.assertEqual(complaint.status, Complaint.Status.ASSIGNED)
        self.assertTrue(complaint.status_history.filter(new_status=Complaint.Status.ASSIGNED).exists())

    # -------------------------------------------------------------------------
    # 19. Response format does not expose private user info
    # -------------------------------------------------------------------------
    def test_response_format_no_private_user_info(self):
        complaint = self._create_complaint()
        assign_url = f'/api/v1/complaints/{complaint.id}/assign/'

        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.post(
            assign_url,
            {'worker_id': str(self.worker_pwd_w1.id)},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Required fields present
        self.assertIn('complaint_id', data)
        self.assertIn('assigned_worker_id', data)
        self.assertIn('status', data)
        self.assertIn('message', data)

        # Sensitive user data must NOT be exposed
        self.assertNotIn('mobile', data)
        self.assertNotIn('password', data)
        self.assertNotIn('fcm_token', data)
        self.assertNotIn('token', data)
        self.assertNotIn('email', data)
