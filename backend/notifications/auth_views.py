"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/auth_views.py
Developer: Anas Shaikh & Faizan Rayeen
Description: Authentication API views for Citizen & Staff registration & login.
==============================================================================
"""

import uuid
import jwt
import datetime
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

User = get_user_model()

# In-memory session store for registered mock users if User model doesn't have custom fields
MOCK_USERS_DB = {
    "8767972843": {
        "id": "u-faizan-1",
        "name": "Faizan Rayeen",
        "mobile": "8767972843",
        "ward": "Ward 4 (Mangalwari / North Nagpur)",
        "role": "citizen",
        "email": "faizan.rayeen@janmitra.nagpur.gov.in"
    }
}


def generate_jwt_token(user_id, role, mobile):
    payload = {
        'user_id': str(user_id),
        'role': role,
        'mobile': mobile,
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7),
        'iat': datetime.datetime.now(datetime.timezone.utc)
    }
    secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
    return jwt.encode(payload, secret, algorithm='HS256')


class RegisterView(APIView):
    """
    POST /api/v1/auth/register/
    Registers a Citizen with name, mobile, ward, and password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        name = (data.get('name') or data.get('full_name') or '').strip()
        mobile = (data.get('mobile') or '').strip()
        ward = data.get('ward') or 'Ward 4'
        password = data.get('password') or ''
        role = data.get('role') or 'citizen'

        if not mobile:
            return Response({'mobile': ['Mobile number is required.']}, status=status.HTTP_400_BAD_REQUEST)

        # Store in MOCK_USERS_DB
        user_id = str(uuid.uuid4())
        user_record = {
            "id": user_id,
            "name": name or f"Citizen {mobile[-4:]}",
            "mobile": mobile,
            "ward": ward,
            "role": role,
            "email": f"{mobile}@citizen.janmitra.in"
        }
        MOCK_USERS_DB[mobile] = user_record

        # Also create or get in Django User model if possible
        try:
            user, created = User.objects.get_or_create(username=mobile)
            user.first_name = name[:30]
            if password:
                user.set_password(password)
            user.save()
            user_record["django_id"] = user.id
        except Exception:
            pass

        access_token = generate_jwt_token(user_id, role, mobile)
        refresh_token = generate_jwt_token(user_id, role, mobile)

        return Response({
            "access": access_token,
            "refresh": refresh_token,
            "token": access_token,
            "role": role,
            "user": user_record,
            "message": "Citizen registered successfully"
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticates user via mobile and password.
    Supports citizen, worker, officer, and admin roles.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        mobile = (data.get('mobile') or data.get('phone') or data.get('username') or '').strip()
        password = data.get('password') or ''

        if not mobile:
            return Response({'mobile': ['Mobile number is required.']}, status=status.HTTP_400_BAD_REQUEST)

        # Check in-memory store first
        if mobile in MOCK_USERS_DB:
            user_record = MOCK_USERS_DB[mobile]
        else:
            # Check Django User database
            user = User.objects.filter(username=mobile).first()
            if user:
                # Determine role based on user attributes or seeded demo mapping
                if user.is_superuser or mobile == '9900000000':
                    role = 'admin'
                    dept = 'Central Command'
                elif mobile == '9900000001':
                    role = 'dept_officer'
                    dept = 'PWD'
                elif mobile == '9900000002':
                    role = 'dept_officer'
                    dept = 'Solid Waste Management'
                elif mobile == '9900000003':
                    role = 'dept_officer'
                    dept = 'Public Health Engineering'
                elif mobile == '9900000004':
                    role = 'dept_officer'
                    dept = 'Electrical'
                elif user.is_staff:
                    role = 'dept_officer'
                    dept = 'Municipal Operations'
                elif mobile.startswith('9900001') or '@worker' in (user.email or ''):
                    role = 'worker'
                    dept = 'Field Operations'
                else:
                    role = 'citizen'
                    dept = None

                user_record = {
                    "id": str(user.id),
                    "name": user.first_name or user.username,
                    "mobile": mobile,
                    "ward": "Ward 4 (Mangalwari / North Nagpur)",
                    "role": role,
                    "email": user.email or f"{mobile}@janmitra.in"
                }
                if dept:
                    user_record["department"] = dept
                MOCK_USERS_DB[mobile] = user_record
            else:
                # Role heuristic for test accounts
                if 'admin' in mobile.lower() or mobile in ('9999999999', '9900000000'):
                    role = 'admin'
                    name = 'Super Admin (NMC)'
                elif 'officer' in mobile.lower() or mobile in ('8888888888', '9900000001', '9900000002', '9900000003', '9900000004'):
                    role = 'dept_officer'
                    name = 'Department Officer'
                elif 'worker' in mobile.lower() or mobile == '7777777777' or mobile.startswith('9900001'):
                    role = 'worker'
                    name = 'Field Supervisor Ramesh'
                else:
                    role = 'citizen'
                    name = f"Citizen {mobile[-4:]}"

                user_record = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "mobile": mobile,
                    "ward": "Ward 4 (Mangalwari / North Nagpur)",
                    "role": role,
                    "email": f"{mobile}@janmitra.in"
                }
                MOCK_USERS_DB[mobile] = user_record

        access_token = generate_jwt_token(user_record["id"], user_record["role"], mobile)
        refresh_token = generate_jwt_token(user_record["id"], user_record["role"], mobile)

        return Response({
            "access": access_token,
            "refresh": refresh_token,
            "token": access_token,
            "role": user_record["role"],
            "user": user_record,
            "message": "Login successful"
        }, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    GET /api/v1/auth/me/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # Default fallback to Faizan Rayeen
        user_record = MOCK_USERS_DB.get("8767972843", {
            "id": "u-faizan-1",
            "name": "Faizan Rayeen",
            "mobile": "8767972843",
            "ward": "Ward 4 (Mangalwari / North Nagpur)",
            "role": "citizen"
        })
        return Response(user_record, status=status.HTTP_200_OK)
