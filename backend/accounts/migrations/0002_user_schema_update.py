# Generated for JANMITRA - Nagpur Municipal Corporation Civic Issue System

import accounts.managers
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def migrate_existing_users(apps, schema_editor):
    """
    Safely transitions existing user records to the new mobile-first schema:
    1. Preserves Administrator ID 1 with display name 'Janmitra Admin', role 'admin',
       active superuser flags, and leaves mobile as NULL (no fabricated credentials).
    2. Preserves legacy created_at timestamps into registered_at.
    3. Maps legacy text department into fixed Department IDs (1-4).
    4. Maps legacy ward_number (1-4) into fixed Ward IDs (1-4).
       If any legacy ward number is outside 1-4, it is NOT silently remapped.
    """
    User = apps.get_model('accounts', 'User')
    Ward = apps.get_model('complaints', 'Ward')
    Department = apps.get_model('complaints', 'Department')

    # Department text matching dictionary
    DEPT_KEYWORD_MAP = {
        'pwd': 1,
        'public works': 1,
        'roads': 1,
        'swm': 2,
        'solid waste': 2,
        'garbage': 2,
        'sanitation': 2,
        'phe': 3,
        'water': 3,
        'public health': 3,
        'drainage': 3,
        'elec': 4,
        'electrical': 4,
        'street lights': 4,
        'light': 4,
    }

    for user in User.objects.all():
        # 1. Preserve creation timestamp into registered_at
        if hasattr(user, 'created_at') and user.created_at:
            user.registered_at = user.created_at
        elif hasattr(user, 'date_joined') and user.date_joined:
            user.registered_at = user.date_joined
        else:
            user.registered_at = django.utils.timezone.now()

        # 2. Preserve & configure existing Administrator ID 1
        if user.id == 1:
            user.full_name = 'Janmitra Admin'
            user.role = 'admin'
            # Mobile remains None / NULL: no fake phone number is assigned
            user.mobile = None
        else:
            # For non-admin records, derive full_name from existing fields
            name_parts = []
            if getattr(user, 'first_name', None):
                name_parts.append(user.first_name.strip())
            if getattr(user, 'last_name', None):
                name_parts.append(user.last_name.strip())
            full_name = " ".join(name_parts).strip()
            if not full_name and getattr(user, 'username', None):
                full_name = user.username.strip()
            user.full_name = full_name if full_name else 'User'

            # Normalize role choices to valid lowercase
            legacy_role = (getattr(user, 'role', '') or '').upper()
            if legacy_role in ['ADMIN', 'NMC CENTRAL ADMIN']:
                user.role = 'admin'
            elif legacy_role in ['WARD_OFFICER', 'DEPT_OFFICER']:
                user.role = 'dept_officer'
            elif legacy_role in ['FIELD_WORKER', 'WORKER']:
                user.role = 'worker'
            else:
                user.role = 'citizen'

            # Set mobile from phone_number if present
            phone = getattr(user, 'phone_number', None)
            user.mobile = phone.strip() if phone and phone.strip() else None

        # 3. Map legacy text department to fixed Department IDs (1 to 4)
        legacy_dept = getattr(user, 'legacy_department', None)
        if legacy_dept and str(legacy_dept).strip():
            dept_text = str(legacy_dept).strip().lower()
            target_dept_id = None
            for keyword, dept_id in DEPT_KEYWORD_MAP.items():
                if keyword in dept_text:
                    target_dept_id = dept_id
                    break

            if target_dept_id:
                dept_obj = Department.objects.filter(id=target_dept_id).first()
                if dept_obj:
                    user.department = dept_obj

        # 4. Map legacy ward number to fixed Ward IDs (1 to 4)
        legacy_ward_num = getattr(user, 'legacy_ward_number', None)
        if legacy_ward_num is not None:
            try:
                ward_num = int(legacy_ward_num)
                # Only map if within valid fixed range 1-4; do not invent mappings
                if 1 <= ward_num <= 4:
                    ward_obj = Ward.objects.filter(id=ward_num).first()
                    if ward_obj:
                        user.ward = ward_obj
            except (ValueError, TypeError):
                pass

        user.save()


