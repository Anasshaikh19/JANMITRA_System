# JANMITRA — Complete Database Schema & Entity-Relationship Documentation
## Nagpur Municipal Corporation (NMC) Civic Grievance & Redressal Platform

---

## 1. Document Purpose and Scope

This document provides the authoritative, complete, and verified specification of the relational database schema implemented in the **JANMITRA** civic grievance reporting and resolution platform for the **Nagpur Municipal Corporation (NMC)**. 

### Scope of Core Application Tables
Prior preliminary documentation informally referenced 8 database tables. Comprehensive inspection of the active Django models and migration history confirms that the production schema comprises **10 core application domain tables**:

1. `accounts_user` — Custom authentication model supporting Citizens, Field Workers, Department Officers, and Central Administrators.
2. `complaints_department` — Municipal operational departments (PWD, SWM, PHE, ELEC).
3. `complaints_ward` — Municipal administrative zones (Wards 1–4).
4. `complaints_category` — Civic issue categories linked to responsible departments.
5. `complaints_complaint` — Central civic grievance records with PostGIS geospatial coordinates, AI triage metadata, and status lifecycle.
6. `complaints_complaintimage` — Photographic evidence and resolution proof uploads.
7. `complaints_statushistory` — Immutable audit log recording every lifecycle transition and responsible actor.
8. `dashboard_wardmetric` — Daily aggregated performance rollups per municipal ward.
9. `dashboard_systemsettings` — Singleton administrative configuration governing SLA thresholds and broadcast banners.
10. `notifications_notification` — In-app alerts, push notifications, and dispatch logs.

### Framework and Auxiliary Tables
Django internal framework tables (e.g., `auth_group`, `auth_permission`, `django_migrations`, `django_content_type`, `django_session`, `django_admin_log`) and Celery asynchronous task tracking tables are managed by the framework and are separate from the core business domain. They are referenced where referential integrity applies but are omitted from application-level business modeling.

---

## 2. Database Technology and Environment Notes

### Development vs. Production Architecture

| Attribute | Development / Test Environment | Production Environment (Render / Managed PostgreSQL) |
| :--- | :--- | :--- |
| **Database Engine** | SQLite 3 (`django.db.backends.sqlite3`) | PostgreSQL 15+ with PostGIS (`django.contrib.gis.db.backends.postgis`) |
| **Spatial Extension** | Flat Cartesian mock / SpatiaLite | Native **PostGIS** Spatial Engine (`POSTGIS="3.x"`) |
| **Spatial Coordinate System** | WGS 84 (`EPSG:4326`) | WGS 84 Geodetic Ellipsoid (`EPSG:4326`, `geography=True`) |
| **Connection Pooling** | Disabled (`conn_max_age=0`) | Persistent Pooling (`conn_max_age=600`, 10 minutes) |
| **SSL Enforcement** | Disabled (`ssl_require=False`) | Strict TLS/SSL Required (`ssl_require=True`, `sslmode=require`) |
| **Configuration Source** | `backend/resolveIT/settings/local.py` | `backend/resolveIT/settings/production.py` via `DATABASE_URL` |

### PostGIS Geodetic Storage
The `complaints_complaint.location` column is defined with `geography=True, srid=4326`. Unlike standard Cartesian planar geometry (`geometry`), PostGIS geodetic coordinates compute distances and spatial relationships across the Earth's ellipsoidal curvature directly in meters. This eliminates map projection distortion across Nagpur's municipal boundaries (latitude ~21.1458° N, longitude ~79.0882° E) when executing spatial radius queries (`ST_DWithin` / `distance_lte`).

---

## 3. Schema Overview

The schema is divided into four domain modules matching the backend Django applications:

```
JANMITRA Core Schema (10 Tables)
├── accounts
│   └── accounts_user (Custom User model, RBAC, mobile auth)
├── complaints
│   ├── complaints_ward (Wards 1-4)
│   ├── complaints_department (Departments 1-4)
│   ├── complaints_category (Grievance categories 1-8)
│   ├── complaints_complaint (Core grievances with PostGIS point)
│   ├── complaints_complaintimage (Evidence & resolution photos)
│   └── complaints_statushistory (Immutable audit timeline)
├── dashboard
│   ├── dashboard_wardmetric (Daily ward-level rollups)
│   └── dashboard_systemsettings (Singleton SLA & platform config)
└── notifications
    └── notifications_notification (In-app user alerts)
```

### Table Summary Matrix

| Table Name | Model Name | Primary Key | Key Relationships / FKs | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `accounts_user` | `User` | `BigAutoField` (`bigint`) | FK to `complaints_ward`, `complaints_department` | Authentication, citizen profiles, worker assignments, administrative roles. |
| `complaints_ward` | `Ward` | `SmallIntegerField` (`smallint`, 1–4) | Referenced by `accounts_user`, `complaints_complaint` | Canonical municipal zones of Nagpur. |
| `complaints_department` | `Department` | `SmallIntegerField` (`smallint`, 1–4) | Referenced by `complaints_category`, `complaints_complaint`, `accounts_user` | Operating civic directorates (PWD, SWM, PHE, ELEC). |
| `complaints_category` | `Category` | `SmallIntegerField` (`smallint`, 1–8) | FK to `complaints_department` | Civic issue categorization linked to responsible department. |
| `complaints_complaint` | `Complaint` | `UUIDField` (`uuid`) | FK to `accounts_user` (citizen, worker), `complaints_category`, `complaints_department`, `complaints_ward`, self-FK (parent) | Central grievance repository with PostGIS geodetic coordinates. |
| `complaints_complaintimage` | `ComplaintImage` | `UUIDField` (`uuid`) | FK to `complaints_complaint` | Photographic evidence uploaded by citizens and resolution proof from workers. |
| `complaints_statushistory` | `StatusHistory` | `BigAutoField` (`bigint`) | FK to `complaints_complaint`, `accounts_user` (changed_by) | Immutable state transition audit trail with timestamps and notes. |
| `dashboard_wardmetric` | `WardMetric` | `BigAutoField` (`bigint`) | Scalar `ward_number` (Denormalized) | Daily aggregated complaint counts, resolution averages, and SLA breaches. |
| `dashboard_systemsettings` | `SystemSettings` | `BigAutoField` (`bigint`, `pk=1`) | None (Singleton) | Authoritative SLA hours (Critical, High, Medium) and citizen broadcast banners. |
| `notifications_notification` | `Notification` | `BigAutoField` (`bigint`) | FK to `accounts_user` (recipient), `complaints_complaint` | Targeted in-app alerts, dispatch notifications, and citizen updates. |

