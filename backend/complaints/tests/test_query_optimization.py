"""
Automated profiling and query count optimization tests for JANMITRA Complaint APIs.
Verifies composite indexes, elimination of N+1 queries, and O(1) query scaling across dataset sizes.
"""

from datetime import timedelta
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from complaints.models import Category, Complaint, ComplaintImage, Department, StatusHistory, Ward
from complaints.serializers import ComplaintDetailSerializer, ComplaintListSerializer


class ComplaintQueryOptimizationTests(APITestCase):
    """
    Query profiling and indexing verification for Complaint model and list APIs.
    """

    @classmethod
    def setUpTestData(cls):
        # 1. Departments
        cls.dept1, _ = Department.objects.update_or_create(
            id=1, defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        cls.dept2, _ = Department.objects.update_or_create(
            id=2, defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'}
        )

        # 2. Wards
        cls.ward1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        cls.ward2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})

        # 3. Categories
        cls.cat1, _ = Category.objects.update_or_create(
            id=1, defaults={'name': 'Road Repair', 'department': cls.dept1}
        )
        cls.cat2, _ = Category.objects.update_or_create(
            id=2, defaults={'name': 'Garbage Dump', 'department': cls.dept2}
        )

        # 4. Users
        cls.admin = User.objects.create_user(
            mobile='9800000088',
            full_name='System Administrator',
            email='admin.opt@janmitra.gov.in',
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        cls.dept_officer = User.objects.create_user(
            mobile='9800000089',
            full_name='PWD Officer',
            email='officer.opt@janmitra.gov.in',
            role=User.Role.DEPT_OFFICER,
            department=cls.dept1,
            ward=cls.ward1,
        )
        cls.worker = User.objects.create_user(
            mobile='9810000088',
            full_name='Field Worker 1',
            role=User.Role.WORKER,
            department=cls.dept1,
            ward=cls.ward1,
        )
        cls.citizen = User.objects.create_user(
            mobile='9820000088',
            full_name='Citizen One',
            email='citizen.opt@test.com',
            role=User.Role.CITIZEN,
        )
        cls.citizen2 = User.objects.create_user(
            mobile='9820000089',
            full_name='Citizen Two',
            email='citizen2.opt@test.com',
            role=User.Role.CITIZEN,
        )

    def _create_complaints_batch(self, count, citizen=None, dept=None, ward=None, cat=None):
        """Helper to create realistic complaints with images and status history entries."""
        now = timezone.now()
        complaints = []
        citizen = citizen or self.citizen
        dept = dept or self.dept1
        ward = ward or self.ward1
        cat = cat or self.cat1

        for i in range(count):
            c = Complaint.objects.create(
                citizen=citizen,
                category=cat,
                ward=ward,
                title=f"Civic grievance #{i + 1}",
                description=f"Detailed grievance description for civic issue #{i + 1}.",
                location=Point(79.08 + (i * 0.001), 21.14 + (i * 0.001), srid=4326),
                status=Complaint.Status.ASSIGNED,
                priority_level=Complaint.Priority.HIGH,
                assigned_worker=self.worker,
            )
            Complaint.objects.filter(id=c.id).update(submitted_at=now - timedelta(hours=i + 1))

            # 2 images per complaint
            img1 = SimpleUploadedFile(f'photo_{c.id}_1.jpg', b'\xff\xd8\xff\xe0dummy_data_1', content_type='image/jpeg')
            img2 = SimpleUploadedFile(f'photo_{c.id}_2.jpg', b'\xff\xd8\xff\xe0dummy_data_2', content_type='image/jpeg')
            ComplaintImage.objects.create(complaint=c, image=img1, image_type=ComplaintImage.ImageType.COMPLAINT)
            ComplaintImage.objects.create(complaint=c, image=img2, image_type=ComplaintImage.ImageType.PROOF)

            # 2 status history records per complaint (with changed_by FK)
            StatusHistory.objects.create(
                complaint=c,
                old_status=Complaint.Status.SUBMITTED,
                new_status=Complaint.Status.ASSIGNED,
                changed_by=self.dept_officer,
                note=f"Assigned to {self.worker.full_name}",
            )
            StatusHistory.objects.create(
                complaint=c,
                old_status=Complaint.Status.ASSIGNED,
                new_status=Complaint.Status.IN_PROGRESS,
                changed_by=self.worker,
                note="Worker started on-site inspection",
            )
            complaints.append(c)

        return complaints

    # 1. Model composite index verification
    def test_composite_indexes_configured_on_model(self):
        """Verify the two required composite indexes exist in Complaint._meta.indexes."""
        index_names = {idx.name: idx for idx in Complaint._meta.indexes}

        # 1. Department + ward + status index
        self.assertIn('complaint_dept_ward_status_idx', index_names)
        dept_idx = index_names['complaint_dept_ward_status_idx']
        self.assertEqual(dept_idx.fields, ['department', 'ward', 'status'])

        # 2. Citizen + descending creation timestamp index
        self.assertIn('complaint_citizen_created_idx', index_names)
        citizen_idx = index_names['complaint_citizen_created_idx']
        self.assertEqual(citizen_idx.fields, ['citizen', '-submitted_at'])

    # 2. Query scaling across dataset sizes (5 vs 15 complaints)
    def test_query_count_constant_scaling_across_dataset_sizes(self):
        """
        Verify that complaint list query count does NOT scale linearly with the number of complaints.
        Measuring 5 complaints vs 15 complaints must yield identical query counts.
        """
        self.client.force_authenticate(user=self.admin)
        url = reverse('complaints:complaint-list')

        # Size A: 5 complaints (each with 2 images and 2 history records)
        self._create_complaints_batch(5, citizen=self.citizen)

        with CaptureQueriesContext(connection) as ctx_5:
            res_5 = self.client.get(url)

        self.assertEqual(res_5.status_code, status.HTTP_200_OK)
        count_5 = len(ctx_5.captured_queries)

        # Size B: Add 10 more complaints -> total 15 complaints
        self._create_complaints_batch(10, citizen=self.citizen2)

        with CaptureQueriesContext(connection) as ctx_15:
            res_15 = self.client.get(url)

        self.assertEqual(res_15.status_code, status.HTTP_200_OK)
        count_15 = len(ctx_15.captured_queries)

        # Query count must remain constant O(1), NOT 3x higher
        self.assertEqual(
            count_5,
            count_15,
            f"Query count scaled with dataset size! 5 complaints took {count_5} queries, "
            f"while 15 complaints took {count_15} queries."
        )

    # 3. Elimination of N+1 queries compared to unoptimized queries
    def test_n_plus_one_elimination_compared_to_naive_query(self):
        """
        Demonstrate that serializer evaluation on an unoptimized queryset generates N+1 queries,
        whereas the optimized queryset with select_related/prefetch_related runs in fixed queries.
        """
        batch_size = 6
        self._create_complaints_batch(batch_size)

        # 1. Unoptimized naive queryset without joins or prefetches
        naive_qs = list(Complaint.objects.all()[:batch_size])
        with CaptureQueriesContext(connection) as naive_ctx:
            # Serializing accesses category.name, ward.name, citizen.get_full_name, etc.
            serializer_naive = ComplaintDetailSerializer(naive_qs, many=True)
            _ = serializer_naive.data

        naive_query_count = len(naive_ctx.captured_queries)

        # 2. Optimized queryset with select_related & prefetch_related
        optimized_qs = list(
            Complaint.objects.select_related(
                'citizen', 'category', 'department', 'ward', 'assigned_worker'
            ).prefetch_related(
                'images',
                'status_history__changed_by'
            ).all()[:batch_size]
        )
        with CaptureQueriesContext(connection) as opt_ctx:
            serializer_opt = ComplaintDetailSerializer(optimized_qs, many=True)
            _ = serializer_opt.data

        opt_query_count = len(opt_ctx.captured_queries)

        # In-memory serialization of prefetched data should produce 0 additional queries
        self.assertEqual(opt_query_count, 0)
        self.assertGreater(naive_query_count, batch_size)

    # 4. Standalone ComplaintListView query efficiency
    def test_complaint_list_view_endpoint_query_efficiency(self):
        """Verify the dedicated ComplaintListView route functions efficiently without N+1."""
        self._create_complaints_batch(8)
        self.client.force_authenticate(user=self.admin)

        # Dedicated list route
        url = reverse('complaints:complaint-list-view')
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get(url)

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, (dict, list))
        # Total queries must be bounded (e.g. auth user + count + complaints select_related + prefetches <= 6)
        self.assertLessEqual(len(ctx.captured_queries), 6)

    # 5. Role-based query filtering and security preserved
    def test_role_filtering_preserved_under_optimization(self):
        """Role-based visibility must remain strictly enforced with optimized querysets."""
        # 4 PWD complaints for citizen 1
        self._create_complaints_batch(4, citizen=self.citizen, dept=self.dept1, ward=self.ward1)
        # 3 SWM complaints for citizen 2
        self._create_complaints_batch(3, citizen=self.citizen2, dept=self.dept2, ward=self.ward2)

        url = reverse('complaints:complaint-list')

        # Citizen 1 sees only their own complaints (4)
        self.client.force_authenticate(user=self.citizen)
        res_cit1 = self.client.get(url)
        self.assertEqual(res_cit1.status_code, status.HTTP_200_OK)
        count_cit1 = res_cit1.data.get('count', len(res_cit1.data))
        self.assertEqual(count_cit1, 4)

        # Dept officer (PWD, Ward 1) sees only PWD Ward 1 complaints (4)
        self.client.force_authenticate(user=self.dept_officer)
        res_officer = self.client.get(url)
        self.assertEqual(res_officer.status_code, status.HTTP_200_OK)
        count_officer = res_officer.data.get('count', len(res_officer.data))
        self.assertEqual(count_officer, 4)

        # Admin sees all complaints (7)
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get(url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        count_admin = res_admin.data.get('count', len(res_admin.data))
        self.assertEqual(count_admin, 7)
