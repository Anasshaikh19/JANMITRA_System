"""
Data models for ward analytics and aggregate civic reporting metrics.
"""

from django.db import models


class WardMetric(models.Model):
    """
    Daily aggregated civic performance snapshot per Nagpur ward.
    Enables instant dashboard charting without heavy real-time table scans.
    """
    ward_number = models.PositiveSmallIntegerField(db_index=True)
    ward_name = models.CharField(max_length=100)
    date = models.DateField(db_index=True)
    total_complaints = models.PositiveIntegerField(default=0)
    pending_complaints = models.PositiveIntegerField(default=0)
    in_progress_complaints = models.PositiveIntegerField(default=0)
    resolved_complaints = models.PositiveIntegerField(default=0)
    sla_breaches = models.PositiveIntegerField(default=0)
    avg_resolution_hours = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', 'ward_number']
        unique_together = ('ward_number', 'date')
        verbose_name = 'Ward Performance Metric'
        verbose_name_plural = 'Ward Performance Metrics'

    def __str__(self):
        return f"Ward {self.ward_number} ({self.ward_name}) - {self.date}"


class SystemSettings(models.Model):
    """
    System-wide configuration settings for JANMITRA platform.
    Controls SLA hours, auto-close window, and public broadcast message.
    Implemented as a singleton model where pk=1.
    """
    sla_critical_hours = models.PositiveIntegerField(
        default=24,
        help_text="Resolution deadline in hours for CRITICAL priority complaints (default: 24)"
    )
    sla_high_hours = models.PositiveIntegerField(
        default=48,
        help_text="Resolution deadline in hours for HIGH priority complaints (default: 48)"
    )
    sla_medium_hours = models.PositiveIntegerField(
        default=72,
        help_text="Resolution deadline in hours for MEDIUM priority complaints (default: 72)"
    )
    auto_close_hours = models.PositiveIntegerField(
        default=72,
        help_text="Hours after resolution before unverified complaints are automatically closed (default: 72)"
    )
    broadcast_message = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Broadcast message string displayed on citizen app banner"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'System Settings'
        verbose_name_plural = 'System Settings'

    def __str__(self):
        return f"SystemSettings(critical={self.sla_critical_hours}h, high={self.sla_high_hours}h, medium={self.sla_medium_hours}h, auto_close={self.auto_close_hours}h)"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """
        Fetch singleton instance or create default if not present.
        """
        settings_obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                'sla_critical_hours': 24,
                'sla_high_hours': 48,
                'sla_medium_hours': 72,
                'auto_close_hours': 72,
                'broadcast_message': '',
            }
        )
        return settings_obj