---

## 4. Mermaid ER Diagram

The diagram below reflects all foreign keys, cardinalities, and structural relationships implemented in the codebase.

```mermaid
erDiagram
    %% Core Entities and Relationships

    complaints_ward ||--o{ accounts_user : "resides in / assigned to"
    complaints_department ||--o{ accounts_user : "belongs to"
    complaints_department ||--o{ complaints_category : "responsible for"

    accounts_user ||--o{ complaints_complaint : "submits (citizen)"
    accounts_user ||--o{ complaints_complaint : "assigned to (worker)"

    complaints_ward ||--o{ complaints_complaint : "located in"
    complaints_ward ||--o{ complaints_complaint : "original ward (override)"
    complaints_department ||--o{ complaints_complaint : "routed to"
    complaints_category ||--o{ complaints_complaint : "classified under"

    complaints_complaint ||--o{ complaints_complaint : "duplicates (parent)"
    complaints_complaint ||--o{ complaints_complaintimage : "contains images"
    complaints_complaint ||--o{ complaints_statushistory : "records lifecycle"

    accounts_user ||--o{ complaints_statushistory : "triggers transition"
    accounts_user ||--o{ notifications_notification : "receives"
    complaints_complaint ||--o{ notifications_notification : "references"

    complaints_ward ..o{ dashboard_wardmetric : "snapshots (denormalized scalar)"

    %% Table Definitions

    accounts_user {
        bigint id PK
        varchar password
        timestamptz last_login
        boolean is_superuser
        varchar full_name
        varchar mobile UK "Nullable unique"
        varchar email
        varchar role "citizen | worker | dept_officer | admin"
        smallint ward_id FK "Nullable (SET_NULL)"
        smallint department_id FK "Nullable (SET_NULL)"
        varchar designation
        varchar employee_id UK "Nullable unique"
        varchar status "active | inactive | on_leave"
        text fcm_token
        boolean is_active
        boolean is_staff
        timestamptz registered_at
    }

    complaints_ward {
        smallint id PK "Fixed (1-4)"
        varchar name UK "Ward 1 to Ward 4"
    }

    complaints_department {
        smallint id PK "Fixed (1-4)"
        varchar name UK "Full Department Name"
        varchar short_name UK "PWD | SWM | PHE | ELEC"
    }

    complaints_category {
        smallint id PK "Fixed (1-8)"
        varchar name UK "Issue Category"
        smallint department_id FK "PROTECT"
    }

    complaints_complaint {
        uuid id PK "UUIDv4"
        varchar tracking_id UK "NMC-YYYY-XXXXXXX"
        varchar title
        text description
        bigint citizen_id FK "CASCADE"
        smallint category_id FK "PROTECT"
        smallint department_id FK "PROTECT"
        smallint ward_id FK "PROTECT"
        geography location "Point(lng lat) SRID 4326"
        varchar address
        varchar landmark
        varchar status "SUBMITTED | IN_PROGRESS | WORK_DONE | RESOLVED | CLOSED..."
        varchar priority_level "LOW | MEDIUM | HIGH | CRITICAL"
        double_precision priority_score
        double_precision ai_confidence
        boolean fake_detected
        double_precision fake_detection_score
        text fake_reason
        boolean is_duplicate
        uuid parent_complaint_id FK "Nullable (SET_NULL)"
        double_precision similarity_score
        bigint assigned_worker_id FK "Nullable (SET_NULL)"
        boolean ward_override
        smallint original_ward_id FK "Nullable (SET_NULL)"
        text override_reason
        smallint citizen_rating "1 to 5 stars"
        text citizen_feedback
        integer reopen_count
        timestamptz submitted_at
        timestamptz resolved_at
        timestamptz closed_at
        timestamptz updated_at
    }

    complaints_complaintimage {
        uuid id PK "UUIDv4"
        uuid complaint_id FK "CASCADE"
        varchar image "File upload path"
        varchar image_type "complaint | proof"
        timestamptz uploaded_at
    }

    complaints_statushistory {
        bigint id PK
        uuid complaint_id FK "CASCADE"
        varchar old_status "Nullable initial"
        varchar new_status
        bigint changed_by_id FK "Nullable (SET_NULL)"
        text note
        timestamptz changed_at
    }

    dashboard_wardmetric {
        bigint id PK
        smallint ward_number "Indexed scalar (1-4)"
        varchar ward_name
        date date "Indexed date"
        integer total_complaints
        integer pending_complaints
        integer in_progress_complaints
        integer resolved_complaints
        integer sla_breaches
        double_precision avg_resolution_hours
        timestamptz created_at
    }

    dashboard_systemsettings {
        bigint id PK "Singleton (pk=1)"
        integer sla_critical_hours "Default 24"
        integer sla_high_hours "Default 48"
        integer sla_medium_hours "Default 72"
        integer auto_close_hours "Default 72"
        varchar broadcast_message
        timestamptz updated_at
    }

    notifications_notification {
        bigint id PK
        bigint recipient_id FK "CASCADE"
        varchar notification_type "IN_APP | SMS | EMAIL | PUSH"
        varchar title
        text message
        boolean is_read "Indexed"
        uuid complaint_id FK "Nullable (SET_NULL)"
        timestamptz created_at "Indexed"
    }
```

### Relationship Cardinality Narrative

