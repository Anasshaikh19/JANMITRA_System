"""
Authentication and account API tests for accounts app (JANMITRA - Nagpur Municipal Corporation).
Audited for database isolation, security validations, and strict ward seeding requirements.
"""

from django.contrib.auth import authenticate
from django.db import connection
from django.test import RequestFactory, TestCase
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from accounts.views import (
    CitizenRegisterView,
    FCMTokenUpdateView,
    LoginView,
    TokenRefreshView,
    UserProfileView,
    WorkerCreateView,
)
from complaints.models import Department, Ward


class AuthenticationTests(TestCase):
    """
    Comprehensive tests for registration, login, JWT issuance,
    validation rules, token refresh, and FCM token updates.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.client = APIClient()

        # Seed only Ward 1 and Ward 2 to verify that unseeded wards (e.g. Ward 3) are not silently auto-created
        self.ward1, _ = Ward.objects.get_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward2, _ = Ward.objects.get_or_create(id=2, defaults={'name': 'Ward 2'})
        self.dept, _ = Department.objects.get_or_create(
            id=1,
            defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )

        # 1. Administrator with NULL mobile (isolated test admin, does NOT delete or recreate real admin)
        self.admin = User.objects.create(
            full_name='Janmitra Test Admin',
            email='admin_audit_test@example.com',
            mobile=None,
            role='admin',
            is_staff=True,
            is_superuser=True,
            is_active=True
        )
        self.admin.set_password('Admin@12345')
        self.admin.save()

        # 2. Existing Citizen user with mobile
        self.citizen = User.objects.create_user(
            mobile='9876543210',
            full_name='Ramesh Sharma',
            email='ramesh@example.com',
            password='Citizen@12345',
            role='citizen',
            ward=self.ward1,
            is_active=True
        )

        # 3. Inactive user for testing deactivation check
        self.inactive_user = User.objects.create_user(
            mobile='9123456789',
            full_name='Inactive Citizen',
            email='inactive@example.com',
            password='Inactive@12345',
            role='citizen',
            is_active=False
        )

    def test_citizen_registration_success(self):
        """
        Verify successful citizen registration via POST /api/v1/auth/register/.
        Returns {id, name, mobile, role, ward} + JWT tokens.
        """
        payload = {
            'name': 'Pooja Patil',
            'mobile': '9876543211',
            'ward': 2,
            'password': 'Citizen@123',
            'email': 'pooja@example.com'
        }
        response = self.client.post('/api/v1/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify returned data structure
        self.assertIn('id', response.data)
        self.assertEqual(response.data['name'], 'Pooja Patil')
        self.assertEqual(response.data['mobile'], '9876543211')
        self.assertEqual(response.data['role'], 'citizen')
        self.assertEqual(response.data['ward'], 2)

        # Verify JWT tokens returned
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertTrue(len(response.data['access']) > 20)

        # Verify user persisted in database
        user = User.objects.get(mobile='9876543211')
        self.assertEqual(user.full_name, 'Pooja Patil')
        self.assertEqual(user.role, 'citizen')
        self.assertEqual(user.ward.id, 2)
        self.assertTrue(user.check_password('Citizen@123'))

    def test_registration_unseeded_ward_fails(self):
        """
        Safety Audit #2: Confirm that citizen registration does NOT silently
        create missing Ward records and strictly requires existing seeded wards.
        """
        # Ensure Ward 3 is not seeded in database
        Ward.objects.filter(id=3).delete()

        payload = {
            'name': 'Unseeded Ward User',
            'mobile': '9876543299',
            'ward': 3,  # Valid ward choice 1-4, but not seeded in DB
            'password': 'Password@123'
        }
        response = self.client.post('/api/v1/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', response.data)

        # Verify Ward 3 was NOT silently auto-created
        self.assertFalse(Ward.objects.filter(id=3).exists())
        # Verify user was NOT created
        self.assertFalse(User.objects.filter(mobile='9876543299').exists())

    def test_registration_duplicate_mobile_fails(self):
        """
        Verify registration fails when attempting to use an already registered mobile.
        """
        payload = {
            'name': 'Duplicate User',
            'mobile': '9876543210',  # already registered to self.citizen
            'ward': 1,
            'password': 'Password@123'
        }
        response = self.client.post('/api/v1/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', response.data)

    def test_registration_invalid_mobile_fails(self):
        """
        Verify registration fails if mobile is not exactly 10 digits.
        """
        # Less than 10 digits
        res_short = self.client.post('/api/v1/auth/register/', {
            'name': 'Short Mobile',
            'mobile': '98765',
            'ward': 1,
            'password': 'Password@123'
        }, format='json')
        self.assertEqual(res_short.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', res_short.data)

        # Non-digits in mobile
        res_alpha = self.client.post('/api/v1/auth/register/', {
            'name': 'Alpha Mobile',
            'mobile': '987654321A',
            'ward': 1,
            'password': 'Password@123'
        }, format='json')
        self.assertEqual(res_alpha.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', res_alpha.data)

    def test_registration_invalid_ward_fails(self):
        """
        Verify registration fails if ward is not 1, 2, 3, or 4.
        """
        res_ward_invalid = self.client.post('/api/v1/auth/register/', {
            'name': 'Invalid Ward',
            'mobile': '9876543215',
            'ward': 5,  # Invalid: only 1, 2, 3, 4 permitted
            'password': 'Password@123'
        }, format='json')
        self.assertEqual(res_ward_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', res_ward_invalid.data)

    def test_login_success_returns_jwt(self):
        """
        Verify POST /api/v1/auth/login/ validates mobile + password
        and returns {access, refresh, user: {id, name, role, ward, department}}.
        """
        response = self.client.post('/api/v1/auth/login/', {
            'mobile': '9876543210',
            'password': 'Citizen@12345'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check tokens
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertTrue(len(response.data['access']) > 20)

        # Check user payload
        self.assertIn('user', response.data)
        user_data = response.data['user']
        self.assertEqual(user_data['id'], self.citizen.id)
        self.assertEqual(user_data['name'], 'Ramesh Sharma')
        self.assertEqual(user_data['role'], 'citizen')
        self.assertEqual(user_data['ward'], 1)
        self.assertIn('department', user_data)

    def test_login_wrong_password_fails(self):
        """
        Verify login fails with a clear error for wrong credentials (not a 500 error).
        """
        response = self.client.post('/api/v1/auth/login/', {
            'mobile': '9876543210',
            'password': 'WrongPassword@999'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertTrue('detail' in response.data or 'error' in response.data)

    def test_fcm_token_update(self):
        """
        Verify PATCH /api/v1/auth/fcm-token/ updates user.fcm_token from request body.
        """
        # Authenticate as citizen
        login_res = self.client.post('/api/v1/auth/login/', {
            'mobile': '9876543210',
            'password': 'Citizen@12345'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        access_token = login_res.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

        new_fcm_token = 'fcm_device_token_xyz_sample_12345'
        response = self.client.patch('/api/v1/auth/fcm-token/', {
            'fcm_token': new_fcm_token
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('fcm_token'), new_fcm_token)

        # Verify database record updated
        self.citizen.refresh_from_db()
        self.assertEqual(self.citizen.fcm_token, new_fcm_token)

    def test_unauthenticated_fcm_token_update_returns_401_or_403(self):
        """
        Safety Audit #3: Test that unauthenticated requests to
        PATCH /api/v1/auth/fcm-token/ return 401 or 403.
        """
        self.client.credentials()  # Clear credentials to ensure anonymous request
        response = self.client.patch('/api/v1/auth/fcm-token/', {
            'fcm_token': 'unauthenticated_token_attempt'
        }, format='json')
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
        )

    def test_token_refresh(self):
        """
        Verify POST /api/v1/auth/refresh/ provides standard SimpleJWT refresh.
        """
        login_res = self.client.post('/api/v1/auth/login/', {
            'mobile': '9876543210',
            'password': 'Citizen@12345'
        }, format='json')
        refresh_token = login_res.data['refresh']

        refresh_res = self.client.post('/api/v1/auth/refresh/', {
            'refresh': refresh_token
        }, format='json')

        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_res.data)
        self.assertTrue(len(refresh_res.data['access']) > 20)

    def test_exact_registered_url_paths_via_resolver(self):
        """
        Safety Audit #4: Verify the exact registered URL paths using Django's URL resolver.
        """
        expected_resolutions = [
            ('/api/v1/auth/register/', CitizenRegisterView),
            ('/api/v1/auth/login/', LoginView),
            ('/api/v1/auth/refresh/', TokenRefreshView),
            ('/api/v1/auth/fcm-token/', FCMTokenUpdateView),
            ('/api/v1/auth/profile/', UserProfileView),
            ('/api/v1/auth/workers/', WorkerCreateView),
            ('/auth/register/', CitizenRegisterView),
            ('/auth/login/', LoginView),
            ('/auth/refresh/', TokenRefreshView),
            ('/auth/fcm-token/', FCMTokenUpdateView),
        ]
        for url_path, expected_view_class in expected_resolutions:
            match = resolve(url_path)
            view_class = getattr(match.func, 'view_class', match.func)
            self.assertEqual(
                view_class,
                expected_view_class,
                f"URL {url_path} did not resolve to {expected_view_class.__name__}"
            )

    def test_admin_login_with_email_and_null_mobile(self):
        """
        Verify administrator with mobile=None authenticates via email.
        """
        response = self.client.post('/api/v1/auth/login/', {
            'email': self.admin.email,
            'password': 'Admin@12345'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['email'], self.admin.email)

    def test_citizen_login_with_email(self):
        """
        Verify citizen can authenticate using registered email.
        """
        response = self.client.post('/api/v1/auth/login/', {
            'email': 'ramesh@example.com',
            'password': 'Citizen@12345'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_inactive_user_cannot_login(self):
        """
        Verify inactive user is blocked from authentication.
        """
        response = self.client.post('/api/v1/auth/login/', {
            'mobile': '9123456789',
            'password': 'Inactive@12345'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
