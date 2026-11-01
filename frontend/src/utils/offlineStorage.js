/**
 * offlineStorage.js
 * Comprehensive offline caching & background synchronization utility for JANMITRA Worker Portal.
 * 
 * Features:
 * 1. Caches assigned tasks in localStorage with timestamp and worker scope.
 * 2. Manages offline status updates queue using IndexedDB with localStorage fallback.
 * 3. Automatic synchronization when browser online event fires.
 * 4. Optimistic offline UI updates.
 */

import api from '../api/client';
import { updateComplaint, getStoredComplaints } from './complaintStore';

const CACHE_KEY = 'janmitra_worker_tasks_cache';
const QUEUE_KEY = 'janmitra_worker_offline_queue';
const IDB_NAME = 'janmitra_offline_db';
const IDB_VERSION = 1;
const IDB_STORE = 'offline_status_updates';

// -------------------------------------------------------------
// IndexedDB Helper with fallback
// -------------------------------------------------------------
const openIndexedDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB unavailable'));
    }
    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// -------------------------------------------------------------
// 1. Task Caching (localStorage)
// -------------------------------------------------------------

/**
 * Cache assigned tasks in localStorage
 */
export const saveCachedTasks = (tasks, workerId = null) => {
  if (!Array.isArray(tasks)) return;

  try {
    const payload = {
      tasks,
      workerId: workerId || 'default',
      cachedAt: new Date().toISOString(),
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    if (workerId) {
      localStorage.setItem(`${CACHE_KEY}_${workerId}`, JSON.stringify(payload));
    }
  } catch (err) {
    console.warn('Failed to cache tasks in localStorage:', err);
  }
};

/**
 * Retrieve cached tasks from localStorage
 */
export const getCachedTasks = (workerId = null) => {
  try {
    let raw = null;
    if (workerId) {
      raw = localStorage.getItem(`${CACHE_KEY}_${workerId}`);
    }
    if (!raw) {
      raw = localStorage.getItem(CACHE_KEY);
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const tasks = Array.isArray(parsed) ? parsed : parsed?.tasks || [];
    return tasks;
  } catch (err) {
    console.warn('Failed to retrieve cached tasks:', err);
    return null;
  }
};

/**
 * Get timestamp of when tasks were last cached
 */
export const getLastCachedTime = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.cachedAt || null;
  } catch {
    return null;
  }
};

// -------------------------------------------------------------
// 3. Queue status updates in IndexedDB & localStorage when offline
// -------------------------------------------------------------

/**
 * Retrieve queued updates from localStorage
 */
export const getOfflineQueueFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

/**
 * Save queued updates to localStorage
 */
const saveOfflineQueueToLocalStorage = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn('Failed to save offline queue to localStorage:', err);
  }
};

/**
 * Queue a task status update when offline
 */
export const queueOfflineStatusUpdate = async (taskId, newStatus, extraData = {}) => {
  const queueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    taskId,
    newStatus,
    extraData,
    timestamp: Date.now(),
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  // 1. Save to localStorage queue (synchronous fallback)
  const currentQueue = getOfflineQueueFromLocalStorage();
  // If an update for the same taskId already exists, replace with newest
  const filtered = currentQueue.filter((item) => item.taskId !== taskId);
  const updatedQueue = [...filtered, queueItem];
  saveOfflineQueueToLocalStorage(updatedQueue);

  // 2. Save to IndexedDB
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(queueItem);
  } catch (idbErr) {
    console.warn('IndexedDB write skipped, saved in localStorage queue:', idbErr?.message);
  }

  // 3. Optimistically update cached tasks in localStorage
  try {
    const cachedTasks = getCachedTasks();
    if (Array.isArray(cachedTasks)) {
      const updatedCached = cachedTasks.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus, offline_queued: true, offline_queued_at: queueItem.queuedAt }
          : t
      );
      saveCachedTasks(updatedCached);
    }
  } catch (e) {
    console.warn('Optimistic cache update error:', e);
  }

  // 4. Update complaintStore for reactive cross-page synchronization
  try {
    updateComplaint(taskId, {
      status: newStatus,
      offline_queued: true,
      ...extraData,
    });
  } catch (e) {
    console.warn('complaintStore offline sync:', e);
  }

  return queueItem;
};

/**
 * Get all queued offline updates
 */
export const getOfflineQueue = async () => {
  // First attempt from IndexedDB
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = req.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result);
        } else {
          resolve(getOfflineQueueFromLocalStorage());
        }
      };
      req.onerror = () => resolve(getOfflineQueueFromLocalStorage());
    });
  } catch {
    return getOfflineQueueFromLocalStorage();
  }
};

/**
 * Remove an item from the offline queue after successful server sync
 */
export const removeQueueItem = async (queueItemId, taskId) => {
  // 1. Remove from localStorage
  const currentQueue = getOfflineQueueFromLocalStorage();
  const updated = currentQueue.filter(
    (item) => item.id !== queueItemId && item.taskId !== taskId
  );
  saveOfflineQueueToLocalStorage(updated);

  // 2. Remove from IndexedDB
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(queueItemId);
  } catch (e) {
    // ignore
  }

  // 3. Clear offline_queued flag in cached tasks
  try {
    const cached = getCachedTasks();
    if (Array.isArray(cached)) {
      const updatedCached = cached.map((t) =>
        t.id === taskId ? { ...t, offline_queued: false } : t
      );
      saveCachedTasks(updatedCached);
    }
  } catch (e) {
    // ignore
  }
};

/**
 * Clear all items in the offline queue
 */
export const clearOfflineQueue = async () => {
  localStorage.removeItem(QUEUE_KEY);
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.clear();
  } catch (e) {
    // ignore
  }
};

// -------------------------------------------------------------
// 4. Auto-sync queued updates when online event fires
// -------------------------------------------------------------

/**
 * Sync all pending offline updates to the backend
 */
export const syncOfflineQueue = async () => {
  const queue = await getOfflineQueue();
  if (!queue || queue.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      // API call to update status on server
      const formData = new FormData();
      formData.append('status', item.newStatus);
      if (item.extraData?.notes) {
        formData.append('notes', item.extraData.notes);
      }

      try {
        await api.patch(`/v1/worker/tasks/${item.taskId}/status/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err1) {
        await api.patch(`/v1/complaints/${item.taskId}/status/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Synchronize in-memory/localStorage store
      updateComplaint(item.taskId, {
        status: item.newStatus,
        offline_queued: false,
        synced_at: new Date().toISOString(),
      });

      // Remove from offline queue
      await removeQueueItem(item.id, item.taskId);
      syncedCount += 1;
    } catch (err) {
      console.warn(`Sync failed for task ${item.taskId}:`, err?.message);
      failedCount += 1;
    }
  }

  return { syncedCount, failedCount };
};

/**
 * Check if the browser is currently online
 */
export const isDeviceOnline = () => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};
