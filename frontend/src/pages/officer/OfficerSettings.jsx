import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OfficerSidebarDrawer from '../../components/OfficerSidebarDrawer';
import WardBadge from '../../components/WardBadge';
import { formatDeptName } from '../../utils/chartHelpers';

const OfficerSettings = () => {
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const officerName = user?.name || 'Er. S. M. Kulkarni';
  const officerDept = formatDeptName(user?.department_name || user?.department || user?.dept || 'PWD');
  const officerWard = user?.ward || 2;

  // Settings State
  const [criticalSmsAlert, setCriticalSmsAlert] = useState(true);
  const [slaWarningWhatsapp, setSlaWarningWhatsapp] = useState(true);
  const [dailyDigestEmail, setDailyDigestEmail] = useState(false);
  const [autoDispatchMode, setAutoDispatchMode] = useState('assisted'); // 'manual' | 'assisted' | 'auto'
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(70);
  const [onDutyStatus, setOnDutyStatus] = useState(true);
  const [successToast, setSuccessToast] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-16">
      {/* Officer Sidebar Drawer */}
      <OfficerSidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        pendingValidationCount={4}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition flex items-center justify-center shadow-2xs"
              title="Open Navigation Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="border-l-4 border-l-primary pl-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Municipal Officer Portal
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500 font-medium">Department Settings</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-dark tracking-tight">
                Officer Dispatch & Notification Preferences
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/officer"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
            <Link
              to="/officer/validation"
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>🤖</span>
              <span>AI Validation</span>
            </Link>
            <Link
              to="/officer/workers"
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>👷</span>
              <span>Worker Roster</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-6 space-y-6">
        {successToast && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between animate-fade-in">
            <span>✓ Department settings and dispatch rules saved successfully.</span>
            <button onClick={() => setSuccessToast(false)} className="text-emerald-700 hover:text-emerald-900">✕</button>
          </div>
        )}

        {/* Profile Snapshot */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-blue-500/20">
              {officerName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">{officerName}</h2>
                <WardBadge ward={officerWard} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive Engineer • {officerDept}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOnDutyStatus(!onDutyStatus)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                onDutyStatus
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onDutyStatus ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{onDutyStatus ? 'On Duty (Active Dispatch)' : 'Off Duty'}</span>
            </button>

            <button
              onClick={logout}
              className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-xl text-xs font-bold transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Dispatch Automation Rules */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>⚡</span>
                <span>Worker Dispatch & Routing Mode</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select how newly submitted complaints are routed to your field workforce.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  autoDispatchMode === 'manual'
                    ? 'border-primary bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Manual Review</span>
                    <input
                      type="radio"
                      name="dispatchMode"
                      value="manual"
                      checked={autoDispatchMode === 'manual'}
                      onChange={() => setAutoDispatchMode('manual')}
                      className="text-primary"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Every grievance requires manual officer approval and worker selection.
                  </p>
                </div>
              </label>

              <label
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  autoDispatchMode === 'assisted'
                    ? 'border-primary bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">AI-Assisted (Recommended)</span>
                    <input
                      type="radio"
                      name="dispatchMode"
                      value="assisted"
                      checked={autoDispatchMode === 'assisted'}
                      onChange={() => setAutoDispatchMode('assisted')}
                      className="text-primary"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    AI pre-suggests top least-loaded worker with 1-click dispatch.
                  </p>
                </div>
              </label>

              <label
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  autoDispatchMode === 'auto'
                    ? 'border-primary bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Automated Dispatch</span>
                    <input
                      type="radio"
                      name="dispatchMode"
                      value="auto"
                      checked={autoDispatchMode === 'auto'}
                      onChange={() => setAutoDispatchMode('auto')}
                      className="text-primary"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Automatically dispatches to on-duty worker if AI confidence &gt; threshold.
                  </p>
                </div>
              </label>
            </div>

            {/* AI Confidence Threshold Slider */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">AI Photo Confidence Validation Threshold</span>
                <span className="font-black text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {aiConfidenceThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={aiConfidenceThreshold}
                onChange={(e) => setAiConfidenceThreshold(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Grievances with AI classification confidence below {aiConfidenceThreshold}% will appear in your AI Validation Queue for manual review.
              </p>
            </div>
          </div>

          {/* Urgent SLA Alerts */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>🔔</span>
                <span>Urgent SLA & Escalation Alerts</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure channels through which you receive critical breach warnings.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800">Instant Critical SLA SMS</span>
                  <p className="text-[11px] text-slate-500">Trigger immediate SMS to your mobile when a Critical (24h) ticket is submitted.</p>
                </div>
                <input
                  type="checkbox"
                  checked={criticalSmsAlert}
                  onChange={(e) => setCriticalSmsAlert(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800">WhatsApp SLA Countdown Alerts</span>
                  <p className="text-[11px] text-slate-500">Receive WhatsApp ping when a ticket is within 4 hours of SLA deadline.</p>
                </div>
                <input
                  type="checkbox"
                  checked={slaWarningWhatsapp}
                  onChange={(e) => setSlaWarningWhatsapp(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800">Daily Morning Performance Digest</span>
                  <p className="text-[11px] text-slate-500">Receive 8:00 AM summary of pending ward tasks and worker workload meters.</p>
                </div>
                <input
                  type="checkbox"
                  checked={dailyDigestEmail}
                  onChange={(e) => setDailyDigestEmail(e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
              </label>
            </div>
          </div>

          {/* Action Footer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex items-center justify-between shadow-xs">
            <span className="text-xs text-slate-500">
              Department parameters sync with the NMC central dispatch engine.
            </span>
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-xs transition"
            >
              Save Officer Preferences
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default OfficerSettings;
