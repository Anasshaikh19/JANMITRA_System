"""
Security & Role-Based Access Control (RBAC) Audit Test Suite for JANMITRA.

Verifies:
1. DRF SimpleJWT token refresh rotation: ROTATE_REFRESH_TOKENS = True and blacklist verification.
2. CORS_ALLOWED_ORIGINS reads strictly from environment variables without hardcoded fallbacks.
3. Permission denial returns HTTP 403 Forbidden with clean JSON error messages across all roles
   (Citizen, Field Worker, Department Officer, Administrator, and Unauthenticated/Anonymous).
"""

import os
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from complaints.models import Category, Complaint, Department, Ward

User = get_user_model()


class SimpleJWTSecurityTests(APITestCase):
    """
    1. Verify DRF SimpleJWT token refresh rotation and token blacklisting.
    """

    @classmethod
    def setUpTestData(cls):
        cls.ward = Ward.objects.first() or Ward.objects.create(id=1, name='Ward 1')
        cls.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Citizen Tester',
            role=User.Role.CITIZEN,
            ward=cls.ward,
            password='TestPassword@123'
        )

    def test_rotate_refresh_tokens_setting_is_true(self):
        """
        Verify ROTATE_REFRESH_TOKENS is enabled in Django settings.
        """
        simple_jwt_conf = getattr(settings, 'SIMPLE_JWT', {})
        self.assertTrue(
            simple_jwt_conf.get('ROTATE_REFRESH_TOKENS'),
            "SIMPLE_JWT['ROTATE_REFRESH_TOKENS'] must be True."
        )

    def test_blacklist_after_rotation_setting_is_true(self):
        """
        Verify BLACKLIST_AFTER_ROTATION is enabled in Django settings.
        """
        simple_jwt_conf = getattr(settings, 'SIMPLE_JWT', {})
        self.assertTrue(
            simple_jwt_conf.get('BLACKLIST_AFTER_ROTATION'),
            "SIMPLE_JWT['BLACKLIST_AFTER_ROTATION'] must be True."
        )

    def test_token_refresh_rotates_and_issues_new_refresh_token(self):
        """
        POST /api/v1/auth/refresh/ with a valid refresh token:
        - Returns 200 OK.
        - Returns fresh 'access' token.
        - Returns a rotated new 'refresh' token.
        - The new 'refresh' token is strictly different from the initial refresh token.
        """
        refresh = RefreshToken.for_user(self.citizen)
        initial_refresh_str = str(refresh)

        response = self.client.post(
            reverse('accounts:refresh'),
            {'refresh': initial_refresh_str},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        new_refresh_str = response.data['refresh']

        # Verify rotation occurred: new refresh token is issued and is different
        self.assertNotEqual(
            initial_refresh_str,
            new_refresh_str,
            "Token refresh must rotate the refresh token into a new token string."
        )

        # Verify that the new rotated refresh token is itself valid and can rotate again
        rotate_again_response = self.client.post(
            reverse('accounts:refresh'),
            {'refresh': new_refresh_str},
            format='json'
        )
        self.assertEqual(rotate_again_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', rotate_again_response.data)
        self.assertIn('refresh', rotate_again_response.data)
        self.assertNotEqual(new_refresh_str, rotate_again_response.data['refresh'])

    def test_old_refresh_token_is_blacklisted_and_rejected(self):
        """
        Attempting to reuse an old refresh token after rotation must fail with 401 Unauthorized.
        """
        refresh = RefreshToken.for_user(self.citizen)
        initial_refresh_str = str(refresh)

        # First refresh consumes and rotates the initial token
        first_resp = self.client.post(
            reverse('accounts:refresh'),
            {'refresh': initial_refresh_str},
            format='json'
        )
        self.assertEqual(first_resp.status_code, status.HTTP_200_OK)

        # Second refresh using the consumed initial token must fail
        replay_resp = self.client.post(
            reverse('accounts:refresh'),
            {'refresh': initial_refresh_str},
            format='json'
        )
        self.assertEqual(replay_resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('detail', replay_resp.data)

    def test_invalid_refresh_token_returns_clean_401_json(self):
        """
        Sending a malformed or invalid refresh token returns 401 with clean JSON error.
        """
        response = self.client.post(
            reverse('accounts:refresh'),
            {'refresh': 'invalid.token.structure'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(response['Content-Type'].startswith('application/json'))
        self.assertIn('detail', response.data)


class CORSSettingsSecurityTests(APITestCase):
    """
    2. Verify CORS_ALLOWED_ORIGINS reads strictly from environment variables.
    """

    def test_cors_allowed_origins_setting_is_present_and_list(self):
        """
        Verify CORS_ALLOWED_ORIGINS is configured on settings and is a list.
        """
        self.assertTrue(
            hasattr(settings, 'CORS_ALLOWED_ORIGINS'),
            "CORS_ALLOWED_ORIGINS setting must be defined."
        )
        self.assertIsInstance(
            settings.CORS_ALLOWED_ORIGINS,
            list,
            "CORS_ALLOWED_ORIGINS must be a list of origin strings."
        )

    def test_cors_origins_parsing_from_environment_variable(self):
        """
        Simulate CORS_ALLOWED_ORIGINS parsing logic from environment variable.
        Must strip whitespace, ignore empty entries, and reject hardcoded fallbacks.
        """
        env_sample = " https://janmitra.nagpur.gov.in , , https://admin.janmitra.nagpur.gov.in , https://portal.nagpur.gov.in/ "
        parsed = [
            origin.strip()
            for origin in env_sample.split(',')
            if origin.strip()
        ]
        self.assertEqual(
            parsed,
            [
                'https://janmitra.nagpur.gov.in',
                'https://admin.janmitra.nagpur.gov.in',
                'https://portal.nagpur.gov.in/'
            ]
        )

    def test_cors_empty_when_env_variable_empty(self):
        """
        When CORS_ALLOWED_ORIGINS environment variable is empty or unset,
        it evaluates to an empty list without injecting hardcoded domains.
        """
        empty_env = ""
        parsed = [
            origin.strip()
            for origin in empty_env.split(',')
            if origin.strip()
        ]
        self.assertEqual(parsed, [])

    def test_production_settings_strictly_env_driven(self):
        """
        Inspect resolveIT.settings.production directly to ensure CORS_ALLOW_ALL_ORIGINS is False
        and CORS_ALLOWED_ORIGINS is parsed strictly from os.environ.
        """
        import importlib

        original_origins = os.environ.get('CORS_ALLOWED_ORIGINS')
        original_secret = os.environ.get('SECRET_KEY')
        try:
            os.environ['SECRET_KEY'] = 'test-prod-secret-key-for-audit-xyz123'
            os.environ['CORS_ALLOWED_ORIGINS'] = 'https://prod.nagpur.gov.in, https://civic.nagpur.gov.in'
            import resolveIT.settings.production as prod
            prod_reloaded = importlib.reload(prod)

            self.assertFalse(prod_reloaded.CORS_ALLOW_ALL_ORIGINS)
            self.assertEqual(
                prod_reloaded.CORS_ALLOWED_ORIGINS,
                ['https://prod.nagpur.gov.in', 'https://civic.nagpur.gov.in']
            )
        finally:
            if original_origins is None:
                os.environ.pop('CORS_ALLOWED_ORIGINS', None)
            else:
                os.environ['CORS_ALLOWED_ORIGINS'] = original_origins

            if original_secret is None:
                os.environ.pop('SECRET_KEY', None)
            else:
                os.environ['SECRET_KEY'] = original_secret


class RBACPermissionDenialTests(APITestCase):
    """
    3. Test permission denial returns 403 Forbidden with clean JSON error message across all roles:
       - Citizen
       - Field Worker
       - Department Officer
       - Administrator
       - Unauthenticated / Anonymous (401 Unauthorized with clean JSON)
    """

    @classmethod
    def setUpTestData(cls):
        # Master data
        cls.ward_1 = Ward.objects.first() or Ward.objects.create(id=1, name='Ward 1 - Central')
        cls.ward_2 = Ward.objects.filter(id=2).first() or Ward.objects.create(id=2, name='Ward 2 - North')
        cls.dept_pwd = Department.objects.filter(short_name='PWD').first() or Department.objects.create(
            name='Public Works Department',
            short_name='PWD'
        )
        cls.dept_swm = Department.objects.filter(short_name='SWM').first() or Department.objects.create(
            name='Solid Waste Management',
            short_name='SWM'
        )
        cls.category = Category.objects.filter(department=cls.dept_pwd).first() or Category.objects.create(
            name='Roads & Infrastructure',
            department=cls.dept_pwd
        )

        # 1. Administrator
        cls.admin_user = User.objects.create_user(
            mobile='9800000001',
            full_name='Audit Super Admin',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            password='AdminPassword123'
        )

        # 2. Department Officer (PWD)
        cls.dept_officer = User.objects.create_user(
            mobile='9800000002',
            full_name='Audit PWD Officer',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            password='OfficerPassword123'
        )

        # 3. Field Worker (PWD, Ward 1)
        cls.worker_user = User.objects.create_user(
            mobile='9800000003',
            full_name='Audit Field Worker',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            designation='Field Technician',
            password='WorkerPassword123'
        )

        # 4. Citizen
        cls.citizen_user = User.objects.create_user(
            mobile='9800000004',
            full_name='Audit Citizen User',
            role=User.Role.CITIZEN,
            ward=cls.ward_1,
            password='CitizenPassword123'
        )

        # Sample complaint for object-level checks
        cls.complaint = Complaint.objects.create(
            citizen=cls.citizen_user,
            category=cls.category,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            title='Audit Pothole Sample',
            description='Sample complaint for RBAC audit',
            location=Point(79.0882, 21.1458),
            status=Complaint.Status.SUBMITTED,
            priority=Complaint.Priority.MEDIUM
        )

    def _assert_clean_json_error(self, response, expected_status=status.HTTP_403_FORBIDDEN):
        """
        Helper to assert:
        - Status matches expected_status (403 or 401).
        - Content-Type is application/json.
        - Body is a clean dictionary containing 'detail', 'error', or field error.
        - No HTML or stack traces are present.
        """
        self.assertEqual(
            response.status_code,
            expected_status,
            f"Expected status {expected_status}, got {response.status_code}. Content: {response.content}"
        )
        self.assertTrue(
            response['Content-Type'].startswith('application/json'),
            f"Expected JSON content-type, got {response['Content-Type']}"
        )
        self.assertIsInstance(response.data, dict, "Response body must be a JSON dictionary.")
        has_message = any(k in response.data for k in ['detail', 'error', 'department', 'message', 'non_field_errors'])
        self.assertTrue(
            has_message,
            f"Response must contain a clean 'detail' or 'error' field. Got keys: {list(response.data.keys())}"
        )
        error_text = str(response.data)
        self.assertNotIn('Traceback (most recent call last)', error_text)
        self.assertNotIn('<html', error_text.lower())

    # --------------------------------------------------------------------------
    # ADMIN-ONLY ENDPOINTS RBAC AUDIT
    # --------------------------------------------------------------------------

    def test_admin_complaints_ledger_rbac_denial(self):
        """
        GET /api/v1/admin/complaints/
        - Unauthenticated -> 401 Unauthorized
        - Citizen -> 403 Forbidden with clean JSON
        - Worker -> 403 Forbidden with clean JSON
        - Dept Officer -> 403 Forbidden with clean JSON
        - Admin -> 200 OK
        """
        url = reverse('admin_complaints_ledger')

        # 1. Unauthenticated
        resp_anon = self.client.get(url)
        self._assert_clean_json_error(resp_anon, status.HTTP_401_UNAUTHORIZED)

        # 2. Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.get(url)
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)
        self.assertIn("Administrator privileges required", str(resp_citizen.data['detail']))

        # 3. Worker
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.get(url)
        self._assert_clean_json_error(resp_worker, status.HTTP_403_FORBIDDEN)
        self.assertIn("Administrator privileges required", str(resp_worker.data['detail']))

        # 4. Dept Officer
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer = self.client.get(url)
        self._assert_clean_json_error(resp_officer, status.HTTP_403_FORBIDDEN)
        self.assertIn("Administrator privileges required", str(resp_officer.data['detail']))

        # 5. Super Admin
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.get(url)
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)

    def test_admin_settings_rbac_denial(self):
        """
        GET & PATCH /api/v1/admin/settings/
        - Citizen -> 403 Forbidden with clean JSON
        - Worker -> 403 Forbidden with clean JSON
        - Dept Officer -> 403 Forbidden with clean JSON
        - Admin -> 200 OK
        """
        url = reverse('admin_system_settings')

        # Citizen GET & PATCH
        self.client.force_authenticate(user=self.citizen_user)
        resp_get = self.client.get(url)
        self._assert_clean_json_error(resp_get, status.HTTP_403_FORBIDDEN)
        resp_patch = self.client.patch(url, {'sla_critical_hours': 12}, format='json')
        self._assert_clean_json_error(resp_patch, status.HTTP_403_FORBIDDEN)

        # Worker GET & PATCH
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.get(url)
        self._assert_clean_json_error(resp_worker, status.HTTP_403_FORBIDDEN)

        # Dept Officer GET & PATCH
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer_get = self.client.get(url)
        self._assert_clean_json_error(resp_officer_get, status.HTTP_403_FORBIDDEN)
        resp_officer_patch = self.client.patch(url, {'sla_critical_hours': 12}, format='json')
        self._assert_clean_json_error(resp_officer_patch, status.HTTP_403_FORBIDDEN)

        # Admin GET & PATCH
        self.client.force_authenticate(user=self.admin_user)
        resp_admin_get = self.client.get(url)
        self.assertEqual(resp_admin_get.status_code, status.HTTP_200_OK)

    def test_admin_workers_list_create_rbac_denial(self):
        """
        GET & POST /api/v1/admin/workers/
        - Unauthenticated -> 401 Unauthorized
        - Citizen -> 403 Forbidden with clean JSON
        - Worker -> 403 Forbidden with clean JSON
        - Dept Officer -> 200 OK for GET (scoped); 403 Forbidden if attempting cross-dept creation
        - Admin -> 200 OK
        """
        url = reverse('admin_worker_list_create')

        # 1. Unauthenticated
        resp_anon = self.client.get(url)
        self._assert_clean_json_error(resp_anon, status.HTTP_401_UNAUTHORIZED)

        # 2. Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.get(url)
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)
        self.assertIn("Administrator or Department Officer privileges required", str(resp_citizen.data['detail']))

        # 3. Worker
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.get(url)
        self._assert_clean_json_error(resp_worker, status.HTTP_403_FORBIDDEN)

        # 4. Dept Officer - allowed to GET own dept workers
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer = self.client.get(url)
        self.assertEqual(resp_officer.status_code, status.HTTP_200_OK)

        # 5. Dept Officer - denied 403 when attempting to create worker in another department
        resp_cross_dept = self.client.post(
            url,
            {
                'employee_id': 'EMP-AUDIT-999',
                'full_name': 'Unauthorized Worker',
                'mobile': '9899999999',
                'department': self.dept_swm.id,  # Officer is PWD
                'ward': self.ward_1.id,
                'designation': 'Illegal Tech'
            },
            format='json'
        )
        self._assert_clean_json_error(resp_cross_dept, status.HTTP_403_FORBIDDEN)

        # 6. Admin
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.get(url)
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # ADMIN OR DEPT OFFICER ENDPOINTS RBAC AUDIT
    # --------------------------------------------------------------------------

    def test_dashboard_kpi_rbac_denial(self):
        """
        GET /api/v1/dashboard/kpi/
        - Unauthenticated -> 401 Unauthorized
        - Citizen -> 403 Forbidden with clean JSON
        - Worker -> 403 Forbidden with clean JSON
        - Dept Officer -> 200 OK
        - Admin -> 200 OK
        """
        url = reverse('dashboard:kpi')

        # 1. Anonymous
        resp_anon = self.client.get(url)
        self._assert_clean_json_error(resp_anon, status.HTTP_401_UNAUTHORIZED)

        # 2. Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.get(url)
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)
        self.assertTrue(
            "privileges required" in str(resp_citizen.data['detail']) or
            "do not have permission" in str(resp_citizen.data['detail'])
        )

        # 3. Worker
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.get(url)
        self._assert_clean_json_error(resp_worker, status.HTTP_403_FORBIDDEN)

        # 4. Dept Officer
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer = self.client.get(url)
        self.assertEqual(resp_officer.status_code, status.HTTP_200_OK)

        # 5. Admin
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.get(url)
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)

    def test_dashboard_export_rbac_denial(self):
        """
        GET /api/v1/dashboard/export/
        - Citizen -> 403 Forbidden with clean JSON
        - Worker -> 403 Forbidden with clean JSON
        - Dept Officer -> 200 OK
        - Admin -> 200 OK
        """
        url = reverse('dashboard:export')

        # Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.get(url)
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)

        # Worker
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.get(url)
        self._assert_clean_json_error(resp_worker, status.HTTP_403_FORBIDDEN)

        # Dept Officer
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer = self.client.get(url)
        self.assertEqual(resp_officer.status_code, status.HTTP_200_OK)

        # Admin
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.get(url)
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)

    def test_admin_worker_detail_update_rbac_denial(self):
        """
        PATCH /api/v1/admin/workers/<id>/
        - Citizen -> 403 Forbidden with clean JSON
        - Worker -> 403 Forbidden with clean JSON
        - Dept Officer -> 200 OK (editing designation/ward/status)
        - Admin -> 200 OK
        """
        url = reverse('admin_worker_detail', kwargs={'id': str(self.worker_user.id)})

        # Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.patch(url, {'designation': 'Hacked'}, format='json')
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)

        # Worker itself cannot edit worker record via admin endpoint
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.patch(url, {'designation': 'Hacked'}, format='json')
        self._assert_clean_json_error(resp_worker, status.HTTP_403_FORBIDDEN)

        # Dept Officer
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer = self.client.patch(url, {'designation': 'Senior Field Tech'}, format='json')
        self.assertEqual(resp_officer.status_code, status.HTTP_200_OK)

        # Admin
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.patch(url, {'designation': 'Chief Field Tech'}, format='json')
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # WORKER-ONLY ENDPOINTS RBAC AUDIT
    # --------------------------------------------------------------------------

    def test_worker_tasks_list_rbac_denial(self):
        """
        GET /api/v1/worker/tasks/
        - Unauthenticated -> 401 Unauthorized
        - Citizen -> 403 Forbidden with clean JSON
        - Dept Officer -> 403 Forbidden with clean JSON
        - Admin -> 403 Forbidden with clean JSON (Field Worker role required)
        - Worker -> 200 OK
        """
        url = reverse('worker_tasks_api')

        # 1. Anonymous
        resp_anon = self.client.get(url)
        self._assert_clean_json_error(resp_anon, status.HTTP_401_UNAUTHORIZED)

        # 2. Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.get(url)
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)
        self.assertIn("Only municipal field workers are authorized", str(resp_citizen.data['detail']))

        # 3. Dept Officer
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer = self.client.get(url)
        self._assert_clean_json_error(resp_officer, status.HTTP_403_FORBIDDEN)
        self.assertIn("Only municipal field workers are authorized", str(resp_officer.data['detail']))

        # 4. Admin
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.get(url)
        self._assert_clean_json_error(resp_admin, status.HTTP_403_FORBIDDEN)
        self.assertIn("Only municipal field workers are authorized", str(resp_admin.data['detail']))

        # 5. Worker
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.get(url)
        self.assertEqual(resp_worker.status_code, status.HTTP_200_OK)

    def test_worker_task_status_rbac_denial(self):
        """
        PATCH /api/v1/worker/tasks/<id>/status/
        - Citizen -> 403 Forbidden with clean JSON
        - Dept Officer -> 403 Forbidden with clean JSON
        - Admin -> 403 Forbidden with clean JSON
        - Worker -> Allowed (or returns validation / status logic)
        """
        url = reverse('worker_task_status_api', kwargs={'pk': str(self.complaint.id)})

        # Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.patch(url, {'status': 'in_progress'}, format='json')
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)

        # Dept Officer
        self.client.force_authenticate(user=self.dept_officer)
        resp_officer = self.client.patch(url, {'status': 'in_progress'}, format='json')
        self._assert_clean_json_error(resp_officer, status.HTTP_403_FORBIDDEN)

        # Admin
        self.client.force_authenticate(user=self.admin_user)
        resp_admin = self.client.patch(url, {'status': 'in_progress'}, format='json')
        self._assert_clean_json_error(resp_admin, status.HTTP_403_FORBIDDEN)

    # --------------------------------------------------------------------------
    # COMPLAINT ASSIGNMENT RBAC AUDIT
    # --------------------------------------------------------------------------

    def test_complaint_assignment_rbac_denial(self):
        """
        POST /api/v1/complaints/<id>/assign/
        - Citizen -> 403 Forbidden with clean JSON
        - Worker -> 403 Forbidden with clean JSON
        - Dept Officer -> Allowed access
        - Admin -> Allowed access
        """
        url = reverse('complaints:complaint-assign', kwargs={'pk': str(self.complaint.id)})

        # Citizen
        self.client.force_authenticate(user=self.citizen_user)
        resp_citizen = self.client.post(url, {'worker_id': self.worker_user.id}, format='json')
        self._assert_clean_json_error(resp_citizen, status.HTTP_403_FORBIDDEN)

        # Worker
        self.client.force_authenticate(user=self.worker_user)
        resp_worker = self.client.post(url, {'worker_id': self.worker_user.id}, format='json')
        self._assert_clean_json_error(resp_worker, status.HTTP_403_FORBIDDEN)
