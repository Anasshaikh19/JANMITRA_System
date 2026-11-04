/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/LoginPage.jsx
 * Developer: Faizan Rayeen (Citizen Portal Lead) & Om (Integration Lead)
 * Description: Public citizen & worker login and registration portal.
 *              Dedicated exclusively to Citizens and Field Workers.
 *              Department Officers and Admins use the official portal at /official/login.
 *              Features REAL SimpleJWT backend authentication for all demo accounts.
 * ==============================================================================
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

export const LoginPage = () => {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/register' || window.location.search.includes('tab=register')) {
        return 'register';
      }
    }
    return 'login';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login Form State (Strictly Citizen & Field Worker)
  const [loginForm, setLoginForm] = useState({
    role: 'citizen', // 'citizen' | 'worker'
    identifier: '',
    password: ''
  });

  // Register Form State (Citizen Only)
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    mobile: '',
    ward: '',
    password: '',
    confirmPassword: ''
  });

  const [loginErrors, setLoginErrors] = useState({});
  const [registerErrors, setRegisterErrors] = useState({});

  const validateLoginForm = () => {
    const errors = {};
    const identifier = loginForm.identifier.trim();

    if (!identifier) {
      errors.identifier = 'Mobile number or email address is required';
    } else if (identifier.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        errors.identifier = 'Please enter a valid email address';
      }
    } else {
      const mobileDigits = identifier.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
        errors.identifier = 'Enter a valid 10-digit mobile number (e.g. 9876543210)';
      }
    }

    if (!loginForm.password) {
      errors.password = 'Password is required';
    }

    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegisterForm = () => {
    const errors = {};
    const mobileDigits = registerForm.mobile.trim();
    const emailVal = registerForm.email.trim();

    if (!registerForm.name.trim()) {
      errors.name = 'Full name is required';
    } else if (registerForm.name.trim().length < 3) {
      errors.name = 'Full name must be at least 3 characters';
    }

    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!mobileDigits) {
      errors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      errors.mobile = 'Enter a valid 10-digit mobile number (starting with 6-9)';
    }

    if (!registerForm.ward) {
      errors.ward = 'Please select your Nagpur ward';
    }

    if (!registerForm.password) {
      errors.password = 'Password is required';
    } else if (registerForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    if (!registerForm.confirmPassword) {
      errors.confirmPassword = 'Confirm your password';
    } else if (registerForm.password !== registerForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setRegisterErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle Login Form Submission
   * POST /api/v1/auth/login/
   */
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setApiError('');

    if (!validateLoginForm()) return;

    setIsLoading(true);

    try {
      const identifier = loginForm.identifier.trim();
      const isEmail = identifier.includes('@');
      const cleanMobile = identifier.replace(/\D/g, '');

      const payload = {
        username: identifier,
        mobile: isEmail ? '' : cleanMobile,
        email: isEmail ? identifier.toLowerCase() : '',
        password: loginForm.password
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg =
          data.error ||
          data.detail ||
          (typeof data.errors === 'object' ? Object.values(data.errors).flat().join(' ') : null) ||
          'Invalid mobile number, email, or password.';
        setApiError(errMsg);
        return;
      }

      // Store REAL SimpleJWT tokens in AuthContext and localStorage
      await login(data);

      const returnedRole = (data.role || data.user?.role || loginForm.role || 'citizen').toLowerCase().trim();

      if (returnedRole === 'worker' || loginForm.role === 'worker') {
        navigate('/worker');
      } else if (returnedRole === 'admin') {
        navigate('/admin');
      } else if (returnedRole === 'dept_officer' || returnedRole === 'officer') {
        navigate('/officer');
      } else {
        navigate('/citizen');
      }
    } catch (err) {
      console.error('[Login Error]', err);
      setApiError('Unable to connect to backend server at ' + API_BASE_URL + '. Please ensure the Django backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Real API Quick Login for Demo Accounts (Generates genuine JWT tokens)
   */
  const handleQuickDemoLogin = async (demoRole, demoIdentifier, demoPassword, targetPath) => {
    setIsLoading(true);
    setApiError('');
    setLoginForm({ role: demoRole, identifier: demoIdentifier, password: demoPassword });

    try {
      const isEmail = demoIdentifier.includes('@');
      const cleanMobile = demoIdentifier.replace(/\D/g, '');

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: demoIdentifier,
          mobile: isEmail ? '' : cleanMobile,
          email: isEmail ? demoIdentifier.toLowerCase() : '',
          password: demoPassword
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setApiError(data.error || data.detail || 'Demo login failed');
        return;
      }

      await login(data);
      navigate(targetPath);
    } catch (err) {
      console.error('[Quick Demo Login Error]', err);
      setApiError('Unable to connect to backend server for demo login.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Register Form Submission
   * POST /api/v1/auth/register/ -> then auto-login
   */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validateRegisterForm()) return;

    setIsLoading(true);

    try {
      const wardInt = parseInt(registerForm.ward, 10);
      const emailVal = registerForm.email.trim();

      const regResponse = await fetch(`${API_BASE_URL}/api/v1/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          mobile: registerForm.mobile.trim(),
          email: emailVal ? emailVal.toLowerCase() : '',
          ward: isNaN(wardInt) ? registerForm.ward : wardInt,
          password: registerForm.password
        })
      });

      const regData = await regResponse.json().catch(() => ({}));

      if (!regResponse.ok) {
        const errMsg =
          regData.error ||
          regData.detail ||
          (typeof regData.errors === 'object' ? Object.values(regData.errors).flat().join(' ') : null) ||
          (regData.email ? (Array.isArray(regData.email) ? regData.email.join(' ') : regData.email) : null) ||
          (regData.mobile ? (Array.isArray(regData.mobile) ? regData.mobile.join(' ') : regData.mobile) : null) ||
          'Registration failed. Please check your inputs.';
        setApiError(errMsg);
        return;
      }

      // Auto-login immediately with real JWT
      const loginPayload = {
        username: registerForm.mobile.trim(),
        mobile: registerForm.mobile.trim(),
        email: emailVal ? emailVal.toLowerCase() : '',
        password: registerForm.password
      };

      const loginResponse = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });

      const loginData = await loginResponse.json().catch(() => ({}));

      if (loginResponse.ok) {
        await login(loginData);
        navigate('/citizen');
      } else {
        await login(regData);
        navigate('/citizen');
      }
    } catch (err) {
      console.error('[Register Error]', err);
      setApiError('Unable to connect to backend server at ' + API_BASE_URL + '. Please ensure the Django backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Top Navigation Bar */}
      <div className="w-full max-w-md mx-auto mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#0d2a53] transition py-1.5 px-3 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow active:scale-95"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Home</span>
        </button>

        <Link
          to="/official/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 transition py-1.5 px-3 rounded-xl bg-purple-50 border border-purple-200 shadow-sm"
        >
          <span>🏛️ Official Staff Login</span>
        </Link>
      </div>

      {/* Main Form Container */}
      <div className="w-full max-w-md mx-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200 bg-white">
        
        {/* Header Card */}
        <div className="bg-[#0d2a53] text-white px-6 py-7 text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-blue-500/10 blur-2xl pointer-events-none rounded-full" />

          <div 
            onClick={() => navigate('/')}
            className="cursor-pointer inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-inner hover:bg-white/20 transition"
            title="Go to JANMITRA Home"
          >
            <span className="text-3xl" role="img" aria-label="Municipal Corporation Logo">🏛️</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-white uppercase">
            JANMITRA
          </h1>

          <div className="mt-1">
            <span className="inline-block bg-blue-600/40 text-blue-200 border border-blue-400/30 text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
              Citizen & Worker Portal
            </span>
          </div>

          <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            Civic Grievance Reporting & Field Resolution System
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setApiError('');
              }}
              className={`flex-1 py-3 text-center text-sm font-bold transition-all relative ${
                activeTab === 'login'
                  ? 'text-[#0d2a53]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
              {activeTab === 'login' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d2a53] rounded-t-md" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setApiError('');
              }}
              className={`flex-1 py-3 text-center text-sm font-bold transition-all relative ${
                activeTab === 'register'
                  ? 'text-[#0d2a53]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Register (Citizen)
              {activeTab === 'register' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d2a53] rounded-t-md" />
              )}
            </button>
          </div>

          {/* API Error Banner */}
          {apiError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs sm:text-sm animate-shake">
              <span className="text-base leading-none">⚠️</span>
              <div className="flex-1 font-medium leading-snug">{apiError}</div>
              <button
                type="button"
                onClick={() => setApiError('')}
                className="text-red-400 hover:text-red-700 font-bold ml-1"
              >
                &times;
              </button>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              
              {/* Role Selector (ONLY Citizen or Field Worker) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  I am logging in as <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={loginForm.role}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white text-slate-900 outline-none transition duration-150 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100 font-semibold"
                  >
                    <option value="citizen">👤 Citizen (Grievance Portal)</option>
                    <option value="worker">👷 Field Worker (Municipal Tasks)</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {loginForm.role === 'worker'
                    ? 'Field workers assigned to municipal repair and sanitation tasks.'
                    : 'Nagpur citizens tracking and reporting local civic issues.'}
                </p>
              </div>

              {/* Identifier Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number or Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    {loginForm.identifier.includes('@') ? (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder={loginForm.role === 'worker' ? 'e.g. 9810010001 or worker@janmitra.gov.in' : 'e.g. 9876543210 or citizen@nagpur.gov.in'}
                    value={loginForm.identifier}
                    onChange={(e) => {
                      setLoginForm((prev) => ({ ...prev, identifier: e.target.value }));
                      if (loginErrors.identifier) setLoginErrors((prev) => ({ ...prev, identifier: null }));
                    }}
                    className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      loginErrors.identifier
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {loginErrors.identifier && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {loginErrors.identifier}
                  </p>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => {
                      setLoginForm((prev) => ({ ...prev, password: e.target.value }));
                      if (loginErrors.password) setLoginErrors((prev) => ({ ...prev, password: null }));
                    }}
                    className={`w-full px-4 pr-11 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      loginErrors.password
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Toggle password visibility"
                  >
                    {showLoginPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {loginErrors.password && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {loginErrors.password}
                  </p>
                )}
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl text-white font-bold text-sm bg-[#0d2a53] hover:bg-[#133b73] active:bg-[#091e3b] transition duration-200 shadow-md shadow-blue-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In as {loginForm.role === 'worker' ? 'Field Worker' : 'Citizen'}</span>
                )}
              </button>

              {/* Official Staff Link Callout */}
              <div className="pt-3 pb-1">
                <Link
                  to="/official/login"
                  className="w-full p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 flex items-center justify-between text-xs font-bold text-purple-900 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏢</span>
                    <span>Department Officer or Admin?</span>
                  </div>
                  <span className="text-purple-600 font-extrabold">Official Login &rarr;</span>
                </Link>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel"
                  value={registerForm.name}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, name: e.target.value }));
                    if (registerErrors.name) setRegisterErrors((prev) => ({ ...prev, name: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                    registerErrors.name
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                />
                {registerErrors.name && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-slate-400 font-normal lowercase">(optional for updates)</span>
                </label>
                <input
                  type="email"
                  autoCapitalize="none"
                  placeholder="citizen@nagpur.gov.in"
                  value={registerForm.email}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, email: e.target.value }));
                    if (registerErrors.email) setRegisterErrors((prev) => ({ ...prev, email: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                    registerErrors.email
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                />
                {registerErrors.email && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={registerForm.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setRegisterForm((prev) => ({ ...prev, mobile: val }));
                      if (registerErrors.mobile) setRegisterErrors((prev) => ({ ...prev, mobile: null }));
                    }}
                    className={`w-full pl-12 pr-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      registerErrors.mobile
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {registerErrors.mobile && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.mobile}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Municipal Ward <span className="text-red-500">*</span>
                </label>
                <select
                  value={registerForm.ward}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, ward: e.target.value }));
                    if (registerErrors.ward) setRegisterErrors((prev) => ({ ...prev, ward: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 outline-none transition duration-150 ${
                    registerErrors.ward
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                >
                  <option value="">Select your ward</option>
                  <option value="1">Ward 1 (Dharampeth / West Nagpur)</option>
                  <option value="2">Ward 2 (Dhantoli / Central Nagpur)</option>
                  <option value="3">Ward 3 (Nehru Nagar / East Nagpur)</option>
                  <option value="4">Ward 4 (Mangalwari / North Nagpur)</option>
                </select>
                {registerErrors.ward && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.ward}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={registerForm.password}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, password: e.target.value }));
                    if (registerErrors.password) setRegisterErrors((prev) => ({ ...prev, password: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                    registerErrors.password
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                />
                {registerErrors.password && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.password}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                    if (registerErrors.confirmPassword) setRegisterErrors((prev) => ({ ...prev, confirmPassword: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                    registerErrors.confirmPassword
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                />
                {registerErrors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl text-white font-bold text-sm bg-[#0d2a53] hover:bg-[#133b73] active:bg-[#091e3b] transition duration-200 shadow-md shadow-blue-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating Citizen Account...' : 'Register & Continue'}
              </button>
            </form>
          )}

          {/* Quick Real API Test Login (Strictly Citizen & Worker) */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-2.5">
              ⚡ Quick Test Login (Real Authenticated Tokens)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickDemoLogin('citizen', '9820000001', 'Demo@12345', '/citizen')}
                className="py-2.5 px-3 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200 flex items-center justify-center gap-1.5"
              >
                <span>👤</span> Demo Citizen
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickDemoLogin('worker', '9810010001', 'Demo@12345', '/worker')}
                className="py-2.5 px-3 text-xs font-bold rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition border border-amber-200 flex items-center justify-center gap-1.5"
              >
                <span>👷</span> Demo Worker
              </button>
            </div>
          </div>

        </div>
      </div>

      <footer className="mt-6 text-center text-xs text-slate-500">
        JANMITRA &bull; Developed by Team ResolveIT &bull; Nagpur Municipal Corporation
      </footer>
    </div>
  );
};

export default LoginPage;
