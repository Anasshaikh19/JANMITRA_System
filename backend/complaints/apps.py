import os
from django.apps import AppConfig


class ComplaintsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'complaints'
    path = os.path.dirname(os.path.abspath(__file__))
    verbose_name = 'Civic Complaints & Issue Resolution'
