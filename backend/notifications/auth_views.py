"""
==============================================================================
JANMITRA - Civic Issue Reporting & Management System
File: notifications/auth_views.py
Developer: Anas Shaikh & Faizan Rayeen
Description: Production-ready Authentication API views for Citizen Registration &
             Role-based Login (Citizen, Field Worker, Department Officer, Admin).
             100% database-backed with PBKDF2 password verification.
==============================================================================
"""

import re
import uuid
import jwt
import datetime
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

logger = logging.getLogger(__name__)
User = get_user_model()

# Keep empty dictionary for compatibility with external references
MOCK_USERS_DB = {}

# Field Worker registry mapping
WORKER_METADATA = {
    '9822110001': {'name': 'Nitin Bawankar', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)'},
    '9822110002': {'name': 'Vinod Meshram', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)'},
    '9822345671': {'name': 'Suresh Kamble', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 1 (Laxmi Nagar / South-West Nagpur)'},
    '9822345672': {'name': 'Sunita Deshmukh', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli / Central Nagpur)'},
    '9822345673': {'name': 'Sunil Thakre', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 3 (Hanuman Nagar / South-East Nagpur)'},
    '9822345674': {'name': 'Pravin Wankhede', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 4 (Mangalwari / North Nagpur)'},
    '9900001101': {'name': 'Ramesh Patil', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001102': {'name': 'Nitin Bawankar', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001103': {'name': 'Sunil Shinde', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001104': {'name': 'Vilas Wankhede', 'department': 'PWD', 'dept_id': 1, 'ward': 'Ward 4 (Mangalwari)'},
    '9900001201': {'name': 'Ashok Gaikwad', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001202': {'name': 'Sunita Deshmukh', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001203': {'name': 'Kishor Meshram', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001204': {'name': 'Pooja Kohale', 'department': 'Solid Waste Management', 'dept_id': 2, 'ward': 'Ward 4 (Mangalwari)'},
    '9900001301': {'name': 'Vinod Thakre', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001302': {'name': 'Ganesh Bawankule', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001303': {'name': 'Suresh Kamble', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001304': {'name': 'Mahesh Sahare', 'department': 'Public Health Engineering', 'dept_id': 3, 'ward': 'Ward 4 (Mangalwari)'},
    '9900001401': {'name': 'Pravin Wankhede', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 1 (Laxmi Nagar)'},
    '9900001402': {'name': 'Dinesh Meshram', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 2 (Dhantoli)'},
    '9900001403': {'name': 'Sachin Dhote', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 3 (Hanuman Nagar)'},
    '9900001404': {'name': 'Raju Gondane', 'department': 'Electrical', 'dept_id': 4, 'ward': 'Ward 4 (Mangalwari)'},
}

# Department Officer registry mapping
OFFICER_METADATA = {
    '9900000001': {'name': 'Executive Engineer PWD (Shri V. R. Sharma)', 'department': 'PWD', 'dept_id': 1},
    '9900000002': {'name': 'Sanitation Officer SWM (Dr. Anita Deshmukh)', 'department': 'Solid Waste Management', 'dept_id': 2},
    '9900000003': {'name': 'Water Works Engineer PHE (Er. Rajesh Thakre)', 'department': 'Public Health Engineering', 'dept_id': 3},
    '9900000004': {'name': 'Executive Engineer Electrical (Shri K. L. Bawankar)', 'department': 'Electrical', 'dept_id': 4},
}


def generate_jwt_token(user_id, role, mobile):
    """
    Generate HS256 JWT access token valid for 7 days.
    """
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
    Registers a Citizen with name, mobile, email, ward, and password.
    Saves strictly into Django User database with hashed password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        name = (data.get('name') or data.get('full_name') or '').strip()
        mobile = (data.get('mobile') or data.get('phone') or '').strip()
        email = (data.get('email') or '').strip().lower()
        ward = (data.get('ward') or 'Ward 2 (Dhantoli / Central Nagpur)').strip()
        password = data.get('password') or ''

        # 1. Validation checks
        if not name:
            return Response({'name': ['Full name is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if len(name) < 3:
            return Response({'name': ['Name must be at least 3 characters.']}, status=status.HTTP_400_BAD_REQUEST)

        if not mobile:
            return Response({'mobile': ['Mobile number is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if not re.match(r'^[6-9]\d{9}$', mobile):
            return Response({'mobile': ['Enter a valid 10-digit Indian mobile number.']}, status=status.HTTP_400_BAD_REQUEST)

        if not email:
            return Response({'email': ['Email address is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
            return Response({'email': ['Enter a valid email address.']}, status=status.HTTP_400_BAD_REQUEST)

        if not password:
            return Response({'password': ['Password is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 6:
            return Response({'password': ['Password must be at least 6 characters long.']}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Check if mobile already exists in database
        if User.objects.filter(username=mobile).exists():
            print(f"[AUTH REGISTER BLOCKED] Mobile {mobile} is already registered.", flush=True)
            return Response({
                'detail': f'Mobile number {mobile} is already registered. Please sign in.',
                'mobile': ['Mobile number is already registered.']
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Check if email already exists in database
        if User.objects.filter(email=email).exists():
            print(f"[AUTH REGISTER BLOCKED] Email {email} is already in use.", flush=True)
            return Response({
                'detail': f'Email address {email} is already registered. Please use another email or sign in.',
                'email': ['Email address is already registered.']
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Save new citizen to Django Database
        try:
            user = User(
                username=mobile,
                email=email,
                first_name=name,
                last_name=ward,  # Storing ward in last_name
                is_staff=False,
                is_superuser=False
            )
            user.set_password(password)
            user.save()

            # Terminal Console Logging
            print("\n" + "=" * 65, flush=True)
            print("🏛️ [JANMITRA BACKEND] NEW CITIZEN REGISTERED IN DATABASE", flush=True)
            print(f"  👤 Name:     {name}", flush=True)
            print(f"  📱 Mobile:   {mobile}", flush=True)
            print(f"  📧 Email:    {email}", flush=True)
            print(f"  📍 Ward:     {ward}", flush=True)
            print(f"  🔒 Security: PBKDF2 Password Hash Saved in SQLite", flush=True)
            print("=" * 65 + "\n", flush=True)

            user_record = {
                "id": str(user.id),
                "name": user.first_name,
                "mobile": user.username,
                "email": user.email,
                "ward": user.last_name,
                "role": "citizen"
            }

            return Response({
                "status": "success",
                "message": "You have successfully registered! Please sign in with your credentials.",
                "user": user_record
            }, status=status.HTTP_201_CREATED)

        except Exception as exc:
            print(f"[AUTH REGISTER ERROR] Failed to save user: {exc}", flush=True)
            return Response({
                "detail": f"Registration failed due to server error: {str(exc)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticates user strictly via database credentials (mobile/email & password).
    Rejects wrong credentials with 401 Unauthorized.
    Identifies role: citizen, worker, dept_officer, admin.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        identifier = (data.get('mobile') or data.get('phone') or data.get('username') or data.get('email') or '').strip()
        password = data.get('password') or ''

        print(f"\n[AUTH LOGIN REQUEST] Checking database credentials for: '{identifier}'", flush=True)

        if not identifier:
            return Response({'mobile': ['Mobile number or email is required.']}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({'password': ['Password is required.']}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Lookup User in SQLite Database (by mobile/username or email)
        user = User.objects.filter(username=identifier).first()
        if not user and '@' in identifier:
            user = User.objects.filter(email=identifier.lower()).first()

        if not user:
            print(f"[AUTH LOGIN REJECTED] No registered account found for identifier: '{identifier}'", flush=True)
            return Response({
                "detail": "Invalid mobile number or password. Please verify your credentials."
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 2. Verify Password using PBKDF2
        if not user.check_password(password):
            print(f"[AUTH LOGIN REJECTED] Wrong password entered for user '{user.username}' ({user.first_name})", flush=True)
            return Response({
                "detail": "Invalid mobile number or password. Please verify your credentials."
            }, status=status.HTTP_401_UNAUTHORIZED)

        # 3. Determine User Role & Metadata
        mobile = user.username
        dept = None
        ward = user.last_name or 'Ward 2 (Dhantoli / Central Nagpur)'

        if user.is_superuser or mobile == '9900000000':
            role = 'admin'
            dept = 'Central Municipal Command'
            name = user.first_name or 'Super Admin (JMC)'
        elif mobile in OFFICER_METADATA or user.is_staff:
            role = 'dept_officer'
            officer_meta = OFFICER_METADATA.get(mobile, {})
            dept = officer_meta.get('department', 'Municipal Operations')
            name = officer_meta.get('name', user.first_name or 'Department Officer')
        elif mobile in WORKER_METADATA or mobile.startswith('9900001') or '@worker' in (user.email or '') or 'worker' in mobile:
            role = 'worker'
            worker_meta = WORKER_METADATA.get(mobile, {})
            dept = worker_meta.get('department', 'Field Operations')
            ward = worker_meta.get('ward', ward)
            name = worker_meta.get('name', user.first_name or 'Field Worker')
        else:
            role = 'citizen'
            name = user.first_name or f"Citizen {mobile[-4:]}"

        # 4. Generate JWT Tokens
        access_token = generate_jwt_token(user.id, role, mobile)
        refresh_token = generate_jwt_token(user.id, role, mobile)

        user_record = {
            "id": str(user.id),
            "name": name,
            "mobile": mobile,
            "email": user.email,
            "ward": ward,
            "role": role
        }
        if dept:
            user_record["department"] = dept

        # Terminal Console Logging
        print("=" * 65, flush=True)
        print("✅ [JANMITRA BACKEND] AUTHENTICATION VERIFIED & GRANTED", flush=True)
        print(f"  👤 Name:       {name}", flush=True)
        print(f"  📱 Mobile:     {mobile}", flush=True)
        print(f"  📧 Email:      {user.email}", flush=True)
        print(f"  🏷️ Role:       {role.upper()}", flush=True)
        if dept:
            print(f"  🏢 Department: {dept}", flush=True)
        print(f"  📍 Ward:       {ward}", flush=True)
        print("=" * 65 + "\n", flush=True)

        return Response({
            "access": access_token,
            "refresh": refresh_token,
            "token": access_token,
            "role": role,
            "user": user_record,
            "message": "Login successful"
        }, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    GET /api/v1/auth/me/
    Returns current authenticated user from Bearer JWT or Django session.
    Strictly verifies against database; returns 401 if unauthenticated.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        auth_header = request.headers.get('Authorization') or ''
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                secret = getattr(settings, 'SECRET_KEY', 'janmitra-secret-key-2026')
                payload = jwt.decode(token, secret, algorithms=['HS256'])
                user_id = payload.get('user_id')
                mobile = payload.get('mobile')

                user = None
                if user_id:
                    user = User.objects.filter(id=user_id).first()
                if not user and mobile:
                    user = User.objects.filter(username=mobile).first()

                if user:
                    role = payload.get('role', 'citizen')
                    return Response({
                        "id": str(user.id),
                        "name": user.first_name or user.username,
                        "mobile": user.username,
                        "email": user.email,
                        "ward": user.last_name or "Ward 2 (Dhantoli / Central Nagpur)",
                        "role": role
                    }, status=status.HTTP_200_OK)
            except Exception:
                pass

        if request.user and request.user.is_authenticated:
            user = request.user
            role = "admin" if user.is_superuser else ("dept_officer" if user.is_staff else "citizen")
            return Response({
                "id": str(user.id),
                "name": user.first_name or user.username,
                "mobile": user.username,
                "email": user.email,
                "ward": user.last_name or "Ward 2 (Dhantoli / Central Nagpur)",
                "role": role
            }, status=status.HTTP_200_OK)

        return Response(
            {"detail": "Authentication credentials were not provided or invalid."},
            status=status.HTTP_401_UNAUTHORIZED
        )