def reverse_migrate_existing_users(apps, schema_editor):
    """
    Reverse migration note:
    Because legacy columns such as 'username', 'address', and 'is_verified'
    are dropped during forward migration, reversing this schema transition
    will recreate those columns as empty/null; original discarded values
    cannot be restored from the forward migration state alone.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('complaints', '0002_ward_department'),
    ]

    operations = [
        # Step 1: Safely rename legacy columns so existing data is preserved
        migrations.RenameField(
            model_name='user',
            old_name='department',
            new_name='legacy_department',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='ward_number',
            new_name='legacy_ward_number',
        ),
        migrations.RenameField(
            model_name='user',
            old_name='ward_name',
            new_name='legacy_ward_name',
        ),

        # Step 2: Add new columns for the modern mobile-based User model
        migrations.AddField(
            model_name='user',
            name='full_name',
            field=models.CharField(
                default='',
                help_text='Full name of the user',
                max_length=100
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='user',
            name='mobile',
            field=models.CharField(
                blank=True,
                help_text='Primary 10-digit mobile number used for login and authentication',
                max_length=15,
                null=True,
                unique=True
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='registered_at',
            field=models.DateTimeField(
                default=django.utils.timezone.now,
                help_text='Timestamp of registration'
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='user',
            name='designation',
            field=models.CharField(
                blank=True,
                help_text='Designation for field workers or department staff',
                max_length=100
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='employee_id',
            field=models.CharField(
                blank=True,
                help_text='Official employee ID for workers and officials',
                max_length=50,
                null=True,
                unique=True
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='status',
            field=models.CharField(
                choices=[('active', 'Active'), ('inactive', 'Inactive'), ('on_leave', 'On Leave')],
                default='active',
                help_text='Account / duty status',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='fcm_token',
            field=models.TextField(
                blank=True,
                help_text='Firebase Cloud Messaging push notification token'
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='ward',
            field=models.ForeignKey(
                blank=True,
                help_text='Associated municipal ward',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='users',
                to='complaints.ward'
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='department',
            field=models.ForeignKey(
                blank=True,
                help_text='Associated municipal department',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='users',
                to='complaints.department'
            ),
        ),

        # Step 3: Run Python data migration to safely migrate existing records
        migrations.RunPython(
            migrate_existing_users,
            reverse_code=reverse_migrate_existing_users
        ),

        # Step 4: Clean up deprecated legacy columns
        migrations.RemoveField(
            model_name='user',
            name='username',
        ),
        migrations.RemoveField(
            model_name='user',
            name='first_name',
        ),
        migrations.RemoveField(
            model_name='user',
            name='last_name',
        ),
        migrations.RemoveField(
            model_name='user',
            name='phone_number',
        ),
        migrations.RemoveField(
            model_name='user',
            name='legacy_ward_number',
        ),
        migrations.RemoveField(
            model_name='user',
            name='legacy_ward_name',
        ),
        migrations.RemoveField(
            model_name='user',
            name='legacy_department',
        ),
        migrations.RemoveField(
            model_name='user',
            name='is_verified',
        ),
        migrations.RemoveField(
            model_name='user',
            name='address',
        ),
        migrations.RemoveField(
            model_name='user',
            name='created_at',
        ),
        migrations.RemoveField(
            model_name='user',
            name='updated_at',
        ),
        migrations.RemoveField(
            model_name='user',
            name='date_joined',
        ),

        # Step 5: Update model options, managers, and altered fields
        migrations.AlterModelOptions(
            name='user',
            options={
                'ordering': ['-registered_at'],
                'verbose_name': 'User',
                'verbose_name_plural': 'Users'
            },
        ),
        migrations.AlterModelManagers(
            name='user',
            managers=[
                ('objects', accounts.managers.CustomUserManager()),
            ],
        ),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('citizen', 'Citizen'),
                    ('worker', 'Worker'),
                    ('dept_officer', 'Department Officer'),
                    ('admin', 'Admin')
                ],
                default='citizen',
                help_text='Role in civic issue management',
                max_length=20
            ),
        ),
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(
                blank=True,
                help_text='Optional contact email address',
                max_length=254
            ),
        ),
        migrations.AlterField(
            model_name='user',
            name='is_active',
            field=models.BooleanField(
                default=True,
                help_text='Designates whether this user account is active'
            ),
        ),
        migrations.AlterField(
            model_name='user',
            name='is_staff',
            field=models.BooleanField(
                default=False,
                help_text='Designates whether the user can access the Django admin panel'
            ),
        ),
        migrations.AlterField(
            model_name='user',
            name='registered_at',
            field=models.DateTimeField(
                auto_now_add=True,
                help_text='Timestamp of registration'
            ),
        ),
    ]
