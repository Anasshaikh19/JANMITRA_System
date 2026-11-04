"""
URL configuration for complaints app (JANMITRA - Nagpur Municipal Corporation).
"""

from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    AssignWorkerView,
    AvailableWorkersView,
    CategoryViewSet,
    CitizenComplaintVerifyView,
    ComplaintAssignWorkerView,
    ComplaintListView,
    ComplaintTimelineView,
    ComplaintViewSet,
    MetaCategoryListView,
    MetaWardListView,
    WardViewSet,
    WorkerTaskListView,
    WorkerTaskStatusUpdateView,
    WorkerTaskStatusView,
    WorkerProofUploadView,
)

app_name = 'complaints'

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'wards', WardViewSet, basename='ward')
router.register(r'', ComplaintViewSet, basename='complaint')

urlpatterns = [
    path('summary/', ComplaintViewSet.as_view({'get': 'summary'}), name='complaint-summary-explicit'),
    path('meta/categories/', MetaCategoryListView.as_view(), name='meta-categories-sub'),
    path('meta/wards/', MetaWardListView.as_view(), name='meta-wards-sub'),
    path('list/', ComplaintListView.as_view(), name='complaint-list-view'),
    path('worker/tasks/', WorkerTaskListView.as_view(), name='worker-tasks'),
    path('worker/tasks/<str:pk>/status/', WorkerTaskStatusView.as_view(), name='worker-task-status'),
    path('worker/tasks/<str:pk>/proof/', WorkerProofUploadView.as_view(), name='worker-proof-upload'),
    path('<str:pk>/status/', ComplaintViewSet.as_view({'patch': 'update_status', 'post': 'update_status'}), name='complaint-status-patch'),
    path('<str:pk>/proof-upload/', ComplaintViewSet.as_view({'post': 'proof_upload'}), name='complaint-proof-upload'),
    path('<str:pk>/assign/', ComplaintAssignWorkerView.as_view(), name='complaint-assign'),
    path('<str:pk>/verify/', CitizenComplaintVerifyView.as_view(), name='complaint-verify'),
    path('<str:pk>/timeline/', ComplaintTimelineView.as_view(), name='complaint-timeline'),
    path('worker/available/', AvailableWorkersView.as_view(), name='worker-available'),
] + router.urls

