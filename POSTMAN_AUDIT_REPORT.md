# JANMITRA — Postman Collection Audit & Correction Report

## 1. Executive Summary

This document reports on the thorough audit, verification, and correction of the Postman Collection and Environment exports for the JANMITRA Civic Complaint Management System (Nagpur Municipal Corporation).

Every request, parameter, serializer, permission class, and HTTP method was audited against the Django backend implementation (`backend/resolveIT/urls.py`, `backend/accounts/`, `backend/complaints/`, `backend/dashboard/`, and `backend/notifications/`).

---

## 2. Reviewed and Updated Files

| File | Status | Description |
| :--- | :--- | :--- |
| [`JANMITRA_Postman_Collection.json`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/JANMITRA_Postman_Collection.json ) | **Updated & Verified** | Audited Postman Collection (v2.1.0) with 55 total requests across 7 organized folders. |
| [`JANMITRA_Postman_Environment.json`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/JANMITRA_Postman_Environment.json ) | **Updated & Verified** | Postman Environment export with clean placeholders, no hardcoded stale IDs. |
| [`backend/resolveIT/urls.py`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/resolveIT/urls.py ) | **Audited (Source)** | Core routing and master URL configuration. |
| [`backend/accounts/urls.py`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/accounts/urls.py ) | **Audited (Source)** | Authentication and worker administration routing. |
| [`backend/complaints/urls.py`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/complaints/urls.py ) | **Audited (Source)** | Grievances, spatial queries, and workflow routing. |
| [`backend/dashboard/urls.py`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/dashboard/urls.py ) | **Audited (Source)** | Command center KPIs, validation, and analytics routing. |
| [`backend/notifications/urls.py`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/backend/notifications/urls.py ) | **Audited (Source)** | In-app user notifications routing. |

---

## 3. Final Request Count by Folder

Total verified requests: **55**

| Folder | Request Count | Scope & Primary Roles |
| :--- | :---: | :--- |
| **Auth** | 7 | Citizen, Worker, Department Officer, Admin login, registration, token refresh, and profile management (includes positive & negative authentication tests). |
| **Complaints** | 13 | Citizen complaint submission (multipart), filtering, detail, timeline, worker assignment, verification, ratings, nearby spatial search, GeoJSON export, and negative validation tests. |
| **Worker** | 5 | Field worker available list, assigned task query, task details, status transitions, and photographic proof upload. |
| **Dashboard** | 12 | Department executive KPIs, ward statistics, daily trends, worker workloads, overdue tickets, AI flagged validation, CSV streaming export, and summary breakdowns. |
| **Admin** | 11 | Field worker list/create/detail/patch, global system SLA configuration, administrative ledger, and category/ward master CRUD. |
| **System & Metadata** | 4 | Production-safe health check (DB/Redis/Celery), legacy health route, and public category/ward metadata dropdown endpoints. |
| **Notifications** | 3 | User in-app notifications stream, single read acknowledgement, and bulk mark-all-read operations. |

---

## 4. Key Corrections Made During Audit

### A. Pre-request Script & JWT Authentication
- **Defect Identified:** Previous pre-request script evaluated un-trimmed token and lacked path normalization (query string splitting and lowercase handling).
- **Correction:** 
  1. Trimmed active `access_token` string; prevents injecting empty `Bearer ` header.
  2. Normalized path before matching against authoritative `AllowAny` public endpoints (`api/v1/health`, `api/health`, `api/v1/auth/login`, `api/v1/auth/register`, `api/v1/auth/refresh`, `api/v1/meta/categories`, `api/v1/meta/wards`).
  3. Preserved existing manual `Authorization` headers without duplication.
  4. Never logs tokens to console.

### B. Login & Refresh Token Persistence
- **Defect Identified:** Unsuccessful logins (400/401) risked evaluating `res.access` as undefined, corrupting existing valid tokens.
- **Correction:** Guarded token extraction with `if (pm.response.code === 200)` and verified `typeof res.access === "string" && res.access.length > 0`. Tokens are updated across both Collection variables and Environment variables consistently.

### C. Complaint Submission Request Body (`POST /api/v1/complaints/`)
- **Defect Identified:** Previous collection specified raw JSON with `latitude` and `longitude` and omitted evidence files. `ComplaintCreateSerializer` strictly requires `location_lat`, `location_lng`, and at least 1 image file in `images` (`multipart/form-data`).
- **Correction:** Converted request body to `formdata` (multipart/form-data) with fields: `title`, `description` (>= 20 chars), `category` (1-4), `ward` (1-4), `location_lat`, `location_lng`, `address`, and `images` file input.

### D. Citizen Verification Request Body (`POST /api/v1/complaints/:id/verify/`)
- **Defect Identified:** Previous collection sent `{"is_satisfied": true}` which is not recognized by `CitizenComplaintVerifySerializer`, causing HTTP 400 Bad Request.
- **Correction:** Corrected payload to `{"action": "accept", "rating": 5, "feedback": "..."}` or `{"action": "reject", "reason": "..."}`.

