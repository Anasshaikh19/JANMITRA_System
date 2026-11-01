"""
GeoDjango Admin configuration for complaints app.
"""

from django.contrib import admin
from django.contrib.gis import admin as gis_admin
from .models import (
    Category,
    Complaint,
    ComplaintImage,
    Department,
    StatusHistory,
    Ward,
)


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('id', 'name')
    ordering = ('id',)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'short_name')
    search_fields = ('id', 'name', 'short_name')
    ordering = ('id',)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'department')
    list_filter = ('department',)
    search_fields = ('id', 'name', 'department__name', 'department__short_name')
    ordering = ('id',)


class ComplaintImageInline(admin.TabularInline):
    model = ComplaintImage
    extra = 0
    readonly_fields = ('id', 'uploaded_at')


class StatusHistoryInline(admin.TabularInline):
    model = StatusHistory
    extra = 0
    readonly_fields = ('old_status', 'new_status', 'changed_by', 'note', 'changed_at')
    can_delete = False


@admin.register(Complaint)
class ComplaintAdmin(gis_admin.GISModelAdmin):
    """
    OpenStreetMap-powered GIS Admin for civic issue reporting in Nagpur.
    """
    list_display = (
        'tracking_id',
        'title',
        'category',
        'department',
        'ward',
        'status',
        'priority_level',
        'priority_score',
        'citizen',
        'assigned_worker',
        'fake_detected',
        'is_duplicate',
        'submitted_at',
    )
    list_filter = (
        'status',
        'priority_level',
        'category',
        'department',
        'ward',
        'fake_detected',
        'is_duplicate',
        'ward_override',
        'submitted_at',
    )
    search_fields = (
        'tracking_id',
        'title',
        'description',
        'address',
        'citizen__full_name',
        'citizen__mobile',
        'assigned_worker__full_name',
        'assigned_worker__mobile',
    )
    readonly_fields = (
        'id',
        'tracking_id',
        'department',
        'submitted_at',
        'updated_at',
        'resolved_at',
    )
    inlines = [ComplaintImageInline, StatusHistoryInline]

    # Default map settings centered on Nagpur Zero Mile (21.1458° N, 79.0882° E)
    default_lon = 79.0882
    default_lat = 21.1458
    default_zoom = 12


@admin.register(ComplaintImage)
class ComplaintImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'complaint', 'image_type', 'uploaded_at')
    list_filter = ('image_type', 'uploaded_at')
    search_fields = ('complaint__tracking_id',)


@admin.register(StatusHistory)
class StatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('complaint', 'old_status', 'new_status', 'changed_by', 'changed_at')
    list_filter = ('old_status', 'new_status', 'changed_at')
    search_fields = ('complaint__tracking_id', 'note')
