"""
Unit and integration tests for complaints models and management commands.
"""

import uuid
from unittest.mock import patch
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.gis.geos import Point
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from complaints.models import (
    Department,
    Ward,
    Category,
    Complaint,
    ComplaintImage,
    StatusHistory,
)

User = get_user_model()


class ComplaintModelsTestCase(TestCase):
    """
    Validates model constraints, relationships, choices, and automated derivations.
    """

    def setUp(self):
        # 1. Departments
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1,
            defaults={'name': 'Public Works Dept', 'short_name': 'PWD'}
        )
        self.dept_swm, _ = Department.objects.update_or_create(
            id=2,
            defaults={'name': 'Solid Waste Mgmt', 'short_name': 'SWM'}
        )

        # 2. Wards
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward_2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})

        # 3. Categories
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )
        self.cat_waste, _ = Category.objects.update_or_create(
            id=2,
            defaults={'name': 'Garbage & Waste Management', 'department': self.dept_swm}
        )

        # 4. Users
        self.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Demo Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward_1
        )
        self.worker = User.objects.create_user(
            mobile='9810010001',
            full_name='Demo Worker',
            role=User.Role.WORKER,
            department=self.dept_pwd,
            ward=self.ward_1
        )

    def test_department_and_ward_str(self):
        self.assertEqual(str(self.dept_pwd), 'PWD - Public Works Dept')
        self.assertEqual(str(self.ward_1), 'Ward 1')

    def test_category_relationship(self):
        self.assertEqual(str(self.cat_roads), 'Roads & Infrastructure (PWD)')
        self.assertEqual(self.cat_roads.department, self.dept_pwd)

    def test_complaint_creation_and_auto_department_derivation(self):
        point = Point(79.0882, 21.1458, srid=4326)
        complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            ward=self.ward_1,
            title='Pothole on Main Road',
            description='Deep pothole causing traffic obstruction.',
            location=point,
            priority_level=Complaint.Priority.HIGH,
            priority_score=75.5,
            fake_detected=False,
            is_duplicate=False,
            assigned_worker=self.worker
        )

        # Verify UUID primary key
        self.assertIsInstance(complaint.id, uuid.UUID)
        self.assertTrue(complaint.tracking_id.startswith('NMC-'))

        # Department must be derived from category
        self.assertEqual(complaint.department, self.dept_pwd)

        # Status and Priority default/values
        self.assertEqual(complaint.status, Complaint.Status.SUBMITTED)
        self.assertEqual(complaint.priority_level, Complaint.Priority.HIGH)
        self.assertEqual(complaint.assigned_worker, self.worker)

        # Check PostGIS Point coordinates
        self.assertAlmostEqual(complaint.location.x, 79.0882)
        self.assertAlmostEqual(complaint.location.y, 21.1458)
        self.assertEqual(complaint.longitude, 79.0882)
        self.assertEqual(complaint.latitude, 21.1458)

    def test_citizen_rating_validation(self):
        complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            ward=self.ward_1,
            description='Test rating issue',
            citizen_rating=5
        )
        self.assertEqual(complaint.citizen_rating, 5)

        # Rating above 5 should fail clean validation
        complaint.citizen_rating = 6
        with self.assertRaises(ValidationError):
            complaint.full_clean()

    def test_complaint_image_model(self):
        complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            ward=self.ward_1,
            description='Issue with photo proof'
        )
        img = ComplaintImage.objects.create(
            complaint=complaint,
            image='complaints/test.jpg',
            image_type=ComplaintImage.ImageType.COMPLAINT
        )
        self.assertEqual(img.image_type, 'complaint')
        self.assertIsNotNone(img.uploaded_at)

        proof = ComplaintImage.objects.create(
            complaint=complaint,
            image='resolutions/proof.jpg',
            image_type=ComplaintImage.ImageType.PROOF
        )
        self.assertEqual(proof.image_type, 'proof')

    def test_status_history_model(self):
        complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=self.cat_roads,
            ward=self.ward_1,
            description='Issue with lifecycle'
        )
        history = StatusHistory.objects.create(
            complaint=complaint,
            old_status=Complaint.Status.SUBMITTED,
            new_status=Complaint.Status.IN_PROGRESS,
            changed_by=self.worker,
            note='Worker reached the location and commenced repairs.'
        )
        self.assertEqual(history.complaint, complaint)
        self.assertEqual(history.old_status, 'SUBMITTED')
        self.assertEqual(history.new_status, 'IN_PROGRESS')
        self.assertEqual(history.changed_by, self.worker)
        self.assertIsNotNone(history.changed_at)

    def test_seed_demo_command_execution(self):
        # Call command programmatically
        call_command('seed_demo')

        self.assertEqual(Department.objects.count(), 4)
        self.assertEqual(Ward.objects.count(), 4)
        self.assertEqual(Category.objects.count(), 4)
        self.assertEqual(User.objects.filter(role=User.Role.ADMIN).count(), 1)
        self.assertEqual(User.objects.filter(role=User.Role.DEPT_OFFICER).count(), 4)
        self.assertEqual(User.objects.filter(role=User.Role.WORKER).count(), 16)
        self.assertEqual(User.objects.filter(role=User.Role.CITIZEN).count(), 4)


