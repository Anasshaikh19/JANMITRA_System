import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import WorkerLayout from '../../components/WorkerLayout';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import WorkerRouteMap from '../../components/WorkerRouteMap';
import { getStoredComplaints, updateComplaint } from '../../utils/complaintStore';
import {
  saveCachedTasks,
  getCachedTasks,
  getLastCachedTime,
  queueOfflineStatusUpdate,
  getOfflineQueue,
  syncOfflineQueue,
  isDeviceOnline,
} from '../../utils/offlineStorage';

// Priority border styling for left card accent
const PRIORITY_BORDER_CLASSES = {
  critical: 'border-l-4 border-l-danger',
  high: 'border-l-4 border-l-orange-500',
  medium: 'border-l-4 border-l-amber-500',
  low: 'border-l-4 border-l-slate-400',
};

// Relative time formatting helper
const formatRelativeTime = (dateInput) => {
  if (!dateInput) return 'Recently';
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (isNaN(diffInSeconds) || diffInSeconds < 0) return 'Just now';
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

// Fallback seed tasks for initial / demo baseline
const SEED_WORKER_TASKS = [
  {
    id: 'CMP-20481',
    description:
      'Severe deep trench and cave-in pothole near main traffic signal junction. Risk of direct accident.',
    category: 'Roads & Infrastructure',
    ward: 2,
    priority: 'Critical',
    status: 'In-Progress',
    address: '4th Main Road Crossing, Near Primary School Gate, Ward 2',
    created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    has_photos: true,
    photo_count: 2,
  },
  {
    id: 'CMP-20482',
    description:
      'Overflowing commercial waste bin spilling onto pedestrian footpath for the past 48 hours.',
    category: 'Garbage & Waste Management',
    ward: 2,
    priority: 'High',
    status: 'Assigned',
    address: 'Commercial Market Footpath, Opposite Sector 2 Gate, Ward 2',
    created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    has_photos: true,
    photo_count: 3,
  },
  {
    id: 'CMP-20486',
    description:
      'Fresh report: Broken drainage slab leaving open stormwater ditch on pedestrian walking path.',
    category: 'Water & Drainage',
    ward: 2,
    priority: 'High',
    status: 'Assigned',
    address: 'Behind Community Dispensary, 2nd Cross, Ward 2',
    created_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    has_photos: true,
    photo_count: 1,
  },
  {
    id: 'CMP-20483',
    description:
      'Main water delivery valve leaking clean drinking water on Sector 4 road.',
    category: 'Water & Drainage',
    ward: 2,
    priority: 'Medium',
    status: 'Work Done',
    address: 'Sector 4 Road, Near Water Booster Pump Station, Ward 2',
    created_at: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
    has_photos: true,
    photo_count: 1,
  },
  {
    id: 'CMP-20484',
    description:
      'Street light lamp post #14 flickering continuously at night.',
    category: 'Street Lighting & Electrical',
    ward: 2,
    priority: 'Low',
    status: 'Closed',
    address: 'Lane 7, In front of House #42, Ward 2',
    created_at: new Date(Date.now() - 86400 * 1000 * 4).toISOString(),
    has_photos: false,
    photo_count: 0,
  },
];

const TaskList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab mapping: 'assigned' | 'inprogress' | 'completed'
  const initialTab =
    searchParams.get('tab') === 'completed'
      ? 'completed'
      : searchParams.get('tab') === 'inprogress'
      ? 'inprogress'
      : 'assigned';

  const [activeFilterTab, setActiveFilterTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'route'
  const [searchQuery, setSearchQuery] = useState('');
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 2. Connectivity and Offline State
  const [isOnline, setIsOnline] = useState(isDeviceOnline());
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastCacheDate, setLastCacheDate] = useState(getLastCachedTime());
  const [toastMessage, setToastMessage] = useState(null);

  const workerWard = user?.ward || 2;
  const workerName = user?.name || 'Suresh Patil';

  // Toast notification helper
  const showToast = (type, text) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synchronize filter tab with query parameter if changed externally
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'completed') {
      setActiveFilterTab((prev) => (prev !== 'completed' ? 'completed' : prev));
    } else if (tabParam === 'inprogress') {
      setActiveFilterTab((prev) => (prev !== 'inprogress' ? 'inprogress' : prev));
    } else if (tabParam === 'assigned') {
      setActiveFilterTab((prev) => (prev !== 'assigned' ? 'assigned' : prev));
    }
  }, [searchParams]);

  const handleTabChange = (tabKey) => {
    setActiveFilterTab(tabKey);
    setSearchParams(tabKey === 'assigned' ? {} : { tab: tabKey }, { replace: true });
  };

  // Refresh count of items in the offline queue
  const refreshQueueCount = useCallback(async () => {
    try {
      const queue = await getOfflineQueue();
      setOfflineQueueCount(Array.isArray(queue) ? queue.length : 0);
    } catch {
      setOfflineQueueCount(0);
    }
  }, []);

  // 1. Fetch tasks & Cache assigned tasks in localStorage on successful fetch
  const fetchTasks = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      // Check current connectivity
      const onlineStatus = isDeviceOnline();
      setIsOnline(onlineStatus);

      // If offline: render cached tasks directly
      if (!onlineStatus) {
        const cached = getCachedTasks(workerWard);
        if (Array.isArray(cached) && cached.length > 0) {
          setAllTasks(cached);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      try {
        let fetchedList = null;
        try {
          const response = await api.get('/v1/worker/tasks/');
          const data = response.data;
          const list = Array.isArray(data) ? data : data?.tasks || [];
          if (Array.isArray(list) && list.length > 0) {
            fetchedList = list;
          }
        } catch {
          // Fallback to synchronized complaints store
          const stored = getStoredComplaints();
          fetchedList = stored && stored.length > 0 ? stored : SEED_WORKER_TASKS;
        }

        const normalized = (fetchedList || SEED_WORKER_TASKS).map((item, idx) => ({
          ...item,
          address:
            item.address ||
            item.location_address ||
            (item.description && item.description.includes('near')
              ? item.description.split('. ')[0]
              : `Civic Point #${idx + 1}, Sector ${item.ward || 2}, Ward ${item.ward || 2}`),
        }));

        setAllTasks(normalized);

        // 1. Cache assigned tasks in localStorage on successful fetch
        saveCachedTasks(normalized, workerWard);
        setLastCacheDate(new Date().toISOString());
      } catch (err) {
        // Fallback to cache if available
        const cached = getCachedTasks(workerWard);
        if (Array.isArray(cached) && cached.length > 0) {
          setAllTasks(cached);
        } else {
          setAllTasks(SEED_WORKER_TASKS);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        refreshQueueCount();
      }
    },
    [workerWard, refreshQueueCount]
  );

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 4. Auto-sync queued updates when online event fires
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      showToast('info', 'Connection restored! Auto-syncing queued offline actions...');

      setSyncing(true);
      try {
        const result = await syncOfflineQueue();
        if (result.syncedCount > 0) {
          showToast(
            'success',
            `Auto-sync complete: ${result.syncedCount} task status update(s) uploaded to server!`
          );
          fetchTasks(true);
        } else {
          showToast('success', 'Back online. Task queue is up to date.');
        }
      } catch (syncErr) {
        console.warn('Sync error:', syncErr);
      } finally {
        setSyncing(false);
        refreshQueueCount();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast(
        'warning',
        'Device went offline. Running in Offline Mode using cached tasks.'
      );
      // Load cached tasks
      const cached = getCachedTasks(workerWard);
      if (Array.isArray(cached) && cached.length > 0) {
        setAllTasks(cached);
      }
      refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    refreshQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchTasks, workerWard, refreshQueueCount]);

  // Manual Trigger to sync offline queue
  const handleManualSync = async () => {
    if (!isDeviceOnline()) {
      showToast('warning', 'Device is currently offline. Cannot sync until connection is restored.');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncOfflineQueue();
      if (result.syncedCount > 0) {
        showToast('success', `Successfully synced ${result.syncedCount} queued updates!`);
        fetchTasks(true);
      } else {
        showToast('info', 'No pending offline updates to sync.');
      }
    } catch {
      showToast('error', 'Sync encountered an error.');
    } finally {
      setSyncing(false);
      refreshQueueCount();
    }
  };

  // 3. Queue status updates in IndexedDB/localStorage when offline
  const handleUpdateTaskStatus = async (taskId, newStatus, e) => {
    if (e) e.stopPropagation();

    const currentOnline = isDeviceOnline();

    if (!currentOnline) {
      // 3. Queue update in IndexedDB & localStorage
      await queueOfflineStatusUpdate(taskId, newStatus, {
        worker: workerName,
        updated_at: new Date().toISOString(),
      });

      // Optimistically update in-memory UI
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, offline_queued: true } : t
        )
      );

      refreshQueueCount();
      showToast(
        'warning',
        `Offline: Task ${taskId} marked as '${newStatus}' and queued for sync.`
      );
    } else {
      // Online direct update
      try {
        const formData = new FormData();
        formData.append('status', newStatus);

        try {
          await api.patch(`/v1/worker/tasks/${taskId}/status/`, formData);
        } catch {
          await api.patch(`/v1/complaints/${taskId}/status/`, formData);
        }

        updateComplaint(taskId, { status: newStatus });
        setAllTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );

        // Update local cache
        const updated = allTasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        );
        saveCachedTasks(updated, workerWard);

        showToast('success', `Task ${taskId} status updated to '${newStatus}'.`);
      } catch {
        // Fallback: Queue offline if network failed unexpectedly
        await queueOfflineStatusUpdate(taskId, newStatus);
        setAllTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: newStatus, offline_queued: true } : t
          )
        );
        refreshQueueCount();
        showToast('warning', `Network failed: Update queued in offline storage.`);
      }
    }
  };

  // Priority sorting helper: Critical -> High -> Medium -> Low
  const priorityRank = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  // Filter tasks based on activeFilterTab, ward, and search query
  const filteredTasks = useMemo(() => {
    return allTasks
      .filter((task) => {
        // Match worker ward (if worker has assigned ward)
        const itemWard = task.ward ?? task.ward_no ?? null;
        if (workerWard && itemWard && String(itemWard) !== String(workerWard)) {
          return false;
        }

        const status = String(task.status || '').trim();

        // 1. Assigned (New) tab
        if (activeFilterTab === 'assigned') {
          return ['Assigned', 'Submitted', 'Validated', 'Pending', 'New'].includes(status);
        }

        // 2. In-Progress tab
        if (activeFilterTab === 'inprogress') {
          return ['In-Progress', 'In Progress'].includes(status);
        }

        // 3. Completed tab
        if (activeFilterTab === 'completed') {
          return ['Work Done', 'Closed', 'Resolved', 'Verified'].includes(status);
        }

        return true;
      })
      .filter((task) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (task.id && task.id.toLowerCase().includes(q)) ||
          (task.category && task.category.toLowerCase().includes(q)) ||
          (task.description && task.description.toLowerCase().includes(q)) ||
          (task.address && task.address.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const pa = priorityRank[String(a.priority || '').toLowerCase()] ?? 99;
        const pb = priorityRank[String(b.priority || '').toLowerCase()] ?? 99;
        return pa - pb;
      });
  }, [allTasks, activeFilterTab, workerWard, searchQuery]);

  // Compute live counts for each filter tab
  const tabCounts = useMemo(() => {
    const wardMatched = allTasks.filter((task) => {
      const itemWard = task.ward ?? task.ward_no ?? null;
      return !workerWard || !itemWard || String(itemWard) === String(workerWard);
    });

    const assigned = wardMatched.filter((t) =>
      ['Assigned', 'Submitted', 'Validated', 'Pending', 'New'].includes(
        String(t.status || '').trim()
      )
    ).length;

    const inProgress = wardMatched.filter((t) =>
      ['In-Progress', 'In Progress'].includes(String(t.status || '').trim())
    ).length;

    const completed = wardMatched.filter((t) =>
      ['Work Done', 'Closed', 'Resolved', 'Verified'].includes(String(t.status || '').trim())
    ).length;

    return { assigned, inProgress, completed };
  }, [allTasks, workerWard]);

  const handleOpenTask = (taskId, e) => {
    if (e) e.stopPropagation();
    navigate(`/worker/task/${taskId}`);
  };

  const handleBottomTabChange = (tabKey) => {
    if (tabKey === 'tasks') {
      handleTabChange('assigned');
    } else if (tabKey === 'completed') {
      handleTabChange('completed');
    }
  };

  return (
    <WorkerLayout
      activeBottomTab={activeFilterTab === 'completed' ? 'completed' : 'tasks'}
      onBottomTabChange={handleBottomTabChange}
    >
      <div className="px-4 pt-4 sm:pt-6 space-y-4">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-bounce transition-all ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : toastMessage.type === 'warning'
                ? 'bg-amber-600 text-white shadow-amber-500/20'
                : 'bg-blue-600 text-white shadow-blue-500/20'
            }`}
          >
            <span>{toastMessage.type === 'success' ? '✓' : toastMessage.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* ========================================================
            SUB-HEADER: Greeting, Ward Context, Online/Offline Pill & Refresh
           ======================================================== */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Welcome, {workerName}
              </h1>
              <WardBadge ward={workerWard} />

              {/* 2. Amber 'Offline Mode' Pill if navigator.onLine is false */}
              {!isOnline && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Offline Mode</span>
                  {offlineQueueCount > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                      {offlineQueueCount} queued
                    </span>
                  )}
                </span>
              )}

              {/* Online indicator when connected */}
              {isOnline && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Live Online</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Municipal field queue • Real-time civic complaint dispatch</span>
              {lastCacheDate && (
                <span className="text-[11px] text-slate-400">
                  (Cached at {new Date(lastCacheDate).toLocaleTimeString()})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Sync Now Button if pending offline queue */}
            {offlineQueueCount > 0 && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white transition shadow-2xs disabled:opacity-50"
                title="Sync queued status updates to server"
              >
                <span className={syncing ? 'animate-spin' : ''}>⚡</span>
                <span>{syncing ? 'Syncing...' : `Sync Queue (${offlineQueueCount})`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchTasks(true)}
              disabled={refreshing || loading}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition ${
                refreshing ? 'opacity-70 cursor-wait' : ''
              }`}
              title="Refresh assigned tasks"
            >
              <span className={`text-sm ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* 2. Amber Offline Mode Banner Banner Notification */}
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs animate-fade-in">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div className="space-y-0.5 flex-1">
              <div className="font-extrabold flex items-center gap-2">
                <span>Working in Offline Mode</span>
                <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.2 rounded font-bold">
                  LocalStorage & IndexedDB Active
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Network connection is currently unavailable. Displaying cached tasks. Status updates made offline will be stored locally and automatically synchronized with the server when connection is restored.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================
            FILTER TABS: Assigned (New) | In-Progress | Completed
           ======================================================== */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-2xs">
          <div className="grid grid-cols-3 gap-1" role="tablist">
            {/* Tab 1: Assigned (New) */}
            <button
              type="button"
              role="tab"
              aria-selected={activeFilterTab === 'assigned'}
              onClick={() => handleTabChange('assigned')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeFilterTab === 'assigned'
                  ? 'bg-primary text-white shadow-sm shadow-blue-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="whitespace-nowrap">Assigned (New)</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight ${
                  activeFilterTab === 'assigned'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tabCounts.assigned}
              </span>
            </button>

            {/* Tab 2: In-Progress */}
            <button
              type="button"
              role="tab"
              aria-selected={activeFilterTab === 'inprogress'}
              onClick={() => handleTabChange('inprogress')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeFilterTab === 'inprogress'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="whitespace-nowrap">In-Progress</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight ${
                  activeFilterTab === 'inprogress'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tabCounts.inProgress}
              </span>
            </button>

            {/* Tab 3: Completed */}
            <button
              type="button"
              role="tab"
              aria-selected={activeFilterTab === 'completed'}
              onClick={() => handleTabChange('completed')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                activeFilterTab === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="whitespace-nowrap">Completed</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight ${
                  activeFilterTab === 'completed'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tabCounts.completed}
              </span>
            </button>
          </div>
        </div>

        {/* View Mode Toggle & Quick Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* List vs Route View Toggle */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-start shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋</span>
              <span>Cards ({filteredTasks.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('route')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'route'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🗺️</span>
              <span>Route View</span>
            </button>
          </div>

          {/* Quick Search within current tab */}
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, category, address..."
              className="w-full bg-white pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-2xs"
            />
            <span className="absolute left-3 top-2 text-slate-400 text-xs">
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {error && <ErrorMessage message={error} onRetry={() => fetchTasks(false)} />}

        {/* ========================================================
            TASK CARDS, ROUTE VIEW & EMPTY STATE
           ======================================================== */}
        {loading ? (
          <div className="space-y-4">
            <LoadingSkeleton
              variant="card"
              count={3}
              message="Loading assigned field tasks from local cache..."
            />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-12 text-center shadow-xs mt-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
              {activeFilterTab === 'completed' ? '📂' : '📋'}
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              No tasks currently assigned in your ward.
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              {activeFilterTab === 'assigned'
                ? 'All newly assigned grievances for Ward ' + workerWard + ' have been attended to.'
                : activeFilterTab === 'inprogress'
                ? 'You do not have any tasks currently marked as in-progress.'
                : 'Tasks resolved and marked as closed will be archived here.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                fetchTasks(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              <span>🔄 Check for new assignments</span>
            </button>
          </div>
        ) : viewMode === 'route' ? (
          <WorkerRouteMap
            tasks={filteredTasks}
            onUpdateStatus={handleUpdateTaskStatus}
          />
        ) : (
          /* ========================================================
             TASK CARDS
             Card contains:
             - Complaint ID
             - Category badge
             - Priority pill
             - Ward badge
             - Address
             - Offline queued badge if pending sync
             - Quick Status update buttons (Start Work / Mark Done)
             - 'Open Task' button
             ======================================================== */
          <div className="space-y-3.5 pt-1">
            {filteredTasks.map((task) => {
              const priorityKey = (task.priority || 'low').toLowerCase();
              const borderClass =
                PRIORITY_BORDER_CLASSES[priorityKey] || 'border-l-4 border-l-slate-400';
              const isCritical = priorityKey === 'critical';

              const photoCount =
                task.photo_count ||
                (task.images && task.images.length) ||
                (task.has_photos ? 1 : 0);

              const isAssigned = ['Assigned', 'Submitted', 'Pending', 'New'].includes(
                String(task.status || '').trim()
              );
              const isInProgress = ['In-Progress', 'In Progress'].includes(
                String(task.status || '').trim()
              );

              return (
                <div
                  key={task.id}
                  onClick={() => handleOpenTask(task.id)}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer relative group ${borderClass} ${
                    isCritical ? 'ring-1 ring-red-400/40 bg-red-50/10' : ''
                  }`}
                >
                  {/* TOP ROW: Complaint ID + Badges (Priority pill, Ward badge) */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs sm:text-sm text-slate-900 tracking-tight bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/80">
                        {task.id}
                      </span>
                      <PriorityBadge level={task.priority} />
                      {task.offline_queued && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 animate-pulse">
                          <span>⏳</span>
                          <span>Sync Pending</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <WardBadge ward={task.ward} />
                    </div>
                  </div>

                  {/* SECOND ROW: Category badge */}
                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <CategoryBadge category={task.category} />
                    <StatusBadge status={task.status} />
                  </div>

                  {/* THIRD ROW: Description */}
                  <p className="mt-3 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed line-clamp-2">
                    {task.description || 'No detailed description provided.'}
                  </p>

                  {/* FOURTH ROW: Address (Mandatory requirement) */}
                  <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-sm leading-none flex-shrink-0 text-red-500 mt-0.5">
                      📍
                    </span>
                    <span className="font-semibold text-slate-800 leading-snug break-words">
                      {task.address || `Ward ${task.ward}, Municipal Zone`}
                    </span>
                  </div>

                  {/* BOTTOM ROW: Quick Actions + 'Open Task' button */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <span>🕒</span>
                        <span>{formatRelativeTime(task.created_at || task.submitted_at)}</span>
                      </span>

                      {Boolean(photoCount > 0) && (
                        <span
                          className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md"
                          title="Attached citizen evidence photos"
                        >
                          📷 {photoCount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 3. Quick Status Update Action Buttons */}
                      {isAssigned && (
                        <button
                          type="button"
                          onClick={(e) => handleUpdateTaskStatus(task.id, 'In-Progress', e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition shadow-2xs"
                          title="Mark work started (queues if offline)"
                        >
                          <span>⚡</span>
                          <span>Start Work</span>
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          type="button"
                          onClick={(e) => handleUpdateTaskStatus(task.id, 'Work Done', e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition shadow-2xs"
                          title="Mark work done (queues if offline)"
                        >
                          <span>✓</span>
                          <span>Mark Done</span>
                        </button>
                      )}

                      {/* 'Open Task' Button (Mandatory requirement) */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenTask(task.id, e)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-blue-700 active:bg-blue-800 transition shadow-2xs group-hover:scale-102 flex-shrink-0"
                      >
                        <span>Open Task</span>
                        <span className="text-sm transition-transform group-hover:translate-x-0.5">
                          ➔
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkerLayout>
  );
};

export default TaskList;
