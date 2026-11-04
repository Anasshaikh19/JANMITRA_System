"""
Authentication and account management views for JANMITRA - Nagpur Municipal Corporation.
"""

import logging
import redis
from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView

from resolveIT import celery_app
from complaints.models import Complaint, Department, Ward
from complaints.views import AvailableWorkersView
from .models import User
from .permissions import IsAdmin, IsAdminOrDeptOfficer, IsDeptOfficer
from .serializers import (
    AdminWorkerCreateSerializer,
    AdminWorkerSerializer,
    AdminWorkerUpdateSerializer,
    CitizenRegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    WorkerCreateSerializer,
    WorkerUpdateSerializer,
)

logger = logging.getLogger('accounts')

# Shared Redis client using existing REDIS_URL configuration
redis_url = getattr(settings, 'REDIS_URL', 'redis://redis:6379/0')
redis_client = redis.from_url(redis_url, socket_timeout=1.5, socket_connect_timeout=1.5)



class CitizenRegisterView(generics.GenericAPIView):
    """
    POST /api/v1/auth/register/
    Citizen self-registration endpoint.
    - Creates user with role='citizen', ward from request
    - Returns: {id, name, mobile, role, ward} + JWT tokens
    """
    serializer_class = CitizenRegisterSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        # Generate JWT tokens for immediate access
        refresh = RefreshToken.for_user(user)
        refresh['mobile'] = user.mobile
        refresh['full_name'] = user.full_name
        refresh['role'] = user.role
        if user.ward:
            refresh['ward_number'] = user.ward.id
            refresh['ward_name'] = user.ward.name

        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        ward_id = user.ward.id if user.ward else None

        return Response(
            {
                'id': user.id,
                'name': user.full_name,
                'mobile': user.mobile,
                'role': user.role,
                'ward': ward_id,
                'access': access_token,
                'refresh': refresh_token,
                'tokens': {
                    'access': access_token,
                    'refresh': refresh_token,
                },
                'user': {
                    'id': user.id,
                    'name': user.full_name,
                    'full_name': user.full_name,
                    'mobile': user.mobile,
                    'role': user.role,
                    'ward': ward_id,
                    'department': user.department.id if user.department else None,
                    'email': user.email,
                    'registered_at': user.registered_at.isoformat() if user.registered_at else None,
                    'stats': {
                        'total': 0,
                        'resolved': 0,
                        'pending': 0,
                        'open': 0,
                        'in_progress': 0,
                    },
                    'rating_stats': {
                        'avg_rating': 0,
                        'rating_count': 0,
                        'satisfaction_score': 100,
                        'satisfaction_grade': 'Active Citizen Standing',
                        'rating_breakdown': {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
                    },
                    'reviews': [],
                },
                'message': 'Citizen registered successfully.',
            },
            status=status.HTTP_201_CREATED
        )


# Backward compatibility alias
RegisterView = CitizenRegisterView


class LoginView(generics.GenericAPIView):
    """
    POST /api/v1/auth/login/
    Validates mobile + password.
    Returns: {access, refresh, user: {id, name, role, ward, department}}
    Returns clear error for wrong credentials (not a 500).
    """
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            errors = serializer.errors
            detail = (
                errors.get('detail') or
                errors.get('non_field_errors') or
                errors.get('mobile') or
                errors.get('password') or
                'Invalid mobile number or password.'
            )
            if isinstance(detail, list):
                detail = detail[0]
            return Response(
                {
                    'error': str(detail),
                    'detail': str(detail),
                    'errors': serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        validated_data = serializer.validated_data
        user = validated_data['user']

        ward_val = user.ward.id if user.ward else None

        dept_name = None
        dept_short_name = None
        dept_id = None
        if user.department:
            dept_id = user.department.id
            dept_short_name = getattr(user.department, 'short_name', None) or f"DEPT-{dept_id}"
            if dept_short_name == 'PWD' or dept_id == 1:
                dept_name = 'Public Works Department (PWD)'
            elif dept_short_name == 'SWM' or dept_id == 2:
                dept_name = 'Solid Waste Management (SWM)'
            elif dept_short_name in ['PHE', 'WSD'] or dept_id == 3:
                dept_name = 'Public Health Engineering (PHE)'
            elif dept_short_name == 'ELEC' or dept_id == 4:
                dept_name = 'Street Lighting & Electrical (ELEC)'
            else:
                dept_name = user.department.name

        profile_data = UserProfileSerializer(user).data
        user_data = {
            'id': user.id,
            'name': user.full_name,
            'full_name': user.full_name,
            'role': user.role,
            'ward': ward_val,
            'ward_id': ward_val,
            'ward_name': user.ward.name if user.ward else None,
            'department': dept_name,
            'department_name': dept_name,
            'department_id': dept_id,
            'dept': dept_name,
            'dept_name': dept_name,
            'dept_code': dept_short_name,
            'mobile': user.mobile,
            'email': user.email,
            'registered_at': user.registered_at.isoformat() if user.registered_at else None,
            'stats': profile_data.get('stats'),
            'reviews': profile_data.get('reviews'),
            'rating_stats': profile_data.get('rating_stats'),
        }

        return Response(
            {
                'message': 'Login successful.',
                'access': validated_data['access'],
                'refresh': validated_data['refresh'],
                'role': user.role,
                'user': user_data,
            },
            status=status.HTTP_200_OK
        )


class TokenRefreshView(BaseTokenRefreshView):
    """
    POST /api/v1/auth/refresh/
    Standard SimpleJWT refresh endpoint.
    Accepts a valid refresh token and returns a fresh access token.
    """
    pass


class FCMTokenUpdateView(generics.GenericAPIView):
    """
    PATCH /api/v1/auth/fcm-token/
    Updates user.fcm_token from request body.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        fcm_token = request.data.get('fcm_token')
        if not fcm_token or not str(fcm_token).strip():
            return Response(
                {'error': 'fcm_token field is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        user.fcm_token = str(fcm_token).strip()
        user.save(update_fields=['fcm_token'])

        return Response(
            {
                'message': 'FCM token updated successfully.',
                'fcm_token': user.fcm_token,
            },
            status=status.HTTP_200_OK
        )

    def post(self, request, *args, **kwargs):
        # Support POST for backward compatibility
        return self.patch(request, *args, **kwargs)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieves or updates the authenticated user's profile details.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class WorkerCreateView(generics.CreateAPIView):
    """
    Admin-only endpoint for creating municipal field workers (preserved for backward compatibility).
    """
    queryset = User.objects.all()
    serializer_class = WorkerCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        worker = serializer.save()
        return Response(
            {
                'message': 'Field worker created successfully.',
                'worker': UserProfileSerializer(worker).data,
            },
            status=status.HTTP_201_CREATED
        )


def serialize_worker_data(worker, active_task_count=None):
    """
    Serializes a worker User model into standardized dictionary output.
    """
    if active_task_count is None:
        active_statuses = ['ASSIGNED', 'IN_PROGRESS', Complaint.Status.ASSIGNED, Complaint.Status.IN_PROGRESS]
        active_task_count = Complaint.objects.filter(
            assigned_worker=worker,
            status__in=active_statuses
        ).count()

    dept_name = worker.department.name if worker.department else None
    ward_name = worker.ward.name if worker.ward else None

    return {
        'id': worker.id,
        'employee_id': worker.employee_id,
        'name': worker.full_name,
        'full_name': worker.full_name,
        'mobile': worker.mobile,
        'email': worker.email,
        'dept': dept_name,
        'department': dept_name,
        'department_id': worker.department_id,
        'ward': ward_name,
        'ward_id': worker.ward_id,
        'designation': worker.designation,
        'active_task_count': active_task_count,
        'status': worker.status,
    }


class AdminWorkersListCreateView(generics.GenericAPIView):
    """
    GET/POST /api/v1/admin/workers/
    Permission: IsAdminOrDeptOfficer

    GET:
    - Admin: all workers (filterable by search, department, ward, status)
    - DeptOfficer: strictly restricted to workers in their own assigned department
    - Query Parameters:
      * search: filters by full_name, employee_id, or mobile (substring match)
      * department (or dept / dept_id): filters by department ID or name (Admin only; Dept Officer locked)
      * ward (or ward_id): filters by ward ID or name
      * status: filters by status (e.g. ACTIVE, INACTIVE)
    - Returns: list of worker records with complete metadata and active_task_count.

    POST:
    - Creates a new field worker account (role='worker', is_staff=False).
    - Requires: employee_id, mobile, ward, department, designation, and name/full_name.
    - If user is Dept Officer: department is strictly locked to request.user.department.
      Explicit attempts to specify another department return HTTP 403 Forbidden.
    - If user is Admin: can set any valid municipal department (1-4).
    - Validation:
      * mobile: must be exactly 10 digits and unique.
      * employee_id: must be unique and non-empty.
      * ward: must be integer 1-4 and exist in Ward.
      * department: must be integer 1-4 and exist in Department.
    - Returns HTTP 201 Created with serialized worker data.
    """
    permission_classes = [IsAdminOrDeptOfficer]
    serializer_class = AdminWorkerCreateSerializer

    def get(self, request, *args, **kwargs):
        user = request.user
        role = getattr(user, 'role', '')
        is_admin = bool(
            user and (
                (role in [User.Role.ADMIN, 'admin'] and role not in ['citizen', 'worker']) or
                getattr(user, 'is_superuser', False)
            )
        )

        workers = User.objects.filter(role=User.Role.WORKER).select_related('ward', 'department')

        # Role filtering: Department Officer is strictly locked to their own department
        if not is_admin:
            officer_dept_id = getattr(user, 'department_id', None)
            if not officer_dept_id:
                return Response([], status=status.HTTP_200_OK)
            workers = workers.filter(department_id=officer_dept_id)
        else:
            dept_param = (
                request.query_params.get('department') or
                request.query_params.get('department_id') or
                request.query_params.get('dept_id') or
                request.query_params.get('dept')
            )
            if dept_param:
                try:
                    workers = workers.filter(department_id=int(dept_param))
                except (ValueError, TypeError):
                    workers = workers.filter(
                        Q(department__name__icontains=dept_param) |
                        Q(department__short_name__icontains=dept_param)
                    )

        ward_param = (
            request.query_params.get('ward') or
            request.query_params.get('ward_id') or
            request.query_params.get('ward_number')
        )
        if ward_param:
            try:
                workers = workers.filter(ward_id=int(ward_param))
            except (ValueError, TypeError):
                workers = workers.filter(ward__name__icontains=ward_param)

        status_param = request.query_params.get('status')
        if status_param:
            workers = workers.filter(status__iexact=status_param.strip())

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            workers = workers.filter(
                Q(full_name__icontains=search) |
                Q(employee_id__icontains=search) |
                Q(mobile__icontains=search)
            )

        active_statuses = ['ASSIGNED', 'IN_PROGRESS', Complaint.Status.ASSIGNED, Complaint.Status.IN_PROGRESS]
        workers = workers.annotate(
            active_task_count=Count(
                'assigned_complaints',
                filter=Q(assigned_complaints__status__in=active_statuses),
                distinct=True
            )
        ).order_by('full_name')

        data = AdminWorkerSerializer(workers, many=True).data
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        try:
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {'department': str(exc.detail)}
            return Response(detail, status=status.HTTP_403_FORBIDDEN)

        worker = serializer.save()
        return Response(AdminWorkerSerializer(worker).data, status=status.HTTP_201_CREATED)


# Alias for backward compatibility across existing routes and test suites
WorkerListCreateView = AdminWorkersListCreateView


class AdminWorkerDetailUpdateView(generics.GenericAPIView):
    """
    GET/PATCH /api/v1/admin/workers/:id/
    Worker Detail and Update endpoint for Administrators and Department Officers.

    Rules & Access Control:
    1. Endpoint: PATCH /api/v1/admin/workers/:id/
    2. Editable fields: designation, ward, status (Active/Inactive/On Leave).
    3. Immutable fields: employee_id, mobile cannot be changed after creation (HTTP 400).
    4. Department field: editable by Super Admin only; read-only for Dept. Officers (HTTP 403).
    5. Department Officers can only view and manage workers in their own assigned department (HTTP 403).
    """
    permission_classes = [IsAdminOrDeptOfficer]
    serializer_class = AdminWorkerUpdateSerializer

    def get_worker(self, worker_id):
        try:
            return User.objects.filter(
                id=int(worker_id),
                role=User.Role.WORKER
            ).select_related('ward', 'department').first()
        except (ValueError, TypeError):
            return None

    def get(self, request, id=None, pk=None, *args, **kwargs):
        worker_id = id or pk or kwargs.get('id') or kwargs.get('pk')
        worker = self.get_worker(worker_id)
        if not worker:
            return Response(
                {'error': f'Worker with ID {worker_id} not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        user = request.user
        role = getattr(user, 'role', '')
        is_admin = (role in [User.Role.ADMIN, 'admin']) or getattr(user, 'is_superuser', False)

        if not is_admin and worker.department_id != getattr(user, 'department_id', None):
            return Response(
                {'error': 'Department officers can only view workers in their own department.'},
                status=status.HTTP_403_FORBIDDEN
            )

        return Response(serialize_worker_data(worker), status=status.HTTP_200_OK)

    def patch(self, request, id=None, pk=None, *args, **kwargs):
        worker_id = id or pk or kwargs.get('id') or kwargs.get('pk')
        worker = self.get_worker(worker_id)
        if not worker:
            return Response(
                {'error': f'Worker with ID {worker_id} not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        user = request.user
        role = getattr(user, 'role', '')
        is_admin = (role in [User.Role.ADMIN, 'admin']) or getattr(user, 'is_superuser', False)

        if not is_admin and worker.department_id != getattr(user, 'department_id', None):
            return Response(
                {'error': 'Department officers can only manage workers in their own department.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(
            instance=worker,
            data=request.data,
            partial=True,
            context={'request': request, 'worker': worker}
        )
        try:
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except PermissionDenied as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {
                'error': str(exc.detail),
                'department': str(exc.detail)
            }
            return Response(detail, status=status.HTTP_403_FORBIDDEN)

        updated_worker = serializer.save()

        # Log change in admin audit
        logger.info(
            f"[ADMIN AUDIT] User {user.id} ({getattr(user, 'role', 'unknown')}) updated worker {updated_worker.id} ({updated_worker.full_name}): fields={list(request.data.keys())}"
        )

        return Response(serialize_worker_data(updated_worker), status=status.HTTP_200_OK)

    def put(self, request, id=None, pk=None, *args, **kwargs):
        return self.patch(request, id, pk, *args, **kwargs)


# Backward compatibility alias
WorkerDetailView = AdminWorkerDetailUpdateView


# --------------------------------------------------------------------------
# 3. WorkerSearchView -- GET /api/v1/worker/available/
# --------------------------------------------------------------------------
WorkerSearchView = AvailableWorkersView


# ==============================================================================
# System Health Check API -- GET /api/v1/health/
# ==============================================================================
class HealthCheckView(APIView):
    """
    GET /api/v1/health/
    Production-safe System Health Check API for JANMITRA.
    Checks Database, Redis, and Celery worker health independently.
    Public access (AllowAny), returning 200 if all healthy, 503 if any service fails.
    """
    permission_classes = [permissions.AllowAny]

    def check_database(self) -> str:
        try:
            User.objects.count()
            return 'connected'
        except Exception as exc:
            logger.warning("HealthCheckView database check failed: %s", exc)
            return 'unavailable'

    def check_redis(self) -> str:
        try:
            if redis_client.ping():
                return 'connected'
            return 'unavailable'
        except Exception as exc:
            logger.warning("HealthCheckView Redis check failed: %s", exc)
            return 'unavailable'

    def check_celery(self) -> str:
        try:
            # Short, bounded timeout (1.0 second) to avoid blocking orchestrator
            responses = celery_app.control.ping(timeout=1.0)
            if responses:
                for node in responses:
                    if isinstance(node, dict):
                        for worker_name, status_dict in node.items():
                            if status_dict == 'pong' or (
                                isinstance(status_dict, dict) and status_dict.get('ok') == 'pong'
                            ):
                                return 'connected'
                    elif node == 'pong' or node == {'ok': 'pong'}:
                        return 'connected'
            return 'unavailable'
        except Exception as exc:
            logger.warning("HealthCheckView Celery check failed: %s", exc)
            return 'unavailable'

    def get(self, request, *args, **kwargs):
        db_status = self.check_database()
        redis_status = self.check_redis()
        celery_status = self.check_celery()

        is_healthy = (
            db_status == 'connected'
            and redis_status == 'connected'
            and celery_status == 'connected'
        )

        response_data = {
            'status': 'healthy' if is_healthy else 'unhealthy',
            'database': db_status,
            'redis': redis_status,
            'celery': celery_status,
            'timestamp': timezone.now().isoformat(),
        }

        http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(response_data, status=http_status)


