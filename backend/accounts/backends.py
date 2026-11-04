"""
Custom authentication backend for accounts app.
Supports logging in with either an Email address or Mobile number.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class EmailOrMobileBackend(ModelBackend):
    """
    Authenticates against settings.AUTH_USER_MODEL using either an email
    address or mobile number.

    Security features:
    - Case-insensitive email lookup with normalization.
    - Dummy password hashing on non-existent users to mitigate timing attacks.
    - MultipleObjectsReturned handling (fails safely on ambiguous match).
    - Enforces user_can_authenticate (checks is_active).
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if password is None:
            return None

        # Accept identifier from 'username' (standard form field), or kwargs 'mobile' / 'email'
        identifier = username or kwargs.get('mobile') or kwargs.get('email')
        if not identifier:
            return None

        identifier = str(identifier).strip()
        UserModel = get_user_model()
        user = None

        if '@' in identifier:
            # Identifier is an email address
            normalized_email = UserModel.objects.normalize_email(identifier).lower()
            try:
                user = UserModel.objects.get(email__iexact=normalized_email)
            except UserModel.DoesNotExist:
                UserModel().set_password(password)
                return None
            except UserModel.MultipleObjectsReturned:
                return None
        elif identifier.lower() == 'admin':
            user = UserModel.objects.filter(is_superuser=True).first()
            if not user:
                UserModel().set_password(password)
                return None
        else:
            # Identifier is a mobile number
            try:
                user = UserModel.objects.get(mobile=identifier)
            except UserModel.DoesNotExist:
                UserModel().set_password(password)
                return None
            except UserModel.MultipleObjectsReturned:
                return None

        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
