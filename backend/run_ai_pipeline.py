"""
JANMITRA - Civic Grievance AI Pipeline Inspector & Manual Runner.

Usage:
    python run_ai_pipeline.py                     # Runs AI on the latest submitted complaint
    python run_ai_pipeline.py <complaint_id>       # Runs AI on specific UUID or tracking ID
    python run_ai_pipeline.py --list              # Lists all complaints and their AI statuses
"""

import os
import sys
import django

# Initialize Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'resolveIT.settings.local')
django.setup()

from complaints.models import Complaint
from complaints.tasks import process_complaint_ai
from complaints.routing import route_complaint


def list_complaints():
    complaints = Complaint.objects.select_related('citizen', 'category', 'department', 'ward').order_by('-submitted_at')[:15]
    print("\n" + "=" * 90)
    print(f"{'Tracking ID':<18} {'Status':<16} {'Category':<22} {'Dept':<8} {'Score':<8} {'Citizen'}")
    print("=" * 90)
    for c in complaints:
        cat_name = c.category.name if c.category else 'N/A'
        dept_name = c.department.short_name if c.department else '-'
        citizen_info = c.citizen.mobile if c.citizen else 'Unknown'
        print(f"{c.tracking_id:<18} {c.status:<16} {cat_name:<22} {dept_name:<8} {str(c.priority_score):<8} {citizen_info}")
    print("=" * 90 + "\n")


def inspect_and_run(complaint_identifier=None):
    if complaint_identifier:
        # Search by UUID or tracking ID
        complaint = (
            Complaint.objects.filter(tracking_id__iexact=complaint_identifier).first() or
            Complaint.objects.filter(id__iexact=complaint_identifier).first()
        )
        if not complaint:
            print(f"[-] Complaint '{complaint_identifier}' not found in database.")
            return
    else:
        # Pick the latest submitted or unvalidated complaint
        complaint = (
            Complaint.objects.filter(status='SUBMITTED').order_by('-submitted_at').first() or
            Complaint.objects.order_by('-submitted_at').first()
        )
        if not complaint:
            print("[-] No complaints found in the database.")
            return

    print("\n" + "=" * 70)
    print("  JANMITRA AI PIPELINE EXECUTION ENGINE")
    print("=" * 70)
    print(f"Complaint ID   : {complaint.id}")
    print(f"Tracking ID    : {complaint.tracking_id}")
    print(f"Citizen        : {complaint.citizen.full_name} ({complaint.citizen.mobile})")
    print(f"Ward           : {complaint.ward.name if complaint.ward else 'None'}")
    print(f"Category       : {complaint.category.name if complaint.category else 'None'}")
    print(f"Title          : {complaint.title}")
    print(f"Description    : {complaint.description}")
    print(f"Initial Status : {complaint.status}")
    print(f"Initial Dept   : {complaint.department.short_name if complaint.department else 'Unassigned'}")
    print(f"Images count   : {complaint.images.count()}")
    print("-" * 70)
    print("[*] Running AI Processing (Image Forensics, Anti-Spoof, YOLOv8, Priority)...")

    # Run AI pipeline
    ai_result = process_complaint_ai(str(complaint.id))
    print(f"[+] AI Process Result: {ai_result}")

    # Run Routing
    print("[*] Running Automated Municipal Department Routing...")
    route_result = route_complaint(str(complaint.id))
    print(f"[+] Routing Result   : {route_result.get('message', route_result)}")

    # Refresh
    complaint.refresh_from_db()
    print("-" * 70)
    print("  POST-PROCESSING PIPELINE STATE")
    print("-" * 70)
    print(f"Final Status   : {complaint.status}  {'[VERIFIED OK]' if complaint.status in ['Validated', 'ASSIGNED', 'IN_PROGRESS', 'WORK_DONE', 'CLOSED'] else '[NEEDS REVIEW]'}")
    print(f"Priority Score : {complaint.priority_score}/100.0 (Priority Level: {complaint.priority_level})")
    print(f"Routed Dept    : {complaint.department.name if complaint.department else 'Unassigned'}")
    print(f"Assigned Worker: {complaint.assigned_worker.full_name if complaint.assigned_worker else 'Awaiting Officer Dispatch'}")
    print("=" * 70 + "\n")


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--list' in args:
        list_complaints()
    elif len(args) > 0:
        inspect_and_run(args[0])
    else:
        inspect_and_run()
