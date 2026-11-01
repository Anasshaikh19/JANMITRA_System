"""
Views for dashboard analytics and municipal reporting (JANMITRA - Nagpur Municipal Corporation).
"""

import csv
import logging
import uuid
from datetime import datetime, timedelta
from django.db import transaction
from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdmin, IsAdminOrDeptOfficer, IsDeptOfficer
from complaints.models import Category, Complaint, Department, StatusHistory, Ward
from complaints.tasks import route_complaint
from .models import SystemSettings, WardMetric
from .serializers import (
    DashboardOverviewSerializer,
    DeptKPISerializer,
    HighPriorityComplaintSerializer,
    ManualValidateSerializer,
    OverdueComplaintSerializer,
    PendingValidationComplaintSerializer,
    SystemSettingsSerializer,
    TrendPointSerializer,
    WardMetricSerializer,
    WardStatSerializer,
    WorkerWorkloadSerializer,
)

logger = logging.getLogger('dashboard')


def get_dept_filtered_qs(request):
    """
    Helper function to filter Complaint queryset based on user role:
    - If admin: return Complaint.objects.all() (or filtered by ?dept_id / ?department param)
    - If dept_officer: return Complaint.objects.filter(department=request.user.department)
    """
    user = request.user
    role = getattr(user, 'role', '')
    is_admin = (role in [User.Role.ADMIN, 'admin']) or getattr(user, 'is_superuser', False)

    if is_admin:
        qs = Complaint.objects.all()
        dept_id = (
            request.query_params.get('dept_id') or
            request.query_params.get('department') or
            request.query_params.get('department_id')
        )
        if dept_id:
            try:
                qs = qs.filter(department_id=int(dept_id))
            except (ValueError, TypeError):
                qs = qs.filter(
                    Q(department__name__iexact=str(dept_id).strip()) |
                    Q(department__short_name__iexact=str(dept_id).strip())
                )
        return qs
    elif role in [User.Role.DEPT_OFFICER, 'dept_officer']:
        if user.department_id:
            return Complaint.objects.filter(department_id=user.department_id)
        return Complaint.objects.none()
    else:
        return Complaint.objects.filter(citizen=user)


class DashboardOverviewView(APIView):
    """
    Overarching civic issue KPIs for NMC command center (preserved for backward compatibility).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = get_dept_filtered_qs(request)
        total = qs.count()
        submitted = qs.filter(status__in=[Complaint.Status.SUBMITTED, 'Pending Validation']).count()
        in_progress = qs.filter(status__in=[Complaint.Status.IN_PROGRESS, Complaint.Status.ASSIGNED]).count()
        resolved = qs.filter(status__in=[Complaint.Status.RESOLVED, 'Closed']).count()
        critical = qs.filter(priority_level=Complaint.Priority.CRITICAL).count()

        resolution_rate = (resolved / total * 100.0) if total > 0 else 0.0

        resolved_complaints = qs.filter(
            status__in=[Complaint.Status.RESOLVED, 'Closed'],
            resolved_at__isnull=False
        )
        avg_hours = 0.0
        if resolved_complaints.exists():
            durations = [
                (c.resolved_at - c.submitted_at).total_seconds() / 3600.0
                for c in resolved_complaints
            ]
            if durations:
                avg_hours = sum(durations) / len(durations)

        data = {
            'total_complaints': total,
            'pending': submitted,
            'in_progress': in_progress,
            'resolved': resolved,
            'critical': critical,
            'resolution_rate_percentage': round(resolution_rate, 2),
            'avg_resolution_hours': round(avg_hours, 2),
        }
        return Response(data, status=status.HTTP_200_OK)


class WardBreakdownView(APIView):
    """
    Breakdown of complaints by ward (preserved for backward compatibility).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = get_dept_filtered_qs(request)
        breakdown = (
            qs.values(ward_number=F('ward__id'), ward_name=F('ward__name'))
            .annotate(
                total=Count('id'),
                pending=Count('id', filter=Q(status__in=[Complaint.Status.SUBMITTED, 'Pending Validation'])),
                resolved=Count('id', filter=Q(status__in=[Complaint.Status.RESOLVED, 'Closed'])),
            )
            .order_by('ward_number')
        )
        return Response(breakdown, status=status.HTTP_200_OK)


