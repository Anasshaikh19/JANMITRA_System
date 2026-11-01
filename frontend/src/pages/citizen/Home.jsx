/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/citizen/Home.jsx (also accessible via src/citizen/Home.jsx)
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Description: Citizen Home Page (Mobile-First Layout).
 *              Includes greeting bar with ward badge, notification bell,
 *              'Report New Issue' button, quick stats row, recent activity list
 *              with category/priority/status badges, and loading skeletons.
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { NotificationBell } from '../../components/NotificationBell';
import { CategoryBadge, PriorityBadge, StatusBadge, WardBadge } from '../../components/Badges';
import { BroadcastBanner } from '../../components/BroadcastBanner';

export { BroadcastBanner };

/**
 * Helper to format date strings into friendly relative time
 * (e.g. "3 days ago", "Yesterday", "2h ago")
 */
const formatTimeAgo = (dateStr) => {
  if (!dateStr) return 'Recently';
  const past = new Date(dateStr);
  if (isNaN(past.getTime())) return 'Recently';

  const diffSec = Math.floor((new Date() - past) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return past.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

export const CitizenHome = () => {
  // Navigation hook with fallback
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  // Current authenticated citizen
  const { user } = useAuth();
  const citizenName = user?.name || user?.full_name || 'Citizen';
  const citizenWard = user?.ward || 'Ward 2';

  // State Management
  const [summary, setSummary] = useState({
    open_count: 0,
    resolved_count: 0
  });
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  /**
   * Fetch Quick Stats & Recent 3 Complaints
   */
  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setFetchError(null);

      try {
        // Parallel requests using Axios client
        const [summaryRes, complaintsRes] = await Promise.allSettled([
          api.get('/api/v1/complaints/summary/'),
          api.get('/api/v1/complaints/?limit=3&ordering=-submitted_at&my=true')
        ]);

        if (!isMounted) return;

        // 1. Process Summary Data
        if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
          const sData = summaryRes.value.data;
          setSummary({
            open_count: sData.open_count ?? sData.open ?? 0,
            resolved_count: sData.resolved_count ?? sData.resolved ?? 0
          });
        } else {
          // Fallback check on query params endpoint
          try {
            const fallbackRes = await api.get('/api/v1/complaints/?my=true&summary=true');
            if (fallbackRes.data) {
              setSummary({
                open_count: fallbackRes.data.open_count ?? 0,
                resolved_count: fallbackRes.data.resolved_count ?? 0
              });
            }
          } catch (e) {
            console.warn('[Home] Summary stats fallback not available.');
          }
        }

        // 2. Process Complaints List
        if (complaintsRes.status === 'fulfilled' && complaintsRes.value?.data) {
          const cData = complaintsRes.value.data;
          // Handle both pagination format { results: [...] } and flat array [...]
          const list = Array.isArray(cData) ? cData : (cData.results || []);
          setRecentComplaints(list.slice(0, 3));
        }
      } catch (err) {
        console.error('[Home] Error fetching citizen home data:', err);
        if (isMounted) setFetchError('Could not sync live updates.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      
      {/* ================= 0. NMC CIVIC ADVISORY BROADCAST BANNER ================= */}
      <BroadcastBanner />

      {/* ================= 1. TOP HEADER & GREETING BAR ================= */}
      <header className="bg-gradient-to-r from-[#0d2a53] to-[#153e75] text-white pt-6 pb-8 px-4 sm:px-6 shadow-md rounded-b-3xl">
        <div className="max-w-md mx-auto">
          {/* Top Navbar Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="Logo">🏛️</span>
              <span className="font-extrabold tracking-wider text-lg uppercase text-white">
                JANMITRA
              </span>
            </div>

            {/* Notification Bell Component */}
            <div className="bg-white/10 p-1 rounded-full backdrop-blur-sm border border-white/20">
              <NotificationBell
                onComplaintClick={(id) => navigate(`/citizen/complaint/${id}`)}
              />
            </div>
          </div>

          {/* Greeting & Ward Badge */}
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">
                Municipal Corporation
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5 tracking-tight">
                Welcome back, {citizenName}!
              </h1>
            </div>

            {/* User Ward Pill */}
            <div className="bg-white/15 border border-white/25 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {citizenWard}
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-md mx-auto px-4 -mt-5 space-y-6">

        {/* ================= 2. REPORT NEW ISSUE BUTTON ================= */}
        <section>
          <button
            onClick={() => navigate('/citizen/submit')}
            className="w-full bg-[#1A56DB] hover:bg-[#1546b5] active:scale-[0.98] text-white font-bold text-base py-4 px-6 rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 flex items-center justify-between group"
            aria-label="Report New Issue"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-2xl leading-none group-hover:rotate-90 transition-transform duration-200">
                +
              </div>
              <div className="text-left">
                <div className="font-extrabold text-base leading-tight">Report New Issue</div>
                <div className="text-blue-100 text-xs font-normal">Pothole, Garbage, Water & Lights</div>
              </div>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform duration-150">
              &rarr;
            </span>
          </button>
        </section>

        {/* ================= 3. QUICK STATS ROW (2 Cards) ================= */}
        <section className="grid grid-cols-2 gap-3.5">
          {/* Card 1: Open Issues */}
          <Link
            to="/citizen/complaints?status=open"
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow active:bg-slate-50 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                My Open
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black text-amber-600">
                {isLoading ? '–' : summary.open_count}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Pending resolution</p>
            </div>
          </Link>

          {/* Card 2: Resolved Issues */}
          <Link
            to="/citizen/complaints?status=resolved"
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow active:bg-slate-50 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Resolved
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black text-emerald-600">
                {isLoading ? '–' : summary.resolved_count}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Verified & closed</p>
            </div>
          </Link>
        </section>

        {/* ================= 5. RECENT ACTIVITY HEADING ================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Recent Activity</span>
              <span className="text-xs font-normal text-slate-400">
                (Last 3 reports)
              </span>
            </h2>

            <Link
              to="/citizen/complaints"
              className="text-xs font-bold text-[#1A56DB] hover:underline"
            >
              See all &rarr;
            </Link>
          </div>

          {/* Error Banner if any */}
          {fetchError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
              ⚠️ {fetchError} Pull down to refresh.
            </div>
          )}

          {/* ================= 6. COMPLAINTS LIST / LOADING / EMPTY ================= */}
          {isLoading ? (
            /* Loading Skeletons */
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-5 w-24 bg-slate-200 rounded-full" />
                    <div className="h-4 w-14 bg-slate-200 rounded-md" />
                  </div>
                  <div className="h-4 w-16 bg-slate-100 rounded" />
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    <div className="h-3 w-16 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentComplaints.length === 0 ? (
            /* 8. EMPTY STATE */
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-3xl">
                📸
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                No civic issues reported yet
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Be the first to report an issue in your ward! Help keep Nagpur clean, safe, and well-maintained.
              </p>
              <button
                onClick={() => navigate('/citizen/submit')}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1A56DB] hover:bg-blue-700 shadow-sm transition"
              >
                <span>+</span> Report Issue Now
              </button>
            </div>
          ) : (
            /* Recent 3 Complaints Cards */
            <div className="space-y-3">
              {recentComplaints.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/citizen/complaint/${item.id}`)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer active:scale-[0.99] flex flex-col gap-2.5"
                >
                  {/* Top Badges Row: CategoryBadge (left), Tracking ID (right) - Priority is hidden from citizens */}
                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={item.category?.name || item.category} />
                    <span className="text-[11px] font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      #{item.tracking_id || item.id}
                    </span>
                  </div>

                  {/* WardBadge below category */}
                  <div className="flex items-center gap-2">
                    <WardBadge ward={item.ward?.name || item.ward || citizenWard} />
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                    {item.description || 'No description provided.'}
                  </p>

                  {/* Bottom Row: StatusBadge & Date submitted */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <StatusBadge status={item.status} />
                    <span className="text-[11px] text-slate-400">
                      {formatTimeAgo(item.submitted_at || item.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ================= 7. VIEW ALL COMPLAINTS BUTTON ================= */}
        {recentComplaints.length > 0 && (
          <section className="pt-1">
            <button
              onClick={() => navigate('/citizen/complaints')}
              className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-[#1A56DB] text-slate-700 hover:text-[#1A56DB] font-bold text-xs bg-white hover:bg-blue-50/50 transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>View All Complaints</span>
              <span>&rarr;</span>
            </button>
          </section>
        )}

      </main>
    </div>
  );
};

export default CitizenHome;
