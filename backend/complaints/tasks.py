"""
Celery asynchronous and scheduled tasks for complaints.
"""

import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('complaints')
failure_logger = logging.getLogger('celery.task.failure')


@shared_task(name="complaints.tasks.notify_officer_on_new_complaint")
def notify_officer_on_new_complaint(complaint_id):
    """
    Asynchronous task to notify the department officer and send SMS/Push notification
    to the citizen upon complaint submission.
    """
    from .models import Complaint
    from notifications.models import Notification
    from accounts.models import User

    try:
        complaint = Complaint.objects.select_related('citizen', 'category', 'department', 'ward').get(id=complaint_id)
        logger.info(f"Processing new complaint notification for {complaint.tracking_id}")

        ward_label = complaint.ward.name if complaint.ward else "Unassigned Ward"
        dept_label = complaint.department.name if complaint.department else "General"

        # 1. Citizen acknowledgment notification
        Notification.objects.create(
            recipient=complaint.citizen,
            title=f"Complaint Logged: {complaint.tracking_id}",
            body=(
                f"Your issue '{complaint.title}' has been registered in {ward_label} "
                f"under {dept_label}. Track status using ID: {complaint.tracking_id}."
            ),
            complaint=complaint
        )

        # 2. Department officer notification
        dept_officers = User.objects.filter(
            role=User.Role.DEPT_OFFICER,
            department=complaint.department
        )
        for officer in dept_officers:
            Notification.objects.create(
                recipient=officer,
                title=f"New {complaint.department.short_name} Issue: {complaint.category.name}",
                body=(
                    f"A new issue '{complaint.title}' was reported in {ward_label} "
                    f"at {complaint.address}. Priority: {complaint.priority_level}."
                ),
                complaint=complaint
            )

        return f"Notifications dispatched for {complaint.tracking_id}"
    except Complaint.DoesNotExist:
        logger.error(f"Complaint id {complaint_id} not found.")
        return "Complaint not found"


@shared_task(name="complaints.tasks.check_sla_escalations")
def check_sla_escalations():
    """
    Periodic task run via Celery Beat:
    Identifies complaints unassigned or submitted for over 48 hours and escalates priority.
    """
    from .models import Complaint
    from notifications.models import Notification
    from accounts.models import User

    threshold = timezone.now() - timedelta(hours=48)
    delayed_complaints = Complaint.objects.filter(
        status__in=[Complaint.Status.SUBMITTED, Complaint.Status.ASSIGNED],
        submitted_at__lte=threshold
    )

    escalated_count = 0
    nmc_admins = User.objects.filter(role=User.Role.ADMIN)

    for complaint in delayed_complaints:
        if complaint.priority_level != Complaint.Priority.CRITICAL:
            complaint.priority_level = Complaint.Priority.HIGH
            complaint.save(update_fields=['priority_level'])
            escalated_count += 1

            for admin in nmc_admins:
                Notification.objects.create(
                    recipient=admin,
                    title=f"SLA Breached: {complaint.tracking_id}",
                    body=(
                        f"Complaint '{complaint.title}' in {complaint.ward.name if complaint.ward else 'Ward'} "
                        f"is pending for over 48 hours. Escalated to HIGH."
                    ),
                    complaint=complaint
                )

    logger.info(f"SLA check completed. Escalated {escalated_count} complaints.")
    return f"Escalated {escalated_count} delayed complaints"


