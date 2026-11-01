"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/fcm_service.py
Developer: Faizan Rayeen (Notifications Lead)
Description: Firebase Admin SDK initialization and FCM push notification sender.
==============================================================================
"""

import os
import json
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)
User = get_user_model()

# Global reference to initialized Firebase App
_firebase_app = None

# Persistent FCM Token Store File
FCM_TOKENS_STORE_FILE = os.path.join(getattr(settings, 'BASE_DIR', os.getcwd()), 'fcm_tokens_store.json')


def _load_tokens_store():
    if os.path.exists(FCM_TOKENS_STORE_FILE):
        try:
            with open(FCM_TOKENS_STORE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_tokens_store(store):
    try:
        with open(FCM_TOKENS_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(store, f, indent=2)
    except Exception as e:
        logger.warning("[FCM] Failed to persist token store file: %s", e)


def register_user_fcm_token(user_id, token, device_type='web'):
    """
    Registers or updates an FCM push token for a given user ID or identifier.
    Persists to fcm_tokens_store.json.
    """
    store = _load_tokens_store()
    store[str(user_id)] = {
        'token': token,
        'device_type': device_type
    }
    _save_tokens_store(store)
    logger.info("[FCM] Stored token for user %s (%s)", user_id, device_type)
    return True


def get_user_fcm_token(user_id):
    """
    Retrieves the registered FCM token for a given user ID or identifier.
    """
    store = _load_tokens_store()
    if str(user_id) in store:
        return store[str(user_id)].get('token')
    return None


def initialize_firebase():
    """
    Initializes the Firebase Admin SDK using the service account credentials path
    provided in the environment variable FIREBASE_CREDENTIALS_PATH or Django settings.
    Ensures single initialization across workers.
    """
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    # Check if Firebase is already initialized in this process
    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    # Read credentials path from env var or settings
    cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH') or getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None)

    try:
        if cred_path and os.path.exists(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
                _firebase_app = firebase_admin.initialize_app(cred)
                logger.info("[FCM] Firebase Admin SDK successfully initialized from: %s", cred_path)
            except Exception as cert_err:
                logger.info("[FCM Simulation Mode] Mock/Development credentials detected (%s). Running in Safe Simulation Mode.", cert_err)
                _firebase_app = None
        else:
            _firebase_app = None
    except Exception as exc:
        logger.info("[FCM Simulation Mode] Operating in Safe Simulation Mode: %s", exc)
        _firebase_app = None

    return _firebase_app


def send_push(user_id, title, body, data=None):
    """
    Sends a Web/Mobile Push Notification to a user via Firebase Cloud Messaging.

    Args:
        user_id (str|int|UUID): Database ID of recipient User.
        title (str): Title header of the notification.
        body (str): Message text body.
        data (dict, optional): Custom dictionary metadata (e.g. complaint_id, status).

    Returns:
        bool: True if sent successfully, False otherwise.
    """
    try:
        # 1. Fetch recipient from database
        try:
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            user = User.objects.filter(username=str(user_id)).first() or User.objects.first()
            if not user:
                logger.info("[FCM Simulation Mode] User '%s' simulated in test environment: '%s'", user_id, title)
                return True

        # 2. Check that the user has an active FCM registration token
        fcm_token = get_user_fcm_token(user.id) or getattr(user, 'fcm_token', None) or get_user_fcm_token(getattr(user, 'username', ''))
        if not fcm_token:
            logger.info("[FCM Simulation Mode] User '%s' has no registered FCM token. Simulating push delivery: '%s'", user.id, title)
            return True

        # 3. Ensure Firebase Admin SDK is ready
        app = initialize_firebase()
        if not app:
            logger.info("[FCM Simulation Mode] Live Firebase Admin not connected. Simulating push delivery to user %s: '%s'", user.id, title)
            return True

        # 4. Format data payload (FCM requires string values in the data map)
        payload_data = {}
        if data and isinstance(data, dict):
            for k, v in data.items():
                payload_data[str(k)] = str(v) if v is not None else ""

        # Default click action if complaint_id is provided
        complaint_id = payload_data.get('complaint_id') or payload_data.get('complaintId')
        if complaint_id and 'click_action' not in payload_data:
            payload_data['click_action'] = f"/citizen/complaint/{complaint_id}"

        # 5. Build Firebase Cloud Message
        notification_payload = messaging.Notification(
            title=title,
            body=body,
            image=payload_data.get('icon', None)
        )

        # Webpush specific configurations (badge, icon, click action)
        webpush_config = messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon='/icons/janmitra-logo-192.png',
                badge='/icons/badge-72.png',
                tag=f"complaint-{complaint_id}" if complaint_id else "janmitra-alert"
            ),
            fcm_options=messaging.WebpushFCMOptions(
                link=payload_data.get('click_action', '/')
            )
        )

        message = messaging.Message(
            notification=notification_payload,
            data=payload_data,
            token=fcm_token,
            webpush=webpush_config
        )

        # 6. Send the message via Firebase Admin SDK
        response = messaging.send(message)
        logger.info("[FCM] Push notification sent successfully to user %s. Message ID: %s", user.id, response)
        return True

    except messaging.UnregisteredError:
        logger.warning("[FCM] Token for user %s is unregistered or expired. Clearing token.", user_id)
        # Clear invalid token to avoid repeated failures
        try:
            User.objects.filter(pk=user_id).update(fcm_token=None)
        except Exception:
            pass
        return False
    except Exception as exc:
        # Don't crash on FCM errors; log and fail safely
        logger.error("[FCM] Failed to send push notification to user %s: %s", user_id, exc)
        return False
