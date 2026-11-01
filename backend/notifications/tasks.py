"""
Celery asynchronous tasks for alerts and notifications.
"""

import logging
from celery import shared_task

logger = logging.getLogger('notifications')
failure_logger = logging.getLogger('celery.task.failure')


def dispatch_fcm_push(recipient, fcm_token, title, message, extra_data=None):
    """
    Hook for Firebase Cloud Messaging (FCM) / APNS push dispatch.
    External push provider integrations or mocks connect here.
    """
    # If no FCM token registered on user profile, external dispatch is skipped
    if not fcm_token:
        return False
    return True


@shared_task(name="notifications.tasks.send_external_sms_alert")
def send_external_sms_alert(phone_number, message):
    """
    Simulates / triggers government SMS gateway dispatch.
    """
    logger.info(f"Dispatching SMS to {phone_number}: {message[:50]}...")
    # Integration point for CDAC Gov SMS or SMS gateway
    return f"SMS successfully sent to {phone_number}"


@shared_task(name="notifications.tasks.broadcast_ward_alert")
def broadcast_ward_alert(ward_number, title, message):
    """
    Broadcasts public civic alert to all residents of a given Nagpur ward.
    """
    from accounts.models import User
    from .models import Notification

    citizens = User.objects.filter(ward_id=ward_number)
    count = 0
    notifications_to_create = []

    for citizen in citizens:
        notifications_to_create.append(
            Notification(
                recipient=citizen,
                notification_type=Notification.NotificationType.IN_APP,
                title=f"[Ward {ward_number} Notice] {title}",
                message=message,
            )
        )
        count += 1

    Notification.objects.bulk_create(notifications_to_create)
    logger.info(f"Broadcasted alert to {count} citizens in Ward {ward_number}.")
    return f"Broadcasted to {count} recipients in Ward {ward_number}"


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="notifications.tasks.send_push_notification"
)
def send_push_notification(self, recipient_id, title, message, complaint_id=None, extra_data=None):
    """
    Sends push notification (e.g. Firebase Cloud Messaging / FCM or APNS)
    to a user and logs an audit Notification model entry.
    Configured with resilient retry policy: 3 retries, 60s delay on transient failures.
    """
    import uuid
    from accounts.models import User
    from .models import Notification

    task_id = getattr(self.request, 'id', None) or 'sync'
    retries = getattr(self.request, 'retries', 0)

    # 1. Permanent failure check: Missing or invalid recipient ID
    if not recipient_id:
        logger.error(f"Task '{self.name}' [ID: {task_id}]: Recipient ID is required.")
        return "Recipient not found"

    try:
        recipient = User.objects.get(id=recipient_id)
    except (User.DoesNotExist, ValueError, TypeError) as exc:
        logger.error(f"Task '{self.name}' [ID: {task_id}]: Recipient user id {recipient_id} not found: {exc}")
        return "Recipient not found"

    # 2. Resolve associated complaint if provided (permanent guard: invalid ID does not block notification)
    complaint_obj = None
    if complaint_id:
        from complaints.models import Complaint
        try:
            if isinstance(complaint_id, uuid.UUID):
                complaint_obj = Complaint.objects.filter(id=complaint_id).first()
            else:
                complaint_obj = Complaint.objects.filter(id=uuid.UUID(str(complaint_id))).first()
        except (ValueError, TypeError):
            complaint_obj = Complaint.objects.filter(tracking_id=str(complaint_id)).first()

    # 3. Idempotent Notification creation: Prevent duplicate records during retries
    notification = None
    if complaint_obj:
        notification = Notification.objects.filter(
            recipient=recipient,
            complaint=complaint_obj,
            title=title,
            notification_type=Notification.NotificationType.PUSH
        ).first()

    if not notification:
        notification = Notification.objects.create(
            recipient=recipient,
            notification_type=Notification.NotificationType.PUSH,
            title=title,
            message=message,
            complaint=complaint_obj
        )

    # 4. Dispatch push notification via FCM gateway hook
    try:
        fcm_token = getattr(recipient, 'fcm_token', None)
        logger.info(
            f"Dispatching push notification task '{self.name}' [ID: {task_id}] to recipient "
            f"(FCM registered: {bool(fcm_token)}) for title: '{title}'"
        )

        dispatch_fcm_push(recipient, fcm_token, title, message, extra_data=extra_data)

        return f"Push notification sent to user {recipient_id} (Notification ID: {notification.id})"
    except (ConnectionError, TimeoutError, OSError, IOError) as exc:
        # Transient failure (network/gateway timeout)
        if retries < self.max_retries:
            failure_logger.warning(
                f"Task '{self.name}' [ID: {task_id}] transient failure on attempt {retries + 1}/{self.max_retries} "
                f"for recipient {recipient_id}: {type(exc).__name__}: {exc}. Retrying in {self.default_retry_delay}s..."
            )
            raise self.retry(exc=exc, countdown=self.default_retry_delay)
        else:
            failure_logger.exception(
                f"Task '{self.name}' [ID: {task_id}] exhausted all {self.max_retries} retries for recipient {recipient_id}. "
                f"Terminal failure: {type(exc).__name__}: {exc}"
            )
            raise exc
    except self.MaxRetriesExceededError as exc:
        failure_logger.exception(
            f"Task '{self.name}' [ID: {task_id}] exhausted all {self.max_retries} retries for recipient {recipient_id}. "
            f"Terminal failure: MaxRetriesExceededError: {exc}"
        )
        raise exc
    except Exception as exc:
        # Check if caller signaled explicit transient exception
        if getattr(exc, 'is_transient', False):
            if retries < self.max_retries:
                failure_logger.warning(
                    f"Task '{self.name}' [ID: {task_id}] transient failure on attempt {retries + 1}/{self.max_retries} "
                    f"for recipient {recipient_id}: {type(exc).__name__}: {exc}. Retrying in {self.default_retry_delay}s..."
                )
                raise self.retry(exc=exc, countdown=self.default_retry_delay)
            else:
                failure_logger.exception(
                    f"Task '{self.name}' [ID: {task_id}] exhausted all {self.max_retries} retries for recipient {recipient_id}. "
                    f"Terminal failure: {type(exc).__name__}: {exc}"
                )
                raise exc

        # Non-transient permanent failure
        logger.error(f"Permanent error in task '{self.name}' [ID: {task_id}] for recipient {recipient_id}: {exc}")
        return str(exc)

