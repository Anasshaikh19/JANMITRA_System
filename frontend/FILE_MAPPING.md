# JANMITRA – File Mapping & Integration Manifest

## 1. Overview
This contribution package contains the complete, completed frontend modules for:
- **Officer Dashboard & Command Center**
- **Field Worker Portal & Offline Synchronization**
- **Super Admin Dashboard & Worker Management**
- **Cross-Department Municipal Coordination Dashboard**
- **Supporting UI components, Leaflet maps, Recharts visualizers, utilities, state stores, and PWA assets.**

All files have been staged into `JANMITRA_CONTRIBUTION/` according to the agreed `JANMITRA_FINAL/frontend/` repository architecture.

---

## 2. File Mapping Table

| Original File Path | Destination Path (`JANMITRA_FINAL/`) | Action | Category / Purpose |
|---|---|:---:|---|
| `frontend/src/pages/officer/Dashboard.jsx` | `frontend/src/pages/officer/Dashboard.jsx` | Copied | Officer Dashboard (KPIs, Heatmap, Ward SLA) |
| `frontend/src/pages/officer/ValidationQueue.jsx` | `frontend/src/pages/officer/ValidationQueue.jsx` | Copied | Officer Validation Queue (Proof verification) |
| `frontend/src/pages/officer/WorkerRoster.jsx` | `frontend/src/pages/officer/WorkerRoster.jsx` | Copied | Officer Worker Roster & Dispatch |
| `frontend/src/pages/officer/HighPriorityQueue.jsx` | `frontend/src/pages/officer/HighPriorityQueue.jsx` | Copied | Officer Critical Escalation Triage |
| `frontend/src/pages/officer/HighPriorityList.jsx` | `frontend/src/pages/officer/HighPriorityList.jsx` | Copied | Officer High Priority Queue Re-export Alias |
| `frontend/src/pages/officer/AssignWorker.jsx` | `frontend/src/pages/officer/AssignWorker.jsx` | Copied | Officer Worker Assignment Modal / Form |
| `frontend/src/pages/officer/ComplaintDetailModal.jsx` | `frontend/src/pages/officer/ComplaintDetailModal.jsx` | Copied | Officer Complaint Detail & Map Modal |
| `frontend/src/pages/officer/OfficerSettings.jsx` | `frontend/src/pages/officer/OfficerSettings.jsx` | Copied | Officer Department Configuration |
| `frontend/src/pages/worker/TaskList.jsx` | `frontend/src/pages/worker/TaskList.jsx` | Copied | Worker Active Task Feed & Status |
| `frontend/src/pages/worker/TaskDetail.jsx` | `frontend/src/pages/worker/TaskDetail.jsx` | Copied | Worker Task Execution, GPS Routing & Upload |
| `frontend/src/pages/worker/CompletedTasks.jsx` | `frontend/src/pages/worker/CompletedTasks.jsx` | Copied | Worker Resolution History & Audit |
| `frontend/src/pages/worker/Profile.jsx` | `frontend/src/pages/worker/Profile.jsx` | Copied | Worker Shift & Performance Profile |
| `frontend/src/pages/worker/WorkerLayout.jsx` | `frontend/src/pages/worker/WorkerLayout.jsx` | Copied | Worker Layout Re-export Wrapper |
| `frontend/src/pages/admin/AdminPanel.jsx` | `frontend/src/pages/admin/AdminPanel.jsx` | Copied | Super Admin Control Dashboard |
| `frontend/src/pages/admin/CrossDeptDashboard.jsx` | `frontend/src/pages/admin/CrossDeptDashboard.jsx` | Copied | Cross-Department Inter-agency Dashboard |
| `frontend/src/pages/admin/ComplaintsLedger.jsx` | `frontend/src/pages/admin/ComplaintsLedger.jsx` | Copied | Admin Central Complaint Audit Ledger |
| `frontend/src/pages/admin/WorkerManagement.jsx` | `frontend/src/pages/admin/WorkerManagement.jsx` | Copied | Admin Worker Management & Onboarding |
| `frontend/src/pages/admin/SystemSettings.jsx` | `frontend/src/pages/admin/SystemSettings.jsx` | Copied | Admin SLA & System Configuration |
| `frontend/src/components/CategoryBadge.jsx` | `frontend/src/components/CategoryBadge.jsx` | Copied | Department / Category color-coded badge |
| `frontend/src/components/PriorityBadge.jsx` | `frontend/src/components/PriorityBadge.jsx` | Copied | SLA Priority badge (Critical/High/Med/Low) |
| `frontend/src/components/StatusBadge.jsx` | `frontend/src/components/StatusBadge.jsx` | Copied | Lifecycle status indicator badge |
| `frontend/src/components/WardBadge.jsx` | `frontend/src/components/WardBadge.jsx` | Copied | Ward number & zone tag |
| `frontend/src/components/KPICard.jsx` | `frontend/src/components/KPICard.jsx` | Copied | Dashboard KPI metric summary card |
| `frontend/src/components/LeafletMap.jsx` | `frontend/src/components/LeafletMap.jsx` | Copied | Interactive OpenStreetMap Leaflet component |
| `frontend/src/components/LoadingSkeleton.jsx` | `frontend/src/components/LoadingSkeleton.jsx` | Copied | Dashboard & list loading placeholder skeleton |
| `frontend/src/components/LoadingSpinner.jsx` | `frontend/src/components/LoadingSpinner.jsx` | Copied | Civic-branded loading spinner |
| `frontend/src/components/ErrorMessage.jsx` | `frontend/src/components/ErrorMessage.jsx` | Copied | API error notification banner with retry |
| `frontend/src/components/OfficerSidebarDrawer.jsx` | `frontend/src/components/OfficerSidebarDrawer.jsx` | Copied | Officer portal sidebar drawer navigation |
| `frontend/src/components/WorkerLayout.jsx` | `frontend/src/components/WorkerLayout.jsx` | Copied | Field worker mobile bottom navigation layout |
| `frontend/src/components/WorkerRegistrationForm.jsx` | `frontend/src/components/WorkerRegistrationForm.jsx` | Copied | Admin worker registration form modal |
| `frontend/src/components/WorkerRouteMap.jsx` | `frontend/src/components/WorkerRouteMap.jsx` | Copied | Multi-stop routing map for worker tasks |
| `frontend/src/components/HighPriorityQueue.jsx` | `frontend/src/components/HighPriorityQueue.jsx` | Copied | Component barrel re-export |
| `frontend/src/components/index.js` | `frontend/src/components/index.js` | Copied | Unified component barrel export |
| `frontend/src/utils/chartHelpers.js` | `frontend/src/utils/chartHelpers.js` | Copied | Recharts colors, date & label formatters |
| `frontend/src/utils/complaintStore.js` | `frontend/src/utils/complaintStore.js` | Copied | Offline-resilient complaint store & mock fallback |
| `frontend/src/utils/errorHandler.js` | `frontend/src/utils/errorHandler.js` | Copied | DRF error normalizer & field parser |
| `frontend/src/utils/mapIcons.js` | `frontend/src/utils/mapIcons.js` | Copied | Custom SVG category pins & worker markers |
| `frontend/src/utils/offlineStorage.js` | `frontend/src/utils/offlineStorage.js` | Copied | IndexedDB / LocalStorage queue for offline sync |
| `frontend/src/api/client.js` | `frontend/src/api/client.js` | Copied / Shared | Axios client with JWT refresh & offline fallback |
| `frontend/src/api/client.js` | `frontend/src/services/api.js` | Copied / Shared | Standardized services API client |
| `frontend/src/context/AuthContext.jsx` | `frontend/src/context/AuthContext.jsx` | Copied / Shared | Role-based authentication context (`officer`, `worker`, `admin`) |
| `frontend/public/manifest.json` | `frontend/public/manifest.json` | Copied | Web App Manifest for field worker PWA |
| `frontend/public/sw.js` | `frontend/public/sw.js` | Copied | Service Worker for offline caching & sync |
| `frontend/public/favicon.svg` | `frontend/public/favicon.svg` | Copied | Municipal portal favicon |
| `frontend/public/apple-touch-icon.png` | `frontend/public/apple-touch-icon.png` | Copied | Mobile touch icon |
| `frontend/public/icons.svg` | `frontend/public/icons.svg` | Copied | PWA SVG sprite icon |
| `frontend/public/icon-192x192.png` | `frontend/public/icon-192x192.png` | Copied | 192px PWA icon |
| `frontend/public/icon-512x512.png` | `frontend/public/icon-512x512.png` | Copied | 512px PWA icon |
| `frontend/public/icons/icon-192x192.png` | `frontend/public/icons/icon-192x192.png` | Copied | Subfolder 192px PWA icon |
| `frontend/public/icons/icon-512x512.png` | `frontend/public/icons/icon-512x512.png` | Copied | Subfolder 512px PWA icon |

