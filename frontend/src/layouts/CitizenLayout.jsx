/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/layouts/CitizenLayout.jsx
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Description: Citizen Portal Layout with 4-tab mobile bottom navigation bar:
 *              Tabs: Home | My Complaints | Help | Profile
 *              Active tab highlighted with vibrant blue icon & label (#1A56DB).
 *              Also preserves active state when inspecting complaint detail.
 * ==============================================================================
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from './Layout';

// 4 Citizen Bottom Navigation Tabs
export const CITIZEN_TABS = [
  {
    path: '/citizen',
    label: 'Home',
    matches: (pathname) => pathname === '/citizen' || pathname === '/citizen/',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform duration-200 ${
          active ? 'text-[#1A56DB] scale-110' : 'text-slate-400 group-hover:text-slate-600'
        }`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={active ? '1.5' : '2'}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    )
  },
  {
    path: '/citizen/complaints',
    label: 'My Complaints',
    matches: (pathname) =>
      pathname.startsWith('/citizen/complaints') ||
      pathname.startsWith('/citizen/complaint/'),
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform duration-200 ${
          active ? 'text-[#1A56DB] scale-110' : 'text-slate-400 group-hover:text-slate-600'
        }`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={active ? '1.5' : '2'}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    )
  },
  {
    path: '/citizen/help',
    label: 'Help',
    matches: (pathname) => pathname.startsWith('/citizen/help'),
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform duration-200 ${
          active ? 'text-[#1A56DB] scale-110' : 'text-slate-400 group-hover:text-slate-600'
        }`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={active ? '1.5' : '2'}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    )
  },
  {
    path: '/citizen/profile',
    label: 'Profile',
    matches: (pathname) => pathname.startsWith('/citizen/profile'),
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform duration-200 ${
          active ? 'text-[#1A56DB] scale-110' : 'text-slate-400 group-hover:text-slate-600'
        }`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={active ? '1.5' : '2'}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    )
  }
];

export const CitizenLayout = ({ children }) => {
  const location = useLocation();
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => {
      window.location.href = path;
    };
  }

  const currentPath = location.pathname;

  // Render 4 bottom navigation tabs for mobile / tablet screens
  const bottomNav = (
    <nav
      aria-label="Citizen bottom navigation"
      className="flex items-center justify-around h-16 px-2 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      {CITIZEN_TABS.map((tab) => {
        const isActive = tab.matches(currentPath);

        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            className="flex-1 flex flex-col items-center justify-center py-1 transition-all duration-150 group cursor-pointer focus:outline-none"
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.icon(isActive)}
            <span
              className={`text-[11px] font-bold mt-1 transition-colors ${
                isActive ? 'text-[#1A56DB] font-extrabold' : 'text-slate-500 group-hover:text-slate-700'
              }`}
            >
              {tab.label}
            </span>
            {isActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A56DB] mt-0.5 animate-pulse" />
            ) : (
              <span className="w-1.5 h-1.5 mt-0.5 opacity-0" />
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <Layout role="citizen" bottomNav={bottomNav}>
      <div className="pb-16 sm:pb-8">
        {children}
      </div>
    </Layout>
  );
};

export default CitizenLayout;
