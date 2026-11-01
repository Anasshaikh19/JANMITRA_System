"""
Custom permission classes for accounts app.
"""

from rest_framework.permissions import BasePermission


class IsCitizen(BasePermission):
    """
    Allows access only to authenticated users with role 'citizen'.
    """
    message = "Only citizens are authorized to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'citizen'
        )


class IsWorker(BasePermission):
    """
    Allows access only to authenticated users with role 'worker'.
    """
    message = "Only municipal field workers are authorized to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'worker'
        )


class IsDeptOfficer(BasePermission):
    """
    Allows access only to authenticated users with role 'dept_officer'.
    """
    message = "Only department officers are authorized to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', None) == 'dept_officer'
        )


class IsAdmin(BasePermission):
    """
    Allows access only to authenticated administrators.
    Checks role == 'admin' or Django is_staff/is_superuser.
    """
    message = "Administrator privileges required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                getattr(request.user, 'role', None) == 'admin' or
                getattr(request.user, 'is_staff', False) or
                getattr(request.user, 'is_superuser', False)
            )
        )


class IsAdminOrDeptOfficer(BasePermission):
    """
    Allows access only to authenticated administrators or department officers.
    Requires role == 'admin' or role == 'dept_officer', or is_superuser=True.
    Does not treat is_staff=True alone as sufficient authorization if the role
    is citizen, worker, or any unintended non-admin account.
    """
    message = "Administrator or Department Officer privileges required."

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False

        role = getattr(user, 'role', None)
        if role in ['citizen', 'worker']:
            return False

        if role in ['admin', 'dept_officer']:
            return True

        if getattr(user, 'is_superuser', False):
            return True

        if getattr(user, 'is_staff', False) and role == 'admin':
            return True

        return False


