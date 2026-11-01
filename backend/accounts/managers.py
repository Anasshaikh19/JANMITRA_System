"""
Custom user manager for accounts app.
"""

from django.contrib.auth.models import BaseUserManager


class CustomUserManager(BaseUserManager):
    """
    Custom user manager where mobile number is the unique identifier
    for authentication instead of a username.
    """
    use_in_migrations = True

    def get_by_natural_key(self, identifier):
        """
        Supports looking up users by either email address or mobile number.
        """
        if not identifier:
            raise self.model.DoesNotExist
        identifier = str(identifier).strip()
        if '@' in identifier:
            return self.get(email__iexact=self.normalize_email(identifier).lower())
        return self.get(mobile=identifier)

    def create_user(self, mobile, full_name, password=None, **extra_fields):
        """
        Create and save a User with the given mobile, full_name, and password.
        """
        if not mobile:
            raise ValueError('The Mobile field must be set.')
        if not full_name:
            raise ValueError('The Full name field must be set.')

        if 'email' in extra_fields and extra_fields['email']:
            extra_fields['email'] = self.normalize_email(extra_fields['email']).lower()

        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('role', 'citizen')
        extra_fields.setdefault('status', 'active')

        user = self.model(
            mobile=mobile,
            full_name=full_name,
            **extra_fields
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    def create_superuser(self, mobile, full_name, password=None, **extra_fields):
        """
        Create and save a SuperUser with the given mobile, full_name, and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('status', 'active')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(mobile, full_name, password, **extra_fields)
