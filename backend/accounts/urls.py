"""
URL configuration for accounts app (JANMITRA - Nagpur Municipal Corporation).
"""

from django.urls import path

from .views import (
    AdminWorkerDetailUpdateView,
    AdminWorkersListCreateView,
    CitizenRegisterView,
    FCMTokenUpdateView,
    LoginView,
    RegisterView,
    TokenRefreshView,
    UserProfileView,
    WorkerCreateView,
    WorkerDetailView,
    WorkerListCreateView,
)

app_name = 'accounts'

urlpatterns = [
    # Primary API routes (accessible via /api/v1/auth/<path> or /auth/<path>)
    path('register/', CitizenRegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('fcm-token/', FCMTokenUpdateView.as_view(), name='fcm_token'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('workers/', WorkerCreateView.as_view(), name='worker_create'),
    path('admin/workers/', AdminWorkersListCreateView.as_view(), name='admin_workers'),
    path('admin/workers/<str:id>/', AdminWorkerDetailUpdateView.as_view(), name='admin_worker_detail'),
    path('admin/workers/<int:pk>/', AdminWorkerDetailUpdateView.as_view(), name='admin_worker_detail_pk'),

    # Direct routes for backward compatibility when included at root
    path('auth/register/', CitizenRegisterView.as_view(), name='auth_register'),
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/fcm-token/', FCMTokenUpdateView.as_view(), name='auth_fcm_token'),
]
