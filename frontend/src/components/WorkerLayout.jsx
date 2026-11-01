import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WardBadge from './WardBadge';

/**
 * WorkerLayout:
 * - Top Header:
 *   - JANMITRA logo & branding
 *   - 'Field Worker' badge
 *   - Notification bell with unread indicator & dropdown preview
 *   - Logout button
 * - Main content container (mobile-first, pb-20 to clear bottom tab bar)
 * - Bottom Tab Bar (mobile-first):
 *   - Tasks (active) | Completed | Profile
 */
const WorkerLayout = ({
  children,
  activeBottomTab = 'tasks',
  onBottomTabChange,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const workerName = user?.name || 'Suresh Patil';
  const workerDept = user?.dept || user?.department || 'PWD (Roads)';
  const workerWard = user?.ward || 2;
  const workerEmail = user?.email || 'worker@janmitra.gov.in';

  // Demo notifications for field worker
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'High Priority Task Assigned',
      desc: 'Pothole cave-in on 4th Main Road assigned to your queue.',
      time: '15m ago',
      unread: true,
      priority: 'high',
    },
    {
      id: 2,
      title: 'Task Verified by Citizen',
      desc: 'Work done at Sector 4 Water Valve has been verified.',
      time: '2h ago',
      unread: true,
      priority: 'normal',
    },
    {
      id: 3,
      title: 'Shift Attendance Logged',
      desc: 'Ward 2 morning shift check-in recorded successfully.',
      time: '5h ago',
      unread: false,
      priority: 'normal',
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTabClick = (tabKey) => {
    if (onBottomTabChange) {
      onBottomTabChange(tabKey);
    } else {
      if (tabKey === 'profile') {
        navigate('/worker/profile');
      } else if (tabKey === 'completed') {
        navigate('/worker/completed');
      } else {
        navigate('/worker');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased selection:bg-blue-100 selection:text-primary">
      {/* ========================================================
          1. TOP HEADER
          - JANMITRA logo
          - 'Field Worker' badge
          - Notification bell
          - Logout
         ======================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Left: Brand & 'Field Worker' Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/worker')}
              className="flex items-center gap-2 text-left group focus:outline-none"
              title="JANMITRA Home"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-xl text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
                🏛️
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg flex items-center gap-1">
                  JANMITRA
                </span>
                <span className="text-[10px] font-semibold text-slate-400 hidden xs:inline tracking-wide uppercase">
                  Civic Response
                </span>
              </div>
            </button>

            <span className="hidden sm:inline-block w-px h-5 bg-slate-200 mx-0.5" />

            {/* 'Field Worker' Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs flex-shrink-0">
              <span className="text-sm leading-none" role="img" aria-label="Field Worker">
                👷‍♂️
              </span>
              <span className="tracking-tight whitespace-nowrap">Field Worker</span>
            </div>
          </div>

          {/* Right: Notification Bell & Logout */}
          <div className="flex items-center gap-2 relative">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((prev) => !prev)}
                className={`relative p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                  showNotifications
                    ? 'bg-blue-50 border-blue-200 text-primary ring-2 ring-blue-100'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                }`}
                aria-label="View notifications"
                title="Notifications"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 rounded-full bg-danger text-white text-[10px] font-bold shadow-xs animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Drawer */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-92 bg-white rounded-2xl shadow-xl border border-slate-200 z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800">
                          Worker Alerts
                        </span>
                        {unreadCount > 0 && (
                          <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length > 0 ? (
                        notifications.map((item) => (
                          <div
                            key={item.id}
                            className={`p-3.5 hover:bg-slate-50/80 transition flex items-start gap-3 ${
                              item.unread ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            <span className="text-base mt-0.5">
                              {item.priority === 'high' ? '🚨' : '🔔'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                {item.desc}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                {item.time}
                              </span>
                            </div>
                            {item.unread && (
                              <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No notifications at this time
                        </div>
                      )}
                    </div>

                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 py-1"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-red-50 text-danger border border-red-200/80 hover:bg-red-100 active:bg-red-200 transition shadow-2xs"
              title="Sign Out of Portal"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden xs:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          2. MAIN CONTENT AREA
         ======================================================== */}
      <main className="flex-1 max-w-3xl w-full mx-auto pb-24">
        {children || <Outlet />}
      </main>

      {/* ========================================================
          3. BOTTOM TAB BAR (MOBILE-FIRST)
          - Tasks (active) | Completed | Profile
         ======================================================== */}
      <nav
        aria-label="Worker Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg shadow-slate-900/10"
      >
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around pb-safe">
          {/* Tab 1: Tasks */}
          <button
            type="button"
            onClick={() => handleTabClick('tasks')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
              activeBottomTab === 'tasks'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            {activeBottomTab === 'tasks' && (
              <span className="absolute -top-2 w-8 h-1 rounded-full bg-primary" />
            )}
            <svg
              className={`w-5 h-5 transition-transform ${
                activeBottomTab === 'tasks' ? 'scale-110' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={activeBottomTab === 'tasks' ? '2.4' : '2'}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span className="text-[11px] tracking-tight mt-0.5">Tasks</span>
          </button>

          {/* Tab 2: Completed */}
          <button
            type="button"
            onClick={() => handleTabClick('completed')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
              activeBottomTab === 'completed'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            {activeBottomTab === 'completed' && (
              <span className="absolute -top-2 w-8 h-1 rounded-full bg-primary" />
            )}
            <svg
              className={`w-5 h-5 transition-transform ${
                activeBottomTab === 'completed' ? 'scale-110' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={activeBottomTab === 'completed' ? '2.4' : '2'}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-[11px] tracking-tight mt-0.5">Completed</span>
          </button>

          {/* Tab 3: Profile */}
          <button
            type="button"
            onClick={() => handleTabClick('profile')}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
              activeBottomTab === 'profile' || showProfileModal
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            {(activeBottomTab === 'profile' || showProfileModal) && (
              <span className="absolute -top-2 w-8 h-1 rounded-full bg-primary" />
            )}
            <svg
              className={`w-5 h-5 transition-transform ${
                activeBottomTab === 'profile' || showProfileModal ? 'scale-110' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={
                  activeBottomTab === 'profile' || showProfileModal ? '2.4' : '2'
                }
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-[11px] tracking-tight mt-0.5">Profile</span>
          </button>
        </div>
      </nav>

      {/* ========================================================
          4. WORKER PROFILE BOTTOM SHEET / MODAL
         ======================================================== */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 text-2xl flex items-center justify-center shadow-inner">
                  👷‍♂️
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {workerName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {workerEmail}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                aria-label="Close Profile"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-semibold">Assigned Ward:</span>
                <WardBadge ward={workerWard} />
              </div>

              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-semibold">Department:</span>
                <span className="font-bold text-slate-800 bg-blue-50 text-primary px-2.5 py-1 rounded-md border border-blue-200">
                  {workerDept}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-semibold">Active Shift:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  On-Duty (Ward {workerWard})
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  handleLogout();
                }}
                className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 active:bg-red-200 text-danger border border-red-200 font-bold text-xs rounded-xl transition"
              >
                Sign Out
              </button>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerLayout;
