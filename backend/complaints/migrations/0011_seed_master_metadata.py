# Generated for JANMITRA - Nagpur Municipal Corporation Civic Issue System

from django.db import migrations


def seed_master_metadata(apps, schema_editor):
    """
    Idempotent master metadata seed migration for JANMITRA:
    1. 4 Departments: PWD, SWM, PHE, ELEC
    2. 4 Wards: Ward 1 (Central), Ward 2 (North), Ward 3 (East), Ward 4 (West)
    3. 4 Master Categories:
       - Roads & Infrastructure -> PWD (ID 1)
       - Garbage & Waste -> Solid Waste Management (ID 2)
       - Water & Drainage -> Public Health Engineering (ID 3)
       - Street Lighting -> Electrical Department (ID 4)

    Uses historical models via apps.get_model().
    Strictly checks for conflicts using stable identifiers (ID and short_name).
    Preserves all existing complaints, accounts, and relationships.
    """
    db_alias = schema_editor.connection.alias
    Department = apps.get_model('complaints', 'Department')
    Ward = apps.get_model('complaints', 'Ward')
    Category = apps.get_model('complaints', 'Category')

    # -------------------------------------------------------------
    # 1. Seed / Verify 4 Departments
    # -------------------------------------------------------------
    departments_data = [
        (1, 'Public Works Department', 'PWD'),
        (2, 'Solid Waste Management', 'SWM'),
        (3, 'Public Health Engineering', 'PHE'),
        (4, 'Electrical Department', 'ELEC'),
    ]

    for dept_id, name, short_name in departments_data:
        dept_by_id = Department.objects.using(db_alias).filter(id=dept_id).first()
        dept_by_short = Department.objects.using(db_alias).filter(short_name=short_name).first()

        if dept_by_id and dept_by_short and dept_by_id.id != dept_by_short.id:
            raise RuntimeError(
                f"Seed Conflict: Department short_name '{short_name}' exists under ID {dept_by_short.id}, "
                f"which conflicts with expected ID {dept_id}."
            )

        if dept_by_id:
            if dept_by_id.short_name != short_name and dept_by_short:
                raise RuntimeError(
                    f"Seed Conflict: Department ID {dept_id} has short_name='{dept_by_id.short_name}', "
                    f"but target short_name '{short_name}' is already used by ID {dept_by_short.id}."
                )
            changed = False
            if dept_by_id.name != name:
                dept_by_id.name = name
                changed = True
            if dept_by_id.short_name != short_name:
                dept_by_id.short_name = short_name
                changed = True
            if changed:
                dept_by_id.save(using=db_alias)
        elif dept_by_short:
            raise RuntimeError(
                f"Seed Conflict: Department short_name '{short_name}' exists under ID {dept_by_short.id}, "
                f"expected ID {dept_id}."
            )
        else:
            Department.objects.using(db_alias).create(
                id=dept_id,
                name=name,
                short_name=short_name
            )

    # -------------------------------------------------------------
    # 2. Seed / Verify 4 Wards
    # -------------------------------------------------------------
    wards_data = [
        (1, 'Ward 1'),
        (2, 'Ward 2'),
        (3, 'Ward 3'),
        (4, 'Ward 4'),
    ]

    for ward_id, ward_name in wards_data:
        ward_by_id = Ward.objects.using(db_alias).filter(id=ward_id).first()
        ward_by_name = Ward.objects.using(db_alias).filter(name=ward_name).first()

        if ward_by_id and ward_by_name and ward_by_id.id != ward_by_name.id:
            raise RuntimeError(
                f"Seed Conflict: Ward name '{ward_name}' exists under ID {ward_by_name.id}, "
                f"which conflicts with expected ID {ward_id}."
            )

        if ward_by_id:
            if not ward_by_id.name:
                ward_by_id.name = ward_name
                ward_by_id.save(using=db_alias)
        elif ward_by_name:
            raise RuntimeError(
                f"Seed Conflict: Ward name '{ward_name}' exists under ID {ward_by_name.id}, "
                f"expected ID {ward_id}."
            )
        else:
            Ward.objects.using(db_alias).create(
                id=ward_id,
                name=ward_name
            )

    # -------------------------------------------------------------
    # 3. Seed / Verify 4 Categories
    # -------------------------------------------------------------
    categories_data = [
        (1, 'Roads & Infrastructure', 1),
        (2, 'Garbage & Waste', 2),
        (3, 'Water & Drainage', 3),
        (4, 'Street Lighting', 4),
    ]

    for cat_id, cat_name, dept_id in categories_data:
        dept = Department.objects.using(db_alias).filter(id=dept_id).first()
        if not dept:
            raise RuntimeError(
                f"Seed Conflict: Responsible department ID {dept_id} not found for category '{cat_name}'."
            )

        cat_by_id = Category.objects.using(db_alias).filter(id=cat_id).first()
        cat_by_name = Category.objects.using(db_alias).filter(name=cat_name).first()

        if cat_by_id and cat_by_name and cat_by_id.id != cat_by_name.id:
            raise RuntimeError(
                f"Seed Conflict: Category name '{cat_name}' exists under ID {cat_by_name.id}, "
                f"conflicting with expected ID {cat_id}."
            )

        if cat_by_id:
            changed = False
            if cat_by_id.name != cat_name:
                other_with_name = Category.objects.using(db_alias).filter(name=cat_name).exclude(id=cat_id).first()
                if other_with_name:
                    raise RuntimeError(
                        f"Seed Conflict: Cannot rename Category {cat_id} to '{cat_name}' because "
                        f"ID {other_with_name.id} already has that name."
                    )
                cat_by_id.name = cat_name
                changed = True
            if cat_by_id.department_id != dept_id:
                cat_by_id.department = dept
                changed = True
            if changed:
                cat_by_id.save(using=db_alias)
        elif cat_by_name:
            raise RuntimeError(
                f"Seed Conflict: Category name '{cat_name}' exists under ID {cat_by_name.id}, "
                f"expected ID {cat_id}."
            )
        else:
            Category.objects.using(db_alias).create(
                id=cat_id,
                name=cat_name,
                department=dept
            )


def reverse_seed_master_metadata(apps, schema_editor):
    """
    Reverse migration:
    Non-destructive reverse migration to preserve complaints, user accounts,
    and foreign-key integrity.
    """
    # Safe reverse: do not delete pre-existing or referenced master records.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0010_complaint_complaint_dept_ward_status_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_master_metadata, reverse_code=reverse_seed_master_metadata),
    ]
