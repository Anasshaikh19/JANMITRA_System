/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: public/firebase-messaging-sw.js
 * Developer: Faizan Rayeen (Citizen Portal & Push Notifications Lead)
 * Day: Day 32 - Harden Service Worker Caching & Offline Background Sync
 * Description: Hardened Service Worker featuring:
 *              1. Static Asset Caching (/icons/janmitra-logo-192.png, /icons/badge-72.png)
 *              2. Offline Background Sync fallback via IndexedDB & 'sync' event
 *              3. Zero-Reload Service Worker update lifecycle (skipWaiting & clients.claim)
 *              4. FCM Background Message delivery with rich OS notification options
 *              5. Deep-linking client focus / window opener on notificationclick
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. VERSIONING & STATIC CACHE ASSETS (Requirement 1)
// ------------------------------------------------------------------------------
const SW_VERSION = 'v3.2.0-day32';
const CACHE_NAME = `janmitra-static-${SW_VERSION}`;

const STATIC_ASSETS_TO_CACHE = [
  '/icons/janmitra-logo-192.png',
  '/icons/badge-72.png'
];

// ------------------------------------------------------------------------------
// 2. FIREBASE COMPAT SCRIPTS & INITIALIZATION
// ------------------------------------------------------------------------------
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSy_YOUR_FIREBASE_API_KEY_HERE",
  authDomain: "janmitra-nagpur.firebaseapp.com",
  projectId: "janmitra-nagpur",
  storageBucket: "janmitra-nagpur.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

// ------------------------------------------------------------------------------
// 3. INDEXEDDB OFFLINE QUEUE UTILITIES (Requirement 2)
// ------------------------------------------------------------------------------
const DB_NAME = 'janmitra_offline_sync_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_notifications';

const openSyncDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const storeOfflinePush = async (payload) => {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      payload: payload,
      stored_at: Date.now(),
      status: 'pending_sync'
    };
    store.add(record);
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        console.log('[SW Offline Sync] Stored pending notification into IndexedDB queue.');
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('[SW Offline Sync] Could not store offline push:', err);
    return false;
  }
};

const processPendingOfflineSync = async () => {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = async () => {
      const records = getAllRequest.result || [];
      if (records.length === 0) return;

      console.log(`[SW Background Sync] Processing ${records.length} pending offline notifications.`);

      // Notify open clients that connection is restored and notifications are synced
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      records.forEach((rec) => {
        allClients.forEach((client) => {
          client.postMessage({
            type: 'JANMITRA_OFFLINE_SYNC_COMPLETE',
            payload: rec.payload,
            synced_at: Date.now()
          });
        });
      });

      // Clear synced records
      const clearTx = db.transaction(STORE_NAME, 'readwrite');
      clearTx.objectStore(STORE_NAME).clear();
    };
  } catch (syncErr) {
    console.warn('[SW Background Sync] Error replaying offline sync queue:', syncErr);
  }
};

// ------------------------------------------------------------------------------
// 4. LIFECYCLE: INSTALL EVENT (Requirements 1 & 3)
// ------------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log(`[SW Lifecycle] Installing Service Worker ${SW_VERSION}`);

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW Cache] Pre-caching static assets (/icons/janmitra-logo-192.png, /icons/badge-72.png)');
      return cache.addAll(STATIC_ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW Cache] Pre-cache warning (some assets may load on-demand):', err);
      });
    }).then(() => {
      // Requirement 3: Skip waiting immediately so new SW activates without reload
      return self.skipWaiting();
    })
  );
});

// ------------------------------------------------------------------------------
// 5. LIFECYCLE: ACTIVATE EVENT (Requirement 3)
// ------------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log(`[SW Lifecycle] Activating Service Worker ${SW_VERSION}`);

  event.waitUntil(
    Promise.all([
      // Clean up stale caches from previous versions
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((existingCache) => {
            if (existingCache !== CACHE_NAME && existingCache.startsWith('janmitra-')) {
              console.log(`[SW Cache] Deleting obsolete cache: ${existingCache}`);
              return caches.delete(existingCache);
            }
          })
        );
      }),
      // Requirement 3: Claim existing clients immediately without forcing page reload
      self.clients.claim()
    ]).then(async () => {
      // Broadcast update event to all active client tabs
      const activeClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      activeClients.forEach((client) => {
        client.postMessage({
          type: 'JANMITRA_SW_UPDATED',
          version: SW_VERSION,
          cache: CACHE_NAME,
          timestamp: Date.now()
        });
      });
      console.log('[SW Lifecycle] Clients claimed and update broadcasted.');
    })
  );
});

