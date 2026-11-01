"""
Comprehensive Edge-Case Test Suite for:
1. Worker Assignment Edge Cases (Ward Mismatch Rejection & Override Rules).
2. Citizen Verification (Rating Bounds 1-5 & Sequential Reopen Count Increment).
"""

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from complaints.models import Category, Complaint, Department, StatusHistory, Ward
from complaints.validators import validate_worker_assignment

User = get_user_model()


class WorkerAssignmentEdgeCasesTests(APITestCase):
    """
    Dedicated edge-case tests for Worker Assignment:
    - Ward mismatch rejection for Department Officers
    - Ward mismatch rejection for Admin without valid override reason
    - Ward mismatch override acceptance for Admin with non-empty reason
    - Direct unit testing of validate_worker_assignment validator
    """

    @classmethod
    def setUpTestData(cls):
        cls.dept_pwd = Department.objects.filter(short_name='PWD').first() or Department.objects.create(
            name='Public Works Department',
            short_name='PWD'
        )
        cls.dept_swm = Department.objects.filter(short_name='SWM').first() or Department.objects.create(
            name='Solid Waste Management',
            short_name='SWM'
        )

        cls.ward_1 = Ward.objects.filter(id=1).first() or Ward.objects.create(id=1, name='Ward 1')
        cls.ward_2 = Ward.objects.filter(id=2).first() or Ward.objects.create(id=2, name='Ward 2')
        cls.ward_3 = Ward.objects.filter(id=3).first() or Ward.objects.create(id=3, name='Ward 3')

        cls.category = Category.objects.filter(department=cls.dept_pwd).first() or Category.objects.create(
            name='Roads & Infrastructure',
            department=cls.dept_pwd
        )

        # 1. Admin
        cls.admin = User.objects.create_user(
            mobile='9830000001',
            full_name='Assignment Admin',
            role=User.Role.ADMIN,
            is_staff=True,
            password='Password@123'
        )

        # 2. Dept Officer (PWD)
        cls.pwd_officer = User.objects.create_user(
            mobile='9830000002',
            full_name='PWD Officer',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            password='Password@123'
        )

        # 3. Worker in Ward 1 (PWD) - matching ward
        cls.worker_ward1 = User.objects.create_user(
            mobile='9830000003',
            full_name='Worker Ward 1',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            designation='Road Worker',
            password='Password@123'
        )

        # 4. Worker in Ward 2 (PWD) - mismatching ward
        cls.worker_ward2 = User.objects.create_user(
            mobile='9830000004',
            full_name='Worker Ward 2',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=cls.ward_2,
            designation='Road Worker',
            password='Password@123'
        )

        # 5. Worker with no assigned ward
        cls.worker_no_ward = User.objects.create_user(
            mobile='9830000005',
            full_name='Worker No Ward',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=None,
            designation='Floating Tech',
            password='Password@123'
        )

        # 6. Citizen
        cls.citizen = User.objects.create_user(
            mobile='9830000006',
            full_name='Citizen Reporter',
            role=User.Role.CITIZEN,
            ward=cls.ward_1,
            password='Password@123'
        )

    def setUp(self):
        # Create fresh complaint in Ward 1 for each test
        self.complaint_ward1 = Complaint.objects.create(
            citizen=self.citizen,
            category=self.category,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Road Pothole in Ward 1',
            description='Severe crater on main road in Ward 1',
            location=Point(79.0882, 21.1458),
            status=Complaint.Status.SUBMITTED,
            priority=Complaint.Priority.MEDIUM
        )
        self.assign_url = reverse('complaints:complaint-assign', kwargs={'pk': str(self.complaint_ward1.id)})

    def test_dept_officer_ward_mismatch_rejected(self):
        """
        Department Officer assigning a worker from Ward 2 to a Ward 1 complaint
        must be rejected with HTTP 400 Bad Request containing 'assignment_error'.
        """
        self.client.force_authenticate(user=self.pwd_officer)
        response = self.client.post(
            self.assign_url,
            {'worker_id': self.worker_ward2.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', response.data)
        errors = str(response.data['assignment_error'])
        self.assertIn('does not match complaint ward', errors)

    def test_dept_officer_cannot_bypass_ward_mismatch_with_override_flag(self):
        """
        Department Officer attempting to set override=True returns HTTP 403 Forbidden.
        Only administrators can override ward boundaries.
        """
        self.client.force_authenticate(user=self.pwd_officer)
        response = self.client.post(
            self.assign_url,
            {
                'worker_id': self.worker_ward2.id,
                'override': True,
                'override_reason': 'Officer attempting ward override'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Only administrators are authorized to override', str(response.data['error']))

    def test_admin_ward_mismatch_rejected_without_override_reason(self):
        """
        Admin assigning mismatching ward worker without providing override_reason
        must be rejected with HTTP 400 Bad Request.
        """
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.assign_url,
            {'worker_id': self.worker_ward2.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('override_reason', response.data)

    def test_admin_ward_mismatch_rejected_with_blank_or_whitespace_reason(self):
        """
        Admin providing whitespace-only override_reason is rejected with HTTP 400 Bad Request.
        """
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            self.assign_url,
            {
                'worker_id': self.worker_ward2.id,
                'override': True,
                'override_reason': '     '
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('override_reason', response.data)

    def test_admin_ward_mismatch_accepted_with_valid_reason(self):
        """
        Admin providing mismatching ward worker with a valid non-empty override_reason
        succeeds with HTTP 200 OK and sets ward_override=True.
        """
        self.client.force_authenticate(user=self.admin)
        override_reason_text = 'Ward 1 maintenance crew occupied; deploying Ward 2 technician for emergency repair.'
        response = self.client.post(
            self.assign_url,
            {
                'worker_id': self.worker_ward2.id,
                'override_reason': override_reason_text
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.complaint_ward1.refresh_from_db()
        self.assertEqual(self.complaint_ward1.assigned_worker, self.worker_ward2)
        self.assertEqual(self.complaint_ward1.status, Complaint.Status.ASSIGNED)
        self.assertTrue(self.complaint_ward1.ward_override)
        self.assertEqual(self.complaint_ward1.override_reason, override_reason_text)

    def test_worker_with_no_assigned_ward_rejected(self):
        """
        Worker who does not belong to any ward cannot be assigned without admin override.
        """
        self.client.force_authenticate(user=self.pwd_officer)
        response = self.client.post(
            self.assign_url,
            {'worker_id': self.worker_no_ward.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', response.data)

    def test_validate_worker_assignment_unit_function(self):
        """
        Direct unit test of validate_worker_assignment validator function.
        """
        # Case 1: Matching department and ward -> returns False (no errors, override not needed)
        has_override = validate_worker_assignment(self.worker_ward1, self.complaint_ward1, override=False)
        self.assertFalse(has_override)

        # Case 2: Ward mismatch without override -> raises ValidationError
        with self.assertRaises(ValidationError) as ctx:
            validate_worker_assignment(self.worker_ward2, self.complaint_ward1, override=False)
        self.assertIn('assignment_error', ctx.exception.detail)

        # Case 3: Ward mismatch with override=True -> returns True (override accepted)
        has_override = validate_worker_assignment(self.worker_ward2, self.complaint_ward1, override=True)
        self.assertTrue(has_override)

        # Case 4: Department mismatch without override -> raises ValidationError
        worker_swm = User.objects.create_user(
            mobile='9830000099',
            full_name='SWM Worker',
            role=User.Role.WORKER,
            department=self.dept_swm,
            ward=self.ward_1,
            password='Password@123'
        )
        with self.assertRaises(ValidationError) as ctx:
            validate_worker_assignment(worker_swm, self.complaint_ward1, override=False)
        self.assertIn('assignment_error', ctx.exception.detail)


class CitizenVerificationEdgeCasesTests(APITestCase):
    """
    Dedicated edge-case tests for Citizen Verification:
    - Rating boundary values: 1 (valid min), 5 (valid max), 3 (valid mid)
    - Rating out-of-bounds rejection: 0, 6, -1, 10, non-integer, strings, booleans
    - Sequential reopen_count increment (0 -> 1 -> 2 -> 3)
    """

    @classmethod
    def setUpTestData(cls):
        cls.dept = Department.objects.first() or Department.objects.create(
            name='Public Works Department',
            short_name='PWD'
        )
        cls.ward = Ward.objects.first() or Ward.objects.create(id=1, name='Ward 1')
        cls.category = Category.objects.filter(department=cls.dept).first() or Category.objects.create(
            name='Roads & Infrastructure',
            department=cls.dept
        )

        cls.citizen = User.objects.create_user(
            mobile='9840000001',
            full_name='Verification Citizen',
            role=User.Role.CITIZEN,
            ward=cls.ward,
            password='Password@123'
        )

        cls.other_citizen = User.objects.create_user(
            mobile='9840000002',
            full_name='Other Citizen',
            role=User.Role.CITIZEN,
            ward=cls.ward,
            password='Password@123'
        )

    def _create_work_done_complaint(self):
        """Helper to create a complaint in 'Work Done' state ready for citizen verification."""
        return Complaint.objects.create(
            citizen=self.citizen,
            category=self.category,
            department=self.dept,
            ward=self.ward,
            title='Drainage overflow verification',
            description='Blocked drain cleared by worker',
            location=Point(79.0882, 21.1458),
            status=Complaint.Status.WORK_DONE,
            priority=Complaint.Priority.MEDIUM,
            reopen_count=0
        )

    # --------------------------------------------------------------------------
    # Rating Bounds 1-5 Tests
    # --------------------------------------------------------------------------

    def test_citizen_rating_minimum_bound_1_accepted(self):
        """Rating 1 (minimum valid rating) is accepted with HTTP 200 OK."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Closed')
        self.assertEqual(complaint.citizen_rating, 1)

    def test_citizen_rating_maximum_bound_5_accepted(self):
        """Rating 5 (maximum valid rating) is accepted with HTTP 200 OK."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 5}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Closed')
        self.assertEqual(complaint.citizen_rating, 5)

    def test_citizen_rating_mid_bound_3_accepted(self):
        """Rating 3 (intermediate valid rating) is accepted with HTTP 200 OK."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 3}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Closed')
        self.assertEqual(complaint.citizen_rating, 3)

    def test_citizen_rating_zero_rejected(self):
        """Rating 0 (below minimum 1) is rejected with HTTP 400 Bad Request."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 0}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rating', response.data)

    def test_citizen_rating_six_rejected(self):
        """Rating 6 (above maximum 5) is rejected with HTTP 400 Bad Request."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 6}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rating', response.data)

    def test_citizen_rating_negative_rejected(self):
        """Negative rating is rejected with HTTP 400 Bad Request."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': -1}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rating', response.data)

    def test_citizen_rating_large_number_rejected(self):
        """Rating 100 is rejected with HTTP 400 Bad Request."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 100}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rating', response.data)

    def test_citizen_rating_non_integer_float_rejected(self):
        """Float rating like 3.5 is rejected with HTTP 400 Bad Request."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 3.5}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rating', response.data)

    def test_citizen_rating_string_rejected(self):
        """String rating like 'five' is rejected with HTTP 400 Bad Request."""
        complaint = self._create_work_done_complaint()
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(url, {'action': 'accept', 'rating': 'five'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rating', response.data)

    # --------------------------------------------------------------------------
    # Reopen Count Sequential Increment Tests
    # --------------------------------------------------------------------------

    def test_reopen_count_sequential_increments(self):
        """
        Verify that multiple rejections sequentially increment reopen_count:
        - Starts at 0
        - 1st reject -> reopen_count = 1
        - 2nd reject -> reopen_count = 2
        - 3rd reject -> reopen_count = 3
        """
        complaint = self._create_work_done_complaint()
        self.assertEqual(complaint.reopen_count, 0)
        url = reverse('complaints:complaint-verify', kwargs={'pk': str(complaint.id)})

        self.client.force_authenticate(user=self.citizen)

        # 1st rejection
        res1 = self.client.post(url, {'action': 'reject', 'reason': 'First failure - not fixed'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.reopen_count, 1)
        self.assertEqual(complaint.status, 'Reopened')
        self.assertEqual(res1.data.get('reopen_count'), 1)

        # Worker re-does the work
        complaint.status = Complaint.Status.WORK_DONE
        complaint.save(update_fields=['status'])

        # 2nd rejection
        res2 = self.client.post(url, {'action': 'reject', 'reason': 'Second failure - incomplete work'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.reopen_count, 2)
        self.assertEqual(complaint.status, 'Reopened')
        self.assertEqual(res2.data.get('reopen_count'), 2)

        # Worker re-does work again
        complaint.status = Complaint.Status.WORK_DONE
        complaint.save(update_fields=['status'])

        # 3rd rejection
        res3 = self.client.post(url, {'action': 'reject', 'reason': 'Third failure - poor quality material'}, format='json')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.reopen_count, 3)
        self.assertEqual(complaint.status, 'Reopened')
        self.assertEqual(res3.data.get('reopen_count'), 3)

        # Verify audit history logged 3 separate Reopened events
        reopen_history_count = StatusHistory.objects.filter(complaint=complaint, new_status='Reopened').count()
        self.assertEqual(reopen_history_count, 3)
