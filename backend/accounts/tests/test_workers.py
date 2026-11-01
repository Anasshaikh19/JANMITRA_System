"""
Worker Management API tests for accounts app (JANMITRA - Nagpur Municipal Corporation).
Tests: WorkerListCreateView, WorkerDetailView, role access restrictions, and validation.
"""

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from complaints.models import Department, Ward


class WorkerManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Seed Departments
        self.dept1, _ = Department.objects.get_or_create(id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'})
        self.dept2, _ = Department.objects.get_or_create(id=2, defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'})

        # Seed Wards
        self.ward1, _ = Ward.objects.get_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward2, _ = Ward.objects.get_or_create(id=2, defaults={'name': 'Ward 2'})

        # Seed Admin
        self.admin = User.objects.create_user(
            mobile='9800000000',
            full_name='Central Admin',
            email='admin@janmitra.gov.in',
            role=User.Role.ADMIN,
            is_staff=True,
            password='Admin@12345'
        )

        # Seed Dept Officers
        self.officer_pwd = User.objects.create_user(
            mobile='9800000001',
            full_name='PWD Officer',
            email='pwd.officer@janmitra.gov.in',
            role=User.Role.DEPT_OFFICER,
            department=self.dept1,
            ward=self.ward1,
            password='Officer@123'
        )
        self.officer_swm = User.objects.create_user(
            mobile='9800000002',
            full_name='SWM Officer',
            email='swm.officer@janmitra.gov.in',
            role=User.Role.DEPT_OFFICER,
            department=self.dept2,
            ward=self.ward2,
            password='Officer@123'
        )

        # Seed Existing Worker in PWD
        self.worker1 = User.objects.create_user(
            mobile='9810010001',
            full_name='PWD Field Worker',
            employee_id='NMC-PWD-001',
            role=User.Role.WORKER,
            department=self.dept1,
            ward=self.ward1,
            designation='Road Inspector',
            password='Worker@123'
        )

        self.list_create_url = reverse('admin_worker_list_create')

    # 1. Admin can register worker
    def test_admin_can_register_worker(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            'name': 'Ramesh Pawar',
            'mobile': '9810020001',
            'employee_id': 'NMC-SWM-002',
            'department': 2,  # SWM
            'ward': 2,
            'designation': 'Sanitation Worker'
        }
        res = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Ramesh Pawar')
        self.assertEqual(res.data['dept'], self.dept2.name)
        self.assertEqual(res.data['ward'], self.ward2.name)

        # Verify DB
        worker = User.objects.get(mobile='9810020001')
        self.assertEqual(worker.role, User.Role.WORKER)
        self.assertEqual(worker.department, self.dept2)
        self.assertEqual(worker.ward, self.ward2)

    # 2. Officer can register worker in own department
    def test_officer_can_register_worker_own_dept(self):
        self.client.force_authenticate(user=self.officer_pwd)
        payload = {
            'name': 'Ganesh Gaikwad',
            'mobile': '9810010002',
            'employee_id': 'NMC-PWD-002',
            'ward': 1,
            'designation': 'Pothole Specialist'
            # Department omitted or set to own
        }
        res = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['dept'], self.dept1.name)

        worker = User.objects.get(mobile='9810010002')
        self.assertEqual(worker.department, self.dept1)

    # 3. Officer cannot register for other department
    def test_officer_cannot_register_for_other_dept(self):
        self.client.force_authenticate(user=self.officer_pwd)
        payload = {
            'name': 'Illegal Cross Dept Worker',
            'mobile': '9810010099',
            'employee_id': 'NMC-SWM-999',
            'department': 2,  # Trying to register for SWM while being PWD officer
            'ward': 1,
            'designation': 'Sweeper'
        }
        res = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(mobile='9810010099').exists())

    # 4. Duplicate mobile fails
    def test_duplicate_mobile_fails(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            'name': 'Duplicate Worker',
            'mobile': '9810010001',  # already assigned to self.worker1
            'employee_id': 'NMC-PWD-888',
            'department': 1,
            'ward': 1
        }
        res = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mobile', res.data)

    # 5. Admin can change department
    def test_admin_can_change_dept(self):
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        res = self.client.patch(detail_url, {'department': 2}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.worker1.refresh_from_db()
        self.assertEqual(self.worker1.department, self.dept2)

    # 6. Officer cannot change department
    def test_officer_cannot_change_dept(self):
        self.client.force_authenticate(user=self.officer_pwd)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        res = self.client.patch(detail_url, {'department': 2}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.worker1.refresh_from_db()
        self.assertEqual(self.worker1.department, self.dept1)

    # 7. Mobile and employee_id are read-only
    def test_readonly_mobile_and_employee_id(self):
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        res_mobile = self.client.patch(detail_url, {'mobile': '9999999999'}, format='json')
        self.assertEqual(res_mobile.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res_mobile.data)

        res_emp = self.client.patch(detail_url, {'employee_id': 'NEW-ID-001'}, format='json')
        self.assertEqual(res_emp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res_emp.data)

    # 8. Dept officer cannot view or patch worker from another department
    def test_officer_cannot_manage_other_dept_worker(self):
        self.client.force_authenticate(user=self.officer_swm)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        # SWM officer accessing PWD worker
        res_get = self.client.get(detail_url)
        self.assertEqual(res_get.status_code, status.HTTP_403_FORBIDDEN)

        res_patch = self.client.patch(detail_url, {'designation': 'Hacked Designation'}, format='json')
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

    # 9. GET workers with search filter
    def test_get_workers_search_filter(self):
        self.client.force_authenticate(user=self.admin)
        # Create a second worker in SWM
        User.objects.create_user(
            mobile='9810020002',
            full_name='Suresh Deshmukh',
            employee_id='NMC-SWM-777',
            role=User.Role.WORKER,
            department=self.dept2,
            ward=self.ward2,
            designation='Sanitation Supervisor',
            password='Worker@123'
        )

        # Search by name
        res = self.client.get(self.list_create_url, {'search': 'Suresh'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['employee_id'], 'NMC-SWM-777')

        # Search by employee ID
        res_emp = self.client.get(self.list_create_url, {'search': 'PWD-001'})
        self.assertEqual(res_emp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_emp.data), 1)
        self.assertEqual(res_emp.data[0]['mobile'], '9810010001')

        # Search by mobile
        res_mob = self.client.get(self.list_create_url, {'search': '9810020002'})
        self.assertEqual(res_mob.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_mob.data), 1)
        self.assertEqual(res_mob.data[0]['name'], 'Suresh Deshmukh')

    # 10. GET workers with department and ward filters
    def test_get_workers_dept_and_ward_filters(self):
        self.client.force_authenticate(user=self.admin)
        User.objects.create_user(
            mobile='9810020003',
            full_name='Vijay Shinde',
            employee_id='NMC-SWM-888',
            role=User.Role.WORKER,
            department=self.dept2,
            ward=self.ward2,
            password='Worker@123'
        )

        # Filter by department 1 (PWD)
        res_dept1 = self.client.get(self.list_create_url, {'department': 1})
        self.assertEqual(res_dept1.status_code, status.HTTP_200_OK)
        self.assertTrue(all(w['department_id'] == 1 for w in res_dept1.data))

        # Filter by department 2 (SWM)
        res_dept2 = self.client.get(self.list_create_url, {'dept': 'SWM'})
        self.assertEqual(res_dept2.status_code, status.HTTP_200_OK)
        self.assertTrue(all(w['department_id'] == 2 for w in res_dept2.data))

        # Filter by ward 2
        res_ward2 = self.client.get(self.list_create_url, {'ward': 2})
        self.assertEqual(res_ward2.status_code, status.HTTP_200_OK)
        self.assertTrue(all(w['ward_id'] == 2 for w in res_ward2.data))

    # 11. GET workers with status filter
    def test_get_workers_status_filter(self):
        self.client.force_authenticate(user=self.admin)
        User.objects.create_user(
            mobile='9810030001',
            full_name='Inactive Worker',
            employee_id='NMC-PWD-999',
            role=User.Role.WORKER,
            department=self.dept1,
            ward=self.ward1,
            status=User.Status.INACTIVE,
            password='Worker@123'
        )

        res_active = self.client.get(self.list_create_url, {'status': 'ACTIVE'})
        self.assertEqual(res_active.status_code, status.HTTP_200_OK)
        self.assertTrue(all(w['status'].lower() == 'active' for w in res_active.data))

        res_inactive = self.client.get(self.list_create_url, {'status': 'INACTIVE'})
        self.assertEqual(res_inactive.status_code, status.HTTP_200_OK)
        self.assertTrue(all(w['status'].lower() == 'inactive' for w in res_inactive.data))

    # 12. Dept Officer is locked to own department on GET
    def test_dept_officer_get_locked_to_own_department(self):
        self.client.force_authenticate(user=self.officer_pwd)
        User.objects.create_user(
            mobile='9810020004',
            full_name='SWM Worker Under Radar',
            employee_id='NMC-SWM-444',
            role=User.Role.WORKER,
            department=self.dept2,
            ward=self.ward2,
            password='Worker@123'
        )

        # PWD Officer requests all workers
        res = self.client.get(self.list_create_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(all(w['department_id'] == self.dept1.id for w in res.data))

        # PWD Officer tries to query department=2
        res_cross = self.client.get(self.list_create_url, {'department': 2})
        self.assertEqual(res_cross.status_code, status.HTTP_200_OK)
        self.assertTrue(all(w['department_id'] == self.dept1.id for w in res_cross.data))

    # 13. POST worker validations (duplicate employee_id, missing name, invalid ward)
    def test_post_worker_validations(self):
        self.client.force_authenticate(user=self.admin)

        # Duplicate employee_id
        res_emp = self.client.post(self.list_create_url, {
            'name': 'Duplicate Emp Worker',
            'mobile': '9810050001',
            'employee_id': 'NMC-PWD-001',  # already taken by worker1
            'department': 1,
            'ward': 1,
        }, format='json')
        self.assertEqual(res_emp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('employee_id', res_emp.data)

        # Missing name
        res_name = self.client.post(self.list_create_url, {
            'mobile': '9810050002',
            'employee_id': 'NMC-PWD-005',
            'department': 1,
            'ward': 1,
        }, format='json')
        self.assertEqual(res_name.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', res_name.data)

        # Invalid ward (ward 5 does not exist)
        res_ward = self.client.post(self.list_create_url, {
            'name': 'Invalid Ward Worker',
            'mobile': '9810050003',
            'employee_id': 'NMC-PWD-006',
            'department': 1,
            'ward': 5,
        }, format='json')
        self.assertEqual(res_ward.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', res_ward.data)

    # 14. Unauthorized and Citizen access is forbidden
    def test_citizen_and_unauthenticated_access_denied(self):
        # Unauthenticated
        res_unauth = self.client.get(self.list_create_url)
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Citizen
        citizen = User.objects.create_user(
            mobile='9800000099',
            full_name='Citizen Tester',
            role=User.Role.CITIZEN,
            password='Citizen@123'
        )
        self.client.force_authenticate(user=citizen)
        res_citizen_get = self.client.get(self.list_create_url)
        self.assertEqual(res_citizen_get.status_code, status.HTTP_403_FORBIDDEN)

        res_citizen_post = self.client.post(self.list_create_url, {
            'name': 'Illegal Worker',
            'mobile': '9810099999',
            'employee_id': 'NMC-HACK-001',
            'department': 1,
            'ward': 1
        }, format='json')
        self.assertEqual(res_citizen_post.status_code, status.HTTP_403_FORBIDDEN)

    # 15. New worker has unusable password and no shared default password
    def test_new_worker_has_no_shared_default_password(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(self.list_create_url, {
            'name': 'Secure Worker',
            'mobile': '9810088888',
            'employee_id': 'NMC-SEC-002',
            'department': 1,
            'ward': 1,
            'designation': 'Road Inspector'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Output must never expose password or hash or fcm_token
        self.assertNotIn('password', res.data)
        self.assertNotIn('password_hash', res.data)
        self.assertNotIn('fcm_token', res.data)

        worker = User.objects.get(mobile='9810088888')
        # Must have unusable password
        self.assertFalse(worker.has_usable_password())
        # Must not have Worker@123
        self.assertFalse(worker.check_password('Worker@123'))

        # Worker cannot log in until an administrative credential/onboarding workflow sets password
        self.client.logout()
        login_res = self.client.post('/api/v1/auth/login/', {
            'mobile': '9810088888',
            'password': 'Worker@123'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_400_BAD_REQUEST)

    # 16. Protected role and privilege fields cannot be set by client payload
    def test_client_cannot_supply_protected_role_fields(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(self.list_create_url, {
            'name': 'Privilege Escalation Tester',
            'mobile': '9810077777',
            'employee_id': 'NMC-SEC-003',
            'department': 1,
            'ward': 1,
            'role': 'admin',
            'is_staff': True,
            'is_superuser': True,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        created_user = User.objects.get(mobile='9810077777')
        self.assertEqual(created_user.role, User.Role.WORKER)
        self.assertFalse(created_user.is_staff)
        self.assertFalse(created_user.is_superuser)

    # 17. Officer cannot bypass department restriction using any alternate field names or manipulated values
    def test_officer_cannot_bypass_dept_restriction_with_aliases(self):
        self.client.force_authenticate(user=self.officer_pwd)  # PWD Officer (dept 1)

        bypass_payloads = [
            {'dept': 2},
            {'dept_id': 2},
            {'department_id': 2},
            {'dept': 'SWM'},
            {'department': 'Solid Waste Management'},
            {'department': 1, 'dept': 2},
            {'dept_id': '2'},
            {'department_id': '2'},
        ]

        for i, bypass in enumerate(bypass_payloads):
            payload = {
                'name': f'Bypass Worker {i}',
                'mobile': f'981006660{i}',
                'employee_id': f'NMC-BYP-00{i}',
                'ward': 1,
                **bypass
            }
            res = self.client.post(self.list_create_url, payload, format='json')
            self.assertEqual(
                res.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Failed to block bypass payload {bypass}"
            )
            self.assertFalse(User.objects.filter(mobile=payload['mobile']).exists())

    # 18. Officer GET cannot access other departments via any supported filter alias
    def test_officer_get_cannot_access_other_departments_via_aliases(self):
        self.client.force_authenticate(user=self.officer_pwd)  # PWD Officer (dept 1)

        # Create worker in SWM (dept 2)
        User.objects.create_user(
            mobile='9810020099',
            full_name='Hidden SWM Worker',
            employee_id='NMC-SWM-991',
            role=User.Role.WORKER,
            department=self.dept2,
            ward=self.ward2,
            password='Worker@123'
        )

        filter_queries = [
            {'department': 2},
            {'dept': 2},
            {'dept_id': 2},
            {'department_id': 2},
            {'dept': 'SWM'},
            {'search': 'Hidden', 'department': 2, 'ward': 2, 'status': 'active'},
        ]

        for query in filter_queries:
            res = self.client.get(self.list_create_url, query)
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertTrue(
                all(w['department_id'] == self.dept1.id for w in res.data),
                f"Officer leaked other department records with query {query}"
            )
            self.assertFalse(any(w['employee_id'] == 'NMC-SWM-991' for w in res.data))

    # 19. is_staff=True alone does not authorize citizen or worker
    def test_is_staff_alone_does_not_authorize_citizen_or_worker(self):
        # Staff citizen
        staff_citizen = User.objects.create_user(
            mobile='9800000088',
            full_name='Staff Citizen',
            role=User.Role.CITIZEN,
            is_staff=True,
            password='Citizen@123'
        )
        self.client.force_authenticate(user=staff_citizen)
        res_cit_get = self.client.get(self.list_create_url)
        self.assertEqual(res_cit_get.status_code, status.HTTP_403_FORBIDDEN)
        res_cit_post = self.client.post(self.list_create_url, {
            'name': 'Staff Citizen Worker',
            'mobile': '9810099988',
            'employee_id': 'NMC-STAFF-01',
            'department': 1,
            'ward': 1
        }, format='json')
        self.assertEqual(res_cit_post.status_code, status.HTTP_403_FORBIDDEN)

        # Staff worker
        staff_worker = User.objects.create_user(
            mobile='9800000089',
            full_name='Staff Field Worker',
            role=User.Role.WORKER,
            is_staff=True,
            department=self.dept1,
            ward=self.ward1,
            password='Worker@123'
        )
        self.client.force_authenticate(user=staff_worker)
        res_wkr_get = self.client.get(self.list_create_url)
        self.assertEqual(res_wkr_get.status_code, status.HTTP_403_FORBIDDEN)
        res_wkr_post = self.client.post(self.list_create_url, {
            'name': 'Staff Worker New Worker',
            'mobile': '9810099989',
            'employee_id': 'NMC-STAFF-02',
            'department': 1,
            'ward': 1
        }, format='json')
        self.assertEqual(res_wkr_post.status_code, status.HTTP_403_FORBIDDEN)

    # 20. Existing worker with pre-existing password can still log in
    def test_existing_worker_with_password_can_still_login(self):
        # Verify self.worker1 password unchanged
        self.assertTrue(self.worker1.check_password('Worker@123'))
        login_res = self.client.post('/api/v1/auth/login/', {
            'mobile': self.worker1.mobile,
            'password': 'Worker@123'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_res.data)

    # 21. AdminWorkerDetailUpdateView: update editable fields (designation, ward, status)
    def test_update_editable_fields_designation_ward_status(self):
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        # Update designation and ward
        payload = {
            'designation': 'Senior Sanitation Engineer',
            'ward': 2,
            'status': 'On Leave'
        }
        res = self.client.patch(detail_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['designation'], 'Senior Sanitation Engineer')
        self.assertEqual(res.data['ward_id'], 2)
        self.assertEqual(res.data['status'], 'on_leave')

        self.worker1.refresh_from_db()
        self.assertEqual(self.worker1.designation, 'Senior Sanitation Engineer')
        self.assertEqual(self.worker1.ward, self.ward2)
        self.assertEqual(self.worker1.status, User.Status.ON_LEAVE)

    # 22. Status formatting & case-insensitivity: Active, Inactive, On Leave
    def test_status_formatting_and_case_insensitivity(self):
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        # Inactive
        res_inactive = self.client.patch(detail_url, {'status': 'Inactive'}, format='json')
        self.assertEqual(res_inactive.status_code, status.HTTP_200_OK)
        self.worker1.refresh_from_db()
        self.assertEqual(self.worker1.status, User.Status.INACTIVE)

        # Active
        res_active = self.client.patch(detail_url, {'status': 'ACTIVE'}, format='json')
        self.assertEqual(res_active.status_code, status.HTTP_200_OK)
        self.worker1.refresh_from_db()
        self.assertEqual(self.worker1.status, User.Status.ACTIVE)

        # On Leave (hyphen or space)
        res_leave = self.client.patch(detail_url, {'status': 'on-leave'}, format='json')
        self.assertEqual(res_leave.status_code, status.HTTP_200_OK)
        self.worker1.refresh_from_db()
        self.assertEqual(self.worker1.status, User.Status.ON_LEAVE)

    # 23. Invalid status returns 400 Bad Request
    def test_update_invalid_status_fails(self):
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        res = self.client.patch(detail_url, {'status': 'Terminated'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', res.data)

    # 24. Invalid ward returns 400 Bad Request
    def test_update_invalid_ward_fails(self):
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        res = self.client.patch(detail_url, {'ward': 999}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ward', res.data)

    # 25. Department Officer can update designation, ward, status for own department worker
    def test_dept_officer_can_update_own_worker_editable_fields(self):
        self.client.force_authenticate(user=self.officer_pwd)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        payload = {
            'designation': 'Lead PWD Inspector',
            'ward': 2,
            'status': 'Active'
        }
        res = self.client.patch(detail_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.worker1.refresh_from_db()
        self.assertEqual(self.worker1.designation, 'Lead PWD Inspector')
        self.assertEqual(self.worker1.ward, self.ward2)
        self.assertEqual(self.worker1.status, User.Status.ACTIVE)
        # Department remains unchanged
        self.assertEqual(self.worker1.department, self.dept1)

    # 26. Department Officer blocked from updating department using aliases
    def test_dept_officer_blocked_from_updating_department_aliases(self):
        self.client.force_authenticate(user=self.officer_pwd)
        detail_url = reverse('admin_worker_detail', kwargs={'id': self.worker1.id})

        for alias in [{'dept': 2}, {'dept_id': 2}, {'department_id': 2}]:
            res = self.client.patch(detail_url, alias, format='json')
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
            self.worker1.refresh_from_db()
            self.assertEqual(self.worker1.department, self.dept1)



