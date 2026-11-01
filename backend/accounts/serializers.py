"""
Serializers for accounts app (JANMITRA - Nagpur Municipal Corporation).
"""

from django.contrib.auth import authenticate
from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken

from complaints.models import Department, Ward
from .models import User


class CitizenRegisterSerializer(serializers.Serializer):
    """
    Serializer for citizen self-registration.
    Accepts name/full_name, 10-digit mobile, ward (1-4), and password.
    Creates user with role='citizen' and assigned ward.
    """
    name = serializers.CharField(
        max_length=100,
        required=False,
        write_only=True,
        help_text='Citizen full name'
    )
    full_name = serializers.CharField(
        max_length=100,
        required=False,
        write_only=True,
        help_text='Alias for citizen full name'
    )
    mobile = serializers.CharField(
        max_length=15,
        required=True,
        help_text='Exactly 10-digit primary mobile number'
    )
    ward = serializers.IntegerField(
        required=True,
        help_text='Civic Ward number (must be 1, 2, 3, or 4)'
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        default=''
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text='Account login password'
    )

    def validate(self, attrs):
        # 1. Validate name / full_name
        name_val = attrs.get('name') or attrs.get('full_name')
        if not name_val or not str(name_val).strip():
            raise serializers.ValidationError({'name': 'Name is required.'})
        attrs['full_name'] = str(name_val).strip()

        # 2. Validate mobile: must be exactly 10 digits
        mobile_val = str(attrs.get('mobile', '')).strip()
        if not mobile_val:
            raise serializers.ValidationError({'mobile': 'Mobile number is required.'})
        if not (mobile_val.isdigit() and len(mobile_val) == 10):
            raise serializers.ValidationError({'mobile': 'Mobile number must be exactly 10 digits.'})
        if User.objects.filter(mobile=mobile_val).exists():
            raise serializers.ValidationError({'mobile': 'A user with this mobile number already exists.'})
        attrs['mobile'] = mobile_val

        # 3. Validate ward: must be 1, 2, 3, or 4 and must already exist as a seeded ward
        ward_val = attrs.get('ward')
        if ward_val is None:
            raise serializers.ValidationError({'ward': 'Ward is required.'})
        try:
            ward_num = int(ward_val)
        except (ValueError, TypeError):
            raise serializers.ValidationError({'ward': 'Ward must be 1, 2, 3, or 4.'})
        if ward_num not in [1, 2, 3, 4]:
            raise serializers.ValidationError({'ward': 'Ward must be 1, 2, 3, or 4.'})

        # Require existing seeded ward: do NOT silently create missing ward records
        try:
            ward_instance = Ward.objects.get(id=ward_num)
        except Ward.DoesNotExist:
            raise serializers.ValidationError({
                'ward': f'Ward {ward_num} is not configured or seeded. Please select a valid seeded ward.'
            })

        attrs['ward_instance'] = ward_instance
        attrs['ward'] = ward_num

        # 4. Validate password
        password_val = attrs.get('password')
        if not password_val or len(str(password_val)) < 6:
            raise serializers.ValidationError({'password': 'Password must be at least 6 characters long.'})

        # 5. Clean email
        if 'email' in attrs and attrs['email']:
            attrs['email'] = str(attrs['email']).strip().lower()

        return attrs

    def create(self, validated_data):
        validated_data.pop('name', None)
        full_name = validated_data.pop('full_name')
        mobile = validated_data.pop('mobile')
        password = validated_data.pop('password')
        ward_instance = validated_data.pop('ward_instance')
        validated_data.pop('ward', None)
        email = validated_data.pop('email', '')

        user = User.objects.create_user(
            mobile=mobile,
            full_name=full_name,
            password=password,
            role=User.Role.CITIZEN,
            ward=ward_instance,
            email=email,
            **validated_data
        )
        return user


