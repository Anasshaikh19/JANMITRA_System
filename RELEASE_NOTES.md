# JANMITRA v1.0.0 — Production Release Notes
## Nagpur Municipal Corporation (NMC) Civic Grievance & Redressal Platform
**Release Version:** `v1.0.0`  
**Release Date:** October 20, 2026  
**Git Tag:** `v1.0.0`  
**Target Environment:** Production (Docker Compose / Render Cloud Platform)  

---

## Executive Summary

**JANMITRA v1.0.0** is the first production-ready release of the next-generation civic grievance redressal and municipal operations platform built for the **Nagpur Municipal Corporation (NMC)**. 

JANMITRA transforms civic complaint management across Nagpur's administrative zones by uniting citizens, field workers, department officers, and municipal leadership onto a single, high-performance, geodetic-aware digital platform. 

The release completes all planned modules, achieves 100% test pass rates across 407 automated unit and integration tests, enforces strict Role-Based Access Control (RBAC), and provides cloud-ready infrastructure configurations for zero-downtime deployment.

---

## Key Modules & Capabilities Completed

### 1. Core Architecture & Cloud Infrastructure
- **Django 4.2+ & Python 3.11** backend with Django REST Framework (DRF) architecture.
- **PostgreSQL 15+ with PostGIS** spatial extension (`django.contrib.gis.db.backends.postgis`), utilizing geodetic ellipsoidal calculations (`EPSG:4326`, `geography=True`) for high-precision municipal boundary spatial querying.
- **Asynchronous Task Processing:** Distributed task execution using **Celery 5.3+** backed by **Redis 7 (Alpine)** for background SLA tracking, geocoding, notifications, and analytics rollup.
- **Production Web Server:** Multi-threaded **Gunicorn** WSGI configuration (`3 workers`, `2 threads per worker`) bound to port 8000.
- **Static Assets:** Optimized asset delivery via **WhiteNoise** with `CompressedManifestStaticFilesStorage`.
- **Docker Compose:** Full production multi-container orchestration (`docker-compose.prod.yml`) featuring isolated network security, persistent named volumes, and automated health checks across all four services (`postgres`, `redis`, `backend`, `celery`).
- **Render Cloud Blueprint:** Infrastructure-as-code specification (`render.yaml`) declaring managed Web services, Celery background workers, and PostgreSQL with PostGIS extension.

### 2. Authentication & Role-Based Access Control (RBAC)
- **Custom User Model (`accounts_user`):** High-efficiency identity model inheriting from `AbstractBaseUser` with mobile-first primary identification.
- **4 Distinct Municipal Roles:**
  - `CITIZEN` — Public users reporting civic issues and tracking redressal.
  - `WORKER` — Municipal field personnel executing physical repairs.
  - `OFFICER` — Ward and Department administrative supervisors managing work orders.
  - `ADMIN` — Municipal commissioners, system administrators, and central command staff.
- **Token Security:** Stateless JSON Web Token authentication powered by `djangorestframework-simplejwt` with automatic token rotation (`ROTATE_REFRESH_TOKENS=True`) and blacklisting (`BLACKLIST_AFTER_ROTATION=True`).
- **Granular Permissions:** Custom permission hierarchy (`IsAdmin`, `IsOfficer`, `IsWorker`, `IsCitizen`, `IsOwnerOrReadOnly`) strictly enforcing least-privilege data access across all API endpoints.

### 3. Complaints & Civic Redressal Engine
- **Administrative Hierarchy:** Fixed municipal master data models for **4 Administrative Wards** (Dharampeth, Hanuman Nagar, Dhantoli, Gandhibagh) and **4 Operational Departments** (PWD, SWM, PHE, ELEC).
- **8 Civic Issue Categories:** Master issue catalog (Pothole & Road Repair, Garbage Dump & Waste, Broken Streetlight, Water Leakage, Drainage & Sewage, Stray Animals, Tree Fall, Public Space Encroachment).
- **PostGIS Spatial Geo-Referencing:** WGS 84 Point coordinates (`PointField(geography=True, srid=4326)`) enabling spatial radius filtering and proximity clustering.
- **6-State Redressal Lifecycle:**
  $$\text{Submitted} \longrightarrow \text{Under Review} \longrightarrow \text{In Progress} \longrightarrow \text{Resolved} \longrightarrow \text{Closed} \quad (\text{or } \text{Rejected})$$
