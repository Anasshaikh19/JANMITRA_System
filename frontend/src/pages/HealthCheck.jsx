import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

/**
 * HealthCheck Diagnostics Page
 * Route: /health
 *
 * Diagnostics displayed:
 * 1. API Base URL: import.meta.env.VITE_API_URL
 * 2. Backend Live Ping: Live health check calling /api/v1/health/ with latency & payload
 * 3. Browser Service Worker Status: Registered / Active / Scope
 * 4. LocalStorage Auth Status: Logged in / Guest with user session metadata
 */
const HealthCheck = () => {
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // 1. API Configuration
  const apiBaseUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'https://resolveit-backend.onrender.com';

  // 2. Backend Ping State
  const [backendPing, setBackendPing] = useState({
    status: 'pending', // 'healthy' | 'degraded' | 'offline' | 'pending'
    latencyMs: null,
    statusCode: null,
    endpoint: '',
    message: '',
    details: null,
  });

  // 3. Service Worker State
  const [serviceWorkerInfo, setServiceWorkerInfo] = useState({
    supported: false,
    status: 'Checking...',
    scope: null,
    state: null,
  });

  // 4. LocalStorage Auth State
  const [authInfo, setAuthInfo] = useState({
    status: 'Checking...',
    isLoggedIn: false,
    role: null,
    name: null,
    email: null,
    ward: null,
    tokenPreview: null,
    storageItemsCount: 0,
  });

  // Check Service Worker status in browser
  const inspectServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      setServiceWorkerInfo({
        supported: false,
        status: 'Not Supported',
        scope: null,
        state: null,
      });
      return;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setServiceWorkerInfo({
          supported: true,
          status: 'Not Registered',
          scope: null,
          state: 'idle',
        });
        return;
      }

      const activeWorker = reg.active || reg.installing || reg.waiting;
      const state = activeWorker ? activeWorker.state : 'registered';

      setServiceWorkerInfo({
        supported: true,
        status: reg.active ? 'Registered / Active' : 'Registered',
        scope: reg.scope,
        state: state,
      });
    } catch (err) {
      setServiceWorkerInfo({
        supported: true,
        status: 'Registration Check Failed',
        scope: null,
        state: err.message,
      });
    }
  };

  // Inspect LocalStorage session tokens and user state
  const inspectAuthStorage = () => {
    try {
      const token = localStorage.getItem('janmitra_token');
      const role = localStorage.getItem('janmitra_role');
      const userRaw = localStorage.getItem('janmitra_user');
      const count = localStorage.length;

      let userObj = null;
      if (userRaw) {
        try {
          userObj = JSON.parse(userRaw);
        } catch {
          userObj = null;
        }
      }

      if (token) {
        setAuthInfo({
          status: 'Logged in',
          isLoggedIn: true,
          role: role || userObj?.role || 'Authenticated User',
          name: userObj?.name || 'Authorized Member',
          email: userObj?.email || userObj?.username || null,
          ward: userObj?.ward || null,
          tokenPreview:
            token.length > 18
              ? `${token.slice(0, 10)}...${token.slice(-6)}`
              : 'Valid Token Present',
          storageItemsCount: count,
        });
      } else {
        setAuthInfo({
          status: 'Guest',
          isLoggedIn: false,
          role: null,
          name: 'Unauthenticated Guest',
          email: null,
          ward: null,
          tokenPreview: null,
          storageItemsCount: count,
        });
      }
    } catch {
      setAuthInfo({
        status: 'Guest',
        isLoggedIn: false,
        role: null,
        name: null,
        email: null,
        ward: null,
        tokenPreview: null,
        storageItemsCount: 0,
      });
    }
  };

  // Perform Live Backend Ping check calling /api/v1/health/
  const pingBackend = async () => {
    const startTime = performance.now();
    const cleanBase = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    const targetUrl = cleanBase.endsWith('/api')
      ? `${cleanBase}/v1/health/`
      : `${cleanBase}/api/v1/health/`;

    try {
      // Primary attempt via configured Axios client
      let response = null;
      let usedEndpoint = '/api/v1/health/';

      try {
        response = await api.get('/v1/health/', { timeout: 7000 });
        usedEndpoint = '/v1/health/';
      } catch (clientErr) {
        // Fallback directly to fetch on targetUrl
        try {
          const fetchRes = await fetch(targetUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          });
          const data = await fetchRes.json().catch(() => ({}));
          response = {
            status: fetchRes.status,
            data: data,
          };
          usedEndpoint = targetUrl;
        } catch {
          // Fallback to /health/ root endpoint
          const rootHealthUrl = `${cleanBase}/health/`;
          const fetchRes2 = await fetch(rootHealthUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          });
          const data2 = await fetchRes2.json().catch(() => ({}));
          response = {
            status: fetchRes2.status,
            data: data2,
          };
          usedEndpoint = rootHealthUrl;
        }
      }

      const latency = Math.round(performance.now() - startTime);

      if (response && (response.status === 200 || response.status === 204)) {
        setBackendPing({
          status: 'healthy',
          latencyMs: latency,
          statusCode: response.status,
          endpoint: usedEndpoint,
          message:
            response.data?.status ||
            response.data?.message ||
            'Backend service responsive & healthy',
          details: response.data,
        });
      } else {
        setBackendPing({
          status: 'degraded',
          latencyMs: latency,
          statusCode: response ? response.status : 500,
          endpoint: usedEndpoint,
          message: 'Received unexpected response status from server',
          details: response ? response.data : null,
        });
      }
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      setBackendPing({
        status: 'offline',
        latencyMs: latency,
        statusCode: err.response?.status || 'Network Error',
        endpoint: targetUrl,
        message:
          err.message ||
          'Failed to reach backend service (Server cold start or network unreachable)',
        details: err.response?.data || null,
      });
    }
  };

  // Run full diagnostics suite
  const runDiagnostics = useCallback(
    async (isManual = false) => {
      if (isManual) setRechecking(true);
      else setLoading(true);

      inspectAuthStorage();
      await inspectServiceWorker();
      await pingBackend();

      setLastChecked(new Date().toLocaleTimeString());
      setLoading(false);
      setRechecking(false);
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  // Copy diagnostics report as JSON
  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      apiBaseUrl,
      backendPing,
      serviceWorkerInfo,
      authInfo,
      environment: {
        mode: import.meta.env.MODE,
        onLine: navigator.onLine,
        userAgent: navigator.userAgent,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    });
  };

  const isOnline = navigator.onLine;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white pb-12">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-lg shadow-inner">
              🩺
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                  <span>JANMITRA</span>
                  <span className="text-slate-500 font-normal">/</span>
                  <span className="text-blue-400 font-bold">Diagnostics & Health</span>
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  v1.0.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Frontend runtime verification & production probe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runDiagnostics(true)}
              disabled={rechecking || loading}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={rechecking ? 'animate-spin' : ''}>🔄</span>
              <span>{rechecking ? 'Testing...' : 'Re-check'}</span>
            </button>

            <Link
              to="/"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Exit ➔
            </Link>
          </div>
        </div>
      </header>

      {/* Main Diagnostics Container */}
      <main className="max-w-5xl mx-auto px-4 py-6 w-full space-y-5 flex-1">
        {/* System Overview Banner */}
        <div className="bg-slate-800/60 rounded-2xl p-4 sm:p-5 border border-slate-700/60 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span
                className={`w-3.5 h-3.5 rounded-full block ${
                  backendPing.status === 'healthy'
                    ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                    : backendPing.status === 'degraded'
                    ? 'bg-amber-500 shadow-lg shadow-amber-500/50'
                    : 'bg-rose-500 shadow-lg shadow-rose-500/50'
                }`}
              />
              <span
                className={`absolute -inset-1 rounded-full animate-ping opacity-40 ${
                  backendPing.status === 'healthy'
                    ? 'bg-emerald-500'
                    : backendPing.status === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">
                  {backendPing.status === 'healthy'
                    ? 'All Critical Subsystems Operational'
                    : backendPing.status === 'degraded'
                    ? 'Subsystems Degraded'
                    : 'Backend Gateway Offline'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase border ${
                    backendPing.status === 'healthy'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : backendPing.status === 'degraded'
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-rose-950 text-rose-300 border-rose-700'
                  }`}
                >
                  {backendPing.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lastChecked ? `Probe evaluated at ${lastChecked}` : 'Initializing probe...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleCopyReport}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>{copySuccess ? '✓' : '📋'}</span>
              <span>{copySuccess ? 'Copied JSON!' : 'Copy JSON'}</span>
            </button>
          </div>
        </div>

        {/* Diagnostic 4-Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: API Base URL */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>🌐</span>
                <span>API Base URL</span>
              </span>
              <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                VITE_API_URL
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 font-mono text-xs text-blue-300 break-all select-all">
              {apiBaseUrl}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Environment Mode:</span>
              <span className="font-mono text-slate-200 capitalize">
                {import.meta.env.MODE || 'production'}
              </span>
            </div>
          </div>

          {/* Card 2: Backend Ping Live Status */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Backend Live Ping (/api/v1/health/)</span>
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                  backendPing.status === 'healthy'
                    ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600'
                    : backendPing.status === 'degraded'
                    ? 'bg-amber-900/60 text-amber-300 border-amber-600'
                    : 'bg-rose-900/60 text-rose-300 border-rose-600'
                }`}
              >
                {backendPing.status === 'healthy'
                  ? 'Healthy'
                  : backendPing.status === 'degraded'
                  ? 'Degraded'
                  : 'Unreachable'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Response Latency</span>
                <span className="text-sm font-black font-mono text-white">
                  {backendPing.latencyMs !== null ? `${backendPing.latencyMs} ms` : '—'}
                </span>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">HTTP Code</span>
                <span className="text-sm font-black font-mono text-white">
                  {backendPing.statusCode !== null ? backendPing.statusCode : '—'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 break-words line-clamp-2">
              {backendPing.message}
            </p>
          </div>

          {/* Card 3: Browser Service Worker Status */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>⚙️</span>
                <span>Browser Service Worker Status</span>
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                  serviceWorkerInfo.status.includes('Active')
                    ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600'
                    : serviceWorkerInfo.supported
                    ? 'bg-blue-900/60 text-blue-300 border-blue-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {serviceWorkerInfo.status}
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">PWA API Supported:</span>
                <span className="font-bold text-white">
                  {serviceWorkerInfo.supported ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Worker State:</span>
                <span className="font-mono text-slate-200">
                  {serviceWorkerInfo.state || 'inactive'}
                </span>
              </div>
              {serviceWorkerInfo.scope && (
                <div className="pt-1 border-t border-slate-800/80 text-[11px] text-slate-400 break-all">
                  <span className="font-bold text-slate-300">Scope: </span>
                  <span className="font-mono">{serviceWorkerInfo.scope}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Offline caching, task synchronization, and background sync runtime.
            </p>
          </div>

          {/* Card 4: LocalStorage Auth Status */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>🔐</span>
                <span>LocalStorage Auth Status</span>
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                  authInfo.isLoggedIn
                    ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {authInfo.status}
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Session State:</span>
                <span className="font-bold text-white">
                  {authInfo.isLoggedIn ? '👤 Logged in' : '🚪 Guest (Public)'}
                </span>
              </div>
              {authInfo.isLoggedIn ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Portal Role:</span>
                    <span className="font-bold uppercase text-blue-400">
                      {authInfo.role}
                    </span>
                  </div>
                  {authInfo.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">User Identity:</span>
                      <span className="text-slate-200">{authInfo.name}</span>
                    </div>
                  )}
                  {authInfo.ward && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Assigned Ward:</span>
                      <span className="font-mono text-slate-200">Ward {authInfo.ward}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">JWT Token:</span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      {authInfo.tokenPreview}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  No active bearer session token detected. Browse as Guest or log in.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Keys in LocalStorage: {authInfo.storageItemsCount}</span>
              <Link to="/login" className="text-blue-400 hover:underline font-bold">
                {authInfo.isLoggedIn ? 'Switch Account ➔' : 'Log In ➔'}
              </Link>
            </div>
          </div>
        </div>

        {/* Portal Quick Navigation Bar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-bold text-slate-300">Quick Portal Links:</span>
            <span>Jump directly to test routes</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/citizen"
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
            >
              Citizen
            </Link>
            <Link
              to="/worker"
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
            >
              Worker
            </Link>
            <Link
              to="/officer"
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
            >
              Officer
            </Link>
            <Link
              to="/admin"
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
            >
              Admin
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HealthCheck;
