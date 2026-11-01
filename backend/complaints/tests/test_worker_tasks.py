"""
Unit and integration tests for Worker Task List API endpoint (JANMITRA).
Endpoint: GET /api/v1/worker/tasks/ and /worker/tasks/

Tests:
1. Permissions:
   - Unauthenticated (401)
   - Citizen role (403)
   - Dept Officer role (403)
   - Field Worker role (200)
2. Department & Ward isolation:
   - Worker only receives tasks matching department == user.department AND ward == user.ward
   - Tasks from different departments or wards are excluded
   - Worker with unconfigured department/ward receives empty list
3. Query parameter filtering:
   - ?status=assigned, ?status=in_progress, ?status=completed
   - ?priority=high, ?priority=critical, ?priority=medium
   - Combined ?status=assigned&priority=high
4. Return fields and schema:
   - Validates all 11 required fields:
     id, complaint_id, category, description, photos, location_lat,
     location_lng, address, priority, status, created_at.
   - Validates photos array and coordinate mappings.
"""

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from complaints.models import Category, Complaint, ComplaintImage, Department, StatusHistory, Ward
from complaints.serializers import (
    WorkerComplaintSerializer,
    WorkerProofUploadSerializer,
    WorkerTaskStatusUpdateSerializer,
)
from complaints.tasks import send_push_notification, trigger_work_done
from notifications.models import Notification

User = get_user_model()


