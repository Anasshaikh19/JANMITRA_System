"""
Automated test suite for JANMITRA Master Metadata API and Seed Migration.

Covers:
1. Categories endpoint returns seeded categories.
2. Wards endpoint returns seeded wards.
3. Category-to-department mappings are correct.
4. Ward names and zone/location labels are correct.
5. Results use stable ordering.
6. GET returns expected JSON structure.
7. POST, PUT, PATCH, and DELETE are rejected with HTTP 405.
8. Unauthenticated GET follows explicitly chosen access policy (public AllowAny).
9. Idempotency: existing records do not produce duplicates when migration logic runs.
10. Preservation: complaints, users, workers, and assignments remain intact after migration.
"""

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework import status
from rest_framework.test import APITestCase

import importlib

from complaints.models import Category, Complaint, Department, Ward

migration_0011 = importlib.import_module('complaints.migrations.0011_seed_master_metadata')
seed_master_metadata = migration_0011.seed_master_metadata
reverse_seed_master_metadata = migration_0011.reverse_seed_master_metadata

User = get_user_model()


class MockSchemaEditor:
    """Mock schema editor providing the current database connection alias."""
    def __init__(self, connection_alias='default'):
        self.connection = connection


class MasterMetadataAPITests(APITestCase):
    """
    Tests for read-only metadata endpoints:
    - GET /api/v1/meta/categories/
    - GET /api/v1/meta/wards/
    """

    @classmethod
    def setUpTestData(cls):
        # 1. Departments
        cls.dept_pwd, _ = Department.objects.update_or_create(
            id=1,
            defaults={'name': 'Public Works Department', 'short_name': 'PWD'}
        )
        cls.dept_swm, _ = Department.objects.update_or_create(
            id=2,
            defaults={'name': 'Solid Waste Management', 'short_name': 'SWM'}
        )
        cls.dept_phe, _ = Department.objects.update_or_create(
            id=3,
            defaults={'name': 'Public Health Engineering', 'short_name': 'PHE'}
        )
        cls.dept_elec, _ = Department.objects.update_or_create(
            id=4,
            defaults={'name': 'Electrical Department', 'short_name': 'ELEC'}
        )

        # 2. Wards
        cls.ward_1, _ = Ward.objects.update_or_create(id=1, defaults={'name': 'Ward 1'})
        cls.ward_2, _ = Ward.objects.update_or_create(id=2, defaults={'name': 'Ward 2'})
        cls.ward_3, _ = Ward.objects.update_or_create(id=3, defaults={'name': 'Ward 3'})
        cls.ward_4, _ = Ward.objects.update_or_create(id=4, defaults={'name': 'Ward 4'})

        # 3. Categories
        cls.cat_roads, _ = Category.objects.update_or_create(
            id=1,
            defaults={'name': 'Roads & Infrastructure', 'department': cls.dept_pwd}
        )
        cls.cat_waste, _ = Category.objects.update_or_create(
            id=2,
            defaults={'name': 'Garbage & Waste', 'department': cls.dept_swm}
        )
        cls.cat_water, _ = Category.objects.update_or_create(
            id=3,
            defaults={'name': 'Water & Drainage', 'department': cls.dept_phe}
        )
        cls.cat_light, _ = Category.objects.update_or_create(
            id=4,
            defaults={'name': 'Street Lighting', 'department': cls.dept_elec}
        )

        # 4. Demo Users for complaint assignment verification
        cls.citizen = User.objects.create_user(
            mobile='9820000001',
            full_name='Citizen Meta Test',
            role=User.Role.CITIZEN,
            ward=cls.ward_1
        )
        cls.worker = User.objects.create_user(
            mobile='9810010001',
            full_name='Worker Meta Test',
            role=User.Role.WORKER,
            department=cls.dept_pwd,
            ward=cls.ward_1
        )

    def test_01_categories_endpoint_returns_seeded_categories(self):
        """1. Categories endpoint returns the four canonical seeded categories."""
        url = '/api/v1/meta/categories/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 4)

        cat_names = [c['name'] for c in data]
        self.assertEqual(
            cat_names,
            [
                'Roads & Infrastructure',
                'Garbage & Waste',
                'Water & Drainage',
                'Street Lighting',
            ]
        )

    def test_02_wards_endpoint_returns_seeded_wards(self):
        """2. Wards endpoint returns the four seeded municipal wards."""
        url = '/api/v1/meta/wards/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 4)

        ward_ids = [w['id'] for w in data]
        self.assertEqual(ward_ids, [1, 2, 3, 4])

        ward_names = [w['name'] for w in data]
        self.assertEqual(ward_names, ['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4'])

    def test_03_category_to_department_mappings_are_correct(self):
        """3. Category-to-department mappings match civic municipal structure."""
        url = '/api/v1/meta/categories/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cat_map = {item['name']: item for item in response.data}

        # Roads & Infrastructure -> PWD
        self.assertEqual(cat_map['Roads & Infrastructure']['department_short_name'], 'PWD')
        self.assertEqual(cat_map['Roads & Infrastructure']['department_name'], 'Public Works Department')
        self.assertEqual(cat_map['Roads & Infrastructure']['department_id'], 1)

        # Garbage & Waste -> SWM
        self.assertEqual(cat_map['Garbage & Waste']['department_short_name'], 'SWM')
        self.assertEqual(cat_map['Garbage & Waste']['department_name'], 'Solid Waste Management')
        self.assertEqual(cat_map['Garbage & Waste']['department_id'], 2)

        # Water & Drainage -> PHE
        self.assertEqual(cat_map['Water & Drainage']['department_short_name'], 'PHE')
        self.assertEqual(cat_map['Water & Drainage']['department_name'], 'Public Health Engineering')
        self.assertEqual(cat_map['Water & Drainage']['department_id'], 3)

        # Street Lighting -> ELEC
        self.assertEqual(cat_map['Street Lighting']['department_short_name'], 'ELEC')
        self.assertEqual(cat_map['Street Lighting']['department_name'], 'Electrical Department')
        self.assertEqual(cat_map['Street Lighting']['department_id'], 4)

    def test_04_ward_names_and_zone_location_labels_are_correct(self):
        """4. Ward names and zone/location labels correspond to NMC designations."""
        url = '/api/v1/meta/wards/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ward_map = {item['id']: item for item in response.data}

        # Ward 1 — Central
        self.assertEqual(ward_map[1]['name'], 'Ward 1')
        self.assertEqual(ward_map[1]['zone'], 'Central')
        self.assertEqual(ward_map[1]['location'], 'Central')
        self.assertEqual(ward_map[1]['ward_number'], 1)
        self.assertEqual(ward_map[1]['display_name'], 'Ward 1 — Central')

        # Ward 2 — North
        self.assertEqual(ward_map[2]['name'], 'Ward 2')
        self.assertEqual(ward_map[2]['zone'], 'North')
        self.assertEqual(ward_map[2]['location'], 'North')
        self.assertEqual(ward_map[2]['ward_number'], 2)
        self.assertEqual(ward_map[2]['display_name'], 'Ward 2 — North')

        # Ward 3 — East
        self.assertEqual(ward_map[3]['name'], 'Ward 3')
        self.assertEqual(ward_map[3]['zone'], 'East')
        self.assertEqual(ward_map[3]['location'], 'East')
        self.assertEqual(ward_map[3]['ward_number'], 3)
        self.assertEqual(ward_map[3]['display_name'], 'Ward 3 — East')

        # Ward 4 — West
        self.assertEqual(ward_map[4]['name'], 'Ward 4')
        self.assertEqual(ward_map[4]['zone'], 'West')
        self.assertEqual(ward_map[4]['location'], 'West')
        self.assertEqual(ward_map[4]['ward_number'], 4)
        self.assertEqual(ward_map[4]['display_name'], 'Ward 4 — West')

    def test_05_results_use_stable_ordering(self):
        """5. Results use stable ascending ID ordering."""
        cat_resp = self.client.get('/api/v1/meta/categories/')
        cat_ids = [c['id'] for c in cat_resp.data]
        self.assertEqual(cat_ids, sorted(cat_ids))
        self.assertEqual(cat_ids, [1, 2, 3, 4])

        ward_resp = self.client.get('/api/v1/meta/wards/')
        ward_ids = [w['id'] for w in ward_resp.data]
        self.assertEqual(ward_ids, sorted(ward_ids))
        self.assertEqual(ward_ids, [1, 2, 3, 4])

    def test_06_get_returns_expected_json_structure(self):
        """6. GET returns the exact JSON fields needed for frontend dropdowns."""
        # Category JSON keys
        cat_resp = self.client.get('/api/v1/meta/categories/')
        self.assertTrue(len(cat_resp.data) > 0)
        expected_cat_keys = {
            'id',
            'name',
            'department',
            'department_id',
            'department_name',
            'department_short_name',
            'department_code',
        }
        for item in cat_resp.data:
            self.assertTrue(expected_cat_keys.issubset(set(item.keys())))

        # Ward JSON keys
        ward_resp = self.client.get('/api/v1/meta/wards/')
        self.assertTrue(len(ward_resp.data) > 0)
        expected_ward_keys = {
            'id',
            'ward_number',
            'ward_code',
            'name',
            'zone',
            'location',
            'display_name',
        }
        for item in ward_resp.data:
            self.assertTrue(expected_ward_keys.issubset(set(item.keys())))

    def test_07_post_put_patch_delete_are_rejected_with_405(self):
        """7. Write operations (POST, PUT, PATCH, DELETE) are rejected with HTTP 405."""
        endpoints = ['/api/v1/meta/categories/', '/api/v1/meta/wards/']

        for url in endpoints:
            with self.subTest(url=url):
                post_res = self.client.post(url, {'name': 'New Item'})
                self.assertEqual(post_res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

                put_res = self.client.put(url, {'name': 'Updated Item'})
                self.assertEqual(put_res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

                patch_res = self.client.patch(url, {'name': 'Patched Item'})
                self.assertEqual(patch_res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

                delete_res = self.client.delete(url)
                self.assertEqual(delete_res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_08_unauthenticated_get_allowed(self):
        """8. Unauthenticated GET is allowed under public dropdown access policy."""
        self.client.logout()
        cat_resp = self.client.get('/api/v1/meta/categories/')
        self.assertEqual(cat_resp.status_code, status.HTTP_200_OK)

        ward_resp = self.client.get('/api/v1/meta/wards/')
        self.assertEqual(ward_resp.status_code, status.HTTP_200_OK)

        # Authenticated access also works seamlessly
        self.client.force_authenticate(user=self.citizen)
        cat_auth_resp = self.client.get('/api/v1/meta/categories/')
        self.assertEqual(cat_auth_resp.status_code, status.HTTP_200_OK)

    def test_09_migration_logic_is_idempotent_no_duplicates(self):
        """9. Applying migration logic multiple times does not produce duplicate records."""
        schema_editor = MockSchemaEditor()

        initial_dept_count = Department.objects.count()
        initial_ward_count = Ward.objects.count()
        initial_cat_count = Category.objects.count()

        # Run migration 1st time
        seed_master_metadata(apps, schema_editor)
        self.assertEqual(Department.objects.count(), initial_dept_count)
        self.assertEqual(Ward.objects.count(), initial_ward_count)
        self.assertEqual(Category.objects.count(), initial_cat_count)

        # Run migration 2nd time
        seed_master_metadata(apps, schema_editor)
        self.assertEqual(Department.objects.count(), initial_dept_count)
        self.assertEqual(Ward.objects.count(), initial_ward_count)
        self.assertEqual(Category.objects.count(), initial_cat_count)

        # Test conflict detection: department short_name conflict
        with self.assertRaises(RuntimeError) as ctx_dept:
            # Create a conflicting department with ID 99 using short_name 'PWD'
            Department.objects.create(id=99, name='Conflicting PWD', short_name='PWD_CONF')
            Department.objects.filter(id=99).update(short_name='PWD_CONFLICT')
            # Now trigger migration with mismatched short_name on ID 1
            Department.objects.filter(id=1).update(short_name='PWD_TEMP')
            Department.objects.filter(id=99).update(short_name='PWD')
            seed_master_metadata(apps, schema_editor)
        self.assertIn("Seed Conflict", str(ctx_dept.exception))

        # Cleanup test conflict records
        Department.objects.filter(id=99).delete()
        Department.objects.filter(id=1).update(short_name='PWD')

        # Test safe reverse migration
        reverse_seed_master_metadata(apps, schema_editor)
        self.assertEqual(Department.objects.count(), initial_dept_count)
        self.assertEqual(Ward.objects.count(), initial_ward_count)

    def test_10_existing_complaints_and_relationships_remain_intact(self):
        """10. Existing complaints, users, workers, and assignments remain intact after migration."""
        # Create a sample complaint
        complaint = Complaint.objects.create(
            title='Road Pothole Near Central Park',
            description='Severe pothole causing traffic obstruction',
            category=self.cat_roads,
            department=self.dept_pwd,
            ward=self.ward_1,
            citizen=self.citizen,
            assigned_worker=self.worker,
            status=Complaint.Status.ASSIGNED,
            address='Central Park Road, Ward 1'
        )

        complaint_id = complaint.id
        schema_editor = MockSchemaEditor()

        # Run migration logic
        seed_master_metadata(apps, schema_editor)

        # Re-fetch complaint and verify all relationships are intact
        refreshed = Complaint.objects.get(id=complaint_id)
        self.assertEqual(refreshed.category.id, 1)
        self.assertEqual(refreshed.category.name, 'Roads & Infrastructure')
        self.assertEqual(refreshed.department.id, 1)
        self.assertEqual(refreshed.department.short_name, 'PWD')
        self.assertEqual(refreshed.ward.id, 1)
        self.assertEqual(refreshed.ward.name, 'Ward 1')
        self.assertEqual(refreshed.citizen, self.citizen)
        self.assertEqual(refreshed.assigned_worker, self.worker)
        self.assertEqual(refreshed.status, Complaint.Status.ASSIGNED)
