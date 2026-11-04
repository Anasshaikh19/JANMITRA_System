import os
import sys

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'resolveIT.settings.local')
import django
django.setup()

from accounts.models import User
from complaints.models import Department

def main():
    users = User.objects.all().order_by('id')
    departments = {d.id: d.name for d in Department.objects.all()}

    print("\n" + "=" * 90)
    print("                    JANMITRA - USER DATABASE (accounts_user)")
    print("=" * 90)
    print(f"{'ID':<4} {'Full Name':<32} {'Mobile / Identifier':<20} {'Role':<14} {'Department':<20}")
    print("-" * 90)

    for u in users:
        dept_name = departments.get(u.department_id, "None")
        mobile = u.mobile or u.email or "(Admin)"
        print(f"{u.id:<4} {u.full_name:<32} {mobile:<20} {u.role:<14} {dept_name:<20}")

    print("=" * 90)
    print(f"Total Users: {users.count()}")
    print("=" * 90 + "\n")

if __name__ == '__main__':
    main()