class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login by mobile number or email address with password.
    Returns JWT tokens with role, ward, and department assignments.
    """
    username = serializers.CharField(
        required=False,
        write_only=True,
        help_text='Mobile number or email address'
    )
    mobile = serializers.CharField(
        required=False,
        write_only=True,
        help_text='Registered mobile number'
    )
    email = serializers.EmailField(
        required=False,
        write_only=True,
        help_text='Registered email address'
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text='Account password'
    )

    def validate(self, attrs):
        identifier = attrs.get('mobile') or attrs.get('email') or attrs.get('username')
        password = attrs.get('password')

        if not identifier or not str(identifier).strip():
            raise serializers.ValidationError({
                'mobile': 'Mobile number is required.',
                'detail': 'Mobile number and password are required.'
            })

        if not password or not str(password).strip():
            raise serializers.ValidationError({
                'password': 'Password is required.',
                'detail': 'Password is required.'
            })

        identifier_clean = str(identifier).strip()
        request = self.context.get('request')
        user = authenticate(request=request, username=identifier_clean, password=password)

        if not user:
            raise serializers.ValidationError({
                'detail': 'Invalid mobile number or password.'
            })

        if not user.is_active:
            raise serializers.ValidationError({
                'detail': 'This account has been deactivated.'
            })

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        # Include custom claims in token payload
        refresh['mobile'] = user.mobile
        refresh['email'] = user.email
        refresh['full_name'] = user.full_name
        refresh['role'] = user.role
        if user.ward:
            refresh['ward_number'] = user.ward.id
            refresh['ward_name'] = user.ward.name
        if user.department:
            refresh['department_name'] = user.department.name
            refresh['department_short_name'] = user.department.short_name

        attrs['user'] = user
        attrs['refresh'] = str(refresh)
        attrs['access'] = str(refresh.access_token)
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer returning all readable user profile fields (no password).
    """
    ward_name = serializers.CharField(source='ward.name', read_only=True)
    ward_number = serializers.IntegerField(source='ward.id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_short_name = serializers.CharField(source='department.short_name', read_only=True)
    department_code = serializers.CharField(source='department.short_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'full_name',
            'mobile',
            'email',
            'role',
            'ward',
            'ward_number',
            'ward_name',
            'department',
            'department_name',
            'department_short_name',
            'department_code',
            'designation',
            'employee_id',
            'status',
            'fcm_token',
            'is_active',
            'is_staff',
            'registered_at',
        ]
        read_only_fields = [
            'id',
            'mobile',
            'role',
            'is_staff',
            'registered_at',
            'ward_name',
            'ward_number',
            'department_name',
            'department_short_name',
            'department_code',
        ]


# Alias for backward compatibility across complaints/dashboard apps
UserSerializer = UserProfileSerializer


class WorkerCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for Admin-only creation of municipal field workers.
    """
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        default=None,
        style={'input_type': 'password'},
        help_text='Optional temporary password. If omitted, an unusable password is set.'
    )
    ward = serializers.PrimaryKeyRelatedField(
        queryset=Ward.objects.all(),
        required=False,
        allow_null=True
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = User
        fields = [
            'id',
            'full_name',
            'mobile',
            'email',
            'ward',
            'department',
            'designation',
            'employee_id',
            'status',
            'password',
            'fcm_token',
            'registered_at',
        ]
        read_only_fields = ['id', 'registered_at']

    def validate_mobile(self, value):
        mobile = value.strip()
        if not (mobile.isdigit() and len(mobile) == 10):
            raise serializers.ValidationError('Mobile number must be exactly 10 digits.')
        if User.objects.filter(mobile=mobile).exists():
            raise serializers.ValidationError('A worker with this mobile number already exists.')
        return mobile

    def validate_employee_id(self, value):
        if value:
            emp_id = value.strip()
            if User.objects.filter(employee_id=emp_id).exists():
                raise serializers.ValidationError('A worker with this employee ID already exists.')
            return emp_id
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if not password or not str(password).strip():
            password = None

        validated_data['role'] = User.Role.WORKER
        validated_data['is_staff'] = False
        validated_data['is_superuser'] = False

        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        return user


class AdminWorkerSerializer(serializers.ModelSerializer):
    """
    Standard serializer for worker representation in Admin Worker management endpoints.
    Provides complete worker metadata matching API contract.
    """
    name = serializers.CharField(source='full_name', read_only=True)
    dept = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    department_id = serializers.IntegerField(source='department.id', read_only=True, allow_null=True)
    ward = serializers.SerializerMethodField()
    ward_id = serializers.IntegerField(source='ward.id', read_only=True, allow_null=True)
    active_task_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'employee_id',
            'name',
            'full_name',
            'mobile',
            'email',
            'dept',
            'department',
            'department_id',
            'ward',
            'ward_id',
            'designation',
            'active_task_count',
            'status',
        ]

    def get_dept(self, obj):
        return obj.department.name if obj.department else None

    def get_department(self, obj):
        return obj.department.name if obj.department else None

    def get_ward(self, obj):
        return obj.ward.name if obj.ward else None

    def get_active_task_count(self, obj):
        if hasattr(obj, 'active_task_count'):
            return obj.active_task_count
        return getattr(obj, '_active_task_count', 0)


class AdminWorkerCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a municipal field worker account.
    Restricted to Admins and Department Officers.
    - Department Officers can only create workers in their own assigned department.
    - Admins can create workers in any valid department (1-4).
    """
    name = serializers.CharField(
        max_length=100,
        required=False,
        write_only=True,
        help_text='Worker full name'
    )
    full_name = serializers.CharField(
        max_length=100,
        required=False,
        write_only=True,
        help_text='Alias for worker full name'
    )
    mobile = serializers.CharField(
        max_length=15,
        required=True,
        help_text='Exactly 10-digit mobile number'
    )
    employee_id = serializers.CharField(
        max_length=50,
        required=True,
        help_text='Unique Municipal Employee ID'
    )
    ward = serializers.IntegerField(
        required=False,
        help_text='Ward number (1-4)'
    )
    ward_id = serializers.IntegerField(
        required=False,
        write_only=True,
        help_text='Alias for ward'
    )
    department = serializers.CharField(
        required=False,
        allow_null=True,
        help_text='Department ID or name (1-4 for admin)'
    )
    dept = serializers.CharField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text='Alias for department'
    )
    dept_id = serializers.CharField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text='Alias for department ID'
    )
    designation = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=''
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        default=''
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        default=None,
        style={'input_type': 'password'},
        help_text='Optional temporary password. If omitted, an unusable password is set.'
    )
    status = serializers.CharField(
        max_length=20,
        required=False,
        default=User.Status.ACTIVE
    )

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        role = getattr(user, 'role', '')
        is_admin = bool(
            user and (
                (role in [User.Role.ADMIN, 'admin'] and role not in ['citizen', 'worker']) or
                getattr(user, 'is_superuser', False)
            )
        )

        # 1. Name validation
        name = attrs.get('name') or attrs.get('full_name')
        if not name or not str(name).strip():
            raise serializers.ValidationError({'name': 'Name is required.'})
        attrs['full_name'] = str(name).strip()

        # 2. Mobile validation (must be exactly 10 digits and unique)
        mobile = str(attrs.get('mobile', '')).strip()
        if not (mobile.isdigit() and len(mobile) == 10):
            raise serializers.ValidationError({'mobile': 'Mobile number must be exactly 10 digits.'})
        if User.objects.filter(mobile=mobile).exists():
            raise serializers.ValidationError({'mobile': 'A user with this mobile number already exists.'})
        attrs['mobile'] = mobile

        # 3. Employee ID validation (must be unique and non-empty)
        employee_id = str(attrs.get('employee_id', '')).strip()
        if not employee_id:
            raise serializers.ValidationError({'employee_id': 'Employee ID is required.'})
        if User.objects.filter(employee_id=employee_id).exists():
            raise serializers.ValidationError({'employee_id': 'A user with this employee ID already exists.'})
        attrs['employee_id'] = employee_id

        # 4. Ward validation (1-4) against actual database record
        ward_candidates = []
        for key in ('ward', 'ward_id', 'ward_number'):
            val = attrs.get(key)
            if val is not None and str(val).strip() != '' and val not in ward_candidates:
                ward_candidates.append(val)
            if hasattr(self, 'initial_data') and isinstance(self.initial_data, dict):
                init_val = self.initial_data.get(key)
                if init_val is not None and str(init_val).strip() != '' and init_val not in ward_candidates:
                    ward_candidates.append(init_val)

        if not ward_candidates:
            raise serializers.ValidationError({'ward': 'Ward must be an integer between 1 and 4.'})

        ward_val = ward_candidates[0]
        try:
            ward_id = int(ward_val)
            if ward_id not in [1, 2, 3, 4]:
                raise serializers.ValidationError({'ward': 'Ward must be an integer between 1 and 4.'})
            ward_obj = Ward.objects.get(id=ward_id)
        except (ValueError, TypeError, Ward.DoesNotExist):
            raise serializers.ValidationError({'ward': 'Ward must be an integer between 1 and 4.'})
        attrs['ward_obj'] = ward_obj

        # 5. Department validation & strict DeptOfficer lock logic
        # Collect all department candidates across standard and alias fields
        dept_candidates = []
        for key in ('department', 'dept', 'dept_id', 'department_id'):
            val = attrs.get(key)
            if val is not None and str(val).strip() != '' and val not in dept_candidates:
                dept_candidates.append(val)
            if hasattr(self, 'initial_data') and isinstance(self.initial_data, dict):
                init_val = self.initial_data.get(key)
                if init_val is not None and str(init_val).strip() != '' and init_val not in dept_candidates:
                    dept_candidates.append(init_val)

        if not is_admin:
            # Dept Officer logic: strictly locked to request.user.department
            officer_dept = getattr(user, 'department', None) if user else None
            if not officer_dept:
                raise serializers.ValidationError({'department': 'Officer has no assigned department.'})

            officer_dept_id = officer_dept.id
            officer_dept_names = {
                str(officer_dept.id),
                officer_dept.name.lower(),
                (officer_dept.short_name or '').lower(),
            }

            # Reject if any supplied candidate department does not match officer's assigned department
            for candidate in dept_candidates:
                cand_str = str(candidate).strip()
                try:
                    cand_id = int(cand_str)
                    if cand_id != officer_dept_id:
                        raise PermissionDenied({'department': 'Department officers cannot register workers for another department.'})
                except (ValueError, TypeError):
                    if cand_str.lower() not in officer_dept_names:
                        raise PermissionDenied({'department': 'Department officers cannot register workers for another department.'})

            # Always lock department to officer's own department
            attrs['department_obj'] = officer_dept
        else:
            # Admin logic: can set any valid department 1-4
            if not dept_candidates:
                raise serializers.ValidationError({'department': 'Department must be an integer between 1 and 4.'})
            dept_val = dept_candidates[0]
            try:
                dept_id = int(dept_val)
                if dept_id not in [1, 2, 3, 4]:
                    raise serializers.ValidationError({'department': 'Department must be an integer between 1 and 4.'})
                dept_obj = Department.objects.get(id=dept_id)
            except (ValueError, TypeError, Department.DoesNotExist):
                dept_obj = Department.objects.filter(
                    Q(name__iexact=str(dept_val).strip()) |
                    Q(short_name__iexact=str(dept_val).strip())
                ).first()
                if not dept_obj:
                    raise serializers.ValidationError({'department': 'Department must be an integer between 1 and 4.'})
            attrs['department_obj'] = dept_obj

        # 6. Status validation
        worker_status = str(attrs.get('status', User.Status.ACTIVE) or User.Status.ACTIVE).strip().lower()
        if worker_status not in User.Status.values:
            worker_status = User.Status.ACTIVE
        attrs['status'] = worker_status

        return attrs

    def create(self, validated_data):
        password = validated_data.get('password')
        if not password or not str(password).strip():
            password = None

        full_name = validated_data.get('full_name')
        ward_obj = validated_data['ward_obj']
        dept_obj = validated_data['department_obj']
        mobile = validated_data['mobile']
        employee_id = validated_data['employee_id']
        designation = validated_data.get('designation', '') or ''
        email = validated_data.get('email', '') or ''
        worker_status = validated_data.get('status', User.Status.ACTIVE)

        # Strictly enforce worker role and non-staff/non-superuser flags server-side
        worker = User.objects.create_user(
            mobile=mobile,
            full_name=full_name,
            email=email,
            employee_id=employee_id,
            role=User.Role.WORKER,
            department=dept_obj,
            ward=ward_obj,
            designation=designation,
            status=worker_status,
            password=password,
            is_staff=False,
            is_superuser=False
        )
        return worker


