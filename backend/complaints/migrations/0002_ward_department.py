# Generated for JANMITRA - Nagpur Municipal Corporation Civic Issue System

from django.db import migrations, models


def seed_fixed_wards_and_departments(apps, schema_editor):
    """
    Seeds the fixed Municipal Wards (1-4) and Departments (1-4) with explicit IDs.
    Strictly verifies conflicts before seeding:
    - If the expected ID exists with exact expected values, treats as already seeded.
    - If the expected ID exists with different values, raises a clear migration error.
    - If the expected name or short_name exists under a different ID, raises a clear migration error.
    - Never silently skips conflicting records or overwrites unrelated records.
    - Uses historical models and db_alias from schema_editor.connection.alias.
    """
    db_alias = schema_editor.connection.alias
    Ward = apps.get_model('complaints', 'Ward')
    Department = apps.get_model('complaints', 'Department')

    fixed_departments = [
        (1, 'Public Works Department', 'PWD'),
        (2, 'Solid Waste Management', 'SWM'),
        (3, 'Public Health Engineering', 'PHE'),
        (4, 'Electrical Department', 'ELEC'),
    ]

    for dept_id, name, short_name in fixed_departments:
        existing_by_id = Department.objects.using(db_alias).filter(id=dept_id).first()
        if existing_by_id:
            if existing_by_id.name == name and existing_by_id.short_name == short_name:
                # Exactly matches expected seed values
                continue
            raise RuntimeError(
                f"Seed Conflict: Department ID {dept_id} already exists with "
                f"name='{existing_by_id.name}', short_name='{existing_by_id.short_name}'. "
                f"Expected name='{name}', short_name='{short_name}'."
            )

        existing_by_name = Department.objects.using(db_alias).filter(name=name).first()
        if existing_by_name:
            raise RuntimeError(
                f"Seed Conflict: Department name '{name}' already exists under ID {existing_by_name.id}. "
                f"Expected ID {dept_id}."
            )

        existing_by_short = Department.objects.using(db_alias).filter(short_name=short_name).first()
        if existing_by_short:
            raise RuntimeError(
                f"Seed Conflict: Department short_name '{short_name}' already exists under ID {existing_by_short.id}. "
                f"Expected ID {dept_id}."
            )

        Department.objects.using(db_alias).create(
            id=dept_id,
            name=name,
            short_name=short_name
        )

    fixed_wards = [
        (1, 'Ward 1'),
        (2, 'Ward 2'),
        (3, 'Ward 3'),
        (4, 'Ward 4'),
    ]

    for ward_id, name in fixed_wards:
        existing_by_id = Ward.objects.using(db_alias).filter(id=ward_id).first()
        if existing_by_id:
            if existing_by_id.name == name:
                # Exactly matches expected seed values
                continue
            raise RuntimeError(
                f"Seed Conflict: Ward ID {ward_id} already exists with name='{existing_by_id.name}'. "
                f"Expected name='{name}'."
            )

        existing_by_name = Ward.objects.using(db_alias).filter(name=name).first()
        if existing_by_name:
            raise RuntimeError(
                f"Seed Conflict: Ward name '{name}' already exists under ID {existing_by_name.id}. "
                f"Expected ID {ward_id}."
            )

        Ward.objects.using(db_alias).create(
            id=ward_id,
            name=name
        )


def reverse_seed_fixed_wards_and_departments(apps, schema_editor):
    """
    Reverse operation: removes seeded fixed records using db_alias.
    """
    db_alias = schema_editor.connection.alias
    Ward = apps.get_model('complaints', 'Ward')
    Department = apps.get_model('complaints', 'Department')

    Department.objects.using(db_alias).filter(id__in=[1, 2, 3, 4]).delete()
    Ward.objects.using(db_alias).filter(id__in=[1, 2, 3, 4]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Ward',
            fields=[
                ('id', models.SmallIntegerField(help_text='Fixed Ward ID / Number (1 to 4)', primary_key=True, serialize=False)),
                ('name', models.CharField(help_text='Ward name (e.g., Ward 1, Ward 2, Ward 3, Ward 4)', max_length=100, unique=True)),
            ],
            options={
                'verbose_name': 'Ward',
                'verbose_name_plural': 'Wards',
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.SmallIntegerField(help_text='Fixed Department ID (1 to 4)', primary_key=True, serialize=False)),
                ('name', models.CharField(help_text='Department name (e.g., Public Works Department, Solid Waste Management)', max_length=100, unique=True)),
                ('short_name', models.CharField(help_text='Short code (e.g., PWD, SWM, PHE, ELEC)', max_length=20, unique=True)),
            ],
            options={
                'verbose_name': 'Department',
                'verbose_name_plural': 'Departments',
                'ordering': ['id'],
            },
        ),
        migrations.RunPython(
            seed_fixed_wards_and_departments,
            reverse_code=reverse_seed_fixed_wards_and_departments
        ),
    ]
