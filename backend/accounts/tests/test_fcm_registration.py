"""
Tests for FCM Token Registration and Device Token Management.
API Endpoints:
- PATCH /api/v1/auth/fcm-token/
- POST  /api/v1/auth/fcm-token/
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from complaints.models import Department, Ward

User = get_user_model()


class FCMTokenRegistrationTests(APITestCase):
    """
    Comprehensive test suite for FCM token registration across all user roles,
    validations, and HTTP methods.
    """

    @classmethod
    def setUpTestData(cls):
        cls.ward = Ward.objects.first() or Ward.objects.create(id=1, name='Ward 1')
        cls.dept = Department.objects.first() or Department.objects.create(id=1, name='PWD', short_name='PWD')

        # 1. Citizen
        cls.citizen = User.objects.create_user(
            mobile='9821100001',
            full_name='FCM Citizen',
            role=User.Role.CITIZEN,
            ward=cls.ward,
            password='Password@123'
        )

        # 2. Worker
        cls.worker = User.objects.create_user(
            mobile='9821100002',
            full_name='FCM Field Worker',
            role=User.Role.WORKER,
            ward=cls.ward,
            department=cls.dept,
            designation='Technician',
            password='Password@123'
        )

        # 3. Dept Officer
        cls.officer = User.objects.create_user(
            mobile='9821100003',
            full_name='FCM Dept Officer',
            role=User.Role.DEPT_OFFICER,
            ward=cls.ward,
            department=cls.dept,
            password='Password@123'
        )

        # 4. Admin
        cls.admin = User.objects.create_user(
            mobile='9821100004',
            full_name='FCM Administrator',
            role=User.Role.ADMIN,
            is_staff=True,
            password='Password@123'
        )

        cls.url = reverse('accounts:fcm_token')

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests must be rejected with HTTP 401 Unauthorized."""
        response = self.client.patch(self.url, {'fcm_token': 'sample_token_xyz'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(response['Content-Type'].startswith('application/json'))

    def test_citizen_fcm_token_registration_patch_success(self):
        """Citizen can register or update their FCM token via PATCH."""
        self.client.force_authenticate(user=self.citizen)
        token_str = 'fcm_token_citizen_device_alpha_12345'
        response = self.client.patch(self.url, {'fcm_token': token_str}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('fcm_token'), token_str)
        self.assertIn('message', response.data)

        self.citizen.refresh_from_db()
        self.assertEqual(self.citizen.fcm_token, token_str)

    def test_fcm_token_registration_post_backward_compatibility(self):
        """FCM token update endpoint supports POST for backward compatibility."""
        self.client.force_authenticate(user=self.citizen)
        token_str = 'fcm_token_citizen_device_beta_67890'
        response = self.client.post(self.url, {'fcm_token': token_str}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('fcm_token'), token_str)

        self.citizen.refresh_from_db()
        self.assertEqual(self.citizen.fcm_token, token_str)

    def test_worker_fcm_token_registration_success(self):
        """Field worker can register FCM token for receiving push task alerts."""
        self.client.force_authenticate(user=self.worker)
        worker_token = 'fcm_token_worker_device_gamma_1111'
        response = self.client.patch(self.url, {'fcm_token': worker_token}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.worker.refresh_from_db()
        self.assertEqual(self.worker.fcm_token, worker_token)

    def test_officer_fcm_token_registration_success(self):
        """Department officer can register FCM token for receiving escalation alerts."""
        self.client.force_authenticate(user=self.officer)
        officer_token = 'fcm_token_officer_device_delta_2222'
        response = self.client.patch(self.url, {'fcm_token': officer_token}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.officer.refresh_from_db()
        self.assertEqual(self.officer.fcm_token, officer_token)

    def test_admin_fcm_token_registration_success(self):
        """Administrator can register FCM token for emergency broadcasting."""
        self.client.force_authenticate(user=self.admin)
        admin_token = 'fcm_token_admin_device_epsilon_3333'
        response = self.client.patch(self.url, {'fcm_token': admin_token}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.fcm_token, admin_token)

    def test_missing_fcm_token_field_rejected(self):
        """Empty payload without fcm_token field returns HTTP 400 Bad Request."""
        self.client.force_authenticate(user=self.citizen)
        response = self.client.patch(self.url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('required', response.data['error'])

    def test_empty_string_fcm_token_rejected(self):
        """fcm_token with empty string returns HTTP 400 Bad Request."""
        self.client.force_authenticate(user=self.citizen)
        response = self.client.patch(self.url, {'fcm_token': ''}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_whitespace_string_fcm_token_rejected(self):
        """fcm_token with whitespace-only string returns HTTP 400 Bad Request."""
        self.client.force_authenticate(user=self.citizen)
        response = self.client.patch(self.url, {'fcm_token': '     '}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_none_value_fcm_token_rejected(self):
        """fcm_token set to None returns HTTP 400 Bad Request."""
        self.client.force_authenticate(user=self.citizen)
        response = self.client.patch(self.url, {'fcm_token': None}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_token_overwrite_on_device_refresh(self):
        """Re-registering a new token replaces the previous token cleanly."""
        self.client.force_authenticate(user=self.citizen)

        # Initial registration
        self.client.patch(self.url, {'fcm_token': 'old_token_xyz'}, format='json')
        self.citizen.refresh_from_db()
        self.assertEqual(self.citizen.fcm_token, 'old_token_xyz')

        # Updated registration
        self.client.patch(self.url, {'fcm_token': 'new_rotated_token_abc'}, format='json')
        self.citizen.refresh_from_db()
        self.assertEqual(self.citizen.fcm_token, 'new_rotated_token_abc')
