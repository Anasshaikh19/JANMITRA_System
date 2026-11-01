/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/layouts/AdminLayout.jsx
 * Developer: Faizan Rayeen (Notifications & Portal Layouts Lead)
 * Description: Super Admin Portal Layout.
 *              Includes Department Switcher dropdown, desktop sidebar,
 *              and admin navigation: All Departments | Workers | Reports | Settings.
 * ==============================================================================
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from './Layout';

// 4 Municipal Departments in JANMITRA
const DEPARTMENTS = [
  { id: 'all', name: '🏛️ All Municipal Departments' },
  { id: 'pwd', name: '🚧 PWD (Roads & Infra)' },
  { id: 'swm', name: '🗑️ Solid Waste Management' },
  { id: 'phe', name: '🚰 Public Health Engineering' },
  { id: 'electrical', name: '💡 Electrical Department' },
];

const ADMIN_NAV_ITEMS = [
  {
    path: '/admin',
    label: 'All Departments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  {
    path: '/admin/workers',
    label: 'Workers',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  },
  {
    path: '/admin/reports',
    label: 'Reports & Analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
];

export const AdminLayout = ({ children }) => {
  const location = useLocation();
  const [selectedDept, setSelectedDept] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  // Department Switcher Dropdown
  const departmentSwitcher = (
    <div className="p-3 bg-slate-50 border-b border-slate-200">
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        Department Filter
      </label>
      <select
        value={selectedDept}
        onChange={(e) => setSelectedDept(e.target.value)}
        className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:border-[#0d2a53]"
      >
        {DEPARTMENTS.map((dept) => (
          <option key={dept.id} value={dept.id}>
            {dept.name}
          </option>
        ))}
      </select>
    </div>
  );

  const renderNavLinks = (onItemClick) => (
    <div className="p-3 space-y-1">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
        Admin Controls
      </div>
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive =
          item.path === '/admin'
            ? location.pathname === '/admin' || location.pathname === '/admin/'
            : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              if (onItemClick) onItemClick();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-[#0d2a53] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className={isActive ? 'text-blue-300' : 'text-slate-400'}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const desktopSidebar = (
    <div className="hidden md:flex flex-col h-full">
      {departmentSwitcher}
      <div className="flex-1 py-2">
        {renderNavLinks()}
      </div>
      <div className="p-4 border-t border-slate-200 text-center">
        <span className="text-[10px] text-slate-400 font-medium">
          Nagpur Central Administration
        </span>
      </div>
    </div>
  );

  return (
    <Layout role="admin" sidebar={desktopSidebar}>
      {/* Mobile Department Switcher & Menu Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-3 flex items-center justify-between gap-2 shadow-xs">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Admin Menu</span>
        </button>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800"
        >
          {DEPARTMENTS.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 bg-white h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#0d2a53] text-white flex items-center justify-between">
              <div className="font-bold text-sm tracking-wide">Admin Navigation</div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-white text-xl font-bold p-1 hover:text-slate-300"
              >
                &times;
              </button>
            </div>
            {departmentSwitcher}
            <div className="flex-1 overflow-y-auto">
              {renderNavLinks(() => setMobileMenuOpen(false))}
            </div>
          </div>
        </div>
      )}

      {/* Main Page Content */}
      <div className="p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </Layout>
  );
};

export default AdminLayout;
