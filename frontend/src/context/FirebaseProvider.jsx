/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/context/FirebaseProvider.jsx
 * Developer: Faizan Rayeen (Citizen Portal & Notifications Lead)
 * Description: Context Provider wrapping the React app to initialize FCM,
 *              request notification permissions, listen to foreground push messages,
 *              and render live Toast notifications with clean React Router useNavigate deep-linking.
 * ==============================================================================
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestFCMPermission, onForegroundMessage } from '../firebase';
import '../components/notifications.css';

// 1. Create Context
export const FirebaseContext = createContext(null);

// Custom hook to consume Firebase context
export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a <FirebaseProvider>');
  }
  return context;
};

/**
 * Modern In-App Toast Component for Foreground Push Notifications
 * Supports clickable deep-linking directly to target complaint URL.
 */
const ForegroundToast = ({ toast, onClose, onNavigate }) => {
  if (!toast) return null;

  const targetPath = toast.targetUrl || (toast.complaintId ? `/citizen/complaint/${toast.complaintId}` : '/citizen');

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        maxWidth: '380px',
        width: 'calc(100% - 48px)',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #0d2a53 0%, #1a365d 100%)',
        color: '#ffffff',
        borderRadius: '14px',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '16px 18px',
        fontFamily: "'Segoe UI', Roboto, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(10px)',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
      onClick={() => {
        if (onNavigate) {
          onNavigate(targetPath);
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🔔</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              backgroundColor: '#1a56db',
              padding: '2px 8px',
              borderRadius: '20px',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(26, 86, 219, 0.4)'
            }}
          >
            JANMITRA Alert
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cbd5e1',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1
          }}
          title="Dismiss notification"
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#f8fafc', letterSpacing: '-0.2px' }}>
        {toast.title}
      </div>

      {/* Body */}
      <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.45' }}>
        {toast.body}
      </div>

      {/* Footer Info & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
        {toast.complaintId ? (
          <span style={{ fontSize: '11.5px', color: '#93c5fd', fontWeight: 600, fontFamily: 'monospace' }}>
            #{toast.complaintId}
          </span>
        ) : (
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Municipal Redressal</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onNavigate) onNavigate(targetPath);
          }}
          style={{
            backgroundColor: '#1a56db',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 6px rgba(26, 86, 219, 0.35)',
            transition: 'background-color 0.2s ease, transform 0.1s ease'
          }}
        >
          <span>View</span>
          <span>&rarr;</span>
        </button>
      </div>
    </div>
  );
};

/**
 * FirebaseProvider Component
 * 
 * Props:
 * - children: React child components
 * - isAuthenticated: (optional) boolean indicating user login status
 * - onNotificationClick: (optional) callback when a user clicks a toast (for routing)
 */
export const FirebaseProvider = ({ children, isAuthenticated = null, onNotificationClick }) => {
  // Use React Router's useNavigate for clean client-side SPA routing
  let navigate;
  try {
    navigate = useNavigate();
  } catch (routerErr) {
    // Fallback for tests or environments outside Router
    navigate = (path) => {
      if (typeof window !== 'undefined') window.location.href = path;
    };
  }

  const [fcmToken, setFcmToken] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [notifications, setNotifications] = useState([]);
  const [activeToast, setActiveToast] = useState(null);

  /**
   * Check login state if not explicitly passed as prop
   */
  const checkIsLoggedIn = useCallback(() => {
    if (typeof isAuthenticated === 'boolean') {
      return isAuthenticated;
    }
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('access_token') || localStorage.getItem('token'));
    }
    return false;
  }, [isAuthenticated]);

  /**
   * Trigger FCM permission and token acquisition
   */
  const initializeFCM = useCallback(async () => {
    try {
      console.log('[FirebaseProvider] Requesting FCM permission for authenticated user...');
      const token = await requestFCMPermission();
      if (token) {
        setFcmToken(token);
        setPermissionStatus('granted');
      } else {
        setPermissionStatus(
          typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
        );
      }
    } catch (err) {
      console.error('[FirebaseProvider] Error initializing FCM:', err);
    }
  }, []);

  /**
   * 1. Request FCM Token on Login / Mount
   */
  useEffect(() => {
    const loggedIn = checkIsLoggedIn();
    if (loggedIn) {
      initializeFCM();
    }
  }, [checkIsLoggedIn, initializeFCM]);

  /**
   * 2. Listen to Foreground FCM Messages
   * Extracts deep-link URL from payload.fcmOptions.link or click_action.
   */
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('[FirebaseProvider] Received foreground FCM message:', payload);
      const title = payload.notification?.title || payload.data?.title || 'JANMITRA Notification';
      const body = payload.notification?.body || payload.data?.body || 'New civic update received.';
      const complaintId = payload.data?.complaint_id || payload.data?.complaintId || null;

      // Extract deep-link URL:
      // Priority 1: payload.fcmOptions.link
      // Priority 2: payload.data.click_action / link
      // Priority 3: payload.notification.click_action
      // Priority 4: Fallback to /citizen/complaint/:id
      const targetUrl = payload.fcmOptions?.link
        || payload.data?.click_action
        || payload.data?.link
        || payload.notification?.click_action
        || (complaintId ? `/citizen/complaint/${complaintId}` : '/citizen');

      const newNotification = {
        id: payload.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title,
        body,
        complaintId,
        targetUrl,
        timestamp: new Date().toISOString(),
        read: false,
        rawPayload: payload
      };

      // Prepend to in-app notifications list
      setNotifications((prev) => [newNotification, ...prev]);

      // Trigger visual toast
      setActiveToast(newNotification);

      // Auto-dismiss toast after 6 seconds
      const timer = setTimeout(() => {
        setActiveToast((current) => (current?.id === newNotification.id ? null : current));
      }, 6000);

      return () => clearTimeout(timer);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Clean deep-link navigation handler using React Router useNavigate
   */
  const handleNavigate = useCallback((targetPathOrId) => {
    setActiveToast(null);

    // Determine target deep-link route
    let destination = '/citizen';
    if (typeof targetPathOrId === 'string' && targetPathOrId.startsWith('/')) {
      destination = targetPathOrId;
    } else if (targetPathOrId) {
      destination = `/citizen/complaint/${targetPathOrId}`;
    } else if (activeToast?.targetUrl) {
      destination = activeToast.targetUrl;
    } else if (activeToast?.complaintId) {
      destination = `/citizen/complaint/${activeToast.complaintId}`;
    }

    if (onNotificationClick) {
      onNotificationClick(destination);
    } else if (navigate) {
      console.log('[FirebaseProvider] Navigating cleanly via React Router useNavigate:', destination);
      navigate(destination);
    } else if (typeof window !== 'undefined') {
      window.location.href = destination;
    }
  }, [navigate, onNotificationClick, activeToast]);

  /**
   * Notification management methods for NotificationBell
   */
  const markAsRead = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const contextValue = {
    fcmToken,
    permissionStatus,
    notifications,
    unreadCount,
    requestFCMPermission: initializeFCM,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    handleNavigate
  };

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}

      {/* Render In-App Toast with clean useNavigate click handler */}
      <ForegroundToast
        toast={activeToast}
        onClose={() => setActiveToast(null)}
        onNavigate={handleNavigate}
      />
    </FirebaseContext.Provider>
  );
};

export default FirebaseProvider;