- **Citizen Submissions (`accounts_user` → `complaints_complaint`)**: One-to-Many (`1:N`). A citizen may report zero or many civic grievances. Each complaint belongs strictly to exactly one reporting citizen (`on_delete=models.CASCADE`).
- **Worker Assignments (`accounts_user` → `complaints_complaint`)**: Zero/One-to-Many (`0..1:N`). A field worker may have zero, one, or multiple assigned active complaints. A complaint has either zero (unassigned) or one assigned field worker (`on_delete=models.SET_NULL`).
- **Department Routing (`complaints_department` → `complaints_complaint`)**: One-to-Many (`1:N`). A department supervises many complaints. A complaint is assigned to exactly one department, automatically synchronized with its category (`on_delete=models.PROTECT`).
- **Ward Locality (`complaints_ward` → `complaints_complaint`)**: One-to-Many (`1:N`). A complaint is geographically situated in one municipal ward (`on_delete=models.PROTECT`). If reassigned across ward boundaries, `original_ward` stores the initial ward (`on_delete=models.SET_NULL`).
- **Category Hierarchy (`complaints_department` → `complaints_category`)**: One-to-Many (`1:N`). A municipal department owns multiple issue categories (`on_delete=models.PROTECT`).
- **Evidence Photos (`complaints_complaint` → `complaints_complaintimage`)**: One-to-Many (`1:N`). A complaint contains one or more citizen evidence images and zero or more worker proof-of-work images (`on_delete=models.CASCADE`).
- **Audit History (`complaints_complaint` → `complaints_statushistory`)**: One-to-Many (`1:N`). A complaint accumulates an immutable chronological audit trail of state transitions (`on_delete=models.CASCADE`).
- **Notification Alerts (`accounts_user` & `complaints_complaint` → `notifications_notification`)**: Many-to-One (`N:1`). Notifications are addressed to exactly one recipient user (`CASCADE`) and optionally reference an associated complaint ticket (`SET_NULL`).
- **Denormalized Ward Metrics (`dashboard_wardmetric`)**: Independent analytical snapshot table. `ward_number` is an indexed scalar integer (1–4) rather than an enforced foreign key, allowing snapshots to remain decoupled from spatial boundary tables.
- **System Settings (`dashboard_systemsettings`)**: Independent standalone singleton record (`pk=1`). Contains platform-wide SLA parameters and broadcast strings.

---

## 5. Table-by-Table Data Dictionary

