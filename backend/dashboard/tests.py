"""
Automated test suite for dashboard app (JANMITRA - Nagpur Municipal Corporation).
"""

from datetime import timedelta
from unittest.mock import patch
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from complaints.models import Category, Complaint, ComplaintImage, Department, StatusHistory, Ward
from dashboard.models import SystemSettings


class DashboardAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Departments
        cls.dept1, _ = Department.objects.update_or_create(id=1, defaults={'name': 'Roads & Buildings', 'short_name': 'PWD'})
        cls.dept2, _ = Department.objects.update_or_create(id=2, defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'})

        # 2. Wards
        cls.ward1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        cls.ward2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})
        cls.ward3, _ = Ward.objects.update_or_create(id=3, defaults={'name': 'Ward 3'})
        cls.ward4, _ = Ward.objects.update_or_create(id=4, defaults={'name': 'Ward 4'})

        # 3. Categories
        cls.cat1, _ = Category.objects.update_or_create(id=1, defaults={'name': 'Roads & Infrastructure', 'department': cls.dept1})
        cls.cat2, _ = Category.objects.update_or_create(id=2, defaults={'name': 'Garbage & Waste', 'department': cls.dept2})

        # 4. Users
        cls.admin = User.objects.create_user(
            mobile='9800000000',
            full_name='Central Admin',
            email='admin@janmitra.gov.in',
            role=User.Role.ADMIN,
            is_staff=True
        )
        cls.officer_pwd = User.objects.create_user(
            mobile='9800000001',
            full_name='PWD Officer',
            email='pwd.officer@janmitra.gov.in',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept1,
            ward=cls.ward1
        )
        cls.officer_swm = User.objects.create_user(
            mobile='9800000002',
            full_name='SWM Officer',
            email='swm.officer@janmitra.gov.in',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept2,
            ward=cls.ward2
        )
        cls.worker_pwd = User.objects.create_user(
            mobile='9810010001',
            full_name='PWD Worker 1',
            role=User.Role.WORKER,
            department=cls.dept1,
            ward=cls.ward1,
            designation='Road Maintenance'
        )
        cls.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Citizen Tester',
            email='citizen@test.com',
            role=User.Role.CITIZEN,
            ward=cls.ward1
        )

        now = timezone.now()
        # Seed test complaints
        # c1: PWD, ward 1, HIGH priority, SUBMITTED
        cls.c1 = Complaint.objects.create(
            citizen=cls.citizen,
            category=cls.cat1,
            ward=cls.ward1,
            description='Severe pothole on main road needing urgent asphalt repair.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.SUBMITTED,
            priority_level=Complaint.Priority.HIGH,
            submitted_at=now - timedelta(days=5)
        )
        # Update submitted_at explicitly because auto_now_add overrides on create
        Complaint.objects.filter(id=cls.c1.id).update(submitted_at=now - timedelta(days=5))

        # c2: PWD, ward 1, CRITICAL priority, ASSIGNED to worker_pwd
        cls.c2 = Complaint.objects.create(
            citizen=cls.citizen,
            category=cls.cat1,
            ward=cls.ward1,
            description='Bridge structural damage observed after heavy rainfall.',
            location=Point(79.08, 21.14, srid=4326),
            status=Complaint.Status.ASSIGNED,
            priority_level=Complaint.Priority.CRITICAL,
            assigned_worker=cls.worker_pwd
        )
        Complaint.objects.filter(id=cls.c2.id).update(submitted_at=now - timedelta(days=2))

        # c3: PWD, ward 2, LOW priority, RESOLVED
        cls.c3 = Complaint.objects.create(
            citizen=cls.citizen,
            category=cls.cat1,
            ward=cls.ward2,
            description='Minor footpath curb broken near park entrance.',
            location=Point(79.09, 21.15, srid=4326),
            status=Complaint.Status.RESOLVED,
            priority_level=Complaint.Priority.LOW,
            resolved_at=now - timedelta(days=1),
            assigned_worker=cls.worker_pwd
        )
        Complaint.objects.filter(id=cls.c3.id).update(submitted_at=now - timedelta(days=3))

        # c4: SWM, ward 2, Pending Validation with AI confidence & image
        cls.c4 = Complaint.objects.create(
            citizen=cls.citizen,
            category=cls.cat2,
            ward=cls.ward2,
            description='Garbage dump accumulated behind commercial market.',
            location=Point(79.09, 21.15, srid=4326),
            status='Pending Validation',
            priority_level=Complaint.Priority.MEDIUM,
            ai_confidence=0.88
        )
        dummy_img = SimpleUploadedFile('test.jpg', b'\xff\xd8\xff\xe0test_content', content_type='image/jpeg')
        ComplaintImage.objects.create(complaint=cls.c4, image=dummy_img)

    # 1. DeptKPIView tests
    def test_dept_kpi_view_admin_and_officer(self):
        # Dept Officer sees only PWD complaints (c1, c2, c3)
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer = self.client.get(reverse('dashboard:kpi'))
        self.assertEqual(res_officer.status_code, status.HTTP_200_OK)
        self.assertEqual(res_officer.data['total'], 3)
        self.assertEqual(res_officer.data['pending'], 1)  # c1 is SUBMITTED
        self.assertEqual(res_officer.data['in_progress'], 1)  # c2 is ASSIGNED
        self.assertEqual(res_officer.data['resolved'], 1)  # c3 is RESOLVED
        self.assertGreater(res_officer.data['avg_resolution_days'], 0.0)
        self.assertEqual(len(res_officer.data['severity_distribution']), 4)

        # Admin sees all complaints (c1, c2, c3, c4 = 4)
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get(reverse('dashboard:kpi'))
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.data['total'], 4)

        # Admin filters by dept_id=2 (SWM) -> only c4
        res_dept2 = self.client.get(f"{reverse('dashboard:kpi')}?dept_id=2")
        self.assertEqual(res_dept2.status_code, status.HTTP_200_OK)
        self.assertEqual(res_dept2.data['total'], 1)
        self.assertEqual(res_dept2.data['pending'], 1)  # c4 is 'Pending Validation'

    # 2. DeptKPIView filter params
    def test_dept_kpi_filter_params(self):
        self.client.force_authenticate(user=self.admin)

        # Filter by ward_id=1 -> c1 and c2
        res_ward = self.client.get(f"{reverse('dashboard:kpi')}?ward_id=1")
        self.assertEqual(res_ward.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ward.data['total'], 2)

        # Filter by severity=CRITICAL -> only c2
        res_sev = self.client.get(f"{reverse('dashboard:kpi')}?severity=CRITICAL")
        self.assertEqual(res_sev.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sev.data['total'], 1)

    # 3. WardStatsView tests
    def test_ward_stats_view(self):
        self.client.force_authenticate(user=self.officer_pwd)
        res = self.client.get(reverse('dashboard:ward_stats'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 4)  # All 4 wards represented

        ward1_stat = next(w for w in res.data if w['ward_id'] == 1)
        self.assertEqual(ward1_stat['total'], 2)
        self.assertEqual(ward1_stat['pending'], 1)
        self.assertEqual(ward1_stat['in_progress'], 1)

    # 4. TrendsView tests
    def test_trends_view(self):
        self.client.force_authenticate(user=self.admin)

        # Day groupby
        res_day = self.client.get(f"{reverse('dashboard:trends')}?groupby=day")
        self.assertEqual(res_day.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res_day.data, list)
        self.assertTrue(any(t['submitted'] > 0 for t in res_day.data))

        # Week groupby
        res_week = self.client.get(f"{reverse('dashboard:trends')}?groupby=week")
        self.assertEqual(res_week.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res_week.data, list)

        # Month groupby
        res_month = self.client.get(f"{reverse('dashboard:trends')}?groupby=month")
        self.assertEqual(res_month.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res_month.data, list)

    # 5. WorkerWorkloadView tests
    def test_worker_workload_view(self):
        self.client.force_authenticate(user=self.officer_pwd)
        res = self.client.get(reverse('dashboard:workers'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 1)

        worker_data = res.data[0]
        self.assertEqual(worker_data['worker_id'], self.worker_pwd.id)
        self.assertEqual(worker_data['name'], self.worker_pwd.full_name)
        self.assertEqual(worker_data['active_tasks'], 1)  # c2 assigned
        self.assertEqual(worker_data['completed_week'], 1)  # c3 resolved within 7 days
        self.assertGreater(worker_data['avg_resolution_days'], 0.0)

    # 6. HighPriorityView tests
    def test_high_priority_view(self):
        self.client.force_authenticate(user=self.officer_pwd)
        res = self.client.get(reverse('dashboard:high_priority'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        # Should include c1 (HIGH) and c2 (CRITICAL); c3 is LOW so excluded
        self.assertEqual(len(res.data), 2)
        # Ordered by days_open descending (oldest submitted first -> c1 was submitted 5 days ago, c2 was 2 days ago)
        self.assertEqual(res.data[0]['id'], str(self.c1.id))
        self.assertEqual(res.data[1]['id'], str(self.c2.id))
        self.assertGreater(res.data[0]['days_open'], res.data[1]['days_open'])

    # 7. PendingValidationView tests
    def test_pending_validation_view(self):
        # PWD officer has no pending validation complaints
        self.client.force_authenticate(user=self.officer_pwd)
        res_pwd = self.client.get(reverse('dashboard:pending_validation'))
        self.assertEqual(res_pwd.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_pwd.data), 0)

        # SWM officer sees c4
        self.client.force_authenticate(user=self.officer_swm)
        res_swm = self.client.get(reverse('dashboard:pending_validation'))
        self.assertEqual(res_swm.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_swm.data), 1)
        self.assertEqual(res_swm.data[0]['id'], str(self.c4.id))
        self.assertEqual(res_swm.data[0]['ai_confidence'], 0.88)
        self.assertIsNotNone(res_swm.data[0]['first_image_thumbnail_url'])

    # 8. ManualValidateView: validate action with route_complaint dispatch
    @patch('dashboard.views.route_complaint.delay')
    def test_manual_validate_view_validate_action(self, mock_route):
        self.client.force_authenticate(user=self.officer_swm)
        url = reverse('dashboard:complaint_validate', kwargs={'id': str(self.c4.id)})

        res = self.client.patch(url, {'action': 'validate'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'Validated')

        self.c4.refresh_from_db()
        self.assertEqual(self.c4.status, 'Validated')

        # Verify Celery route_complaint task dispatched
        mock_route.assert_called_once_with(str(self.c4.id))

        # Verify StatusHistory created
        history = self.c4.status_history.latest('changed_at')
        self.assertEqual(history.new_status, 'Validated')
        self.assertEqual(history.changed_by, self.officer_swm)

    # 9. ManualValidateView: reject action requires reason
    def test_manual_validate_view_reject_action(self):
        self.client.force_authenticate(user=self.officer_swm)
        url = reverse('dashboard:complaint_validate', kwargs={'id': str(self.c4.id)})

        # Missing reason -> 400 Bad Request
        res_no_reason = self.client.patch(url, {'action': 'reject'}, format='json')
        self.assertEqual(res_no_reason.status_code, status.HTTP_400_BAD_REQUEST)

        # With reason -> 200 OK, status='Invalid'
        res_reject = self.client.patch(
            url,
            {'action': 'reject', 'reason': 'Image appears to be from a movie scene, spam detected.'},
            format='json'
        )
        self.assertEqual(res_reject.status_code, status.HTTP_200_OK)
        self.assertEqual(res_reject.data['status'], 'Invalid')

        self.c4.refresh_from_db()
        self.assertEqual(self.c4.status, 'Invalid')

        # Verify StatusHistory created with reason
        history = self.c4.status_history.latest('changed_at')
        self.assertEqual(history.new_status, 'Invalid')
        self.assertIn('spam detected', history.note)

    # 10. ManualValidateView: cross-department and citizen authorization restrictions
    def test_manual_validate_view_authorization(self):
        url = reverse('dashboard:complaint_validate', kwargs={'id': str(self.c4.id)})

        # PWD officer cannot validate SWM complaint
        self.client.force_authenticate(user=self.officer_pwd)
        res_cross = self.client.patch(url, {'action': 'validate'}, format='json')
        self.assertEqual(res_cross.status_code, status.HTTP_403_FORBIDDEN)

        # Citizen cannot validate
        self.client.force_authenticate(user=self.citizen)
        res_citizen = self.client.patch(url, {'action': 'validate'}, format='json')
        self.assertEqual(res_citizen.status_code, status.HTTP_403_FORBIDDEN)

    # 11. OverdueComplaintsView: GET /api/v1/dashboard/overdue/
    def test_overdue_complaints_view(self):
        # PWD officer sees c1 (HIGH, 5d ago) and c2 (CRITICAL, 2d ago)
        self.client.force_authenticate(user=self.officer_pwd)
        res = self.client.get(reverse('dashboard:overdue'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 2)
        returned_ids = [item['id'] for item in res.data]
        self.assertIn(str(self.c1.id), returned_ids)
        self.assertIn(str(self.c2.id), returned_ids)

        # Check item attributes
        crit_item = next(item for item in res.data if item['id'] == str(self.c2.id))
        self.assertEqual(crit_item['priority_level'], 'CRITICAL')
        self.assertEqual(crit_item['sla_target_hours'], 24)
        self.assertTrue(crit_item['is_overdue'])
        self.assertGreater(crit_item['hours_overdue'], 20.0)

        # Admin filtering by ?dept_id
        self.client.force_authenticate(user=self.admin)
        res_admin_pwd = self.client.get(f"{reverse('dashboard:overdue')}?dept_id={self.dept1.id}")
        self.assertEqual(res_admin_pwd.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin_pwd.data), 2)

        res_admin_swm = self.client.get(f"{reverse('dashboard:overdue')}?dept_id={self.dept2.id}")
        self.assertEqual(res_admin_swm.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin_swm.data), 0)

        # Dept officer cross-department forbidden
        self.client.force_authenticate(user=self.officer_pwd)
        res_cross = self.client.get(f"{reverse('dashboard:overdue')}?dept_id={self.dept2.id}")
        self.assertEqual(res_cross.status_code, status.HTTP_403_FORBIDDEN)

        # Citizen forbidden
        self.client.force_authenticate(user=self.citizen)
        res_citizen = self.client.get(reverse('dashboard:overdue'))
        self.assertEqual(res_citizen.status_code, status.HTTP_403_FORBIDDEN)

    # 12. ComplaintsExportView: GET /api/v1/dashboard/export/?format=csv
    def test_complaints_export_csv_streaming_headers_and_columns(self):
        import csv
        import io

        self.client.force_authenticate(user=self.admin)
        export_url = reverse('dashboard:export')
        res = self.client.get(f"{export_url}?format=csv")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res['Content-Type'].startswith('text/csv'))
        self.assertIn('attachment; filename=', res['Content-Disposition'])

        # Decode streamed content
        content = b''.join(res.streaming_content).decode('utf-8')
        reader = list(csv.reader(io.StringIO(content)))

        # Header validation
        expected_headers = [
            'Complaint ID',
            'Category',
            'Ward',
            'Status',
            'Priority',
            'Citizen Mobile',
            'Assigned Worker',
            'Submitted At',
            'Resolved At',
            'Closed At',
            'Citizen Rating',
        ]
        self.assertEqual(reader[0], expected_headers)

        # Admin sees all 4 complaints
        data_rows = reader[1:]
        self.assertEqual(len(data_rows), 4)

        # Check c2 row specifically
        c2_tracking_id = self.c2.tracking_id
        c2_row = next((r for r in data_rows if r[0] == c2_tracking_id), None)
        self.assertIsNotNone(c2_row)
        self.assertEqual(c2_row[1], self.cat1.name)  # Category
        self.assertEqual(c2_row[2], self.ward1.name)  # Ward
        self.assertEqual(c2_row[3], Complaint.Status.ASSIGNED)  # Status
        self.assertEqual(c2_row[4], Complaint.Priority.CRITICAL)  # Priority
        self.assertEqual(c2_row[5], self.citizen.mobile)  # Citizen Mobile
        self.assertEqual(c2_row[6], self.worker_pwd.full_name)  # Assigned Worker

    # 13. ComplaintsExportView: Department Officer scoped strictly to own department
    def test_complaints_export_dept_officer_scoping(self):
        import csv
        import io

        # PWD Officer should only see PWD complaints (c1, c2, c3 = 3)
        self.client.force_authenticate(user=self.officer_pwd)
        export_url = reverse('dashboard:export')
        res_pwd = self.client.get(f"{export_url}?format=csv")
        self.assertEqual(res_pwd.status_code, status.HTTP_200_OK)

        content_pwd = b''.join(res_pwd.streaming_content).decode('utf-8')
        rows_pwd = list(csv.reader(io.StringIO(content_pwd)))[1:]
        self.assertEqual(len(rows_pwd), 3)
        tracking_ids_pwd = [r[0] for r in rows_pwd]
        self.assertIn(self.c1.tracking_id, tracking_ids_pwd)
        self.assertIn(self.c2.tracking_id, tracking_ids_pwd)
        self.assertIn(self.c3.tracking_id, tracking_ids_pwd)
        self.assertNotIn(self.c4.tracking_id, tracking_ids_pwd)

        # SWM Officer should only see SWM complaints (c4 = 1)
        self.client.force_authenticate(user=self.officer_swm)
        res_swm = self.client.get(f"{export_url}?format=csv")
        self.assertEqual(res_swm.status_code, status.HTTP_200_OK)

        content_swm = b''.join(res_swm.streaming_content).decode('utf-8')
        rows_swm = list(csv.reader(io.StringIO(content_swm)))[1:]
        self.assertEqual(len(rows_swm), 1)
        self.assertEqual(rows_swm[0][0], self.c4.tracking_id)

    # 14. ComplaintsExportView: start_date and end_date filtering
    def test_complaints_export_date_filtering(self):
        import csv
        import io

        self.client.force_authenticate(user=self.admin)
        export_url = reverse('dashboard:export')

        now = timezone.now()
        # c1 is 5d ago, c3 is 3d ago, c2 is 2d ago, c4 is today
        # Query date window for 4 days ago to 2 days ago (should capture c2 and c3)
        start_date = (now - timedelta(days=4)).strftime('%Y-%m-%d')
        end_date = (now - timedelta(days=2)).strftime('%Y-%m-%d')

        res = self.client.get(f"{export_url}?format=csv&start_date={start_date}&end_date={end_date}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        content = b''.join(res.streaming_content).decode('utf-8')
        rows = list(csv.reader(io.StringIO(content)))[1:]
        self.assertEqual(len(rows), 2)
        tracking_ids = [r[0] for r in rows]
        self.assertIn(self.c2.tracking_id, tracking_ids)
        self.assertIn(self.c3.tracking_id, tracking_ids)
        self.assertNotIn(self.c1.tracking_id, tracking_ids)
        self.assertNotIn(self.c4.tracking_id, tracking_ids)

    # 15. ComplaintsExportView: Invalid dates and date range errors
    def test_complaints_export_date_validation_errors(self):
        self.client.force_authenticate(user=self.admin)
        export_url = reverse('dashboard:export')

        # Invalid start_date
        res_invalid_start = self.client.get(f"{export_url}?start_date=not-a-date")
        self.assertEqual(res_invalid_start.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res_invalid_start.data)

        # Invalid end_date
        res_invalid_end = self.client.get(f"{export_url}?end_date=not-a-date")
        self.assertEqual(res_invalid_end.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res_invalid_end.data)

        # start_date > end_date
        res_inverted = self.client.get(f"{export_url}?start_date=2024-12-31&end_date=2024-01-01")
        self.assertEqual(res_inverted.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res_inverted.data)

    # 16. ComplaintsExportView: Unsupported format returns 400 Bad Request
    def test_complaints_export_unsupported_format(self):
        self.client.force_authenticate(user=self.admin)
        export_url = reverse('dashboard:export')

        res = self.client.get(f"{export_url}?format=xlsx")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res.data)

    # 17. ComplaintsExportView: Permission enforcement
    def test_complaints_export_permissions(self):
        export_url = reverse('dashboard:export')

        # 1. Unauthenticated -> 401
        res_unauth = self.client.get(export_url)
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Citizen -> 403
        self.client.force_authenticate(user=self.citizen)
        res_citizen = self.client.get(export_url)
        self.assertEqual(res_citizen.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Worker -> 403
        self.client.force_authenticate(user=self.worker_pwd)
        res_worker = self.client.get(export_url)
        self.assertEqual(res_worker.status_code, status.HTTP_403_FORBIDDEN)

    # 18. SystemSettingsView: Unauthenticated access rejected with 401
    def test_system_settings_unauthenticated(self):
        url = '/api/v1/admin/settings/'
        self.client.logout()

        # GET unauthenticated -> 401
        res_get = self.client.get(url)
        self.assertEqual(res_get.status_code, status.HTTP_401_UNAUTHORIZED)

        # PATCH unauthenticated -> 401
        res_patch = self.client.patch(url, {'sla_critical_hours': 12})
        self.assertEqual(res_patch.status_code, status.HTTP_401_UNAUTHORIZED)

    # 19. SystemSettingsView: Non-admin roles rejected with 403 Forbidden
    def test_system_settings_forbidden_for_non_admin(self):
        url = '/api/v1/admin/settings/'

        # Citizen -> 403
        self.client.force_authenticate(user=self.citizen)
        res_citizen_get = self.client.get(url)
        self.assertEqual(res_citizen_get.status_code, status.HTTP_403_FORBIDDEN)
        res_citizen_patch = self.client.patch(url, {'broadcast_message': 'Hacked'})
        self.assertEqual(res_citizen_patch.status_code, status.HTTP_403_FORBIDDEN)

        # Worker -> 403
        self.client.force_authenticate(user=self.worker_pwd)
        res_worker_get = self.client.get(url)
        self.assertEqual(res_worker_get.status_code, status.HTTP_403_FORBIDDEN)
        res_worker_patch = self.client.patch(url, {'auto_close_hours': 24})
        self.assertEqual(res_worker_patch.status_code, status.HTTP_403_FORBIDDEN)

        # Dept Officer -> 403 (IsAdmin required, not dept officer)
        self.client.force_authenticate(user=self.officer_pwd)
        res_officer_get = self.client.get(url)
        self.assertEqual(res_officer_get.status_code, status.HTTP_403_FORBIDDEN)
        res_officer_patch = self.client.patch(url, {'sla_high_hours': 24})
        self.assertEqual(res_officer_patch.status_code, status.HTTP_403_FORBIDDEN)

    # 20. SystemSettingsView: Admin GET returns default configuration
    def test_system_settings_admin_get_defaults(self):
        # Reset any existing settings to default
        SystemSettings.objects.all().delete()

        self.client.force_authenticate(user=self.admin)
        url = '/api/v1/admin/settings/'
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertEqual(data['sla_critical_hours'], 24)
        self.assertEqual(data['sla_high_hours'], 48)
        self.assertEqual(data['sla_medium_hours'], 72)
        self.assertEqual(data['auto_close_hours'], 72)
        self.assertEqual(data['broadcast_message'], '')

    # 21. SystemSettingsView: Admin PATCH updates partial fields
    def test_system_settings_admin_patch_partial(self):
        self.client.force_authenticate(user=self.admin)
        url = '/api/v1/admin/settings/'

        # Update broadcast_message only
        new_msg = "NMC Alert: Monsoon drainage helpline is active 24/7."
        res = self.client.patch(url, {'broadcast_message': new_msg})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['broadcast_message'], new_msg)
        self.assertEqual(res.data['sla_critical_hours'], 24)
        self.assertEqual(res.data['sla_high_hours'], 48)

        # Update SLA hours
        res_sla = self.client.patch(url, {
            'sla_critical_hours': 12,
            'sla_high_hours': 36,
            'sla_medium_hours': 48,
            'auto_close_hours': 96
        })
        self.assertEqual(res_sla.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sla.data['sla_critical_hours'], 12)
        self.assertEqual(res_sla.data['sla_high_hours'], 36)
        self.assertEqual(res_sla.data['sla_medium_hours'], 48)
        self.assertEqual(res_sla.data['auto_close_hours'], 96)
        # Broadcast message remains preserved
        self.assertEqual(res_sla.data['broadcast_message'], new_msg)

        # Subsequent GET confirms persistence
        res_get = self.client.get(url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data['sla_critical_hours'], 12)
        self.assertEqual(res_get.data['broadcast_message'], new_msg)

    # 22. SystemSettingsView: Admin PATCH rejects invalid values with 400 Bad Request
    def test_system_settings_admin_patch_validation_errors(self):
        self.client.force_authenticate(user=self.admin)
        url = '/api/v1/admin/settings/'

        # Negative hours
        res_neg = self.client.patch(url, {'sla_critical_hours': -1})
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sla_critical_hours', res_neg.data)

        # Zero hours
        res_zero = self.client.patch(url, {'sla_high_hours': 0})
        self.assertEqual(res_zero.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sla_high_hours', res_zero.data)

        # Non-integer value
        res_str = self.client.patch(url, {'auto_close_hours': 'not-a-number'})
        self.assertEqual(res_str.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('auto_close_hours', res_str.data)

    # 23. SystemSettingsView: POST and DELETE rejected with 405 Method Not Allowed
    def test_system_settings_method_not_allowed(self):
        self.client.force_authenticate(user=self.admin)
        url = '/api/v1/admin/settings/'

        res_post = self.client.post(url, {'sla_critical_hours': 24})
        self.assertEqual(res_post.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        res_del = self.client.delete(url)
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    # 24. SystemSettingsView: Direct named route reverse resolution
    def test_system_settings_url_reversal(self):
        self.assertEqual(reverse('admin_system_settings'), '/api/v1/admin/settings/')
        self.assertEqual(reverse('dashboard:settings'), '/api/v1/dashboard/settings/')

    # 25. Celery Task: aggregate_daily_ward_metrics
    def test_aggregate_daily_ward_metrics_task(self):
        from dashboard.tasks import aggregate_daily_ward_metrics
        from dashboard.models import WardMetric

        result = aggregate_daily_ward_metrics()
        self.assertTrue("Aggregated metrics for" in result)
        # Check that metrics were created
        today = timezone.now().date()
        metrics = WardMetric.objects.filter(date=today)
        self.assertTrue(metrics.exists())