---

## 3. Contribution Statistics
- **Total Files Copied**: **50 files**
- **Total Folders Created**: **13 directories**
  1. `frontend`
  2. `frontend/public`
  3. `frontend/public/icons`
  4. `frontend/src`
  5. `frontend/src/api`
  6. `frontend/src/components`
  7. `frontend/src/context`
  8. `frontend/src/pages`
  9. `frontend/src/pages/admin`
  10. `frontend/src/pages/officer`
  11. `frontend/src/pages/worker`
  12. `frontend/src/services`
  13. `frontend/src/utils`

---

## 4. Shared Files & Integration Instructions

Do **not** overwrite the team's shared core files. Instead, ensure the following route definitions and dependencies are present in the shared project files:

### 4.1 Route Integration in `frontend/src/App.jsx`
Mount the following lazy routes into the team's `AppRoutes`:
```jsx
// Officer Routes
const OfficerDashboard = React.lazy(() => import('./pages/officer/Dashboard'));
const ValidationQueue = React.lazy(() => import('./pages/officer/ValidationQueue'));
const WorkerRoster = React.lazy(() => import('./pages/officer/WorkerRoster'));
const OfficerSettings = React.lazy(() => import('./pages/officer/OfficerSettings'));

// Worker Routes
const TaskList = React.lazy(() => import('./pages/worker/TaskList'));
const TaskDetail = React.lazy(() => import('./pages/worker/TaskDetail'));
const CompletedTasks = React.lazy(() => import('./pages/worker/CompletedTasks'));
const Profile = React.lazy(() => import('./pages/worker/Profile'));

// Admin Routes
const AdminPanel = React.lazy(() => import('./pages/admin/AdminPanel'));
const ComplaintsLedger = React.lazy(() => import('./pages/admin/ComplaintsLedger'));
const CrossDeptDashboard = React.lazy(() => import('./pages/admin/CrossDeptDashboard'));
const WorkerManagement = React.lazy(() => import('./pages/admin/WorkerManagement'));
const SystemSettings = React.lazy(() => import('./pages/admin/SystemSettings'));
```