### 5.1. `accounts_user`
**Description:** Central user model managing citizens, municipal field workers, department officers, and municipal commissioners/superadmins. Inherits from Django `AbstractBaseUser` and `PermissionsMixin`.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BigAutoField` / `bigint` | **PK** | No | Auto-incrementing (`bigserial`) | Primary key. |
| `password` | `CharField(max_length=128)` / `varchar(128)` | None | No | None explicitly declared | PBKDF2-SHA256 password hash. Never stored in plain text. |
| `last_login` | `DateTimeField` / `timestamptz` | None | Yes | `None` | Updated upon JWT login issuance. |
| `is_superuser` | `BooleanField` / `boolean` | None | No | Model default: `False` | Superuser administrative bypass flag. |
| `full_name` | `CharField(max_length=100)` / `varchar(100)` | None | No | None explicitly declared | Citizen or municipal staff full legal name. |
| `mobile` | `CharField(max_length=15)` / `varchar(15)` | None | Yes | `None` | **Unique** constraint (`unique=True`). Primary 10-digit authentication identifier (`USERNAME_FIELD`). Nullable for legacy/test fixtures. |
| `email` | `EmailField(max_length=254)` / `varchar(254)` | None | No | Model default: `""` | Optional email address (`blank=True`). Defaults to empty string. |
| `role` | `CharField(max_length=20)` / `varchar(20)` | None | No | Model default: `'citizen'` | Choices: `'citizen'`, `'worker'`, `'dept_officer'`, `'admin'`. |
| `ward_id` | `ForeignKey` / `smallint` | **FK** | Yes | `None` | FK to `complaints_ward.id` (`on_delete=models.SET_NULL`). B-tree indexed. |
| `department_id` | `ForeignKey` / `smallint` | **FK** | Yes | `None` | FK to `complaints_department.id` (`on_delete=models.SET_NULL`). B-tree indexed. |
| `designation` | `CharField(max_length=100)` / `varchar(100)` | None | No | Model default: `""` | Staff job title (e.g., Road Maintenance Specialist). `blank=True`. |
| `employee_id` | `CharField(max_length=50)` / `varchar(50)` | None | Yes | `None` | **Unique** constraint (`unique=True`). Official municipal employee code. Nullable for citizens. |
| `status` | `CharField(max_length=20)` / `varchar(20)` | None | No | Model default: `'active'` | Choices: `'active'`, `'inactive'`, `'on_leave'`. |
| `fcm_token` | `TextField` / `text` | None | No | Model default: `""` | Firebase Cloud Messaging device registration token for push alerts. `blank=True`. |
| `is_active` | `BooleanField` / `boolean` | None | No | Model default: `True` | Account active toggle. Deactivated accounts cannot obtain JWT tokens. |
| `is_staff` | `BooleanField` / `boolean` | None | No | Model default: `False` | Access grant for Django `/admin/` portal. |
| `registered_at` | `DateTimeField` / `timestamptz` | None | No | Auto-generated (`auto_now_add=True`) | Creation timestamp. B-tree ordering default (`-registered_at`). |

---

### 5.2. `complaints_ward`
**Description:** Canonical municipal wards dividing the City of Nagpur. Managed with fixed identifiers (Wards 1 to 4).

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `SmallIntegerField` / `smallint` | **PK** | No | Explicit Integer (1–4) | Fixed primary key representing ward number (1: Central, 2: North, 3: East, 4: West). |
| `name` | `CharField(max_length=100)` / `varchar(100)` | None | No | None explicitly declared | **Unique** constraint (`unique=True`). Label: `'Ward 1'`, `'Ward 2'`, etc. |

---

### 5.3. `complaints_department`
**Description:** Municipal operational directorates responsible for civic service delivery and grievance resolution.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `SmallIntegerField` / `smallint` | **PK** | No | Explicit Integer (1–4) | Fixed primary key (1: PWD, 2: SWM, 3: PHE, 4: ELEC). |
| `name` | `CharField(max_length=100)` / `varchar(100)` | None | No | None explicitly declared | **Unique** constraint (`unique=True`). Full name (e.g., Public Works Department). |
| `short_name` | `CharField(max_length=20)` / `varchar(20)` | None | No | None explicitly declared | **Unique** constraint (`unique=True`). Official acronym (`PWD`, `SWM`, `PHE`, `ELEC`). |

---

### 5.4. `complaints_category`
**Description:** Civic grievance categories mapped to responsible municipal departments.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `SmallIntegerField` / `smallint` | **PK** | No | Explicit Integer (1–8) | Fixed category identifier (1: Roads, 2: Waste, 3: Water, 4: Lighting, etc.). |
| `name` | `CharField(max_length=100)` / `varchar(100)` | None | No | None explicitly declared | **Unique** constraint (`unique=True`). Category title. |
| `department_id` | `ForeignKey` / `smallint` | **FK** | No | None explicitly declared | FK to `complaints_department.id` (`on_delete=models.PROTECT`). Indexed. |

---

### 5.5. `complaints_complaint`
**Description:** Core civic grievance record storing citizen submissions, PostGIS geodetic coordinates, AI classification, automated fraud scores, status workflows, and resolution metadata.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `UUIDField` / `uuid` | **PK** | No | Auto-generated (`uuid.uuid4`) | Primary key. UUIDv4 identifier. |
| `tracking_id` | `CharField(max_length=32)` / `varchar(32)` | None | No | Auto-generated (`NMC-YYYY-XXXXXXX`) | **Unique** constraint (`unique=True`). B-tree indexed (`db_index=True`). Citizen-facing tracking code. |
| `title` | `CharField(max_length=200)` / `varchar(200)` | None | No | None explicitly declared | Brief issue title. Auto-derived from first 50 chars of description if omitted. |
| `description` | `TextField` / `text` | None | No | None explicitly declared | Detailed description of civic issue (minimum 20 characters in serializer). |
| `citizen_id` | `ForeignKey` / `bigint` | **FK** | No | None explicitly declared | FK to `accounts_user.id` (`on_delete=models.CASCADE`). Reporting citizen. |
| `category_id` | `ForeignKey` / `smallint` | **FK** | No | None explicitly declared | FK to `complaints_category.id` (`on_delete=models.PROTECT`). |
| `department_id` | `ForeignKey` / `smallint` | **FK** | No | Auto-derived from `category` | FK to `complaints_department.id` (`on_delete=models.PROTECT`). Synchronized with category. |
| `ward_id` | `ForeignKey` / `smallint` | **FK** | No | None explicitly declared | FK to `complaints_ward.id` (`on_delete=models.PROTECT`). Ward of incident. |
| `location` | `PointField` / `geography(Point, 4326)` | None | Yes | `None` | PostGIS Spatial Geodetic Point (`EPSG:4326`, WGS84). Longitude (X), Latitude (Y). Spatial GiST indexed. |
| `address` | `CharField(max_length=255)` / `varchar(255)` | None | No | Model default: `""` | Locality or street address in Nagpur. `blank=True`. |
| `landmark` | `CharField(max_length=150)` / `varchar(150)` | None | No | Model default: `""` | Prominent local reference landmark. `blank=True`. |
| `status` | `CharField(max_length=20)` / `varchar(20)` | None | No | Model default: `'SUBMITTED'` | B-tree indexed (`db_index=True`). Lifecycle status (12 choices). |
| `priority_level` | `CharField(max_length=15)` / `varchar(15)` | None | No | Model default: `'LOW'` | Choices: `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'`. |
| `priority_score` | `FloatField` / `double precision` | None | No | Model default: `0.0` | Urgency score calculated by AI triage pipeline (0.0 to 100.0). |
| `ai_confidence` | `FloatField` / `double precision` | None | Yes | `None` | Machine learning classification confidence score (0.0 to 1.0). |
| `fake_detected` | `BooleanField` / `boolean` | None | No | Model default: `False` | AI spam / anomaly flag. |
| `fake_detection_score` | `FloatField` / `double precision` | None | No | Model default: `0.0` | Probability score of image / text anomaly (0.0 to 1.0). |
| `fake_reason` | `TextField` / `text` | None | No | Model default: `""` | Explanation text generated by computer vision / NLP models. |
| `is_duplicate` | `BooleanField` / `boolean` | None | No | Model default: `False` | B-tree indexed (`db_index=True`). Indicates duplicate issue in vicinity. |
| `parent_complaint_id` | `ForeignKey` / `uuid` | **FK** | Yes | `None` | Self-referencing FK to `complaints_complaint.id` (`on_delete=models.SET_NULL`). |
| `similarity_score` | `FloatField` / `double precision` | None | Yes | `None` | Image / text cosine similarity score to parent ticket (0.0 to 1.0). |
| `assigned_worker_id` | `ForeignKey` / `bigint` | **FK** | Yes | `None` | FK to `accounts_user.id` (`on_delete=models.SET_NULL`). Assigned field worker. |
| `ward_override` | `BooleanField` / `boolean` | None | No | Model default: `False` | Flag indicating manual administrative override across wards. |
| `original_ward_id` | `ForeignKey` / `smallint` | **FK** | Yes | `None` | FK to `complaints_ward.id` (`on_delete=models.SET_NULL`). Initial ward before override. |
| `override_reason` | `TextField` / `text` | None | No | Model default: `""` | Administrative justification for cross-ward worker dispatch. |
| `citizen_rating` | `SmallIntegerField` / `smallint` | None | Yes | `None` | Citizen satisfaction rating (1 to 5). Check constraint: `1 <= rating <= 5`. |
| `citizen_feedback` | `TextField` / `text` | None | No | Model default: `""` | Citizen remarks upon verification. `blank=True`. |
| `reopen_count` | `PositiveIntegerField` / `integer` | None | No | Model default: `0` | Number of times complaint was rejected and reopened by citizen. |
| `submitted_at` | `DateTimeField` / `timestamptz` | None | No | Auto-generated (`auto_now_add=True`) | B-tree indexed (`db_index=True`). Initial submission timestamp. |
| `resolved_at` | `DateTimeField` / `timestamptz` | None | Yes | `None` | Timestamp when worker submitted proof / status transitioned to Work Done/Resolved. |
| `closed_at` | `DateTimeField` / `timestamptz` | None | Yes | `None` | Timestamp when citizen verified resolution or platform auto-closed ticket. |
| `updated_at` | `DateTimeField` / `timestamptz` | None | No | Auto-updated (`auto_now=True`) | Last record modification timestamp. |

---

### 5.6. `complaints_complaintimage`
**Description:** Stores photographic attachments associated with complaints, distinguishing initial citizen grievance photos from worker resolution proof.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `UUIDField` / `uuid` | **PK** | No | Auto-generated (`uuid.uuid4`) | Primary key. UUIDv4 identifier. |
| `complaint_id` | `ForeignKey` / `uuid` | **FK** | No | None explicitly declared | FK to `complaints_complaint.id` (`on_delete=models.CASCADE`). B-tree indexed. |
| `image` | `ImageField(max_length=100)` / `varchar(100)` | None | No | None explicitly declared | File path stored under `complaints/<tracking_id>/<filename>`. Max file size 10MB. |
| `image_type` | `CharField(max_length=20)` / `varchar(20)` | None | No | Model default: `'complaint'` | Choices: `'complaint'` (citizen initial evidence), `'proof'` (worker resolution evidence). |
| `uploaded_at` | `DateTimeField` / `timestamptz` | None | No | Auto-generated (`auto_now_add=True`) | Upload timestamp. Default ordering (`uploaded_at`). |

