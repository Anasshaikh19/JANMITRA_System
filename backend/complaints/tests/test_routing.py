"""
Automated Complaint Routing Engine Tests for JANMITRA (Nagpur Municipal Corporation).

Validates:
- All four category-to-department mappings (PWD, SWM, PHE, Electrical).
- Unsupported and missing category IDs.
- Missing and non-existent complaint IDs.
- Successful routing and department assignment.
- Correct StatusHistory audit creation.
- Repeated routing calls (idempotency and duplicate prevention).
- Routing Celery task execution.
- AI validation success triggering automated routing.
- AI validation failure/pending validation NOT triggering routing.
- Unsupported category handling on complaints.
"""

import uuid
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.test import TestCase, override_settings
from complaints.models import (
    Category,
    Complaint,
    Department,
    StatusHistory,
    Ward,
)
from complaints.routing import (
    CATEGORY_DEPARTMENT_MAPPING,
    get_department_for_category,
    route_complaint,
)
from complaints.tasks import (
    process_complaint_ai,
    route_complaint_task,
)

User = get_user_model()


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ComplaintRoutingTestCase(TestCase):
    """
    Test suite for automated complaint routing engine and AI integration.
    """

    def setUp(self):
        # 1. Seed 4 Fixed Municipal Departments
        self.dept_pwd, _ = Department.objects.update_or_create(
            id=1,
            defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        self.dept_swm, _ = Department.objects.update_or_create(
            id=2,
            defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'}
        )
        self.dept_phe, _ = Department.objects.update_or_create(
            id=3,
            defaults={'name': 'Public Health Engineering', 'short_name': 'PHE'}
        )
        self.dept_elec, _ = Department.objects.update_or_create(
            id=4,
            defaults={'name': 'Electrical Department', 'short_name': 'ELEC'}
        )

        # 2. Seed Wards
        self.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        self.ward_2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})

        # 3. Seed 4 Canonical Civic Categories
        self.cat_roads, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': self.dept_pwd}
        )
        self.cat_waste, _ = Category.objects.update_or_create(
            id=2,
            defaults={'name': 'Garbage & Waste Management', 'department': self.dept_swm}
        )
        self.cat_water, _ = Category.objects.update_or_create(
            id=3,
            defaults={'name': 'Water & Drainage', 'department': self.dept_phe}
        )
        self.cat_elec, _ = Category.objects.update_or_create(
            id=4,
            defaults={'name': 'Street Lighting & Electrical', 'department': self.dept_elec}
        )

        # 4. Citizen User
        self.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Demo Citizen',
            role=User.Role.CITIZEN,
            ward=self.ward_1
        )

    def _create_complaint(self, category, department=None, status=Complaint.Status.SUBMITTED, fake_detected=False, fake_score=0.1):
        """Helper to create a test complaint with explicit fields."""
        point = Point(79.0882, 21.1458, srid=4326)
        complaint = Complaint.objects.create(
            citizen=self.citizen,
            category=category,
            department=department,
            ward=self.ward_1,
            title=f"Test issue for {category.name}",
            description="Deep civic grievance requiring municipal resolution.",
            location=point,
            status=status,
            priority_level=Complaint.Priority.MEDIUM,
            priority_score=50.0,
            fake_detected=fake_detected,
            fake_detection_score=fake_score
        )
        return complaint

    def test_all_four_category_to_department_mappings(self):
        """
        Verify all 4 canonical category-to-department mappings:
        - Category 1 -> PWD (ID 1)
        - Category 2 -> Solid Waste Management (ID 2)
        - Category 3 -> Public Health Engineering (ID 3)
        - Category 4 -> Electrical Department (ID 4)
        """
        self.assertEqual(get_department_for_category(1), self.dept_pwd)
        self.assertEqual(get_department_for_category(1).id, 1)
        self.assertEqual(get_department_for_category(1).short_name, 'PWD')

        self.assertEqual(get_department_for_category(2), self.dept_swm)
        self.assertEqual(get_department_for_category(2).id, 2)
        self.assertEqual(get_department_for_category(2).short_name, 'SWM')

        self.assertEqual(get_department_for_category(3), self.dept_phe)
        self.assertEqual(get_department_for_category(3).id, 3)
        self.assertEqual(get_department_for_category(3).short_name, 'PHE')

        self.assertEqual(get_department_for_category(4), self.dept_elec)
        self.assertEqual(get_department_for_category(4).id, 4)
        self.assertEqual(get_department_for_category(4).short_name, 'ELEC')

        # Also verify integer-convertible string IDs
        self.assertEqual(get_department_for_category('1'), self.dept_pwd)
        self.assertEqual(get_department_for_category('2'), self.dept_swm)
        self.assertEqual(get_department_for_category('3'), self.dept_phe)
        self.assertEqual(get_department_for_category('4'), self.dept_elec)

    def test_unsupported_category_ids_do_not_assign_default(self):
        """
        Verify that unsupported, invalid, and missing category IDs return None
        and never silently assign a default department.
        """
        self.assertIsNone(get_department_for_category(None))
        self.assertIsNone(get_department_for_category(''))
        self.assertIsNone(get_department_for_category('invalid_str'))
        self.assertIsNone(get_department_for_category(0))
        self.assertIsNone(get_department_for_category(5))
        self.assertIsNone(get_department_for_category(999))
        self.assertIsNone(get_department_for_category(-1))

    def test_missing_and_invalid_complaint_ids(self):
        """
        Verify route_complaint handles missing, None, and non-existent IDs gracefully.
        """
        res_none = route_complaint(None)
        self.assertFalse(res_none['success'])
        self.assertIn('complaint_id is required', res_none['error'])

        res_empty = route_complaint('')
        self.assertFalse(res_empty['success'])
        self.assertIn('complaint_id is required', res_empty['error'])

        random_uuid = uuid.uuid4()
        res_nonexistent = route_complaint(random_uuid)
        self.assertFalse(res_nonexistent['success'])
        self.assertIn('not found', res_nonexistent['error'])

        res_invalid_type = route_complaint('not-a-valid-uuid')
        self.assertFalse(res_invalid_type['success'])
        self.assertIn('not found', res_invalid_type['error'])

    def test_successful_routing_and_department_assignment(self):
        """
        Verify complaints for all 4 categories are routed to their respective departments.
        """
        test_cases = [
            (self.cat_roads, self.dept_pwd),
            (self.cat_waste, self.dept_swm),
            (self.cat_water, self.dept_phe),
            (self.cat_elec, self.dept_elec),
        ]

        for cat, expected_dept in test_cases:
            # Create complaint initially with a different department to verify routing corrects it
            other_dept = self.dept_swm if expected_dept != self.dept_swm else self.dept_pwd
            complaint = self._create_complaint(category=cat, department=other_dept, status=Complaint.Status.VALIDATED)
            Complaint.objects.filter(id=complaint.id).update(department=other_dept)
            complaint.refresh_from_db()
            self.assertEqual(complaint.department, other_dept)

            result = route_complaint(complaint.id)
            self.assertTrue(result['success'])
            self.assertFalse(result.get('already_routed'))
            self.assertEqual(result['department_id'], expected_dept.id)

            complaint.refresh_from_db()
            self.assertEqual(complaint.department, expected_dept)
            self.assertEqual(complaint.status, Complaint.Status.VALIDATED)

    def test_correct_status_history_creation(self):
        """
        Verify StatusHistory audit record is created with correct old/new status and descriptive note.
        """
        complaint = self._create_complaint(category=self.cat_roads, status=Complaint.Status.VALIDATED)
        initial_history_count = StatusHistory.objects.filter(complaint=complaint).count()

        result = route_complaint(complaint.id)
        self.assertTrue(result['success'])

        history_qs = StatusHistory.objects.filter(complaint=complaint).order_by('-changed_at')
        self.assertEqual(history_qs.count(), initial_history_count + 1)

        latest_history = history_qs.first()
        self.assertEqual(latest_history.new_status, complaint.status)
        self.assertIn("Automated routing assigned complaint to Public Works Department (PWD)", latest_history.note)

    def test_repeated_routing_calls_idempotency(self):
        """
        Verify repeated route_complaint calls do not duplicate StatusHistory or cause redundant DB updates.
        """
        complaint = self._create_complaint(category=self.cat_waste, status=Complaint.Status.VALIDATED)

        # 1. First execution
        first_res = route_complaint(complaint.id)
        self.assertTrue(first_res['success'])
        self.assertFalse(first_res.get('already_routed'))
        history_count_after_first = StatusHistory.objects.filter(complaint=complaint).count()

        # 2. Second execution (repeated call)
        second_res = route_complaint(complaint.id)
        self.assertTrue(second_res['success'])
        self.assertTrue(second_res.get('already_routed'))
        self.assertIn("already routed", second_res['message'])

        # 3. Third execution (repeated call)
        third_res = route_complaint(complaint.id)
        self.assertTrue(third_res['success'])
        self.assertTrue(third_res.get('already_routed'))

        # Assert no duplicate StatusHistory entries created
        history_count_after_third = StatusHistory.objects.filter(complaint=complaint).count()
        self.assertEqual(history_count_after_first, history_count_after_third)

    def test_routing_task_execution(self):
        """
        Verify Celery route_complaint_task executes and returns clear result.
        """
        other_dept = self.dept_pwd
        complaint = self._create_complaint(category=self.cat_water, department=other_dept, status=Complaint.Status.VALIDATED)
        Complaint.objects.filter(id=complaint.id).update(department=other_dept)

        # Execute task synchronously
        task_result = route_complaint_task(str(complaint.id))
        self.assertIn("successfully routed", task_result)

        complaint.refresh_from_db()
        self.assertEqual(complaint.department, self.dept_phe)

    def test_ai_validation_success_triggers_routing(self):
        """
        Verify that successful AI validation dispatches automated routing task.
        """
        complaint = self._create_complaint(
            category=self.cat_roads,
            department=self.dept_pwd,
            status=Complaint.Status.SUBMITTED,
            fake_detected=False,
            fake_score=0.1
        )

        with patch('complaints.tasks.route_complaint_task.delay') as mock_route_delay:
            with self.captureOnCommitCallbacks(execute=True):
                result_str = process_complaint_ai(str(complaint.id))

        self.assertIn("AI processing completed", result_str)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Validated')
        mock_route_delay.assert_called_once_with(str(complaint.id))

    def test_ai_validation_fraud_pending_does_not_trigger_routing(self):
        """
        Verify that flagged/fraud complaints in Pending Validation do NOT trigger automated routing.
        """
        complaint = self._create_complaint(
            category=self.cat_roads,
            department=self.dept_pwd,
            status=Complaint.Status.SUBMITTED,
            fake_detected=True,
            fake_score=0.9
        )

        with patch('complaints.tasks.route_complaint_task.delay') as mock_route_delay:
            with self.captureOnCommitCallbacks(execute=True):
                result_str = process_complaint_ai(str(complaint.id))

        self.assertIn("AI processing completed", result_str)
        complaint.refresh_from_db()
        self.assertEqual(complaint.status, 'Pending Validation')
        # Routing must NOT be triggered for pending validation
        mock_route_delay.assert_not_called()

    def test_unsupported_category_on_complaint(self):
        """
        Verify route_complaint on a complaint with an unmapped category ID fails safely.
        """
        # Create an unmapped category (ID 8)
        unmapped_cat, _ = Category.objects.update_or_create(
            id=8,
            defaults={'name': 'Unmapped Prototype Category', 'department': self.dept_pwd}
        )
        complaint = self._create_complaint(category=unmapped_cat, department=self.dept_pwd, status=Complaint.Status.VALIDATED)

        result = route_complaint(complaint.id)
        self.assertFalse(result['success'])
        self.assertIn("Unsupported or unmapped category", result['error'])

        complaint.refresh_from_db()
        self.assertEqual(complaint.department, self.dept_pwd)
