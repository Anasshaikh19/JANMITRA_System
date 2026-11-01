"""
Admin configuration for notifications app.
"""

from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        'recipient',
        'notification_type',
        'title',
        'is_read',
        'complaint',
        'created_at',
    )
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('recipient__mobile', 'recipient__full_name', 'title', 'message')
