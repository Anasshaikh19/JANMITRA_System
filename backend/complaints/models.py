import uuid
from django.conf import settings
try:
    from django.contrib.gis.db import models as gis_models
except Exception:
    from django.db import models as gis_models
    class MockPointField(gis_models.CharField):
        def __init__(self, *args, **kwargs):
            kwargs.pop('srid', None)
            kwargs.pop('geography', None)
            kwargs.setdefault('max_length', 255)
            kwargs.setdefault('default', '')
            super().__init__(*args, **kwargs)
    gis_models.PointField = MockPointField
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


def complaint_image_upload_path(instance, filename):
    tracking_id = instance.complaint.tracking_id if instance.complaint else 'general'
    return f"complaints/{tracking_id}/{filename}"


def resolution_image_upload_path(instance, filename):
    """Retained for historical migration compatibility."""
    tracking_id = getattr(instance, 'tracking_id', 'general')
    return f"resolutions/{tracking_id}/{filename}"


class Ward(models.Model):
    """
    Nagpur Municipal Corporation Ward representation with fixed ID (1 to 4).
    """
    ZONE_MAPPING = {
        1: 'Central',
        2: 'North',
        3: 'East',
        4: 'West',
    }

    id = models.SmallIntegerField(
        primary_key=True,
        help_text='Fixed Ward ID / Number (1 to 4)'
    )
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text='Ward name (e.g., Ward 1, Ward 2, Ward 3, Ward 4)'
    )

    class Meta:
        ordering = ['id']
        verbose_name = 'Ward'
        verbose_name_plural = 'Wards'

    def __str__(self):
        return self.name

    @property
    def ward_number(self):
        return self.id

    @property
    def ward_code(self):
        return f"WARD-{self.id}"

    @property
    def zone(self):
        return self.ZONE_MAPPING.get(self.id, '')

    @property
    def location(self):
        return self.zone

    @property
    def zone_designation(self):
        return self.zone

    @property
    def display_name(self):
        z = self.zone
        return f"{self.name} — {z}" if z else self.name


class Department(models.Model):
    """
    Nagpur Municipal Corporation civic department with fixed ID (1 to 4).
    """
    id = models.SmallIntegerField(
        primary_key=True,
        help_text='Fixed Department ID (1 to 4)'
    )
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text='Department name (e.g., Public Works Department, Solid Waste Management)'
    )
    short_name = models.CharField(
        max_length=20,
        unique=True,
        help_text='Short code (e.g., PWD, SWM, PHE, ELEC)'
    )

    class Meta:
        ordering = ['id']
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'

    def __str__(self):
        return f"{self.short_name} - {self.name}"


class Category(models.Model):
    """
    Civic grievance category linked to responsible municipal department.
    Uses fixed SmallIntegerField primary key (1 to 8).
    """
    id = models.SmallIntegerField(
        primary_key=True,
        help_text='Fixed Category ID (1 to 8)'
    )
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text='Category name (e.g., Pothole & Road Repair, Garbage Dump & Waste Disposal)'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name='categories',
        help_text='Civic department responsible for resolving this category'
    )

    class Meta:
        ordering = ['id']
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'

    def __str__(self):
        return f"{self.name} ({self.department.short_name})"