### 4.2 Auth Roles in `frontend/src/context/AuthContext.jsx`
Ensure role checks support:
- `'officer'` (aliases: `'department_officer'`, `'municipal_officer'`, `'swm'`, `'pwd'`, `'wsd'`, `'elec'`)
- `'worker'` (alias: `'field_worker'`)
- `'admin'` (alias: `'superadmin'`)

### 4.3 Required Dependencies in `frontend/package.json`
Verify the team repository contains:
```json
{
  "dependencies": {
    "axios": "^1.20.0",
    "leaflet": "^1.9.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-leaflet": "^5.0.0",
    "react-router-dom": "^7.18.4",
    "recharts": "^3.10.1"
  }
}
```

---

## 5. Intentionally Excluded Files

The following files have been intentionally excluded from this contribution to protect teammate work and maintain repository hygiene:

1. **Citizen Portal Files** (Belonging to Citizen Lead):
   - `frontend/src/pages/citizen/Home.jsx`
   - `frontend/src/pages/citizen/SubmitForm.jsx`
   - `frontend/src/pages/citizen/MyComplaints.jsx`
   - `frontend/src/pages/citizen/ComplaintDetail.jsx`
   - `frontend/src/pages/citizen/CitizenComplaints.jsx`
   - `frontend/src/pages/citizen/CitizenProfile.jsx`
   - `frontend/src/pages/citizen/CitizenHelp.jsx`
   - `frontend/src/components/CitizenLayout.jsx`
   - `frontend/src/assets/hero.png`

2. **Backend & AI Pipeline**:
   - `dashboard/urls.py`, `dashboard/views.py`, `dashboard/__init__.py`

3. **Presentation & Local Development Scripts**:
   - `generate_presentation.py`
   - `JANMITRA_Seminar_Presentation.pptx`
   - `SEMINAR_PRESENTATION_OUTLINE.md`
   - `LIVE_DEMO_TIMED_SCRIPT.md`
   - `OPEN_JANMITRA.html` (root and frontend)
   - `START_JANMITRA.bat` (root and frontend)
   - `requirements.txt`
   - `FRONTEND_DEPLOYMENT_CHECKLIST.md`
   - `FRONTEND_HANDOVER_DOCUMENTATION.md`
   - `FRONTEND_SMOKE_TEST_REPORT.md`
   - `UI_COMPONENT_GUIDE.md`
   - `UI_SCREENSHOTS_CATALOG.md`
   - `screenshots/` directory

4. **Environment, Build, and Diagnostics**:
   - `frontend/node_modules/`
   - `.venv/`
   - `frontend/dist/`
   - `frontend/.env`
   - `frontend/.oxlintrc.json`
   - `frontend/package-lock.json`
   - `frontend/frontend_test_plan.md`
   - `frontend/src/pages/HealthCheck.jsx`
   - `frontend/src/pages/auth/LoginPage.jsx` (Core authentication landing)