class AdminWorkerUpdateSerializer(serializers.Serializer):
    """
    Validation serializer for updating field worker details.
    Used by AdminWorkerDetailUpdateView (PATCH /api/v1/admin/workers/:id/).

    Rules:
    - Editable fields: designation, ward, status (Active/Inactive/On Leave).
    - Immutable fields: employee_id, mobile cannot be changed after creation (HTTP 400).
    - Department field: editable by Super Admin only; read-only for Dept. Officers (HTTP 403).
    """
    designation = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text='Field worker designation/job title'
    )
    ward = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='Municipal ward ID (1-4)'
    )
    ward_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text='Alias for ward ID'
    )
    status = serializers.CharField(
        max_length=50,
        required=False,
        help_text='Duty status: Active, Inactive, or On Leave'
    )
    department = serializers.CharField(
        required=False,
        allow_null=True,
        help_text='Municipal department ID or name (Super Admin only)'
    )
    dept = serializers.CharField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text='Alias for department'
    )
    dept_id = serializers.CharField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text='Alias for department ID'
    )
    department_id = serializers.CharField(
        required=False,
        allow_null=True,
        write_only=True,
        help_text='Alias for department ID'
    )
    employee_id = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text='Immutable field (cannot be modified after creation)'
    )
    mobile = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text='Immutable field (cannot be modified after creation)'
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        help_text='Worker contact email address'
    )
    name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        write_only=True,
        help_text='Alias for full name'
    )
    full_name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text='Worker full name'
    )

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        role = getattr(user, 'role', '') if user else ''
        is_admin = bool(
            user and (
                (role in [User.Role.ADMIN, 'admin'] and role not in ['citizen', 'worker']) or
                getattr(user, 'is_superuser', False)
            )
        )

        initial = getattr(self, 'initial_data', {})
        if not isinstance(initial, dict):
            initial = {}

        # 1. Enforce immutable fields: mobile and employee_id cannot be changed after creation
        if 'mobile' in initial:
            raise serializers.ValidationError({
                'error': 'mobile is read-only and cannot be modified.',
                'mobile': 'Mobile number is immutable and cannot be changed after creation.'
            })
        if 'employee_id' in initial:
            raise serializers.ValidationError({
                'error': 'employee_id is read-only and cannot be modified.',
                'employee_id': 'Employee ID is immutable and cannot be changed after creation.'
            })

        # 2. Enforce department update permission: Super Admin only; read-only for Dept Officers
        dept_val = None
        dept_provided = False
        for key in ('department', 'dept', 'dept_id', 'department_id'):
            if key in initial:
                dept_provided = True
                dept_val = initial[key]
                break
            elif key in attrs:
                dept_provided = True
                dept_val = attrs[key]
                break

        if dept_provided and dept_val is not None:
            if not is_admin:
                raise PermissionDenied({
                    'error': 'Department officers cannot change worker department.',
                    'department': 'Department field is editable by Super Admin only; read-only for Dept. Officers.'
                })

            dept_obj = None
            try:
                dept_id = int(dept_val)
                dept_obj = Department.objects.get(id=dept_id)
            except (ValueError, TypeError, Department.DoesNotExist):
                dept_obj = Department.objects.filter(
                    Q(name__iexact=str(dept_val).strip()) |
                    Q(short_name__iexact=str(dept_val).strip())
                ).first()

            if not dept_obj:
                raise serializers.ValidationError({'department': 'Invalid department ID.'})
            attrs['department_instance'] = dept_obj

        # 3. Ward validation
        ward_val = None
        ward_provided = False
        for key in ('ward', 'ward_id'):
            if key in initial:
                ward_provided = True
                ward_val = initial[key]
                break
            elif key in attrs:
                ward_provided = True
                ward_val = attrs[key]
                break

        if ward_provided and ward_val is not None:
            ward_obj = None
            try:
                ward_id = int(ward_val)
                ward_obj = Ward.objects.get(id=ward_id)
            except (ValueError, TypeError, Ward.DoesNotExist):
                ward_obj = Ward.objects.filter(name__iexact=str(ward_val).strip()).first()

            if not ward_obj:
                raise serializers.ValidationError({'ward': 'Invalid ward ID.'})
            attrs['ward_instance'] = ward_obj

        # 4. Status validation (Active, Inactive, On Leave)
        if 'status' in initial or 'status' in attrs:
            raw_input = initial.get('status') or attrs.get('status', '')
            raw_status = str(raw_input).strip().lower().replace('-', '_').replace(' ', '_')
            status_map = {
                'active': User.Status.ACTIVE,
                'inactive': User.Status.INACTIVE,
                'on_leave': User.Status.ON_LEAVE,
            }
            if raw_status in status_map:
                attrs['status'] = status_map[raw_status]
            else:
                raise serializers.ValidationError({
                    'status': f"Invalid status '{raw_input}'. Must be Active, Inactive, or On Leave."
                })

        # 5. Designation validation
        if 'designation' in attrs:
            attrs['designation'] = str(attrs['designation']).strip()

        # 6. Email validation
        if 'email' in attrs and attrs['email']:
            attrs['email'] = str(attrs['email']).strip().lower()

        # 7. Name validation
        name_val = attrs.get('name') or attrs.get('full_name') or initial.get('name') or initial.get('full_name')
        if name_val is not None and str(name_val).strip():
            attrs['full_name'] = str(name_val).strip()

        return attrs

    def update(self, instance, validated_data):
        if 'designation' in validated_data:
            instance.designation = validated_data['designation']

        if 'ward_instance' in validated_data:
            instance.ward = validated_data['ward_instance']

        if 'status' in validated_data:
            instance.status = validated_data['status']

        if 'department_instance' in validated_data:
            instance.department = validated_data['department_instance']

        if 'email' in validated_data:
            instance.email = validated_data['email']

        if 'full_name' in validated_data:
            instance.full_name = validated_data['full_name']

        instance.save()
        return instance


# Backward compatibility and alternative naming
WorkerUpdateSerializer = AdminWorkerUpdateSerializer