class Complaint(gis_models.Model):
    """
    Core civic issue model with UUID primary key and spatial PostGIS PointField.
    """
    class Status(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        ASSIGNED = 'ASSIGNED', 'Assigned'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        RESOLVED = 'RESOLVED', 'Resolved'
        REJECTED = 'REJECTED', 'Rejected'
        CLOSED = 'Closed', 'Closed'
        REOPENED = 'Reopened', 'Reopened'
        PENDING_VALIDATION = 'Pending Validation', 'Pending Validation'
        VALIDATED = 'Validated', 'Validated'
        INVALID = 'Invalid', 'Invalid'
        WORK_DONE = 'Work Done', 'Work Done'
        IN_PROGRESS_ALT = 'In-Progress', 'In-Progress'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    # Primary identification
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text='Primary unique UUID identifier'
    )
    tracking_id = models.CharField(
        max_length=32,
        unique=True,
        editable=False,
        db_index=True,
        help_text='Citizen tracking identifier (e.g., NMC-2024-ABC1234)'
    )
    title = models.CharField(max_length=200, help_text='Brief title of the civic problem')
    description = models.TextField(help_text='Detailed description of the issue')

    # Associations
    citizen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reported_complaints',
        help_text='Citizen who reported the issue'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='complaints',
        help_text='Civic issue category'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name='complaints',
        help_text='Department derived consistently from the selected category'
    )
    ward = models.ForeignKey(
        Ward,
        on_delete=models.PROTECT,
        related_name='complaints',
        help_text='Municipal ward of the complaint'
    )

    # PostGIS Spatial Location (SRID 4326: WGS84 GPS coordinate, geography=True)
    location = gis_models.PointField(
        srid=4326,
        geography=True,
        null=True,
        blank=True,
        help_text='PostGIS Spatial Point (Longitude, Latitude) WGS84'
    )
    address = models.CharField(max_length=255, blank=True, help_text='Street name / Locality in Nagpur')
    landmark = models.CharField(max_length=150, blank=True, help_text='Nearby landmark')

    # Status and Priority
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
        db_index=True
    )
    priority_level = models.CharField(
        max_length=15,
        choices=Priority.choices,
        default=Priority.LOW
    )
    priority_score = models.FloatField(
        default=0.0,
        help_text='Calculated priority/urgency score (0.0 to 100.0)'
    )

    # AI and Fraud / Fake Detection Metadata
    ai_confidence = models.FloatField(
        null=True,
        blank=True,
        help_text='AI category classification confidence score (0.0 to 1.0)'
    )
    fake_detected = models.BooleanField(
        default=False,
        help_text='Flag indicating potential fraudulent or spam complaint'
    )
    fake_detection_score = models.FloatField(
        default=0.0,
        help_text='AI fake/spam probability score (0.0 to 1.0)'
    )
    fake_reason = models.TextField(
        blank=True,
        help_text='AI explanation for fake/spam detection'
    )

    # Duplicate Metadata
    is_duplicate = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Flag indicating this is a duplicate of another complaint'
    )
    parent_complaint = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_complaints',
        help_text='Canonical parent complaint if duplicate'
    )
    similarity_score = models.FloatField(
        null=True,
        blank=True,
        help_text='Similarity score to parent complaint (0.0 to 1.0)'
    )

    # Staff Assignment
    assigned_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_complaints',
        help_text='Municipal worker assigned to resolve this issue'
    )

    # Ward Override Tracking
    ward_override = models.BooleanField(
        default=False,
        help_text='Flag indicating ward was manually overridden'
    )
    original_ward = models.ForeignKey(
        Ward,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='overridden_complaints',
        help_text='Original ward before override'
    )
    override_reason = models.TextField(
        blank=True,
        help_text='Reason for ward reassignment'
    )

    # Citizen Satisfaction Rating & Feedback
    citizen_rating = models.SmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Citizen satisfaction rating (1 to 5 stars)'
    )
    citizen_feedback = models.TextField(
        blank=True,
        help_text='Citizen remarks/feedback upon resolution'
    )
    reopen_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of times complaint was reopened by citizen'
    )

    # Timestamps & Audit
    submitted_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text='Timestamp of submission'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when complaint resolution was verified and closed by citizen'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['ward', 'status']),
            models.Index(fields=['category', 'status']),
            models.Index(fields=['department', 'status']),
            models.Index(fields=['department', 'ward', 'status'], name='complaint_dept_ward_status_idx'),
            models.Index(fields=['citizen', '-submitted_at'], name='complaint_citizen_created_idx'),
        ]
        verbose_name = 'Civic Complaint'
        verbose_name_plural = 'Civic Complaints'

    def clean(self):
        super().clean()
        # Derive department automatically from category
        if self.category_id and not self.department_id:
            self.department = self.category.department

    def save(self, *args, **kwargs):
        # Ensure department matches category department on server
        if self.category_id:
            self.department = self.category.department
        if not self.tracking_id:
            short_id = uuid.uuid4().hex[:7].upper()
            self.tracking_id = f"NMC-{timezone.now().year}-{short_id}"
        if self.status == self.Status.RESOLVED and not self.resolved_at:
            self.resolved_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.tracking_id}] {self.title} - {self.get_status_display()}"

    # Backward-compatibility properties
    @property
    def is_overdue(self) -> bool:
        """
        Boolean property indicating whether this complaint has exceeded its SLA target.
        Targets: Critical=24h, High=48h, Medium=72h, Low=7 days.
        """
        from complaints.services import is_complaint_overdue
        return is_complaint_overdue(self)

    @property
    def resolution_time(self):
        """
        Calculated resolution time in hours from submitted_at to resolved_at.
        Returns float rounded to 2 decimal places, or None if not yet resolved.
        """
        if self.resolved_at and self.submitted_at:
            seconds = (self.resolved_at - self.submitted_at).total_seconds()
            return round(max(0.0, seconds / 3600.0), 2)
        return None

    @property
    def priority(self):
        return self.priority_level

    @priority.setter
    def priority(self, value):
        self.priority_level = value

    @property
    def is_fake_suspected(self):
        return self.fake_detected

    @is_fake_suspected.setter
    def is_fake_suspected(self, value):
        self.fake_detected = value

    @property
    def fake_detection_reason(self):
        return self.fake_reason

    @fake_detection_reason.setter
    def fake_detection_reason(self, value):
        self.fake_reason = value

    @property
    def duplicate_of(self):
        return self.parent_complaint

    @duplicate_of.setter
    def duplicate_of(self, value):
        self.parent_complaint = value

    @property
    def is_ward_overridden(self):
        return self.ward_override

    @is_ward_overridden.setter
    def is_ward_overridden(self, value):
        self.ward_override = value

    @property
    def ward_override_reason(self):
        return self.override_reason

    @ward_override_reason.setter
    def ward_override_reason(self, value):
        self.override_reason = value

    @property
    def ward_number(self):
        return self.ward.id if self.ward else None

    @property
    def ward_name(self):
        return self.ward.name if self.ward else ''

    @property
    def assigned_to(self):
        return self.assigned_worker

    @property
    def created_at(self):
        return self.submitted_at

    @property
    def latitude(self):
        return self.location.y if self.location else None

    @property
    def longitude(self):
        return self.location.x if self.location else None

    @property
    def rating(self):
        return self.citizen_rating

    @rating.setter
    def rating(self, value):
        self.citizen_rating = value

    @property
    def history(self):
        return self.status_history.all()


