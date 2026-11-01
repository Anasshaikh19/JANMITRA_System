"""
Automated complaint routing engine for JANMITRA (Nagpur Municipal Corporation).

Maps civic issue categories to responsible municipal departments and audits transitions.
"""

import logging
from django.core.exceptions import ValidationError
from django.db import transaction
from .models import Complaint, Department, StatusHistory

logger = logging.getLogger('complaints.routing')

# Canonical Category to Department mapping:
# - Category ID 1: Roads & Infrastructure -> PWD (Department ID 1)
# - Category ID 2: Garbage & Waste Management -> Solid Waste Management (Department ID 2)
# - Category ID 3: Water & Drainage -> Public Health Engineering (Department ID 3)
# - Category ID 4: Street Lighting & Electrical -> Electrical Department (Department ID 4)
CATEGORY_DEPARTMENT_MAPPING = {
    1: 1,  # Roads & Infrastructure -> PWD (ID 1)
    2: 2,  # Garbage & Waste Management -> Solid Waste Management (ID 2)
    3: 3,  # Water & Drainage -> Public Health Engineering (ID 3)
    4: 4,  # Street Lighting & Electrical -> Electrical Department (ID 4)
}


def get_department_for_category(category_id):
    """
    Returns the corresponding Department model instance for a category ID.

    Mapping:
      - Category 1 (Roads & Infrastructure) -> Department 1 (PWD)
      - Category 2 (Garbage & Waste Management) -> Department 2 (Solid Waste Management)
      - Category 3 (Water & Drainage) -> Department 3 (Public Health Engineering)
      - Category 4 (Street Lighting & Electrical) -> Department 4 (Electrical Department)

    Returns None for missing, invalid, or unsupported category IDs.
    Does not silently assign a default department when category is unknown.
    """
    if category_id is None:
        return None

    try:
        cat_id = int(category_id)
    except (ValueError, TypeError):
        logger.warning(f"Invalid category ID provided to routing: {category_id}")
        return None

    dept_id = CATEGORY_DEPARTMENT_MAPPING.get(cat_id)
    if dept_id is None:
        logger.warning(f"Unsupported category ID for routing: {cat_id}")
        return None

    return Department.objects.filter(id=dept_id).first()


def route_complaint(complaint_id):
    """
    Determines and assigns the responsible municipal department for a complaint.

    Lifecycle & Status Decision:
    - In the existing Complaint.Status choices:
        SUBMITTED, ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED, CLOSED,
        REOPENED, PENDING_VALIDATION, VALIDATED, INVALID, WORK_DONE, IN_PROGRESS_ALT.
    - 'Routed' is not defined in Complaint.Status choices or database migrations.
    - The established project status following successful AI validation is 'Validated'.
      During automated routing, complaints retain their valid lifecycle status (e.g. 'Validated')
      while complaint.department is explicitly updated to the mapped Department.
    - An audit entry is recorded in StatusHistory with details of the assigned department.
    - Repeated executions are handled idempotently without creating redundant StatusHistory entries.

    Returns:
        dict: Result with 'success', 'complaint_id', 'department_id', and status details.
    """
    if not complaint_id:
        logger.error("route_complaint called with empty complaint_id.")
        return {
            'success': False,
            'error': 'complaint_id is required.',
            'complaint_id': None,
        }

    try:
        complaint = Complaint.objects.select_related('category', 'department').get(id=complaint_id)
    except (Complaint.DoesNotExist, ValidationError, ValueError, TypeError) as exc:
        logger.error(f"Complaint '{complaint_id}' not found for routing: {exc}")
        return {
            'success': False,
            'error': f"Complaint with id '{complaint_id}' not found.",
            'complaint_id': str(complaint_id),
        }

    if not complaint.category_id:
        logger.error(f"Complaint {complaint.id} has no category assigned.")
        return {
            'success': False,
            'error': f"Complaint '{complaint.id}' has no category assigned.",
            'complaint_id': str(complaint.id),
        }

    department = get_department_for_category(complaint.category_id)
    if not department:
        logger.warning(
            f"Could not route complaint {complaint.id}: "
            f"Unsupported category ID {complaint.category_id}."
        )
        return {
            'success': False,
            'error': f"Unsupported or unmapped category ID '{complaint.category_id}'.",
            'complaint_id': str(complaint.id),
            'category_id': complaint.category_id,
        }

    # Check for repeated/idempotent execution
    already_assigned = complaint.department_id == department.id
    already_has_history = StatusHistory.objects.filter(
        complaint=complaint,
        note__icontains="Automated routing"
    ).exists()

    if already_assigned and already_has_history:
        logger.info(
            f"Complaint {complaint.tracking_id} ({complaint.id}) already routed "
            f"to department {department.short_name}. Skipping redundant update."
        )
        return {
            'success': True,
            'already_routed': True,
            'complaint_id': str(complaint.id),
            'tracking_id': complaint.tracking_id,
            'department_id': department.id,
            'department_name': department.name,
            'department_short_name': department.short_name,
            'status': complaint.status,
            'message': f"Complaint {complaint.tracking_id} already routed to {department.short_name}."
        }

    with transaction.atomic():
        old_status = complaint.status
        complaint.department = department
        new_status = complaint.status
        complaint.save(update_fields=['department', 'updated_at'])

        StatusHistory.objects.create(
            complaint=complaint,
            old_status=old_status,
            new_status=new_status,
            note=f"Automated routing assigned complaint to {department.name} ({department.short_name})"
        )

    logger.info(
        f"Successfully routed complaint {complaint.tracking_id} ({complaint.id}) "
        f"to {department.short_name} (ID {department.id})."
    )
    return {
        'success': True,
        'already_routed': False,
        'complaint_id': str(complaint.id),
        'tracking_id': complaint.tracking_id,
        'department_id': department.id,
        'department_name': department.name,
        'department_short_name': department.short_name,
        'status': new_status,
        'message': f"Complaint {complaint.tracking_id} successfully routed to {department.short_name}."
    }
