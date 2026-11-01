/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/layouts/WorkerLayout.jsx
 * Developer: Faizan Rayeen (Notifications & Portal Layouts Lead)
 * Description: Field Worker Portal Layout with mobile bottom tabs:
 *              Tabs: Tasks | Completed | Profile (active highlighted in blue).
 * ==============================================================================
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from './Layout';

const WORKER_TABS = [
  {
    path: '/worker',
    label: 'Tasks',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-[#1A56DB]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    )
  },
  {
    path: '/worker/completed',
    label: 'Completed',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-[#1A56DB]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    path: '/worker/profile',
    label: 'Profile',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-[#1A56DB]' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  }
];

export const WorkerLayout = ({ children }) => {
  const location = useLocation();
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  const bottomNav = (
    <div className="flex items-center justify-around h-16 px-2">
      {WORKER_TABS.map((tab) => {
        const isActive =
          tab.path === '/worker'
            ? location.pathname === '/worker' || location.pathname === '/worker/'
            : location.pathname.startsWith(tab.path);

        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex-1 flex flex-col items-center justify-center py-1 transition-all"
          >
            {tab.icon(isActive)}
            <span
              className={`text-[11px] font-bold mt-1 transition-colors ${
                isActive ? 'text-[#1A56DB]' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </span>
            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#1A56DB] mt-0.5" />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <Layout role="worker" bottomNav={bottomNav}>
      {children}
    </Layout>
  );
};

export default WorkerLayout;