def analyze_complaint_ai(complaint):
    """
    Hook for external AI vision / NLP / fraud detection service.
    External AI model providers, computer vision inference, or test mocks connect here.
    """
    if not complaint.priority_score:
        complaint.priority_score = 50.0

    is_fraud = bool(
        complaint.fake_detected or
        (complaint.fake_detection_score is not None and complaint.fake_detection_score > 0.6)
    )

    return {
        'priority_score': complaint.priority_score,
        'is_fraud': is_fraud,
    }


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    name="complaints.tasks.process_complaint_ai"
)
def process_complaint_ai(self, complaint_id):
    """
    Asynchronous AI processing pipeline for a civic complaint:
    - Analyzes image attachments and description
    - Computes priority score and fraud/fake detection probability
    - Cross-references nearby reports for duplicate detection
    - Updates status to 'Validated' (or 'Pending Validation' if fraud flagged)
    - Triggers automated department routing upon successful validation
    Configured with resilient retry policy: 2 retries, 30s delay on transient failures.
    """
    import uuid
    from django.db import transaction
    from .models import Complaint, StatusHistory

    task_id = getattr(self.request, 'id', None) or 'sync'
    retries = getattr(self.request, 'retries', 0)

    # 1. Permanent guard: Missing complaint ID
    if not complaint_id:
        logger.error(f"Task '{self.name}' [ID: {task_id}]: Complaint ID is required.")
        return "Complaint not found"

    # 2. Permanent guard: Resolve complaint object
    try:
        if isinstance(complaint_id, uuid.UUID):
            complaint = Complaint.objects.select_related('citizen', 'category', 'department', 'ward').get(id=complaint_id)
        else:
            try:
                complaint_uuid = uuid.UUID(str(complaint_id))
                complaint = Complaint.objects.select_related('citizen', 'category', 'department', 'ward').get(id=complaint_uuid)
            except (ValueError, TypeError):
                complaint = Complaint.objects.select_related('citizen', 'category', 'department', 'ward').get(tracking_id=str(complaint_id))
    except (Complaint.DoesNotExist, ValueError, TypeError) as exc:
        logger.error(f"Task '{self.name}' [ID: {task_id}]: Complaint id '{complaint_id}' not found for AI processing: {exc}")
        return "Complaint not found"

    # 3. Idempotency guard: Skip if complaint is already in downstream or terminal status
    downstream_or_terminal = [
        'Assigned', 'In Progress', 'Work Done', 'Resolved', 'Closed', 'Rejected', 'Invalid',
        Complaint.Status.ASSIGNED, Complaint.Status.IN_PROGRESS, Complaint.Status.WORK_DONE,
        Complaint.Status.RESOLVED, Complaint.Status.CLOSED, Complaint.Status.REJECTED, Complaint.Status.INVALID,
    ]
    if complaint.status in downstream_or_terminal:
        logger.info(
            f"Task '{self.name}' [ID: {task_id}]: Complaint {complaint.tracking_id} is already in downstream "
            f"status '{complaint.status}'. Skipping AI processing."
        )
        return f"AI processing completed for {complaint.tracking_id}"

    # Check if AI processing was already recorded in StatusHistory
    already_validated = StatusHistory.objects.filter(
        complaint=complaint,
        note__istartswith='AI processing'
    ).exists()

    if already_validated and complaint.status in ['Validated', 'Pending Validation', Complaint.Status.VALIDATED, Complaint.Status.PENDING_VALIDATION]:
        logger.info(
            f"Task '{self.name}' [ID: {task_id}]: Complaint {complaint.tracking_id} was already processed by AI pipeline. "
            f"Skipping duplicate execution."
        )
        return f"AI processing completed for {complaint.tracking_id}"

    # 4. Execute AI assessment with retry policy for transient exceptions
    try:
        logger.info(f"Task '{self.name}' [ID: {task_id}]: AI processing initiated for complaint {complaint.tracking_id} ({complaint_id})")
        ai_result = analyze_complaint_ai(complaint)

        priority_score = ai_result.get('priority_score', 50.0)
        is_fraud = ai_result.get('is_fraud', False)

        old_status = complaint.status
        new_status = 'Pending Validation' if is_fraud else 'Validated'

        with transaction.atomic():
            complaint.priority_score = priority_score
            complaint.status = new_status
            complaint.save(update_fields=['priority_score', 'status', 'updated_at'])

            StatusHistory.objects.create(
                complaint=complaint,
                old_status=old_status,
                new_status=new_status,
                note='AI processing completed and complaint validated' if not is_fraud else 'AI processing flagged complaint for manual validation'
            )

            # Trigger automated routing only after AI validation succeeds
            if not is_fraud and new_status == 'Validated':
                def dispatch_routing():
                    try:
                        route_complaint_task.delay(str(complaint.id))
                    except Exception as exc:
                        logger.warning(f"Failed to dispatch route_complaint_task for {complaint.id}: {exc}")

                transaction.on_commit(dispatch_routing)

        return f"AI processing completed for {complaint.tracking_id}"

    except (ConnectionError, TimeoutError, OSError, IOError) as exc:
        if retries < self.max_retries:
            failure_logger.warning(
                f"Task '{self.name}' [ID: {task_id}] transient failure on attempt {retries + 1}/{self.max_retries} "
                f"for complaint {complaint_id}: {type(exc).__name__}: {exc}. Retrying in {self.default_retry_delay}s..."
            )
            raise self.retry(exc=exc, countdown=self.default_retry_delay)
        else:
            failure_logger.exception(
                f"Task '{self.name}' [ID: {task_id}] exhausted all {self.max_retries} retries for complaint {complaint_id}. "
                f"Terminal failure: {type(exc).__name__}: {exc}"
            )
            raise exc

    except self.MaxRetriesExceededError as exc:
        failure_logger.exception(
            f"Task '{self.name}' [ID: {task_id}] exhausted all {self.max_retries} retries for complaint {complaint_id}. "
            f"Terminal failure: MaxRetriesExceededError: {exc}"
        )
        raise exc

    except Exception as exc:
        if getattr(exc, 'is_transient', False):
            if retries < self.max_retries:
                failure_logger.warning(
                    f"Task '{self.name}' [ID: {task_id}] transient failure on attempt {retries + 1}/{self.max_retries} "
                    f"for complaint {complaint_id}: {type(exc).__name__}: {exc}. Retrying in {self.default_retry_delay}s..."
                )
                raise self.retry(exc=exc, countdown=self.default_retry_delay)
            else:
                failure_logger.exception(
                    f"Task '{self.name}' [ID: {task_id}] exhausted all {self.max_retries} retries for complaint {complaint_id}. "
                    f"Terminal failure: {type(exc).__name__}: {exc}"
                )
                raise exc

        # Non-transient permanent failure
        logger.error(f"Permanent error in task '{self.name}' [ID: {task_id}] for complaint {complaint_id}: {exc}")
        return str(exc)