---

### 5.7. `complaints_statushistory`
**Description:** Immutable lifecycle audit ledger recording every status transition, worker reassignment, and administrative validation action.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BigAutoField` / `bigint` | **PK** | No | Auto-incrementing (`bigserial`) | Primary key. |
| `complaint_id` | `ForeignKey` / `uuid` | **FK** | No | None explicitly declared | FK to `complaints_complaint.id` (`on_delete=models.CASCADE`). B-tree indexed. |
| `old_status` | `CharField(max_length=20)` / `varchar(20)` | None | Yes | `None` | Previous lifecycle state. Null for initial submission event. |
| `new_status` | `CharField(max_length=20)` / `varchar(20)` | None | No | None explicitly declared | Target lifecycle state after transition. |
| `changed_by_id` | `ForeignKey` / `bigint` | **FK** | Yes | `None` | FK to `accounts_user.id` (`on_delete=models.SET_NULL`). Actor responsible for update. |
| `note` | `TextField` / `text` | None | No | Model default: `""` | Audit remarks, officer validation comments, or worker notes. |
| `changed_at` | `DateTimeField` / `timestamptz` | None | No | Auto-generated (`auto_now_add=True`) | Immutable transition timestamp. Default ordering (`changed_at`). |

---

### 5.8. `dashboard_wardmetric`
**Description:** Aggregated daily municipal operational snapshot enabling sub-second command center dashboard rendering without heavy table scans.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BigAutoField` / `bigint` | **PK** | No | Auto-incrementing (`bigserial`) | Primary key. |
| `ward_number` | `PositiveSmallIntegerField` / `smallint` | None | No | None explicitly declared | B-tree indexed (`db_index=True`). Ward number (1–4). **Scalar integer**, not an enforced FK. |
| `ward_name` | `CharField(max_length=100)` / `varchar(100)` | None | No | None explicitly declared | Denormalized ward label for reporting convenience. |
| `date` | `DateField` / `date` | None | No | None explicitly declared | B-tree indexed (`db_index=True`). Reporting date snapshot. |
| `total_complaints` | `PositiveIntegerField` / `integer` | None | No | Model default: `0` | Total cumulative grievances recorded for the ward on date. |
| `pending_complaints` | `PositiveIntegerField` / `integer` | None | No | Model default: `0` | Complaints in Submitted / Pending Validation status. |
| `in_progress_complaints` | `PositiveIntegerField` / `integer` | None | No | Model default: `0` | Complaints currently Assigned or In Progress. |
| `resolved_complaints` | `PositiveIntegerField` / `integer` | None | No | Model default: `0` | Complaints resolved or verified closed. |
| `sla_breaches` | `PositiveIntegerField` / `integer` | None | No | Model default: `0` | Number of tickets exceeding authoritative SLA deadlines. |
| `avg_resolution_hours` | `FloatField` / `double precision` | None | No | Model default: `0.0` | Mean resolution turnaround time in hours. |
| `created_at` | `DateTimeField` / `timestamptz` | None | No | Auto-generated (`auto_now_add=True`) | Snapshot generation timestamp. |

- **Composite Constraint:** `unique_together = ('ward_number', 'date')` guarantees exactly one snapshot per ward per calendar day.

---

### 5.9. `dashboard_systemsettings`
**Description:** Singleton configuration table governing city-wide service level agreements (SLAs), automatic complaint closure windows, and emergency public broadcast banners.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BigAutoField` / `bigint` | **PK** | No | Enforced `pk=1` | Primary key. Model `save()` overrides any value with `pk=1` (singleton pattern). |
| `sla_critical_hours` | `PositiveIntegerField` / `integer` | None | No | Model default: `24` | Resolution deadline in hours for Critical priority tickets. |
| `sla_high_hours` | `PositiveIntegerField` / `integer` | None | No | Model default: `48` | Resolution deadline in hours for High priority tickets. |
| `sla_medium_hours` | `PositiveIntegerField` / `integer` | None | No | Model default: `72` | Resolution deadline in hours for Medium priority tickets. |
| `auto_close_hours` | `PositiveIntegerField` / `integer` | None | No | Model default: `72` | Grace period in hours after Work Done before unverified tickets auto-close. |
| `broadcast_message` | `CharField(max_length=500)` / `varchar(500)` | None | No | Model default: `""` | Banner string broadcasted across citizen mobile applications. |
| `updated_at` | `DateTimeField` / `timestamptz` | None | No | Auto-updated (`auto_now=True`) | Timestamp of last administrative update. |

---

### 5.10. `notifications_notification`
**Description:** Dispatches and records in-app notifications, SMS dispatch alerts, and push notifications for citizens and municipal staff.

| Column | Django Field / Database Type | Primary Key / Foreign Key | Nullable | Default / Generation | Constraints / Notes |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BigAutoField` / `bigint` | **PK** | No | Auto-incrementing (`bigserial`) | Primary key. |
| `recipient_id` | `ForeignKey` / `bigint` | **FK** | No | None explicitly declared | FK to `accounts_user.id` (`on_delete=models.CASCADE`). Intended recipient. |
| `notification_type` | `CharField(max_length=20)` / `varchar(20)` | None | No | Model default: `'IN_APP'` | Choices: `'IN_APP'`, `'SMS'`, `'EMAIL'`, `'PUSH'`. |
| `title` | `CharField(max_length=200)` / `varchar(200)` | None | No | None explicitly declared | Notification headline. |
| `message` | `TextField` / `text` | None | No | None explicitly declared | Full alert message body. |
| `is_read` | `BooleanField` / `boolean` | None | No | Model default: `False` | B-tree indexed (`db_index=True`). Read status toggle. |
| `complaint_id` | `ForeignKey` / `uuid` | **FK** | Yes | `None` | FK to `complaints_complaint.id` (`on_delete=models.SET_NULL`). Associated ticket. |
| `created_at` | `DateTimeField` / `timestamptz` | None | No | Auto-generated (`auto_now_add=True`) | B-tree indexed (`db_index=True`). Notification creation time. |

