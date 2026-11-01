"""
Django management command alias for seeding demo accounts and master data.
Supports: 'python manage.py seed_demo_accounts'
"""

from complaints.management.commands.seed_demo import Command as SeedDemoCommand


class Command(SeedDemoCommand):
    help = 'Seeds canonical demo data for JANMITRA: 4 Depts, 4 Wards, 4 Categories, and demo users for all roles.'
