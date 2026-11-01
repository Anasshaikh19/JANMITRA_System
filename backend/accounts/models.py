"""
User model for JANMITRA - Nagpur Municipal Corporation Civic Issue System.
"""

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import CustomUserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model supporting civic reporting and administrative roles:
    - citizen: Reports civic issues across municipal wards
    - worker: Resolves issues on the ground (sanitation, roads, lights, etc.)
    - dept_officer: Supervises department-level resolutions and dispatches
    - admin: Municipal Corporation Central Administration
    """

    class Role(models.TextChoices):
        CITIZEN = 'citizen', 'Citizen'
        WORKER = 'worker', 'Worker'
        DEPT_OFFICER = 'dept_officer', 'Department Officer'
        ADMIN = 'admin', 'Admin'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        ON_LEAVE = 'on_leave', 'On Leave'

    full_name = models.CharField(
        max_length=100,
        help_text='Full name of the user'
    )
    mobile = models.CharField(
        max_length=15,
        unique=True,
        null=True,
        blank=True,
        help_text='Primary 10-digit mobile number used for login and authentication'
    )
    email = models.EmailField(
        blank=True,
        help_text='Optional contact email address'
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CITIZEN,
        help_text='Role in civic issue management'
    )
    ward = models.ForeignKey(
        'complaints.Ward',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='users',
        help_text='Associated municipal ward'
    )
    department = models.ForeignKey(
        'complaints.Department',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='users',
        help_text='Associated municipal department'
    )
    designation = models.CharField(
        max_length=100,
        blank=True,
        help_text='Designation for field workers or department staff'
    )
    employee_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        help_text='Official employee ID for workers and officials'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        help_text='Account / duty status'
    )
    fcm_token = models.TextField(
        blank=True,
        help_text='Firebase Cloud Messaging push notification token'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Designates whether this user account is active'
    )
    is_staff = models.BooleanField(
        default=False,
        help_text='Designates whether the user can access the Django admin panel'
    )
    registered_at = models.DateTimeField(
        auto_now_add=True,
        help_text='Timestamp of registration'
    )

    USERNAME_FIELD = 'mobile'
    REQUIRED_FIELDS = ['full_name']

    objects = CustomUserManager()

    class Meta:
        ordering = ['-registered_at']
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.full_name} ({self.mobile})"

    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        return self.full_name

    @property
    def username(self):
        """
        Backward compatibility for packages expecting username.
        Falls back to email or user ID if mobile is NULL.
        """
        return self.mobile if self.mobile else (self.email if self.email else str(self.id))

    @property
    def phone_number(self):
        """
        Alias for mobile number for legacy SMS alerts and references.
        """
        return self.mobile

    @property
    def ward_number(self):
        """
        Returns the integer ward number/ID of the assigned ward, or None.
        """
        return self.ward.id if self.ward else None

    @property
    def ward_name(self):
        """
        Returns the name of the assigned ward, or empty string.
        """
        return self.ward.name if self.ward else ''
