import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const getApiBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();

// Canonical Nagpur Municipal Departments
const DEPARTMENTS = [
  { value: 'PWD', label: 'PWD (Roads & Infrastructure)', id: 1 },
  { value: 'SWM', label: 'Solid Waste Management (SWM)', id: 2 },
  { value: 'PHE', label: 'Public Health Engineering (Water Works)', id: 3 },
  { value: 'ELEC', label: 'Electrical Department (Street Lighting)', id: 4 },
];

// 4 Canonical Wards in Nagpur
const WARDS = [
  { value: 1, label: 'Ward 1 (Dharampeth / West Nagpur)' },
  { value: 2, label: 'Ward 2 (Dhantoli / Central Nagpur)' },
  { value: 3, label: 'Ward 3 (Nehru Nagar / East Nagpur)' },
  { value: 4, label: 'Ward 4 (Mangalwari / North Nagpur)' },
];

export const LoginPage = () => {
  const { login } = useAuth();
  let navigate;
  let location;
  try {
    navigate = useNavigate();
    location = useLocation();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
    location = { pathname: '/register' };
  }

  // Active Tab: starts on 'register' as requested by user
  const [activeTab, setActiveTab] = useState(() => {
    return (location?.pathname === '/login') ? 'login' : 'register';
  });

  useEffect(() => {
    if (location?.pathname === '/login') {
      setActiveTab('login');
    } else if (location?.pathname === '/register') {
      setActiveTab('register');
    }
  }, [location?.pathname]);

  // Sign In form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState('citizen');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState('citizen'); // 'citizen' | 'worker' | 'officer' | 'admin'
  const [regWard, setRegWard] = useState(1);
  const [regDepartment, setRegDepartment] = useState('PWD');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  /**
   * Route safely to destination portal
   */
  const handleRoleRedirect = (role) => {
    const cleanRole = (role || 'citizen').toLowerCase().trim();
    switch (cleanRole) {
      case 'admin':
        navigate('/admin');
        break;
      case 'dept_officer':
      case 'officer':
        navigate('/officer');
        break;
      case 'worker':
        navigate('/worker');
        break;
      case 'citizen':
      default:
        navigate('/citizen');
        break;
    }
  };

  /**
   * Handle Registration Submission
   * POST /api/v1/auth/register/
   */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validations
    if (!regName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    const cleanMobile = regMobile.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: regName.trim(),
        full_name: regName.trim(),
        mobile: cleanMobile,
        email: regEmail.trim() || `${cleanMobile}@${regRole}.janmitra.gov.in`,
        password: regPassword,
        role: regRole,
        ward: (regRole === 'citizen' || regRole === 'worker') ? regWard : undefined,
        department: (regRole === 'worker' || regRole === 'officer') ? regDepartment : undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorText =
          data.detail ||
          data.error ||
          data.message ||
          (typeof data === 'object' ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ') : null) ||
          'Registration failed. Please check your inputs.';
        setErrorMsg(errorText);
        return;
      }

      setSuccessMsg('Account registered successfully! Directing to portal...');

      // Store in AuthContext
      login(data);

      const targetRole = data.role || data.user?.role || regRole;
      setTimeout(() => {
        handleRoleRedirect(targetRole);
      }, 700);
    } catch (err) {
      console.error('[Register Error]', err);
      setErrorMsg(`Unable to connect to backend server at ${API_BASE_URL}. Ensure Django backend is running.`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Login Submission
   * POST /api/v1/auth/login/
   */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginIdentifier.trim()) {
      setErrorMsg('Please enter your registered mobile number or email.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: loginIdentifier.trim(),
          username: loginIdentifier.trim(),
          password: loginPassword,
          role: loginRole,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorText =
          data.error ||
          data.detail ||
          data.non_field_errors ||
          (typeof data.errors === 'object' ? Object.values(data.errors).flat().join(' ') : null) ||
          'Invalid mobile number or password.';
        setErrorMsg(Array.isArray(errorText) ? errorText.join(' ') : errorText);
        return;
      }

      setSuccessMsg('Login successful! Redirecting...');
      login(data);

      const targetRole = data.role || data.user?.role || loginRole;
      setTimeout(() => {
        handleRoleRedirect(targetRole);
      }, 500);
    } catch (err) {
      console.error('[Login Error]', err);
      setErrorMsg(`Unable to connect to backend server at ${API_BASE_URL}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md mx-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200 bg-white">
        
        {/* ================= HEADER CARD ================= */}
        <div className="bg-[#0d2a53] text-white px-6 py-7 text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20 text-2xl mb-2 font-black shadow-inner border border-blue-400/30">
            🏛️
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            JANMITRA
          </h1>
          <p className="text-xs text-blue-200 mt-1 font-medium">
            Municipal Corporation &bull; Civic Redressal Portal
          </p>
        </div>

        {/* ================= TAB SWITCHER ================= */}
        <div role="tablist" aria-label="Authentication Options" className="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'register'}
            id="tab-register"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition ${
              activeTab === 'register'
                ? 'border-[#0d2a53] text-[#0d2a53] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📝 Register Account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            id="tab-login"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition ${
              activeTab === 'login'
                ? 'border-[#0d2a53] text-[#0d2a53] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🔐 Sign In
          </button>
        </div>

        <div className="p-6 sm:p-7">
          {/* Error Message Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2 shadow-xs"
            >
              <span className="text-sm">⚠️</span>
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Success Message Alert */}
          {successMsg && (
            <div
              role="status"
              className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-center gap-2 shadow-xs"
            >
              <span className="text-sm">✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================= REGISTER FORM ================= */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              
              {/* User Type / Role Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  User Type / Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                >
                  <option value="citizen">👤 Citizen (Civic Grievance Reporter)</option>
                  <option value="worker">👷 Field Worker (Sanitation, Roads, Repairs)</option>
                  <option value="officer">🏢 Department Officer (PWD, SWM, Water, Elec)</option>
                  <option value="admin">🏛️ Municipal Admin (NMC Central HQ)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Select your user category to enable department and ward assignments.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Ramesh Deshmukh"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  10-Digit Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-semibold select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="98XXXXXXXX"
                    className="w-full pl-11 pr-3.5 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600 transition font-mono"
                  />
                </div>
              </div>

              {/* Department Dropdown (Shown for Worker & Officer) */}
              {(regRole === 'worker' || regRole === 'officer') && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold border border-blue-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.value} value={dept.value}>
                        {dept.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ward Dropdown (Shown for Citizen & Worker) */}
              {(regRole === 'citizen' || regRole === 'worker') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Municipal Ward <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={regWard}
                    onChange={(e) => setRegWard(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  >
                    {WARDS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Optional Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>
              </div>

              {/* Show password toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-reg-pass"
                  checked={showRegPassword}
                  onChange={(e) => setShowRegPassword(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="show-reg-pass" className="text-xs text-slate-600 font-semibold cursor-pointer select-none">
                  Show passwords
                </label>
              </div>

              {/* Submit Registration Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Registering Account in Database...</span>
                  </>
                ) : (
                  <span>Complete Registration & Open Portal →</span>
                )}
              </button>
            </form>
          )}

          {/* ================= SIGN IN (LOGIN) FORM ================= */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              
              {/* Portal Role / User Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Portal / User Type
                </label>
                <select
                  value={loginRole}
                  onChange={(e) => setLoginRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                >
                  <option value="citizen">👤 Citizen Portal</option>
                  <option value="worker">👷 Field Worker Portal</option>
                  <option value="officer">🏢 Department Officer Portal</option>
                  <option value="admin">🏛️ Administrator Portal</option>
                </select>
              </div>

              {/* Mobile / Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number / Email Address
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="e.g. 9820000001 or admin@janmitra.gov.in"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {showLoginPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Submit Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#0d2a53] hover:bg-[#12386e] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In to Portal →</span>
                )}
              </button>
            </form>
          )}

          {/* ================= QUICK SEEDED DEMO LOGINS ================= */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">
              ⚡ Quick Test Login (Seeded Accounts)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLoginIdentifier('9820000001');
                  setLoginPassword('Demo@12345');
                  setLoginRole('citizen');
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mobile: '9820000001', password: 'Demo@12345', role: 'citizen' })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      login(data);
                      navigate('/citizen');
                      return;
                    }
                  } catch (e) {
                    console.warn('[QuickLogin] Falling back to local auth:', e);
                  }
                  login({
                    token: 'jwt-citizen-demo',
                    role: 'citizen',
                    user: { id: 22, name: 'Aarav Mehta (Citizen)', mobile: '9820000001', role: 'citizen', ward: 1 }
                  });
                  navigate('/citizen');
                }}
                className="py-2.5 px-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200 flex items-center justify-center gap-1.5"
              >
                <span>👤</span> Citizen (Ward 1)
              </button>

              <button
                type="button"
                onClick={async () => {
                  setLoginIdentifier('9800000001');
                  setLoginPassword('Demo@12345');
                  setLoginRole('officer');
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mobile: '9800000001', password: 'Demo@12345', role: 'officer' })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      login(data);
                      navigate('/officer');
                      return;
                    }
                  } catch (e) {
                    console.warn('[QuickLogin] Falling back to local auth:', e);
                  }
                  login({
                    token: 'jwt-officer-demo',
                    role: 'officer',
                    user: { id: 2, name: 'Rajesh Kumar (PWD Officer)', mobile: '9800000001', role: 'officer', department: 'PWD' }
                  });
                  navigate('/officer');
                }}
                className="py-2.5 px-2 text-xs font-bold rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition border border-purple-200 flex items-center justify-center gap-1.5"
              >
                <span>🏢</span> Officer (PWD)
              </button>

              <button
                type="button"
                onClick={async () => {
                  setLoginIdentifier('9810010001');
                  setLoginPassword('Demo@12345');
                  setLoginRole('worker');
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mobile: '9810010001', password: 'Demo@12345', role: 'worker' })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      login(data);
                      navigate('/worker');
                      return;
                    }
                  } catch (e) {
                    console.warn('[QuickLogin] Falling back to local auth:', e);
                  }
                  login({
                    token: 'jwt-worker-demo',
                    role: 'worker',
                    user: { id: 6, name: 'Worker PWD Ward 1', mobile: '9810010001', role: 'worker', department: 'PWD', ward: 1 }
                  });
                  navigate('/worker');
                }}
                className="py-2.5 px-2 text-xs font-bold rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 transition border border-amber-200 flex items-center justify-center gap-1.5"
              >
                <span>👷</span> Field Worker
              </button>

              <button
                type="button"
                onClick={async () => {
                  setLoginIdentifier('admin@janmitra.gov.in');
                  setLoginPassword('Demo@12345');
                  setLoginRole('admin');
                  try {
                    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username: 'admin@janmitra.gov.in', password: 'Demo@12345', role: 'admin' })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      login(data);
                      navigate('/admin');
                      return;
                    }
                  } catch (e) {
                    console.warn('[QuickLogin] Falling back to local auth:', e);
                  }
                  login({
                    token: 'jwt-admin-demo',
                    role: 'admin',
                    user: { id: 1, name: 'Janmitra Admin', email: 'admin@janmitra.gov.in', role: 'admin' }
                  });
                  navigate('/admin');
                }}
                className="py-2.5 px-2 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition border border-rose-200 flex items-center justify-center gap-1.5"
              >
                <span>🏛️</span> Admin (HQ)
              </button>
            </div>
          </div>

        </div>
      </div>

      <footer className="mt-6 text-center text-xs text-slate-500">
        JANMITRA &bull; Developed by Team ResolveIT &bull; Municipal Corporation
      </footer>
    </div>
  );
};

export default LoginPage;
