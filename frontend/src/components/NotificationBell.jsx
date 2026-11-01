/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/components/NotificationBell.jsx
 * Developer: Faizan Rayeen (Citizen & Push Notifications Lead)
 * Description: Real-time Civic Notification Bell component featuring:
 *              1. 60-second periodic poll to GET /api/v1/notifications/ to fetch new alerts
 *              2. Badge counter with pulse animation when unread_count > 0
 *              3. Dropdown menu:
 *                 - Header with 'Mark all read' button (PATCH /api/v1/notifications/mark-read/)
 *                 - Notification item list with relative time ago (e.g. '5m ago')
 *                 - Click item marks read and deep-links to complaint
 *                 - Click-outside & ESC key dismisses dropdown
 * ==============================================================================
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useFirebase } from '../context/FirebaseProvider';
import './notifications.css';

/**
 * Format relative time (e.g. 'Just now', '5m ago', '2h ago', '3d ago')
 */
export const formatTimeAgo = (isoString) => {
  if (!isoString) return 'Just now';
  const now = new Date();
  const date = new Date(isoString);
  const diffSec = Math.floor((now - date) / 1000);

  if (isNaN(diffSec) || diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

/**
 * Helper to select an appropriate civic icon based on notification content
 */
const getNotificationIcon = (title = '', body = '') => {
  const text = `${title} ${body}`.toLowerCase();
  if (text.includes('pothole') || text.includes('road') || text.includes('pwd')) return '🚧';
  if (text.includes('garbage') || text.includes('waste') || text.includes('swm')) return '🗑️';
  if (text.includes('water') || text.includes('drainage') || text.includes('pipeline')) return '🚰';
  if (text.includes('light') || text.includes('electric') || text.includes('lamp')) return '💡';
  if (text.includes('worker') || text.includes('assigned') || text.includes('dispatched')) return '👷';
  if (text.includes('resolved') || text.includes('done') || text.includes('verified')) return '✅';
  return '🏛️';
};

export const NotificationBell = ({ onComplaintClick }) => {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => {
      window.location.href = path;
    };
  }

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const dropdownRef = useRef(null);

  // Consume Firebase Context for real-time foreground updates if available
  let firebaseContext = null;
  try {
    firebaseContext = useFirebase();
  } catch (e) {
    // Context unavailable in standalone renders
  }

  /**
   * 1. 60-Second Periodic Polling to GET /api/v1/notifications/
   * Fetches latest system alerts and calculates unread count
   */
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/api/v1/notifications/?all=true');
      const data = response.data;
      const list = Array.isArray(data) ? data : (data.results || []);
      const count =
        typeof data.unread_count === 'number'
          ? data.unread_count
          : list.filter((n) => !n.is_read && !n.read).length;

      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      console.warn('[NotificationBell] Backend poll fallback:', err.message);
      // Fallback to Firebase in-memory alerts if backend offline
      if (firebaseContext?.notifications?.length > 0) {
        setNotifications(firebaseContext.notifications);
        setUnreadCount(firebaseContext.unreadCount);
      }
    }
  }, [firebaseContext]);

  // Initial fetch on mount & recurring 60-second periodic poll
  useEffect(() => {
    fetchNotifications();

    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 60000); // 60-second interval

    return () => clearInterval(pollInterval);
  }, [fetchNotifications]);

  // Sync state whenever Firebase foreground push arrives
  useEffect(() => {
    if (firebaseContext?.notifications && firebaseContext.notifications.length > 0) {
      setNotifications(firebaseContext.notifications);
      setUnreadCount(firebaseContext.unreadCount);
    }
  }, [firebaseContext?.notifications, firebaseContext?.unreadCount]);

  /**
   * Click-Outside and ESC-Key Dismissal Handler
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  /**
   * 3. Click Notification Item:
   * - Marks item as read (PATCH /api/v1/notifications/mark-read/?id=X)
   * - Deep-links to complaint detail view
   */
  const handleItemClick = async (item) => {
    const compId = item.complaint || item.complaintId || item.complaint_id;

    // Optimistically mark as read in local UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Close dropdown
    setIsOpen(false);

    // Call API in background
    try {
      await api.patch('/api/v1/notifications/mark-read/', { id: item.id }).catch(async () => {
        await api.patch(`/api/v1/notifications/mark-read/?id=${item.id}`);
      });
    } catch (err) {
      console.warn('[NotificationBell] Mark single read API notice:', err.message);
    }

    // Deep-link to complaint
    if (compId) {
      if (onComplaintClick) {
        onComplaintClick(compId);
      } else {
        navigate(`/citizen/complaint/${compId}`);
      }
    }
  };

  /**
   * 3. Header 'Mark All Read' Action:
   * - Calls PATCH /api/v1/notifications/mark-read/
   * - Clears unread counter
   */
  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    if (unreadCount === 0 || isMarkingAll) return;

    setIsMarkingAll(true);

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read: true }))
    );
    setUnreadCount(0);

    try {
      await api.patch('/api/v1/notifications/mark-read/');
    } catch (err) {
      console.warn('[NotificationBell] Mark all read notice:', err.message);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const recentList = notifications.slice(0, 15);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left font-sans">
      
      {/* ================= BELL TRIGGER BUTTON ================= */}
      <button
        type="button"
        id="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Civic notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`relative flex items-center justify-center w-10 h-10 rounded-2xl border transition-all duration-200 cursor-pointer focus:outline-none ${
          isOpen
            ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/30 ring-2 ring-blue-300'
            : 'bg-white/10 hover:bg-white/20 border-white/15 text-slate-100 hover:text-white'
        }`}
        title={unreadCount > 0 ? `${unreadCount} unread civic notifications` : 'Notifications'}
      >
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'scale-110' : 'group-hover:scale-105'}`}
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

        {/* ================= 2. BADGE COUNTER WITH PULSE ANIMATION ================= */}
        {unreadCount > 0 && (
          <span
            id="notification-badge-counter"
            className="pulse-badge absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0d2a53] shadow-md shadow-rose-900/40 select-none pointer-events-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ================= 3. DROPDOWN MENU CONTAINER ================= */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="notification-bell-btn"
          className="notification-dropdown absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden text-slate-800"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <h3 className="font-black text-sm text-slate-900 tracking-tight">
                Civic Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-[#1A56DB] border border-blue-200/70">
                  {unreadCount} new
                </span>
              )}
            </div>

            {/* Mark All Read Button */}
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAll}
                className="text-xs font-bold text-[#1A56DB] hover:text-blue-800 hover:underline transition-colors cursor-pointer flex items-center gap-1"
                title="Mark all alerts as read"
              >
                {isMarkingAll ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Marking...</span>
                  </>
                ) : (
                  <span>Mark all read</span>
                )}
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400">
                All caught up
              </span>
            )}
          </div>

          {/* Notification Items List */}
          <div className="max-h-88 overflow-y-auto divide-y divide-slate-100">
            {recentList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <div className="text-3xl select-none">🔕</div>
                <p className="text-xs font-bold text-slate-700">No Notifications</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Status changes, AI validation updates, and worker progress alerts will appear here.
                </p>
              </div>
            ) : (
              recentList.map((item) => {
                const isRead = Boolean(item.is_read || item.read);
                const compId = item.complaint || item.complaintId || item.complaint_id;
                const icon = getNotificationIcon(item.title, item.body);

                return (
                  <div
                    key={item.id}
                    role="menuitem"
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 sm:p-4 transition-all duration-150 cursor-pointer flex items-start gap-3 relative group ${
                      isRead
                        ? 'bg-white hover:bg-slate-50/80 text-slate-700'
                        : 'bg-blue-50/70 hover:bg-blue-100/60 text-slate-900 border-l-4 border-l-[#1A56DB]'
                    }`}
                  >
                    {/* Category Icon Badge */}
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-base shrink-0 mt-0.5">
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-xs leading-snug line-clamp-1 ${
                            isRead ? 'font-semibold text-slate-800' : 'font-black text-slate-900'
                          }`}
                        >
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-medium text-slate-400 shrink-0 whitespace-nowrap">
                          {formatTimeAgo(item.created_at || item.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>

                      {/* Complaint Deep-Link Pill */}
                      {compId && (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#1A56DB] group-hover:text-blue-800 bg-white px-2 py-0.5 rounded-md border border-blue-200/80 shadow-2xs">
                            <span>Ticket #{compId}</span>
                            <span className="text-[9px]">&rarr;</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Unread Indicator Dot */}
                    {!isRead && (
                      <span
                        className="w-2 h-2 rounded-full bg-[#1A56DB] shrink-0 mt-2 shadow-xs"
                        title="Unread"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 px-4">
            <span className="flex items-center gap-1 font-semibold text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Civic Alerts</span>
            </span>
            <span className="text-[10px]">60s Auto-Poll</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default NotificationBell;