class ComplaintAPITests(APITestCase):
    """
    Integration tests for civic complaint endpoints:
    - POST /api/v1/complaints/ (submission, validations, auto-dispatch, Point location, image upload)
    - GET /api/v1/complaints/ (role-based filtering, query params: my=true, status=X, ward=X)
    - GET /api/v1/complaints/:id/ (detail view, citizen ownership restriction)
    - POST /api/v1/complaints/:id/verify/ (citizen acceptance/rejection, rating, status history audit)
    - Exact URL resolutions and workflow protections
    """

    def setUp(self):
        # 1. Seed 4 Departments
        self.dept1, _ = Department.objects.update_or_create(id=1, defaults={'name': 'Public Works Dept', 'short_name': 'PWD'})
        self.dept2, _ = Department.objects.update_or_create(id=2, defaults={'name': 'Solid Waste Mgmt', 'short_name': 'SWM'})
        self.dept3, _ = Department.objects.update_or_create(id=3, defaults={'name': 'Water Works', 'short_name': 'PHE'})
        self.dept4, _ = Department.objects.update_or_create(id=4, defaults={'name': 'Street Lighting', 'short_name': 'ELEC'})

        # 2. Seed 4 Wards
        self.ward1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})
        self.ward3, _ = Ward.objects.update_or_create(id=3, defaults={'name': 'Ward 3'})
        self.ward4, _ = Ward.objects.update_or_create(id=4, defaults={'name': 'Ward 4'})

        # 3. Seed 4 Categories
        self.cat1, _ = Category.objects.update_or_create(id=1, defaults={'name': 'Roads & Infrastructure', 'department': self.dept1})
        self.cat2, _ = Category.objects.update_or_create(id=2, defaults={'name': 'Garbage & Waste Management', 'department': self.dept2})
        self.cat3, _ = Category.objects.update_or_create(id=3, defaults={'name': 'Water & Drainage', 'department': self.dept3})
        self.cat4, _ = Category.objects.update_or_create(id=4, defaults={'name': 'Street Lighting & Electrical', 'department': self.dept4})

        # 4. Seed Users
        self.citizen1 = User.objects.create_user(
            mobile='9820000001',
            full_name='Citizen One',
            email='citizen1@example.com',
            role=User.Role.CITIZEN,
            ward=self.ward1
        )
        self.citizen2 = User.objects.create_user(
            mobile='9820000002',
            full_name='Citizen Two',
            email='citizen2@example.com',
            role=User.Role.CITIZEN,
            ward=self.ward2
        )
        self.admin = User.objects.create_user(
            mobile='9800000000',
            full_name='Central Admin',
            email='admin@janmitra.gov.in',
            role=User.Role.ADMIN,
            is_staff=True
        )
        self.worker1 = User.objects.create_user(
            mobile='9810010001',
            full_name='Field Worker PWD',
            role=User.Role.WORKER,
            department=self.dept1,
            ward=self.ward1
        )
        self.worker2 = User.objects.create_user(
            mobile='9810010002',
            full_name='Field Worker SWM',
            role=User.Role.WORKER,
            department=self.dept2,
            ward=self.ward2
        )
        self.officer_pwd = User.objects.create_user(
            mobile='9800000001',
            full_name='PWD Officer',
            email='pwd.officer@janmitra.gov.in',
            role=User.Role.DEPT_OFFICER,
            department=self.dept1,
            ward=self.ward1,
            is_staff=True
        )
        self.officer_swm = User.objects.create_user(
            mobile='9800000002',
            full_name='SWM Officer',
            email='swm.officer@janmitra.gov.in',
            role=User.Role.DEPT_OFFICER,
            department=self.dept2,
            ward=self.ward2,
            is_staff=True
        )

        self.list_url = reverse('complaints:complaint-list')
        self.category_direct_url = reverse('category-list-direct')

    def create_dummy_image(self, name='test_evidence.gif', content=None):
        content = content or b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
        return SimpleUploadedFile(
            name,
            content,
            content_type='image/gif'
        )

    # 1. Successful complaint creation
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_complaint_create_success(self, mock_ai_delay, mock_notify_delay):
        self.client.force_authenticate(user=self.citizen1)
        image = self.create_dummy_image()

        payload = {
            'category': 1,
            'ward': 1,
            'description': 'Deep road pothole near Medical Square causing serious traffic jams.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [image],
            'address': 'Medical Square, Nagpur',
            'landmark': 'Near Government Medical College',
        }

        response = self.client.post(self.list_url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertIn('status', response.data)
        self.assertEqual(response.data['status'], 'SUBMITTED')

        # Auto-dispatch Celery tasks
        mock_ai_delay.assert_called_once_with(response.data['id'])
        mock_notify_delay.assert_called_once_with(response.data['id'])

        # Check DB state
        complaint = Complaint.objects.get(id=response.data['id'])
        self.assertEqual(complaint.category.id, 1)
        self.assertEqual(complaint.ward.id, 1)
        self.assertEqual(complaint.department, self.dept1)
        self.assertEqual(complaint.citizen, self.citizen1)
        self.assertAlmostEqual(complaint.location.x, 79.0882)
        self.assertAlmostEqual(complaint.location.y, 21.1458)
        self.assertEqual(complaint.images.count(), 1)
        self.assertTrue(complaint.status_history.exists())

    # 2. Non-citizen submission forbidden
    def test_complaint_create_non_citizen_forbidden(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            'category': 1,
            'ward': 1,
            'description': 'Admin attempting to submit civic complaint directly.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [self.create_dummy_image()],
        }
        response = self.client.post(self.list_url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 3. Department automatically derived from category
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_department_automatically_derived_from_category(self, mock_ai, mock_notify):
        self.client.force_authenticate(user=self.citizen1)
        payload = {
            'category': 2,  # Garbage & Waste -> linked to dept2 (SWM)
            'ward': 2,
            'description': 'Overflowing municipal garbage container on roadside.',
            'location_lat': 21.1460,
            'location_lng': 79.0890,
            'images': [self.create_dummy_image()],
        }
        response = self.client.post(self.list_url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        complaint = Complaint.objects.get(id=response.data['id'])
        self.assertEqual(complaint.department, self.dept2)
        self.assertEqual(complaint.department.short_name, 'SWM')

    # 4. Missing images validation
    def test_complaint_create_missing_images_fails(self):
        self.client.force_authenticate(user=self.citizen1)
        payload = {
            'category': 1,
            'ward': 1,
            'description': 'Valid description with more than 20 characters length.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
        }
        response = self.client.post(self.list_url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('images', response.data)

    # 5. Invalid image content and oversized uploads
    def test_invalid_image_content_and_oversized_upload(self):
        self.client.force_authenticate(user=self.citizen1)

        # Invalid type (text file)
        text_file = SimpleUploadedFile("malicious.txt", b"plain text content", content_type="text/plain")
        payload1 = {
            'category': 1,
            'ward': 1,
            'description': 'Testing invalid file type submission here.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [text_file],
        }
        res1 = self.client.post(self.list_url, payload1, format='multipart')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('images', res1.data)

        # Oversized file (> 10MB)
        huge_file = SimpleUploadedFile("huge.jpg", b"0" * (10 * 1024 * 1024 + 1024), content_type="image/jpeg")
        payload2 = {
            'category': 1,
            'ward': 1,
            'description': 'Testing oversized file upload submission here.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [huge_file],
        }
        res2 = self.client.post(self.list_url, payload2, format='multipart')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('images', res2.data)

    # 6. Multiple image uploads
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_complaint_create_multiple_images(self, mock_ai, mock_notify):
        self.client.force_authenticate(user=self.citizen1)
        img1 = self.create_dummy_image('img1.gif')
        img2 = self.create_dummy_image('img2.gif')
        img3 = self.create_dummy_image('img3.gif')

        payload = {
            'category': 1,
            'ward': 1,
            'description': 'Multiple angle evidence for deep road fracture.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [img1, img2, img3],
        }
        response = self.client.post(self.list_url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        complaint = Complaint.objects.get(id=response.data['id'])
        self.assertEqual(complaint.images.count(), 3)

    # 7. Invalid category and ward IDs
    def test_complaint_create_invalid_category_and_ward_ids(self):
        self.client.force_authenticate(user=self.citizen1)
        img = self.create_dummy_image()

        # Category out of range
        res1 = self.client.post(self.list_url, {
            'category': 5,
            'ward': 1,
            'description': 'Valid description with more than 20 characters length.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [img],
        }, format='multipart')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('category', res1.data)

        # Ward out of range
        res2 = self.client.post(self.list_url, {
            'category': 1,
            'ward': 5,
            'description': 'Valid description with more than 20 characters length.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [img],
        }, format='multipart')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', res2.data)

    # 8. Category/ward records missing from database
    def test_complaint_create_missing_category_and_ward_in_db(self):
        self.client.force_authenticate(user=self.citizen1)
        img = self.create_dummy_image()

        # Delete Category 4
        Category.objects.filter(id=4).delete()
        res1 = self.client.post(self.list_url, {
            'category': 4,
            'ward': 1,
            'description': 'Valid description with more than 20 characters length.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [img],
        }, format='multipart')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('category', res1.data)

        # Delete Ward 4
        Ward.objects.filter(id=4).delete()
        res2 = self.client.post(self.list_url, {
            'category': 1,
            'ward': 4,
            'description': 'Valid description with more than 20 characters length.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [img],
        }, format='multipart')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', res2.data)

    # 9. Description shorter than 20 characters
    def test_complaint_create_short_description_fails(self):
        self.client.force_authenticate(user=self.citizen1)
        res = self.client.post(self.list_url, {
            'category': 1,
            'ward': 1,
            'description': 'Pothole here',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [self.create_dummy_image()],
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('description', res.data)

    # 10. Invalid coordinates
    def test_complaint_create_invalid_coordinates(self):
        self.client.force_authenticate(user=self.citizen1)
        img = self.create_dummy_image()

        res1 = self.client.post(self.list_url, {
            'category': 1,
            'ward': 1,
            'description': 'Valid description with more than 20 characters length.',
            'location_lat': 95.0,  # Invalid lat > 90
            'location_lng': 79.0882,
            'images': [img],
        }, format='multipart')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('location_lat', res1.data)

        res2 = self.client.post(self.list_url, {
            'category': 1,
            'ward': 1,
            'description': 'Valid description with more than 20 characters length.',
            'location_lat': 21.1458,
            'location_lng': 185.0,  # Invalid lng > 180
            'images': [img],
        }, format='multipart')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('location_lng', res2.data)

    # 11. Correct location longitude/latitude order
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_correct_location_longitude_latitude_order(self, mock_ai, mock_notify):
        self.client.force_authenticate(user=self.citizen1)
        res = self.client.post(self.list_url, {
            'category': 1,
            'ward': 1,
            'description': 'Coordinate mapping verification complaint test.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [self.create_dummy_image()],
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        complaint = Complaint.objects.get(id=res.data['id'])
        self.assertAlmostEqual(complaint.location.x, 79.0882)
        self.assertAlmostEqual(complaint.location.y, 21.1458)
        self.assertAlmostEqual(complaint.longitude, 79.0882)
        self.assertAlmostEqual(complaint.latitude, 21.1458)

    # 12. Initial StatusHistory creation
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_initial_status_history_creation(self, mock_ai, mock_notify):
        self.client.force_authenticate(user=self.citizen1)
        res = self.client.post(self.list_url, {
            'category': 1,
            'ward': 1,
            'description': 'Initial audit trail validation complaint test.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [self.create_dummy_image()],
        }, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        complaint = Complaint.objects.get(id=res.data['id'])
        history = StatusHistory.objects.filter(complaint=complaint).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.new_status, 'SUBMITTED')
        self.assertEqual(history.changed_by, self.citizen1)

    # 13. Celery dispatch failure without complaint data loss
    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay', side_effect=Exception("Redis connection timed out"))
    def test_celery_dispatch_failure_without_complaint_data_loss(self, mock_ai, mock_notify):
        self.client.force_authenticate(user=self.citizen1)
        res = self.client.post(self.list_url, {
            'category': 1,
            'ward': 1,
            'description': 'Celery resilience verification complaint test.',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [self.create_dummy_image()],
        }, format='multipart')
        # Should succeed 201 without throwing 500 error
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        complaint = Complaint.objects.filter(id=res.data['id']).first()
        self.assertIsNotNone(complaint)
        self.assertEqual(complaint.status, 'SUBMITTED')

    # 14. Citizen complaint list and detail isolation
    def test_citizen_complaint_list_and_detail_isolation(self):
        c1 = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Citizen 1 issue description goes here.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        c2 = Complaint.objects.create(
            citizen=self.citizen2,
            category=self.cat2,
            ward=self.ward2,
            description='Citizen 2 issue description goes here.',
            location=Point(79.09, 21.15, srid=4326),
            status=Complaint.Status.SUBMITTED
        )

        self.client.force_authenticate(user=self.citizen1)
        # List isolation
        res_list = self.client.get(self.list_url)
        ids = [item['id'] for item in (res_list.data.get('results', res_list.data))]
        self.assertIn(str(c1.id), ids)
        self.assertNotIn(str(c2.id), ids)

        # Detail isolation
        url_c1 = reverse('complaints:complaint-detail', kwargs={'pk': c1.id})
        url_c2 = reverse('complaints:complaint-detail', kwargs={'pk': c2.id})
        self.assertEqual(self.client.get(url_c1).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(url_c2).status_code, status.HTTP_403_FORBIDDEN)

    # 15. Admin access
    def test_admin_access(self):
        c1 = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Citizen 1 issue description goes here.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        c2 = Complaint.objects.create(
            citizen=self.citizen2,
            category=self.cat2,
            ward=self.ward2,
            description='Citizen 2 issue description goes here.',
            location=Point(79.09, 21.15, srid=4326),
            status=Complaint.Status.SUBMITTED
        )

        self.client.force_authenticate(user=self.admin)
        res_list = self.client.get(self.list_url)
        ids = [item['id'] for item in (res_list.data.get('results', res_list.data))]
        self.assertIn(str(c1.id), admin_ids := ids)
        self.assertIn(str(c2.id), admin_ids)

        url_c1 = reverse('complaints:complaint-detail', kwargs={'pk': c1.id})
        url_c2 = reverse('complaints:complaint-detail', kwargs={'pk': c2.id})
        self.assertEqual(self.client.get(url_c1).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(url_c2).status_code, status.HTTP_200_OK)

    # 16. Officer and worker access restrictions
    def test_officer_and_worker_access_restrictions(self):
        c_pwd = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,  # PWD
            ward=self.ward1,
            description='PWD road pothole complaint issue.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.ASSIGNED,
            assigned_worker=self.worker1
        )
        c_swm = Complaint.objects.create(
            citizen=self.citizen2,
            category=self.cat2,  # SWM
            ward=self.ward2,
            description='SWM garbage dump complaint issue.',
            location=Point(79.09, 21.15, srid=4326),
            status=Complaint.Status.ASSIGNED,
            assigned_worker=self.worker2
        )

        url_pwd = reverse('complaints:complaint-detail', kwargs={'pk': c_pwd.id})
        url_swm = reverse('complaints:complaint-detail', kwargs={'pk': c_swm.id})

        # Worker 1 can only access complaint assigned to Worker 1
        self.client.force_authenticate(user=self.worker1)
        self.assertEqual(self.client.get(url_pwd).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(url_swm).status_code, status.HTTP_403_FORBIDDEN)

        # Officer PWD can only access PWD complaint
        self.client.force_authenticate(user=self.officer_pwd)
        self.assertEqual(self.client.get(url_pwd).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(url_swm).status_code, status.HTTP_403_FORBIDDEN)

    # 17. List filters
    def test_list_filters(self):
        c1 = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Issue one by citizen one in ward 1',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        c2 = Complaint.objects.create(
            citizen=self.citizen2,
            category=self.cat2,
            ward=self.ward2,
            description='Issue two by citizen two in ward 2',
            location=Point(79.09, 21.15, srid=4326),
            status=Complaint.Status.IN_PROGRESS
        )

        self.client.force_authenticate(user=self.admin)
        # Filter my=true
        res_my = self.client.get(f"{self.list_url}?my=true")
        self.assertEqual(len(res_my.data.get('results', res_my.data)), 0)

        # Filter status=IN_PROGRESS
        res_status = self.client.get(f"{self.list_url}?status=IN_PROGRESS")
        ids = [item['id'] for item in res_status.data.get('results', res_status.data)]
        self.assertIn(str(c2.id), ids)
        self.assertNotIn(str(c1.id), ids)

        # Filter ward=1
        res_ward = self.client.get(f"{self.list_url}?ward=1")
        ward_ids = [item['id'] for item in res_ward.data.get('results', res_ward.data)]
        self.assertIn(str(c1.id), ward_ids)
        self.assertNotIn(str(c2.id), ward_ids)

    # 18. Invalid filter values
    def test_invalid_filter_values(self):
        self.client.force_authenticate(user=self.admin)

        # Invalid status
        res1 = self.client.get(f"{self.list_url}?status=NON_EXISTENT_STATUS")
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', res1.data)

        # Invalid ward
        res2 = self.client.get(f"{self.list_url}?ward=999")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', res2.data)

        # Invalid my parameter
        res3 = self.client.get(f"{self.list_url}?my=maybe")
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('my', res3.data)

    # 19. Invalid verification input and rating
    def test_invalid_verification_input_and_rating(self):
        complaint = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint verification validation test.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.RESOLVED
        )
        verify_url = reverse('complaints:complaint-verify', kwargs={'pk': complaint.id})
        self.client.force_authenticate(user=self.citizen1)

        # Missing accepted
        res1 = self.client.post(verify_url, {}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Non-boolean accepted
        res2 = self.client.post(verify_url, {'accepted': 'true'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Accepted without rating
        res3 = self.client.post(verify_url, {'accepted': True}, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        # Accepted with out-of-range rating (0 or 6)
        res4 = self.client.post(verify_url, {'accepted': True, 'rating': 0}, format='json')
        self.assertEqual(res4.status_code, status.HTTP_400_BAD_REQUEST)

        res5 = self.client.post(verify_url, {'accepted': True, 'rating': 6}, format='json')
        self.assertEqual(res5.status_code, status.HTTP_400_BAD_REQUEST)

    # 20. Missing rejection reason
    def test_missing_rejection_reason(self):
        complaint = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint rejection validation test.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.RESOLVED
        )
        verify_url = reverse('complaints:complaint-verify', kwargs={'pk': complaint.id})
        self.client.force_authenticate(user=self.citizen1)

        # Missing reason
        res1 = self.client.post(verify_url, {'accepted': False}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Blank whitespace reason
        res2 = self.client.post(verify_url, {'accepted': False, 'reason': '   '}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    # 21. Invalid verification state transitions
    def test_invalid_verification_state_transitions(self):
        verify_url_fn = lambda cid: reverse('complaints:complaint-verify', kwargs={'pk': cid})
        self.client.force_authenticate(user=self.citizen1)

        # Cannot verify SUBMITTED complaint
        c_sub = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint still in submitted state.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        res1 = self.client.post(verify_url_fn(c_sub.id), {'accepted': True, 'rating': 5}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Cannot verify IN_PROGRESS complaint
        c_prog = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint currently in progress.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.IN_PROGRESS
        )
        res2 = self.client.post(verify_url_fn(c_prog.id), {'accepted': True, 'rating': 5}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Cannot re-verify already Closed complaint
        c_closed = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint already closed.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.CLOSED
        )
        res3 = self.client.post(verify_url_fn(c_closed.id), {'accepted': True, 'rating': 5}, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

    # 22. Unauthorized update and delete attempts
    def test_unauthorized_update_and_delete_attempts(self):
        complaint = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint workflow protection test.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        detail_url = reverse('complaints:complaint-detail', kwargs={'pk': complaint.id})

        # DELETE is prohibited (405)
        self.client.force_authenticate(user=self.citizen1)
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # PUT is prohibited (405)
        res_put = self.client.put(detail_url, {'description': 'New desc'}, format='json')
        self.assertEqual(res_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # PATCH by citizen directly is forbidden (403)
        res_patch = self.client.patch(detail_url, {'description': 'New desc'}, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

    # 23. Resolution acceptance and rejection success
    def test_resolution_verification_success(self):
        c1 = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint verification success acceptance test.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.RESOLVED
        )
        verify_url1 = reverse('complaints:complaint-verify', kwargs={'pk': c1.id})
        self.client.force_authenticate(user=self.citizen1)

        res1 = self.client.post(verify_url1, {'accepted': True, 'rating': 5, 'feedback': 'Great repair!'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data['status'], 'Closed')
        c1.refresh_from_db()
        self.assertEqual(c1.status, 'Closed')
        self.assertEqual(c1.citizen_rating, 5)
        self.assertIsNotNone(c1.resolved_at)

        # Rejection
        c2 = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='Complaint verification rejection test.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.RESOLVED
        )
        verify_url2 = reverse('complaints:complaint-verify', kwargs={'pk': c2.id})
        res2 = self.client.post(verify_url2, {'accepted': False, 'reason': 'Streetlight flickering again.'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['status'], 'Reopened')
        c2.refresh_from_db()
        self.assertEqual(c2.status, 'Reopened')

    # 24. Exact URL resolution checks
    def test_exact_url_resolution(self):
        from django.urls import resolve
        self.assertEqual(resolve('/api/v1/complaints/').view_name, 'complaints:complaint-list')
        self.assertEqual(
            resolve('/api/v1/complaints/12345678-1234-5678-1234-567812345678/').view_name,
            'complaints:complaint-detail'
        )
        self.assertEqual(
            resolve('/api/v1/complaints/12345678-1234-5678-1234-567812345678/verify/').view_name,
            'complaints:complaint-verify'
        )
        self.assertEqual(resolve('/api/v1/categories/').view_name, 'category-list-direct')
        self.assertEqual(
            resolve('/api/v1/complaints/12345678-1234-5678-1234-567812345678/assign/').view_name,
            'complaints:complaint-assign'
        )
        self.assertEqual(resolve('/api/v1/worker/available/').view_name, 'worker-available-direct')
        self.assertEqual(resolve('/api/v1/workers/available/').view_name, 'workers-available-direct')

    # 25. validate_worker_assignment function unit test
    def test_validate_worker_assignment_unit(self):
        from complaints.validators import validate_worker_assignment
        from rest_framework.exceptions import ValidationError

        c_pwd = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,  # PWD
            ward=self.ward1,
            description='Test complaint for validator function.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )

        # Worker 1 matches dept1 and ward1
        has_error = validate_worker_assignment(self.worker1, c_pwd, override=False)
        self.assertFalse(has_error)

        # Worker 2 is dept2 (SWM) and ward2
        with self.assertRaises(ValidationError) as ctx:
            validate_worker_assignment(self.worker2, c_pwd, override=False)
        self.assertIn('assignment_error', ctx.exception.detail)
        self.assertEqual(len(ctx.exception.detail['assignment_error']), 2)

        # Override=True allows assignment despite mismatch
        has_override_err = validate_worker_assignment(self.worker2, c_pwd, override=True)
        self.assertTrue(has_override_err)

    # 26. AssignWorkerView: Dept officer successful assignment and FCM notification
    def test_assign_worker_success_dept_officer(self):
        c_pwd = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='PWD pothole requiring worker assignment.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        self.worker1.fcm_token = 'fcm_worker_test_token_12345'
        self.worker1.save(update_fields=['fcm_token'])

        assign_url = reverse('complaints:complaint-assign', kwargs={'pk': c_pwd.id})
        self.client.force_authenticate(user=self.officer_pwd)

        res = self.client.post(assign_url, {'worker_id': self.worker1.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'ASSIGNED')
        self.assertEqual(res.data['assigned_worker_name'], self.worker1.full_name)

        c_pwd.refresh_from_db()
        self.assertEqual(c_pwd.status, 'ASSIGNED')
        self.assertEqual(c_pwd.assigned_worker, self.worker1)

        # Check status history
        history = c_pwd.status_history.latest('changed_at')
        self.assertEqual(history.new_status, 'ASSIGNED')
        self.assertEqual(history.changed_by, self.officer_pwd)
        self.assertIn(self.worker1.full_name, history.note)

        # Check FCM notification created
        from notifications.models import Notification
        notif = Notification.objects.filter(recipient=self.worker1, complaint=c_pwd).first()
        self.assertIsNotNone(notif)
        self.assertIn(c_pwd.tracking_id, notif.title)

    # 27. AssignWorkerView: Mismatch errors and officer override forbidden
    def test_assign_worker_mismatch_and_officer_override_forbidden(self):
        c_pwd = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,  # PWD
            ward=self.ward1,
            description='PWD issue for testing assignment restrictions.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        assign_url = reverse('complaints:complaint-assign', kwargs={'pk': c_pwd.id})

        # SWM officer cannot assign PWD complaint
        self.client.force_authenticate(user=self.officer_swm)
        res_cross = self.client.post(assign_url, {'worker_id': self.worker2.id}, format='json')
        self.assertEqual(res_cross.status_code, status.HTTP_403_FORBIDDEN)

        # PWD officer assigning worker2 (SWM, ward 2) without override -> 400 Bad Request
        self.client.force_authenticate(user=self.officer_pwd)
        res_mismatch = self.client.post(assign_url, {'worker_id': self.worker2.id}, format='json')
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('assignment_error', res_mismatch.data)

        # PWD officer attempting override -> 403 Forbidden (only admin can override)
        res_override_denied = self.client.post(
            assign_url,
            {'worker_id': self.worker2.id, 'override': True, 'override_reason': 'Officer override attempt'},
            format='json'
        )
        self.assertEqual(res_override_denied.status_code, status.HTTP_403_FORBIDDEN)

    # 28. AssignWorkerView: Admin override success
    def test_assign_worker_admin_override_success(self):
        c_pwd = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,  # PWD
            ward=self.ward1,
            description='PWD issue requiring adjacent ward emergency dispatch.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        worker_pwd_w2 = User.objects.create_user(
            mobile='9810010099',
            full_name='Field Worker PWD Ward 2',
            role=User.Role.WORKER,
            department=self.dept1,
            ward=self.ward2
        )
        assign_url = reverse('complaints:complaint-assign', kwargs={'pk': c_pwd.id})

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            assign_url,
            {
                'worker_id': worker_pwd_w2.id,  # PWD worker in Ward 2
                'override': True,
                'override_reason': 'Urgent storm response emergency allocation'
            },
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        c_pwd.refresh_from_db()
        self.assertEqual(c_pwd.assigned_worker, worker_pwd_w2)
        self.assertEqual(c_pwd.status, 'ASSIGNED')
        self.assertTrue(c_pwd.ward_override)
        self.assertEqual(c_pwd.override_reason, 'Urgent storm response emergency allocation')

        # StatusHistory note
        history = c_pwd.status_history.latest('changed_at')
        self.assertIn('Override', history.note)

    # 29. AssignWorkerView: Citizen and unauthenticated access forbidden
    def test_assign_worker_unauthorized_roles(self):
        c_pwd = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,
            ward=self.ward1,
            description='PWD issue for role permission validation.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )
        assign_url = reverse('complaints:complaint-assign', kwargs={'pk': c_pwd.id})

        # Unauthenticated
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(assign_url, {'worker_id': self.worker1.id}).status_code, status.HTTP_401_UNAUTHORIZED)

        # Citizen
        self.client.force_authenticate(user=self.citizen1)
        self.assertEqual(self.client.post(assign_url, {'worker_id': self.worker1.id}).status_code, status.HTTP_403_FORBIDDEN)

        # Worker
        self.client.force_authenticate(user=self.worker1)
        self.assertEqual(self.client.post(assign_url, {'worker_id': self.worker1.id}).status_code, status.HTTP_403_FORBIDDEN)

    # 30. AvailableWorkersView: listing available workers
    def test_available_workers_view(self):
        c_pwd = Complaint.objects.create(
            citizen=self.citizen1,
            category=self.cat1,  # PWD
            ward=self.ward1,
            description='Complaint to test available worker query.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED
        )

        available_url = reverse('worker-available-direct')

        # 1. Missing complaint_id query param -> 400
        self.client.force_authenticate(user=self.officer_pwd)
        res_missing = self.client.get(available_url)
        self.assertEqual(res_missing.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Dept officer views matching workers
        res = self.client.get(f"{available_url}?complaint_id={c_pwd.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['worker_id'], self.worker1.id)
        self.assertEqual(res.data[0]['name'], self.worker1.full_name)
        self.assertEqual(res.data[0]['ward'], self.ward1.name)
        self.assertEqual(res.data[0]['active_task_count'], 0)

        # 3. Dept officer views complaint of other department -> 403
        self.client.force_authenticate(user=self.officer_swm)
        res_forbidden = self.client.get(f"{available_url}?complaint_id={c_pwd.id}")
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Admin views default (matching dept & ward)
        self.client.force_authenticate(user=self.admin)
        res_admin_default = self.client.get(f"{available_url}?complaint_id={c_pwd.id}")
        self.assertEqual(res_admin_default.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin_default.data), 1)

        # 5. Admin views with ?override=true -> returns all workers
        res_admin_override = self.client.get(f"{available_url}?complaint_id={c_pwd.id}&override=true")
        self.assertEqual(res_admin_override.status_code, status.HTTP_200_OK)
        # In test DB we have worker1 and worker2 created in setUp
        self.assertGreaterEqual(len(res_admin_override.data), 2)

        # 6. Citizen access -> 403
        self.client.force_authenticate(user=self.citizen1)
        res_citizen = self.client.get(f"{available_url}?complaint_id={c_pwd.id}")
        self.assertEqual(res_citizen.status_code, status.HTTP_403_FORBIDDEN)