### E. Citizen Rating Request Body (`POST /api/v1/complaints/:id/rate/`)
- **Defect Identified:** Previous collection sent `{"rating": 5, "feedback": "..."}`, but `CitizenRatingSerializer` uses ModelSerializer fields `citizen_rating` and `citizen_feedback`.
- **Correction:** Corrected payload to `{"citizen_rating": 5, "citizen_feedback": "..."}`.

### F. Officer Manual Validation (`PATCH /api/v1/dashboard/complaints/:id/validate/`)
- **Defect Identified:** Previous collection sent `{"action": "approve"}`, but `ManualValidateSerializer` strictly defines `choices=['validate', 'reject']`.
- **Correction:** Corrected payload to `{"action": "validate"}`.

### G. System Settings Schema (`PUT /api/v1/admin/settings/`)
- **Defect Identified:** Previous collection contained non-existent fields `auto_assign_enabled` and `sla_low_hours`.
- **Correction:** Aligned payload with `SystemSettingsSerializer`: `sla_critical_hours`, `sla_high_hours`, `sla_medium_hours`, `auto_close_hours`, and `broadcast_message`.

### H. Streaming CSV Export Assertions (`GET /api/v1/dashboard/export/`)
- **Defect Identified:** Previous collection asserted `pm.response.to.be.json` which fails because `ComplaintsExportView` streams `text/csv`.
- **Correction:** Created dedicated CSV test asserting `text/csv` Content-Type and CSV header columns (`Complaint ID`, `Status`).

### I. Dynamic Resource Extraction & Clean Placeholders
- **Defect Identified:** Previous collection used hardcoded mock UUIDs (`e3b0c442-...`) and worker IDs (`8`) which do not exist in fresh test databases.
- **Correction:** Initialized placeholders to `""`. Added post-response scripts that automatically extract:
  - `sample_complaint_id` from successful grievance creation (`POST /api/v1/complaints/`)
  - `sample_worker_id` from worker provisioning (`POST /api/v1/admin/workers/`)
  - `sample_notification_id` from notification listing (`GET /api/v1/notifications/`)

---

## 5. Excluded Endpoints

1. **Django Admin Site (`/admin/`)**: Standard Django web administrative interface (HTML templates); excluded as it is not a REST API endpoint.
2. **Direct Deletion & Direct PUT on Complaints (`DELETE /api/v1/complaints/:id/` & `PUT /api/v1/complaints/:id/`)**: The backend explicitly prohibits direct deletion and replacement (`HTTP 405 Method Not Allowed`) to preserve the municipal audit trail. Status transitions are handled via `/status/`, `/assign/`, `/proof-upload/`, and `/verify/`.

---

## 6. Validation Results

| Test Category | Methodology | Status | Result |
| :--- | :--- | :---: | :--- |
| **JSON Syntax** | Parsed via Python `json.load()` | **PASS** | Valid JSON for both collection & environment |
| **Postman v2.1 Schema** | Validated against official Postman Collection v2.1.0 schema via `jsonschema` | **PASS** | Strict schema compliance confirmed |
| **URL Route Resolution** | Tested each endpoint path via `django.urls.resolve()` | **PASS** | **55/55 endpoints matched registered Django routes** |
| **Secret Leak Scan** | Regex search for live JWT tokens, passwords, and API keys | **PASS** | **0 leaks detected** |
| **Backend Unit Tests** | Full Django test suite (`python manage.py test`) | **PASS** | **407/407 passed (0 failures, 0 errors)** |

---

## 7. Local Validation vs. Live Testing Distinction

- **Static & Mocked Validation**: Successfully performed against the Django URL configuration, serializers, permissions, and test fixtures.
- **Local Unit Testing**: 407 tests executed and verified with `manage.py test` using SQLite/PostGIS test database.
- **Live Production Testing**: **Not performed.** No destructive or unauthorized requests were sent against production systems or remote Render deployment.

---

## 8. Manual Setup in Postman

1. **Import Files**: In Postman, select **Import** and upload [`JANMITRA_Postman_Collection.json`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/JANMITRA_Postman_Collection.json ) and [`JANMITRA_Postman_Environment.json`](file:///c:/Users/Anas/OneDrive/Desktop/JANMITRA/JANMITRA_Postman_Environment.json ).
2. **Select Environment**: Switch active environment to **JANMITRA - Local Environment**.
3. **Verify `base_url`**: Defaults to `http://localhost:8000`. Adjust if backend runs on a different port or deployment URL.
4. **Login**: Run `Auth > 1. Login (Citizen / Staff / Admin)`. Tokens are saved automatically, enabling Bearer authentication for all protected endpoints.
