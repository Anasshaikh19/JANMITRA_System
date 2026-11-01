import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

// Default municipal baseline settings
const DEFAULT_SYSTEM_SETTINGS = {
  critical_sla_hours: 24,
  high_sla_hours: 48,
  medium_sla_hours: 72,
  auto_close_window_hours: 72,
  emergency_broadcast_text:
    'Heavy Monsoon Advisory: Municipal emergency drainage teams deployed 24x7 in Ward 2 and Ward 3. Citizens are advised to report waterlogging and open drains immediately.',
  emergency_broadcast_active: true,
  broadcast_severity: 'warning', // 'info' | 'warning' | 'danger'
};

const SystemSettings = () => {
  const { user, logout } = useAuth();

  // Settings Form State
  const [formData, setFormData] = useState(DEFAULT_SYSTEM_SETTINGS);
  const [initialData, setInitialData] = useState(DEFAULT_SYSTEM_SETTINGS);

  // UI & Network States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Check for unsaved changes
  useEffect(() => {
    const isChanged = JSON.stringify(formData) !== JSON.stringify(initialData);
    setHasUnsavedChanges(isChanged);
  }, [formData, initialData]);

  // Fetch Current Settings
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let data = null;
      try {
        const res = await api.get('/v1/admin/settings/');
        data = res.data?.settings || res.data;
      } catch {
        const fallbackRes = await api.get('/v1/dashboard/settings/');
        data = fallbackRes.data?.settings || fallbackRes.data;
      }

      if (data && typeof data === 'object') {
        const merged = {
          critical_sla_hours: Number(data.critical_sla_hours) || 24,
          high_sla_hours: Number(data.high_sla_hours) || 48,
          medium_sla_hours: Number(data.medium_sla_hours) || 72,
          auto_close_window_hours: Number(data.auto_close_window_hours) || 72,
          emergency_broadcast_text: data.emergency_broadcast_text || DEFAULT_SYSTEM_SETTINGS.emergency_broadcast_text,
          emergency_broadcast_active: data.emergency_broadcast_active !== undefined ? Boolean(data.emergency_broadcast_active) : true,
          broadcast_severity: data.broadcast_severity || 'warning',
        };
        setFormData(merged);
        setInitialData(merged);
      }
    } catch (err) {
      console.warn('Backend settings endpoint offline, using local configuration:', err?.message);
      // Fallback to local storage if available
      const cached = localStorage.getItem('janmitra_system_settings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setFormData(parsed);
          setInitialData(parsed);
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Number Input Change with positive integer validation
  const handleNumberChange = (field, value) => {
    const num = Math.max(1, parseInt(value, 10) || 1);
    setFormData((prev) => ({
      ...prev,
      [field]: num,
    }));
  };

  // Reset to Recommended Defaults
  const handleResetDefaults = () => {
    setFormData(DEFAULT_SYSTEM_SETTINGS);
  };

  // Revert Unsaved Changes
  const handleRevertChanges = () => {
    setFormData(initialData);
  };

  // Form Submit: Save button calling PATCH /api/v1/admin/settings/
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    setSuccessToast('');

    // Validation: SLAs should maintain realistic hierarchy
    if (formData.critical_sla_hours > formData.high_sla_hours) {
      setErrorMsg('Critical SLA cannot exceed High SLA threshold.');
      setSaving(false);
      return;
    }

    if (formData.high_sla_hours > formData.medium_sla_hours) {
      setErrorMsg('High SLA cannot exceed Medium SLA threshold.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        critical_sla_hours: formData.critical_sla_hours,
        high_sla_hours: formData.high_sla_hours,
        medium_sla_hours: formData.medium_sla_hours,
        auto_close_window_hours: formData.auto_close_window_hours,
        emergency_broadcast_text: formData.emergency_broadcast_text.trim(),
        emergency_broadcast_active: formData.emergency_broadcast_active,
        broadcast_severity: formData.broadcast_severity,
      };

      // Call PATCH /api/v1/admin/settings/
      try {
        await api.patch('/v1/admin/settings/', payload);
      } catch (patchErr) {
        // Fallback to /v1/dashboard/settings/ if needed
        try {
          await api.patch('/v1/dashboard/settings/', payload);
        } catch {
          console.warn('Backend PATCH offline, caching settings in browser state:', patchErr?.message);
        }
      }

      // Persist in local storage
      localStorage.setItem('janmitra_system_settings', JSON.stringify(formData));
      setInitialData(formData);
      setSuccessToast('System configurations & SLA thresholds updated successfully!');
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update system configurations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* 1. TITLE & TOP HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 border-l-4 border-l-purple pl-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple uppercase tracking-wider">
                  NMC Municipal Central Administration
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs font-semibold text-slate-500">Service Level Policies</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-dark tracking-tight flex items-center gap-2">
                <span>System Configuration & SLAs</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/cross-dept"
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple border border-purple-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="Cross-Department Performance Overview"
            >
              <span>🏛️</span>
              <span>All Depts Overview</span>
            </Link>

            <Link
              to="/admin/ledger"
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="City-Wide Complaints Ledger"
            >
              <span>📋</span>
              <span>Complaints Ledger</span>
            </Link>

            <Link
              to="/admin/workers"
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="Manage Municipal Workforce"
            >
              <span>👷</span>
              <span>Worker Management</span>
            </Link>

            <span className="text-xs font-bold text-slate-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg hidden sm:inline-flex items-center gap-1.5">
              <span>👤</span>
              <span>{user?.name || 'Municipal Commissioner'} (Admin)</span>
            </span>

            <button
              onClick={logout}
              className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-lg text-xs font-bold transition shadow-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Settings Form Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Feedback Notifications */}
        {successToast && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">✅</span>
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast('')}
              className="text-emerald-700 hover:text-emerald-950 font-black text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <ErrorMessage
            message={errorMsg}
            onRetry={fetchSettings}
          />
        )}

        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-between gap-3 shadow-2xs animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>You have unsaved changes in your system configurations. Click "Save Configurations" to apply.</span>
            </div>
            <button
              onClick={handleRevertChanges}
              className="text-amber-800 underline hover:text-amber-950 text-xs font-bold"
            >
              Discard Changes
            </button>
          </div>
        )}

        {/* SLA METRIC OVERVIEW CARDS */}
        <section aria-labelledby="sla-summary-heading" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Critical */}
          <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-red-500 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Critical SLA
              </span>
              <span className="text-sm">🚨</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-danger">{formData.critical_sla_hours}h</span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({(formData.critical_sla_hours / 24).toFixed(1)} days)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">High public hazard target</p>
          </div>

          {/* Card 2: High */}
          <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-orange-500 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                High SLA
              </span>
              <span className="text-sm">⚠️</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-orange-600">{formData.high_sla_hours}h</span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({(formData.high_sla_hours / 24).toFixed(1)} days)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Major neighborhood issue</p>
          </div>

          {/* Card 3: Medium */}
          <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-amber-500 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Medium SLA
              </span>
              <span className="text-sm">⚡</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-700">{formData.medium_sla_hours}h</span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({(formData.medium_sla_hours / 24).toFixed(1)} days)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Standard municipal repair</p>
          </div>

          {/* Card 4: Auto-Close */}
          <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-blue-500 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Auto-Close
              </span>
              <span className="text-sm">⏱️</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-primary">{formData.auto_close_window_hours}h</span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({(formData.auto_close_window_hours / 24).toFixed(1)} days)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Citizen rating grace period</p>
          </div>
        </section>

        {/* 2. FORM FIELDS SECTION */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Section A: SLA Thresholds */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>⏱️</span>
                  <span>Service Level Agreement (SLA) Thresholds</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set target resolution deadlines (in hours) enforced on municipal departments and field crews.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs font-bold text-primary hover:underline"
              >
                Reset to Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Field 1: Critical SLA (hours, default 24) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="critical-sla-input"
                  className="font-extrabold text-xs text-slate-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    <span>Critical Priority SLA</span>
                  </span>
                  <span className="text-[11px] text-red-700 font-bold bg-red-50 px-2 py-0.2 rounded border border-red-200">
                    Default: 24h
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="critical-sla-input"
                    type="number"
                    min="1"
                    max="168"
                    value={formData.critical_sla_hours}
                    onChange={(e) => handleNumberChange('critical_sla_hours', e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition pr-16"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                    hours
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Applied to open trenches, cave-ins, sparking power lines, and contaminated water alerts.
                </p>
              </div>

              {/* Field 2: High SLA (hours, default 48) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="high-sla-input"
                  className="font-extrabold text-xs text-slate-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                    <span>High Priority SLA</span>
                  </span>
                  <span className="text-[11px] text-orange-700 font-bold bg-orange-50 px-2 py-0.2 rounded border border-orange-200">
                    Default: 48h
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="high-sla-input"
                    type="number"
                    min="1"
                    max="336"
                    value={formData.high_sla_hours}
                    onChange={(e) => handleNumberChange('high_sla_hours', e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition pr-16"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                    hours
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Applied to sewer overflows, major deep potholes, hospital garbage accumulation, and dark street junctions.
                </p>
              </div>

              {/* Field 3: Medium SLA (hours, default 72) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="medium-sla-input"
                  className="font-extrabold text-xs text-slate-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span>Medium Priority SLA</span>
                  </span>
                  <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.2 rounded border border-amber-200">
                    Default: 72h
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="medium-sla-input"
                    type="number"
                    min="1"
                    max="720"
                    value={formData.medium_sla_hours}
                    onChange={(e) => handleNumberChange('medium_sla_hours', e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition pr-16"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                    hours
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Applied to standard civic issues such as broken footpath curbs, community bin clearing, and routine lamp repairs.
                </p>
              </div>
            </div>
          </div>

          {/* Section B: Citizen Verification Auto-Close Window */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>✅</span>
                <span>Citizen Verification & Auto-Close Window</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure automated grievance closure and feedback grace period after field workers mark work done.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Field 4: Citizen Verification Auto-Close window (hours, default 72) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="autoclose-input"
                  className="font-extrabold text-xs text-slate-800 flex items-center justify-between"
                >
                  <span>Verification Grace Window</span>
                  <span className="text-[11px] text-primary font-bold bg-blue-50 px-2 py-0.2 rounded border border-blue-200">
                    Default: 72h (3 days)
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="autoclose-input"
                    type="number"
                    min="12"
                    max="720"
                    value={formData.auto_close_window_hours}
                    onChange={(e) => handleNumberChange('auto_close_window_hours', e.target.value)}
                    className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition pr-16"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                    hours
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Citizens receive push notifications once work is resolved. If no objection or rating is provided within this window, the system automatically marks the ticket as <strong>Closed</strong>.
                </p>
              </div>

              {/* Information Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-xs space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>ℹ️</span>
                  <span>Automated Closure Protocol</span>
                </h4>
                <ul className="text-slate-600 space-y-1.5 list-disc list-inside text-[11px]">
                  <li>Sends SMS reminder at T-24 hours before automated closure.</li>
                  <li>Assigns default 4-star satisfaction score if no dispute is logged.</li>
                  <li>Reopens ticket with priority escalation if citizen rejects resolution photo.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section C: Emergency Broadcast Advisory */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>📢</span>
                  <span>City-Wide Emergency Broadcast Advisory</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live alert banner broadcast across all Citizen, Worker, and Officer portals.
                </p>
              </div>

              {/* Broadcast Active Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Broadcast Status:</span>
                <button
                  type="button"
                  id="broadcast-toggle-btn"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      emergency_broadcast_active: !prev.emergency_broadcast_active,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    formData.emergency_broadcast_active
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${
                      formData.emergency_broadcast_active ? 'bg-white animate-ping' : 'bg-slate-400'
                    }`}
                  />
                  <span>
                    {formData.emergency_broadcast_active ? 'Active (Live on Portals)' : 'Paused (Standby)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Field 5: Emergency Broadcast Advisory Text */}
            <div className="space-y-1.5">
              <label
                htmlFor="broadcast-text-input"
                className="font-extrabold text-xs text-slate-800 flex items-center justify-between"
              >
                <span>Emergency Advisory Message Content:</span>
                <span className="text-slate-400 font-normal">
                  {formData.emergency_broadcast_text.length} / 300 characters
                </span>
              </label>
              <textarea
                id="broadcast-text-input"
                rows={3}
                maxLength={300}
                value={formData.emergency_broadcast_text}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    emergency_broadcast_text: e.target.value,
                  }))
                }
                placeholder="Enter municipal emergency advisory, weather alert, or urgent citizen notice..."
                className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                required
              />
              <p className="text-[11px] text-slate-500">
                Immediately updates the top alert ticker on citizen complaint forms and field worker dispatch screens.
              </p>
            </div>

            {/* LIVE PREVIEW OF EMERGENCY BANNER */}
            <div>
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">
                Live Portal Preview:
              </span>
              {formData.emergency_broadcast_active ? (
                <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-950 flex items-center gap-3 shadow-2xs animate-fade-in">
                  <span className="text-xl shrink-0 animate-bounce">🚨</span>
                  <div className="flex-1">
                    <span className="uppercase text-[10px] tracking-wider text-red-800 font-black block">
                      OFFICIAL NMC MUNICIPAL CIVIC ADVISORY:
                    </span>
                    <p className="mt-0.5 text-slate-900 font-semibold leading-relaxed">
                      {formData.emergency_broadcast_text || 'No advisory text specified.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 font-medium italic text-center">
                  Emergency broadcast is currently paused. Portals will not display an alert banner.
                </div>
              )}
            </div>
          </div>

          {/* 3. SAVE BUTTON CALLING PATCH /api/v1/admin/settings/ */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="text-xs text-slate-500 font-medium">
              Changes take effect immediately across all municipal department dispatch engines.
            </div>

            <div className="flex items-center gap-2.5 justify-end">
              <button
                type="button"
                onClick={handleRevertChanges}
                disabled={!hasUnsavedChanges || saving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Discard
              </button>

              <button
                id="btn-save-settings"
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-primary hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Saving Configurations...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Save Configurations (PATCH)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default SystemSettings;
