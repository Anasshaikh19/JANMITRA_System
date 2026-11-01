"""
Comprehensive complaint lifecycle and RBAC security integration tests.
Tests the full JANMITRA grievance flow from submission to resolution and auto-close.
"""

import uuid
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from unittest.mock import patch
from complaints.models import (
    Category,
    Complaint,
    ComplaintImage,
    Department,
    StatusHistory,
    Ward,
)
from complaints.tasks import auto_close, process_complaint_ai
from complaints.validators import validate_worker_assignment

User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ComplaintLifecycleTestCase(TestCase):
    """
    Complete lifecycle and RBAC test suite for JANMITRA civic complaint system.
    """

    def setUp(self):
        self.client = APIClient()

        # Seed municipal departments
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1,
            defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        self.dept_swm, _ = Department.objects.update_or_create(
            id=2,
            defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'}
        )

        # Seed municipal wards
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward_2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})

        # Seed civic issue categories
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )
        self.cat_waste, _ = Category.objects.update_or_create(
            id=2,
            defaults={'name': 'Garbage & Waste Management', 'department': self.dept_swm}
        )

        # 1. Create test users
        # Citizen (ward=1)
        self.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Aarav Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward_1
        )

        # Field Worker (dept=1 [PWD], ward=1)
        self.worker = User.objects.create_user(
            mobile='9810010001',
            full_name='Ramesh PWD Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_1
        )

        # Field Worker from Ward 2 (dept=1 [PWD], ward=2) for mismatch testing
        self.worker_ward2 = User.objects.create_user(
            mobile='9810010002',
            full_name='Suresh Ward2 Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_2
        )

        # Department Officer (dept=1 [PWD])
        self.officer = User.objects.create_user(
            mobile='9800000001',
            full_name='Rajesh Kumar PWD Officer',
            role=User.Role.DEPT_OFFICER,
            department=self.dept_pwd
        )

        # Small 1x1 GIF dummy image file for multipart uploads
        self.dummy_image_bytes = (
            b'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04'
            b'\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
        )

    def test_complete_complaint_lifecycle(self):
        """
        Executes end-to-end test of the complete civic complaint lifecycle:
        1. Users created in setUp (Citizen ward=1, Worker dept=1 ward=1, Officer dept=1)
        2. Citizen submits complaint (category=1, ward=1, description, image)
        3. Assert: complaint created, status=Submitted, dept=PWD auto-set
        4. Run process_complaint_ai task synchronously
        5. Assert: complaint status changed (Validated or Pending Validation)
        6. Officer assigns worker: worker.dept=PWD, worker.ward=Ward1 (valid)
        7. Assert: complaint.assigned_worker = worker, status=Assigned
        8. Test invalid assignment: assign worker from Ward 2 to Ward 1 complaint -> raises ValidationError
        9. Worker marks In-Progress -> Assert: status=In-Progress
        10. Worker tries to mark Work Done without proof photo -> Assert: returns 400
        11. Worker uploads proof photo, marks Work Done -> Assert: status=Work Done
        12. Citizen verifies resolution (accepts) -> Assert: status=Closed, rating saved, resolved_at set
        13. Test auto_close: create Work Done complaint with old date, run auto_close -> Assert: status=Closed
        Also tests RBAC:
        - Citizen cannot access /worker/tasks/ (403)
        - Worker cannot access /dashboard/kpi/ (403)
        - Officer can only see their own department in dashboard
        """
        # ------------------------------------------------------------------
        # Step 1: Users verified
        # ------------------------------------------------------------------
        self.assertEqual(self.citizen.role, User.Role.CITIZEN)
        self.assertEqual(self.citizen.ward.id, 1)
        self.assertEqual(self.worker.role, User.Role.WORKER)
        self.assertEqual(self.worker.department.id, 1)
        self.assertEqual(self.worker.ward.id, 1)
        self.assertEqual(self.officer.role, User.Role.DEPT_OFFICER)
        self.assertEqual(self.officer.department.id, 1)

        # ------------------------------------------------------------------
        # Step 2: Citizen submits complaint (category=1 [Roads], ward=1, description, image)
        # ------------------------------------------------------------------
        self.client.force_authenticate(user=self.citizen)
        submission_image = SimpleUploadedFile(
            name='pothole_site.jpg',
            content=self.dummy_image_bytes,
            content_type='image/jpeg'
        )
        submit_payload = {
            'category': 1,
            'ward': 1,
            'description': 'Massive road crater near Sitabuldi market obstructing daily bus traffic.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': submission_image,
            'address': 'Main High Road, Sitabuldi, Nagpur',
        }
        with patch('complaints.views.process_complaint_ai.delay') as mock_ai_delay:
            submit_response = self.client.post('/api/v1/complaints/', submit_payload, format='multipart')

        # ------------------------------------------------------------------
        # Step 3: Assert: complaint created, status=Submitted, dept=PWD (auto-set)
        # ------------------------------------------------------------------
        self.assertEqual(submit_response.status_code, status.HTTP_201_CREATED)
        complaint_id = submit_response.data['id']
        complaint = Complaint.objects.select_related('department', 'category', 'ward').get(id=complaint_id)

        self.assertEqual(complaint.status, Complaint.Status.SUBMITTED)
        self.assertEqual(complaint.department, self.dept_pwd)
        self.assertEqual(complaint.department.short_name, 'PWD')
        self.assertEqual(complaint.ward, self.ward_1)
        self.assertTrue(complaint.images.filter(image_type=ComplaintImage.ImageType.COMPLAINT).exists())
        mock_ai_delay.assert_called_once_with(str(complaint.id))

        # ------------------------------------------------------------------
        # Step 4: Run process_complaint_ai task synchronously (use CELERY_TASK_ALWAYS_EAGER=True in test settings)
        # ------------------------------------------------------------------
        with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
            process_complaint_ai(str(complaint.id))

        # ------------------------------------------------------------------
        # Step 5: Assert: complaint status changed (Validated or Pending Validation)
        # ------------------------------------------------------------------
        complaint.refresh_from_db()
        self.assertIn(complaint.status, ['Validated', 'Pending Validation'])

        # ------------------------------------------------------------------
        # Step 8 (Check early / independently): Test invalid assignment:
        # Try to assign worker from Ward 2 to Ward 1 complaint
        # Assert: raises ValidationError (dept+ward mismatch)
        # ------------------------------------------------------------------
        # Direct validator call assertion:
        with self.assertRaises(ValidationError) as ctx:
            validate_worker_assignment(self.worker_ward2, complaint)
        self.assertIn('assignment_error', ctx.exception.detail)

        # API call by officer trying to assign Ward 2 worker without override:
        self.client.force_authenticate(user=self.officer)
        invalid_assign_response = self.client.post(
            f'/api/v1/complaints/{complaint.id}/assign/',
            {'worker_id': str(self.worker_ward2.id)},
            format='json'
        )
        self.assertEqual(invalid_assign_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', invalid_assign_response.data)

        # ------------------------------------------------------------------
        # Step 6: Officer assigns worker: worker.dept=PWD, worker.ward=Ward1 (valid assignment)
        # ------------------------------------------------------------------
        valid_assign_response = self.client.post(
            f'/api/v1/complaints/{complaint.id}/assign/',
            {'worker_id': str(self.worker.id)},
            format='json'
        )
        self.assertEqual(valid_assign_response.status_code, status.HTTP_200_OK)

        # ------------------------------------------------------------------
        # Step 7: Assert: complaint.assigned_worker = worker, status=Assigned
        # ------------------------------------------------------------------
        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_worker, self.worker)
        self.assertEqual(complaint.status, Complaint.Status.ASSIGNED)

        # ------------------------------------------------------------------
        # Step 9: Worker marks In-Progress -> Assert: status=In-Progress
        # ------------------------------------------------------------------
        self.client.force_authenticate(user=self.worker)
        progress_response = self.client.post(
            f'/worker/tasks/{complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(progress_response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'In-Progress')

        # ------------------------------------------------------------------
        # Step 10: Worker tries to mark Work Done without proof photo -> Assert: returns 400 error
        # ------------------------------------------------------------------
        no_proof_response = self.client.post(
            f'/worker/tasks/{complaint.id}/status/',
            {'status': 'Work Done'},
            format='json'
        )
        self.assertEqual(no_proof_response.status_code, status.HTTP_400_BAD_REQUEST)
        complaint.refresh_from_db()
        # Status remains In-Progress
        self.assertEqual(complaint.status, 'In-Progress')

        # Also verify 400 through standard complaints API update endpoint
        no_proof_api_response = self.client.patch(
            f'/api/v1/complaints/{complaint.id}/update_status/',
            {'status': 'Work Done'},
            format='json'
        )
        self.assertEqual(no_proof_api_response.status_code, status.HTTP_400_BAD_REQUEST)

        # ------------------------------------------------------------------
        # Step 11: Worker uploads proof photo, marks Work Done -> Assert: status=Work Done
        # ------------------------------------------------------------------
        proof_photo = SimpleUploadedFile(
            name='pothole_repaired.jpg',
            content=self.dummy_image_bytes,
            content_type='image/jpeg'
        )
        work_done_response = self.client.post(
            f'/worker/tasks/{complaint.id}/status/',
            {'status': 'Work Done', 'proof': proof_photo},
            format='multipart'
        )
        self.assertEqual(work_done_response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Work Done')
        self.assertTrue(complaint.images.filter(image_type=ComplaintImage.ImageType.PROOF).exists())

        # ------------------------------------------------------------------
        # Step 12: Citizen verifies resolution (accepts)
        # Assert: status=Closed, rating saved, resolved_at set
        # ------------------------------------------------------------------
        self.client.force_authenticate(user=self.citizen)
        verify_payload = {
            'accepted': True,
            'rating': 5,
            'feedback': 'Excellent road patch work by Nagpur Municipal Corporation!',
        }
        verify_response = self.client.post(
            f'/api/v1/complaints/{complaint.id}/verify/',
            verify_payload,
            format='json'
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Closed')
        self.assertEqual(complaint.citizen_rating, 5)
        self.assertIsNotNone(complaint.resolved_at)

        # ------------------------------------------------------------------
        # Step 13: Test auto_close: create Work Done complaint with old date, run auto_close task
        # Assert: status=Closed
        # ------------------------------------------------------------------
        old_complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Old PWD work done awaiting verification',
            description='Field work completed more than 3 days ago without citizen action.',
            status='Work Done'
        )
        five_days_ago = timezone.now() - timedelta(days=5)
        Complaint.objects.filter(id=old_complaint.id).update(
            updated_at=five_days_ago,
            submitted_at=five_days_ago
        )

        auto_close()

        old_complaint.refresh_from_db()
        self.assertEqual(old_complaint.status, 'Closed')
        self.assertIsNotNone(old_complaint.resolved_at)

        # ------------------------------------------------------------------
        # RBAC Check 1: Citizen cannot access /worker/tasks/ (403)
        # ------------------------------------------------------------------
        self.client.force_authenticate(user=self.citizen)
        citizen_worker_resp = self.client.get('/worker/tasks/')
        self.assertEqual(citizen_worker_resp.status_code, status.HTTP_403_FORBIDDEN)

        citizen_worker_api_resp = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(citizen_worker_api_resp.status_code, status.HTTP_403_FORBIDDEN)

        # ------------------------------------------------------------------
        # RBAC Check 2: Worker cannot access /dashboard/kpi/ (403)
        # ------------------------------------------------------------------
        self.client.force_authenticate(user=self.worker)
        worker_kpi_resp = self.client.get('/dashboard/kpi/')
        self.assertEqual(worker_kpi_resp.status_code, status.HTTP_403_FORBIDDEN)

        worker_kpi_api_resp = self.client.get('/api/v1/dashboard/kpi/')
        self.assertEqual(worker_kpi_api_resp.status_code, status.HTTP_403_FORBIDDEN)

        # ------------------------------------------------------------------
        # RBAC Check 3: Officer can only see their own dept in dashboard
        # ------------------------------------------------------------------
        # Create an extra complaint under SWM department (dept_id=2)
        Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_waste,
            department=self.dept_swm,
            ward=self.ward_1,
            title='Garbage dump in Ward 1',
            description='Uncollected garbage container overflowing on sidewalk.',
            status=Complaint.Status.SUBMITTED
        )

        # Authenticate as PWD officer (dept_id=1)
        self.client.force_authenticate(user=self.officer)
        officer_dashboard_resp = self.client.get('/api/v1/dashboard/kpi/')
        self.assertEqual(officer_dashboard_resp.status_code, status.HTTP_200_OK)

        # Total PWD complaints in database
        expected_pwd_total = Complaint.objects.filter(department=self.dept_pwd).count()
        actual_officer_total = officer_dashboard_resp.data['total']
        self.assertEqual(actual_officer_total, expected_pwd_total)

        # SWM complaint should NOT be visible to PWD officer even if they pass ?dept_id=2
        attempt_override_resp = self.client.get('/api/v1/dashboard/kpi/?dept_id=2')
        self.assertEqual(attempt_override_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(attempt_override_resp.data['total'], expected_pwd_total)

    def test_rbac_citizen_forbidden_worker_tasks(self):
        """
        Confirms Citizen role is rejected with HTTP 403 when accessing worker tasks endpoints.
        """
        self.client.force_authenticate(user=self.citizen)
        for url in ['/worker/tasks/', '/api/v1/worker/tasks/']:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Citizen should receive 403 on {url}"
            )

    def test_rbac_worker_forbidden_dashboard_kpi(self):
        """
        Confirms Worker role is rejected with HTTP 403 when attempting to access executive KPI endpoints.
        """
        self.client.force_authenticate(user=self.worker)
        for url in ['/dashboard/kpi/', '/api/v1/dashboard/kpi/']:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Worker should receive 403 on {url}"
            )

    def test_rbac_officer_department_isolation(self):
        """
        Confirms Department Officers can only view analytics and complaints for their own department.
        """
        # Create 2 PWD complaints and 3 SWM complaints
        for i in range(2):
            Complaint.objects.create(
                citizen=self.citizen,
                category=self.cat_roads,
                department=self.dept_pwd,
                ward=self.ward_1,
                title=f'PWD Issue {i}',
                description='Pothole and road problem requiring attention.',
                status=Complaint.Status.SUBMITTED
            )
        for j in range(3):
            Complaint.objects.create(
                citizen=self.citizen,
                category=self.cat_waste,
                department=self.dept_swm,
                ward=self.ward_1,
                title=f'SWM Issue {j}',
                description='Garbage waste requiring municipal truck collection.',
                status=Complaint.Status.SUBMITTED
            )

        self.client.force_authenticate(user=self.officer)
        response = self.client.get('/api/v1/dashboard/kpi/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        pwd_count = Complaint.objects.filter(department=self.dept_pwd).count()
        self.assertEqual(response.data['total'], pwd_count)

    def test_worker_status_update_via_complaints_endpoint(self):
        """
        Validates that assigned workers can also update status to In-Progress and Work Done
        via the standard complaints API action with proof photo requirement enforced.
        """
        complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Worker update test',
            description='Checking status transition via complaints API update_status action.',
            status=Complaint.Status.ASSIGNED,
            assigned_worker=self.worker
        )

        self.client.force_authenticate(user=self.worker)

        # Transition to In-Progress
        res_prog = self.client.patch(
            f'/api/v1/complaints/{complaint.id}/update_status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(res_prog.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'In-Progress')

        # Attempt Work Done without proof -> 400
        res_no_proof = self.client.patch(
            f'/api/v1/complaints/{complaint.id}/update_status/',
            {'status': 'Work Done'},
            format='json'
        )
        self.assertEqual(res_no_proof.status_code, status.HTTP_400_BAD_REQUEST)

        # Work Done with proof photo -> 200
        proof = SimpleUploadedFile('proof.jpg', self.dummy_image_bytes, content_type='image/jpeg')
        res_done = self.client.patch(
            f'/api/v1/complaints/{complaint.id}/update_status/',
            {'status': 'Work Done', 'proof': proof},
            format='multipart'
        )
        self.assertEqual(res_done.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Work Done')
        self.assertTrue(complaint.images.filter(image_type=ComplaintImage.ImageType.PROOF).exists())

    def test_auto_close_task_ignores_recent_work_done(self):
        """
        Confirms complaints marked 'Work Done' within the last 3 days are NOT auto-closed.
        """
        recent_complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Recent PWD Work Done',
            description='Work was completed just a few hours ago.',
            status='Work Done'
        )
        # updated_at is within the last 24 hours
        auto_close()

        recent_complaint.refresh_from_db()
        # Should still be Work Done, NOT Closed
        self.assertEqual(recent_complaint.status, 'Work Done')
        self.assertIsNone(recent_complaint.resolved_at)