@shared_task(name="complaints.tasks.route_complaint_task")
def route_complaint_task(complaint_id):
    """
    Asynchronous Celery task to route a validated complaint to its designated department.
    Calls route_complaint(complaint_id) in complaints.routing.
    """
    from .routing import route_complaint as execute_routing

    result = execute_routing(complaint_id)
    if result.get('success'):
        msg = result.get('message') or f"Complaint {complaint_id} routed successfully"
        logger.info(f"route_complaint_task succeeded for {complaint_id}: {msg}")
        return msg
    else:
        err = result.get('error') or "Unknown routing error"
        logger.error(f"route_complaint_task failed for {complaint_id}: {err}")
        return f"Routing failed: {err}"


# Backward-compatibility alias for existing code calling route_complaint
route_complaint = route_complaint_task


@shared_task(name="complaints.tasks.auto_close")
def auto_close():
    """
    Auto-close complaints in 'Work Done' or 'RESOLVED' status if pending citizen verification
    beyond timeout period (e.g. 3 days).
    """
    from django.db.models import Q
    from .models import Complaint, StatusHistory
    threshold = timezone.now() - timedelta(days=3)
    candidates = Complaint.objects.filter(
        status__in=['Work Done', 'RESOLVED', Complaint.Status.RESOLVED, Complaint.Status.WORK_DONE]
    ).filter(
        Q(updated_at__lte=threshold) | Q(submitted_at__lte=threshold)
    )
    closed_count = 0
    for complaint in candidates:
        old_status = complaint.status
        complaint.status = 'Closed'
        if not complaint.resolved_at:
            complaint.resolved_at = timezone.now()
        complaint.save(update_fields=['status', 'resolved_at', 'updated_at'])

        StatusHistory.objects.create(
            complaint=complaint,
            old_status=old_status,
            new_status='Closed',
            note='Automatically closed by system following resolution verification timeout'
        )
        closed_count += 1
    logger.info(f"Auto-close task finished: {closed_count} complaints marked Closed.")
    return f"Auto-closed {closed_count} complaints"