---

## 6. Primary Keys, Foreign Keys, and Constraints

### 6.1. Primary Key Strategy

| Primary Key Type | Tables Utilizing | Implementation Rationale |
| :--- | :--- | :--- |
| **UUIDv4 (`UUIDField`)** | `complaints_complaint`, `complaints_complaintimage` | Eliminates sequential ID enumeration attacks, protects citizen privacy, and allows distributed offline UUID generation on mobile devices. |
| **Small Integer (`SmallIntegerField`)** | `complaints_ward`, `complaints_department`, `complaints_category` | High-efficiency 2-byte integers for fixed administrative entities (Wards 1–4, Departments 1–4, Categories 1–8). Eliminates unnecessary join overhead. |
| **Big Integer (`BigAutoField`)** | `accounts_user`, `complaints_statushistory`, `dashboard_wardmetric`, `dashboard_systemsettings`, `notifications_notification` | Standard 8-byte auto-incrementing integer preventing sequence exhaustion in high-volume event and user tables. |

### 6.2. Foreign Key Inventory and Deletion Semantics

| Source Table & Column | Target Table & Column | Deletion Behavior (`on_delete`) | Referential Integrity Rationale |
| :--- | :--- | :--- | :--- |
| `accounts_user.ward_id` | `complaints_ward.id` | `SET_NULL` | If a ward boundary is restructured, existing user accounts are retained without a ward link. |
| `accounts_user.department_id` | `complaints_department.id` | `SET_NULL` | Retains municipal staff records if departmental structures change. |
| `complaints_category.department_id` | `complaints_department.id` | `PROTECT` | Prevents deletion of a department while civic categories remain assigned to it. |
| `complaints_complaint.citizen_id` | `accounts_user.id` | `CASCADE` | If a citizen account is purged under data retention rules, reported complaints cascade. |
| `complaints_complaint.category_id` | `complaints_category.id` | `PROTECT` | Prevents deletion of active categories to preserve grievance audit classification. |
| `complaints_complaint.department_id` | `complaints_department.id` | `PROTECT` | Prevents deletion of an active department while civic complaints remain assigned. |
| `complaints_complaint.ward_id` | `complaints_ward.id` | `PROTECT` | Prevents deletion of a municipal ward while active complaints are mapped to it. |
| `complaints_complaint.parent_complaint_id` | `complaints_complaint.id` | `SET_NULL` | If a canonical parent duplicate is removed, child tickets remain intact. |
| `complaints_complaint.assigned_worker_id` | `accounts_user.id` | `SET_NULL` | If a field worker account is deactivated or deleted, complaints return to unassigned. |
| `complaints_complaint.original_ward_id` | `complaints_ward.id` | `SET_NULL` | Retains complaint record if historical original ward is modified. |
| `complaints_complaintimage.complaint_id` | `complaints_complaint.id` | `CASCADE` | When a complaint ticket is purged, all associated evidence and proof images are deleted. |
| `complaints_statushistory.complaint_id` | `complaints_complaint.id` | `CASCADE` | Status audit log cascades with parent complaint record. |
| `complaints_statushistory.changed_by_id` | `accounts_user.id` | `SET_NULL` | If a staff member leaves NMC, historical status change logs preserve the transition notes. |
| `notifications_notification.recipient_id` | `accounts_user.id` | `CASCADE` | Purges user notifications when user account is removed. |
| `notifications_notification.complaint_id` | `complaints_complaint.id` | `SET_NULL` | Notifications remain readable even if the referenced complaint ticket is closed or removed. |

### 6.3. Uniqueness Constraints

| Constraint Type | Table | Column(s) | Business Rule Enforced |
| :--- | :--- | :--- | :--- |
| **Unique Column** | `accounts_user` | `mobile` | Guarantees single account per citizen/staff mobile number. |
| **Unique Column** | `accounts_user` | `employee_id` | Prevents duplicate municipal employee credential registrations. |
| **Unique Column** | `complaints_ward` | `name` | Prevents duplicate ward nomenclature. |
| **Unique Column** | `complaints_department` | `name`, `short_name` | Enforces unique names and unique department codes (`PWD`, `SWM`, `PHE`, `ELEC`). |
| **Unique Column** | `complaints_category` | `name` | Enforces distinct category names. |
| **Unique Column** | `complaints_complaint` | `tracking_id` | Guarantees non-colliding public citizen tracking IDs (`NMC-YYYY-XXXXXXX`). |
| **Composite Unique** | `dashboard_wardmetric` | `(ward_number, date)` | Guarantees exactly one analytical snapshot per municipal ward per calendar date. |

### 6.4. Enumerations (`TextChoices`)

- **`User.Role`**: `'citizen'`, `'worker'`, `'dept_officer'`, `'admin'`.
- **`User.Status`**: `'active'`, `'inactive'`, `'on_leave'`.
- **`Complaint.Status`**: `'SUBMITTED'`, `'ASSIGNED'`, `'IN_PROGRESS'`, `'RESOLVED'`, `'REJECTED'`, `'Closed'`, `'Reopened'`, `'Pending Validation'`, `'Validated'`, `'Invalid'`, `'Work Done'`, `'In-Progress'`.
- **`Complaint.Priority`**: `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'`.
- **`ComplaintImage.ImageType`**: `'complaint'`, `'proof'`.
- **`Notification.NotificationType`**: `'IN_APP'`, `'SMS'`, `'EMAIL'`, `'PUSH'`.

---

## 7. Existing Index Inventory

The following table catalogs every index verified to exist in the current schema definitions and migration history:

