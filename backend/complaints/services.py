"""
Authoritative service layer for civic complaints and SLA breach tracking.
(JANMITRA - Nagpur Municipal Corporation)

SLA Targets:
- Critical: 24 hours
- High: 48 hours
- Medium: 72 hours
- Low: 168 hours (7 days)

Reopened Complaint Policy:
-------------------------
When a citizen rejects resolution verification, the complaint transitions to
'Reopened' status (Complaint.Status.REOPENED). In accordance with NMC municipal
governance regulations, reopening returns the complaint to active field processing
and does NOT reset or extend the SLA resolution clock. The authoritative deadline
remains anchored to the citizen's original complaint submission timestamp
(submitted_at + SLA_TARGET[priority]). Because a reopened complaint is active and
non-terminal, if the current time strictly exceeds this deadline (now > deadline),
it is classified as overdue and prioritized on administrative dashboards.

Unsupported & Missing Priority Policy:
-------------------------------------
The system strictly prohibits assigning a silent fallback SLA to complaints with
missing (None / empty) or unrecognized priority levels. Such complaints return None
for their SLA target and deadline, and evaluate to False for is_overdue, preventing
unwarranted false-positive breach notifications while maintaining data integrity.

Terminal Status Policy:
----------------------
Complaints with terminal statuses ('Closed', 'RESOLVED', 'REJECTED', 'Invalid')
are concluded cases and are explicitly excluded from overdue tracking. A complaint
is overdue only when elapsed time is strictly greater than its SLA target and its
status remains non-terminal.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
from django.db.models import Q, QuerySet
from django.utils import timezone


# Authoritative SLA Targets
SLA_TARGETS: Dict[str, timedelta] = {
    'CRITICAL': timedelta(hours=24),
    'HIGH': timedelta(hours=48),
    'MEDIUM': timedelta(hours=72),
    'LOW': timedelta(days=7),  # 168 hours
}

SLA_TARGETS_HOURS: Dict[str, int] = {
    'CRITICAL': 24,
    'HIGH': 48,
    'MEDIUM': 72,
    'LOW': 168,
}

# Supported priority levels set for quick validation
SUPPORTED_PRIORITIES = set(SLA_TARGETS.keys())

# Terminal status strings across case variations and legacy choices
TERMINAL_STATUSES: List[str] = [
    'Closed',
    'CLOSED',
    'RESOLVED',
    'Resolved',
    'REJECTED',
    'Rejected',
    'Invalid',
    'INVALID',
]

TERMINAL_STATUS_SET = {s.upper() for s in TERMINAL_STATUSES}


def get_sla_target(priority: Optional[str]) -> Optional[timedelta]:
    """
    Return timedelta SLA target for a given priority level.
    Returns None if priority is missing, empty, or unsupported (never defaults silently).
    """
    if not priority:
        return None
    return SLA_TARGETS.get(str(priority).strip().upper(), None)


def get_sla_target_hours(priority: Optional[str]) -> Optional[int]:
    """
    Return integer hours SLA target for a given priority level.
    Returns None if priority is missing, empty, or unsupported (never defaults silently).
    """
    if not priority:
        return None
    return SLA_TARGETS_HOURS.get(str(priority).strip().upper(), None)


def get_sla_deadline(complaint) -> Optional[datetime]:
    """
    Compute authoritative SLA resolution deadline for a complaint.
    Returns None if submitted_at or priority is missing or unsupported.
    """
    if not complaint or not getattr(complaint, 'submitted_at', None):
        return None
    delta = get_sla_target(getattr(complaint, 'priority_level', None))
    if not delta:
        return None
    return complaint.submitted_at + delta


def is_complaint_overdue(complaint, as_of: Optional[datetime] = None) -> bool:
    """
    Authoritative check for whether a complaint is currently overdue.
    Guaranteed to agree 100% with get_overdue_complaints().

    Rules:
    - If complaint is None or submitted_at is None, returns False.
    - If status is terminal (Closed, Resolved, Rejected, Invalid), returns False.
    - If priority is missing or unsupported, returns False (no silent default SLA).
    - A complaint is overdue only when elapsed time is strictly greater than its SLA.
      Exactly at the deadline is not overdue (returns False).
    """
    if not complaint:
        return False

    submitted_at = getattr(complaint, 'submitted_at', None)
    if not submitted_at:
        return False

    status_str = str(getattr(complaint, 'status', '')).strip().upper()
    if status_str in TERMINAL_STATUS_SET:
        return False

    deadline = get_sla_deadline(complaint)
    if not deadline:
        return False

    now = as_of or timezone.now()
    # A complaint is overdue only when elapsed time is strictly greater than its SLA
    return now > deadline


def get_overdue_complaints(
    dept_id: Optional[Union[int, str]] = None,
    ward_id: Optional[Union[int, str]] = None,
    queryset: Optional[QuerySet] = None,
    as_of: Optional[datetime] = None,
) -> QuerySet:
    """
    Returns only complaints that are currently overdue and not terminal.

    SLA Targets:
    - Critical: 24 hours
    - High: 48 hours
    - Medium: 72 hours
    - Low: 168 hours (7 days)

    Args:
        dept_id: Optional department ID to filter by. Must be a valid positive integer.
                 Raises ValueError on malformed/non-positive ID.
                 Raises Department.DoesNotExist if department does not exist.
        ward_id: Optional ward ID to filter by. Must be a valid positive integer.
                 Raises ValueError on malformed/non-positive ID.
                 Raises Ward.DoesNotExist if ward does not exist.
        queryset: Optional base Complaint QuerySet to filter.
        as_of: Optional reference timestamp (defaults to timezone.now()).

    Returns:
        QuerySet of active, non-terminal Complaint instances exceeding their SLA target,
        ordered by submitted_at ASC (oldest submitted first).
    """
    from complaints.models import Complaint, Department, Ward

    now = as_of or timezone.now()

    if queryset is not None:
        qs = queryset
    else:
        qs = Complaint.objects.all()

    # Department validation & filtering
    if dept_id is not None:
        try:
            dept_int = int(dept_id)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid department ID: '{dept_id}'. Department ID must be a positive integer.")
        if dept_int <= 0:
            raise ValueError(f"Invalid department ID: '{dept_id}'. Department ID must be a positive integer greater than zero.")
        if not Department.objects.filter(id=dept_int).exists():
            raise Department.DoesNotExist(f"Department with ID {dept_int} does not exist.")
        qs = qs.filter(department_id=dept_int)

    # Ward validation & filtering
    if ward_id is not None:
        try:
            ward_int = int(ward_id)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid ward ID: '{ward_id}'. Ward ID must be a positive integer.")
        if ward_int <= 0:
            raise ValueError(f"Invalid ward ID: '{ward_id}'. Ward ID must be a positive integer greater than zero.")
        if not Ward.objects.filter(id=ward_int).exists():
            raise Ward.DoesNotExist(f"Ward with ID {ward_int} does not exist.")
        qs = qs.filter(ward_id=ward_int)

    # Exclude all terminal statuses (Closed, Resolved, Rejected, Invalid)
    active_qs = qs.exclude(status__in=TERMINAL_STATUSES)

    # SLA thresholds computed backwards from `now`.
    # Notice: submitted_at < threshold is equivalent to submitted_at + SLA < now (strictly greater).
    # If submitted_at == threshold (exactly at deadline), submitted_at < threshold is False.
    crit_threshold = now - SLA_TARGETS['CRITICAL']  # 24 hours
    high_threshold = now - SLA_TARGETS['HIGH']      # 48 hours
    med_threshold = now - SLA_TARGETS['MEDIUM']     # 72 hours
    low_threshold = now - SLA_TARGETS['LOW']        # 168 hours (7 days)

    # Strictly filter by supported priorities where SLA is breached.
    # Unsupported or missing priorities are never included.
    sla_condition = (
        Q(priority_level__in=['CRITICAL', 'Critical'], submitted_at__lt=crit_threshold) |
        Q(priority_level__in=['HIGH', 'High'], submitted_at__lt=high_threshold) |
        Q(priority_level__in=['MEDIUM', 'Medium'], submitted_at__lt=med_threshold) |
        Q(priority_level__in=['LOW', 'Low'], submitted_at__lt=low_threshold)
    )

    return active_qs.filter(sla_condition).order_by('submitted_at')