class ComplaintImage(models.Model):
    """
    Evidence and proof images for complaints (submission photo, resolution proof).
    """
    class ImageType(models.TextChoices):
        COMPLAINT = 'complaint', 'Complaint'
        PROOF = 'proof', 'Proof'

    IMAGE_TYPE_CHOICES = [
        ('complaint', 'Complaint'),
        ('proof', 'Proof'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='images',
        help_text='Associated complaint'
    )
    image = models.ImageField(
        upload_to=complaint_image_upload_path,
        help_text='Uploaded image file'
    )
    image_type = models.CharField(
        max_length=20,
        choices=ImageType.choices,
        default=ImageType.COMPLAINT,
        help_text='Type of image upload (complaint, proof)'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']
        verbose_name = 'Complaint Image'
        verbose_name_plural = 'Complaint Images'

    def __str__(self):
        return f"{self.complaint.tracking_id} - {self.get_image_type_display()}"


class StatusHistory(models.Model):
    """
    Comprehensive audit log tracking each status transition for transparency.
    """
    id = models.BigAutoField(primary_key=True)
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='status_history',
        help_text='Associated complaint'
    )
    old_status = models.CharField(
        max_length=20,
        choices=Complaint.Status.choices,
        null=True,
        blank=True,
        help_text='Previous status before transition'
    )
    new_status = models.CharField(
        max_length=20,
        choices=Complaint.Status.choices,
        help_text='New status after transition'
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='status_changes',
        help_text='User who triggered the status update'
    )
    note = models.TextField(blank=True, help_text='Official remarks or explanation for the change')
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['changed_at']
        verbose_name = 'Status History'
        verbose_name_plural = 'Status History Entries'

    def __str__(self):
        return f"{self.complaint.tracking_id}: {self.old_status} -> {self.new_status} at {self.changed_at}"

    def __init__(self, *args, **kwargs):
        if 'remarks' in kwargs and 'note' not in kwargs:
            kwargs['note'] = kwargs.pop('remarks')
        if 'created_at' in kwargs and 'changed_at' not in kwargs:
            kwargs['changed_at'] = kwargs.pop('created_at')
        super().__init__(*args, **kwargs)

    # Backward-compatibility properties
    @property
    def status(self):
        return self.new_status

    @status.setter
    def status(self, value):
        self.new_status = value

    @property
    def updated_by(self):
        return self.changed_by

    @updated_by.setter
    def updated_by(self, value):
        self.changed_by = value

    @property
    def remarks(self):
        return self.note

    @remarks.setter
    def remarks(self, value):
        self.note = value

    @property
    def created_at(self):
        return self.changed_at

    @created_at.setter
    def created_at(self, value):
        self.changed_at = value

    @property
    def timestamp(self):
        return self.changed_at

    @timestamp.setter
    def timestamp(self, value):
        self.changed_at = value


# Alias for backward compatibility with existing imports
ComplaintTimeline = StatusHistory
