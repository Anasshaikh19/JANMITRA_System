"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: complaints/admin.py
Developer: Anas Shaikh & Faizan Rayeen
Description: Django Admin registration for Complaints, Wards, and Categories.
==============================================================================
"""

from django.contrib import admin
from .models import Complaint, Category, Ward


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ('tracking_id', 'title', 'category', 'ward', 'status', 'citizen', 'assigned_worker', 'created_at')
    list_filter = ('status', 'ward', 'category', 'created_at')
    search_fields = ('tracking_id', 'title', 'description', 'address', 'citizen__username', 'citizen__first_name')
    readonly_fields = ('tracking_id', 'created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'department_id', 'sla_hours')
    list_filter = ('department_id',)
    search_fields = ('name',)


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ('ward_number', 'name')
    ordering = ('ward_number',)
