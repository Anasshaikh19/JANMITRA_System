# JANMITRA - Nagpur Municipal Corporation (NMC)
## Civic Issue Reporting & Resolution System — API Documentation (v1)

Welcome to the JANMITRA API v1 reference. This documentation describes all endpoints for citizen grievance submission, automated AI routing, role-based departmental assignment, field worker mobile resolution tracking, citizen verification, and municipal command-center analytics.

---

### Core Architecture & Conventions

- **Base URL**: `http://localhost:8000/api/v1/`
- **Authentication**: JWT Bearer Token passed via HTTP Header: `Authorization: Bearer <access_token>`
- **Content Types**: 
  - `application/json` for standard queries and mutations
  - `multipart/form-data` for file uploads (complaint evidence photos and resolution proofs)
- **Standard Roles & Permissions**:
  - `citizen`: Registered citizens submitting and tracking grievances in their ward.
  - `worker`: NMC field workers dispatched to resolve civic tickets.
  - `dept_officer`: Municipal department officers supervising their assigned department (PWD, SWM, PHE, ELEC) and ward.
  - `admin`: NMC municipal commissioners and city administrators with overarching city-wide rights.
- **Fixed Municipal Entities**:
  - **4 Departments**: `1` (PWD - Public Works Dept), `2` (SWM - Solid Waste Mgmt), `3` (PHE - Public Health Engineering), `4` (ELEC - Electrical & Lighting)
  - **4 Wards**: `1` (Ward 1), `2` (Ward 2), `3` (Ward 3), `4` (Ward 4)
  - **4 Categories**: `1` (Roads & Infrastructure), `2` (Garbage & Waste Management), `3` (Water Supply & Leakage), `4` (Streetlights & Electricity)

---

## Table of Endpoints

