"""
Unit and integration tests for Citizen Complaint Verification API (JANMITRA).
Endpoint: POST /api/v1/complaints/:id/verify/

Tests:
1. Permissions & Access Control:
   - Unauthenticated access returns 401 Unauthorized.
   - Other citizen attempting verification returns 403 Forbidden.
   - Worker/Officer role attempting verification returns 403 Forbidden.
   - Only the reporting citizen can verify the complaint.
2. State Transition Rules:
   - Valid transition from 'Work Done' and 'RESOLVED' to 'Closed' (accept) or 'Reopened' (reject).
   - Rejection from invalid statuses ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'Closed') returns 400 Bad Request.
3. Acceptance Logic:
   - status becomes 'Closed'
   - complaint.rating = rating (1-5)
   - complaint.closed_at = timezone.now()
   - StatusHistory record created with changed_by=request.user, old_status, new_status='Closed'.
4. Rejection Logic:
   - status becomes 'Reopened'
   - complaint.reopen_count += 1
   - Routes back to worker queue (visible in worker task list for ward & department).
   - StatusHistory record created with reason.
   - Multiple rejections increment reopen_count sequentially.
5. Serializer & Payload Validations:
   - action: 'accept' or 'reject'
   - rating: 1-5 required when accept
   - reason: non-empty string required when reject
   - Backward-compatibility with accepted: true/false.
"""

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from complaints.models import Category, Complaint, Department, StatusHistory, Ward
from complaints.serializers import CitizenComplaintVerifySerializer

User = get_user_model()


class CitizenComplaintVerifyAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed Ward and Department
        self.ward1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1 Dharampeth'})
        self.dept_pwd, _ = Department.objects.update_or_create(id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'})

        # Seed Category (Roads -> PWD)
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )

        # Citizens
        self.citizen1 = User.objects.create_user(
            email='citizen1@example.com',
            mobile='9820000001',
            full_name='Citizen One',
            role=User.Role.CITIZEN,
            ward=self.ward1,
            password='TestPassword123'
        )
        self.citizen2 = User.objects.create_user(
            email='citizen2@example.com',
            mobile='9820000002',
            full_name='Citizen Two',
            role=User.Role.CITIZEN,
            ward=self.ward1,
            password='TestPassword123'
        )

        # Field Worker
        self.worker = User.objects.create_user(
            email='worker@pwd.gov.in',
            mobile='9810010001',
            full_name='Ramesh PWD Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward1,
            password='TestPassword123'
        )

        # Department Officer
        self.officer = User.objects.create_user(
            email='officer@pwd.gov.in',
            mobile='9800000001',
            full_name='Suresh PWD Officer',
            role=User.Role.DEPT_OFFICER,
            department=self.dept_pwd,
            password='TestPassword123'
        )

        # Baseline verifiable complaint (Work Done)
        self.complaint = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward1,
            title='Pothole on Main Road',
            description='Severe pothole near Shankar Nagar square needs urgent repair.',
            location=Point(79.0882, 21.1458, srid=4326),
            address='Shankar Nagar square',
            status='Work Done',
            assigned_worker=self.worker,
            priority_level=Complaint.Priority.HIGH,
            reopen_count=0
        )

        self.verify_url = f'/api/v1/complaints/{self.complaint.id}/verify/'

    # -------------------------------------------------------------------------
    # 1. Permissions & Access Control Tests
    # -------------------------------------------------------------------------
    def test_verify_unauthenticated(self):
        """Unauthenticated requests must return 401 Unauthorized."""
        response = self.client.post(self.verify_url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_verify_other_citizen_forbidden(self):
        """A citizen who did not report the complaint cannot verify it (403 Forbidden)."""
        self.client.force_authenticate(user=self.citizen2)
        response = self.client.post(self.verify_url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Only the citizen who reported this complaint', response.data.get('detail', ''))

    def test_verify_field_worker_forbidden(self):
        """A field worker cannot verify complaint resolution (403 Forbidden)."""
        self.client.force_authenticate(user=self.worker)
        response = self.client.post(self.verify_url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_verify_dept_officer_forbidden(self):
        """A department officer cannot verify resolution on behalf of citizen (403 Forbidden)."""
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.verify_url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_verify_nonexistent_complaint(self):
        """Non-existent complaint ID returns 404 Not Found."""
        self.client.force_authenticate(user=self.citizen1)
        url = '/api/v1/complaints/11111111-2222-3333-4444-555555555555/verify/'
        response = self.client.post(url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -------------------------------------------------------------------------
    # 2. State Transition Validation Tests
    # -------------------------------------------------------------------------
    def test_verify_invalid_statuses(self):
        """Complaints not in 'Work Done' or 'RESOLVED' cannot be verified (400 Bad Request)."""
        self.client.force_authenticate(user=self.citizen1)

        invalid_statuses = [
            Complaint.Status.SUBMITTED,
            Complaint.Status.ASSIGNED,
            Complaint.Status.IN_PROGRESS,
            Complaint.Status.CLOSED,
            Complaint.Status.PENDING_VALIDATION,
        ]

        for bad_status in invalid_statuses:
            self.complaint.status = bad_status
            self.complaint.save()

            response = self.client.post(self.verify_url, {'action': 'accept', 'rating': 5}, format='json')
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Status '{bad_status}' should not be verifiable."
            )
            self.assertIn('cannot be verified from status', response.data.get('error', ''))

    # -------------------------------------------------------------------------
    # 3. Acceptance Logic Tests
    # -------------------------------------------------------------------------
    def test_verify_accept_success(self):
        """
        Accepting resolution:
        - complaint.status = 'Closed'
        - complaint.rating = rating
        - complaint.closed_at = timezone.now()
        - StatusHistory entry created
        """
        self.client.force_authenticate(user=self.citizen1)

        before_time = timezone.now()
        payload = {
            'action': 'accept',
            'rating': 5,
            'feedback': 'Excellent and quick road repair!'
        }
        response = self.client.post(self.verify_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Closed')
        self.assertEqual(response.data['rating'], 5)
        self.assertEqual(response.data['citizen_rating'], 5)
        self.assertIsNotNone(response.data.get('closed_at'))

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'Closed')
        self.assertEqual(self.complaint.rating, 5)
        self.assertEqual(self.complaint.citizen_rating, 5)
        self.assertIsNotNone(self.complaint.closed_at)
        self.assertIsNotNone(self.complaint.resolved_at)
        self.assertGreaterEqual(self.complaint.closed_at, before_time)
        self.assertEqual(self.complaint.citizen_feedback, 'Excellent and quick road repair!')

        # Verify StatusHistory audit record
        history = StatusHistory.objects.filter(complaint=self.complaint, new_status='Closed').latest('changed_at')
        self.assertEqual(history.old_status, 'Work Done')
        self.assertEqual(history.new_status, 'Closed')
        self.assertEqual(history.changed_by, self.citizen1)
        self.assertIn('Excellent and quick road repair!', history.note)

    def test_verify_accept_from_resolved_status(self):
        """Accepting resolution on a complaint with status 'RESOLVED' also succeeds."""
        self.complaint.status = Complaint.Status.RESOLVED
        self.complaint.save()

        self.client.force_authenticate(user=self.citizen1)
        response = self.client.post(self.verify_url, {'action': 'accept', 'rating': 4}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Closed')

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'Closed')
        self.assertEqual(self.complaint.rating, 4)

    # -------------------------------------------------------------------------
    # 4. Rejection Logic Tests & Worker Queue Routing
    # -------------------------------------------------------------------------
    def test_verify_reject_success_and_route_back_to_worker_queue(self):
        """
        Rejecting resolution:
        - complaint.status = 'Reopened'
        - complaint.reopen_count += 1
        - routes back to worker queue
        - StatusHistory entry created with reason
        """
        self.assertEqual(self.complaint.reopen_count, 0)
        self.client.force_authenticate(user=self.citizen1)

        payload = {
            'action': 'reject',
            'reason': 'Pothole patch broke open again after heavy rainfall.'
        }
        response = self.client.post(self.verify_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Reopened')
        self.assertEqual(response.data['reopen_count'], 1)
        self.assertEqual(response.data['reason'], 'Pothole patch broke open again after heavy rainfall.')

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'Reopened')
        self.assertEqual(self.complaint.reopen_count, 1)

        # StatusHistory audit record
        history = StatusHistory.objects.filter(complaint=self.complaint, new_status='Reopened').latest('changed_at')
        self.assertEqual(history.old_status, 'Work Done')
        self.assertEqual(history.new_status, 'Reopened')
        self.assertEqual(history.changed_by, self.citizen1)
        self.assertEqual(history.note, 'Pothole patch broke open again after heavy rainfall.')

        # Verify route back to worker queue:
        # Field worker in Dharampeth Ward (Ward 1) and PWD sees this complaint in their tasks list
        self.client.force_authenticate(user=self.worker)
        worker_tasks_url = '/api/v1/worker/tasks/'
        worker_res = self.client.get(worker_tasks_url)
        self.assertEqual(worker_res.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in worker_res.data]
        self.assertIn(str(self.complaint.id), task_ids)

    def test_multiple_rejections_increment_reopen_count(self):
        """Multiple sequential rejections increment reopen_count sequentially (1, 2)."""
        self.client.force_authenticate(user=self.citizen1)

        # 1st rejection
        res1 = self.client.post(self.verify_url, {'action': 'reject', 'reason': 'Issue still here 1'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.reopen_count, 1)

        # Worker re-submits work done
        self.complaint.status = 'Work Done'
        self.complaint.save()

        # 2nd rejection
        res2 = self.client.post(self.verify_url, {'action': 'reject', 'reason': 'Issue still here 2'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.reopen_count, 2)
        self.assertEqual(res2.data['reopen_count'], 2)

    # -------------------------------------------------------------------------
    # 5. Payload & Serializer Validation Tests
    # -------------------------------------------------------------------------
    def test_verify_payload_validations(self):
        """Verify all edge cases for payload validation."""
        self.client.force_authenticate(user=self.citizen1)

        # Missing action and accepted
        r1 = self.client.post(self.verify_url, {}, format='json')
        self.assertEqual(r1.status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid action string
        r2 = self.client.post(self.verify_url, {'action': 'maybe'}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

        # Accept without rating
        r3 = self.client.post(self.verify_url, {'action': 'accept'}, format='json')
        self.assertEqual(r3.status_code, status.HTTP_400_BAD_REQUEST)

        # Accept with rating 0 (out of bounds)
        r4 = self.client.post(self.verify_url, {'action': 'accept', 'rating': 0}, format='json')
        self.assertEqual(r4.status_code, status.HTTP_400_BAD_REQUEST)

        # Accept with rating 6 (out of bounds)
        r5 = self.client.post(self.verify_url, {'action': 'accept', 'rating': 6}, format='json')
        self.assertEqual(r5.status_code, status.HTTP_400_BAD_REQUEST)

        # Accept with boolean rating True (rejected)
        r6 = self.client.post(self.verify_url, {'action': 'accept', 'rating': True}, format='json')
        self.assertEqual(r6.status_code, status.HTTP_400_BAD_REQUEST)

        # Reject without reason
        r7 = self.client.post(self.verify_url, {'action': 'reject'}, format='json')
        self.assertEqual(r7.status_code, status.HTTP_400_BAD_REQUEST)

        # Reject with blank/whitespace reason
        r8 = self.client.post(self.verify_url, {'action': 'reject', 'reason': '    '}, format='json')
        self.assertEqual(r8.status_code, status.HTTP_400_BAD_REQUEST)

    def test_backward_compatibility_accepted_flag(self):
        """Legacy payload with accepted: true/false continues to work seamlessly."""
        self.client.force_authenticate(user=self.citizen1)

        # Accepted True with rating 5
        res_accept = self.client.post(self.verify_url, {'accepted': True, 'rating': 5}, format='json')
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'Closed')
        self.assertEqual(self.complaint.rating, 5)

        # Reset to Work Done
        self.complaint.status = 'Work Done'
        self.complaint.save()

        # Accepted False with reason
        res_reject = self.client.post(self.verify_url, {'accepted': False, 'reason': 'Not fixed.'}, format='json')
        self.assertEqual(res_reject.status_code, status.HTTP_200_OK)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'Reopened')
        self.assertEqual(self.complaint.reopen_count, 1)

    # -------------------------------------------------------------------------
    # 6. Serializer Unit Tests
    # -------------------------------------------------------------------------
    def test_serializer_unit_validation(self):
        """Direct unit validation of CitizenComplaintVerifySerializer."""
        # Valid accept
        s1 = CitizenComplaintVerifySerializer(data={'action': 'accept', 'rating': 5, 'feedback': 'Good job'})
        self.assertTrue(s1.is_valid(), s1.errors)
        self.assertEqual(s1.validated_data['action'], 'accept')
        self.assertEqual(s1.validated_data['rating'], 5)

        # Valid reject
        s2 = CitizenComplaintVerifySerializer(data={'action': 'reject', 'reason': 'Still leaking'})
        self.assertTrue(s2.is_valid(), s2.errors)
        self.assertEqual(s2.validated_data['action'], 'reject')
        self.assertEqual(s2.validated_data['reason'], 'Still leaking')

        # Invalid: missing rating on accept
        s3 = CitizenComplaintVerifySerializer(data={'action': 'accept'})
        self.assertFalse(s3.is_valid())
        self.assertIn('rating', s3.errors)

        # Invalid: missing reason on reject
        s4 = CitizenComplaintVerifySerializer(data={'action': 'reject'})
        self.assertFalse(s4.is_valid())
        self.assertIn('reason', s4.errors)

    # -------------------------------------------------------------------------
    # 7. Timestamp Lifecycle & Repeated-Request Protection Tests
    # -------------------------------------------------------------------------
    def test_verify_accept_preserves_original_work_completion_timestamp(self):
        """
        Verification acceptance sets closed_at but MUST NOT overwrite
        the original work-completion timestamp (resolved_at).
        """
        from datetime import timedelta
        original_completion_time = timezone.now() - timedelta(days=2)
        self.complaint.status = 'Work Done'
        self.complaint.resolved_at = original_completion_time
        self.complaint.save()

        self.client.force_authenticate(user=self.citizen1)
        response = self.client.post(self.verify_url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'Closed')
        # closed_at is set to current verification time
        self.assertIsNotNone(self.complaint.closed_at)
        self.assertGreater(self.complaint.closed_at, original_completion_time)
        # resolved_at MUST NOT be overwritten
        self.assertEqual(self.complaint.resolved_at, original_completion_time)

    def test_repeated_rejection_cannot_double_increment(self):
        """
        Repeated or duplicate rejection requests on the same complaint
        must be rejected with 400 Bad Request and not increment reopen_count twice.
        """
        self.client.force_authenticate(user=self.citizen1)

        # First rejection: succeeds
        res1 = self.client.post(self.verify_url, {'action': 'reject', 'reason': 'Issue still exists'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.reopen_count, 1)
        self.assertEqual(self.complaint.status, 'Reopened')

        # Immediate second rejection (duplicate request): must fail with 400
        res2 = self.client.post(self.verify_url, {'action': 'reject', 'reason': 'Issue still exists'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.complaint.refresh_from_db()
        # reopen_count must strictly remain 1
        self.assertEqual(self.complaint.reopen_count, 1)

