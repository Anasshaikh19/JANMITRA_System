"""
Admin configuration for accounts app.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Admin configuration for Custom User where mobile is the unique identifier.
    """
    list_display = (
        'mobile',
        'full_name',
        'role',
        'ward',
        'department',
        'designation',
        'employee_id',
        'status',
        'is_active',
        'is_staff',
        'registered_at',
    )
    list_filter = (
        'role',
        'status',
        'is_active',
        'is_staff',
        'ward',
        'department',
        'registered_at',
    )
    search_fields = (
        'mobile',
        'full_name',
        'email',
        'employee_id',
        'designation',
    )
    ordering = ('-registered_at',)
    readonly_fields = ('registered_at', 'last_login')

    # Custom fieldsets since we use mobile instead of username
    fieldsets = (
        (
            'Authentication',
            {
                'fields': ('mobile', 'password'),
            },
        ),
        (
            'Personal Details',
            {
                'fields': ('full_name', 'email'),
            },
        ),
        (
            'Civic & Employment Details',
            {
                'fields': (
                    'role',
                    'ward',
                    'department',
                    'designation',
                    'employee_id',
                    'status',
                ),
            },
        ),
        (
            'Push Notifications',
            {
                'fields': ('fcm_token',),
            },
        ),
        (
            'Permissions & Access',
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'groups',
                    'user_permissions',
                ),
            },
        ),
        (
            'Timestamps',
            {
                'fields': ('registered_at', 'last_login'),
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': (
                    'mobile',
                    'full_name',
                    'password',
                    'role',
                    'ward',
                    'department',
                    'designation',
                    'employee_id',
                    'status',
                    'is_active',
                    'is_staff',
                ),
            },
        ),
    )
