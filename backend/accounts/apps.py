import os
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
    path = os.path.dirname(os.path.abspath(__file__))
    verbose_name = 'Accounts & Civic User Management'