class WorkerTaskListViewTestCase(TestCase):
    """
    Comprehensive test suite for WorkerTaskListView and WorkerComplaintSerializer.
    """

    def setUp(self):
        self.client = APIClient()

        # Seed Departments
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        self.dept_swm, _ = Department.objects.update_or_create(
            id=2, defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'}
        )

        # Seed Wards
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward_2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})

        # Seed Categories
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1, defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )
        self.cat_waste, _ = Category.objects.update_or_create(
            id=2, defaults={'name': 'Garbage & Waste Management', 'department': self.dept_swm}
        )

        # Seed Users
        self.citizen, _ = User.objects.update_or_create(
            mobile='9820000099',
            defaults={
                'full_name': 'Citizen Test User',
                'role': User.Role.CITIZEN,
                'ward': self.ward_1,
            }
        )

        self.dept_officer, _ = User.objects.update_or_create(
            mobile='9800000099',
            defaults={
                'full_name': 'PWD Officer Test',
                'role': User.Role.DEPT_OFFICER,
                'department': self.dept_pwd,
                'ward': self.ward_1,
            }
        )

        # Worker 1: PWD, Ward 1
        self.worker_pwd_w1, _ = User.objects.update_or_create(
            mobile='9810010099',
            defaults={
                'full_name': 'PWD Field Worker W1',
                'role': User.Role.WORKER,
                'department': self.dept_pwd,
                'ward': self.ward_1,
            }
        )

        # Worker 2: SWM, Ward 2
        self.worker_swm_w2, _ = User.objects.update_or_create(
            mobile='9810020099',
            defaults={
                'full_name': 'SWM Field Worker W2',
                'role': User.Role.WORKER,
                'department': self.dept_swm,
                'ward': self.ward_2,
            }
        )

        # Worker without ward/dept
        self.worker_unassigned, _ = User.objects.update_or_create(
            mobile='9810099999',
            defaults={
                'full_name': 'Unassigned Worker',
                'role': User.Role.WORKER,
            }
        )

        # Seed Complaints:
        # C1: PWD, Ward 1, ASSIGNED, HIGH priority, with photo
        self.c1 = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Major Pothole on Sitabuldi Main Road',
            description='Severe pothole 2 feet wide causing traffic hazard.',
            location=Point(79.0882, 21.1458, srid=4326),
            address='Sitabuldi Main Road, Ward 1',
            status=Complaint.Status.ASSIGNED,
            priority_level=Complaint.Priority.HIGH,
        )
        self.c1_img1 = ComplaintImage.objects.create(
            complaint=self.c1,
            image='complaints/pothole1.jpg',
            image_type=ComplaintImage.ImageType.COMPLAINT,
        )
        self.c1_img2 = ComplaintImage.objects.create(
            complaint=self.c1,
            image='complaints/pothole2.jpg',
            image_type=ComplaintImage.ImageType.COMPLAINT,
        )

        # C2: PWD, Ward 1, In-Progress, MEDIUM priority
        self.c2 = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Damaged pavement kerb',
            description='Damaged pavement kerb outside municipal school.',
            location=Point(79.0890, 21.1465, srid=4326),
            address='West High Court Road, Ward 1',
            status=Complaint.Status.IN_PROGRESS_ALT,  # 'In-Progress'
            priority_level=Complaint.Priority.MEDIUM,
        )

        # C3: PWD, Ward 1, Work Done, CRITICAL priority
        self.c3 = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Bridge expansion joint gap',
            description='Critical expansion joint gap on flyover approach.',
            location=Point(79.0910, 21.1480, srid=4326),
            address='Ramdaspeth Flyover, Ward 1',
            status=Complaint.Status.WORK_DONE,  # 'Work Done'
            priority_level=Complaint.Priority.CRITICAL,
        )

        # C4: PWD, Ward 2 (different ward)
        self.c4 = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_2,
            title='Manhole cover cracked Ward 2',
            description='Cracked manhole cover on Ward 2 ring road.',
            location=Point(79.0950, 21.1500, srid=4326),
            address='Ring Road, Ward 2',
            status=Complaint.Status.ASSIGNED,
            priority_level=Complaint.Priority.HIGH,
        )

        # C5: SWM, Ward 1 (different department)
        self.c5 = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_waste,
            department=self.dept_swm,
            ward=self.ward_1,
            title='Garbage accumulation Ward 1',
            description='Uncollected waste dump near commercial market.',
            location=Point(79.0870, 21.1450, srid=4326),
            address='Market Area, Ward 1',
            status=Complaint.Status.ASSIGNED,
            priority_level=Complaint.Priority.HIGH,
        )

        # C6: SWM, Ward 2 (SWM Worker task)
        self.c6 = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_waste,
            department=self.dept_swm,
            ward=self.ward_2,
            title='Overflowing community bin Ward 2',
            description='Garbage overflowing from main community bin.',
            location=Point(79.0980, 21.1550, srid=4326),
            address='Dharampeth, Ward 2',
            status=Complaint.Status.ASSIGNED,
            priority_level=Complaint.Priority.MEDIUM,
        )

    # -------------------------------------------------------------------------
    # 1. Authentication & Permission Tests
    # -------------------------------------------------------------------------

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated GET /api/v1/worker/tasks/ returns 401 Unauthorized."""
        response = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_citizen_forbidden(self):
        """Authenticated citizen receives 403 Forbidden."""
        self.client.force_authenticate(user=self.citizen)
        response = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dept_officer_forbidden(self):
        """Authenticated dept officer receives 403 Forbidden."""
        self.client.force_authenticate(user=self.dept_officer)
        response = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_field_worker_authorized(self):
        """Authenticated field worker receives 200 OK."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_both_url_routes_work(self):
        """Both /api/v1/worker/tasks/ and /worker/tasks/ return identical status."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        for url in ['/api/v1/worker/tasks/', '/worker/tasks/']:
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # 2. Department & Ward Scoping Tests
    # -------------------------------------------------------------------------

    def test_department_and_ward_automatic_filtering(self):
        """
        Worker in PWD, Ward 1 only receives complaints where
        department == PWD and ward == Ward 1 (C1, C2, C3).
        Excludes C4 (PWD, Ward 2) and C5 (SWM, Ward 1).
        """
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        task_ids = [t['id'] for t in response.data]
        expected_ids = [str(self.c1.id), str(self.c2.id), str(self.c3.id)]
        self.assertEqual(len(task_ids), 3)
        for eid in expected_ids:
            self.assertIn(eid, task_ids)

        # Confirm cross-department and cross-ward complaints are excluded
        self.assertNotIn(str(self.c4.id), task_ids)
        self.assertNotIn(str(self.c5.id), task_ids)
        self.assertNotIn(str(self.c6.id), task_ids)

    def test_different_worker_department_and_ward(self):
        """
        Worker in SWM, Ward 2 only receives complaints where
        department == SWM and ward == Ward 2 (C6).
        """
        self.client.force_authenticate(user=self.worker_swm_w2)
        response = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c6.id)])

    def test_worker_unconfigured_department_ward_returns_empty(self):
        """Worker with no assigned department or ward receives empty list."""
        self.client.force_authenticate(user=self.worker_unassigned)
        response = self.client.get('/api/v1/worker/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # -------------------------------------------------------------------------
    # 3. Query Parameter Filtering Tests
    # -------------------------------------------------------------------------

    def test_filter_by_status_assigned(self):
        """Query param ?status=assigned returns only ASSIGNED complaints."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?status=assigned')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c1.id)])
        self.assertEqual(response.data[0]['status'], 'ASSIGNED')

    def test_filter_by_status_in_progress(self):
        """Query param ?status=in_progress returns In-Progress complaints."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?status=in_progress')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c2.id)])
        self.assertEqual(response.data[0]['status'], 'In-Progress')

    def test_filter_by_status_completed(self):
        """Query param ?status=completed returns Work Done / Resolved / Closed complaints."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?status=completed')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c3.id)])
        self.assertEqual(response.data[0]['status'], 'Work Done')

    def test_filter_by_priority_high(self):
        """Query param ?priority=high returns only HIGH priority complaints."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?priority=high')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c1.id)])
        self.assertEqual(response.data[0]['priority'], 'HIGH')

    def test_filter_by_priority_critical(self):
        """Query param ?priority=critical returns only CRITICAL priority complaints."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?priority=critical')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c3.id)])
        self.assertEqual(response.data[0]['priority'], 'CRITICAL')

    def test_filter_by_priority_medium(self):
        """Query param ?priority=medium returns only MEDIUM priority complaints."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?priority=medium')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c2.id)])
        self.assertEqual(response.data[0]['priority'], 'MEDIUM')

    def test_combined_status_and_priority_filter(self):
        """Query params ?status=assigned&priority=high matches C1."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?status=assigned&priority=high')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertEqual(task_ids, [str(self.c1.id)])

    def test_combined_filter_no_match(self):
        """Query params with mutually exclusive filter returns empty list."""
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?status=completed&priority=high')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # -------------------------------------------------------------------------
    # 4. Return Fields and Serializer Schema Tests
    # -------------------------------------------------------------------------

    def test_return_fields_exact_match(self):
        """
        Validates all 11 return fields required by specification:
        id, complaint_id, category, description, photos, location_lat,
        location_lng, address, priority, status, created_at.
        """
        self.client.force_authenticate(user=self.worker_pwd_w1)
        response = self.client.get('/api/v1/worker/tasks/?status=assigned')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        task = response.data[0]
        required_fields = {
            'id',
            'complaint_id',
            'category',
            'description',
            'photos',
            'location_lat',
            'location_lng',
            'address',
            'priority',
            'status',
            'created_at',
        }
        self.assertTrue(required_fields.issubset(task.keys()))

        # Field value validations
        self.assertEqual(task['id'], str(self.c1.id))
        self.assertEqual(task['complaint_id'], self.c1.tracking_id)
        self.assertEqual(task['category'], 'Roads & Infrastructure')
        self.assertEqual(task['description'], self.c1.description)
        self.assertEqual(task['address'], self.c1.address)
        self.assertEqual(task['priority'], 'HIGH')
        self.assertEqual(task['status'], 'ASSIGNED')

        # Coordinates
        self.assertAlmostEqual(task['location_lat'], 21.1458, places=4)
        self.assertAlmostEqual(task['location_lng'], 79.0882, places=4)

        # Photos list
        self.assertIsInstance(task['photos'], list)
        self.assertEqual(len(task['photos']), 2)
        for photo_url in task['photos']:
            self.assertTrue('pothole' in photo_url)

        # created_at timestamp
        self.assertIsNotNone(task['created_at'])

    def test_serializer_direct_usage(self):
        """Directly tests WorkerComplaintSerializer output."""
        serializer = WorkerComplaintSerializer(self.c1)
        data = serializer.data
        self.assertEqual(data['complaint_id'], self.c1.tracking_id)
        self.assertEqual(data['category'], self.cat_roads.name)
        self.assertEqual(data['priority'], 'HIGH')
        self.assertEqual(len(data['photos']), 2)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class WorkerTaskStatusUpdateTestCase(TestCase):
    """
    Comprehensive test suite for WorkerTaskStatusUpdateView:
    1. Endpoint: PATCH /api/v1/worker/tasks/:id/status/
    2. Validation rules:
       - Only assigned worker can update status.
       - 'In-Progress' allowed only from 'Assigned'.
       - 'Work Done' requires at least 1 proof-of-work photo in request.
    3. Automatically creates StatusHistory entry:
       - changed_by = request.user, old_status, new_status, timestamp.
    4. Triggers trigger_work_done notification to citizen when Work Done.
    """

    def setUp(self):
        self.client = APIClient()

        # Seed Dept, Ward, Category
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1, defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )

        # Citizen
        self.citizen, _ = User.objects.update_or_create(
            mobile='9820000101',
            defaults={'full_name': 'Citizen Amit', 'role': User.Role.CITIZEN, 'ward': self.ward_1}
        )

        # Worker 1 (assigned to task)
        self.assigned_worker, _ = User.objects.update_or_create(
            mobile='9810010101',
            defaults={
                'full_name': 'Worker Ramesh',
                'role': User.Role.WORKER,
                'department': self.dept_pwd,
                'ward': self.ward_1,
            }
        )

        # Worker 2 (different worker, not assigned)
        self.other_worker, _ = User.objects.update_or_create(
            mobile='9810010102',
            defaults={
                'full_name': 'Worker Suresh',
                'role': User.Role.WORKER,
                'department': self.dept_pwd,
                'ward': self.ward_1,
            }
        )

        # Department Officer
        self.dept_officer, _ = User.objects.update_or_create(
            mobile='9800000101',
            defaults={
                'full_name': 'Officer Verma',
                'role': User.Role.DEPT_OFFICER,
                'department': self.dept_pwd,
                'ward': self.ward_1,
            }
        )

        # Complaint in ASSIGNED status, assigned to Worker 1
        self.complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Dangerous open pothole on Ward 1 Main Road',
            description='Deep pothole requiring asphalt filling and levelling.',
            status=Complaint.Status.ASSIGNED,
            priority_level=Complaint.Priority.HIGH,
            assigned_worker=self.assigned_worker,
        )

        # Dummy JPEG bytes for proof photo upload
        self.dummy_proof = SimpleUploadedFile(
            name='proof_repair.jpg',
            content=b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9',
            content_type='image/jpeg'
        )

    # -------------------------------------------------------------------------
    # 1. Permissions & RBAC
    # -------------------------------------------------------------------------

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated PATCH returns HTTP 401 Unauthorized."""
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_citizen_forbidden(self):
        """Citizen cannot update worker task status (403 Forbidden)."""
        self.client.force_authenticate(user=self.citizen)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dept_officer_forbidden(self):
        """Dept Officer cannot call worker task status update endpoint (403 Forbidden)."""
        self.client.force_authenticate(user=self.dept_officer)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 2. Rule 1: Only assigned worker can update status
    # -------------------------------------------------------------------------

    def test_unassigned_worker_cannot_update_status(self):
        """Worker 2 (not assigned to this complaint) receives 403 Forbidden."""
        self.client.force_authenticate(user=self.other_worker)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Only the assigned worker', str(response.data))

    def test_complaint_with_no_assigned_worker_cannot_be_updated(self):
        """If complaint has assigned_worker=None, worker receives 403 Forbidden."""
        self.complaint.assigned_worker = None
        self.complaint.save()

        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 3. Rule 2: 'In-Progress' allowed only from 'Assigned'
    # -------------------------------------------------------------------------

    def test_in_progress_from_assigned_succeeds(self):
        """Transitioning from 'ASSIGNED' to 'In-Progress' succeeds (HTTP 200)."""
        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress', 'note': 'Worker initiated asphalt levelling.'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'In-Progress')

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'In-Progress')

        # Check StatusHistory audit entry (Rule 3)
        history = StatusHistory.objects.filter(complaint=self.complaint).last()
        self.assertIsNotNone(history)
        self.assertEqual(history.changed_by, self.assigned_worker)
        self.assertEqual(history.old_status, 'ASSIGNED')
        self.assertEqual(history.new_status, 'In-Progress')
        self.assertIsNotNone(history.timestamp)
        self.assertIn('asphalt levelling', history.note)

    def test_in_progress_not_allowed_from_submitted(self):
        """Transitioning to 'In-Progress' when complaint is 'SUBMITTED' is rejected (400)."""
        self.complaint.status = Complaint.Status.SUBMITTED
        self.complaint.save()

        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('In-Progress', str(response.data))

    def test_in_progress_not_allowed_from_in_progress(self):
        """Transitioning to 'In-Progress' when already 'In-Progress' is rejected (400)."""
        self.complaint.status = 'In-Progress'
        self.complaint.save()

        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------------------
    # 4. Rule 3: 'Work Done' requires at least 1 proof-of-work photo in request
    # -------------------------------------------------------------------------

    def test_work_done_without_proof_photo_fails(self):
        """Attempting to mark 'Work Done' without proof photo returns HTTP 400."""
        self.complaint.status = 'In-Progress'
        self.complaint.save()

        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {'status': 'Work Done'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Status remains untouched
        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'In-Progress')

    def test_work_done_with_proof_photo_succeeds_and_creates_history_and_notification(self):
        """
        Transitioning to 'Work Done' with proof photo attached:
        1. Succeeds (HTTP 200).
        2. Status updated to 'Work Done'.
        3. ComplaintImage record created with image_type='proof'.
        4. StatusHistory record created with changed_by, old_status, new_status, timestamp.
        5. Triggers trigger_work_done notification to citizen.
        """
        self.complaint.status = 'In-Progress'
        self.complaint.save()

        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.patch(
            f'/api/v1/worker/tasks/{self.complaint.id}/status/',
            {
                'status': 'Work Done',
                'note': 'Pothole filled with bitulac hot mix, surface levelled.',
                'proof': self.dummy_proof
            },
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Work Done')

        self.complaint.refresh_from_db()
        self.assertEqual(self.complaint.status, 'Work Done')
        self.assertIsNotNone(self.complaint.resolved_at)

        # Proof image saved
        proof_images = self.complaint.images.filter(image_type=ComplaintImage.ImageType.PROOF)
        self.assertEqual(proof_images.count(), 1)

        # StatusHistory audit
        history = StatusHistory.objects.filter(complaint=self.complaint).last()
        self.assertIsNotNone(history)
        self.assertEqual(history.changed_by, self.assigned_worker)
        self.assertEqual(history.old_status, 'In-Progress')
        self.assertEqual(history.new_status, 'Work Done')
        self.assertIsNotNone(history.timestamp)
        self.assertIn('hot mix', history.note)

        # Notification dispatched to citizen (Rule 4)
        notification = Notification.objects.filter(
            recipient=self.citizen,
            complaint=self.complaint
        ).last()
        self.assertIsNotNone(notification)
        self.assertIn('Work', notification.title)
        self.assertIn(self.complaint.tracking_id, notification.title)

    # -------------------------------------------------------------------------
    # 5. Invalid Status & Edge Cases
    # -------------------------------------------------------------------------

    def test_invalid_status_rejected(self):
        """Worker cannot transition to unauthorized statuses like 'Closed' or 'Random'."""
        self.client.force_authenticate(user=self.assigned_worker)
        for bad_status in ['Closed', 'Invalid', 'SUBMITTED', 'REOPENED', 'Unknown']:
            response = self.client.patch(
                f'/api/v1/worker/tasks/{self.complaint.id}/status/',
                {'status': bad_status},
                format='json'
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_complaint_returns_404(self):
        """Updating status for a non-existent complaint returns HTTP 404."""
        self.client.force_authenticate(user=self.assigned_worker)
        import uuid
        fake_id = uuid.uuid4()
        response = self.client.patch(
            f'/api/v1/worker/tasks/{fake_id}/status/',
            {'status': 'In-Progress'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_direct_trigger_work_done_task(self):
        """Directly tests trigger_work_done Celery task execution."""
        result = trigger_work_done(str(self.complaint.id))
        self.assertIn('created for citizen', result)

        notification = Notification.objects.filter(
            recipient=self.citizen,
            complaint=self.complaint
        ).first()
        self.assertIsNotNone(notification)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class WorkerProofUploadTestCase(TestCase):
    """
    Test suite for WorkerProofUploadView (POST /api/v1/worker/tasks/:id/proof/):
    1. Endpoint accepts multipart/form-data with proof_images and remarks.
    2. Only assigned worker can upload proof.
    3. Saves uploaded files into ComplaintImage model with image_type='proof'.
    4. Sets complaint.status = 'Work Done' and complaint.resolved_at = timezone.now().
    5. Calls Celery task send_push_notification to citizen recipient.
    """

    def setUp(self):
        self.client = APIClient()

        # Seed Dept, Ward, Category
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1, defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )

        # Citizen
        self.citizen, _ = User.objects.update_or_create(
            mobile='9820000201',
            defaults={'full_name': 'Citizen Rahul', 'role': User.Role.CITIZEN, 'ward': self.ward_1}
        )

        # Assigned Worker
        self.assigned_worker, _ = User.objects.update_or_create(
            mobile='9810010201',
            defaults={
                'full_name': 'Worker Anil',
                'role': User.Role.WORKER,
                'department': self.dept_pwd,
                'ward': self.ward_1,
            }
        )

        # Unassigned Worker
        self.other_worker, _ = User.objects.update_or_create(
            mobile='9810010202',
            defaults={
                'full_name': 'Worker Vijay',
                'role': User.Role.WORKER,
                'department': self.dept_pwd,
                'ward': self.ward_1,
            }
        )

        # Officer
        self.officer, _ = User.objects.update_or_create(
            mobile='9800000201',
            defaults={'full_name': 'Officer Kulkarni', 'role': User.Role.DEPT_OFFICER, 'department': self.dept_pwd}
        )

        # Active Complaint
        self.complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            title='Burst water pipe flooding pavement',
            description='Severe water leakage flooding the road and pedestrian path.',
            status='In-Progress',
            priority_level=Complaint.Priority.HIGH,
            assigned_worker=self.assigned_worker,
        )

        self.dummy_proof = SimpleUploadedFile(
            name='repaired_pipe.jpg',
            content=b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9',
            content_type='image/jpeg'
        )

    def test_unauthenticated_rejected(self):
        """Unauthenticated request to proof upload returns 401 Unauthorized."""
        response = self.client.post(
            f'/api/v1/worker/tasks/{self.complaint.id}/proof/',
            {'proof_images': self.dummy_proof},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_citizen_forbidden(self):
        """Citizen cannot upload proof of work (403 Forbidden)."""
        self.client.force_authenticate(user=self.citizen)
        response = self.client.post(
            f'/api/v1/worker/tasks/{self.complaint.id}/proof/',
            {'proof_images': self.dummy_proof},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unassigned_worker_forbidden(self):
        """Worker not assigned to this complaint receives 403 Forbidden."""
        self.client.force_authenticate(user=self.other_worker)
        response = self.client.post(
            f'/api/v1/worker/tasks/{self.complaint.id}/proof/',
            {'proof_images': self.dummy_proof},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Only the assigned worker', str(response.data))

    def test_upload_missing_proof_images_fails(self):
        """Uploading without proof_images returns 400 Bad Request."""
        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.post(
            f'/api/v1/worker/tasks/{self.complaint.id}/proof/',
            {'remarks': 'Completed without photo.'},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_proof_success_and_sets_work_done(self):
        """
        Assigned worker uploads proof_images:
        - 200 OK
        - Saves ComplaintImage with image_type='proof'
        - Sets complaint.status = 'Work Done'
        - Sets complaint.resolved_at = timezone.now()
        - Automatically creates StatusHistory audit record
        - Dispatches push notification to citizen
        """
        self.client.force_authenticate(user=self.assigned_worker)
        response = self.client.post(
            f'/api/v1/worker/tasks/{self.complaint.id}/proof/',
            {
                'proof_images': self.dummy_proof,
                'remarks': 'Pipe replaced and sealed with waterproof concrete jacket.'
            },
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Work Done')
        self.assertIn('repaired_pipe', str(response.data['proof_images']))

        # 3. Saves uploaded files into ComplaintImage model with image_type='proof'
        self.complaint.refresh_from_db()
        proof_images = self.complaint.images.filter(image_type=ComplaintImage.ImageType.PROOF)
        self.assertEqual(proof_images.count(), 1)
        self.assertEqual(proof_images.first().image_type, 'proof')

        # 4. Sets complaint.status = 'Work Done', complaint.resolved_at = timezone.now()
        self.assertEqual(self.complaint.status, 'Work Done')
        self.assertIsNotNone(self.complaint.resolved_at)

        # StatusHistory audit
        history = StatusHistory.objects.filter(complaint=self.complaint).last()
        self.assertIsNotNone(history)
        self.assertEqual(history.changed_by, self.assigned_worker)
        self.assertEqual(history.new_status, 'Work Done')
        self.assertIn('waterproof concrete', history.note)

        # 5. Calls Celery task send_push_notification to citizen recipient
        push_notification = Notification.objects.filter(
            recipient=self.citizen,
            notification_type=Notification.NotificationType.PUSH,
            complaint=self.complaint
        ).first()
        self.assertIsNotNone(push_notification)
        self.assertIn('Work Completed', push_notification.title)
        self.assertIn(self.complaint.tracking_id, push_notification.title)

    def test_multiple_proof_images_upload(self):
        """Accepts multiple proof images in multipart form data."""
        self.client.force_authenticate(user=self.assigned_worker)

        proof1 = SimpleUploadedFile(name='p1.jpg', content=self.dummy_proof.read(), content_type='image/jpeg')
        self.dummy_proof.seek(0)
        proof2 = SimpleUploadedFile(name='p2.jpg', content=self.dummy_proof.read(), content_type='image/jpeg')

        response = self.client.post(
            f'/api/v1/worker/tasks/{self.complaint.id}/proof/',
            {
                'proof_images': [proof1, proof2],
                'remarks': 'Two angle photos of the resolved road.'
            },
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.complaint.refresh_from_db()
        proof_count = self.complaint.images.filter(image_type=ComplaintImage.ImageType.PROOF).count()
        self.assertEqual(proof_count, 2)

    def test_direct_send_push_notification_task(self):
        """Directly verifies send_push_notification Celery task execution."""
        result = send_push_notification(
            self.citizen.id,
            "Direct Push Test",
            "Test message content",
            str(self.complaint.id)
        )
        self.assertIn('Push notification sent to user', result)

        notification = Notification.objects.filter(
            recipient=self.citizen,
            title="Direct Push Test"
        ).first()
        self.assertIsNotNone(notification)
        self.assertEqual(notification.notification_type, Notification.NotificationType.PUSH)