1. [POST /api/v1/auth/register/](#1-post-apiv1authregister)
2. [POST /api/v1/auth/login/](#2-post-apiv1authlogin)
3. [POST /api/v1/auth/refresh/](#3-post-apiv1authrefresh)
4. [PATCH /api/v1/auth/fcm-token/](#4-patch-apiv1authfcm-token)
5. [GET /api/v1/categories/](#5-get-apiv1categories)
6. [GET /api/v1/wards/](#6-get-apiv1wards)
7. [POST /api/v1/complaints/](#7-post-apiv1complaints)
8. [GET /api/v1/complaints/](#8-get-apiv1complaints)
9. [GET /api/v1/complaints/:id/](#9-get-apiv1complaintsid)
10. [PATCH /api/v1/complaints/:id/status/](#10-patch-apiv1complaintsidstatus)
11. [POST /api/v1/complaints/:id/assign/](#11-post-apiv1complaintsidassign)
12. [POST /api/v1/complaints/:id/proof-upload/](#12-post-apiv1complaintsidproof-upload)
13. [POST /api/v1/complaints/:id/verify/](#13-post-apiv1complaintsidverify)
14. [GET /api/v1/worker/tasks/](#14-get-apiv1workertasks)
15. [GET /api/v1/worker/available/?complaint_id=X](#15-get-apiv1workeravailablecomplaint_idx)
16. [GET /api/v1/dashboard/kpi/](#16-get-apiv1dashboardkpi)
17. [GET /api/v1/dashboard/ward-stats/](#17-get-apiv1dashboardward-stats)
18. [GET /api/v1/dashboard/trends/](#18-get-apiv1dashboardtrends)
19. [GET /api/v1/dashboard/workers/](#19-get-apiv1dashboardworkers)
20. [GET /api/v1/dashboard/high-priority/](#20-get-apiv1dashboardhigh-priority)
21. [GET /api/v1/dashboard/pending-validation/](#21-get-apiv1dashboardpending-validation)
22. [PATCH /api/v1/dashboard/complaints/:id/validate/](#22-patch-apiv1dashboardcomplaintsidvalidate)
23. [GET /api/v1/admin/workers/](#23-get-apiv1adminworkers)
24. [POST /api/v1/admin/workers/](#24-post-apiv1adminworkers)
25. [PATCH /api/v1/admin/workers/:id/](#25-patch-apiv1adminworkersid)

---

## 1. POST /api/v1/auth/register/
Permission: [AllowAny]

Registers a new citizen with their mobile number and municipal ward (1-4). Automatically issues access and refresh JWT tokens upon successful registration.

Request:
```json
{
  "mobile": "9820000005",
  "name": "Aarav Sharma",
  "password": "SecurePassword123!",
  "ward": 2,
  "email": "aarav.sharma@example.com"
}
```

Response 200:
*(HTTP 201 Created)*
```json
{
  "id": 15,
  "name": "Aarav Sharma",
  "mobile": "9820000005",
  "role": "citizen",
  "ward": 2,
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokens": {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "user": {
    "id": 15,
    "name": "Aarav Sharma",
    "full_name": "Aarav Sharma",
    "mobile": "9820000005",
    "role": "citizen",
    "ward": 2,
    "department": null,
    "email": "aarav.sharma@example.com"
  },
  "message": "Citizen registered successfully."
}
```

Response 4xx:
*(HTTP 400 Bad Request)*
```json
{
  "mobile": [
    "Mobile number must be exactly 10 digits."
  ],
  "ward": [
    "Ward must be an integer between 1 and 4."
  ]
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register/" \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9820000005",
    "name": "Aarav Sharma",
    "password": "SecurePassword123!",
    "ward": 2,
    "email": "aarav.sharma@example.com"
  }'
```

---

## 2. POST /api/v1/auth/login/
Permission: [AllowAny]

Authenticates user via 10-digit mobile number and password across all municipal roles (`citizen`, `worker`, `dept_officer`, `admin`). Returns JWT access and refresh tokens along with user metadata.

Request:
```json
{
  "mobile": "9820000001",
  "password": "CitizenPassword@123"
}
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "message": "Login successful.",
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "name": "Rajesh Sharma",
    "role": "citizen",
    "ward": 2,
    "department": null,
    "mobile": "9820000001",
    "email": "rajesh.sharma@example.com"
  }
}
```

Response 4xx:
*(HTTP 400 Bad Request)*
```json
{
  "error": "Invalid mobile number or password.",
  "detail": "Invalid mobile number or password.",
  "errors": {
    "non_field_errors": [
      "Invalid mobile number or password."
    ]
  }
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login/" \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9820000001",
    "password": "CitizenPassword@123"
  }'
```

---

## 3. POST /api/v1/auth/refresh/
Permission: [AllowAny]

Standard SimpleJWT token refresh endpoint. Takes a valid refresh token and yields a fresh access token without requiring re-authentication.

Request:
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response 4xx:
*(HTTP 401 Unauthorized)*
```json
{
  "detail": "Token is invalid or expired",
  "code": "token_not_valid"
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/refresh/" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

## 4. PATCH /api/v1/auth/fcm-token/
Permission: [citizen, worker, dept_officer, admin]

Registers or updates the Firebase Cloud Messaging (FCM) device registration token for push notifications (e.g. task assignment notifications to workers, complaint status alerts to citizens).

Request:
```json
{
  "fcm_token": "fXyZ1234567890:APA91bF...qWerty"
}
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "message": "FCM token updated successfully.",
  "fcm_token": "fXyZ1234567890:APA91bF...qWerty"
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 401 Unauthorized)*
```json
{
  "error": "fcm_token field is required."
}
```

Example curl command:
```bash
curl -X PATCH "http://localhost:8000/api/v1/auth/fcm-token/" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fcm_token": "fXyZ1234567890:APA91bF...qWerty"
  }'
```

---

## 5. GET /api/v1/categories/
Permission: [citizen, worker, dept_officer, admin]

Retrieves master list of civic grievance categories linked to municipal departments.

Request:
```
GET /api/v1/categories/?department=1&search=Roads
Query Parameters:
- department (optional, integer): Filter by department ID (1-4)
- search (optional, string): Case-insensitive match on category or department name
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "id": 1,
    "name": "Roads & Infrastructure",
    "department": 1,
    "department_name": "Public Works Dept",
    "department_short_name": "PWD"
  },
  {
    "id": 2,
    "name": "Garbage & Waste Management",
    "department": 2,
    "department_name": "Solid Waste Mgmt",
    "department_short_name": "SWM"
  },
  {
    "id": 3,
    "name": "Water Supply & Leakage",
    "department": 3,
    "department_name": "Public Health Engineering",
    "department_short_name": "PHE"
  },
  {
    "id": 4,
    "name": "Streetlights & Electricity",
    "department": 4,
    "department_name": "Electrical & Lighting",
    "department_short_name": "ELEC"
  }
]
```

Response 4xx:
*(HTTP 401 Unauthorized)*
```json
{
  "detail": "Authentication credentials were not provided."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/categories/" \
  -H "Authorization: Bearer <access_token>"
```

---

## 6. GET /api/v1/wards/
Permission: [citizen, worker, dept_officer, admin]

Retrieves list of all 4 municipal wards of Nagpur Municipal Corporation with their canonical IDs and names.

Request:
```
GET /api/v1/wards/
Query Parameters:
- search (optional, string): Search by ward name
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "id": 1,
    "name": "Ward 1"
  },
  {
    "id": 2,
    "name": "Ward 2"
  },
  {
    "id": 3,
    "name": "Ward 3"
  },
  {
    "id": 4,
    "name": "Ward 4"
  }
]
```

Response 4xx:
*(HTTP 401 Unauthorized)*
```json
{
  "detail": "Authentication credentials were not provided."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/wards/" \
  -H "Authorization: Bearer <access_token>"
```

---

## 7. POST /api/v1/complaints/
Permission: [citizen]

Citizen submission of a civic issue. Accepts category (1-4), ward (1-4), geo-coordinates, description (minimum 20 chars), and at least one evidence image file. Automatically assigns department from category and triggers async background AI verification.

Request:
`Content-Type: multipart/form-data`
```
Form Fields:
- category: 1
- ward: 2
- title: Severe pothole on West High Court Road near Shankar Nagar Square
- description: Deep pothole measuring 2 feet wide and 6 inches deep causing severe vehicular disruption.
- location_lat: 21.1458
- location_lng: 79.0882
- address: West High Court Road, Shankar Nagar
- landmark: Near Shankar Nagar Square
- images: [binary image file attached]
```

Response 200:
*(HTTP 201 Created)*
```json
{
  "id": "e3b0c442-98fc-1c14-9afe-432194689240",
  "tracking_id": "NMC-2026-WD1089",
  "status": "Submitted",
  "message": "Complaint submitted successfully.",
  "complaint": {
    "id": "e3b0c442-98fc-1c14-9afe-432194689240",
    "tracking_id": "NMC-2026-WD1089",
    "title": "Severe pothole on West High Court Road near Shankar Nagar Square",
    "description": "Deep pothole measuring 2 feet wide and 6 inches deep causing severe vehicular disruption.",
    "category": {
      "id": 1,
      "name": "Roads & Infrastructure",
      "department_short_name": "PWD"
    },
    "ward": {
      "id": 2,
      "name": "Ward 2"
    },
    "department": {
      "id": 1,
      "name": "Public Works Dept",
      "short_name": "PWD"
    },
    "status": "Submitted",
    "priority_level": "Medium",
    "address": "West High Court Road, Shankar Nagar",
    "landmark": "Near Shankar Nagar Square",
    "submitted_at": "2026-10-14T12:00:00Z",
    "images": [
      {
        "id": 12,
        "image": "/media/complaints/NMC-2026-WD1089/pothole.jpg",
        "image_type": "complaint"
      }
    ]
  }
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden)*
```json
{
  "description": [
    "Detailed description must be at least 20 characters."
  ],
  "ward": [
    "Municipal ward ID must be 1, 2, 3, or 4."
  ],
  "images": [
    "At least 1 image file for evidence is required."
  ]
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/complaints/" \
  -H "Authorization: Bearer <access_token>" \
  -F "category=1" \
  -F "ward=2" \
  -F "title=Severe pothole on West High Court Road near Shankar Nagar Square" \
  -F "description=Deep pothole measuring 2 feet wide and 6 inches deep causing severe vehicular disruption." \
  -F "location_lat=21.1458" \
  -F "location_lng=79.0882" \
  -F "address=West High Court Road, Shankar Nagar" \
  -F "landmark=Near Shankar Nagar Square" \
  -F "images=@/path/to/pothole.jpg"
```

---

## 8. GET /api/v1/complaints/
Permission: [citizen, worker, dept_officer, admin]

Lists civic complaints with strict Role-Based Access Control (RBAC):
- **Citizen**: Only returns complaints submitted by the requesting citizen.
- **Worker**: Returns complaints assigned to the requesting field worker.
- **Dept Officer**: Returns complaints belonging to their assigned department and ward.
- **Admin**: City-wide access with full filtering capabilities.

Request:
```
GET /api/v1/complaints/?status=Assigned&ward=2&category=1&ordering=-submitted_at
Query Parameters:
- status (optional, string): Submitted, Pending Validation, Validated, Assigned, In-Progress, Work Done, Resolved, Closed, Reopened, Invalid
- ward (optional, integer): 1-4
- category (optional, integer): 1-4
- department (optional, integer): 1-4
- priority_level (optional, string): Low, Medium, High, Critical
- my (optional, boolean): Set to true to filter to current user's complaints
- search (optional, string): Search across title, description, address, landmark, tracking_id
- ordering (optional, string): -submitted_at, priority_score, priority_level
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "id": "e3b0c442-98fc-1c14-9afe-432194689240",
    "tracking_id": "NMC-2026-WD1089",
    "title": "Severe pothole on West High Court Road near Shankar Nagar Square",
    "category": {
      "id": 1,
      "name": "Roads & Infrastructure"
    },
    "ward": {
      "id": 2,
      "name": "Ward 2"
    },
    "department": {
      "id": 1,
      "short_name": "PWD"
    },
    "status": "Assigned",
    "priority_level": "High",
    "priority_score": 82.5,
    "address": "West High Court Road, Shankar Nagar",
    "submitted_at": "2026-10-14T12:00:00Z",
    "assigned_worker": {
      "id": 8,
      "full_name": "Ramesh Patil"
    }
  }
]
```

Response 4xx:
*(HTTP 400 Bad Request)*
```json
{
  "status": "Invalid status 'Pending'. Valid choices are: ['Submitted', 'Pending Validation', 'Validated', 'Assigned', 'In-Progress', 'Work Done', 'Resolved', 'Closed', 'Reopened', 'Invalid']"
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/complaints/?status=Assigned&ward=2" \
  -H "Authorization: Bearer <access_token>"
```

---

## 9. GET /api/v1/complaints/:id/
Permission: [citizen, worker, dept_officer, admin]

Retrieves comprehensive details for a complaint including timeline audit history (`status_history`), attached images, geographic coordinates, and worker assignment. Lookups support UUID or tracking ID.

Request:
```
GET /api/v1/complaints/e3b0c442-98fc-1c14-9afe-432194689240/
Path Parameters:
- :id (string, required): Complaint UUID or NMC tracking_id (e.g., NMC-2026-WD1089)
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "id": "e3b0c442-98fc-1c14-9afe-432194689240",
  "tracking_id": "NMC-2026-WD1089",
  "title": "Severe pothole on West High Court Road near Shankar Nagar Square",
  "description": "Deep pothole measuring 2 feet wide and 6 inches deep causing severe vehicular disruption.",
  "category": {
    "id": 1,
    "name": "Roads & Infrastructure"
  },
  "department": {
    "id": 1,
    "name": "Public Works Dept",
    "short_name": "PWD"
  },
  "ward": {
    "id": 2,
    "name": "Ward 2"
  },
  "status": "Assigned",
  "priority_level": "High",
  "priority_score": 82.5,
  "ai_confidence": 0.94,
  "location_lat": 21.1458,
  "location_lng": 79.0882,
  "address": "West High Court Road, Shankar Nagar",
  "landmark": "Near Shankar Nagar Square",
  "submitted_at": "2026-10-14T12:00:00Z",
  "resolved_at": null,
  "assigned_worker": {
    "id": 8,
    "full_name": "Ramesh Patil",
    "mobile": "9810010008",
    "employee_id": "NMC-WRK-008"
  },
  "images": [
    {
      "id": 12,
      "image": "/media/complaints/NMC-2026-WD1089/pothole.jpg",
      "image_type": "complaint",
      "uploaded_at": "2026-10-14T12:00:05Z"
    }
  ],
  "status_history": [
    {
      "id": 34,
      "old_status": "Validated",
      "new_status": "Assigned",
      "changed_by_name": "Officer Deshmukh",
      "note": "Assigned to worker Ramesh Patil",
      "changed_at": "2026-10-14T12:30:00Z"
    }
  ]
}
```

Response 4xx:
*(HTTP 403 Forbidden / HTTP 404 Not Found)*
```json
{
  "detail": "Citizens can only access their own reported complaints."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/complaints/e3b0c442-98fc-1c14-9afe-432194689240/" \
  -H "Authorization: Bearer <access_token>"
```

---

## 10. PATCH /api/v1/complaints/:id/status/
Permission: [worker, dept_officer, admin]

Updates lifecycle status of a complaint, records audit log in `status_history`, and validates strict workflow prerequisites (e.g. proof photo required before marking "Work Done").

Request:
```json
{
  "status": "In-Progress",
  "note": "Crew dispatched with asphalt patching machinery."
}
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "id": "e3b0c442-98fc-1c14-9afe-432194689240",
  "tracking_id": "NMC-2026-WD1089",
  "status": "In-Progress",
  "priority_level": "High",
  "assigned_worker": {
    "id": 8,
    "full_name": "Ramesh Patil"
  },
  "status_history": [
    {
      "id": 35,
      "old_status": "Assigned",
      "new_status": "In-Progress",
      "changed_by_name": "Ramesh Patil",
      "note": "Crew dispatched with asphalt patching machinery."
    }
  ]
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden)*
```json
{
  "proof": "Proof photo is required to mark work done."
}
```

Example curl command:
```bash
curl -X PATCH "http://localhost:8000/api/v1/complaints/e3b0c442-98fc-1c14-9afe-432194689240/status/" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "In-Progress",
    "note": "Crew dispatched with asphalt patching machinery."
  }'
```

---

## 11. POST /api/v1/complaints/:id/assign/
Permission: [dept_officer, admin]

Assigns a municipal field worker to a complaint. Validates that the worker's department and ward match the complaint. Administrators may supply `override: true` and `override_reason` to assign cross-ward resources.

Request:
```json
{
  "worker_id": 8,
  "override": false,
  "override_reason": ""
}
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "id": "e3b0c442-98fc-1c14-9afe-432194689240",
  "tracking_id": "NMC-2026-WD1089",
  "status": "Assigned",
  "assigned_worker": {
    "id": 8,
    "full_name": "Ramesh Patil",
    "mobile": "9810010008",
    "employee_id": "NMC-WRK-008"
  },
  "status_history": [
    {
      "id": 36,
      "old_status": "Validated",
      "new_status": "Assigned",
      "changed_by_name": "Dept Officer Kulkarni",
      "note": "Assigned to worker Ramesh Patil"
    }
  ]
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden)*
```json
{
  "error": "Worker from Ward 1 cannot be assigned to complaint in Ward 2 without administrative override."
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/complaints/e3b0c442-98fc-1c14-9afe-432194689240/assign/" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": 8,
    "override": false
  }'
```

---

## 12. POST /api/v1/complaints/:id/proof-upload/
Permission: [worker, dept_officer, admin]

Uploads photographic proof of resolution for a complaint. Validates that the requesting worker is assigned to the ticket or officer belongs to the managing department.

Request:
`Content-Type: multipart/form-data`
```
Form Fields:
- proof: [binary JPEG/PNG image attached]
```

Response 200:
*(HTTP 201 Created)*
```json
{
  "id": 45,
  "complaint_id": "e3b0c442-98fc-1c14-9afe-432194689240",
  "tracking_id": "NMC-2026-WD1089",
  "image_url": "http://localhost:8000/media/complaints/NMC-2026-WD1089/repaired_road.jpg",
  "image_type": "proof",
  "uploaded_at": "2026-10-14T14:15:00Z",
  "message": "Resolution proof uploaded successfully."
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden)*
```json
{
  "error": "Proof image file is required (multipart field: proof or image)."
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/complaints/e3b0c442-98fc-1c14-9afe-432194689240/proof-upload/" \
  -H "Authorization: Bearer <access_token>" \
  -F "proof=@/path/to/repaired_road.jpg"
```

---

## 13. POST /api/v1/complaints/:id/verify/
Permission: [citizen]

Citizen resolution verification. Only the citizen who originally reported the complaint can verify it. The complaint must be in `Work Done` or `RESOLVED` status.
- **Accept**: `accepted=true`, `rating` (1-5 integer required), transitions status to `Closed` and records `resolved_at`.
- **Reject**: `accepted=false`, `reason` (non-empty string required), transitions status to `Reopened`.

Request (Acceptance):
```json
{
  "accepted": true,
  "rating": 5,
  "feedback": "Road repaired cleanly and level is restored. Excellent service!"
}
```

Request (Rejection):
```json
{
  "accepted": false,
  "reason": "Loose gravel remains scattered on the street, causing skidding."
}
```

Response 200:
*(Acceptance - HTTP 200 OK)*
```json
{
  "id": "e3b0c442-98fc-1c14-9afe-432194689240",
  "status": "Closed",
  "resolved_at": "2026-10-14T15:30:00Z",
  "citizen_rating": 5,
  "message": "Resolution accepted. Complaint marked as Closed."
}
```

*(Rejection - HTTP 200 OK)*
```json
{
  "id": "e3b0c442-98fc-1c14-9afe-432194689240",
  "status": "Reopened",
  "reason": "Loose gravel remains scattered on the street, causing skidding.",
  "message": "Resolution rejected. Complaint has been Reopened."
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden)*
```json
{
  "error": "Complaint cannot be verified from status 'In-Progress'. It must be in 'Work Done' or 'RESOLVED' status."
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/complaints/e3b0c442-98fc-1c14-9afe-432194689240/verify/" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "accepted": true,
    "rating": 5,
    "feedback": "Road repaired cleanly and level is restored."
  }'
```

---

## 14. GET /api/v1/worker/tasks/
Permission: [worker]

Returns the active task queue for the logged-in municipal field worker, ordered by submission timestamp.

Request:
```
GET /api/v1/worker/tasks/
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "id": "e3b0c442-98fc-1c14-9afe-432194689240",
    "tracking_id": "NMC-2026-WD1089",
    "title": "Severe pothole on West High Court Road near Shankar Nagar Square",
    "description": "Deep road pothole measuring 2 feet wide.",
    "category": {
      "id": 1,
      "name": "Roads & Infrastructure"
    },
    "ward": {
      "id": 2,
      "name": "Ward 2"
    },
    "department": {
      "id": 1,
      "name": "Public Works Dept",
      "short_name": "PWD"
    },
    "status": "In-Progress",
    "priority_level": "High",
    "address": "West High Court Road, Shankar Nagar",
    "landmark": "Near Shankar Nagar Square",
    "submitted_at": "2026-10-14T12:00:00Z"
  }
]
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/worker/tasks/" \
  -H "Authorization: Bearer <access_token>"
```

---

## 15. GET /api/v1/worker/available/?complaint_id=X
Permission: [dept_officer, admin]

Lists available active field workers eligible for assignment to the specified complaint, annotated with each worker's current active task count (`active_task_count`).
- **Dept Officer**: Scoped to active workers in their department and ward.
- **Admin**: Can pass `override=true` to view workers across all wards.

Request:
```
GET /api/v1/worker/available/?complaint_id=e3b0c442-98fc-1c14-9afe-432194689240
Query Parameters:
- complaint_id (required, string): UUID or tracking ID of complaint
- override (optional, boolean, admin only): If true, returns workers across all wards
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "worker_id": 8,
    "name": "Ramesh Patil",
    "ward": "Ward 2",
    "designation": "Road Maintenance Worker",
    "active_task_count": 1
  },
  {
    "worker_id": 12,
    "name": "Sachin Gaikwad",
    "ward": "Ward 2",
    "designation": "Assistant Paving Specialist",
    "active_task_count": 3
  }
]
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 404 Not Found)*
```json
{
  "error": "complaint_id query parameter is required."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/worker/available/?complaint_id=e3b0c442-98fc-1c14-9afe-432194689240" \
  -H "Authorization: Bearer <access_token>"
```

---

## 16. GET /api/v1/dashboard/kpi/
Permission: [dept_officer, admin]

Calculates high-level departmental Key Performance Indicators (KPIs) including total volume, status counts, average resolution duration in days, and percentage breakdown across priority levels.

Request:
```
GET /api/v1/dashboard/kpi/?ward_id=2&date_from=2026-10-01&date_to=2026-10-14
Query Parameters:
- dept_id (optional, integer, admin only): Filter by Department ID (1-4)
- ward_id (optional, integer): Filter by Ward ID (1-4)
- date_from (optional, YYYY-MM-DD): Filter start date
- date_to (optional, YYYY-MM-DD): Filter end date
- severity (optional, string): Low, Medium, High, Critical
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "total": 48,
  "pending": 8,
  "in_progress": 14,
  "resolved": 22,
  "rejected": 4,
  "avg_resolution_days": 2.1,
  "severity_distribution": [
    {
      "level": "Low",
      "count": 6,
      "percentage": 12.5
    },
    {
      "level": "Medium",
      "count": 16,
      "percentage": 33.33
    },
    {
      "level": "High",
      "count": 20,
      "percentage": 41.67
    },
    {
      "level": "Critical",
      "count": 6,
      "percentage": 12.5
    }
  ]
}
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/kpi/?ward_id=2" \
  -H "Authorization: Bearer <access_token>"
```

---

## 17. GET /api/v1/dashboard/ward-stats/
Permission: [dept_officer, admin]

Returns comparative statistical distribution across all 4 municipal wards: total grievances, pending, in-progress, resolved, and rejected.

Request:
```
GET /api/v1/dashboard/ward-stats/?dept_id=1
Query Parameters:
- dept_id (optional, integer, admin only): Filter by Department ID (1-4)
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "ward_id": 1,
    "ward_name": "Ward 1",
    "total": 14,
    "pending": 3,
    "in_progress": 4,
    "resolved": 6,
    "rejected": 1
  },
  {
    "ward_id": 2,
    "ward_name": "Ward 2",
    "total": 18,
    "pending": 2,
    "in_progress": 5,
    "resolved": 9,
    "rejected": 2
  },
  {
    "ward_id": 3,
    "ward_name": "Ward 3",
    "total": 10,
    "pending": 1,
    "in_progress": 3,
    "resolved": 5,
    "rejected": 1
  },
  {
    "ward_id": 4,
    "ward_name": "Ward 4",
    "total": 6,
    "pending": 2,
    "in_progress": 2,
    "resolved": 2,
    "rejected": 0
  }
]
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/ward-stats/" \
  -H "Authorization: Bearer <access_token>"
```

---

## 18. GET /api/v1/dashboard/trends/
Permission: [dept_officer, admin]

Generates chronological time-series trends tracking incoming complaint submissions vs completed resolutions. Aggregated using database `TruncDay`, `TruncWeek`, or `TruncMonth`.

Request:
```
GET /api/v1/dashboard/trends/?groupby=day&date_from=2026-10-10&date_to=2026-10-14
Query Parameters:
- groupby (optional, string): day, week, month (default: day)
- date_from (optional, YYYY-MM-DD): Filter start date
- date_to (optional, YYYY-MM-DD): Filter end date
- dept_id (optional, integer, admin only): Filter by Department ID (1-4)
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "date": "2026-10-10",
    "submitted": 5,
    "resolved": 3
  },
  {
    "date": "2026-10-11",
    "submitted": 8,
    "resolved": 6
  },
  {
    "date": "2026-10-12",
    "submitted": 12,
    "resolved": 9
  },
  {
    "date": "2026-10-13",
    "submitted": 10,
    "resolved": 8
  },
  {
    "date": "2026-10-14",
    "submitted": 7,
    "resolved": 5
  }
]
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/trends/?groupby=day" \
  -H "Authorization: Bearer <access_token>"
```

---

## 19. GET /api/v1/dashboard/workers/
Permission: [dept_officer, admin]

Monitors field worker operational workloads, counting active in-progress tickets, resolutions completed in the last 7 days (`completed_week`), and individual average turnaround times.

Request:
```
GET /api/v1/dashboard/workers/?ward_id=2
Query Parameters:
- ward_id (optional, integer): Filter by Ward ID (1-4)
- dept_id (optional, integer, admin only): Filter by Department ID (1-4)
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "worker_id": 8,
    "name": "Ramesh Patil",
    "ward_name": "Ward 2",
    "active_tasks": 2,
    "completed_week": 4,
    "avg_resolution_days": 1.6,
    "status": "active"
  },
  {
    "worker_id": 12,
    "name": "Sachin Gaikwad",
    "ward_name": "Ward 2",
    "active_tasks": 1,
    "completed_week": 3,
    "avg_resolution_days": 2.2,
    "status": "active"
  }
]
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/workers/?ward_id=2" \
  -H "Authorization: Bearer <access_token>"
```

---

## 20. GET /api/v1/dashboard/high-priority/
Permission: [dept_officer, admin]

Escalation queue displaying civic issues with severity `High` or `Critical` that remain unclosed, ordered descending by days open (`days_open`, oldest submitted tickets first).

Request:
```
GET /api/v1/dashboard/high-priority/?dept_id=1
Query Parameters:
- dept_id (optional, integer, admin only): Filter by Department ID (1-4)
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "id": "e3b0c442-98fc-1c14-9afe-432194689240",
    "category_name": "Roads & Infrastructure",
    "ward_name": "Ward 2",
    "priority_level": "Critical",
    "status": "In-Progress",
    "days_open": 3.2,
    "assigned_worker_name": "Ramesh Patil"
  },
  {
    "id": "f4c1d553-09ad-2d25-0bef-543205790351",
    "category_name": "Roads & Infrastructure",
    "ward_name": "Ward 1",
    "priority_level": "High",
    "status": "Assigned",
    "days_open": 1.8,
    "assigned_worker_name": "Vikas Borkar"
  }
]
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/high-priority/" \
  -H "Authorization: Bearer <access_token>"
```

---

## 21. GET /api/v1/dashboard/pending-validation/
Permission: [dept_officer, admin]

Review queue of complaints flagged as `Pending Validation` by AI triage (e.g. low image classification confidence or borderline spam check). Includes `ai_confidence` score and image thumbnail URL for rapid inspection.

Request:
```
GET /api/v1/dashboard/pending-validation/?dept_id=1
Query Parameters:
- dept_id (optional, integer, admin only): Filter by Department ID (1-4)
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "id": "b2c3d4e5-6789-0123-4567-89abcdef0123",
    "tracking_id": "NMC-2026-PV4401",
    "title": "Suspected road damage on Central Avenue",
    "description": "Road depression detected near telephone exchange square, requires field officer validation.",
    "category_name": "Roads & Infrastructure",
    "ward_name": "Ward 3",
    "department_name": "Public Works Dept",
    "status": "Pending Validation",
    "ai_confidence": 0.58,
    "first_image_thumbnail_url": "http://localhost:8000/media/complaints/NMC-2026-PV4401/depression.jpg",
    "thumbnail_url": "http://localhost:8000/media/complaints/NMC-2026-PV4401/depression.jpg"
  }
]
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/pending-validation/" \
  -H "Authorization: Bearer <access_token>"
```

---

## 22. PATCH /api/v1/dashboard/complaints/:id/validate/
Permission: [dept_officer, admin]

Manual officer triage action for tickets in `Pending Validation`.
- `validate`: Updates status to `Validated` and triggers Celery automated routing task.
- `reject`: Updates status to `Invalid` with a mandatory reason stored in `status_history`.

Request (Validate):
```json
{
  "action": "validate"
}
```

Request (Reject):
```json
{
  "action": "reject",
  "reason": "Image shows private property construction, outside NMC municipal jurisdiction."
}
```

Response 200:
*(Validate - HTTP 200 OK)*
```json
{
  "message": "Complaint validated successfully.",
  "id": "b2c3d4e5-6789-0123-4567-89abcdef0123",
  "status": "Validated"
}
```

*(Reject - HTTP 200 OK)*
```json
{
  "message": "Complaint marked as invalid.",
  "id": "b2c3d4e5-6789-0123-4567-89abcdef0123",
  "status": "Invalid",
  "reason": "Image shows private property construction, outside NMC municipal jurisdiction."
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden)*
```json
{
  "reason": [
    "A reason must be provided when rejecting a complaint."
  ]
}
```

Example curl command:
```bash
curl -X PATCH "http://localhost:8000/api/v1/dashboard/complaints/b2c3d4e5-6789-0123-4567-89abcdef0123/validate/" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "validate"
  }'
```

---

## 23. GET /api/v1/admin/workers/
Permission: [dept_officer, admin]

Retrieves roster of municipal field workers with active task loads, departmental affiliations, and status. Scoped to officer's department, or city-wide for administrators.

Request:
```
GET /api/v1/admin/workers/?ward_id=2&status=active&search=Patil
Query Parameters:
- dept_id or dept (optional, integer, admin only): Filter by Department ID (1-4)
- ward_id or ward (optional, integer): Filter by Ward ID (1-4)
- status (optional, string): active, inactive, on_leave
- search (optional, string): Search by worker name, employee_id, or mobile
```

Response 200:
*(HTTP 200 OK)*
```json
[
  {
    "id": 8,
    "employee_id": "NMC-WRK-008",
    "name": "Ramesh Patil",
    "full_name": "Ramesh Patil",
    "mobile": "9810010008",
    "email": "ramesh.patil@nmc.gov.in",
    "dept": "Public Works Dept",
    "department": "Public Works Dept",
    "department_id": 1,
    "ward": "Ward 2",
    "ward_id": 2,
    "designation": "Senior Road Worker",
    "active_task_count": 2,
    "status": "active"
  }
]
```

Response 4xx:
*(HTTP 403 Forbidden)*
```json
{
  "detail": "You do not have permission to perform this action."
}
```

Example curl command:
```bash
curl -X GET "http://localhost:8000/api/v1/admin/workers/?ward_id=2" \
  -H "Authorization: Bearer <access_token>"
```

---

## 24. POST /api/v1/admin/workers/
Permission: [dept_officer, admin]

Creates a new municipal field worker account. 
- Mobile number must be 10 digits and unique.
- Employee ID must be unique.
- Ward and Department must be integers between 1 and 4.
- Department officers are locked to creating workers only in their own department.

Request:
```json
{
  "name": "Santosh Rao",
  "mobile": "9812345678",
  "employee_id": "NMC-WRK-050",
  "department": 1,
  "ward": 2,
  "designation": "Field Pothole Inspector",
  "email": "santosh.rao@nmc.gov.in",
  "password": "WorkerPassword@123",
  "status": "active"
}
```

Response 200:
*(HTTP 201 Created)*
```json
{
  "id": 25,
  "employee_id": "NMC-WRK-050",
  "name": "Santosh Rao",
  "full_name": "Santosh Rao",
  "mobile": "9812345678",
  "email": "santosh.rao@nmc.gov.in",
  "dept": "Public Works Dept",
  "department": "Public Works Dept",
  "department_id": 1,
  "ward": "Ward 2",
  "ward_id": 2,
  "designation": "Field Pothole Inspector",
  "active_task_count": 0,
  "status": "active"
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden)*
```json
{
  "mobile": "A user with this mobile number already exists.",
  "employee_id": "A user with this employee ID already exists.",
  "ward": "Ward must be an integer between 1 and 4."
}
```

Example curl command:
```bash
curl -X POST "http://localhost:8000/api/v1/admin/workers/" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Santosh Rao",
    "mobile": "9812345678",
    "employee_id": "NMC-WRK-050",
    "department": 1,
    "ward": 2,
    "designation": "Field Pothole Inspector",
    "email": "santosh.rao@nmc.gov.in",
    "password": "WorkerPassword@123",
    "status": "active"
  }'
```

---

## 25. PATCH /api/v1/admin/workers/:id/
Permission: [dept_officer, admin]

Updates field worker profile details (designation, ward, status, email).
- `mobile` and `employee_id` are immutable read-only fields.
- Department officers cannot alter worker department and can only modify workers in their own department.
- Administrators can reassign workers across departments.

Request:
```json
{
  "designation": "Senior Maintenance Supervisor",
  "ward": 3,
  "status": "active",
  "email": "santosh.updated@nmc.gov.in"
}
```

Response 200:
*(HTTP 200 OK)*
```json
{
  "id": 25,
  "employee_id": "NMC-WRK-050",
  "name": "Santosh Rao",
  "full_name": "Santosh Rao",
  "mobile": "9812345678",
  "email": "santosh.updated@nmc.gov.in",
  "dept": "Public Works Dept",
  "department": "Public Works Dept",
  "department_id": 1,
  "ward": "Ward 3",
  "ward_id": 3,
  "designation": "Senior Maintenance Supervisor",
  "active_task_count": 0,
  "status": "active"
}
```

Response 4xx:
*(HTTP 400 Bad Request / HTTP 403 Forbidden / HTTP 404 Not Found)*
```json
{
  "error": "mobile is read-only and cannot be modified."
}
```

Example curl command:
```bash
curl -X PATCH "http://localhost:8000/api/v1/admin/workers/25/" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "designation": "Senior Maintenance Supervisor",
    "ward": 3,
    "status": "active"
  }'
```
