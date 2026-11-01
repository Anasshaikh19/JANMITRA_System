"""
Serializers for notifications app.
"""

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    complaint_tracking_id = serializers.ReadOnlyField(source='complaint.tracking_id')

    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type',
            'title',
            'message',
            'is_read',
            'complaint',
            'complaint_tracking_id',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'notification_type',
            'title',
            'message',
            'complaint',
            'created_at',
        ]
