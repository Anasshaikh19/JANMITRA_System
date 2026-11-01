"""
Models for user notifications and civic alerts.
"""

from django.conf import settings
from django.db import models


class Notification(models.Model):
    """
    Stores system notifications for citizens and NMC officials.
    """
    class NotificationType(models.TextChoices):
        IN_APP = 'IN_APP', 'In-App Notification'
        SMS = 'SMS', 'SMS Alert'
        EMAIL = 'EMAIL', 'Email Alert'
        PUSH = 'PUSH', 'Push Notification'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text='Citizen or Municipal official receiving the notification'
    )
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.IN_APP
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    complaint = models.ForeignKey(
        'complaints.Complaint',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
        help_text='Associated complaint reference if applicable'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
        ]
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title}"
