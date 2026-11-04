import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WardBadge from './WardBadge';
import { formatDeptName } from '../utils/chartHelpers';

/**
 * OfficerSidebarDrawer component:
 * 1. Mobile & Tablet Slide-over Drawer (375px, 414px, 768px):
 *    - Opens on hamburger click
 *    - Backdrop blur overlay
 *    - Smooth slide-in from left
 * 2. Desktop Collapsible Sidebar (1280px):
 *    - Persistent or toggleable navigation bar
 * 3. Navigation Links:
 *    - Dashboard (/officer)
 *    - AI Validation Queue (/officer/validation) with live low-confidence badge
 *    - High Priority SLA Queue
 *    - Field Worker Deployment Table
 *    - Operations Dispatch Modal
 */
const OfficerSidebarDrawer = ({
  isOpen,
  onClose,
  pendingValidationCount = 4,
  onOpenDispatch,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const officerName = user?.name || 'Department Officer';
  const officerDept = formatDeptName(user?.department_name || user?.department || user?.dept || 'PWD');
  const currentPath = location.pathname;

  const handleNavClick = (path) => {
    if (path) navigate(path);
    if (onClose) onClose();
  };

  const navLinks = [
    {
      name: 'Department Dashboard',
      path: '/officer',
      icon: '📊',
      badge: null,
      isActive: currentPath === '/officer' || currentPath === '/officer/dashboard',
    },
    {
      name: 'AI Validation Queue',
      path: '/officer/validation',
      icon: '🤖',
      badge: `${pendingValidationCount} New`,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse',
      isActive: currentPath === '/officer/validation',
    },
    {
      name: 'Field Worker Roster',
      path: '/officer/roster',
      icon: '👷',
      badge: 'Roster',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      isActive: currentPath === '/officer/roster' || currentPath === '/officer/workers',
    },
    {
      name: 'High Priority Queue',
      action: () => {
        const el = document.getElementById('high-priority-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else navigate('/officer#high-priority-section');
      },
      icon: '🛡️',
      badge: 'SLA Watch',
      badgeColor: 'bg-red-100 text-danger border-red-200',
      isActive: false,
    },
    {
      name: 'Quick Worker Dispatch',
      action: () => {
        if (onOpenDispatch) onOpenDispatch();
      },
      icon: '⚡',
      badge: 'Action',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      isActive: false,
    },
    {
      name: 'Department Settings',
      path: '/officer/settings',
      icon: '⚙️',
      badge: 'Config',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      isActive: currentPath === '/officer/settings',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 backdrop-blur-xs transition-opacity animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over Drawer Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 sm:w-80 bg-white border-r border-slate-200 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Officer Sidebar Navigation"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-dark to-primary flex items-center justify-center text-white font-black text-lg shadow-sm">
                J
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-slate-900 tracking-tight text-sm">
                    JANMITRA
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-50 text-primary border border-blue-200">
                    Officer
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Municipal Command
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition text-lg"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* Officer Profile Card in Drawer */}
          <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-xs truncate max-w-[170px]">
                {officerName}
              </span>
              <WardBadge ward="1–4" />
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {officerDept}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 py-1">
            Portal Operations
          </div>

          {navLinks.map((link) => {
            const activeStyle = link.isActive
              ? 'bg-primary text-white shadow-sm font-bold shadow-blue-500/20'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold';

            return (
              <button
                key={link.name}
                type="button"
                onClick={() => {
                  if (link.action) link.action();
                  else handleNavClick(link.path);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all text-left ${activeStyle}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{link.icon}</span>
                  <span>{link.name}</span>
                </div>

                {link.badge && (
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      link.badgeColor || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer: Helplines & Logout */}
        <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
          <div className="text-[11px] text-slate-500 flex items-center justify-between font-medium">
            <span>SLA Monitoring: Active</span>
            <span className="text-emerald-600 font-bold">● System Normal</span>
          </div>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs"
          >
            <span>🚪</span>
            <span>Sign Out of Officer Portal</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default OfficerSidebarDrawer;
