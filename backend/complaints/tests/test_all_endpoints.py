"""
Comprehensive API Integration Verification Test Suite for JANMITRA Civic Grievance System.
Location: backend/complaints/tests/test_all_endpoints.py

Covers:
A. Authentication APIs (Register, Login, Token Refresh, Profile, FCM Token)
B. Complaint APIs (Submit, List, Detail, Assign, Status Update, Proof Upload, Citizen Verify, Timeline)
C. Worker APIs (Task List, Task Detail analysis, Status Update, Proof Upload)
D. Dashboard APIs (KPI, Ward Stats, Overdue, Trends, Worker Workload, High Priority, Pending Validation)
E. RBAC Permission Matrix across 5 roles (Anonymous, Citizen, Worker, Dept Officer, Admin)
F. Auxiliary Endpoints (Available Workers, Categories, Wards)
"""

import os
import uuid
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from complaints.models import (
    Category,
    Complaint,
    ComplaintImage,
    Department,
    StatusHistory,
    Ward,
)
from complaints.services import (
    get_overdue_complaints,
    get_sla_deadline,
    get_sla_target_hours,
    is_complaint_overdue,
)

User = get_user_model()


def get_dummy_image(name='test_image.jpg'):
    """Generates a small in-memory valid JPEG image for multipart upload testing."""
    return SimpleUploadedFile(
        name=name,
        content=b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9',
        content_type='image/jpeg'
    )


class BaseAPITestSetup(APITestCase):
    """
    Common fixture and deterministic test data setup for JANMITRA integration tests.
    Uses dedicated, non-colliding test accounts to preserve database isolation.
    """

    @classmethod
    def setUpTestData(cls):
        # 1. Ensure core municipal departments (PWD and SWM)
        cls.dept_pwd, _ = Department.objects.get_or_create(
            id=1,
            defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        cls.dept_swm, _ = Department.objects.get_or_create(
            id=2,
            defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'}
        )

        # 2. Ensure core municipal wards (Ward 1 and Ward 2)
        cls.ward_1, _ = Ward.objects.get_or_create(id=1, defaults={'name': 'Ward 1'})
        cls.ward_2, _ = Ward.objects.get_or_create(id=2, defaults={'name': 'Ward 2'})

        # 3. Ensure core categories
        cls.cat_roads, _ = Category.objects.get_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': cls.dept_pwd}
        )
        cls.cat_waste, _ = Category.objects.get_or_create(
            id=2,
            defaults={'name': 'Garbage & Waste Management', 'department': cls.dept_swm}
        )

        # 4. Deterministic Test Users (using dedicated test mobile block 9900000000+)
        # Citizen 1 (Ward 1)
        cls.citizen_1 = User.objects.create_user(
            mobile='9900000001',
            full_name='Aarav Citizen One',
            email='citizen1.test@janmitra.gov.in',
            password='Citizen@12345',
            role=User.Role.CITIZEN,
            ward=cls.ward_1,
            status=User.Status.ACTIVE,
        )

        # Citizen 2 (Ward 2)
        cls.citizen_2 = User.objects.create_user(
            mobile='9900000002',
            full_name='Bhavna Citizen Two',
            email='citizen2.test@janmitra.gov.in',
            password='Citizen@12345',
            role=User.Role.CITIZEN,
            ward=cls.ward_2,
            status=User.Status.ACTIVE,
        )

        # Inactive Citizen
        cls.inactive_citizen = User.objects.create_user(
            mobile='9900000099',
            full_name='Deactivated Citizen',
            email='inactive.test@janmitra.gov.in',
            password='Citizen@12345',
            role=User.Role.CITIZEN,
            ward=cls.ward_1,
            is_active=False,
        )

        # Worker 1: PWD, Ward 1
        cls.worker_pwd = User.objects.create_user(
            mobile='9910010001',
            full_name='Ramesh PWD Worker',
            email='worker.pwd@janmitra.gov.in',
            password='Worker@12345',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            designation='Road Maintenance Field Staff',
            employee_id='EMP-PWD-9901',
            status=User.Status.ACTIVE,
        )

        # Worker 2: SWM, Ward 2
        cls.worker_swm = User.objects.create_user(
            mobile='9910020001',
            full_name='Suresh SWM Worker',
            email='worker.swm@janmitra.gov.in',
            password='Worker@12345',
            role=User.Role.WORKER,
            department=cls.dept_swm,
            ward=cls.ward_2,
            designation='Sanitation Field Staff',
            employee_id='EMP-SWM-9902',
            status=User.Status.ACTIVE,
        )

        # Worker 3: PWD, Ward 2 (adjacent ward for override testing)
        cls.worker_pwd_w2 = User.objects.create_user(
            mobile='9910010002',
            full_name='Dinesh PWD Worker W2',
            email='worker.pwd.w2@janmitra.gov.in',
            password='Worker@12345',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=cls.ward_2,
            designation='Road Infrastructure Staff',
            employee_id='EMP-PWD-9903',
            status=User.Status.ACTIVE,
        )

        # Dept Officer 1: PWD, Ward 1
        cls.officer_pwd = User.objects.create_user(
            mobile='9920000001',
            full_name='Rajesh Kumar PWD Officer',
            email='officer.pwd@janmitra.gov.in',
            password='Officer@12345',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            status=User.Status.ACTIVE,
        )

        # Dept Officer 2: SWM, Ward 2
        cls.officer_swm = User.objects.create_user(
            mobile='9920000002',
            full_name='Sunita Deshmukh SWM Officer',
            email='officer.swm@janmitra.gov.in',
            password='Officer@12345',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept_swm,
            ward=cls.ward_2,
            status=User.Status.ACTIVE,
        )

        # Central Administrator
        cls.admin = User.objects.create_user(
            mobile='9990000001',
            full_name='Central Municipal Admin',
            email='central.admin@janmitra.gov.in',
            password='Admin@12345',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            status=User.Status.ACTIVE,
        )

    def tearDown(self):
        # Cleanup uploaded test image files from disk if generated
        for img in ComplaintImage.objects.all():
            try:
                if img.image and hasattr(img.image, 'path') and os.path.exists(img.image.path):
                    os.remove(img.image.path)
            except Exception:
                pass