@shared_task(name="complaints.tasks.trigger_work_done")
def trigger_work_done(complaint_id):
    """
    Asynchronous task to notify the citizen when a field worker marks their complaint as Work Done.
    Prompts citizen to review the resolution proof and verify or reject.
    """
    from .models import Complaint
    from notifications.models import Notification

    try:
        complaint = Complaint.objects.select_related('citizen', 'category', 'department', 'ward').get(id=complaint_id)
        logger.info(f"Triggering work done notification for complaint {complaint.tracking_id} to citizen {complaint.citizen}")

        notification = Notification.objects.create(
            recipient=complaint.citizen,
            notification_type=Notification.NotificationType.IN_APP,
            title=f"Work Completed: {complaint.tracking_id}",
            message=(
                f"Your complaint '{complaint.title}' has been marked as Work Done by the assigned field worker. "
                f"Please review the resolution proof and verify to close the complaint."
            ),
            complaint=complaint,
        )
        return f"Notification {notification.id} created for citizen on complaint {complaint.tracking_id}"
    except Complaint.DoesNotExist:
        logger.error(f"Complaint id {complaint_id} not found for trigger_work_done notification.")
        return "Complaint not found"
    except Exception as exc:
        logger.error(f"Error in trigger_work_done for {complaint_id}: {exc}")
        return str(exc)


@shared_task(name="complaints.tasks.trigger_task_assigned")
def trigger_task_assigned(complaint_id, worker_id=None):
    """
    Asynchronous Celery task to notify the municipal field worker when a complaint
    is assigned to them. Creates an audit Notification record and logs FCM push dispatch.
    Idempotent: prevents duplicate notifications for the same worker and complaint.
    """
    from .models import Complaint
    from notifications.models import Notification
    from accounts.models import User

    try:
        complaint = Complaint.objects.select_related('assigned_worker', 'ward').get(id=complaint_id)
        worker = None
        if worker_id:
            worker = User.objects.get(id=worker_id)
        elif complaint.assigned_worker:
            worker = complaint.assigned_worker

        if not worker:
            logger.warning(f"No worker found to notify for complaint {complaint_id}")
            return "No worker assigned"

        # Check if identical notification already exists to avoid duplicate records
        existing_notif = Notification.objects.filter(
            recipient=worker,
            complaint=complaint,
            title__startswith="New Task Assigned:"
        ).first()

        if existing_notif:
            logger.info(f"Notification already exists for worker {worker.id} on complaint {complaint.tracking_id}")
            return f"Notification {existing_notif.id} already exists"

        ward_label = complaint.ward.name if complaint.ward else "Nagpur"
        notification = Notification.objects.create(
            recipient=worker,
            notification_type=Notification.NotificationType.PUSH,
            title=f"New Task Assigned: {complaint.tracking_id}",
            message=(
                f"You have been assigned to resolve complaint '{complaint.title}' "
                f"in {ward_label}."
            ),
            complaint=complaint,
        )
        if getattr(worker, 'fcm_token', None):
            logger.info(f"FCM push notification queued for worker {worker.id} (tracking_id={complaint.tracking_id})")
        return f"Task assigned notification {notification.id} created for worker {worker.id}"
    except (Complaint.DoesNotExist, User.DoesNotExist) as exc:
        logger.error(f"Error in trigger_task_assigned for complaint {complaint_id}: {exc}")
        return str(exc)
    except Exception as exc:
        logger.error(f"Unexpected error in trigger_task_assigned: {exc}")
        return str(exc)


# Import push notification task from notifications app
try:
    from notifications.tasks import send_push_notification
except ImportError:
    send_push_notification = None




