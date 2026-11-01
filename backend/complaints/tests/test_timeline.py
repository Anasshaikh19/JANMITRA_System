"""
Unit and integration tests for StatusHistory Timeline API (JANMITRA).
Endpoint: GET /api/v1/complaints/:id/timeline/

Tests:
1. StatusHistory model fields and backward compatibility:
   - complaint (FK), old_status, new_status, changed_by (FK User), note/remarks, changed_at/created_at
   - __init__ kwargs support (remarks, created_at)
   - property getters and setters (remarks, created_at, status, updated_by, timestamp)
2. Permissions & Access Control:
   - Unauthenticated access returns 401 Unauthorized
   - Other citizen viewing complaint returns 403 Forbidden
   - Reporting citizen viewing own complaint returns 200 OK
   - Assigned worker and department officer returns 200 OK
   - Worker/Officer of different department returns 403 Forbidden
   - Superuser/Admin returns 200 OK
   - Non-existent complaint ID returns 404 Not Found
3. Timeline Output & Chronological Sorting:
   - Returns array of events: [{step: 'Submitted', timestamp: '...', actor: 'Citizen'}, ...]
   - Sorted chronologically
   - Accurate actor classification (Citizen, Field Worker, Department Officer, Admin, System)
   - Synthesizes initial 'Submitted' step if missing from history table
4. URL Resolution & Lookup:
   - Lookup by UUID primary key
   - Lookup by tracking ID (e.g., NMC-2026-...)
"""

import uuid
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from complaints.models import Category, Complaint, Department, StatusHistory, Ward
from complaints.serializers import TimelineEventSerializer, StatusHistorySerializer

User = get_user_model()


class StatusHistoryModelTests(TestCase):
    """
    Tests for StatusHistory model attributes, kwargs, and backward compatibility properties.
    """
    def setUp(self):
        self.ward, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1 Dharampeth'})
        self.dept, _ = Department.objects.update_or_create(id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'})
        self.category, _ = Category.objects.update_or_create(id=1, defaults={'name': 'Roads & Infrastructure', 'department': self.dept})
        self.citizen = User.objects.create_user(
            email='citizen_model@example.com',
            mobile='9821000001',
            full_name='Citizen Model Test',
            role=User.Role.CITIZEN,
            password='TestPassword123'
        )
        self.complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.category,
            department=self.dept,
            ward=self.ward,
            title='Road Pothole',
            description='Pothole in Dharampeth',
            location=Point(79.0882, 21.1458, srid=4326),
            address='West High Court Road',
            status='Submitted',
        )

    def test_model_fields_and_relations(self):
        history = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status='Submitted',
            new_status='Validated',
            changed_by=self.citizen,
            note='Validation remarks',
        )
        self.assertEqual(history.complaint, self.complaint)
        self.assertEqual(history.old_status, 'Submitted')
        self.assertEqual(history.new_status, 'Validated')
        self.assertEqual(history.changed_by, self.citizen)
        self.assertEqual(history.note, 'Validation remarks')
        self.assertIsNotNone(history.changed_at)

    def test_remarks_and_created_at_kwargs_and_properties(self):
        now = timezone.now()
        history = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status='Validated',
            new_status='Assigned',
            changed_by=self.citizen,
            remarks='Assigned by officer',
            created_at=now,
        )
        # Property getters
        self.assertEqual(history.remarks, 'Assigned by officer')
        self.assertEqual(history.note, 'Assigned by officer')
        self.assertEqual(history.created_at, history.changed_at)
        self.assertEqual(history.timestamp, history.changed_at)
        self.assertEqual(history.status, 'Assigned')
        self.assertEqual(history.updated_by, self.citizen)

        # Property setters
        history.remarks = 'Updated remark'
        self.assertEqual(history.note, 'Updated remark')
        history.status = 'In-Progress'
        self.assertEqual(history.new_status, 'In-Progress')

    def test_serializers_include_remarks_and_created_at(self):
        history = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status=None,
            new_status='Submitted',
            changed_by=self.citizen,
            note='Initial submission',
        )
        data = StatusHistorySerializer(history).data
        self.assertIn('remarks', data)
        self.assertIn('created_at', data)
        self.assertEqual(data['remarks'], 'Initial submission')


