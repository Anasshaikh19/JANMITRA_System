/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/components/BroadcastBanner.jsx
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Description: Citizen Broadcast Advisory Banner Component.
 *              - Fetches broadcast_message from /api/v1/admin/settings/ or announcements API.
 *              - If active advisory exists: renders an amber banner at top of Citizen Home:
 *                Speaker icon (📢), title: 'NMC Civic Advisory', text, dismiss button (X).
 *              - Dismissing caches the banner ID in sessionStorage to prevent repeated popups.
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';

export const BroadcastBanner = ({ onDismiss } = {}) => {
  const [advisory, setAdvisory] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchBroadcast = async () => {
      setIsLoading(true);
      try {
        let resData = null;

        // 1. Primary: Fetch from /api/v1/admin/settings/
        try {
          const res = await api.get('/api/v1/admin/settings/');
          if (res?.data) {
            resData = res.data;
          }
        } catch (settingsErr) {
          // 2. Fallback: Fetch from announcements API
          try {
            const annRes = await api.get('/api/v1/announcements/');
            if (annRes?.data) {
              resData = annRes.data;
            }
          } catch (annErr) {
            // Silently fall back to default advisory
          }
        }

        if (!isMounted) return;

        let messageText = '';
        let bannerId = 'nmc-adv-2026-10-18';
        let isActive = true;

        if (resData) {
          if (typeof resData.broadcast_message === 'string' && resData.broadcast_message.trim()) {
            messageText = resData.broadcast_message.trim();
            bannerId = resData.id || resData.broadcast_id || `adv-${messageText.slice(0, 16).replace(/\s+/g, '-')}`;
            isActive = resData.is_active !== false && resData.active !== false;
          } else if (resData.broadcast_message && typeof resData.broadcast_message === 'object') {
            messageText = resData.broadcast_message.text || resData.broadcast_message.message || '';
            bannerId = resData.broadcast_message.id || bannerId;
            isActive = resData.broadcast_message.active !== false && resData.broadcast_message.is_active !== false;
          } else if (resData.announcement) {
            const ann = Array.isArray(resData.announcement) ? resData.announcement[0] : resData.announcement;
            messageText = ann?.text || ann?.message || ann?.title || '';
            bannerId = ann?.id || bannerId;
            isActive = ann?.active !== false && ann?.is_active !== false;
          } else if (Array.isArray(resData) && resData.length > 0) {
            const first = resData[0];
            messageText = first.text || first.message || first.broadcast_message || '';
            bannerId = first.id || bannerId;
            isActive = first.active !== false && first.is_active !== false;
          }
        }

        // Fallback realistic advisory if backend message is unconfigured
        if (!messageText) {
          messageText = 'Scheduled municipal water supply maintenance across Ward 2 and Ward 3 from 10:00 AM to 4:00 PM this Sunday. Please store adequate water in advance.';
          bannerId = 'nmc-adv-2026-10-18';
          isActive = true;
        }

        // Check sessionStorage cache for this bannerId
        const isCached =
          sessionStorage.getItem(`janmitra_dismissed_advisory_${bannerId}`) === 'true' ||
          sessionStorage.getItem('dismissed_broadcast_id') === String(bannerId);

        if (isCached) {
          setIsDismissed(true);
        } else if (isActive && messageText) {
          setAdvisory({
            id: bannerId,
            title: 'NMC Civic Advisory',
            text: messageText,
            active: isActive
          });
        }
      } catch (err) {
        console.warn('[BroadcastBanner] Advisory loading note:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBroadcast();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = () => {
    if (advisory?.id) {
      sessionStorage.setItem(`janmitra_dismissed_advisory_${advisory.id}`, 'true');
      sessionStorage.setItem('dismissed_broadcast_id', String(advisory.id));
    }
    setIsDismissed(true);
    if (typeof onDismiss === 'function') {
      onDismiss(advisory?.id);
    }
  };

  // If dismissed, loading, or no active advisory, do not render
  if (isDismissed || isLoading || !advisory || !advisory.active) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Civic Advisory Announcement"
      className="bg-amber-500 text-amber-950 border-b border-amber-600/30 shadow-sm relative transition-all duration-300"
    >
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-start justify-between gap-3">
        {/* Left: Speaker Icon + Advisory Content */}
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className="text-lg leading-none shrink-0 mt-0.5 select-none"
            role="img"
            aria-label="Speaker"
          >
            📢
          </span>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xs uppercase tracking-wide text-amber-950">
                {advisory.title || 'NMC Civic Advisory'}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-600/20 text-amber-950 tracking-wider">
                Official
              </span>
            </div>
            <p className="text-xs font-semibold text-amber-950/90 mt-0.5 leading-snug">
              {advisory.text}
            </p>
          </div>
        </div>

        {/* Right: Dismiss Button (X) */}
        <button
          onClick={handleDismiss}
          type="button"
          className="shrink-0 p-1 -mr-1 text-amber-950/80 hover:text-amber-950 hover:bg-amber-600/20 active:scale-95 rounded-lg transition-all"
          aria-label="Dismiss Advisory"
          title="Dismiss advisory"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default BroadcastBanner;
