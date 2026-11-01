/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/App.jsx
 * Developer: Faizan Rayeen (Notifications & Portal Layouts Lead)
 * Description: Master Application router wiring all 4 portal layouts:
 *              - Citizen Portal wrapped in CitizenLayout
 *              - Worker Portal wrapped in WorkerLayout
 *              - Department Officer Portal wrapped in OfficerLayout
 *              - Super Admin Portal wrapped in AdminLayout
 *              Fully wrapped in AuthProvider and FirebaseProvider.
 * ==============================================================================
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Context Providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { FirebaseProvider } from './context/FirebaseProvider';

// Layouts
import CitizenLayout from './layouts/CitizenLayout';
import WorkerLayout from './layouts/WorkerLayout';
import OfficerLayout from './layouts/OfficerLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import LoginPage from './pages/LoginPage';
import CitizenHome from './pages/citizen/Home';
import MyComplaints from './pages/citizen/MyComplaints';
import ComplaintDetail from './pages/citizen/ComplaintDetail';
import CitizenProfile from './pages/citizen/Profile';
import CitizenHelp from './pages/citizen/Help';
import CitizenSubmit from './pages/citizen/Submit';
import WorkerManagement from './pages/admin/WorkerManagement';
import CrossDeptDashboard from './pages/admin/CrossDeptDashboard';
import OfficerDashboard from './pages/officer/Dashboard';

// Helper component for Root Route
const RootRedirect = () => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  const cleanRole = (role || 'citizen').toLowerCase();
  switch (cleanRole) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'officer':
    case 'dept_officer':
      return <Navigate to="/officer" replace />;
    case 'worker':
      return <Navigate to="/worker" replace />;
    case 'citizen':
    default:
      return <Navigate to="/citizen" replace />;
  }
};

// Protected route wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles) {
    const cleanRole = (role || 'citizen').toLowerCase();
    const mapped = cleanRole === 'dept_officer' ? 'officer' : cleanRole;
    if (!allowedRoles.includes(mapped) && !allowedRoles.includes(cleanRole)) {
      const target = cleanRole === 'admin' ? '/admin' : (cleanRole === 'officer' || cleanRole === 'dept_officer') ? '/officer' : cleanRole === 'worker' ? '/worker' : '/citizen';
      return <Navigate to={target} replace />;
    }
  }
  return children;
};

// Public auth route wrapper (redirect if already logged in)
const PublicAuthRoute = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  if (isAuthenticated) {
    const cleanRole = (role || 'citizen').toLowerCase();
    const target = cleanRole === 'admin' ? '/admin' : (cleanRole === 'officer' || cleanRole === 'dept_officer') ? '/officer' : cleanRole === 'worker' ? '/worker' : '/citizen';
    return <Navigate to={target} replace />;
  }
  return children;
};

// Lightweight placeholders for remaining portals (built in upcoming days)
const PlaceholderCard = ({ title, desc, role }) => (
  <div className="max-w-md mx-auto p-6 mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
    <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
      🏛️
    </div>
    <h2 className="text-base font-bold text-slate-800">{title}</h2>
    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    <div className="pt-2">
      <span className="text-[11px] font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
        {role} Portal View
      </span>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FirebaseProvider>
          <Routes>
            {/* ================= PUBLIC AUTH ROUTES ================= */}
            <Route path="/login" element={<PublicAuthRoute><LoginPage /></PublicAuthRoute>} />
            <Route path="/register" element={<PublicAuthRoute><LoginPage /></PublicAuthRoute>} />

            {/* Default Root Redirect based on authentication status */}
            <Route path="/" element={<RootRedirect />} />

            {/* ================= 1. CITIZEN PORTAL ================= */}
            <Route
              path="/citizen"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                  <CitizenLayout>
                    <CitizenHome />
                  </CitizenLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/complaints"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                  <CitizenLayout>
                    <MyComplaints />
                  </CitizenLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/complaint/:id"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                  <CitizenLayout>
                    <ComplaintDetail />
                  </CitizenLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/submit"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                  <CitizenLayout>
                    <CitizenSubmit />
                  </CitizenLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/profile"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                  <CitizenLayout>
                    <CitizenProfile />
                  </CitizenLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/citizen/help"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                  <CitizenLayout>
                    <CitizenHelp />
                  </CitizenLayout>
                </ProtectedRoute>
              }
            />

            {/* ================= 2. FIELD WORKER PORTAL ================= */}
            <Route
              path="/worker"
              element={
                <ProtectedRoute allowedRoles={['worker', 'admin']}>
                  <WorkerLayout>
                    <PlaceholderCard
                      title="Assigned Tasks"
                      desc="List of pending civic repairs with GPS map navigation."
                      role="Worker"
                    />
                  </WorkerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/completed"
              element={
                <ProtectedRoute allowedRoles={['worker', 'admin']}>
                  <WorkerLayout>
                    <PlaceholderCard
                      title="Completed Work"
                      desc="Resolved civic tasks with proof-of-work photos."
                      role="Worker"
                    />
                  </WorkerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/profile"
              element={
                <ProtectedRoute allowedRoles={['worker', 'admin']}>
                  <WorkerLayout>
                    <PlaceholderCard
                      title="Worker Profile"
                      desc="Department and Ward assignment details."
                      role="Worker"
                    />
                  </WorkerLayout>
                </ProtectedRoute>
              }
            />

            {/* ================= 3. DEPARTMENT OFFICER PORTAL ================= */}
            <Route
              path="/officer"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <OfficerLayout>
                    <OfficerDashboard />
                  </OfficerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/officer/validation"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <OfficerLayout>
                    <PlaceholderCard
                      title="Pending Human Validation"
                      desc="Review edge-case complaints flagged by AI."
                      role="Officer"
                    />
                  </OfficerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/officer/workers"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <OfficerLayout>
                    <WorkerManagement />
                  </OfficerLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/officer/settings"
              element={
                <ProtectedRoute allowedRoles={['officer', 'admin']}>
                  <OfficerLayout>
                    <PlaceholderCard
                      title="Department Settings"
                      desc="SLA thresholds and notification rules."
                      role="Officer"
                    />
                  </OfficerLayout>
                </ProtectedRoute>
              }
            />

            {/* ================= 4. SUPER ADMIN PORTAL ================= */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <CrossDeptDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/workers"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <WorkerManagement />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <PlaceholderCard
                      title="City-Wide Complaints Ledger"
                      desc="Browse and filter civic issues across all 4 departments and 4 wards."
                      role="Admin"
                    />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <PlaceholderCard
                      title="Civic Analytics & Export"
                      desc="Download monthly resolution performance reports."
                      role="Admin"
                    />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout>
                    <PlaceholderCard
                      title="System Settings"
                      desc="Master categories, ward boundaries, and administrative access."
                      role="Admin"
                    />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </FirebaseProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