- **Worker Dispatch Workflow:** Direct assignment of field workers to tickets with atomic row locking (`select_for_update()`) to prevent race conditions.
- **Citizen Verification Loop:** Verification endpoint (`/api/v1/complaints/:id/verify/`) allowing citizens to accept resolutions or reject and reopen tickets with 1–5 star ratings.
- **Photographic Audit:** Dual-stage image upload (`ComplaintImage`) capturing initial complaint photos and worker resolution proof.
- **Immutable Status Audit:** Complete chronological state history (`StatusHistory`) capturing timestamp, previous/new status, remarks, and user identity.
- **AI Triage Integration:** Native schema fields and algorithms for automated priority scoring, spam/fake detection, and duplicate issue detection.

### 4. Municipal Command Center & Analytics Dashboard
- **Executive KPIs:** Live metrics endpoint (`/api/v1/dashboard/kpi/`) reporting total complaints, resolution rates, pending counts, and average resolution turnaround times.
- **Temporal Trends:** Historical complaint volume and closure analysis (`/api/v1/dashboard/trends/`) supporting daily, weekly, and monthly municipal reports.
- **Ward Breakdown:** Ward-by-ward comparative performance matrices (`/api/v1/dashboard/ward-breakdown/`).
- **SLA Breach Monitoring:** Real-time tracking of SLA compliance deadlines (`/api/v1/dashboard/sla/`) with dynamic thresholds (Critical: 24h, High: 48h, Medium: 72h).
- **CSV Data Export:** Municipal reporting export (`/api/v1/dashboard/export/`) delivering filtered complaint records for administrative audits.
- **System Settings Singleton:** Dynamic runtime configuration (`SystemSettings`) for adjusting SLA hours and publishing city-wide broadcast alerts without restarting backend processes.

### 5. Multi-Channel Notification Dispatch
- **In-App Notification Stream:** Centralized alerts repository (`Notification`) for citizens and municipal staff.
- **Real-Time Unread Tracking:** Badge counts and batch mark-as-read endpoints (`/api/v1/notifications/read-all/`).
- **Push Notification Infrastructure:** Device token registration (`fcm_token`) ready for Firebase Cloud Messaging dispatch triggered via asynchronous Celery tasks.

### 6. System Health, Observability & Security
- **Production Health Check API (`GET /api/v1/health/`):**
  - **Database:** Validates connectivity via `User.objects.count()`.
  - **Redis:** Confirms cache/broker responsiveness via `redis_client.ping()`.
  - **Celery:** Probes background workers via `celery_app.control.ping(timeout=2.0)`.
  - Returns `200 OK` when all services are healthy; returns `503 Service Unavailable` on degraded states.
- **Enterprise HTTP Security Headers:**
  - `SECURE_SSL_REDIRECT = True` (enforced in production)
  - `SECURE_HSTS_SECONDS = 31536000` (1-year strict transport security)
  - `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`
  - `SECURE_CONTENT_TYPE_NOSNIFF = True`
  - `X_FRAME_OPTIONS = "DENY"`
  - `CORS_ALLOW_ALL_ORIGINS = False` (strictly whitelist-driven via `CORS_ALLOWED_ORIGINS`)
- **Credential Hygiene:**
  - `.env` strictly excluded via `.gitignore`.
  - `.env.example` verified with non-sensitive placeholder configurations.
  - Zero debug print statements committed across production application code.

---

## Database Schema & Data Dictionary

