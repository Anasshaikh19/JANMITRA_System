"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/models.py
Developer: Faizan Rayeen (Notifications Lead)
Description: Data model for storing in-app and push notification history.
==============================================================================
"""

import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    """
    Stores system notifications sent to Citizens, Workers, or Officers.
    Linked to push notification delivery via Firebase Cloud Messaging (FCM).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="Target user who receives this notification"
    )
    title = models.CharField(max_length=255, help_text="Notification headline")
    body = models.TextField(help_text="Detailed message text")
    
    # Optional link to relevant Complaint
    complaint = models.ForeignKey(
        'complaints.Complaint',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        help_text="Associated civic issue complaint (if applicable)"
    )
    
    is_read = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether recipient has seen or opened this notification"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"[{self.recipient}] {self.title} (Read: {self.is_read})"
