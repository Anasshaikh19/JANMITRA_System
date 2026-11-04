"""
URL configuration for resolveIT (JANMITRA - Nagpur Municipal Corporation).

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


from accounts.views import (
    AdminWorkerDetailUpdateView,
    AdminWorkersListCreateView,
    HealthCheckView,
    WorkerDetailView,
    WorkerListCreateView,
)
from complaints.views import (
    AdminComplaintsLedgerView,
    AvailableWorkersView,
    CategoryViewSet,
    MetaCategoryListView,
    MetaWardListView,
    WardViewSet,
    WorkerTaskListView,
    WorkerTaskStatusUpdateView,
    WorkerTaskStatusView,
    WorkerProofUploadView,
)
from dashboard.views import SystemSettingsView


def api_root_view(request):
    return JsonResponse({
        "project": "JANMITRA Civic Grievance System",
        "service": "Municipal Backend API Gateway",
        "version": "1.0.0",
        "status": "online",
        "frontend": "http://localhost:5173",
        "admin": "/admin/",
        "endpoints": {
            "health": "/api/v1/health/",
            "auth": "/api/v1/auth/",
            "complaints": "/api/v1/complaints/",
            "dashboard": "/api/v1/dashboard/",
            "notifications": "/api/v1/notifications/",
            "categories": "/api/v1/meta/categories/",
            "wards": "/api/v1/meta/wards/"
        }
    })


urlpatterns = [
    # Root API Gateway Landing
    path('', api_root_view, name='api_root'),

    # System Health Check (Production-safe, checks DB, Redis, Celery)
    path('api/v1/health/', HealthCheckView.as_view(), name='health_check'),
    path('api/health/', HealthCheckView.as_view(), name='api_health_check'),

    # Django Admin
    path('admin/', admin.site.urls),

    # Auth direct routing & API v1
    path('auth/', include('accounts.urls', namespace='auth_direct')),
    path('api/v1/auth/', include('accounts.urls')),

    # Metadata master endpoints (public frontend dropdowns)
    path('api/v1/meta/categories/', MetaCategoryListView.as_view(), name='meta_categories'),
    path('api/v1/meta/wards/', MetaWardListView.as_view(), name='meta_wards'),

    path('api/v1/categories/', CategoryViewSet.as_view({'get': 'list'}), name='category-list-direct'),
    path('api/v1/categories/<int:pk>/', CategoryViewSet.as_view({'get': 'retrieve'}), name='category-detail-direct'),
    path('api/v1/wards/', WardViewSet.as_view({'get': 'list'}), name='ward-list-direct'),
    path('api/v1/wards/<int:pk>/', WardViewSet.as_view({'get': 'retrieve'}), name='ward-detail-direct'),
    path('api/v1/admin/workers/', AdminWorkersListCreateView.as_view(), name='admin_worker_list_create'),
    path('api/v1/admin/workers/<str:id>/', AdminWorkerDetailUpdateView.as_view(), name='admin_worker_detail'),
    path('api/v1/admin/workers/<int:pk>/', AdminWorkerDetailUpdateView.as_view(), name='admin_worker_detail_pk'),
    path('api/v1/admin/settings/', SystemSettingsView.as_view(), name='admin_system_settings'),
    path('api/v1/admin/complaints/', AdminComplaintsLedgerView.as_view(), name='admin_complaints_ledger'),
    path('api/v1/worker/available/', AvailableWorkersView.as_view(), name='worker-available-direct'),
    path('api/v1/workers/available/', AvailableWorkersView.as_view(), name='workers-available-direct'),
    path('api/v1/worker/tasks/', WorkerTaskListView.as_view(), name='worker_tasks_api'),
    path('worker/tasks/', WorkerTaskListView.as_view(), name='worker_tasks_root'),
    path('api/v1/worker/tasks/<str:pk>/status/', WorkerTaskStatusView.as_view(), name='worker_task_status_api'),
    path('worker/tasks/<str:pk>/status/', WorkerTaskStatusView.as_view(), name='worker_task_status_root'),
    path('api/v1/worker/tasks/<str:pk>/proof/', WorkerProofUploadView.as_view(), name='worker_proof_upload_api'),
    path('worker/tasks/<str:pk>/proof/', WorkerProofUploadView.as_view(), name='worker_proof_upload_root'),
    path('api/v1/worker/tasks/<str:pk>/', WorkerTaskStatusView.as_view(), name='worker_task_detail_api'),
    path('worker/tasks/<str:pk>/', WorkerTaskStatusView.as_view(), name='worker_task_detail_root'),
    path('api/v1/complaints/', include('complaints.urls', namespace='complaints')),
    path('api/v1/dashboard/', include('dashboard.urls', namespace='dashboard')),
    path('dashboard/', include('dashboard.urls', namespace='dashboard_direct')),
    path('api/v1/notifications/', include('notifications.urls', namespace='notifications')),
]

# Serve media and static files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
