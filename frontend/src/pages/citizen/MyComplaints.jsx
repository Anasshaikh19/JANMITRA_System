/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/citizen/MyComplaints.jsx (also accessible via src/citizen/MyComplaints.jsx)
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Description: Citizen My Complaints List view with filter tabs (All, Open,
 *              In-Progress, Resolved), pull-to-refresh, skeleton loaders,
 *              empty states per tab, and pagination (Load More).
 * ==============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { CategoryBadge, PriorityBadge, StatusBadge, WardBadge } from '../../components/Badges';

/**
 * Format date to human-readable format or relative time
 */
const formatDate = (dateStr) => {
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
  if (diffDays < 7) return `${diffDays} days ago`;

  return past.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Filter tabs definition
const TABS = [
  { id: 'all', label: 'All', queryVal: '' },
  { id: 'open', label: 'Open', queryVal: 'open' },
  { id: 'in-progress', label: 'In-Progress', queryVal: 'in-progress' },
  { id: 'resolved', label: 'Resolved', queryVal: 'resolved' }
];

export const MyComplaints = () => {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  // URL search params sync
  let [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('status') || 'all';

  // Active filter tab ('all' | 'open' | 'in-progress' | 'resolved')
  const [activeTab, setActiveTab] = useState(initialTab);

  // Complaints state & pagination
  const [complaints, setComplaints] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  /**
   * Fetch complaints from API:
   * GET /api/v1/complaints/?my=true&status=X&page=Y
   */
  const fetchComplaints = useCallback(async (tabKey, pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
      setFetchError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const tabObj = TABS.find((t) => t.id === tabKey) || TABS[0];
      const params = {
        my: 'true',
        page: pageNum,
        ordering: '-submitted_at'
      };

      if (tabObj.queryVal) {
        params.status = tabObj.queryVal;
      }

      const response = await api.get('/api/v1/complaints/', { params });
      const data = response.data;

      // Normalize pagination response { results: [...], next: "..." } or array [...]
      let list = [];
      let nextUrl = null;

      if (Array.isArray(data)) {
        list = data;
        nextUrl = null;
      } else if (data && Array.isArray(data.results)) {
        list = data.results;
        nextUrl = data.next;
      }

      setComplaints((prev) => (append ? [...prev, ...list] : list));
      setHasMore(Boolean(nextUrl));
      setPage(pageNum);
    } catch (err) {
      console.error('[MyComplaints] Error fetching complaints:', err);
      setFetchError('Failed to load complaints. Please check network connection.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, []);

  // Sync tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
    try {
      setSearchParams(tabId === 'all' ? {} : { status: tabId });
    } catch {}
    fetchComplaints(tabId, 1, false);
  };

  // Refresh trigger (pull-to-refresh button)
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchComplaints(activeTab, 1, false);
  };

  // Initial load
  useEffect(() => {
    fetchComplaints(activeTab, 1, false);
  }, []); // eslint-disable-line

  // Load More pagination
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchComplaints(activeTab, page + 1, true);
    }
  };

  /**
   * Empty state message per tab
   */
  const getEmptyStateContent = () => {
    switch (activeTab) {
      case 'open':
        return {
          icon: '⏳',
          title: 'No open complaints',
          desc: 'All your submitted complaints are either in-progress or resolved!'
        };
      case 'in-progress':
        return {
          icon: '🛠️',
          title: 'No complaints in-progress',
          desc: 'None of your complaints are currently assigned or being worked on.'
        };
      case 'resolved':
        return {
          icon: '✅',
          title: 'No resolved complaints yet',
          desc: 'When an officer fixes your reported issue, it will appear here for verification.'
        };
      case 'all':
      default:
        return {
          icon: '📋',
          title: 'No complaints reported yet',
          desc: 'You have not submitted any civic complaints. Click below to file a new report.'
        };
    }
  };

  const emptyState = getEmptyStateContent();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      
      {/* ================= STICKY HEADER BAR ================= */}
      <header className="sticky top-0 z-30 bg-[#0d2a53] text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/citizen')}
              className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition"
              aria-label="Back to Citizen Home"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-black tracking-tight text-white">
              My Complaints
            </h1>
          </div>

          {/* Pull to Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className={`p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Refresh Complaints"
            aria-label="Refresh Complaints"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* ================= FILTER TAB BAR ================= */}
        <div className="max-w-md mx-auto px-2 border-t border-blue-900/50 bg-[#0a2244]">
          <div className="flex items-center justify-between">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 py-3 text-center text-xs font-bold transition-all relative ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-400 rounded-t-full shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">

        {/* Error notification */}
        {fetchError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center justify-between">
            <span>⚠️ {fetchError}</span>
            <button
              onClick={() => fetchComplaints(activeTab, 1, false)}
              className="text-red-900 font-bold underline ml-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* ================= 1. SKELETON LOADERS ================= */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-3"
              >
                {/* Row 1: Badges */}
                <div className="flex justify-between items-center">
                  <div className="h-5 w-28 bg-slate-200 rounded-full" />
                  <div className="h-4 w-14 bg-slate-200 rounded-md" />
                </div>
                {/* Row 2: Ward + Date */}
                <div className="flex justify-between items-center">
                  <div className="h-4 w-20 bg-slate-100 rounded" />
                  <div className="h-3 w-16 bg-slate-100 rounded" />
                </div>
                {/* Row 3: Status + ID */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <div className="h-5 w-20 bg-slate-200 rounded-full" />
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : complaints.length === 0 ? (
          /* ================= 2. EMPTY STATE PER TAB ================= */
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3 shadow-sm my-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-3xl">
              {emptyState.icon}
            </div>
            <h3 className="font-bold text-slate-800 text-sm">{emptyState.title}</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              {emptyState.desc}
            </p>
            {activeTab === 'all' && (
              <Link
                to="/citizen/submit"
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1A56DB] hover:bg-blue-700 shadow-sm transition"
              >
                <span>+</span> Report New Issue
              </Link>
            )}
          </div>
        ) : (
          /* ================= 3. COMPLAINTS LIST ================= */
          <div className="space-y-3">
            {complaints.map((item) => {
              const compId = item.tracking_id || item.id;
              const categoryName = item.category?.name || item.category;
              const priorityName = item.priority_level || item.priority;
              const wardName = item.ward?.name || item.ward;
              const submittedDate = item.submitted_at || item.created_at;

              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/citizen/complaint/${item.id}`)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer active:scale-[0.99] flex flex-col gap-2.5"
                >
                  {/* TOP ROW: CategoryBadge (left) + Tracking ID (right) - Priority hidden from citizen */}
                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={categoryName} />
                    <span className="text-[11px] font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      #{compId}
                    </span>
                  </div>

                  {/* SECOND ROW: WardBadge */}
                  <div className="flex items-center text-xs">
                    <WardBadge ward={wardName} />
                  </div>

                  {/* Description Preview (if present) */}
                  {item.description && (
                    <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  {/* THIRD ROW: StatusBadge + Complaint Date */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <StatusBadge status={item.status} />
                    <span className="text-slate-400 text-[11px] font-medium">
                      {formatDate(submittedDate)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= 4. PAGINATION: LOAD MORE BUTTON ================= */}
        {hasMore && !isLoading && (
          <div className="pt-2 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoadingMore ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Loading more complaints...</span>
                </>
              ) : (
                <span>Load More</span>
              )}
            </button>
          </div>
        )}

      </main>
    </div>
  );
};

export default MyComplaints;
