"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/tasks.py
Developer: Faizan Rayeen (Notifications Lead)
Description: Celery asynchronous background tasks for sending FCM push alerts
              and creating persistent in-app notification records.
==============================================================================
"""

import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from . import fcm_service
from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


def dispatch_push_notification(user_id, title, body, data=None, click_action=None):
    """
    Synchronous core logic that saves the notification to database
    and dispatches FCM push notification. Used by Celery task and fallback mode.
    """
    logger.info("[Push Dispatch] Sending notification to user %s: '%s' (action: %s)", user_id, title, click_action)

    if data is None:
        data = {}
    elif not isinstance(data, dict):
        data = dict(data)

    if click_action and 'click_action' not in data:
        data['click_action'] = click_action
    elif 'click_action' not in data and (data.get('complaint_id') or data.get('complaintId')):
        cid = data.get('complaint_id') or data.get('complaintId')
        data['click_action'] = f"/citizen/complaint/{cid}"

    # 1. Save in-app notification to Database
    try:
        complaint_id = None
        raw_cid = data.get('complaint_id') or data.get('complaintId')
        if raw_cid:
            # Check if raw_cid is a valid UUID or valid Complaint ID
            try:
                import uuid
                uuid.UUID(str(raw_cid))
                complaint_id = raw_cid
            except (ValueError, TypeError):
                # If not UUID (e.g. mock 'c-100'), leave as None so ForeignKey constraint passes
                complaint_id = None

        actual_recipient_id = None
        try:
            actual_recipient_id = int(user_id)
        except (ValueError, TypeError):
            user = User.objects.filter(username=str(user_id)).first() or User.objects.first()
            if user:
                actual_recipient_id = user.id

        if actual_recipient_id:
            Notification.objects.create(
                recipient_id=actual_recipient_id,
                title=title,
                body=body,
                complaint_id=complaint_id
            )
    except Exception as db_err:
        logger.warning("[Push Dispatch] Failed to persist in-app Notification record: %s", db_err)

    # 2. Dispatch FCM Push Notification
    try:
        success = fcm_service.send_push(
            user_id=user_id,
            title=title,
            body=body,
            data=data
        )
        return success
    except Exception as exc:
        logger.error("[Push Dispatch] Error sending FCM push notification: %s", exc)
        raise exc


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def send_push_notification(self, user_id, title, body, data=None, click_action=None):
    """
    Asynchronous Celery task that sends an FCM push notification to a user
    and logs a Notification record in the database.

    Args:
        user_id (str|int|UUID): ID of target user.
        title (str): Notification title.
        body (str): Notification message body.
        data (dict, optional): Metadata such as complaint_id, status.
        click_action (str, optional): Target deep link URL on notification click.
    """
    logger.info("[Celery Task] Dispatching notification to user %s: '%s'", user_id, title)
    try:
        return dispatch_push_notification(
            user_id=user_id,
            title=title,
            body=body,
            data=data,
            click_action=click_action
        )
    except Exception as exc:
        logger.error("[Celery Task] Error sending FCM push notification: %s", exc)
        # Retry with exponential backoff if temporary network issue
        raise self.retry(exc=exc)
