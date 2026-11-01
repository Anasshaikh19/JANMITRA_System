"""
URL configuration for dashboard app (JANMITRA - Nagpur Municipal Corporation).
"""

from django.urls import path
from .views import (
    CategoryBreakdownView,
    ComplaintsExportView,
    DashboardOverviewView,
    DeptKPIView,
    HighPriorityView,
    ManualValidateView,
    OverdueComplaintsView,
    PendingValidationView,
    SystemSettingsView,
    TrendsView,
    WardBreakdownView,
    WardStatsView,
    WorkerWorkloadView,
)

app_name = 'dashboard'

urlpatterns = [
    # System settings endpoint
    path('settings/', SystemSettingsView.as_view(), name='settings'),
    path('admin/settings/', SystemSettingsView.as_view(), name='admin_settings'),

    # Required core dashboard endpoints
    path('export/', ComplaintsExportView.as_view(), name='export'),
    path('kpi/', DeptKPIView.as_view(), name='kpi'),
    path('overdue/', OverdueComplaintsView.as_view(), name='overdue'),
    path('ward-stats/', WardStatsView.as_view(), name='ward_stats'),
    path('trends/', TrendsView.as_view(), name='trends'),
    path('workers/', WorkerWorkloadView.as_view(), name='workers'),
    path('high-priority/', HighPriorityView.as_view(), name='high_priority'),
    path('pending-validation/', PendingValidationView.as_view(), name='pending_validation'),
    path('complaints/<str:id>/validate/', ManualValidateView.as_view(), name='complaint_validate'),
    path('complaints/<uuid:pk>/validate/', ManualValidateView.as_view(), name='complaint_validate_pk'),

    # Backward compatibility endpoints
    path('overview/', DashboardOverviewView.as_view(), name='dashboard_overview'),
    path('wards/', WardBreakdownView.as_view(), name='ward_breakdown'),
    path('categories/', CategoryBreakdownView.as_view(), name='category_breakdown'),
]
