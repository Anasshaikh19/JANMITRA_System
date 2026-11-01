/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/layouts/Layout.jsx
 * Developer: Faizan Rayeen (Notifications & Portal Layouts Lead)
 * Description: Base layout wrapper shared across all 4 user roles.
 *              Contains branded header, role indicator pill, notification bell,
 *              logout action, and responsive content area.
 * ==============================================================================
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from '../components/NotificationBell';

// Role styling helper
const getRoleBadgeStyle = (role) => {
  const r = (role || 'citizen').toLowerCase();
  switch (r) {
    case 'admin':
      return { label: 'Admin', bg: 'bg-rose-500/20 text-rose-200 border-rose-400/30' };
    case 'dept_officer':
    case 'officer':
      return { label: 'Officer', bg: 'bg-purple-500/20 text-purple-200 border-purple-400/30' };
    case 'worker':
      return { label: 'Worker', bg: 'bg-amber-500/20 text-amber-200 border-amber-400/30' };
    case 'citizen':
    default:
      return { label: 'Citizen', bg: 'bg-blue-500/20 text-blue-200 border-blue-400/30' };
  }
};

export const Layout = ({
  children,
  role = 'citizen',
  bottomNav = null,
  sidebar = null,
  titleAction = null
}) => {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  let location;
  try {
    location = useLocation();
  } catch (e) {
    location = { pathname: '/citizen' };
  }
  const currentPath = location.pathname;

  const { user, logout } = useAuth();
  const currentRole = role || user?.role || 'citizen';
  const roleBadge = getRoleBadgeStyle(currentRole);

  const citizenNavItems = [
    { label: 'Home', path: '/citizen', icon: '🏠', exact: true },
    { label: 'My Complaints', path: '/citizen/complaints', icon: '📋' },
    { label: 'Help', path: '/citizen/help', icon: '❓' },
    { label: 'Profile', path: '/citizen/profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* ================= TOP NAVBAR ================= */}
      <nav className="sticky top-0 z-40 bg-[#0d2a53] text-white shadow-md border-b border-blue-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Left: Brand & Role */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/${currentRole === 'dept_officer' ? 'officer' : currentRole}`)}
              className="flex items-center gap-2 text-left focus:outline-none"
            >
              <span className="text-2xl" role="img" aria-label="Logo">🏛️</span>
              <div>
                <span className="font-black text-lg tracking-wider text-white uppercase block leading-none">
                  JANMITRA
                </span>
                <span className="text-[10px] text-blue-200 font-medium tracking-wide">
                  Municipal Corporation
                </span>
              </div>
            </button>

            {/* Role Badge */}
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${roleBadge.bg}`}
            >
              {roleBadge.label}
            </span>
          </div>

          {/* Center: Sleek Desktop Navigation Capsule for Citizen (Desktop Only) */}
          {currentRole === 'citizen' && (
            <div className="hidden md:flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/10 backdrop-blur-sm shadow-inner">
              {citizenNavItems.map((item) => {
                const isActive = item.exact
                  ? currentPath === '/citizen' || currentPath === '/citizen/'
                  : currentPath.startsWith(item.path) ||
                    (item.path === '/citizen/complaints' && currentPath.startsWith('/citizen/complaint/'));

                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs transition duration-150 flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-white text-[#0d2a53] font-bold shadow-md'
                        : 'text-blue-100 hover:text-white hover:bg-white/10 font-semibold'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Optional Title Action (e.g. Dept Switcher for Admin) */}
          {titleAction && (
            <div className="hidden md:block">
              {titleAction}
            </div>
          )}

          {/* Right: Notification Bell, User Avatar & Logout */}
          <div className="flex items-center gap-3">
            {/* Notification Bell Component */}
            <NotificationBell
              onComplaintClick={(id) => navigate(`/citizen/complaint/${id}`)}
            />

            {/* User Greeting (Desktop) */}
            {user?.name && (
              <span className="hidden sm:inline-block text-xs font-semibold text-slate-200">
                {user.name.split(' ')[0]}
              </span>
            )}

            {/* Logout Button */}
            <button
              onClick={logout}
              className="text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
              title="Sign Out"
            >
              <span>Logout</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ================= BODY WRAPPER (With optional sidebar) ================= */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar (Desktop for Admin / Officer) */}
        {sidebar && (
          <aside className="w-64 border-r border-slate-200 bg-white flex-shrink-0">
            {sidebar}
          </aside>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 w-full ${bottomNav ? 'pb-24 md:pb-10' : 'pb-8'}`}>
          {children}
        </main>
      </div>

      {/* ================= BOTTOM TAB NAVIGATION (Mobile Only: Screen < 768px) ================= */}
      {bottomNav && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl">
          <div className="max-w-md mx-auto">
            {bottomNav}
          </div>
        </div>
      )}

    </div>
  );
};

export default Layout;
