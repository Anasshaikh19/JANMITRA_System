# JANMITRA — Production Deployment Guide on Render
**Nagpur Municipal Corporation Civic Grievance Redressal System**

This guide provides step-by-step instructions for deploying and operating the JANMITRA civic complaint management system on [Render](https://render.com) using Infrastructure as Code (Render Blueprints with `render.yaml`).

---

## Table of Contents
1. [Architecture & Infrastructure Overview](#1-architecture--infrastructure-overview)
2. [Prerequisites & Render Account Setup](#2-prerequisites--render-account-setup)
3. [Deploying via Render Blueprint (`render.yaml`)](#3-deploying-via-render-blueprint-renderyaml)
4. [Environment Variable Configuration Reference](#4-environment-variable-configuration-reference)
5. [Domain, Host & CORS Configuration](#5-domain-host--cors-configuration)
6. [PostgreSQL & PostGIS Setup and Verification](#6-postgresql--postgis-setup-and-verification)
7. [Redis & Celery Configuration](#7-redis--celery-configuration)
8. [Database Migrations & Safe Deployment Sequence](#8-database-migrations--safe-deployment-sequence)
9. [Log Inspection & Monitoring](#9-log-inspection--monitoring)
10. [Health Checks, Smoke Testing & Verification](#10-health-checks-smoke-testing--verification)
11. [Backups, Rollback & Disaster Recovery](#11-backups-rollback--disaster-recovery)
12. [Discovered Limitations & Technical Considerations](#12-discovered-limitations--technical-considerations)
13. [Verification Matrix: Local Verification vs. Live Cloud Actions](#13-verification-matrix-local-verification-vs-live-cloud-actions)

---

## 1. Architecture & Infrastructure Overview

JANMITRA's production deployment on Render comprises four interconnected services defined in `render.yaml`:

```
                       +---------------------------------------+
                       |           Citizen / Admin             |
                       |       (Frontend Web Application)      |
                       +---------------------------------------+
                                           |
                                  HTTPS    |  CORS & Token Auth
                                           v
+-----------------------------------------------------------------------------------+
| RENDER PRIVATE NETWORK (Region: Oregon)                                          |
|                                                                                   |
|  +------------------------------+             +--------------------------------+  |
|  | Web Service:                 |             | Worker Service:                |  |
|  | resolveit-backend            |             | resolveit-celery               |  |
|  | (Gunicorn WSGI + WhiteNoise) |             | (Celery Worker, Concurrency=2) |  |
|  | Port: $PORT (Exposed)        |             | (No Public HTTP Port)          |  |
|  +------------------------------+             +--------------------------------+  |
|            |                 |                           |                        |
|            | (Internal DB)   +------------+   +----------+                        |
|            |                              |   | (Internal Broker)                 |
|            v                              v   v                                   |
|  +------------------------------+   +------------------------------------------+  |
|  | Database:                    |   | Key-Value Cache / Broker:                |  |
|  | resolveit-postgres           |   | resolveit-redis                          |  |
|  | (PostgreSQL 15 + PostGIS)    |   | (Redis 7-compatible, noeviction)         |  |
|  | Private (ipAllowList: [])    |   | Private (ipAllowList: [])                |  |
|  +------------------------------+   +------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

| Service Name | Render Type | Runtime / Spec | Role & Function |
| :--- | :--- | :--- | :--- |
| `resolveit-backend` | Web Service | Python 3.11 (`starter` plan) | Gunicorn WSGI server (`3 workers, 2 threads`, port 8000), REST API, WhiteNoise static files, `/api/health/` |
| `resolveit-celery` | Background Worker | Python 3.11 (`starter` plan) | Asynchronous task processing (AI classification, ward auto-assignment, notifications, SLA tracking) |
| `resolveit-redis` | Key-Value Store | Render Key-Value (`starter` plan) | Redis broker & result backend (`noeviction` policy for Celery queues) |
| `resolveit-postgres` | Managed Database | PostgreSQL 15 (`starter` plan) | Relational database with PostGIS 3.3 spatial extension for ward polygons and GPS complaint coordinates |

---

## 2. Prerequisites & Render Account Setup

### Prerequisites
1. A **Render Account** ([render.com](https://render.com)).
2. A **Paid Render Plan** (`starter` tier or higher for PostgreSQL):
   - *Crucial note*: The free tier of Render PostgreSQL does **not** support spatial extensions (PostGIS) and terminates automatically after 30 days. PostGIS is required for JANMITRA's spatial queries (`PointField`, `PolygonField`).
3. GitHub or GitLab repository containing the JANMITRA codebase with `render.yaml` at the root.

### Initial Account Setup
1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Connect your GitHub/GitLab account under **Account Settings > Connected Accounts**.
3. Grant Render access to the repository containing the `JANMITRA` source code.

---

## 3. Deploying via Render Blueprint (`render.yaml`)

Deploying with Render Blueprints creates all databases, services, and cross-service environment variable links declared in `render.yaml` simultaneously.

### Step 1: Create Blueprint
1. In the Render Dashboard, click **New +** and select **Blueprint**.
2. Select your `JANMITRA` repository.
3. Render reads `render.yaml` automatically and parses the blueprint components:
   - Web Service: `resolveit-backend`
   - Background Worker: `resolveit-celery`
   - Key Value Store: `resolveit-redis`
   - PostgreSQL Database: `resolveit-postgres`
4. Choose a Blueprint Instance Name (e.g., `janmitra-prod`).
5. Choose Region: Select **Oregon (US West)** (or your preferred region, ensuring all services and databases are in the **same region** for zero-latency internal network access).

### Step 2: Fill Non-Synchronized Environment Variables
The blueprint defines variables with `sync: false` which Render will prompt you for:
- `FRONTEND_URL`: The URL of your deployed frontend (e.g., `https://janmitra.nagpur.gov.in` or `https://janmitra-frontend.onrender.com`).
- `ALLOWED_HOSTS`: Backend hosts (e.g., `resolveit-backend.onrender.com,janmitra.nagpur.gov.in`).
- `CORS_ALLOWED_ORIGINS`: Allowed browser origins (e.g., `https://janmitra.nagpur.gov.in,https://janmitra-frontend.onrender.com`).

### Step 3: Apply Blueprint
1. Click **Apply**.
2. Render creates the PostgreSQL database and Redis instance first, then begins building and deploying `resolveit-backend` and `resolveit-celery`.

---

## 4. Environment Variable Configuration Reference

The following table details how every required production variable is supplied:

| Environment Variable | Source / Mapping | Purpose | Example / Generated Value |
| :--- | :--- | :--- | :--- |
| `DJANGO_SETTINGS_MODULE` | Explicitly in `render.yaml` | Tells Django to load strict production settings | `resolveIT.settings.production` |
| `DEBUG` | Explicitly in `render.yaml` | Disables debug mode and sensitive error tracebacks | `False` |
| `PORT` | Explicitly in `render.yaml` | Internal port on which Gunicorn listens | `8000` |
| `SECRET_KEY` | `generateValue: true` in `render.yaml` | Cryptographic signing key for sessions and tokens | Render automatically generates a 256-bit secure key |
| `DATABASE_URL` | Cross-referenced from `resolveit-postgres` | PostgreSQL connection string | `postgres://janmitra_user:***@dpg-***-a:5432/janmitra_db` |
| `REDIS_URL` | Cross-referenced from `resolveit-redis` | Redis connection string for Celery & caching | `redis://red-***:6379` |
| `CELERY_BROKER_URL` | Derived from `REDIS_URL` in `base.py` | Celery message queue connection | Uses `REDIS_URL` fallback |
| `CELERY_RESULT_BACKEND` | Derived from `REDIS_URL` in `base.py` | Celery task state storage | Uses `REDIS_URL` fallback |
| `FRONTEND_URL` | Render Dashboard UI prompt (`sync: false`) | Public frontend URL (auto-added to CORS) | `https://janmitra.nagpur.gov.in` |
| `ALLOWED_HOSTS` | Render Dashboard UI prompt (`sync: false`) | Host/domain header validation | `resolveit-backend.onrender.com,janmitra.nagpur.gov.in` |
| `CORS_ALLOWED_ORIGINS` | Render Dashboard UI prompt (`sync: false`) | Cross-Origin Resource Sharing allowlist | `https://janmitra.nagpur.gov.in` |
| `RENDER_EXTERNAL_HOSTNAME` | Render Platform Auto-injected | Automatic host detection | Render populates this at runtime |
| `POSTGRES_SSL_REQUIRE` | Optional (default: `True` for hosted databases) | Explicit SSL override for internal networks | `true` or `false` |

> [!NOTE]
> `production.py` automatically detects Render's `$RENDER_EXTERNAL_HOSTNAME` and appends it to `ALLOWED_HOSTS`. It also automatically appends `$FRONTEND_URL` to `CORS_ALLOWED_ORIGINS`.

---

## 5. Domain, Host & CORS Configuration

### Custom Domain Configuration (e.g., `janmitra.nagpur.gov.in`)
1. In the Render Dashboard, open **resolveit-backend > Settings > Custom Domains**.
2. Add your custom domain: `api.janmitra.nagpur.gov.in` (or similar).
3. Configure your DNS provider with the CNAME record provided by Render.
4. Render automatically provisions and renews a free Let's Encrypt TLS/SSL certificate.

### CORS and Allowed Hosts Setup
In the **Environment** tab of `resolveit-backend`:
- Update `ALLOWED_HOSTS`:
  ```
  resolveit-backend.onrender.com,api.janmitra.nagpur.gov.in,janmitra.nagpur.gov.in
  ```
- Update `CORS_ALLOWED_ORIGINS`:
  ```
  https://janmitra.nagpur.gov.in,https://janmitra-frontend.onrender.com
  ```
- Update `FRONTEND_URL`:
  ```
  https://janmitra.nagpur.gov.in
  ```

---

## 6. PostgreSQL & PostGIS Setup and Verification

JANMITRA relies on PostGIS (`django.contrib.gis.db.backends.postgis`) for ward boundaries, GIS spatial queries, and coordinates mapping.

### Step 1: Enable PostGIS Extension
Once the `resolveit-postgres` database is created on Render:
1. Open **resolveit-postgres** in the Render Dashboard.
2. In the right-hand panel, find the **Connect** button and select **Connect via psql** (or copy the **External Connection String** into DBeaver/pgAdmin/psql).
3. Execute the SQL command:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
4. Verify the extension installation:
   ```sql
   SELECT PostGIS_Version(), PostGIS_Full_Version();
   ```
   *Expected output: Returns PostGIS 3.3.x or 3.4.x.*

> [!IMPORTANT]
> PostGIS requires a **Starter** or higher database plan on Render. The Free PostgreSQL plan will fail when creating the spatial extension due to memory limitations and lack of PostGIS binaries.

### Step 2: PostGIS Runtime Considerations on Render
- Render's native Python runtime contains standard Python packages, but GeoDjango requires the underlying OS C-libraries: `gdal-bin`, `libgdal-dev`, `libgeos-dev`, and `libproj-dev`.
- **Option A (Docker Runtime - Recommended for GeoDjango on Render):**
  If native build triggers `django.core.exceptions.ImproperlyConfigured: Could not find the GDAL library`, switch the `runtime` in `render.yaml` from `python` to `image` or `docker` utilizing the existing production Dockerfile (`backend/Dockerfile`), which already installs `gdal-bin`, `libgdal-dev`, and `libgeos-dev`.
- **Option B (Native Python with build script):**
  Alternatively, you can include a build script downloading GDAL binaries into the container path or configure Render environment variables `GDAL_LIBRARY_PATH` and `GEOS_LIBRARY_PATH`.

---

## 7. Redis & Celery Configuration

### Managed Redis on Render
JANMITRA uses Render's native managed Key-Value store (`resolveit-redis`):
- **Plan**: `starter`
- **Memory eviction policy**: `noeviction`
  - *Critical*: Redis queues for Celery must never evict tasks under memory pressure (`allkeys-lru` would cause dropped citizen complaints and lost audit notifications).
- **Private Access**: Render Key-Value is isolated inside the private network (`ipAllowList: []`), preventing internet access while allowing low-latency communication to `resolveit-backend` and `resolveit-celery`.

### Celery Worker Service
The background worker `resolveit-celery` runs:
```bash
celery -A resolveIT worker -l info --concurrency=2
```
- Automatically uses the `REDIS_URL` reference provided by the `resolveit-redis` Key-Value service.
- Reuses the identical `SECRET_KEY` from `resolveit-backend` so JWT tokens and encrypted payloads can be deserialized seamlessly.
- Has no public HTTP ports exposed.

---

## 8. Database Migrations & Safe Deployment Sequence

### Pre-Deployment Migrations (`preDeployCommand`)
In `render.yaml`, the backend service defines:
```yaml
preDeployCommand: "python manage.py migrate --noinput"
```
During each deploy:
1. Render builds the environment (`pip install` and `collectstatic`).
2. Before routing live traffic, Render runs `preDeployCommand` in an ephemeral container connected to the production database.
3. If migrations fail, the deployment is halted immediately, and the existing live service continues serving traffic without interruption.

### Safe Initial Deployment Sequence
For the first-time setup of a new environment:
1. **Provision Database**: Create `resolveit-postgres` and enable PostGIS:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
2. **Deploy Blueprint**: Trigger deployment in Render Dashboard.
3. **Run Initial Seeding (One-Time Execution via Render Shell)**:
   Open **resolveit-backend > Shell** in the Render Dashboard and execute:
   ```bash
   python manage.py seed_demo_data
   ```
   *Note: Only run this on initial staging/demo deployments. For pure production, create the superuser directly:*
   ```bash
   python manage.py createsuperuser
   ```

---

## 9. Log Inspection & Monitoring

### Viewing Logs in Render
- **Web Service Logs (`resolveit-backend`)**:
  1. Open **resolveit-backend** in the Render Dashboard.
  2. Navigate to the **Logs** tab.
  3. Filter by `[INFO]`, `[ERROR]`, or HTTP status codes (`4xx`, `5xx`).
  4. Gunicorn access logs will display incoming requests with response times and client IPs.
- **Celery Worker Logs (`resolveit-celery`)**:
  1. Open **resolveit-celery** in the Render Dashboard.
  2. Click the **Logs** tab.
  3. Verify Celery task registration:
     ```
     [tasks]
       . complaints.tasks.check_sla_escalations
       . complaints.tasks.process_complaint_ai
       . dashboard.tasks.aggregate_daily_ward_metrics
       . notifications.tasks.send_push_notification
     ```
  4. Inspect background task consumption:
     ```
     [INFO/MainProcess] Received task: complaints.tasks.process_complaint_ai[...]
     [INFO/ForkPoolWorker-1] Task complaints.tasks.process_complaint_ai[...] succeeded in 0.12s
     ```

### Render Metrics
- Navigate to the **Metrics** tab on either service to monitor real-time CPU utilization, RAM usage, and HTTP request throughput.

---

## 10. Health Checks, Smoke Testing & Verification

Once deployed, run these verification steps to ensure production readiness:

### 1. Health Endpoint Check
The web service exposes a safe, unauthenticated system health endpoint at `/api/v1/health/` (with `/api/health/` supported as a backward-compatible alias). It verifies Database, Redis, and Celery worker connectivity independently:
```bash
curl -I https://resolveit-backend.onrender.com/api/v1/health/
```
**Expected Response (when all services are healthy):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "celery": "connected",
  "timestamp": "2026-10-20T13:30:00.000000+05:30"
}
```
*Note: If any subsystem is unreachable, the endpoint returns `503 Service Unavailable` with `status: "unhealthy"` and marks the failing service as `"unavailable"` without leaking credentials or tracebacks.*

### 2. Static Files Serving (WhiteNoise)
Verify that hashed static assets are served with proper cache headers:
```bash
curl -I https://resolveit-backend.onrender.com/static/rest_framework/css/bootstrap.min.css
```
**Expected Response:**
```http
HTTP/1.1 200 OK
Cache-Control: max-age=315360000, public, immutable
Content-Type: text/css
```

### 3. API Metadata Check
Verify public metadata endpoints for frontend form population:
```bash
curl -s https://resolveit-backend.onrender.com/api/v1/meta/categories/ | jq .
curl -s https://resolveit-backend.onrender.com/api/v1/meta/wards/ | jq .
```
**Expected Response:** Returns JSON arrays containing active municipal categories and NMC wards.

### 4. Celery Task Execution Test
1. Log into the backend Django admin (`https://resolveit-backend.onrender.com/admin/`).
2. Navigate to **Django Celery Beat > Periodic Tasks**.
3. Verify that the scheduled tasks (`check-sla-escalations-every-hour` and `aggregate-daily-ward-metrics-midnight`) are registered.
4. Submit a test complaint via API or admin and verify in Celery logs that `process_complaint_ai` was received and executed.

---

## 11. Backups, Rollback & Disaster Recovery

### Automated Database Backups
- Render Managed PostgreSQL includes automated daily snapshots retained according to your plan (7 days on Starter tier).
- To take an immediate manual snapshot before major updates:
  1. Open **resolveit-postgres > Backups** in the Render Dashboard.
  2. Click **Create Backup**.

### Restoring from Backup
1. In **resolveit-postgres > Backups**, select the backup timestamp.
2. Click **Restore**. Render will provision a new database restored to that point in time, allowing you to switch `DATABASE_URL` safely without destructive in-place writes.

### Application Rollback
If a newly deployed commit causes application errors:
1. Go to **resolveit-backend > Deploys**.
2. Identify the last known working deploy.
3. Click the three dots `...` next to the deploy and click **Rollback to this deploy**.
4. Repeat for **resolveit-celery** if worker code was affected.

---

## 12. Discovered Limitations & Technical Considerations

During configuration and verification, the following platform-specific technical considerations were identified:

1. **PostGIS Support on Free Tier**:
   - Render's **Free Tier** PostgreSQL database does **not** include or permit PostGIS extensions due to memory caps and image restrictions. A **Starter** plan ($7/mo) or higher is strictly required for JANMITRA.
2. **GeoDjango Native vs. Docker Runtime**:
   - Render's native Python runtime image may not have the C libraries (`libgdal`, `libgeos`, `libproj`) installed by default.
   - *Solution*: If the native build fails on `from django.contrib.gis import ...`, switch the service runtime in `render.yaml` to Docker (`dockerfilePath: Dockerfile`), utilizing the already validated `backend/Dockerfile`.
3. **Django 4.2 Storage Mutual Exclusivity**:
   - In Django 4.2, specifying both `STORAGES` and `STATICFILES_STORAGE` triggers `ImproperlyConfigured`. The configuration retains `STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'`, ensuring full compatibility with WhiteNoise and Django 4.2.
4. **Redis Key-Value Blueprint Syntax**:
   - In the current Render Blueprint specification, managed Redis is defined as `type: keyvalue` (with `redis` supported as an alias). Redis services in Blueprints require explicit `ipAllowList: []` to guarantee network isolation.
5. **SSL Termination at Reverse Proxy**:
   - Render terminates SSL at its Cloudflare edge. Django must be configured with `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` (implemented in `production.py`) so Django correctly detects HTTPS requests and prevents infinite redirect loops.

---

## 13. Verification Matrix: Local Verification vs. Live Cloud Actions

To maintain strict operational honesty, the table below delineates what was verified in this environment versus what must be executed with live Render credentials:

| Step / Requirement | Status | Execution Details & Results |
| :--- | :--- | :--- |
| **`render.yaml` Blueprint Schema Validation** | **Verified Locally** | Validated against official Render JSON schema (`https://render.com/schema/render.yaml.json`) via `jsonschema`. Exited code 0, 100% compliant. |
| **`docker-compose.prod.yml` Validation** | **Verified Locally** | Executed `docker compose -f docker-compose.prod.yml config`. Clean syntax, obsolete version warning resolved, exit code 0. |
| **WhiteNoise Static Collection** | **Verified Locally** | Executed `python manage.py collectstatic --noinput`. 169 files copied, 439 post-processed with cache-busting hashes. |
| **Django System Checks** | **Verified Locally** | Executed `python manage.py check`. 0 issues identified. |
| **Production Security Check** | **Verified Locally** | Executed `python manage.py check --deploy --settings=resolveIT.settings.production`. 0 issues identified. |
| **Migration Consistency** | **Verified Locally** | Executed `python manage.py makemigrations --check --dry-run`. No uncommitted migrations, schema consistent. |
| **Backend Test Suite** | **Verified Locally** | Executed `python manage.py test accounts complaints dashboard notifications`. 394 tests passed (0 failures). |
| **Render Cloud Account & Blueprint Deployment** | **Requires Live Action** | Requires user's Render account, billing setup (Starter plan), and GitHub repo linking in Render Dashboard. |
| **PostGIS Extension Enablement (`psql`)** | **Requires Live Action** | Must be run on the provisioned Render PostgreSQL database (`CREATE EXTENSION IF NOT EXISTS postgis;`). |
| **Custom Domain DNS Configuration** | **Requires Live Action** | Requires setting DNS CNAME / ALIAS records pointing to Render's edge load balancer. |
