# Generated for JANMITRA - Nagpur Municipal Corporation Civic Issue System

import uuid
import complaints.models
from django.conf import settings
import django.contrib.gis.db.models.fields
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def seed_canonical_categories(apps, schema_editor):
    """
    Seeds canonical civic grievance categories for Nagpur Municipal Corporation
    mapped to responsible municipal departments (PWD, SWM, PHE, ELEC).
    Strictly verifies conflicts before seeding.
    """
    db_alias = schema_editor.connection.alias
    Category = apps.get_model('complaints', 'Category')
    Department = apps.get_model('complaints', 'Department')

    CANONICAL_CATEGORIES = [
        # (ID, Name, Department ID)
        (1, 'Pothole & Road Repair', 1),
        (2, 'Public Space Encroachment', 1),
        (3, 'Fallen Tree & Greenery Obstruction', 1),
        (4, 'Garbage Dump & Waste Disposal', 2),
        (5, 'Stray Animal Nuance', 2),
        (6, 'Water Supply Leakage', 3),
        (7, 'Drainage & Sewage Overflow', 3),
        (8, 'Broken / Inactive Streetlight', 4),
    ]

    for cat_id, name, dept_id in CANONICAL_CATEGORIES:
        dept = Department.objects.using(db_alias).filter(id=dept_id).first()
        if not dept:
            raise RuntimeError(
                f"Cannot seed category '{name}': Department ID {dept_id} does not exist in database."
            )

        existing_by_id = Category.objects.using(db_alias).filter(id=cat_id).first()
        if existing_by_id:
            if existing_by_id.name == name and existing_by_id.department_id == dept_id:
                # Already correctly seeded
                continue
            raise RuntimeError(
                f"Seed Conflict: Category ID {cat_id} already exists with name='{existing_by_id.name}', "
                f"department_id={existing_by_id.department_id}. Expected name='{name}', department_id={dept_id}."
            )

        existing_by_name = Category.objects.using(db_alias).filter(name=name).first()
        if existing_by_name:
            raise RuntimeError(
                f"Seed Conflict: Category name '{name}' already exists with ID {existing_by_name.id}. "
                f"Expected ID {cat_id}."
            )

        Category.objects.using(db_alias).create(
            id=cat_id,
            name=name,
            department=dept
        )


