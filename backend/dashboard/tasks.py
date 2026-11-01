"""
Periodic Celery tasks for computing civic analytics.
"""

import logging
from celery import shared_task
from django.db.models import Avg, Count, F
from django.utils import timezone

logger = logging.getLogger('dashboard')


@shared_task(name="dashboard.tasks.aggregate_daily_ward_metrics")
def aggregate_daily_ward_metrics():
    """
    Scheduled nightly Celery beat task:
    Aggregates ward-level statistics across Nagpur Municipal Corporation.
    """
    from complaints.models import Complaint
    from .models import WardMetric

    today = timezone.now().date()
    logger.info(f"Running daily ward metric aggregation for {today}")

    # Distinct ward IDs with complaints
    ward_ids = Complaint.objects.values_list('ward__id', flat=True).distinct()

    total_updated = 0
    for ward_id in ward_ids:
        if not ward_id:
            continue
        ward_qs = Complaint.objects.filter(ward__id=ward_id)
        total = ward_qs.count()
        submitted = ward_qs.filter(status=Complaint.Status.SUBMITTED).count()
        in_progress = ward_qs.filter(status=Complaint.Status.IN_PROGRESS).count()
        resolved = ward_qs.filter(status=Complaint.Status.RESOLVED).count()

        first_complaint = ward_qs.first()
        ward_name = first_complaint.ward.name if first_complaint and first_complaint.ward else f"Ward {ward_id}"

        resolved_qs = ward_qs.filter(
            status=Complaint.Status.RESOLVED,
            resolved_at__isnull=False
        )
        avg_hours = 0.0
        if resolved_qs.exists():
            durations = [
                (c.resolved_at - c.submitted_at).total_seconds() / 3600.0
                for c in resolved_qs
            ]
            if durations:
                avg_hours = sum(durations) / len(durations)

        WardMetric.objects.update_or_create(
            ward_number=ward_id,
            date=today,
            defaults={
                'ward_name': ward_name,
                'total_complaints': total,
                'pending_complaints': submitted,
                'in_progress_complaints': in_progress,
                'resolved_complaints': resolved,
                'avg_resolution_hours': round(avg_hours, 2),
            }
        )
        total_updated += 1

    logger.info(f"Updated metrics for {total_updated} wards.")
    return f"Aggregated metrics for {total_updated} wards"
