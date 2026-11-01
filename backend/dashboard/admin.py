"""
Admin configuration for dashboard app.
"""

from django.contrib import admin
from .models import SystemSettings, WardMetric


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'sla_critical_hours',
        'sla_high_hours',
        'sla_medium_hours',
        'auto_close_hours',
        'broadcast_message',
        'updated_at',
    )


@admin.register(WardMetric)
class WardMetricAdmin(admin.ModelAdmin):
    list_display = (
        'ward_number',
        'ward_name',
        'date',
        'total_complaints',
        'pending_complaints',
        'in_progress_complaints',
        'resolved_complaints',
        'avg_resolution_hours',
        'sla_breaches',
    )
    list_filter = ('date', 'ward_number')
    search_fields = ('ward_name',)
