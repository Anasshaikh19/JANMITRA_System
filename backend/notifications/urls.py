"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/urls.py
Developer: Faizan Rayeen (Notifications Lead)
==============================================================================
"""

from django.urls import path
from .views import (
    NotificationListView,
    NotificationMarkReadView,
    FCMTokenRegisterView
)
from .profile_view import UserProfileView
from .auth_views import RegisterView, LoginView, CurrentUserView

urlpatterns = [
    # GET /api/v1/notifications/
    path('', NotificationListView.as_view(), name='notification-list'),

    # PATCH /api/v1/notifications/mark-read/
    path('mark-read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),

    # Auth: POST /api/v1/auth/register/
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('register', RegisterView.as_view(), name='auth-register-notrail'),

    # Auth: POST /api/v1/auth/login/
    path('login/', LoginView.as_view(), name='auth-login'),
    path('login', LoginView.as_view(), name='auth-login-notrail'),

    # Auth: GET /api/v1/auth/me/
    path('me/', CurrentUserView.as_view(), name='auth-me'),
    path('me', CurrentUserView.as_view(), name='auth-me-notrail'),

    # POST or PATCH /api/v1/auth/fcm-token/
    path('fcm-token/', FCMTokenRegisterView.as_view(), name='fcm-token-register'),
    path('fcm-token', FCMTokenRegisterView.as_view(), name='fcm-token-register-notrail'),

    # GET or PATCH /api/v1/auth/profile/
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile', UserProfileView.as_view(), name='user-profile-notrail'),
]
