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
import { AuthProvider } from './context/AuthContext';
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<LoginPage />} />

            {/* Default Root Redirect */}
            <Route path="/" element={<Navigate to="/citizen" replace />} />

            {/* ================= 1. CITIZEN PORTAL ================= */}
            <Route
              path="/citizen"
              element={
                <CitizenLayout>
                  <CitizenHome />
                </CitizenLayout>
              }
            />
            <Route
              path="/citizen/complaints"
              element={
                <CitizenLayout>
                  <MyComplaints />
                </CitizenLayout>
              }
            />
            <Route
              path="/citizen/complaint/:id"
              element={
                <CitizenLayout>
                  <ComplaintDetail />
                </CitizenLayout>
              }
            />
            <Route
              path="/citizen/submit"
              element={
                <CitizenLayout>
                  <CitizenSubmit />
                </CitizenLayout>
              }
            />
            <Route
              path="/citizen/profile"
              element={
                <CitizenLayout>
                  <CitizenProfile />
                </CitizenLayout>
              }
            />
            <Route
              path="/citizen/help"
              element={
                <CitizenLayout>
                  <CitizenHelp />
                </CitizenLayout>
              }
            />

            {/* ================= 2. FIELD WORKER PORTAL ================= */}
            <Route
              path="/worker"
              element={
                <WorkerLayout>
                  <PlaceholderCard
                    title="Assigned Tasks"
                    desc="List of pending civic repairs with GPS map navigation."
                    role="Worker"
                  />
                </WorkerLayout>
              }
            />
            <Route
              path="/worker/completed"
              element={
                <WorkerLayout>
                  <PlaceholderCard
                    title="Completed Work"
                    desc="Resolved civic tasks with proof-of-work photos."
                    role="Worker"
                  />
                </WorkerLayout>
              }
            />
            <Route
              path="/worker/profile"
              element={
                <WorkerLayout>
                  <PlaceholderCard
                    title="Worker Profile"
                    desc="Department and Ward assignment details."
                    role="Worker"
                  />
                </WorkerLayout>
              }
            />

            {/* ================= 3. DEPARTMENT OFFICER PORTAL ================= */}
            <Route
              path="/officer"
              element={
                <OfficerLayout>
                  <OfficerDashboard />
                </OfficerLayout>
              }
            />
            <Route
              path="/officer/validation"
              element={
                <OfficerLayout>
                  <PlaceholderCard
                    title="Pending Human Validation"
                    desc="Review edge-case complaints flagged by AI."
                    role="Officer"
                  />
                </OfficerLayout>
              }
            />
            <Route
              path="/officer/workers"
              element={
                <OfficerLayout>
                  <WorkerManagement />
                </OfficerLayout>
              }
            />
            <Route
              path="/officer/settings"
              element={
                <OfficerLayout>
                  <PlaceholderCard
                    title="Department Settings"
                    desc="SLA thresholds and notification rules."
                    role="Officer"
                  />
                </OfficerLayout>
              }
            />

            {/* ================= 4. SUPER ADMIN PORTAL ================= */}
            <Route
              path="/admin"
              element={
                <AdminLayout>
                  <CrossDeptDashboard />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/workers"
              element={
                <AdminLayout>
                  <WorkerManagement />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <AdminLayout>
                  <PlaceholderCard
                    title="City-Wide Complaints Ledger"
                    desc="Browse and filter civic issues across all 4 departments and 4 wards."
                    role="Admin"
                  />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <AdminLayout>
                  <PlaceholderCard
                    title="Civic Analytics & Export"
                    desc="Download monthly resolution performance reports."
                    role="Admin"
                  />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminLayout>
                  <PlaceholderCard
                    title="System Settings"
                    desc="Master categories, ward boundaries, and administrative access."
                    role="Admin"
                  />
                </AdminLayout>
              }
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/citizen" replace />} />
          </Routes>
        </FirebaseProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