| # | Table Name | Purpose / Domain Role | Primary Key | Key Relationships |
| :-: | :--- | :--- | :---: | :--- |
| 1 | `accounts_user` | Custom user entity with RBAC roles | `BigAutoField` | FK to `complaints_ward`, FK to `complaints_department` |
| 2 | `complaints_department` | Municipal operational departments | `SmallIntegerField` (1–4) | One-to-Many with `complaints_category`, `complaints_complaint` |
| 3 | `complaints_ward` | Municipal administrative zones | `SmallIntegerField` (1–4) | One-to-Many with `accounts_user`, `complaints_complaint` |
| 4 | `complaints_category` | Civic problem categories | `SmallIntegerField` (1–8) | FK to `complaints_department` (`on_delete=PROTECT`) |
| 5 | `complaints_complaint` | Core civic grievance entity | `UUIDField` | FKs to `citizen`, `category`, `department`, `ward`, `worker` |
| 6 | `complaints_complaintimage` | Photographic proof attachments | `UUIDField` | FK to `complaints_complaint` (`on_delete=CASCADE`) |
| 7 | `complaints_statushistory` | Immutable lifecycle audit trail | `BigAutoField` | FK to `complaints_complaint`, FK to `accounts_user` |
| 8 | `dashboard_wardmetric` | Daily ward performance aggregates | `BigAutoField` | Scalar `ward_number` (1–4), unique with `date` |
| 9 | `dashboard_systemsettings` | Singleton administrative settings | `BigAutoField` (`pk=1`) | Enforced singleton configuration |
| 10 | `notifications_notification` | User notifications and alerts | `BigAutoField` | FK to `accounts_user` (`recipient`), FK to `complaints_complaint` |

*Refer to the repository-root [`DATABASE_SCHEMA_ERD.md`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/DATABASE_SCHEMA_ERD.md) for the full Mermaid ER diagram, PostgreSQL data types, and index strategies.*

---

## API Endpoints Overview

The complete API surface is documented in [`API_DOCUMENTATION.md`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/API_DOCUMENTATION.md) and fully exercisable via the Postman collection [`JANMITRA_Postman_Collection.json`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/JANMITRA_Postman_Collection.json):

| Module | Method | Registered URL | Description & Access Control |
| :--- | :---: | :--- | :--- |
| **System** | `GET` | `/api/v1/health/` | Public multi-service health status probe (`200`/`503`). |
| **Auth** | `POST` | `/api/v1/auth/login/` | Citizen & staff mobile/password login, returns JWT pair. |
| **Auth** | `POST` | `/api/v1/auth/refresh/` | Refresh JWT access token with rotation & blacklist. |
| **Auth** | `GET` | `/api/v1/auth/profile/` | Retrieve current authenticated user profile. |
| **Auth** | `PATCH` | `/api/v1/auth/profile/` | Update profile information and push notification tokens. |
| **Complaints**| `GET` | `/api/v1/complaints/` | List complaints with ward, dept, category, status filters. |
| **Complaints**| `POST` | `/api/v1/complaints/` | Submit new grievance with coordinates and category. |
| **Complaints**| `GET` | `/api/v1/complaints/:id/` | Retrieve complaint detail by UUID or tracking ID. |
| **Complaints**| `POST` | `/api/v1/complaints/:id/assign/` | Assign municipal worker to complaint (`Officer`/`Admin`). |
| **Complaints**| `POST` | `/api/v1/complaints/:id/verify/` | Citizen resolution verification (accept/reopen). |
| **Complaints**| `POST` | `/api/v1/complaints/:id/images/` | Upload photographic evidence or resolution proof. |
| **Complaints**| `GET` | `/api/v1/complaints/:id/timeline/` | Retrieve chronological lifecycle status audit trail. |
| **Worker** | `GET` | `/api/v1/worker/tasks/` | List active tasks assigned to the authenticated worker. |
| **Worker** | `PATCH` | `/api/v1/worker/tasks/:id/status/`| Update worker task status with resolution notes. |
| **Admin** | `GET` | `/api/v1/admin/complaints/` | Master complaint ledger with full administrative filtering. |
| **Admin** | `GET/POST`| `/api/v1/admin/workers/` | Municipal field worker roster management. |
| **Admin** | `PATCH` | `/api/v1/admin/workers/:id/` | Update worker department, ward, or operational status. |
| **Admin** | `GET/PATCH`| `/api/v1/admin/settings/` | Retrieve and update system SLA thresholds & broadcasts. |
| **Dashboard** | `GET` | `/api/v1/dashboard/kpi/` | High-level municipal KPI metrics. |
| **Dashboard** | `GET` | `/api/v1/dashboard/trends/` | Historical complaint trends over time. |
| **Dashboard** | `GET` | `/api/v1/dashboard/ward-breakdown/`| Ward-by-ward comparative performance breakdown. |
| **Dashboard** | `GET` | `/api/v1/dashboard/sla/` | SLA breach tracking and overdue complaint analysis. |
| **Dashboard** | `GET` | `/api/v1/dashboard/export/` | Download CSV complaint records for external reporting. |
| **Notifications**| `GET` | `/api/v1/notifications/` | Paginated in-app notification list for user. |
| **Notifications**| `PATCH` | `/api/v1/notifications/:id/read/` | Mark specific notification as read. |
| **Notifications**| `POST` | `/api/v1/notifications/read-all/` | Mark all user notifications as read in single transaction. |

