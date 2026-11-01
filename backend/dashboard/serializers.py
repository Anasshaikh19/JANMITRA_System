"""
Serializers for civic dashboard analytics and municipal reporting.
"""

from rest_framework import serializers
from .models import SystemSettings, WardMetric


class SystemSettingsSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing and updating system-wide settings.
    """
    sla_critical_hours = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Resolution deadline in hours for CRITICAL priority complaints (default: 24)"
    )
    sla_high_hours = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Resolution deadline in hours for HIGH priority complaints (default: 48)"
    )
    sla_medium_hours = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Resolution deadline in hours for MEDIUM priority complaints (default: 72)"
    )
    auto_close_hours = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Hours after resolution before unverified complaints are automatically closed (default: 72)"
    )
    broadcast_message = serializers.CharField(
        max_length=500,
        allow_blank=True,
        required=False,
        help_text="Broadcast message string displayed on citizen app banner"
    )

    class Meta:
        model = SystemSettings
        fields = [
            'sla_critical_hours',
            'sla_high_hours',
            'sla_medium_hours',
            'auto_close_hours',
            'broadcast_message',
        ]

    def validate_broadcast_message(self, value):
        if value is None:
            return ""
        return str(value).strip()


class WardMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = WardMetric
        fields = [
            'id',
            'ward_number',
            'ward_name',
            'date',
            'total_complaints',
            'pending_complaints',
            'in_progress_complaints',
            'resolved_complaints',
            'sla_breaches',
            'avg_resolution_hours',
            'created_at',
        ]


class DashboardOverviewSerializer(serializers.Serializer):
    total_complaints = serializers.IntegerField()
    pending = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    resolved = serializers.IntegerField()
    critical = serializers.IntegerField()
    resolution_rate_percentage = serializers.FloatField()
    avg_resolution_hours = serializers.FloatField()


class SeverityDistributionItemSerializer(serializers.Serializer):
    level = serializers.CharField()
    count = serializers.IntegerField()
    percentage = serializers.FloatField()


class DeptKPISerializer(serializers.Serializer):
    total = serializers.IntegerField()
    pending = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    resolved = serializers.IntegerField()
    rejected = serializers.IntegerField()
    avg_resolution_days = serializers.FloatField()
    severity_distribution = SeverityDistributionItemSerializer(many=True)


class WardStatSerializer(serializers.Serializer):
    ward_id = serializers.IntegerField()
    ward_name = serializers.CharField()
    total = serializers.IntegerField()
    pending = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    resolved = serializers.IntegerField()
    rejected = serializers.IntegerField()


class TrendPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    submitted = serializers.IntegerField()
    resolved = serializers.IntegerField()


class WorkerWorkloadSerializer(serializers.Serializer):
    worker_id = serializers.IntegerField()
    name = serializers.CharField()
    ward_name = serializers.CharField(allow_null=True)
    active_tasks = serializers.IntegerField()
    completed_week = serializers.IntegerField()
    avg_resolution_days = serializers.FloatField()
    status = serializers.CharField()


class HighPriorityComplaintSerializer(serializers.Serializer):
    id = serializers.CharField()
    category_name = serializers.CharField(allow_blank=True)
    ward_name = serializers.CharField(allow_blank=True)
    priority_level = serializers.CharField()
    status = serializers.CharField()
    days_open = serializers.FloatField()
    assigned_worker_name = serializers.CharField(allow_null=True, required=False)


class PendingValidationComplaintSerializer(serializers.Serializer):
    id = serializers.CharField()
    tracking_id = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    category_name = serializers.CharField(allow_blank=True, allow_null=True)
    ward_name = serializers.CharField(allow_blank=True, allow_null=True)
    department_name = serializers.CharField(allow_blank=True, allow_null=True)
    status = serializers.CharField()
    ai_confidence = serializers.FloatField(allow_null=True, required=False)
    first_image_thumbnail_url = serializers.CharField(allow_null=True, required=False)
    thumbnail_url = serializers.CharField(allow_null=True, required=False)


class ManualValidateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['validate', 'reject'])
    reason = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if attrs.get('action') == 'reject' and not attrs.get('reason', '').strip():
            raise serializers.ValidationError({'reason': "Reason is required when action is 'reject'."})
        return attrs


class OverdueComplaintSerializer(serializers.Serializer):
    id = serializers.CharField()
    tracking_id = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    category_name = serializers.CharField(allow_blank=True, allow_null=True)
    department_id = serializers.IntegerField(allow_null=True)
    department_name = serializers.CharField(allow_blank=True, allow_null=True)
    ward_id = serializers.IntegerField(allow_null=True)
    ward_name = serializers.CharField(allow_blank=True, allow_null=True)
    priority = serializers.CharField()
    priority_level = serializers.CharField()
    status = serializers.CharField()
    submitted_at = serializers.DateTimeField()
    sla_target_hours = serializers.IntegerField()
    sla_deadline = serializers.DateTimeField()
    elapsed_hours = serializers.FloatField()
    overdue_hours = serializers.FloatField()
    hours_overdue = serializers.FloatField()
    days_overdue = serializers.FloatField()
    is_overdue = serializers.BooleanField()
    assigned_worker_id = serializers.IntegerField(allow_null=True, required=False)
    assigned_worker_name = serializers.CharField(allow_null=True, required=False)


