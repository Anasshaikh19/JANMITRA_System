"""
Automated test suite for Admin Complaints Ledger API (JANMITRA - Nagpur Municipal Corporation).
Endpoint: GET /api/v1/admin/complaints/

Verified Test Coverage:
1. Permissions:
   - Unauthenticated requests rejected with HTTP 401 Unauthorized.
   - Citizens and Field Workers rejected with HTTP 403 Forbidden.
   - Department Officers rejected with HTTP 403 Forbidden (IsAdmin strictly enforced).
   - Administrators granted HTTP 200 OK across all municipal complaints.
2. Date Filtering & Validation:
   - HTTP 400 for invalid date_from format.
   - HTTP 400 for invalid date_to format.
   - HTTP 400 for reversed date range (date_from > date_to).
   - date_to is strictly inclusive of the entire day (up to 23:59:59).
3. Status Counts & Business Rules:
   - 'resolved' strictly counts RESOLVED status.
   - 'Closed' and 'Work Done' complaints are NOT conflated into the resolved count.
   - Distinct counts for total, open, in_progress, resolved, closed, and work_done.
4. Full Serialization:
   - Citizen name, citizen mobile, mobile alias.
   - Assigned worker ID, name, mobile, designation, and details dictionary.
   - Resolution time in hours and formatted string for resolved complaints.
5. Search & Filters:
   - Department, Ward, Status, Priority, and multi-field keyword Search.
6. URL Reversibility:
   - Single canonical route 'admin_complaints_ledger' -> '/api/v1/admin/complaints/'.
"""

from datetime import datetime, timedelta
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from complaints.models import Category, Complaint, Department, Ward

User = get_user_model()