| Table | Index Name | Column(s) | Type | Origin | Purpose / Query Supported |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `accounts_user` | `accounts_user_pkey` | `id` | B-tree (PK) | Django Default | Primary key lookups. |
| `accounts_user` | `accounts_user_mobile_key` | `mobile` | Unique B-tree | `unique=True` | Mobile authentication login lookups (`/api/v1/auth/login/`). |
| `accounts_user` | `accounts_user_employee_id_key` | `employee_id` | Unique B-tree | `unique=True` | Staff login and worker lookup. |
| `accounts_user` | `accounts_user_ward_id_idx` | `ward_id` | B-tree | Foreign Key | Worker filtering by municipal ward. |
| `accounts_user` | `accounts_user_department_id_idx`| `department_id` | B-tree | Foreign Key | Officer filtering by department. |
| `complaints_ward` | `complaints_ward_pkey` | `id` | B-tree (PK) | Django Default | Ward lookups by ID. |
| `complaints_ward` | `complaints_ward_name_key` | `name` | Unique B-tree | `unique=True` | Ward name lookups. |
| `complaints_department` | `complaints_department_pkey` | `id` | B-tree (PK) | Django Default | Department lookups by ID. |
| `complaints_department` | `complaints_department_name_key` | `name` | Unique B-tree | `unique=True` | Department name lookups. |
| `complaints_department` | `complaints_department_short_name_key` | `short_name` | Unique B-tree | `unique=True` | Department lookup by short code (`PWD`, `SWM`). |
| `complaints_category` | `complaints_category_pkey` | `id` | B-tree (PK) | Django Default | Category lookups by ID. |
| `complaints_category` | `complaints_category_name_key` | `name` | Unique B-tree | `unique=True` | Category title lookups. |
| `complaints_category` | `complaints_category_department_id_idx` | `department_id` | B-tree | Foreign Key | Category filtering by department. |
| `complaints_complaint` | `complaints_complaint_pkey` | `id` | B-tree (PK) | Django Default | UUID primary key lookups (`/complaints/:id/`). |
| `complaints_complaint` | `complaints_complaint_tracking_id_key` | `tracking_id` | Unique B-tree | `unique=True`, `db_index=True` | Citizen tracking lookups (`/complaints/NMC-2026-XXXX/`). |
| `complaints_complaint` | `complaints_complaint_status_idx` | `status` | B-tree | `db_index=True` | Status filtering (`?status=Submitted`). |
| `complaints_complaint` | `complaints_complaint_is_duplicate_idx` | `is_duplicate` | B-tree | `db_index=True` | Duplicate triage filtering. |
| `complaints_complaint` | `complaints_complaint_submitted_at_idx` | `submitted_at` | B-tree | `db_index=True` | Default sorting (`-submitted_at`). |
| `complaints_complaint` | `complaints_complaint_citizen_id_idx` | `citizen_id` | B-tree | Foreign Key | Citizen complaint queries (`/complaints/my_complaints/`). |
| `complaints_complaint` | `complaints_complaint_assigned_worker_id_idx` | `assigned_worker_id` | B-tree | Foreign Key | Worker task list queries (`/worker/tasks/`). |
| `complaints_complaint` | `complaints_complaint_parent_complaint_id_idx` | `parent_complaint_id` | B-tree | Foreign Key | Duplicate hierarchy lookups. |
| `complaints_complaint` | `complaints__ward_id_d5f4e2_idx` | `ward_id`, `status` | Composite B-tree | `Meta.indexes` | Ward officer dashboard queries. |
| `complaints_complaint` | `complaints__categor_bda360_idx` | `category_id`, `status` | Composite B-tree | `Meta.indexes` | Department category status breakdown. |
| `complaints_complaint` | `complaints__departm_77b491_idx` | `department_id`, `status` | Composite B-tree | `Meta.indexes` | Department KPI calculations (`/dashboard/kpi/`). |
| `complaints_complaint` | `complaint_dept_ward_status_idx` | `department_id`, `ward_id`, `status` | Composite B-tree | `Meta.indexes` | Multi-filter officer grid (`/admin/complaints/`). |
| `complaints_complaint` | `complaint_citizen_created_idx` | `citizen_id`, `submitted_at DESC` | Composite B-tree | `Meta.indexes` | Citizen chronological ticket timeline. |
| `complaints_complaint` | `complaints_complaint_location_id` | `location` | **GiST** Spatial | Migration / PostGIS | Spatial radius search (`/complaints/nearby/?lat=...&lng=...`). |
| `complaints_complaintimage` | `complaints_complaintimage_pkey` | `id` | B-tree (PK) | Django Default | Image UUID lookup. |
| `complaints_complaintimage` | `complaints_complaintimage_complaint_id_idx` | `complaint_id` | B-tree | Foreign Key | Prefetching complaint photos (`select_related('images')`). |
| `complaints_statushistory` | `complaints_statushistory_pkey` | `id` | B-tree (PK) | Django Default | History primary key. |
| `complaints_statushistory` | `complaints_statushistory_complaint_id_idx` | `complaint_id` | B-tree | Foreign Key | Timeline audit queries (`/complaints/:id/timeline/`). |
| `complaints_statushistory` | `complaints_statushistory_changed_by_id_idx` | `changed_by_id` | B-tree | Foreign Key | User audit tracking. |
| `dashboard_wardmetric` | `dashboard_wardmetric_pkey` | `id` | B-tree (PK) | Django Default | Primary key lookup. |
| `dashboard_wardmetric` | `dashboard_wardmetric_ward_number_idx` | `ward_number` | B-tree | `db_index=True` | Ward metric filtering. |
| `dashboard_wardmetric` | `dashboard_wardmetric_date_idx` | `date` | B-tree | `db_index=True` | Date range aggregation (`/dashboard/trends/`). |
| `dashboard_wardmetric` | `dashboard_wardmetric_ward_number_date_key` | `ward_number`, `date` | Composite Unique B-tree | `unique_together` | Daily snapshot lookups (`get_or_create`). |
| `dashboard_systemsettings` | `dashboard_systemsettings_pkey` | `id` | B-tree (PK) | Django Default | Singleton fetch (`pk=1`). |
| `notifications_notification` | `notifications_notification_pkey` | `id` | B-tree (PK) | Django Default | Notification lookup. |
| `notifications_notification` | `notifications_notification_is_read_idx` | `is_read` | B-tree | `db_index=True` | Filtering read vs unread notifications. |
| `notifications_notification` | `notifications_notification_created_at_idx` | `created_at` | B-tree | `db_index=True` | Ordering notification feed (`-created_at`). |
| `notifications_notification` | `notificatio_recipie_4e3567_idx` | `recipient_id`, `is_read` | Composite B-tree | `Meta.indexes` | Unread user alert badge counters (`is_read=False`). |

---

## 8. Recommended High-Performance Indexing Strategy

Based on query analysis across API views (`views.py`), Celery routing tasks (`tasks.py`), and municipal dashboards, the following **proposed** indexes are identified for future high-scale deployment.