---

## Verification & Quality Assurance Summary

| Test Domain | Scope | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Django System Checks** | `manage.py check` | **PASSED** | 0 issues identified, 0 silenced. |
| **Database Migrations** | `makemigrations --check --dry-run` | **PASSED** | 0 unapplied changes; 100% synchronized. |
| **Automated Test Suite** | `manage.py test` (407 tests) | **PASSED** | 100% pass rate in 96.0s across all 4 apps. |
| **Security & RBAC Audit** | `test_security_rbac.py` | **PASSED** | All 18 RBAC denial and JWT tests verified. |
| **Postman API Validation** | 55 requests / 7 folders | **PASSED** | Verified Postman Collection v2.1.0 with automated status tests and script assertions. |
| **Code Cleanup** | Debug prints | **COMPLETED** | All debug `print` statements purged from Django codebase. |
| **Credential Audit** | Environment security | **COMPLETED** | `.env` ignored; `.env.example` uses safe placeholders. |

---

## Installation & Deployment Quickstart

### Production Docker Deployment
```bash
# 1. Clone the repository and configure production environment
cp .env.example .env
# Edit .env with your production secrets and DB password

# 2. Build and launch all production containers
docker compose -f docker-compose.prod.yml up -d --build

# 3. Apply database migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --noinput

# 4. Verify system health
curl -f http://localhost:8000/api/v1/health/
```

### Production Render Deployment
1. Connect repository to **Render.com**.
2. Deploy Blueprint using [`render.yaml`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/render.yaml).
3. Follow the detailed steps in [`RENDER_DEPLOYMENT_GUIDE.md`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/RENDER_DEPLOYMENT_GUIDE.md).

---

## Known Limitations and Unverified Production Behaviors

1. **Local Test Environment vs. Live PostGIS Engine:** All 407 automated unit and integration tests were executed against Django's SQLite test runner with mocked spatial calculations. Live PostGIS geodetic queries (`ST_DWithin` on `PointField(geography=True, srid=4326)`) require the production PostgreSQL 15+ instance with the PostGIS extension enabled (`CREATE EXTENSION IF NOT EXISTS postgis;`), as specified in `render.yaml`.
2. **Live Firebase Cloud Messaging (FCM) Dispatch:** The user device registration endpoints (`/api/v1/auth/fcm-token/`) and Celery push task pipelines are structurally validated, but live end-to-end push delivery to physical mobile hardware requires active Google Firebase credentials in production.
3. **Live AI Gateway Connection:** The asynchronous AI triage pipeline (`process_complaint_ai`) executes heuristic fraud scoring and priority assignment. Connection to external third-party LLM/vision inference providers requires upstream API credentials if enabled beyond heuristic fallback.
4. **Live Production Database Migration:** In strict accordance with release safety protocols, no destructive actions, live database connections, or cloud data migrations were performed during this audit. Migration consistency was verified locally via `makemigrations --check --dry-run` (0 unapplied diffs).

---

## Git Tag Verification

- **Tag Name:** `v1.0.0`
- **Annotation:** `JANMITRA Final Production Release`
- **Commit Reference:** `0eacd6a280a87b6e13ea60c3488cbb8c54fd5b9e` (Root Release Commit)