class AdminComplaintsLedgerAPITests(APITestCase):
    """
    Test suite for AdminComplaintsLedgerView at /api/v1/admin/complaints/.
    """

    @classmethod
    def setUpTestData(cls):
        # Departments (seeded by migration 0011)
        cls.dept_pwd = Department.objects.get(short_name='PWD')
        cls.dept_swm = Department.objects.get(short_name='SWM')
        cls.dept_elec = Department.objects.get(short_name='ELEC')

        # Wards (seeded by migration 0011)
        cls.ward_1 = Ward.objects.get(id=1)
        cls.ward_2 = Ward.objects.get(id=2)

        # Categories (seeded by migration 0011)
        cls.cat_pothole = Category.objects.filter(department=cls.dept_pwd).first()
        cls.cat_garbage = Category.objects.filter(department=cls.dept_swm).first()
        cls.cat_lights = Category.objects.filter(department=cls.dept_elec).first()

        # Users
        cls.admin_user = User.objects.create_user(
            mobile='9800000001',
            full_name='Central Admin',
            role=User.Role.ADMIN,
            is_staff=True,
            password='AdminPassword123'
        )
        cls.pwd_officer = User.objects.create_user(
            mobile='9800000002',
            full_name='PWD Officer Deshmukh',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept_pwd,
            password='OfficerPassword123'
        )
        cls.worker_user = User.objects.create_user(
            mobile='9810010001',
            full_name='Ramesh PWD Worker',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            designation='Road Repair Tech',
            employee_id='EMP-PWD-001',
            password='WorkerPassword123'
        )
        cls.citizen_user = User.objects.create_user(
            mobile='9820000001',
            full_name='Aarav Citizen',
            role=User.Role.CITIZEN,
            ward=cls.ward_1,
            password='CitizenPassword123'
        )

        now = timezone.now()

        # Seed Complaints covering distinct lifecycle states:
        # 1. PWD, Ward 1, SUBMITTED (Open), LOW
        cls.c1 = Complaint.objects.create(
            title='Pothole on Central Avenue',
            description='Large pothole causing vehicle congestion near Ward 1 square',
            category=cls.cat_pothole,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            citizen=cls.citizen_user,
            status=Complaint.Status.SUBMITTED,
            priority_level=Complaint.Priority.LOW,
            address='Central Avenue, Near Metro Station',
            landmark='Opposite Metro Pillar 42',
            location=Point(79.0882, 21.1458),
            submitted_at=now - timedelta(days=6)
        )
        Complaint.objects.filter(id=cls.c1.id).update(submitted_at=now - timedelta(days=6))

        # 2. PWD, Ward 1, IN_PROGRESS (In Progress), HIGH, assigned to worker
        cls.c2 = Complaint.objects.create(
            title='Cracked road surface',
            description='Road surface deterioration on Ward 1 bridge',
            category=cls.cat_pothole,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            citizen=cls.citizen_user,
            assigned_worker=cls.worker_user,
            status=Complaint.Status.IN_PROGRESS,
            priority_level=Complaint.Priority.HIGH,
            address='Ward 1 Bridge Approach',
            location=Point(79.0890, 21.1460),
            submitted_at=now - timedelta(days=4)
        )
        Complaint.objects.filter(id=cls.c2.id).update(submitted_at=now - timedelta(days=4))

        # 3. PWD, Ward 2, RESOLVED (Resolved), CRITICAL (24h resolution time)
        c3_sub = now - timedelta(days=3)
        c3_res = now - timedelta(days=2)
        cls.c3 = Complaint.objects.create(
            title='Sinkhole emergency',
            description='Dangerous sinkhole near busy intersection in Ward 2',
            category=cls.cat_pothole,
            department=cls.dept_pwd,
            ward=cls.ward_2,
            citizen=cls.citizen_user,
            assigned_worker=cls.worker_user,
            status=Complaint.Status.RESOLVED,
            priority_level=Complaint.Priority.CRITICAL,
            address='Ward 2 Ring Road',
            location=Point(79.0950, 21.1500),
            submitted_at=c3_sub,
            resolved_at=c3_res
        )
        Complaint.objects.filter(id=cls.c3.id).update(submitted_at=c3_sub, resolved_at=c3_res)

        # 4. SWM, Ward 2, SUBMITTED (Open), MEDIUM
        cls.c4 = Complaint.objects.create(
            title='Overflowing community bin',
            description='Garbage overflow on residential corner',
            category=cls.cat_garbage,
            department=cls.dept_swm,
            ward=cls.ward_2,
            citizen=cls.citizen_user,
            status=Complaint.Status.SUBMITTED,
            priority_level=Complaint.Priority.MEDIUM,
            address='Ward 2 Market Street',
            location=Point(79.0910, 21.1520),
            submitted_at=now - timedelta(days=2)
        )
        Complaint.objects.filter(id=cls.c4.id).update(submitted_at=now - timedelta(days=2))

        # 5. ELEC, Ward 1, CLOSED (Closed terminal state, verified by citizen)
        c5_sub = now - timedelta(days=5)
        c5_res = now - timedelta(days=3)
        cls.c5 = Complaint.objects.create(
            title='Flickering streetlight',
            description='Street lamp blinking constantly at night',
            category=cls.cat_lights,
            department=cls.dept_elec,
            ward=cls.ward_1,
            citizen=cls.citizen_user,
            status=Complaint.Status.CLOSED,
            priority_level=Complaint.Priority.LOW,
            address='Ward 1 Lane 4',
            location=Point(79.0870, 21.1440),
            submitted_at=c5_sub,
            resolved_at=c5_res,
            closed_at=c5_res
        )
        Complaint.objects.filter(id=cls.c5.id).update(submitted_at=c5_sub, resolved_at=c5_res, closed_at=c5_res)

        # 6. PWD, Ward 1, WORK_DONE (Work Done by worker, pending citizen verification)
        c6_sub = now - timedelta(days=1)
        cls.c6 = Complaint.objects.create(
            title='Waterlogged underpass repair',
            description='Drain cleared and pump deployed, pending citizen confirmation',
            category=cls.cat_pothole,
            department=cls.dept_pwd,
            ward=cls.ward_1,
            citizen=cls.citizen_user,
            assigned_worker=cls.worker_user,
            status=Complaint.Status.WORK_DONE,
            priority_level=Complaint.Priority.HIGH,
            address='Ward 1 Railway Underpass',
            location=Point(79.0885, 21.1465),
            submitted_at=c6_sub
        )
        Complaint.objects.filter(id=cls.c6.id).update(submitted_at=c6_sub)

        # Refresh instances so their in-memory fields match database timestamps
        cls.c1.refresh_from_db()
        cls.c2.refresh_from_db()
        cls.c3.refresh_from_db()
        cls.c4.refresh_from_db()
        cls.c5.refresh_from_db()
        cls.c6.refresh_from_db()

        cls.endpoint = '/api/v1/admin/complaints/'

    def _auth(self, user):
        token = str(RefreshToken.for_user(user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    # -------------------------------------------------------------------------
    # 1. RBAC Permissions (IsAdmin only)
    # -------------------------------------------------------------------------
    def test_unauthenticated_request_rejected(self):
        """Unauthenticated GET must be rejected with HTTP 401 Unauthorized."""
        self.client.credentials()
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_citizen_and_worker_forbidden(self):
        """Citizens and field workers must be rejected with HTTP 403 Forbidden."""
        self._auth(self.citizen_user)
        res_citizen = self.client.get(self.endpoint)
        self.assertEqual(res_citizen.status_code, status.HTTP_403_FORBIDDEN)

        self._auth(self.worker_user)
        res_worker = self.client.get(self.endpoint)
        self.assertEqual(res_worker.status_code, status.HTTP_403_FORBIDDEN)

    def test_department_officer_strictly_forbidden(self):
        """Department Officers must be rejected with HTTP 403 Forbidden (IsAdmin only)."""
        self._auth(self.pwd_officer)
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_authorized(self):
        """Administrators are granted access with HTTP 200 OK."""
        self._auth(self.admin_user)
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------------------
    # 2. Date Validation & Range Filtering (HTTP 400 & Inclusivity)
    # -------------------------------------------------------------------------
    def test_invalid_date_from_returns_400(self):
        """Invalid date_from format returns HTTP 400 Bad Request."""
        self._auth(self.admin_user)
        response = self.client.get(f"{self.endpoint}?date_from=invalid-date")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_invalid_date_to_returns_400(self):
        """Invalid date_to format returns HTTP 400 Bad Request."""
        self._auth(self.admin_user)
        response = self.client.get(f"{self.endpoint}?date_to=not-a-valid-date")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_reversed_date_range_returns_400(self):
        """date_from strictly after date_to returns HTTP 400 Bad Request."""
        self._auth(self.admin_user)
        response = self.client.get(f"{self.endpoint}?date_from=2026-10-25&date_to=2026-10-15")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('date_from', response.data['error'])

    def test_inclusive_date_to_coverage(self):
        """date_to covers complaints submitted until the end of that day (23:59:59.999999)."""
        self._auth(self.admin_user)
        today_date = timezone.localdate()
        c_today = Complaint.objects.create(
            title='Burst water pipe',
            description='Active pipe leak on main road',
            category=self.cat_pothole,
            department=self.dept_pwd,
            ward=self.ward_1,
            citizen=self.citizen_user,
            status=Complaint.Status.SUBMITTED,
            priority_level=Complaint.Priority.CRITICAL,
        )
        date_str = today_date.strftime('%Y-%m-%d')
        response = self.client.get(f"{self.endpoint}?date_to={date_str}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item['id'] for item in response.data['results']]
        self.assertIn(str(c_today.id), returned_ids)

    # -------------------------------------------------------------------------
    # 3. Status Choices and Business Rule Accuracy
    # -------------------------------------------------------------------------
    def test_admin_counts_summary_exact_categories(self):
        """
        Verifies exact counts:
        - total: 6
        - open: 2 (c1: SUBMITTED, c4: SUBMITTED)
        - in_progress: 1 (c2: IN_PROGRESS)
        - resolved: 1 (c3: RESOLVED strictly)
        - closed: 1 (c5: CLOSED)
        - work_done: 1 (c6: WORK_DONE)
        """
        self._auth(self.admin_user)
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        summary = data['summary']

        self.assertEqual(summary['total'], 6)
        self.assertEqual(summary['open'], 2)
        self.assertEqual(summary['in_progress'], 1)
        self.assertEqual(summary['resolved'], 1)
        self.assertEqual(summary['closed'], 1)
        self.assertEqual(summary['work_done'], 1)

    def test_closed_and_work_done_not_counted_as_resolved(self):
        """
        Explicit business rule verification:
        'Closed' and 'Work Done' must NOT be conflated into the 'resolved' summary count.
        """
        self._auth(self.admin_user)

        # Filter strictly for Closed complaint
        res_closed = self.client.get(f"{self.endpoint}?status=Closed")
        self.assertEqual(res_closed.status_code, status.HTTP_200_OK)
        self.assertEqual(res_closed.data['summary']['total'], 1)
        self.assertEqual(res_closed.data['summary']['closed'], 1)
        self.assertEqual(res_closed.data['summary']['resolved'], 0)  # Must be 0!

        # Filter strictly for Work Done complaint
        res_work_done = self.client.get(f"{self.endpoint}?status=Work Done")
        self.assertEqual(res_work_done.status_code, status.HTTP_200_OK)
        self.assertEqual(res_work_done.data['summary']['total'], 1)
        self.assertEqual(res_work_done.data['summary']['work_done'], 1)
        self.assertEqual(res_work_done.data['summary']['resolved'], 0)  # Must be 0!

    # -------------------------------------------------------------------------
    # 4. Full Serialization & Resolution Time
    # -------------------------------------------------------------------------
    def test_full_serialization_fields(self):
        """Full serialization includes citizen name, mobile, assigned worker, and resolution time."""
        self._auth(self.admin_user)
        response = self.client.get(f"{self.endpoint}?search=Cracked road surface")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        self.assertEqual(len(results), 1)
        item = results[0]

        # Citizen details
        self.assertEqual(item['citizen_name'], 'Aarav Citizen')
        self.assertEqual(item['citizen_mobile'], '9820000001')
        self.assertEqual(item['mobile'], '9820000001')

        # Worker details
        self.assertEqual(item['assigned_worker_id'], self.worker_user.id)
        self.assertEqual(item['assigned_worker_name'], 'Ramesh PWD Worker')
        self.assertEqual(item['assigned_worker_mobile'], '9810010001')
        self.assertEqual(item['assigned_worker_designation'], 'Road Repair Tech')
        self.assertIsNotNone(item['assigned_worker_details'])
        self.assertEqual(item['assigned_worker_details']['employee_id'], 'EMP-PWD-001')

        # Department & Ward details
        self.assertEqual(item['ward_id'], self.ward_1.id)
        self.assertEqual(item['ward_name'], 'Ward 1')
        self.assertEqual(item['department_short_name'], 'PWD')

        # Unresolved complaint resolution_time is None
        self.assertIsNone(item['resolution_time'])

    def test_resolution_time_calculation_on_resolved_complaint(self):
        """Resolved complaint correctly calculates resolution_time in hours."""
        self._auth(self.admin_user)
        response = self.client.get(f"{self.endpoint}?search=Sinkhole emergency")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        self.assertEqual(len(results), 1)
        item = results[0]

        # c3 had submitted_at 3 days ago, resolved_at 2 days ago -> 24.0 hours
        self.assertIsNotNone(item['resolution_time'])
        self.assertAlmostEqual(item['resolution_time'], 24.0, places=1)
        self.assertAlmostEqual(item['resolution_time_hours'], 24.0, places=1)
        self.assertIn('24', item['resolution_time_display'])

    # -------------------------------------------------------------------------
    # 5. Filters
    # -------------------------------------------------------------------------
    def test_filter_by_department(self):
        """Admin filtering by department ID and department short code."""
        self._auth(self.admin_user)

        res_id = self.client.get(f"{self.endpoint}?department={self.dept_swm.id}")
        self.assertEqual(res_id.status_code, status.HTTP_200_OK)
        self.assertEqual(res_id.data['summary']['total'], 1)
        self.assertEqual(res_id.data['results'][0]['department_short_name'], 'SWM')

        res_code = self.client.get(f"{self.endpoint}?department=ELEC")
        self.assertEqual(res_code.status_code, status.HTTP_200_OK)
        self.assertEqual(res_code.data['summary']['total'], 1)
        self.assertEqual(res_code.data['results'][0]['department_short_name'], 'ELEC')

    def test_filter_by_ward(self):
        """Filtering by ward ID or ward name."""
        self._auth(self.admin_user)

        res_ward1 = self.client.get(f"{self.endpoint}?ward=1")
        self.assertEqual(res_ward1.status_code, status.HTTP_200_OK)
        # Ward 1 has: c1 (PWD), c2 (PWD), c5 (ELEC), c6 (PWD) -> 4
        self.assertEqual(res_ward1.data['summary']['total'], 4)

        res_ward2 = self.client.get(f"{self.endpoint}?ward=Ward 2")
        self.assertEqual(res_ward2.status_code, status.HTTP_200_OK)
        # Ward 2 has: c3 (PWD), c4 (SWM) -> 2
        self.assertEqual(res_ward2.data['summary']['total'], 2)

    def test_filter_by_priority(self):
        """Filtering by priority level."""
        self._auth(self.admin_user)

        res_crit = self.client.get(f"{self.endpoint}?priority=CRITICAL")
        self.assertEqual(res_crit.status_code, status.HTTP_200_OK)
        self.assertEqual(res_crit.data['summary']['total'], 1)
        self.assertEqual(res_crit.data['results'][0]['priority_level'], 'CRITICAL')

    def test_filter_by_search_query(self):
        """Searching across tracking ID, title, citizen mobile, and worker name."""
        self._auth(self.admin_user)

        res_pothole = self.client.get(f"{self.endpoint}?search=Pothole")
        self.assertEqual(res_pothole.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_pothole.data['results']), 1)

        res_mobile = self.client.get(f"{self.endpoint}?search=9820000001")
        self.assertEqual(res_mobile.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_mobile.data['results']), 6)

        res_worker = self.client.get(f"{self.endpoint}?search=Ramesh")
        self.assertEqual(res_worker.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_worker.data['results']), 3)

    # -------------------------------------------------------------------------
    # 6. URL Canonical Routing
    # -------------------------------------------------------------------------
    def test_url_reversal(self):
        """Verifies canonical root URL reversal for 'admin_complaints_ledger'."""
        url_root = reverse('admin_complaints_ledger')
        self.assertEqual(url_root, '/api/v1/admin/complaints/')