class ComplaintTimelineAPITests(TestCase):
    """
    Tests for GET /api/v1/complaints/:id/timeline/ endpoint.
    """
    def setUp(self):
        self.client = APIClient()

        # Seed Ward and Departments
        self.ward1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1 Dharampeth'})
        self.dept_pwd, _ = Department.objects.update_or_create(id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'})
        self.dept_swm, _ = Department.objects.update_or_create(id=2, defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'})

        # Seed Category (Roads -> PWD)
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )

        # Users
        self.citizen = User.objects.create_user(
            email='citizen@example.com',
            mobile='9820000001',
            full_name='Aarav Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward1,
            password='TestPassword123'
        )
        self.other_citizen = User.objects.create_user(
            email='other_citizen@example.com',
            mobile='9820000002',
            full_name='Priya Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward1,
            password='TestPassword123'
        )
        self.worker = User.objects.create_user(
            email='worker@pwd.gov.in',
            mobile='9810010001',
            full_name='Rajesh Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward1,
            password='TestPassword123'
        )
        self.officer = User.objects.create_user(
            email='officer@pwd.gov.in',
            mobile='9800000001',
            full_name='Sunil Officer',
            role=User.Role.DEPT_OFFICER,
            department=self.dept_pwd,
            password='TestPassword123'
        )
        self.other_dept_officer = User.objects.create_user(
            email='officer@swm.gov.in',
            mobile='9800000002',
            full_name='Kavita SWM Officer',
            role=User.Role.DEPT_OFFICER,
            department=self.dept_swm,
            password='TestPassword123'
        )
        self.admin = User.objects.create_superuser(
            email='admin@nmc.gov.in',
            mobile='9800000000',
            full_name='Super Admin',
            role=User.Role.ADMIN,
            password='AdminPassword123'
        )

        # Base Complaint
        self.complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward1,
            title='Large pothole on WHC Road',
            description='Deep pothole creating severe traffic hazard.',
            location=Point(79.0882, 21.1458, srid=4326),
            address='West High Court Road, Dharampeth',
            status='Submitted',
            assigned_worker=self.worker,
        )

    def test_unauthenticated_access_denied(self):
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_nonexistent_complaint_returns_404(self):
        self.client.force_authenticate(user=self.citizen)
        non_existent_id = uuid.uuid4()
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(non_existent_id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unauthorized_citizen_returns_403(self):
        # Other citizen attempts to access self.complaint timeline
        self.client.force_authenticate(user=self.other_citizen)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('permission', response.data.get('detail', '').lower())

    def test_other_dept_officer_returns_403(self):
        self.client.force_authenticate(user=self.other_dept_officer)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporting_citizen_can_view_timeline(self):
        self.client.force_authenticate(user=self.citizen)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_assigned_worker_can_view_timeline(self):
        self.client.force_authenticate(user=self.worker)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_dept_officer_can_view_timeline(self):
        self.client.force_authenticate(user=self.officer)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_view_any_timeline(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_lookup_by_tracking_id(self):
        self.client.force_authenticate(user=self.citizen)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': self.complaint.tracking_id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_synthesized_submitted_step_when_no_history_records_exist(self):
        # Empty StatusHistory table for complaint
        StatusHistory.objects.filter(complaint=self.complaint).delete()

        self.client.force_authenticate(user=self.citizen)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        first_step = response.data[0]
        self.assertEqual(first_step['step'], 'Submitted')
        self.assertEqual(first_step['actor'], 'Citizen')
        self.assertEqual(first_step['actor_name'], self.citizen.get_full_name())
        self.assertIsNotNone(first_step['timestamp'])

    def test_full_lifecycle_timeline_chronological_ordering_and_actors(self):
        # Clear any existing history records
        StatusHistory.objects.filter(complaint=self.complaint).delete()

        base_time = timezone.now() - timedelta(hours=5)

        # 1. Submitted by Citizen
        h1 = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status=None,
            new_status='Submitted',
            changed_by=self.citizen,
            note='Grievance submitted by citizen',
        )
        StatusHistory.objects.filter(id=h1.id).update(changed_at=base_time)

        # 2. Validated by AI / System (no user)
        h2 = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status='Submitted',
            new_status='Validated',
            changed_by=None,
            note='Automated AI duplicate and fraud validation passed',
        )
        StatusHistory.objects.filter(id=h2.id).update(changed_at=base_time + timedelta(minutes=15))

        # 3. Assigned by Department Officer
        h3 = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status='Validated',
            new_status='Assigned',
            changed_by=self.officer,
            note='Assigned to Rajesh for field resolution',
        )
        StatusHistory.objects.filter(id=h3.id).update(changed_at=base_time + timedelta(hours=1))

        # 4. In-Progress by Worker
        h4 = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status='Assigned',
            new_status='In-Progress',
            changed_by=self.worker,
            note='Worker reached site, road leveling started',
        )
        StatusHistory.objects.filter(id=h4.id).update(changed_at=base_time + timedelta(hours=2))

        # 5. Work Done by Worker
        h5 = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status='In-Progress',
            new_status='Work Done',
            changed_by=self.worker,
            note='Pothole filling completed with tar and asphalt',
        )
        StatusHistory.objects.filter(id=h5.id).update(changed_at=base_time + timedelta(hours=3))

        # 6. Closed by Citizen
        h6 = StatusHistory.objects.create(
            complaint=self.complaint,
            old_status='Work Done',
            new_status='Closed',
            changed_by=self.citizen,
            note='Citizen verified and rated 5 stars',
        )
        StatusHistory.objects.filter(id=h6.id).update(changed_at=base_time + timedelta(hours=4))

        # Query API
        self.client.force_authenticate(user=self.citizen)
        url = reverse('complaints:complaint-timeline', kwargs={'pk': str(self.complaint.id)})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        events = response.data
        self.assertEqual(len(events), 6)

        # Expected chronological steps and actor mapping
        expected = [
            ('Submitted', 'Citizen', 'Grievance submitted by citizen'),
            ('Validated', 'System', 'Automated AI duplicate and fraud validation passed'),
            ('Assigned', 'Department Officer', 'Assigned to Rajesh for field resolution'),
            ('In-Progress', 'Field Worker', 'Worker reached site, road leveling started'),
            ('Work Done', 'Field Worker', 'Pothole filling completed with tar and asphalt'),
            ('Closed', 'Citizen', 'Citizen verified and rated 5 stars'),
        ]

        for i, (exp_step, exp_actor, exp_remarks) in enumerate(expected):
            event = events[i]
            self.assertEqual(event['step'], exp_step, f"Step mismatch at index {i}")
            self.assertEqual(event['actor'], exp_actor, f"Actor mismatch at index {i}")
            self.assertEqual(event['remarks'], exp_remarks, f"Remarks mismatch at index {i}")
            self.assertIn('timestamp', event)
            self.assertIn('created_at', event)
            self.assertIn('old_status', event)
            self.assertIn('new_status', event)

        # Verify strict chronological sorting
        for i in range(len(events) - 1):
            self.assertLessEqual(events[i]['timestamp'], events[i + 1]['timestamp'])