> [!NOTE]
> These indexes are **proposed recommendations** and are intentionally not applied to the active database in this documentation phase.

### Index Recommendation Matrix

| # | Target Table | Proposed Index Definition | Index Type | Query / Workflow Pattern Supported | Performance Benefit & Rationale | Write/Storage Overhead | Current Status |
| :-: | :--- | :--- | :---: | :--- | :--- | :---: | :---: |
| **R1** | `complaints_complaint` | `(status, submitted_at DESC)` | Composite B-tree | Administrative ledger and open complaint triage (`/admin/complaints/?status=Submitted`). | Eliminates in-memory sorting of filtered status subsets. Accelerates pagination across hundreds of thousands of tickets. | Low | **Proposed** |
| **R2** | `complaints_complaint` | `(assigned_worker_id, status)` WHERE `status IN ('ASSIGNED', 'IN_PROGRESS')` | **Partial** B-tree | Field worker active task counting (`serialize_worker_data`) and mobile task lists (`/worker/tasks/`). | Drastically reduces index footprint by only indexing active tasks, completely ignoring millions of historical closed/resolved rows. | Minimal | **Proposed** |
| **R3** | `complaints_complaint` | `(priority_level, submitted_at)` WHERE `status NOT IN ('Closed', 'RESOLVED', 'REJECTED')` | **Partial** B-tree | SLA breach monitoring task and overdue command center ledger (`/dashboard/overdue/`). | Instant lookup for SLA calculation tasks checking for impending breaches without scanning terminal records. | Very Low | **Proposed** |
| **R4** | `complaints_statushistory` | `(complaint_id, changed_at ASC)` | Composite B-tree | Chronological audit timeline retrieval (`/complaints/:id/timeline/`). | Provides index-only scan for audit timeline generation, avoiding sort step on historical events. | Low | **Proposed** |
| **R5** | `notifications_notification` | `(recipient_id, created_at DESC)` | Composite B-tree | In-app user notification stream retrieval (`/api/v1/notifications/`). | Direct match for recipient feed ordering, eliminating `filesort` on user notification tab. | Low | **Proposed** |
| **R6** | `complaints_complaint` | `(fake_detected, status)` WHERE `fake_detected = True` | **Partial** B-tree | Anomaly review ledger (`/dashboard/pending-validation/`). | Dedicated sub-millisecond access for municipal officers validating AI-flagged complaints. | Negligible | **Proposed** |

---

## 9. PostgreSQL and PostGIS Considerations

### 9.1. Spatial Extension Architecture
In the production Render / Linux environment:
- The database is configured with the PostGIS spatial engine: `CREATE EXTENSION IF NOT EXISTS postgis;`.
- The spatial geometry engine is enabled in Django via `django.contrib.gis.db.backends.postgis`.
- Spatial queries utilize `ST_DWithin` and `ST_Distance` on geography points directly over the WGS84 spheroid (`EPSG:4326`).

### 9.2. Spatial Coordinate Integrity
- Latitude range: `-90.0` to `+90.0` (Nagpur: `~21.1458`).
- Longitude range: `-180.0` to `+180.0` (Nagpur: `~79.0882`).
- Coordinates in PointField are strictly formatted as `Point(longitude, latitude, srid=4326)` in compliance with PostGIS X/Y conventions (Longitude is X, Latitude is Y).

### 9.3. Differences Between SQLite and PostgreSQL
1. **Concurrency and Locking:** PostgreSQL provides true row-level locking (`select_for_update()`) used in worker assignment (`ComplaintAssignWorkerView`) and citizen verification (`CitizenComplaintVerifyView`), preventing double assignment or verification race conditions. SQLite acquires table-level locks.
2. **UUID Generation:** PostgreSQL features native 16-byte `uuid` storage types with native index support. SQLite stores UUIDs as `varchar(32)` strings.
3. **Spatial Indexing:** PostgreSQL builds native GiST R-Tree bounding-box indexes for PostGIS geography fields. Development SQLite uses flat mathematical distance mocks.

---

## 10. Data Integrity and Security Notes

### 10.1. Personally Identifiable Information (PII)
- `accounts_user.mobile` and `accounts_user.full_name` represent citizen personal data. Mobile numbers are protected and masked in public responses.
- `accounts_user.password` is hashed using Django's PBKDF2 algorithm with a SHA-256 hash. Passwords cannot be decrypted or exposed via the REST API (`write_only=True`).
- `accounts_user.fcm_token` contains device registration strings used exclusively for Firebase push notifications; excluded from general serializers.

### 10.2. Deletion Protection and Municipal Audit Trails
- Direct HTTP deletion (`DELETE /api/v1/complaints/:id/`) is explicitly disabled in `ComplaintViewSet.destroy` with `HTTP 405 Method Not Allowed`. Civic complaints cannot be deleted to maintain an official municipal record.
- Foreign keys on reference tables (`complaints_ward`, `complaints_department`, `complaints_category`) use `on_delete=models.PROTECT`. Active municipal departments or wards cannot be deleted while associated complaint records exist.
- Soft historical references (`accounts_user` links in `assigned_worker`, `changed_by`) utilize `on_delete=models.SET_NULL`. If a municipal field worker leaves the organization, historical audit records and closed tickets retain their data.

---

## 11. Verification Results and Limitations

### Verification Protocol Executed
The schema and metadata documented herein were verified via non-destructive inspection:

1. **Model Introspection via Django `_meta` API:** Executed Python script introspecting all models across `accounts`, `complaints`, `dashboard`, and `notifications`. Validated all field types, database column names, primary keys, foreign key target models, and `on_delete` rules.
2. **Migration Consistency Check:** Executed `python backend/manage.py makemigrations --check --dry-run`. Result: `No changes detected`, confirming 100% synchronization between Django model declarations and migration files.
3. **Django Framework System Check:** Executed `python backend/manage.py check`. Result: `System check identified no issues (0 silenced)`.
4. **Unit Test Suite Verification:** Executed `python backend/manage.py test`. Result: `Ran 407 tests in 96.001s: OK`.

### Documentation Limitations
- Inspection was performed using local Django metadata and migration definitions.
- Direct network inspection of the live Render PostgreSQL production database was not executed to prevent any disruption to cloud infrastructure. All PostgreSQL-specific attributes documented reflect production settings in `production.py` and official Django/PostGIS specifications.