class CategoryBreakdownView(APIView):
    """
    Distribution of complaints by category (preserved for backward compatibility).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = get_dept_filtered_qs(request)
        categories = (
            qs.values(category=F('category__name'))
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        return Response(categories, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 1. DeptKPIView -- GET /api/v1/dashboard/kpi/
# --------------------------------------------------------------------------
class DeptKPIView(APIView):
    """
    GET /api/v1/dashboard/kpi/
    Params: dept_id (admin only), ward_id, date_from, date_to, severity
    Returns:
    {
      total: int, pending: int, in_progress: int, resolved: int, rejected: int,
      avg_resolution_days: float,
      severity_distribution: [{level: str, count: int, percentage: float}]
    }
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def get(self, request):
        qs = get_dept_filtered_qs(request)

        # Query param filters
        ward_id = request.query_params.get('ward_id')
        if ward_id:
            qs = qs.filter(ward_id=ward_id)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(submitted_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(submitted_at__date__lte=date_to)

        severity = request.query_params.get('severity')
        if severity:
            qs = qs.filter(priority_level__iexact=severity.strip())

        total = qs.count()
        pending = qs.filter(status__in=['SUBMITTED', 'Pending Validation', Complaint.Status.SUBMITTED]).count()
        in_progress = qs.filter(status__in=['IN_PROGRESS', 'ASSIGNED', Complaint.Status.IN_PROGRESS, Complaint.Status.ASSIGNED]).count()
        resolved = qs.filter(status__in=['RESOLVED', 'Closed', Complaint.Status.RESOLVED, Complaint.Status.CLOSED]).count()
        rejected = qs.filter(status__in=['REJECTED', 'Invalid', Complaint.Status.REJECTED, Complaint.Status.INVALID]).count()

        # avg_resolution_days: average of (resolved_at - submitted_at) for closed/resolved complaints
        closed_qs = qs.filter(
            status__in=['Closed', 'RESOLVED', Complaint.Status.CLOSED, Complaint.Status.RESOLVED],
            resolved_at__isnull=False
        )
        durations = [
            (c.resolved_at - c.submitted_at).total_seconds() / 86400.0
            for c in closed_qs
        ]
        avg_resolution_days = round(sum(durations) / len(durations), 2) if durations else 0.0

        # severity_distribution
        severity_distribution = []
        for level in [Complaint.Priority.LOW, Complaint.Priority.MEDIUM, Complaint.Priority.HIGH, Complaint.Priority.CRITICAL]:
            lvl_count = qs.filter(priority_level=level).count()
            lvl_pct = round((lvl_count / total * 100.0), 2) if total > 0 else 0.0
            severity_distribution.append({
                'level': level.capitalize(),
                'count': lvl_count,
                'percentage': lvl_pct,
            })

        data = {
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'resolved': resolved,
            'rejected': rejected,
            'avg_resolution_days': avg_resolution_days,
            'severity_distribution': severity_distribution,
        }
        return Response(data, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 2. WardStatsView -- GET /api/v1/dashboard/ward-stats/
# --------------------------------------------------------------------------
class WardStatsView(APIView):
    """
    GET /api/v1/dashboard/ward-stats/
    Returns per-ward breakdown:
    [{ward_id, ward_name, total, pending, in_progress, resolved, rejected}]
    (for each of the 4 wards)
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def get(self, request):
        qs = get_dept_filtered_qs(request)
        wards = Ward.objects.all().order_by('id')

        breakdown = []
        for ward in wards:
            w_qs = qs.filter(ward=ward)
            total = w_qs.count()
            pending = w_qs.filter(status__in=['SUBMITTED', 'Pending Validation', Complaint.Status.SUBMITTED]).count()
            in_progress = w_qs.filter(status__in=['IN_PROGRESS', 'ASSIGNED', Complaint.Status.IN_PROGRESS, Complaint.Status.ASSIGNED]).count()
            resolved = w_qs.filter(status__in=['RESOLVED', 'Closed', Complaint.Status.RESOLVED, Complaint.Status.CLOSED]).count()
            rejected = w_qs.filter(status__in=['REJECTED', 'Invalid', Complaint.Status.REJECTED, Complaint.Status.INVALID]).count()

            breakdown.append({
                'ward_id': ward.id,
                'ward_name': ward.name,
                'total': total,
                'pending': pending,
                'in_progress': in_progress,
                'resolved': resolved,
                'rejected': rejected,
            })

        return Response(breakdown, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 3. TrendsView -- GET /api/v1/dashboard/trends/
# --------------------------------------------------------------------------
class TrendsView(APIView):
    """
    GET /api/v1/dashboard/trends/
    Params: groupby=day|week|month, date_from, date_to
    Returns: [{date: str, submitted: int, resolved: int}]
    Uses Django's TruncDay/TruncWeek/TruncMonth annotate
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def get(self, request):
        groupby = request.query_params.get('groupby', 'day').lower()
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        qs = get_dept_filtered_qs(request)

        if date_from:
            qs = qs.filter(submitted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(submitted_at__date__lte=date_to)

        if groupby == 'week':
            trunc_sub = TruncWeek('submitted_at')
            trunc_res = TruncWeek('resolved_at')
        elif groupby == 'month':
            trunc_sub = TruncMonth('submitted_at')
            trunc_res = TruncMonth('resolved_at')
        else:
            trunc_sub = TruncDay('submitted_at')
            trunc_res = TruncDay('resolved_at')

        # Submitted counts by period
        submitted_agg = (
            qs.annotate(bucket=trunc_sub)
            .values('bucket')
            .annotate(count=Count('id'))
            .order_by('bucket')
        )
        submitted_map = {}
        for item in submitted_agg:
            b = item.get('bucket')
            if b:
                submitted_map[b.strftime('%Y-%m-%d')] = item['count']

        # Resolved counts by period
        resolved_qs = qs.filter(
            status__in=['RESOLVED', 'Closed', Complaint.Status.RESOLVED, Complaint.Status.CLOSED],
            resolved_at__isnull=False
        )
        resolved_agg = (
            resolved_qs.annotate(bucket=trunc_res)
            .values('bucket')
            .annotate(count=Count('id'))
            .order_by('bucket')
        )
        resolved_map = {}
        for item in resolved_agg:
            b = item.get('bucket')
            if b:
                resolved_map[b.strftime('%Y-%m-%d')] = item['count']

        all_dates = sorted(set(list(submitted_map.keys()) + list(resolved_map.keys())))
        trends = [
            {
                'date': d,
                'submitted': submitted_map.get(d, 0),
                'resolved': resolved_map.get(d, 0),
            }
            for d in all_dates
        ]
        return Response(trends, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 4. WorkerWorkloadView -- GET /api/v1/dashboard/workers/
# --------------------------------------------------------------------------
class WorkerWorkloadView(APIView):
    """
    GET /api/v1/dashboard/workers/
    Params: ward_id (optional filter)
    Returns: [{worker_id, name, ward_name, active_tasks, completed_week, avg_resolution_days, status}]
    For workers in the officer's department (or all for admin)
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', '')
        is_admin = (role in [User.Role.ADMIN, 'admin']) or getattr(user, 'is_superuser', False)

        workers = User.objects.filter(role=User.Role.WORKER).select_related('ward', 'department')
        if is_admin:
            dept_id = request.query_params.get('dept_id')
            if dept_id:
                workers = workers.filter(department_id=dept_id)
        elif role in [User.Role.DEPT_OFFICER, 'dept_officer']:
            workers = workers.filter(department_id=user.department_id)
        else:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        ward_id = request.query_params.get('ward_id')
        if ward_id:
            workers = workers.filter(ward_id=ward_id)

        one_week_ago = timezone.now() - timedelta(days=7)
        active_statuses = ['ASSIGNED', 'IN_PROGRESS', Complaint.Status.ASSIGNED, Complaint.Status.IN_PROGRESS]
        completed_statuses = ['RESOLVED', 'Closed', Complaint.Status.RESOLVED, Complaint.Status.CLOSED]

        workload = []
        for worker in workers:
            assigned_qs = Complaint.objects.filter(assigned_worker=worker)
            active_tasks = assigned_qs.filter(status__in=active_statuses).count()
            completed_week = assigned_qs.filter(
                status__in=completed_statuses,
                resolved_at__gte=one_week_ago
            ).count()

            completed_all = assigned_qs.filter(
                status__in=completed_statuses,
                resolved_at__isnull=False
            )
            durations = [
                (c.resolved_at - c.submitted_at).total_seconds() / 86400.0
                for c in completed_all
            ]
            avg_days = round(sum(durations) / len(durations), 2) if durations else 0.0

            workload.append({
                'worker_id': worker.id,
                'name': worker.full_name,
                'ward_name': worker.ward.name if worker.ward else None,
                'active_tasks': active_tasks,
                'completed_week': completed_week,
                'avg_resolution_days': avg_days,
                'status': worker.status,
            })

        return Response(workload, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 5. HighPriorityView -- GET /api/v1/dashboard/high-priority/
# --------------------------------------------------------------------------
class HighPriorityView(APIView):
    """
    GET /api/v1/dashboard/high-priority/
    Returns: complaints where priority IN [High, Critical] AND status NOT IN [Closed, Invalid]
    Ordered by: days_open DESC (oldest first)
    Returns: [{id, category_name, ward_name, priority_level, status, days_open, assigned_worker_name}]
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def get(self, request):
        qs = get_dept_filtered_qs(request)
        high_priorities = [Complaint.Priority.HIGH, Complaint.Priority.CRITICAL, 'HIGH', 'CRITICAL', 'High', 'Critical']
        excluded_statuses = ['Closed', 'Invalid', Complaint.Status.CLOSED, Complaint.Status.INVALID]

        complaints = (
            qs.filter(priority_level__in=high_priorities)
            .exclude(status__in=excluded_statuses)
            .select_related('category', 'ward', 'assigned_worker')
            .order_by('submitted_at')  # Oldest submitted = largest days_open
        )

        now = timezone.now()
        data = []
        for c in complaints:
            days_open = round((now - c.submitted_at).total_seconds() / 86400.0, 1) if c.submitted_at else 0.0
            data.append({
                'id': str(c.id),
                'category_name': c.category.name if c.category else '',
                'ward_name': c.ward.name if c.ward else '',
                'priority_level': c.priority_level,
                'status': c.status,
                'days_open': days_open,
                'assigned_worker_name': c.assigned_worker.full_name if c.assigned_worker else None,
            })

        return Response(data, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 6. PendingValidationView -- GET /api/v1/dashboard/pending-validation/
# --------------------------------------------------------------------------
class PendingValidationView(APIView):
    """
    GET /api/v1/dashboard/pending-validation/
    Returns: complaints where status='Pending Validation'
    Includes: ai_confidence score, first image thumbnail URL
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def get(self, request):
        qs = get_dept_filtered_qs(request)
        pending_qs = (
            qs.filter(status='Pending Validation')
            .select_related('category', 'ward', 'department')
            .prefetch_related('images')
            .order_by('-submitted_at')
        )

        data = []
        for c in pending_qs:
            first_img = c.images.first()
            thumb_url = None
            if first_img and first_img.image:
                try:
                    thumb_url = request.build_absolute_uri(first_img.image.url)
                except Exception:
                    thumb_url = first_img.image.url

            data.append({
                'id': str(c.id),
                'tracking_id': c.tracking_id,
                'title': c.title,
                'description': c.description,
                'category_name': c.category.name if c.category else None,
                'ward_name': c.ward.name if c.ward else None,
                'department_name': c.department.name if c.department else None,
                'status': c.status,
                'ai_confidence': c.ai_confidence,
                'first_image_thumbnail_url': thumb_url,
                'thumbnail_url': thumb_url,
            })

        return Response(data, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 7. ManualValidateView -- PATCH /api/v1/dashboard/complaints/:id/validate/
# --------------------------------------------------------------------------
class ManualValidateView(APIView):
    """
    PATCH /api/v1/dashboard/complaints/:id/validate/
    Request: {action: 'validate'|'reject', reason: str (if reject)}
    validate: status -> Validated, dispatch route_complaint task
    reject: status -> Invalid, create StatusHistory entry
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def patch(self, request, pk=None, id=None, *args, **kwargs):
        complaint_id = pk or id or kwargs.get('pk') or kwargs.get('id')
        if not complaint_id:
            complaint_id = request.data.get('complaint_id')

        if not complaint_id:
            return Response({'error': 'Complaint ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        is_uuid = False
        try:
            uuid.UUID(str(complaint_id))
            is_uuid = True
        except (ValueError, TypeError):
            is_uuid = False

        base_qs = Complaint.objects.select_related('department', 'ward')
        if is_uuid:
            complaint = base_qs.filter(id=complaint_id).first()
        else:
            complaint = base_qs.filter(tracking_id=complaint_id).first()

        if not complaint:
            return Response({'error': f'Complaint with ID {complaint_id} not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        role = getattr(user, 'role', '')
        if role in [User.Role.DEPT_OFFICER, 'dept_officer']:
            if not user.department_id or complaint.department_id != user.department_id:
                return Response(
                    {'error': 'Department officers can only validate complaints in their own department.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        serializer = ManualValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_val = serializer.validated_data['action']
        reason = serializer.validated_data.get('reason', '').strip()

        old_status = complaint.status

        with transaction.atomic():
            if action_val == 'validate':
                complaint.status = 'Validated'
                complaint.save(update_fields=['status', 'updated_at'])

                StatusHistory.objects.create(
                    complaint=complaint,
                    old_status=old_status,
                    new_status='Validated',
                    changed_by=user,
                    note='Manually validated by municipal officer'
                )

                # Dispatch route_complaint task safely
                try:
                    route_complaint.delay(str(complaint.id))
                except Exception as exc:
                    logger.warning(f"Failed to dispatch route_complaint for {complaint.id}: {exc}")

                return Response({
                    'message': 'Complaint validated successfully.',
                    'id': str(complaint.id),
                    'status': 'Validated'
                }, status=status.HTTP_200_OK)

            else:  # reject
                complaint.status = 'Invalid'
                complaint.save(update_fields=['status', 'updated_at'])

                StatusHistory.objects.create(
                    complaint=complaint,
                    old_status=old_status,
                    new_status='Invalid',
                    changed_by=user,
                    note=f"Rejected during manual validation: {reason}"
                )

                return Response({
                    'message': 'Complaint marked as invalid.',
                    'id': str(complaint.id),
                    'status': 'Invalid',
                    'reason': reason
                }, status=status.HTTP_200_OK)


# --------------------------------------------------------------------------
# 8. OverdueComplaintsView -- GET /api/v1/dashboard/overdue/
# --------------------------------------------------------------------------
class OverdueComplaintsView(APIView):
    """
    GET /api/v1/dashboard/overdue/
    Query parameters:
    - dept_id: Filter by department ID (admins can filter any department; dept officers are scoped to their department)
    - ward_id: Optional filter by municipal ward ID (1 to 4)

    Returns complaints exceeding target SLA:
    Critical=24h, High=48h, Medium=72h, Low=7 days (168h).
    """
    permission_classes = [IsDeptOfficer | IsAdmin]

    def get(self, request):
        from complaints.services import (
            get_overdue_complaints,
            get_sla_deadline,
            get_sla_target_hours,
        )

        dept_id_param = request.query_params.get('dept_id')
        validated_dept_id = None

        if dept_id_param is not None:
            raw_dept = str(dept_id_param).strip()
            if not raw_dept:
                return Response(
                    {'error': 'Department ID parameter cannot be empty.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                validated_dept_id = int(raw_dept)
            except (ValueError, TypeError):
                return Response(
                    {'error': f"Invalid department ID '{dept_id_param}'. Department ID must be a positive integer."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if validated_dept_id <= 0:
                return Response(
                    {'error': f"Invalid department ID '{dept_id_param}'. Department ID must be a positive integer greater than zero."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not Department.objects.filter(id=validated_dept_id).exists():
                return Response(
                    {'error': f"Department with ID {validated_dept_id} does not exist."},
                    status=status.HTTP_404_NOT_FOUND
                )

        ward_id_param = request.query_params.get('ward_id')
        validated_ward_id = None
        if ward_id_param is not None:
            raw_ward = str(ward_id_param).strip()
            if not raw_ward:
                return Response(
                    {'error': 'Ward ID parameter cannot be empty.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                validated_ward_id = int(raw_ward)
            except (ValueError, TypeError):
                return Response(
                    {'error': f"Invalid ward ID '{ward_id_param}'. Ward ID must be a positive integer."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if validated_ward_id <= 0:
                return Response(
                    {'error': f"Invalid ward ID '{ward_id_param}'. Ward ID must be a positive integer greater than zero."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not Ward.objects.filter(id=validated_ward_id).exists():
                return Response(
                    {'error': f"Ward with ID {validated_ward_id} does not exist."},
                    status=status.HTTP_404_NOT_FOUND
                )

        user = request.user
        role = getattr(user, 'role', '')
        is_admin = (role in [User.Role.ADMIN, 'admin']) or getattr(user, 'is_superuser', False)

        if not is_admin:
            if role in [User.Role.DEPT_OFFICER, 'dept_officER', 'dept_officer']:
                # Department officer can only see their own department
                if validated_dept_id is not None and validated_dept_id != user.department_id:
                    return Response(
                        {'error': 'Department officers can only view overdue complaints for their own department.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                dept_to_filter = user.department_id
            else:
                return Response(
                    {'error': 'You do not have permission to access overdue complaints dashboard.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            dept_to_filter = validated_dept_id

        overdue_qs = get_overdue_complaints(
            dept_id=dept_to_filter,
            ward_id=validated_ward_id,
        ).select_related('category', 'department', 'ward', 'assigned_worker')

        now = timezone.now()
        data = []
        for c in overdue_qs:
            deadline = get_sla_deadline(c)
            sla_hours = get_sla_target_hours(c.priority_level)
            elapsed_hours = round((now - c.submitted_at).total_seconds() / 3600.0, 1) if c.submitted_at else 0.0
            overdue_hours = round((now - deadline).total_seconds() / 3600.0, 1) if deadline and now > deadline else 0.0

            data.append({
                'id': str(c.id),
                'tracking_id': c.tracking_id,
                'title': c.title,
                'description': c.description,
                'category_name': c.category.name if c.category else '',
                'department_id': c.department_id,
                'department_name': c.department.name if c.department else '',
                'ward_id': c.ward_id,
                'ward_name': c.ward.name if c.ward else '',
                'priority': c.priority_level,
                'priority_level': c.priority_level,
                'status': c.status,
                'submitted_at': c.submitted_at,
                'sla_target_hours': sla_hours,
                'sla_deadline': deadline,
                'elapsed_hours': elapsed_hours,
                'overdue_hours': overdue_hours,
                'hours_overdue': overdue_hours,
                'days_overdue': round(overdue_hours / 24.0, 1),
                'is_overdue': c.is_overdue,
                'assigned_worker_id': c.assigned_worker_id,
                'assigned_worker_name': c.assigned_worker.full_name if c.assigned_worker else None,
            })

        if request.query_params.get('envelope') == 'true':
            return Response({'count': len(data), 'results': data}, status=status.HTTP_200_OK)

        return Response(data, status=status.HTTP_200_OK)


# ==============================================================================
# Complaints Export Helpers & Streaming View
# ==============================================================================

class Echo:
    """
    An object that implements just the write method of the file-like interface,
    returning value directly for StreamingHttpResponse.
    """
    def write(self, value):
        return value


def parse_export_date(date_str, is_end=False):
    """
    Parses start_date and end_date strings supporting ISO formats and common date formats.
    When is_end is True and a date-only string is passed, sets time to end of day (23:59:59).
    """
    if not date_str:
        return None
    date_str = str(date_str).strip()

    # If date-only string without explicit time (no 'T' and no ':')
    has_time = ('T' in date_str) or (':' in date_str)
    if not has_time:
        d = parse_date(date_str)
        if d is not None:
            if is_end:
                dt = datetime.combine(d, datetime.max.time().replace(microsecond=0))
            else:
                dt = datetime.combine(d, datetime.min.time())
            return timezone.make_aware(dt, timezone.get_current_timezone())

    # Try ISO datetime parser
    dt = parse_datetime(date_str)
    if dt is not None:
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt

    # Try ISO date parser
    d = parse_date(date_str)
    if d is not None:
        if is_end:
            dt = datetime.combine(d, datetime.max.time().replace(microsecond=0))
        else:
            dt = datetime.combine(d, datetime.min.time())
        return timezone.make_aware(dt, timezone.get_current_timezone())

    # Fallback to common formats
    for fmt in ('%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S'):
        try:
            dt_obj = datetime.strptime(date_str, fmt)
            if is_end and fmt in ('%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y'):
                dt_obj = datetime.combine(dt_obj.date(), datetime.max.time().replace(microsecond=0))
            return timezone.make_aware(dt_obj, timezone.get_current_timezone())
        except (ValueError, TypeError):
            continue

    return None


class ComplaintsExportView(APIView):
    """
    GET /api/v1/dashboard/export/?format=csv&start_date=...&end_date=...
    Generates a streaming CSV export of civic complaints.

    Permissions:
    - IsAuthenticated: Must be logged in.
    - IsDeptOfficer or IsAdmin (IsAdminOrDeptOfficer): Central Admin or Department Officer.
    - Department Officers are strictly scoped to complaints in their assigned department.

    Query Parameters:
    - format: 'csv' (default). Returns 400 Bad Request for unsupported formats.
    - start_date: Optional filter for complaints submitted on or after this date/datetime.
    - end_date: Optional filter for complaints submitted on or before this date/datetime.
    - department / dept_id: Optional filter for Central Admin.
    - ward / ward_id: Optional filter by ward.
    - status: Optional filter by status.
    - priority: Optional filter by priority level.

    Columns in CSV:
    Complaint ID, Category, Ward, Status, Priority, Citizen Mobile, Assigned Worker,
    Submitted At, Resolved At, Closed At, Citizen Rating.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrDeptOfficer]

    def perform_content_negotiation(self, request, force=False):
        """
        Bypasses DRF's default format suffix negotiation so ?format=csv query parameter
        does not cause a 404/415 when streaming CSV data directly.
        """
        renderers = self.get_renderers()
        return renderers[0], renderers[0].media_type

    def get(self, request, *args, **kwargs):
        # 1. Format validation
        export_format = request.query_params.get('format', 'csv').strip().lower()
        if export_format not in ['csv', 'text/csv']:
            return Response(
                {'error': f"Unsupported export format '{export_format}'. Supported format: csv."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Date parsing and validation
        start_date_str = request.query_params.get('start_date')
        start_dt = None
        if start_date_str:
            start_dt = parse_export_date(start_date_str, is_end=False)
            if start_dt is None:
                return Response(
                    {'error': "Invalid 'start_date' format. Please use YYYY-MM-DD or ISO 8601 format."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        end_date_str = request.query_params.get('end_date')
        end_dt = None
        if end_date_str:
            end_dt = parse_export_date(end_date_str, is_end=True)
            if end_dt is None:
                return Response(
                    {'error': "Invalid 'end_date' format. Please use YYYY-MM-DD or ISO 8601 format."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if start_dt and end_dt and start_dt > end_dt:
            return Response(
                {'error': "'start_date' cannot be later than 'end_date'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Base QuerySet with departmental role isolation
        qs = get_dept_filtered_qs(request).select_related(
            'category', 'ward', 'citizen', 'assigned_worker', 'department'
        )

        # 4. Apply Date Range Filters
        if start_dt:
            qs = qs.filter(submitted_at__gte=start_dt)
        if end_dt:
            qs = qs.filter(submitted_at__lte=end_dt)

        # 5. Optional Ward Filter
        ward_val = request.query_params.get('ward') or request.query_params.get('ward_id')
        if ward_val:
            try:
                qs = qs.filter(ward_id=int(ward_val))
            except (ValueError, TypeError):
                qs = qs.filter(ward__name__iexact=str(ward_val).strip())

        # 6. Optional Status Filter
        status_val = request.query_params.get('status')
        if status_val:
            qs = qs.filter(status__iexact=str(status_val).strip())

        # 7. Optional Priority Filter
        priority_val = request.query_params.get('priority')
        if priority_val:
            qs = qs.filter(priority_level__iexact=str(priority_val).strip())

        # Deterministic ordering for streaming
        qs = qs.order_by('-submitted_at')

        # 8. Streaming CSV Generator
        def generate_csv_rows():
            pseudo_buffer = Echo()
            writer = csv.writer(pseudo_buffer)

            headers = [
                'Complaint ID',
                'Category',
                'Ward',
                'Status',
                'Priority',
                'Citizen Mobile',
                'Assigned Worker',
                'Submitted At',
                'Resolved At',
                'Closed At',
                'Citizen Rating',
            ]
            yield writer.writerow(headers)

            for c in qs.iterator(chunk_size=1000):
                row = [
                    c.tracking_id or str(c.id),
                    c.category.name if c.category else '',
                    c.ward.name if c.ward else '',
                    c.status or '',
                    c.priority_level or c.priority or '',
                    c.citizen.mobile if c.citizen and c.citizen.mobile else '',
                    c.assigned_worker.full_name if c.assigned_worker and c.assigned_worker.full_name else '',
                    c.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if c.submitted_at else '',
                    c.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if c.resolved_at else '',
                    c.closed_at.strftime('%Y-%m-%d %H:%M:%S') if c.closed_at else '',
                    str(c.citizen_rating) if c.citizen_rating is not None else '',
                ]
                yield writer.writerow(row)

        timestamp_str = timezone.now().strftime('%Y%m%d_%H%M%S')
        filename = f"complaints_export_{timestamp_str}.csv"
        response = StreamingHttpResponse(
            generate_csv_rows(),
            content_type='text/csv; charset=utf-8'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class SystemSettingsView(APIView):
    """
    GET /api/v1/admin/settings/
    PATCH /api/v1/admin/settings/

    System Settings management endpoint restricted to Administrators (IsAdmin).
    Provides singleton configuration for:
    - sla_critical_hours (default 24)
    - sla_high_hours (default 48)
    - sla_medium_hours (default 72)
    - auto_close_hours (default 72)
    - broadcast_message (citizen banner text)
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class = SystemSettingsSerializer

    def get(self, request, *args, **kwargs):
        settings_obj = SystemSettings.get_settings()
        serializer = self.serializer_class(settings_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        settings_obj = SystemSettings.get_settings()
        serializer = self.serializer_class(
            instance=settings_obj,
            data=request.data,
            partial=True
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updated_settings = serializer.save()
        user = request.user
        logger.info(
            f"[ADMIN AUDIT] User {user.id} ({getattr(user, 'role', 'admin')}) updated SystemSettings: fields={list(request.data.keys())}"
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        return self.patch(request, *args, **kwargs)



