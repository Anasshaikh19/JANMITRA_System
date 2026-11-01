"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/serializers.py
Developer: Faizan Rayeen (Notifications Lead)
==============================================================================
"""

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for in-app notification records.
    """
    complaint_tracking_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'body',
            'complaint',
            'complaint_tracking_id',
            'is_read',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_complaint_tracking_id(self, obj):
        if obj.complaint:
            return getattr(obj.complaint, 'tracking_id', str(obj.complaint.id))
        return None


class FCMTokenUpdateSerializer(serializers.Serializer):
    """
    Serializer for saving / updating user's FCM device token.
    """
    fcm_token = serializers.CharField(max_length=512, required=True)
    device_type = serializers.CharField(max_length=50, required=False, default='web')
