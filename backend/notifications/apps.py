import os
from django.apps import AppConfig

class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notifications'
    path = os.path.dirname(os.path.abspath(__file__))
    verbose_name = 'Push & In-App Notifications'
