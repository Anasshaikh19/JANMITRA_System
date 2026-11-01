import os
from django.apps import AppConfig


class DashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard'
    path = os.path.dirname(os.path.abspath(__file__))
    verbose_name = 'Civic Analytics & NMC Ward Dashboard'
