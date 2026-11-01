"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/views.py
Developer: Faizan Rayeen (Notifications Lead)
Description: API views for listing notifications, marking notifications read,
              and updating user FCM push registration tokens.
==============================================================================
"""

import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model
from .models import Notification
from .serializers import NotificationSerializer, FCMTokenUpdateSerializer
from .fcm_service import register_user_fcm_token

User = get_user_model()
logger = logging.getLogger(__name__)


class NotificationListView(APIView):
    """
    GET /api/v1/notifications/
    Lists notifications for the user. Returns demo notifications if not logged in.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user
        include_all = request.query_params.get('all', 'false').lower() == 'true'

        if user and user.is_authenticated:
            queryset = Notification.objects.filter(recipient=user)
            if not include_all:
                queryset = queryset.filter(is_read=False)
            notifications = queryset[:20]
            serializer = NotificationSerializer(notifications, many=True)
            unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
            return Response({
                'unread_count': unread_count,
                'count': len(serializer.data),
                'results': serializer.data
            }, status=status.HTTP_200_OK)

        # Realistic demo notifications for Faizan Rayeen's Citizen Portal
        demo_notifications = [
            {
                "id": "notif-1",
                "title": "Complaint Validated: NMC-2026-A4829",
                "body": "Your complaint regarding 'Pothole on Great Nag Road' has been validated by AI and assigned to PWD.",
                "is_read": False,
                "created_at": "2026-10-10T21:40:00+05:30",
                "complaint_id": "c-101"
            },
            {
                "id": "notif-2",
                "title": "Field Worker Assigned",
                "body": "Supervisor Ramesh Patil (PWD) has been dispatched for repairs.",
                "is_read": False,
                "created_at": "2026-10-10T20:15:00+05:30",
                "complaint_id": "c-101"
            },
            {
                "id": "notif-3",
                "title": "Civic Advisory: Water Pipeline Work",
                "body": "Maintenance scheduled in Ward 4 tomorrow between 10 AM to 2 PM.",
                "is_read": True,
                "created_at": "2026-10-09T18:00:00+05:30",
                "complaint_id": None
            }
        ]

        return Response({
            'unread_count': 2,
            'count': len(demo_notifications),
            'results': demo_notifications
        }, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    """
    PATCH /api/v1/notifications/mark-read/
    Marks all unread notifications as read for request.user.
    Can also pass optional ?id=<uuid> to mark a specific notification as read.
    """
    permission_classes = [AllowAny]

    def patch(self, request):
        user = request.user
        notification_id = request.data.get('id') or request.query_params.get('id')

        if user and user.is_authenticated:
            if notification_id:
                updated_count = Notification.objects.filter(
                    recipient=user,
                    id=notification_id
                ).update(is_read=True)
                return Response({
                    'message': f'Notification marked as read.',
                    'updated_count': updated_count
                }, status=status.HTTP_200_OK)

            # Mark all unread as read
            updated_count = Notification.objects.filter(
                recipient=user,
                is_read=False
            ).update(is_read=True)

            return Response({
                'message': 'All notifications marked as read.',
                'updated_count': updated_count
            }, status=status.HTTP_200_OK)

        return Response({
            'message': 'All notifications marked as read (Demo / Local).',
            'updated_count': 1
        }, status=status.HTTP_200_OK)


class FCMTokenRegisterView(APIView):
    """
    POST /api/v1/auth/fcm-token/
    Registers or updates the user's FCM device push token.
    Called automatically by the React frontend on user login / permission grant.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        return self._save_token(request)

    def patch(self, request):
        return self._save_token(request)

    def _save_token(self, request):
        serializer = FCMTokenUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        fcm_token = serializer.validated_data['fcm_token']
        device_type = serializer.validated_data.get('device_type', 'web')

        user = None
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            # Check user_id or mobile or username in request data
            user_id_val = request.data.get('user_id') or request.data.get('mobile') or request.data.get('username')
            if user_id_val:
                try:
                    user = User.objects.filter(pk=user_id_val).first()
                except Exception:
                    user = None
                if not user:
                    user = User.objects.filter(username=str(user_id_val)).first()

        if not user:
            # Fallback to Citizen Faizan Rayeen demo account or first user
            user = User.objects.filter(username='9900002004').first() or User.objects.first()

        user_id = str(user.pk) if user else "1"
        register_user_fcm_token(user_id, fcm_token, device_type)
        if user and getattr(user, 'username', None):
            register_user_fcm_token(user.username, fcm_token, device_type)

        logger.info("[FCM] Registered token for user %s (%s)", user_id, device_type)

        return Response({
            'message': 'FCM token registered successfully.',
            'device_type': device_type,
            'user_id': user_id,
            'fcm_token': fcm_token
        }, status=status.HTTP_200_OK)