// ------------------------------------------------------------------------------
// 6. CACHE-FIRST FETCH HANDLER FOR STATIC ASSETS (Requirement 1)
// ------------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Check if request matches any cached icon asset
  const isCachedAsset = STATIC_ASSETS_TO_CACHE.some((asset) => 
    requestUrl.pathname === asset || requestUrl.pathname.endsWith(asset)
  );

  if (isCachedAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fetch from network and dynamically cache
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Fallback if offline
          return caches.match('/icons/janmitra-logo-192.png');
        });
      })
    );
  }
});

// ------------------------------------------------------------------------------
// 7. BACKGROUND SYNC EVENT LISTENER (Requirement 2)
// ------------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'janmitra-sync-notifications' || event.tag === 'sync-notifications') {
    console.log('[SW Background Sync] "sync" event triggered. Online connectivity restored.');
    event.waitUntil(processPendingOfflineSync());
  }
});

// ------------------------------------------------------------------------------
// 8. CLIENT MESSAGE LISTENER (Requirement 3)
// ------------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW Message] Received SKIP_WAITING signal from client.');
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({
      version: SW_VERSION,
      cache: CACHE_NAME,
      online: navigator.onLine
    });
  }
});

// ------------------------------------------------------------------------------
// 9. FCM BACKGROUND PUSH HANDLER WITH OFFLINE FALLBACK (Requirement 2)
// ------------------------------------------------------------------------------
messaging.onBackgroundMessage(async (payload) => {
  console.log('[SW Push] Received background message payload:', payload);

  // If client is currently offline, buffer push payload to IndexedDB for sync replay
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[SW Push] Device is temporarily offline. Queuing payload for background sync.');
    await storeOfflinePush(payload);

    if ('sync' in self.registration) {
      try {
        await self.registration.sync.register('janmitra-sync-notifications');
      } catch (syncRegErr) {
        console.warn('[SW Push] Could not register background sync tag:', syncRegErr);
      }
    }
  }

  // Extract notification metadata
  const notificationTitle = payload.notification?.title 
    || payload.data?.title 
    || 'JANMITRA Civic Alert';

  const notificationBody = payload.notification?.body 
    || payload.data?.body 
    || 'Your civic complaint status has been updated.';

  const complaintId = payload.data?.complaint_id 
    || payload.data?.complaintId 
    || '';

  // Extract deep-link URL
  const targetUrl = payload.fcmOptions?.link
    || payload.notification?.click_action
    || payload.data?.click_action
    || payload.data?.link
    || (complaintId ? `/citizen/complaint/${complaintId}` : '/citizen');

  const notificationOptions = {
    body: notificationBody,
    icon: payload.notification?.icon || '/icons/janmitra-logo-192.png',
    badge: '/icons/badge-72.png',
    tag: complaintId ? `complaint-${complaintId}` : 'janmitra-notification',
    vibrate: [200, 100, 200],
    data: {
      url: targetUrl,
      complaintId: complaintId,
      fcmOptions: payload.fcmOptions || {},
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view-complaint',
        title: 'View Details'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ------------------------------------------------------------------------------
// 10. NOTIFICATION CLICK & DEEP-LINK NAVIGATION
// ------------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  console.log('[SW Notification Click] Notification clicked:', event.notification);
  event.notification.close();

  // If user clicked explicit 'Dismiss' action button
  if (event.action === 'close') {
    return;
  }

  const rawTarget = event.notification.data?.fcmOptions?.link
    || event.notification.data?.url
    || event.notification.data?.link
    || '/citizen';

  const destinationUrl = new URL(rawTarget, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Check if an existing tab is open on this origin
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(destinationUrl);
          }
          return client.focus();
        }
      }
      // 2. If no tab open, open new window directly
      if (clients.openWindow) {
        return clients.openWindow(destinationUrl);
      }
    })
  );
});
