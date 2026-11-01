/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/layouts/OfficerLayout.jsx
 * Developer: Faizan Rayeen (Notifications & Portal Layouts Lead)
 * Description: Department Officer Portal Layout.
 *              Features desktop sidebar and mobile sliding drawer:
 *              Items: Dashboard | Pending Validation | Workers | Settings.
 * ==============================================================================
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from './Layout';

const OFFICER_NAV_ITEMS = [
  {
    path: '/officer',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )
  },
  {
    path: '/officer/validation',
    label: 'Pending Validation',
    badge: 'New',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    path: '/officer/workers',
    label: 'Workers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    path: '/officer/settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
];

export const OfficerLayout = ({ children }) => {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  // Sidebar content (used both in desktop sidebar and mobile drawer)
  const renderNavLinks = (onItemClick) => (
    <div className="p-4 space-y-1.5">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
        Department Officer Portal
      </div>
      {OFFICER_NAV_ITEMS.map((item) => {
        const isActive =
          item.path === '/officer'
            ? location.pathname === '/officer' || location.pathname === '/officer/'
            : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              if (onItemClick) onItemClick();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-[#0d2a53] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={isActive ? 'text-blue-300' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>

            {item.badge && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const desktopSidebar = (
    <div className="hidden md:block h-full py-4">
      {renderNavLinks()}
    </div>
  );

  return (
    <Layout role="dept_officer" sidebar={desktopSidebar}>
      {/* Mobile Drawer Trigger Header Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-xs">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Officer Menu</span>
        </button>

        <span className="text-xs font-semibold text-slate-500">
          Nagpur Municipal Corporation
        </span>
      </div>

      {/* Mobile Drawer Sliding Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-72 bg-white h-full shadow-2xl flex flex-col animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#0d2a53] text-white flex items-center justify-between">
              <div className="font-bold text-sm tracking-wide">Officer Navigation</div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-white text-xl font-bold p-1 hover:text-slate-300"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderNavLinks(() => setDrawerOpen(false))}
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </Layout>
  );
};

export default OfficerLayout;