# ==============================================================================
# GROUP A: AUTHENTICATION APIS
# ==============================================================================
class AuthenticationAPITests(BaseAPITestSetup):
    """
    Tests all authentication endpoints:
    1. Register (success, validation, duplicate mobile, unseeded ward, no password exposure)
    2. Login (valid credentials, invalid credentials, deactivated user, JWT structure)
    3. Profile (authenticated retrieval, unauthorized rejection, read-only field security)
    4. FCM Token (update own token, unauthorized rejection, missing token validation)
    """

    def setUp(self):
        self.client = APIClient()

    def test_01_citizen_registration_success(self):
        """Valid citizen registration returns 201 Created with JWT tokens and user metadata."""
        url = reverse('accounts:register')
        payload = {
            'name': 'Gaurav Deshmukh',
            'mobile': '9930000001',
            'ward': 1,
            'password': 'SecureCitizen@123',
            'email': 'gaurav@example.com',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['mobile'], '9930000001')
        self.assertEqual(response.data['role'], 'citizen')
        self.assertEqual(response.data['ward'], 1)

        # Verify password is never returned
        self.assertNotIn('password', response.data)
        if 'user' in response.data:
            self.assertNotIn('password', response.data['user'])

        # Verify persisted user in DB
        user = User.objects.get(mobile='9930000001')
        self.assertEqual(user.full_name, 'Gaurav Deshmukh')
        self.assertTrue(user.check_password('SecureCitizen@123'))

    def test_02_registration_missing_required_fields_rejected(self):
        """Registration without required fields returns HTTP 400 validation error."""
        url = reverse('accounts:register')
        # Missing mobile and password
        payload = {'name': 'Incomplete User', 'ward': 1}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', response.data)

        # Missing name
        payload = {'mobile': '9930000002', 'ward': 1, 'password': 'Pass@12345'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

        # Missing ward
        payload = {'name': 'User No Ward', 'mobile': '9930000003', 'password': 'Pass@12345'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', response.data)

    def test_03_registration_invalid_mobile_rejected(self):
        """Mobile numbers that are not exactly 10 digits are rejected."""
        url = reverse('accounts:register')
        payload = {
            'name': 'Short Mobile',
            'mobile': '98765',
            'ward': 1,
            'password': 'Pass@12345',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', response.data)

    def test_04_registration_unseeded_or_out_of_range_ward_rejected(self):
        """Registration with an invalid ward (not 1-4) or unseeded ward returns 400."""
        url = reverse('accounts:register')
        payload = {
            'name': 'Invalid Ward User',
            'mobile': '9930000004',
            'ward': 99,
            'password': 'Pass@12345',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', response.data)

    def test_05_registration_duplicate_mobile_rejected(self):
        """Duplicate mobile registration is rejected."""
        url = reverse('accounts:register')
        payload = {
            'name': 'Duplicate Aarav',
            'mobile': self.citizen_1.mobile,
            'ward': 1,
            'password': 'Pass@12345',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', response.data)

    def test_06_login_valid_credentials_returns_jwt(self):
        """Valid credentials across roles return 200 OK with JWT tokens and user metadata."""
        url = reverse('accounts:login')

        roles_to_test = [
            (self.citizen_1.mobile, 'Citizen@12345', 'citizen'),
            (self.worker_pwd.mobile, 'Worker@12345', 'worker'),
            (self.officer_pwd.mobile, 'Officer@12345', 'dept_officer'),
            (self.admin.mobile, 'Admin@12345', 'admin'),
        ]

        for mobile, password, expected_role in roles_to_test:
            response = self.client.post(url, {'mobile': mobile, 'password': password}, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK, f"Failed for {mobile}")
            self.assertIn('access', response.data)
            self.assertIn('refresh', response.data)
            self.assertEqual(response.data['user']['role'], expected_role)
            # Security: Password never exposed
            self.assertNotIn('password', response.data)
            self.assertNotIn('password', response.data['user'])

    def test_07_login_invalid_and_missing_credentials_rejected(self):
        """Wrong credentials or missing fields return 400 Bad Request."""
        url = reverse('accounts:login')

        # Wrong password
        res = self.client.post(url, {'mobile': self.citizen_1.mobile, 'password': 'WrongPassword!'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Non-existent user
        res = self.client.post(url, {'mobile': '9999999999', 'password': 'Password@123'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing password
        res = self.client.post(url, {'mobile': self.citizen_1.mobile}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_08_login_deactivated_account_rejected(self):
        """Deactivated accounts are rejected during login."""
        url = reverse('accounts:login')
        res = self.client.post(url, {'mobile': self.inactive_citizen.mobile, 'password': 'Citizen@12345'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invalid', str(res.data).lower())

    def test_09_token_refresh(self):
        """POST to refresh endpoint returns a fresh access token."""
        url = reverse('accounts:login')
        login_res = self.client.post(url, {'mobile': self.citizen_1.mobile, 'password': 'Citizen@12345'}, format='json')
        refresh_token = login_res.data['refresh']

        refresh_url = reverse('accounts:refresh')
        response = self.client.post(refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_10_user_profile_authenticated(self):
        """Authenticated users can retrieve their own profile."""
        url = reverse('accounts:profile')
        self.client.force_authenticate(user=self.citizen_1)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['mobile'], self.citizen_1.mobile)
        self.assertEqual(response.data['full_name'], self.citizen_1.full_name)
        self.assertEqual(response.data['role'], 'citizen')
        self.assertNotIn('password', response.data)

    def test_11_user_profile_unauthenticated_rejected(self):
        """Unauthenticated access to profile returns 401 Unauthorized."""
        url = reverse('accounts:profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_12_user_profile_update_and_tampering_prevention(self):
        """Users can update mutable fields (email), but role tampering is prevented."""
        url = reverse('accounts:profile')
        self.client.force_authenticate(user=self.citizen_1)
        # Attempt to escalate role to admin
        response = self.client.patch(url, {'email': 'new.email@janmitra.gov.in', 'role': 'admin'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'new.email@janmitra.gov.in')
        # Role must remain citizen
        self.citizen_1.refresh_from_db()
        self.assertEqual(self.citizen_1.role, User.Role.CITIZEN)

    def test_13_fcm_token_update_authenticated(self):
        """Authenticated user can update their FCM token via PATCH and POST."""
        url = reverse('accounts:fcm_token')
        self.client.force_authenticate(user=self.citizen_1)

        # PATCH update
        response = self.client.patch(url, {'fcm_token': 'new_sample_fcm_token_12345'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.citizen_1.refresh_from_db()
        self.assertEqual(self.citizen_1.fcm_token, 'new_sample_fcm_token_12345')

        # POST update (backward compatibility)
        response = self.client.post(url, {'fcm_token': 'updated_via_post_fcm_token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.citizen_1.refresh_from_db()
        self.assertEqual(self.citizen_1.fcm_token, 'updated_via_post_fcm_token')

    def test_14_fcm_token_update_unauthenticated_rejected(self):
        """Unauthenticated request to update FCM token returns 401."""
        url = reverse('accounts:fcm_token')
        response = self.client.patch(url, {'fcm_token': 'unauth_fcm_token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_15_fcm_token_empty_payload_rejected(self):
        """Empty fcm_token returns 400 Bad Request."""
        url = reverse('accounts:fcm_token')
        self.client.force_authenticate(user=self.citizen_1)
        response = self.client.patch(url, {'fcm_token': '   '}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# GROUP B: COMPLAINT APIS
# ==============================================================================
class ComplaintAPITests(BaseAPITestSetup):
    """
    Tests all complaint endpoints:
    1. Submit Complaint (citizen role enforcement, required fields, department derivation)
    2. Complaint List (citizen isolation, admin overview, status/ward filtering)
    3. Complaint Detail (UUID and tracking ID lookup, cross-citizen 403, 404 handling)
    4. Worker Assignment (dept officer permissions, admin override, invalid worker rejected)
    5. Status Update (staff allowed, citizen forbidden)
    6. Proof Upload (assigned worker allowed, citizen/unassigned worker forbidden)
    7. Citizen Verification (accept, reject/reopen, rating validation, reason validation)
    8. Complaint Timeline (chronological events, access control)
    """

    def setUp(self):
        self.client = APIClient()

    @patch('complaints.views.notify_officer_on_new_complaint.delay')
    @patch('complaints.views.process_complaint_ai.delay')
    def test_01_submit_complaint_authenticated_citizen_success(self, mock_ai, mock_notify):
        """Authenticated citizen submits complaint; department is auto-derived from category."""
        url = reverse('complaints:complaint-list')
        self.client.force_authenticate(user=self.citizen_1)

        img = get_dummy_image('evidence.jpg')
        payload = {
            'title': 'Deep Pothole on Sitabuldi Main Road',
            'description': 'Large pothole near Metro station posing severe risk to two-wheelers.',
            'category': self.cat_roads.id,
            'ward': self.ward_1.id,
            'address': 'Sitabuldi Square, Nagpur',
            'location_lat': 21.1458,
            'location_lng': 79.0882,
            'images': [img],
        }
        response = self.client.post(url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertTrue(response.data['tracking_id'].startswith('NMC-'))
        self.assertEqual(response.data['status'], Complaint.Status.SUBMITTED)

        # Verify complaint in database
        complaint = Complaint.objects.get(id=response.data['id'])
        self.assertEqual(complaint.citizen, self.citizen_1)
        self.assertEqual(complaint.department, self.dept_pwd)  # Derived from cat_roads
        self.assertEqual(complaint.ward, self.ward_1)
        self.assertAlmostEqual(complaint.location.x, 79.0882)
        self.assertAlmostEqual(complaint.location.y, 21.1458)

    def test_02_submit_complaint_missing_required_fields_rejected(self):
        """Submitting complaint missing description, category, or coordinates returns 400."""
        url = reverse('complaints:complaint-list')
        self.client.force_authenticate(user=self.citizen_1)

        # Missing description
        payload = {'title': 'Pothole', 'category': self.cat_roads.id, 'ward': self.ward_1.id, 'location_lat': 21.14, 'location_lng': 79.08}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing category
        payload = {'title': 'Pothole', 'description': 'Deep road crack requiring urgent repair.', 'ward': self.ward_1.id, 'location_lat': 21.14, 'location_lng': 79.08}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_03_submit_complaint_invalid_category_rejected(self):
        """Non-existent category returns 400 Bad Request."""
        url = reverse('complaints:complaint-list')
        self.client.force_authenticate(user=self.citizen_1)

        payload = {
            'title': 'Pothole',
            'description': 'Pothole description exceeding minimum characters.',
            'category': 9999,
            'ward': self.ward_1.id,
            'location_lat': 21.14,
            'location_lng': 79.08,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_04_submit_complaint_non_citizen_roles_forbidden(self):
        """Field workers and officers cannot report complaints via citizen submission API."""
        url = reverse('complaints:complaint-list')
        payload = {
            'title': 'Test by Worker',
            'description': 'Worker attempting to submit complaint via citizen route.',
            'category': self.cat_roads.id,
            'ward': self.ward_1.id,
            'location_lat': 21.14,
            'location_lng': 79.08,
        }

        # Worker
        self.client.force_authenticate(user=self.worker_pwd)
        res_worker = self.client.post(url, payload, format='json')
        self.assertEqual(res_worker.status_code, status.HTTP_403_FORBIDDEN)

        # Dept Officer
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.post(url, payload, format='json')
        self.assertEqual(res_officer.status_code, status.HTTP_403_FORBIDDEN)

    def test_05_submit_complaint_unauthenticated_rejected(self):
        """Unauthenticated complaint submission returns 401 Unauthorized."""
        url = reverse('complaints:complaint-list')
        response = self.client.post(url, {'title': 'No auth'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_06_complaint_list_citizen_isolation(self):
        """Citizens only see complaints they personally submitted."""
        # Create complaint for citizen 1
        c1 = Complaint.objects.create(
            citizen=self.citizen_1,
            category=self.cat_roads,
            ward=self.ward_1,
            title='Citizen 1 Complaint',
            description='Issue in Ward 1',
        )
        # Create complaint for citizen 2
        c2 = Complaint.objects.create(
            citizen=self.citizen_2,
            category=self.cat_waste,
            ward=self.ward_2,
            title='Citizen 2 Complaint',
            description='Issue in Ward 2',
        )

        url = reverse('complaints:complaint-list')

        # Citizen 1 list
        self.client.force_authenticate(user=self.citizen_1)
        res1 = self.client.get(url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        ids_c1 = [item['id'] for item in res1.data.get('results', res1.data)]
        self.assertIn(str(c1.id), ids_c1)
        self.assertNotIn(str(c2.id), ids_c1)

        # Citizen 2 list
        self.client.force_authenticate(user=self.citizen_2)
        res2 = self.client.get(url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        ids_c2 = [item['id'] for item in res2.data.get('results', res2.data)]
        self.assertIn(str(c2.id), ids_c2)
        self.assertNotIn(str(c1.id), ids_c2)

    def test_07_complaint_list_admin_and_dept_officer_scoping(self):
        """Admin sees city-wide complaints; Dept Officer only sees complaints in their department/ward."""
        c_pwd = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='PWD Ward 1 Issue', description='Road repair',
        )
        c_swm = Complaint.objects.create(
            citizen=self.citizen_2, category=self.cat_waste, ward=self.ward_2,
            title='SWM Ward 2 Issue', description='Garbage clearance',
        )

        url = reverse('complaints:complaint-list')

        # Admin: sees both
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get(url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        admin_ids = [item['id'] for item in res_admin.data.get('results', res_admin.data)]
        self.assertIn(str(c_pwd.id), admin_ids)
        self.assertIn(str(c_swm.id), admin_ids)

        # Dept Officer PWD: sees only PWD
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.get(url)
        self.assertEqual(res_officer.status_code, status.HTTP_200_OK)
        officer_ids = [item['id'] for item in res_officer.data.get('results', res_officer.data)]
        self.assertIn(str(c_pwd.id), officer_ids)
        self.assertNotIn(str(c_swm.id), officer_ids)

    def test_08_complaint_list_filtering_and_validation(self):
        """Filtering by status and ward validates input and handles errors gracefully."""
        c1 = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Assigned Issue', description='Road repair', status=Complaint.Status.ASSIGNED
        )
        url = reverse('complaints:complaint-list')
        self.client.force_authenticate(user=self.admin)

        # Valid filter
        res = self.client.get(f"{url}?status=ASSIGNED")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        filtered_ids = [item['id'] for item in res.data.get('results', res.data)]
        self.assertIn(str(c1.id), filtered_ids)

        # Invalid status choice returns 400
        res_bad = self.client.get(f"{url}?status=NON_EXISTENT_STATUS")
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_complaint_detail_uuid_and_tracking_id_lookup(self):
        """Complaint can be retrieved by UUID or NMC tracking_id."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Detail Test', description='Pothole in Dharampeth',
        )

        self.client.force_authenticate(user=self.citizen_1)

        # Lookup by UUID
        res_uuid = self.client.get(f"/api/v1/complaints/{complaint.id}/")
        self.assertEqual(res_uuid.status_code, status.HTTP_200_OK)
        self.assertEqual(res_uuid.data['title'], 'Detail Test')

        # Lookup by tracking_id
        res_track = self.client.get(f"/api/v1/complaints/{complaint.tracking_id}/")
        self.assertEqual(res_track.status_code, status.HTTP_200_OK)
        self.assertEqual(res_track.data['id'], str(complaint.id))

    def test_10_complaint_detail_cross_citizen_access_forbidden(self):
        """Citizen cannot access another citizen's private complaint (403 Forbidden)."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Private Issue', description='Private',
        )
        self.client.force_authenticate(user=self.citizen_2)
        response = self.client.get(f"/api/v1/complaints/{complaint.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_11_complaint_detail_nonexistent_returns_404(self):
        """Non-existent UUID or tracking_id returns 404 Not Found."""
        self.client.force_authenticate(user=self.citizen_1)
        res1 = self.client.get(f"/api/v1/complaints/{uuid.uuid4()}/")
        self.assertEqual(res1.status_code, status.HTTP_404_NOT_FOUND)

        res2 = self.client.get("/api/v1/complaints/NMC-2024-NONEXISTENT/")
        self.assertEqual(res2.status_code, status.HTTP_404_NOT_FOUND)

    @patch('complaints.views.trigger_task_assigned.delay')
    def test_12_worker_assignment_by_authorized_dept_officer(self, mock_task):
        """Dept Officer can assign an active worker in their department & ward."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Unassigned Road Issue', description='Pothole',
        )
        url = reverse('complaints:complaint-assign', kwargs={'pk': complaint.id})
        self.client.force_authenticate(user=self.officer_pwd)

        payload = {'worker_id': self.worker_pwd.id}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], Complaint.Status.ASSIGNED)

        complaint.refresh_from_db()
        self.assertEqual(complaint.assigned_worker, self.worker_pwd)
        self.assertEqual(complaint.status, Complaint.Status.ASSIGNED)

        # Verify StatusHistory audit record
        history = StatusHistory.objects.filter(complaint=complaint).last()
        self.assertIsNotNone(history)
        self.assertEqual(history.new_status, Complaint.Status.ASSIGNED)
        self.assertEqual(history.changed_by, self.officer_pwd)

    def test_13_worker_assignment_cross_department_rejected(self):
        """Assigning a worker from a different department or by wrong officer is rejected."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='PWD Issue', description='Pothole',
        )
        url = reverse('complaints:complaint-assign', kwargs={'pk': complaint.id})

        # SWM officer trying to assign PWD complaint -> 403 Forbidden
        self.client.force_authenticate(user=self.officer_swm)
        res = self.client.post(url, {'worker_id': self.worker_pwd.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # PWD officer trying to assign SWM worker to PWD complaint -> 400 Bad Request
        self.client.force_authenticate(user=self.officer_pwd)
        res_mismatch = self.client.post(url, {'worker_id': self.worker_swm.id}, format='json')
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('complaints.views.trigger_task_assigned.delay')
    def test_14_worker_assignment_cross_ward_and_admin_override(self, mock_task):
        """Cross-ward worker assignment rejected for dept officer, allowed for admin with override."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Ward 1 PWD Issue', description='Pothole',
        )
        url = reverse('complaints:complaint-assign', kwargs={'pk': complaint.id})

        # Dept officer attempts cross-ward assignment (worker_pwd_w2 is in Ward 2) -> 400
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.post(url, {'worker_id': self.worker_pwd_w2.id}, format='json')
        self.assertEqual(res_officer.status_code, status.HTTP_400_BAD_REQUEST)

        # Admin performs cross-ward override -> 200 OK
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.post(url, {
            'worker_id': self.worker_pwd_w2.id,
            'override': True,
            'override_reason': 'Emergency support for adjacent ward',
        }, format='json')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertTrue(complaint.ward_override)
        self.assertEqual(complaint.assigned_worker, self.worker_pwd_w2)

    def test_15_worker_assignment_unauthorized_roles_forbidden(self):
        """Citizens and workers cannot assign complaints (403 Forbidden)."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Issue', description='Pothole',
        )
        url = reverse('complaints:complaint-assign', kwargs={'pk': complaint.id})

        # Citizen
        self.client.force_authenticate(user=self.citizen_1)
        res_cit = self.client.post(url, {'worker_id': self.worker_pwd.id}, format='json')
        self.assertEqual(res_cit.status_code, status.HTTP_403_FORBIDDEN)

        # Worker
        self.client.force_authenticate(user=self.worker_pwd)
        res_wrk = self.client.post(url, {'worker_id': self.worker_pwd.id}, format='json')
        self.assertEqual(res_wrk.status_code, status.HTTP_403_FORBIDDEN)

    def test_16_complaint_status_update_by_staff_and_citizen_denial(self):
        """Staff can update complaint status; citizen cannot directly modify complaints."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Status Change Test', description='Pothole',
        )
        url_detail = f"/api/v1/complaints/{complaint.id}/"
        url_status = reverse('complaints:complaint-status-patch', kwargs={'pk': complaint.id})

        # Citizen denied direct complaint modification via PATCH /complaints/:id/
        self.client.force_authenticate(user=self.citizen_1)
        res_cit = self.client.patch(url_detail, {'status': 'IN_PROGRESS'}, format='json')
        self.assertEqual(res_cit.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Citizens cannot directly modify complaints', str(res_cit.data))

        # Citizen also denied worker status update
        res_cit_worker = self.client.patch(f"/api/v1/worker/tasks/{complaint.id}/status/", {'status': 'In-Progress'}, format='json')
        self.assertEqual(res_cit_worker.status_code, status.HTTP_403_FORBIDDEN)

        # Admin allowed to update status via /status/
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.patch(url_status, {'status': 'IN_PROGRESS'}, format='json')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'IN_PROGRESS')

    def test_17_proof_upload_on_complaint_endpoint(self):
        """Assigned worker can upload proof image; unassigned worker and citizens are rejected."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Proof Test', description='Pothole', assigned_worker=self.worker_pwd
        )
        url = reverse('complaints:complaint-proof-upload', kwargs={'pk': complaint.id})

        # Citizen rejected
        self.client.force_authenticate(user=self.citizen_1)
        res_cit = self.client.post(url, {'proof': get_dummy_image('c_proof.jpg')}, format='multipart')
        self.assertEqual(res_cit.status_code, status.HTTP_403_FORBIDDEN)

        # Unassigned worker rejected
        self.client.force_authenticate(user=self.worker_swm)
        res_unassigned = self.client.post(url, {'proof': get_dummy_image('c_proof2.jpg')}, format='multipart')
        self.assertEqual(res_unassigned.status_code, status.HTTP_403_FORBIDDEN)

        # Assigned worker succeeds
        self.client.force_authenticate(user=self.worker_pwd)
        res_ok = self.client.post(url, {'proof': get_dummy_image('c_proof_ok.jpg')}, format='multipart')
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ComplaintImage.objects.filter(complaint=complaint, image_type=ComplaintImage.ImageType.PROOF).exists())

    def test_18_citizen_verification_accept_success(self):
        """Complaint owner accepts resolution with valid rating (1-5)."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Verify Accept Test', description='Pothole',
            status='Work Done', resolved_at=timezone.now() - timedelta(hours=2)
        )
        initial_resolved_at = complaint.resolved_at

        url = reverse('complaints:complaint-verify', kwargs={'pk': complaint.id})
        self.client.force_authenticate(user=self.citizen_1)

        payload = {'action': 'accept', 'rating': 5, 'feedback': 'Road is completely restored!'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Closed')
        self.assertEqual(response.data['rating'], 5)

        complaint.refresh_from_db()
        self.assertEqual(complaint.status, Complaint.Status.CLOSED)
        self.assertEqual(complaint.citizen_rating, 5)
        self.assertIsNotNone(complaint.closed_at)

        # Verify closed_at and resolved_at remain distinct
        self.assertNotEqual(complaint.closed_at, initial_resolved_at)
        self.assertEqual(complaint.resolved_at, initial_resolved_at)

        # Verify StatusHistory created
        history = StatusHistory.objects.filter(complaint=complaint, new_status=Complaint.Status.CLOSED).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.changed_by, self.citizen_1)

    def test_19_citizen_verification_reject_reopens_complaint(self):
        """Complaint owner rejects resolution with valid reason; status reopens and increments reopen_count."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Verify Reject Test', description='Pothole',
            status='Work Done', reopen_count=0
        )
        url = reverse('complaints:complaint-verify', kwargs={'pk': complaint.id})
        self.client.force_authenticate(user=self.citizen_1)

        payload = {'action': 'reject', 'reason': 'Debris left behind, pothole is uneven.'}
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Reopened')
        self.assertEqual(response.data['reopen_count'], 1)

        complaint.refresh_from_db()
        self.assertEqual(complaint.status, Complaint.Status.REOPENED)
        self.assertEqual(complaint.reopen_count, 1)

        # Verify StatusHistory created with rejection reason
        history = StatusHistory.objects.filter(complaint=complaint, new_status=Complaint.Status.REOPENED).first()
        self.assertIsNotNone(history)
        self.assertIn('Debris left behind', history.note)

    def test_20_citizen_verification_invalid_payloads_and_wrong_status_rejected(self):
        """Verification validates ratings, required rejection reason, and current status."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Invalid Verify Test', description='Pothole',
            status='Work Done'
        )
        url = reverse('complaints:complaint-verify', kwargs={'pk': complaint.id})
        self.client.force_authenticate(user=self.citizen_1)

        # Invalid rating > 5
        res_bad_rating = self.client.post(url, {'action': 'accept', 'rating': 6}, format='json')
        self.assertEqual(res_bad_rating.status_code, status.HTTP_400_BAD_REQUEST)

        # Reject without reason
        res_no_reason = self.client.post(url, {'action': 'reject', 'reason': '   '}, format='json')
        self.assertEqual(res_no_reason.status_code, status.HTTP_400_BAD_REQUEST)

        # Cannot verify a SUBMITTED complaint
        complaint.status = Complaint.Status.SUBMITTED
        complaint.save()
        res_submitted = self.client.post(url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(res_submitted.status_code, status.HTTP_400_BAD_REQUEST)

    def test_21_citizen_verification_non_owner_forbidden(self):
        """Non-owner citizen, worker, or officer cannot verify complaint."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Verify Auth Test', description='Pothole', status='Work Done'
        )
        url = reverse('complaints:complaint-verify', kwargs={'pk': complaint.id})

        # Other citizen
        self.client.force_authenticate(user=self.citizen_2)
        res2 = self.client.post(url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

        # Field worker
        self.client.force_authenticate(user=self.worker_pwd)
        res_w = self.client.post(url, {'action': 'accept', 'rating': 5}, format='json')
        self.assertEqual(res_w.status_code, status.HTTP_403_FORBIDDEN)

    def test_22_complaint_timeline_authorized_and_isolation(self):
        """Chronological timeline retrieved by authorized users; other citizens denied."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, ward=self.ward_1,
            title='Timeline Test', description='Pothole', assigned_worker=self.worker_pwd
        )
        StatusHistory.objects.create(
            complaint=complaint, old_status='SUBMITTED', new_status='ASSIGNED',
            changed_by=self.officer_pwd, note='Assigned to Ramesh'
        )

        url = reverse('complaints:complaint-timeline', kwargs={'pk': complaint.id})

        # Owner citizen allowed
        self.client.force_authenticate(user=self.citizen_1)
        res_owner = self.client.get(url)
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_owner.data) >= 1)

        # Assigned worker allowed
        self.client.force_authenticate(user=self.worker_pwd)
        res_wrk = self.client.get(url)
        self.assertEqual(res_wrk.status_code, status.HTTP_200_OK)

        # Other citizen forbidden
        self.client.force_authenticate(user=self.citizen_2)
        res_other = self.client.get(url)
        self.assertEqual(res_other.status_code, status.HTTP_403_FORBIDDEN)


# ==============================================================================
# GROUP C: WORKER APIS
# ==============================================================================
class WorkerAPITests(BaseAPITestSetup):
    """
    Tests all worker-specific routes:
    1. Worker task list (department & ward isolation, role check, filters)
    2. Worker task detail route analysis
    3. Worker task status update (In-Progress, Work Done requirements)
    4. Worker proof-of-work upload (multipart image, status update, audit entry)
    """

    def setUp(self):
        self.client = APIClient()

    def test_01_worker_task_list_isolation_and_filters(self):
        """Worker retrieves tasks strictly for their department and ward."""
        # PWD Ward 1 task
        c_pwd = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='PWD Ward 1 Task', description='Pothole',
            status=Complaint.Status.ASSIGNED, priority_level=Complaint.Priority.HIGH
        )
        # SWM Ward 2 task
        c_swm = Complaint.objects.create(
            citizen=self.citizen_2, category=self.cat_waste, department=self.dept_swm,
            ward=self.ward_2, title='SWM Ward 2 Task', description='Garbage',
            status=Complaint.Status.ASSIGNED, priority_level=Complaint.Priority.MEDIUM
        )

        url = reverse('complaints:worker-tasks')

        # Worker PWD (Ward 1)
        self.client.force_authenticate(user=self.worker_pwd)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in response.data]
        self.assertIn(str(c_pwd.id), ids)
        self.assertNotIn(str(c_swm.id), ids)

        # Filtering by status
        res_status = self.client.get(f"{url}?status=assigned")
        self.assertEqual(res_status.status_code, status.HTTP_200_OK)
        self.assertIn(str(c_pwd.id), [item['id'] for item in res_status.data])

    def test_02_worker_task_list_unauthorized_roles_forbidden(self):
        """Citizens and dept officers cannot access the field worker task list."""
        url = reverse('complaints:worker-tasks')

        # Citizen
        self.client.force_authenticate(user=self.citizen_1)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        # Dept officer
        self.client.force_authenticate(user=self.officer_pwd)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        # Unauthenticated
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_03_worker_task_detail_via_complaint_and_dedicated_route_analysis(self):
        """
        Assigned worker can retrieve task detail via GET /api/v1/complaints/:id/.
        Verifies that unassigned workers are forbidden.
        Analyzes dedicated task route /api/v1/worker/tasks/:id/ which maps to WorkerTaskStatusView (PATCH/POST only).
        """
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='Task Detail Test', description='Road repair',
            assigned_worker=self.worker_pwd, status=Complaint.Status.ASSIGNED
        )

        # 1. Primary task-detail retrieval via complaint detail endpoint
        self.client.force_authenticate(user=self.worker_pwd)
        res_assigned = self.client.get(f"/api/v1/complaints/{complaint.id}/")
        self.assertEqual(res_assigned.status_code, status.HTTP_200_OK)
        self.assertEqual(res_assigned.data['id'], str(complaint.id))

        # Unassigned worker forbidden from reading task details
        self.client.force_authenticate(user=self.worker_swm)
        res_unassigned = self.client.get(f"/api/v1/complaints/{complaint.id}/")
        self.assertEqual(res_unassigned.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Dedicated route analysis: GET /api/v1/worker/tasks/:pk/ maps to WorkerTaskStatusView (only PATCH/POST supported)
        self.client.force_authenticate(user=self.worker_pwd)
        res_worker_dedicated = self.client.get(f"/api/v1/worker/tasks/{complaint.id}/")
        self.assertEqual(res_worker_dedicated.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_04_worker_status_update_in_progress(self):
        """Assigned worker transitions complaint from 'Assigned' to 'In-Progress'."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='In Progress Update Test', description='Road repair',
            assigned_worker=self.worker_pwd, status=Complaint.Status.ASSIGNED
        )
        url = reverse('complaints:worker-task-status', kwargs={'pk': complaint.id})

        # Non-assigned worker forbidden
        self.client.force_authenticate(user=self.worker_swm)
        res_wrong = self.client.patch(url, {'status': 'In-Progress'}, format='json')
        self.assertEqual(res_wrong.status_code, status.HTTP_403_FORBIDDEN)

        # Citizen forbidden
        self.client.force_authenticate(user=self.citizen_1)
        res_cit = self.client.patch(url, {'status': 'In-Progress'}, format='json')
        self.assertEqual(res_cit.status_code, status.HTTP_403_FORBIDDEN)

        # Assigned worker succeeds
        self.client.force_authenticate(user=self.worker_pwd)
        res_ok = self.client.patch(url, {'status': 'In-Progress', 'note': 'Started excavation work'}, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)

        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'In-Progress')

        # StatusHistory recorded
        history = StatusHistory.objects.filter(complaint=complaint).last()
        self.assertEqual(history.new_status, 'In-Progress')
        self.assertEqual(history.changed_by, self.worker_pwd)

    @patch('complaints.views.trigger_work_done.delay')
    @patch('complaints.views.send_push_notification.delay')
    def test_05_worker_proof_upload_and_work_done(self, mock_push, mock_done):
        """Assigned worker uploads proof of work; sets status to Work Done and creates audit entry."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='Proof of Work Test', description='Road repair',
            assigned_worker=self.worker_pwd, status=Complaint.Status.IN_PROGRESS
        )
        url = reverse('complaints:worker-proof-upload', kwargs={'pk': complaint.id})

        # Unassigned worker rejected
        self.client.force_authenticate(user=self.worker_swm)
        res_wrong = self.client.post(url, {'proof_images': get_dummy_image('unassigned.jpg')}, format='multipart')
        self.assertEqual(res_wrong.status_code, status.HTTP_403_FORBIDDEN)

        # Missing proof rejected
        self.client.force_authenticate(user=self.worker_pwd)
        res_no_img = self.client.post(url, {'remarks': 'Work is done without photo'}, format='multipart')
        self.assertEqual(res_no_img.status_code, status.HTTP_400_BAD_REQUEST)

        # Assigned worker succeeds
        img = get_dummy_image('pothole_fixed.jpg')
        res_ok = self.client.post(url, {
            'proof_images': img,
            'remarks': 'Pothole asphalted and rolled flat.'
        }, format='multipart')
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data['status'], 'Work Done')

        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Work Done')
        self.assertIsNotNone(complaint.resolved_at)

        # Verify image saved
        self.assertTrue(ComplaintImage.objects.filter(complaint=complaint, image_type=ComplaintImage.ImageType.PROOF).exists())


# ==============================================================================
# GROUP D: DASHBOARD APIS
# ==============================================================================
class DashboardAPITests(BaseAPITestSetup):
    """
    Tests command center dashboard APIs:
    1. Dept KPI dashboard (metrics, department isolation, unauthorized denial)
    2. Ward statistics (per-ward breakdown for 4 wards)
    3. Overdue complaints (SLA compliance, department isolation, terminal exclusion, invalid filters)
    4. Trends and Workload endpoints
    """

    def setUp(self):
        self.client = APIClient()

    def test_01_kpi_dashboard_admin_and_officer(self):
        """Admin receives city-wide KPIs; Dept Officer receives department-scoped KPIs."""
        now = timezone.now()
        c_pwd = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='PWD KPI Issue', description='Pothole',
            status=Complaint.Status.SUBMITTED, priority_level=Complaint.Priority.HIGH,
            submitted_at=now - timedelta(days=2)
        )
        c_swm = Complaint.objects.create(
            citizen=self.citizen_2, category=self.cat_waste, department=self.dept_swm,
            ward=self.ward_2, title='SWM KPI Issue', description='Garbage',
            status=Complaint.Status.SUBMITTED, priority_level=Complaint.Priority.MEDIUM,
            submitted_at=now - timedelta(days=1)
        )

        url = reverse('dashboard:kpi')

        # Admin: sees both
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get(url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertTrue(res_admin.data['total'] >= 2)
        self.assertIn('severity_distribution', res_admin.data)

        # Dept Officer PWD: sees only PWD
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.get(url)
        self.assertEqual(res_officer.status_code, status.HTTP_200_OK)
        # SWM complaints excluded from PWD officer view
        self.assertEqual(res_officer.data['total'], Complaint.objects.filter(department=self.dept_pwd).count())

    def test_02_kpi_dashboard_unauthorized_roles_forbidden(self):
        """Citizens and workers are forbidden from accessing KPI dashboard."""
        url = reverse('dashboard:kpi')

        # Citizen
        self.client.force_authenticate(user=self.citizen_1)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        # Worker
        self.client.force_authenticate(user=self.worker_pwd)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)

        # Anonymous
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_03_ward_stats_breakdown(self):
        """Ward stats returns data for each municipal ward."""
        url = reverse('dashboard:ward_stats')
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(isinstance(response.data, list))
        # Ensure ward statistics structure
        ward_ids = [w['ward_id'] for w in response.data]
        self.assertIn(1, ward_ids)
        self.assertIn(2, ward_ids)

    def test_04_overdue_complaints_admin_and_officer(self):
        """Overdue dashboard returns complaints exceeding SLA targets."""
        now = timezone.now()
        # Create an overdue complaint (Critical SLA = 24h, submitted 48h ago)
        c_overdue = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='Overdue PWD Issue', description='Collapsed culvert',
            status=Complaint.Status.SUBMITTED, priority_level=Complaint.Priority.CRITICAL,
        )
        Complaint.objects.filter(id=c_overdue.id).update(submitted_at=now - timedelta(hours=48))

        url = reverse('dashboard:overdue')

        # Admin
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get(url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        overdue_ids = [c['id'] for c in res_admin.data]
        self.assertIn(str(c_overdue.id), overdue_ids)

        # Dept Officer PWD
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.get(url)
        self.assertEqual(res_officer.status_code, status.HTTP_200_OK)
        self.assertIn(str(c_overdue.id), [c['id'] for c in res_officer.data])

    def test_05_overdue_complaints_officer_cross_department_forbidden(self):
        """Dept officer attempting to filter another department's overdue data receives 403."""
        url = reverse('dashboard:overdue')
        self.client.force_authenticate(user=self.officer_pwd)
        # PWD officer attempts to inspect SWM dept
        response = self.client.get(f"{url}?dept_id={self.dept_swm.id}")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_06_overdue_complaints_terminal_statuses_excluded(self):
        """Closed, Resolved, Rejected, and Invalid complaints are excluded from overdue results."""
        now = timezone.now()

        # Closed complaint submitted 10 days ago (past all SLA targets)
        c_closed = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='Resolved Old Issue', description='Old pothole',
            status=Complaint.Status.CLOSED, priority_level=Complaint.Priority.CRITICAL,
            resolved_at=now - timedelta(days=9), closed_at=now - timedelta(days=8)
        )
        Complaint.objects.filter(id=c_closed.id).update(submitted_at=now - timedelta(days=10))

        url = reverse('dashboard:overdue')
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        overdue_ids = [c['id'] for c in response.data]
        self.assertNotIn(str(c_closed.id), overdue_ids)

    def test_07_overdue_complaints_invalid_filters_handled_safely(self):
        """Malformed dept_id or ward_id returns appropriate 400/404 errors."""
        url = reverse('dashboard:overdue')
        self.client.force_authenticate(user=self.admin)

        # Non-numeric dept_id
        res_str = self.client.get(f"{url}?dept_id=invalid_text")
        self.assertEqual(res_str.status_code, status.HTTP_400_BAD_REQUEST)

        # Non-positive dept_id
        res_neg = self.client.get(f"{url}?dept_id=-5")
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

        # Non-existent dept_id
        res_404 = self.client.get(f"{url}?dept_id=99999")
        self.assertEqual(res_404.status_code, status.HTTP_404_NOT_FOUND)

    def test_08_additional_dashboard_endpoints(self):
        """Verify trends, worker workload, and high-priority dashboards."""
        self.client.force_authenticate(user=self.admin)

        # Trends
        res_trends = self.client.get(reverse('dashboard:trends'))
        self.assertEqual(res_trends.status_code, status.HTTP_200_OK)

        # Workers
        res_workers = self.client.get(reverse('dashboard:workers'))
        self.assertEqual(res_workers.status_code, status.HTTP_200_OK)

        # High Priority
        res_high = self.client.get(reverse('dashboard:high_priority'))
        self.assertEqual(res_high.status_code, status.HTTP_200_OK)


# ==============================================================================
# GROUP E: RBAC PERMISSION MATRIX TESTS
# ==============================================================================
class RBACPermissionMatrixTests(BaseAPITestSetup):
    """
    Comprehensive positive and negative access matrix test across all 5 roles:
    1. Anonymous user
    2. Citizen
    3. Field Worker
    4. Department Officer
    5. Admin / Superuser
    """

    def setUp(self):
        self.client = APIClient()

    @patch('accounts.views.celery_app.control.ping', return_value=[{'celery@worker1': {'ok': 'pong'}}])
    @patch('accounts.views.redis_client.ping', return_value=True)
    def test_01_anonymous_user_access_matrix(self, mock_redis_ping, mock_celery_ping):
        """Anonymous users can only access public routes (register/login/health); all else 401."""
        # Public
        self.assertEqual(self.client.get('/api/health/').status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get('/api/v1/health/').status_code, status.HTTP_200_OK)

        # Protected - must be 401
        protected_endpoints = [
            ('GET', reverse('accounts:profile')),
            ('PATCH', reverse('accounts:fcm_token')),
            ('GET', reverse('complaints:complaint-list')),
            ('POST', reverse('complaints:complaint-list')),
            ('GET', reverse('complaints:worker-tasks')),
            ('GET', reverse('dashboard:kpi')),
            ('GET', reverse('dashboard:overdue')),
            ('GET', reverse('dashboard:ward_stats')),
            ('GET', reverse('complaints:category-list')),
            ('GET', reverse('complaints:ward-list')),
        ]

        for method, endpoint in protected_endpoints:
            if method == 'GET':
                res = self.client.get(endpoint)
            else:
                res = self.client.post(endpoint, {}, format='json')
            self.assertEqual(
                res.status_code, status.HTTP_401_UNAUTHORIZED,
                f"Anonymous user unexpectedly accessed {endpoint} with status {res.status_code}"
            )

    def test_02_citizen_role_access_matrix(self):
        """Citizens can submit complaints, see own complaints/profile; forbidden from worker/admin APIs."""
        self.client.force_authenticate(user=self.citizen_1)

        # Allowed
        self.assertEqual(self.client.get(reverse('accounts:profile')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('complaints:complaint-list')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('complaints:category-list')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('complaints:ward-list')).status_code, status.HTTP_200_OK)

        # Denied (403 Forbidden)
        forbidden_endpoints = [
            ('GET', reverse('complaints:worker-tasks')),
            ('GET', reverse('dashboard:kpi')),
            ('GET', reverse('dashboard:overdue')),
            ('GET', reverse('dashboard:ward_stats')),
            ('GET', reverse('dashboard:workers')),
            ('GET', reverse('dashboard:high_priority')),
            ('GET', reverse('accounts:admin_workers')),
        ]

        for method, endpoint in forbidden_endpoints:
            res = self.client.get(endpoint)
            self.assertEqual(
                res.status_code, status.HTTP_403_FORBIDDEN,
                f"Citizen unexpectedly accessed {endpoint} with status {res.status_code}"
            )

    def test_03_field_worker_role_access_matrix(self):
        """Workers can access their assigned tasks, own profile; forbidden from citizen submit, dashboards, admin APIs."""
        self.client.force_authenticate(user=self.worker_pwd)

        # Allowed
        self.assertEqual(self.client.get(reverse('accounts:profile')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('complaints:worker-tasks')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('complaints:category-list')).status_code, status.HTTP_200_OK)

        # Denied (403 Forbidden)
        forbidden_endpoints = [
            ('POST', reverse('complaints:complaint-list')),  # Cannot submit complaint
            ('GET', reverse('dashboard:kpi')),
            ('GET', reverse('dashboard:overdue')),
            ('GET', reverse('dashboard:ward_stats')),
            ('GET', reverse('accounts:admin_workers')),
        ]

        for method, endpoint in forbidden_endpoints:
            if method == 'POST':
                res = self.client.post(endpoint, {'title': 'Worker submit'}, format='json')
            else:
                res = self.client.get(endpoint)
            self.assertEqual(
                res.status_code, status.HTTP_403_FORBIDDEN,
                f"Worker unexpectedly accessed {endpoint} with status {res.status_code}"
            )

    def test_04_dept_officer_role_access_matrix(self):
        """Dept Officer can access department-scoped complaints, dashboards, workers; forbidden from other depts."""
        self.client.force_authenticate(user=self.officer_pwd)

        # Allowed
        self.assertEqual(self.client.get(reverse('accounts:profile')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('complaints:complaint-list')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('dashboard:kpi')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('dashboard:ward_stats')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('dashboard:overdue')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('accounts:admin_workers')).status_code, status.HTTP_200_OK)

        # Denied
        # Cannot access field worker task queue
        self.assertEqual(self.client.get(reverse('complaints:worker-tasks')).status_code, status.HTTP_403_FORBIDDEN)
        # Cannot submit citizen complaint
        res_post = self.client.post(reverse('complaints:complaint-list'), {'title': 'Officer submit'}, format='json')
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_05_admin_role_access_matrix(self):
        """Central Admin has city-wide administrative and reporting permissions."""
        self.client.force_authenticate(user=self.admin)

        admin_allowed_endpoints = [
            reverse('accounts:profile'),
            reverse('complaints:complaint-list'),
            reverse('dashboard:kpi'),
            reverse('dashboard:ward_stats'),
            reverse('dashboard:overdue'),
            reverse('dashboard:trends'),
            reverse('dashboard:workers'),
            reverse('dashboard:high_priority'),
            reverse('accounts:admin_workers'),
            reverse('complaints:category-list'),
            reverse('complaints:ward-list'),
        ]

        for endpoint in admin_allowed_endpoints:
            res = self.client.get(endpoint)
            self.assertEqual(
                res.status_code, status.HTTP_200_OK,
                f"Admin failed to access {endpoint} with status {res.status_code}"
            )


# ==============================================================================
# GROUP F: AUXILIARY APIS
# ==============================================================================
class AuxiliaryAPITests(BaseAPITestSetup):
    """
    Tests auxiliary municipal helper endpoints:
    1. Available Workers for assignment (GET /api/v1/worker/available/?complaint_id=X)
    2. Category List & Detail
    3. Ward List & Detail
    """

    def setUp(self):
        self.client = APIClient()

    def test_01_available_workers_dept_officer_and_admin(self):
        """Available workers endpoint lists eligible workers matching complaint department & ward."""
        complaint = Complaint.objects.create(
            citizen=self.citizen_1, category=self.cat_roads, department=self.dept_pwd,
            ward=self.ward_1, title='Need Worker Issue', description='Pothole',
        )
        url = f"/api/v1/worker/available/?complaint_id={complaint.id}"

        # Dept officer PWD
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.get(url)
        self.assertEqual(res_officer.status_code, status.HTTP_200_OK)
        worker_ids = [w['worker_id'] for w in res_officer.data]
        self.assertIn(self.worker_pwd.id, worker_ids)

        # SWM officer cannot view available workers for PWD complaint -> 403
        self.client.force_authenticate(user=self.officer_swm)
        res_swm = self.client.get(url)
        self.assertEqual(res_swm.status_code, status.HTTP_403_FORBIDDEN)

        # Citizen cannot view available workers -> 403
        self.client.force_authenticate(user=self.citizen_1)
        res_cit = self.client.get(url)
        self.assertEqual(res_cit.status_code, status.HTTP_403_FORBIDDEN)

    def test_02_available_workers_missing_complaint_id_rejected(self):
        """Missing complaint_id query parameter returns 400 Bad Request."""
        url = "/api/v1/worker/available/"
        self.client.force_authenticate(user=self.officer_pwd)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_03_category_and_ward_endpoints(self):
        """Categories and wards endpoints return 200 OK for authenticated users."""
        self.client.force_authenticate(user=self.citizen_1)

        # Categories list & detail
        res_cat = self.client.get(reverse('complaints:category-list'))
        self.assertEqual(res_cat.status_code, status.HTTP_200_OK)
        res_cat_detail = self.client.get(f"/api/v1/categories/{self.cat_roads.id}/")
        self.assertEqual(res_cat_detail.status_code, status.HTTP_200_OK)

        # Wards list & detail
        res_ward = self.client.get(reverse('complaints:ward-list'))
        self.assertEqual(res_ward.status_code, status.HTTP_200_OK)
        res_ward_detail = self.client.get(f"/api/v1/wards/{self.ward_1.id}/")
        self.assertEqual(res_ward_detail.status_code, status.HTTP_200_OK)
