"""
Django management command to seed demo data for JANMITRA.

Creates:
- 4 Municipal Departments (PWD, SWM, PHE, ELEC)
- 4 Municipal Wards (Ward 1, Ward 2, Ward 3, Ward 4)
- 4 Canonical Categories mapped to departments
- 1 Central Admin User
- 4 Department Officers (one per department)
- 16 Field Workers (one per department + ward combination)
- 4 Demo Citizens (one per ward)
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from complaints.models import Department, Ward, Category

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds canonical demo data for JANMITRA: 4 Depts, 4 Wards, 4 Categories, and demo users for all 4 team roles.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default='Demo@12345',
            help='Default password for newly created demo users (default: Demo@12345)'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        default_pwd = options['password']
        self.stdout.write(self.style.MIGRATE_HEADING("=== Seeding JANMITRA Demo Data ==="))

        # ---------------------------------------------------------
        # 1. 4 Departments
        # ---------------------------------------------------------
        departments_data = [
            {'id': 1, 'name': 'Public Works Dept', 'short_name': 'PWD'},
            {'id': 2, 'name': 'Solid Waste Mgmt', 'short_name': 'SWM'},
            {'id': 3, 'name': 'Public Health Engineering / Water Works', 'short_name': 'PHE'},
            {'id': 4, 'name': 'Electrical Dept', 'short_name': 'ELEC'},
        ]
        created_depts = []
        for d in departments_data:
            dept, _ = Department.objects.update_or_create(
                id=d['id'],
                defaults={'name': d['name'], 'short_name': d['short_name']}
            )
            created_depts.append(dept)
        self.stdout.write(self.style.SUCCESS(f"[OK] Seeded 4 Departments: {[d.short_name for d in created_depts]}"))

        # ---------------------------------------------------------
        # 2. 4 Wards
        # ---------------------------------------------------------
        wards_data = [
            {'id': 1, 'name': 'Ward 1'},
            {'id': 2, 'name': 'Ward 2'},
            {'id': 3, 'name': 'Ward 3'},
            {'id': 4, 'name': 'Ward 4'},
        ]
        created_wards = []
        for w in wards_data:
            ward, _ = Ward.objects.update_or_create(
                id=w['id'],
                defaults={'name': w['name']}
            )
            created_wards.append(ward)
        self.stdout.write(self.style.SUCCESS(f"[OK] Seeded 4 Wards: {[w.name for w in created_wards]}"))

        # ---------------------------------------------------------
        # 3. 4 Categories
        # ---------------------------------------------------------
        categories_data = [
            {'id': 1, 'name': 'Roads & Infrastructure', 'dept_id': 1},
            {'id': 2, 'name': 'Garbage & Waste', 'dept_id': 2},
            {'id': 3, 'name': 'Water & Drainage', 'dept_id': 3},
            {'id': 4, 'name': 'Street Lighting', 'dept_id': 4},
        ]
        created_cats = []
        for c in categories_data:
            cat, _ = Category.objects.update_or_create(
                id=c['id'],
                defaults={'name': c['name'], 'department_id': c['dept_id']}
            )
            created_cats.append(cat)
        # Prune legacy prototype categories beyond the 4 canonical categories
        Category.objects.filter(id__gt=4).delete()
        self.stdout.write(self.style.SUCCESS(f"[OK] Seeded 4 Categories: {[c.name for c in created_cats]}"))

        # ---------------------------------------------------------
        # 4. 1 Admin User
        # ---------------------------------------------------------
        admin_user = User.objects.filter(email='admin@janmitra.gov.in').first()
        if not admin_user:
            admin_user = User.objects.filter(role=User.Role.ADMIN).first()
        if not admin_user:
            admin_user = User.objects.create(
                full_name='Janmitra Admin',
                email='admin@janmitra.gov.in',
                role=User.Role.ADMIN,
                is_staff=True,
                is_superuser=True,
                is_active=True
            )
            admin_user.set_password(default_pwd)
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f"[OK] Created Central Admin (ID {admin_user.id}, email: {admin_user.email})"))
        else:
            admin_user.role = User.Role.ADMIN
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.is_active = True
            admin_user.save()
            self.stdout.write(self.style.SUCCESS(f"[OK] Preserved Central Admin (ID {admin_user.id}, email: {admin_user.email})"))

        # Synchronize PostgreSQL user sequence if on PostgreSQL
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT setval(pg_get_serial_sequence('accounts_user', 'id'), COALESCE(MAX(id), 1)) FROM accounts_user;"
                )

        # ---------------------------------------------------------
        # 5. 4 Department Officers (one per department)
        # ---------------------------------------------------------
        officers_data = [
            {
                'mobile': '9800000001',
                'full_name': 'Rajesh Kumar (PWD Officer)',
                'email': 'pwd.officer@janmitra.gov.in',
                'dept_id': 1,
                'designation': 'Executive Engineer (PWD)',
                'employee_id': 'NMC-OFF-PWD'
            },
            {
                'mobile': '9800000002',
                'full_name': 'Sunita Deshmukh (SWM Officer)',
                'email': 'swm.officer@janmitra.gov.in',
                'dept_id': 2,
                'designation': 'Sanitation Chief Inspector',
                'employee_id': 'NMC-OFF-SWM'
            },
            {
                'mobile': '9800000003',
                'full_name': 'Amitabh Joshi (PHE Officer)',
                'email': 'phe.officer@janmitra.gov.in',
                'dept_id': 3,
                'designation': 'Chief Water Works Engineer',
                'employee_id': 'NMC-OFF-PHE'
            },
            {
                'mobile': '9800000004',
                'full_name': 'Pooja Sharma (Electrical Officer)',
                'email': 'elec.officer@janmitra.gov.in',
                'dept_id': 4,
                'designation': 'Superintending Electrical Engineer',
                'employee_id': 'NMC-OFF-ELEC'
            },
        ]
        created_officers = []
        for off in officers_data:
            u, created = User.objects.update_or_create(
                mobile=off['mobile'],
                defaults={
                    'full_name': off['full_name'],
                    'email': off['email'],
                    'department_id': off['dept_id'],
                    'designation': off['designation'],
                    'employee_id': off['employee_id'],
                    'role': User.Role.DEPT_OFFICER,
                    'is_staff': True,
                    'is_active': True,
                    'status': User.Status.ACTIVE
                }
            )
            if created or not u.has_usable_password():
                u.set_password(default_pwd)
                u.save()
            created_officers.append(u)
        self.stdout.write(self.style.SUCCESS(f"[OK] Seeded 4 Department Officers: {[o.full_name for o in created_officers]}"))

        # ---------------------------------------------------------
        # 6. 16 Field Workers (4 departments x 4 wards)
        # ---------------------------------------------------------
        dept_worker_titles = {
            1: ('Road Maintenance Specialist', 'NMC-WRK-PWD'),
            2: ('Sanitation Field Crew', 'NMC-WRK-SWM'),
            3: ('Water & Drainage Technician', 'NMC-WRK-PHE'),
            4: ('Streetlight Electrician', 'NMC-WRK-ELEC'),
        }
        created_workers = []
        for dept_id in range(1, 5):
            for ward_id in range(1, 5):
                mobile = f"9810{dept_id:02d}{ward_id:04d}"
                desig_title, emp_prefix = dept_worker_titles[dept_id]
                emp_id = f"{emp_prefix}-W{ward_id}"
                dept_short = Department.objects.get(id=dept_id).short_name
                worker_name = f"Worker {dept_short} Ward {ward_id}"

                w, created = User.objects.update_or_create(
                    mobile=mobile,
                    defaults={
                        'full_name': worker_name,
                        'email': f"worker.{dept_short.lower()}.w{ward_id}@janmitra.gov.in",
                        'department_id': dept_id,
                        'ward_id': ward_id,
                        'designation': desig_title,
                        'employee_id': emp_id,
                        'role': User.Role.WORKER,
                        'is_staff': False,
                        'is_active': True,
                        'status': User.Status.ACTIVE
                    }
                )
                if created or not w.has_usable_password():
                    w.set_password(default_pwd)
                    w.save()
                created_workers.append(w)
        self.stdout.write(self.style.SUCCESS(f"[OK] Seeded 16 Field Workers (4 departments x 4 wards)"))

        # ---------------------------------------------------------
        # 7. 4 Demo Citizens (one per ward)
        # ---------------------------------------------------------
        citizens_data = [
            {'mobile': '9820000001', 'full_name': 'Aarav Mehta (Citizen W1)', 'email': 'aarav.w1@example.com', 'ward_id': 1},
            {'mobile': '9820000002', 'full_name': 'Sneha Nair (Citizen W2)', 'email': 'sneha.w2@example.com', 'ward_id': 2},
            {'mobile': '9820000003', 'full_name': 'Rohan Verma (Citizen W3)', 'email': 'rohan.w3@example.com', 'ward_id': 3},
            {'mobile': '9820000004', 'full_name': 'Priyanka Ingle (Citizen W4)', 'email': 'priyanka.w4@example.com', 'ward_id': 4},
        ]
        created_citizens = []
        for cit in citizens_data:
            c, created = User.objects.update_or_create(
                mobile=cit['mobile'],
                defaults={
                    'full_name': cit['full_name'],
                    'email': cit['email'],
                    'ward_id': cit['ward_id'],
                    'role': User.Role.CITIZEN,
                    'is_staff': False,
                    'is_active': True,
                    'status': User.Status.ACTIVE
                }
            )
            if created or not c.has_usable_password():
                c.set_password(default_pwd)
                c.save()
            created_citizens.append(c)
        self.stdout.write(self.style.SUCCESS(f"[OK] Seeded 4 Demo Citizens (one per ward)"))

        # ---------------------------------------------------------
        # Summary Table
        # ---------------------------------------------------------
        self.stdout.write(self.style.SUCCESS("\n=== DEMO SEEDING COMPLETE ==="))
        self.stdout.write(f"Default password for demo accounts: {default_pwd}")
        self.stdout.write("Roles Available:")
        self.stdout.write(f"  * Admin (1):          email='{admin_user.email}'")
        self.stdout.write(f"  * Dept Officers (4):   mobiles=9800000001 - 9800000004")
        self.stdout.write(f"  * Field Workers (16):  mobiles=9810010001 - 9810040004")
        self.stdout.write(f"  * Citizens (4):        mobiles=9820000001 - 9820000004 (Wards 1-4)")