def reverse_seed_canonical_categories(apps, schema_editor):
    """
    Reverse operation: deletes seeded canonical categories.
    """
    db_alias = schema_editor.connection.alias
    Category = apps.get_model('complaints', 'Category')
    Category.objects.using(db_alias).filter(id__in=[1, 2, 3, 4, 5, 6, 7, 8]).delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0002_user_schema_update'),
        ('complaints', '0002_ward_department'),
        ('notifications', '0002_remove_notification_complaint'),
    ]

    operations = [
        # Step 1: Create Category model linked to Department
        migrations.CreateModel(
            name='Category',
            fields=[
                ('id', models.SmallIntegerField(help_text='Fixed Category ID (1 to 8)', primary_key=True, serialize=False)),
                ('name', models.CharField(help_text='Category name (e.g., Pothole & Road Repair, Garbage Dump & Waste Disposal)', max_length=100, unique=True)),
                ('department', models.ForeignKey(help_text='Civic department responsible for resolving this category', on_delete=django.db.models.deletion.PROTECT, related_name='categories', to='complaints.department')),
            ],
            options={
                'verbose_name': 'Category',
                'verbose_name_plural': 'Categories',
                'ordering': ['id'],
            },
        ),
        migrations.RunPython(
            seed_canonical_categories,
            reverse_code=reverse_seed_canonical_categories
        ),

        # Step 2: Cleanly remove legacy ComplaintTimeline and Complaint prototype tables
        migrations.DeleteModel(
            name='ComplaintTimeline',
        ),
        migrations.DeleteModel(
            name='Complaint',
        ),

        # Step 3: Create modern UUID-based Complaint model with PostGIS geography PointField
        migrations.CreateModel(
            name='Complaint',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, help_text='Primary unique UUID identifier', primary_key=True, serialize=False)),
                ('tracking_id', models.CharField(db_index=True, editable=False, help_text='Citizen tracking identifier (e.g., NMC-2024-ABC1234)', max_length=32, unique=True)),
                ('title', models.CharField(help_text='Brief title of the civic problem', max_length=200)),
                ('description', models.TextField(help_text='Detailed description of the issue')),
                ('location', django.contrib.gis.db.models.fields.PointField(blank=True, geography=True, help_text='PostGIS Spatial Point (Longitude, Latitude) WGS84', null=True, srid=4326)),
                ('address', models.CharField(blank=True, help_text='Street name / Locality in Nagpur', max_length=255)),
                ('landmark', models.CharField(blank=True, help_text='Nearby landmark', max_length=150)),
                ('status', models.CharField(choices=[('SUBMITTED', 'Submitted'), ('ASSIGNED', 'Assigned'), ('IN_PROGRESS', 'In Progress'), ('RESOLVED', 'Resolved'), ('REJECTED', 'Rejected')], db_index=True, default='SUBMITTED', max_length=20)),
                ('priority_level', models.CharField(choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')], default='LOW', max_length=15)),
                ('priority_score', models.FloatField(default=0.0, help_text='Calculated priority/urgency score (0.0 to 100.0)')),
                ('ai_confidence', models.FloatField(blank=True, help_text='AI category classification confidence score (0.0 to 1.0)', null=True)),
                ('fake_detected', models.BooleanField(default=False, help_text='Flag indicating potential fraudulent or spam complaint')),
                ('fake_detection_score', models.FloatField(default=0.0, help_text='AI fake/spam probability score (0.0 to 1.0)')),
                ('fake_reason', models.TextField(blank=True, help_text='AI explanation for fake/spam detection')),
                ('is_duplicate', models.BooleanField(db_index=True, default=False, help_text='Flag indicating this is a duplicate of another complaint')),
                ('similarity_score', models.FloatField(blank=True, help_text='Similarity score to parent complaint (0.0 to 1.0)', null=True)),
                ('ward_override', models.BooleanField(default=False, help_text='Flag indicating ward was manually overridden')),
                ('override_reason', models.TextField(blank=True, help_text='Reason for ward reassignment')),
                ('citizen_rating', models.PositiveSmallIntegerField(blank=True, help_text='Citizen satisfaction rating (1 to 5 stars)', null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ('citizen_feedback', models.TextField(blank=True, help_text='Citizen remarks/feedback upon resolution')),
                ('submitted_at', models.DateTimeField(auto_now_add=True, db_index=True, help_text='Timestamp of submission')),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('assigned_worker', models.ForeignKey(blank=True, help_text='Municipal worker assigned to resolve this issue', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_complaints', to=settings.AUTH_USER_MODEL)),
                ('category', models.ForeignKey(help_text='Civic issue category', on_delete=django.db.models.deletion.PROTECT, related_name='complaints', to='complaints.category')),
                ('citizen', models.ForeignKey(help_text='Citizen who reported the issue', on_delete=django.db.models.deletion.CASCADE, related_name='reported_complaints', to=settings.AUTH_USER_MODEL)),
                ('department', models.ForeignKey(help_text='Department derived consistently from the selected category', on_delete=django.db.models.deletion.PROTECT, related_name='complaints', to='complaints.department')),
                ('parent_complaint', models.ForeignKey(blank=True, help_text='Canonical parent complaint if duplicate', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='child_complaints', to='complaints.complaint')),
                ('original_ward', models.ForeignKey(blank=True, help_text='Original ward before override', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='overridden_complaints', to='complaints.ward')),
                ('ward', models.ForeignKey(help_text='Municipal ward of the complaint', on_delete=django.db.models.deletion.PROTECT, related_name='complaints', to='complaints.ward')),
            ],
            options={
                'verbose_name': 'Civic Complaint',
                'verbose_name_plural': 'Civic Complaints',
                'ordering': ['-submitted_at'],
            },
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['ward', 'status'], name='complaints__ward_id_d5f4e2_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['category', 'status'], name='complaints__categor_bda360_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['department', 'status'], name='complaints__departm_77b491_idx'),
        ),

        # Step 4: Create ComplaintImage model for multi-photo evidence & resolution proof
        migrations.CreateModel(
            name='ComplaintImage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('image', models.ImageField(help_text='Uploaded image file', upload_to=complaints.models.complaint_image_upload_path)),
                ('image_type', models.CharField(choices=[('CITIZEN_EVIDENCE', 'Citizen Evidence'), ('RESOLUTION_PROOF', 'Resolution Proof'), ('SITE_INSPECTION', 'Site Inspection')], default='CITIZEN_EVIDENCE', help_text='Type of image upload', max_length=30)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('complaint', models.ForeignKey(help_text='Associated complaint', on_delete=django.db.models.deletion.CASCADE, related_name='images', to='complaints.complaint')),
            ],
            options={
                'verbose_name': 'Complaint Image',
                'verbose_name_plural': 'Complaint Images',
                'ordering': ['uploaded_at'],
            },
        ),

        # Step 5: Create StatusHistory model for comprehensive status transition audits
        migrations.CreateModel(
            name='StatusHistory',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('old_status', models.CharField(blank=True, choices=[('SUBMITTED', 'Submitted'), ('ASSIGNED', 'Assigned'), ('IN_PROGRESS', 'In Progress'), ('RESOLVED', 'Resolved'), ('REJECTED', 'Rejected')], help_text='Previous status before transition', max_length=20, null=True)),
                ('new_status', models.CharField(choices=[('SUBMITTED', 'Submitted'), ('ASSIGNED', 'Assigned'), ('IN_PROGRESS', 'In Progress'), ('RESOLVED', 'Resolved'), ('REJECTED', 'Rejected')], help_text='New status after transition', max_length=20)),
                ('note', models.TextField(blank=True, help_text='Official remarks or explanation for the change')),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('changed_by', models.ForeignKey(blank=True, help_text='User who triggered the status update', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='status_changes', to=settings.AUTH_USER_MODEL)),
                ('complaint', models.ForeignKey(help_text='Associated complaint', on_delete=django.db.models.deletion.CASCADE, related_name='status_history', to='complaints.complaint')),
            ],
            options={
                'verbose_name': 'Status History',
                'verbose_name_plural': 'Status History Entries',
                'ordering': ['changed_at'],
            },
        ),
    ]
