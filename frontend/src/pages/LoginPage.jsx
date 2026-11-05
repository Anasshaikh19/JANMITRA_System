/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/LoginPage.jsx
 * Developer: Faizan Rayeen & Anas Shaikh
 * Description: Production Login and Registration page for Citizens & Workers.
 *              - Strict portal separation (Worker credentials stay in Worker portal,
 *                Citizen credentials stay in Citizen portal)
 *              - Professional Government Workforce Portal branding for Workers
 *              - Completely clean form inputs with aggressive browser autofill blockers
 *              - Email address input for Citizen Registration
 *              - Immediate "Successfully registered" confirmation
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL search params: ?tab=register&role=citizen / ?role=worker
  const roleParam = searchParams.get('role');
  const tabParam = searchParams.get('tab');

  const selectedRole = roleParam === 'worker' ? 'worker' : 'citizen';
  const [activeTab, setActiveTab] = useState(selectedRole === 'worker' ? 'login' : (tabParam === 'register' ? 'register' : 'login'));

  // Auth context
  const { login } = useAuth();

  // Loading and Alert states
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login Form State - Guaranteed 100% clean and empty
  const [loginForm, setLoginForm] = useState({
    mobile: '',
    password: ''
  });

  // Register Form State (Citizen only) - Guaranteed 100% clean and empty
  const [registerForm, setRegisterForm] = useState({
    name: '',
    mobile: '',
    email: '',
    ward: '',
    password: '',
    confirmPassword: ''
  });

  // Validation Error States
  const [loginErrors, setLoginErrors] = useState({});
  const [registerErrors, setRegisterErrors] = useState({});

  // Reset form fields to completely blank whenever role or activeTab changes
  useEffect(() => {
    if (selectedRole === 'worker') {
      setActiveTab('login');
    } else if (tabParam === 'register') {
      setActiveTab('register');
    } else {
      setActiveTab('login');
    }

    setLoginForm({ mobile: '', password: '' });
    setRegisterForm({
      name: '',
      mobile: '',
      email: '',
      ward: '',
      password: '',
      confirmPassword: ''
    });
    setLoginErrors({});
    setRegisterErrors({});
    setApiError('');
  }, [roleParam, tabParam, selectedRole]);

  /**
   * Role-based redirection upon successful authentication
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
   * Validate Login inputs
   */
  const validateLoginForm = () => {
    const errors = {};
    const mobileDigits = loginForm.mobile.trim();

    if (!mobileDigits) {
      errors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      errors.mobile = 'Enter a valid 10-digit mobile number';
    }

    if (!loginForm.password) {
      errors.password = 'Password is required';
    }

    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Validate Register inputs (Citizen)
   */
  const validateRegisterForm = () => {
    const errors = {};
    const mobileDigits = registerForm.mobile.trim();
    const emailVal = registerForm.email.trim();

    if (!registerForm.name.trim()) {
      errors.name = 'Full name is required';
    } else if (registerForm.name.trim().length < 3) {
      errors.name = 'Full name must be at least 3 characters';
    }

    if (!mobileDigits) {
      errors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      errors.mobile = 'Enter a valid 10-digit mobile number';
    }

    if (!emailVal) {
      errors.email = 'Email address is required';
    } else if (!/^[\w.-]+@[\w.-]+\.\w+$/.test(emailVal)) {
      errors.email = 'Enter a valid email address';
    }

    if (!registerForm.ward) {
      errors.ward = 'Please select your municipal ward';
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
   * Strictly enforces portal access boundaries (Workers only on Worker portal, Citizens only on Citizen portal)
   */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setRegSuccessMessage('');

    if (!validateLoginForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mobile: loginForm.mobile.trim(),
          password: loginForm.password,
          portal: selectedRole // Strictly enforce 'worker' or 'citizen'
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setApiError(data.detail || data.mobile?.[0] || 'Invalid mobile number or password. Please verify your credentials.');
        return;
      }

      // Portal access guard check
      if (selectedRole === 'worker' && data.role !== 'worker') {
        setApiError('Access restricted: This portal is strictly for authorized municipal Field Workers. Citizen accounts cannot sign in here.');
        return;
      }
      if (selectedRole === 'citizen' && data.role !== 'citizen') {
        setApiError('Access restricted: Municipal Field Workers and Staff must sign in via their respective departmental portals.');
        return;
      }

      // Store authentic session in AuthContext
      await login(data);

      // Redirect strictly to the authorized dashboard
      const userRole = data.role || data.user?.role || (selectedRole === 'worker' ? 'worker' : 'citizen');
      handleRoleRedirect(userRole);
    } catch (err) {
      console.error('[Login Error]', err);
      setApiError('Unable to connect to Janmitra authentication server. Please check your backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Citizen Register Form Submission
   * POST /api/v1/auth/register/
   */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setRegSuccessMessage('');

    if (!validateRegisterForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          mobile: registerForm.mobile.trim(),
          email: registerForm.email.trim(),
          ward: registerForm.ward,
          password: registerForm.password
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setApiError(data.detail || data.mobile?.[0] || data.email?.[0] || 'Registration failed. Please check your input.');
        return;
      }

      // Successful registration: show clear success alert & switch to clean login
      setRegSuccessMessage('You have successfully registered! Please sign in with your credentials.');
      setLoginForm({
        mobile: '',
        password: ''
      });
      setRegisterForm({
        name: '',
        mobile: '',
        email: '',
        ward: '',
        password: '',
        confirmPassword: ''
      });
      setActiveTab('login');

    } catch (err) {
      console.error('[Register Error]', err);
      setApiError('Unable to connect to Janmitra registration server. Please check your backend connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Back Link - Clean and strictly back to public home only */}
      <div className="w-full max-w-md mx-auto mb-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#0d2a53] hover:text-blue-700 transition px-3 py-1.5 rounded-lg hover:bg-slate-200/60"
        >
          <span>←</span> Back to Public Home
        </Link>
      </div>

      {/* Centered Mobile-First Container */}
      <div className="w-full max-w-md mx-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
        
        {/* ================= HEADER CARD ================= */}
        <div className="bg-[#0d2a53] text-white px-6 py-8 text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-blue-500/10 blur-2xl pointer-events-none rounded-full" />

          {/* Logo / Emblem - Official Municipal Gold Crest (Option 2) */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border-2 border-amber-400 mb-3 shadow-2xl p-1 overflow-hidden">
            <img src="/janmitra-logo-opt2-gold.jpg" alt="Janmitra Municipal Corporation Seal" className="w-full h-full rounded-full object-cover shadow-inner" />
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-white uppercase">
            JANMITRA
          </h1>

          {/* Authority Pill Badge */}
          <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
            <span className="inline-block bg-blue-600/40 text-blue-200 border border-blue-400/30 text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
              Janmitra Municipal Corporation
            </span>
            <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
              selectedRole === 'worker' 
                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/30' 
                : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30'
            }`}>
              {selectedRole === 'worker' ? '👷 Field Worker' : '👤 Citizen'}
            </span>
          </div>

          {/* Tagline */}
          <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-xs mx-auto leading-relaxed">
            {selectedRole === 'worker'
              ? 'Government-Issued Municipal Workforce Portal'
              : activeTab === 'register' 
              ? 'New Citizen Registration for Grievance Redressal'
              : 'Citizen Civic Issue Reporting & Redressal Portal'}
          </p>
        </div>

        {/* ================= FORM CARD ================= */}
        <div className="bg-white p-6 sm:p-8">
          
          {/* TABS HEADER: Citizen mode has Sign In & Register tabs. Worker mode has official workforce header */}
          {selectedRole === 'citizen' ? (
            <div className="flex border-b border-slate-200 mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setApiError('');
                  setRegSuccessMessage('');
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
                  setRegSuccessMessage('');
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
          ) : (
            <div className="border-b border-slate-200 mb-6 pb-4">
              <div className="text-sm font-bold text-amber-950 flex items-center justify-between">
                <span>👷 Field Worker Sign In</span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-300/60 uppercase tracking-wide">
                  Official Workforce
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Sign in using the official government-assigned mobile number and workforce credentials issued by your municipal department.
              </p>
            </div>
          )}

          {/* ================= SUCCESS BANNER ================= */}
          {regSuccessMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3 text-emerald-800 text-xs sm:text-sm">
              <span className="text-base leading-none">🎉</span>
              <div className="flex-1 font-semibold leading-snug">{regSuccessMessage}</div>
              <button
                type="button"
                onClick={() => setRegSuccessMessage('')}
                className="text-emerald-500 hover:text-emerald-800 font-bold ml-1"
              >
                &times;
              </button>
            </div>
          )}

          {/* ================= API ERROR BANNER ================= */}
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

          {/* ================= 1. LOGIN FORM ================= */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} noValidate autoComplete="off" className="space-y-4">
              {/* Browser Autofill Traps to prevent browser from pre-filling saved passwords */}
              <input
                type="text"
                name="autofill_prevent_user"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
                readOnly
              />
              <input
                type="password"
                name="autofill_prevent_key"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
                readOnly
              />

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {selectedRole === 'worker' ? 'Assigned Worker Mobile Number' : 'Registered Mobile Number'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="off"
                    name={selectedRole === 'worker' ? 'jmc_worker_auth_mobile' : 'jmc_citizen_auth_mobile'}
                    id={selectedRole === 'worker' ? 'jmc_worker_auth_mobile' : 'jmc_citizen_auth_mobile'}
                    placeholder="9876543210"
                    value={loginForm.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setLoginForm((prev) => ({ ...prev, mobile: val }));
                      if (loginErrors.mobile) setLoginErrors((prev) => ({ ...prev, mobile: null }));
                      if (apiError) setApiError('');
                    }}
                    className={`w-full pl-12 pr-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      loginErrors.mobile
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {loginErrors.mobile && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {loginErrors.mobile}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {selectedRole === 'worker' ? 'Official Authorization Password' : 'Password'} <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    name={selectedRole === 'worker' ? 'jmc_worker_auth_pwd' : 'jmc_citizen_auth_pwd'}
                    id={selectedRole === 'worker' ? 'jmc_worker_auth_pwd' : 'jmc_citizen_auth_pwd'}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => {
                      setLoginForm((prev) => ({ ...prev, password: e.target.value }));
                      if (loginErrors.password) setLoginErrors((prev) => ({ ...prev, password: null }));
                      if (apiError) setApiError('');
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
                    {showLoginPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {loginErrors.password && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {loginErrors.password}
                  </p>
                )}
              </div>

              {/* Login Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full mt-2 py-3 px-4 rounded-xl text-white font-bold text-sm transition duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
                  selectedRole === 'worker'
                    ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-amber-900/10'
                    : 'bg-[#0d2a53] hover:bg-[#133b73] active:bg-[#091e3b] shadow-blue-900/10'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>{selectedRole === 'worker' ? 'Sign In to Field Portal' : 'Sign In'}</span>
                )}
              </button>

              {/* Information Note */}
              <div className="pt-2 text-center text-xs text-slate-500">
                {selectedRole === 'worker'
                  ? 'Official workforce portal for Janmitra municipal field technicians and supervisors.'
                  : 'Authorized for registered citizens of Janmitra Municipal Corporation.'}
              </div>
            </form>
          )}

          {/* ================= 2. CITIZEN REGISTER FORM ================= */}
          {activeTab === 'register' && selectedRole === 'citizen' && (
            <form onSubmit={handleRegisterSubmit} noValidate autoComplete="off" className="space-y-4">
              {/* Browser Autofill Traps */}
              <input
                type="text"
                name="autofill_prevent_reg_user"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
                readOnly
              />
              <input
                type="password"
                name="autofill_prevent_reg_key"
                tabIndex={-1}
                aria-hidden="true"
                style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
                readOnly
              />

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  name="jmc_reg_fullname"
                  id="jmc_reg_fullname"
                  placeholder="e.g. Faizan Rayeen"
                  value={registerForm.name}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, name: e.target.value }));
                    if (registerErrors.name) setRegisterErrors((prev) => ({ ...prev, name: null }));
                    if (apiError) setApiError('');
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

              {/* Mobile Number */}
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
                    autoComplete="off"
                    name="jmc_reg_mobile"
                    id="jmc_reg_mobile"
                    placeholder="9876543210"
                    value={registerForm.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setRegisterForm((prev) => ({ ...prev, mobile: val }));
                      if (registerErrors.mobile) setRegisterErrors((prev) => ({ ...prev, mobile: null }));
                      if (apiError) setApiError('');
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

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  autoComplete="off"
                  name="jmc_reg_email"
                  id="jmc_reg_email"
                  placeholder="e.g. faizan@example.com"
                  value={registerForm.email}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, email: e.target.value }));
                    if (registerErrors.email) setRegisterErrors((prev) => ({ ...prev, email: null }));
                    if (apiError) setApiError('');
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

              {/* Ward Selection Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Municipal Ward <span className="text-red-500">*</span>
                </label>
                <select
                  name="jmc_reg_ward"
                  id="jmc_reg_ward"
                  value={registerForm.ward}
                  onChange={(e) => {
                    setRegisterForm((prev) => ({ ...prev, ward: e.target.value }));
                    if (registerErrors.ward) setRegisterErrors((prev) => ({ ...prev, ward: null }));
                    if (apiError) setApiError('');
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 outline-none transition duration-150 ${
                    registerErrors.ward
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                >
                  <option value="">Select your ward</option>
                  <option value="Ward 1 (Laxmi Nagar / South-West Nagpur)">Ward 1 (Laxmi Nagar / South-West Nagpur)</option>
                  <option value="Ward 2 (Dhantoli / Central Nagpur)">Ward 2 (Dhantoli / Central Nagpur)</option>
                  <option value="Ward 3 (Hanuman Nagar / South-East Nagpur)">Ward 3 (Hanuman Nagar / South-East Nagpur)</option>
                  <option value="Ward 4 (Mangalwari / North Nagpur)">Ward 4 (Mangalwari / North Nagpur)</option>
                </select>
                {registerErrors.ward && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.ward}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    name="jmc_reg_pwd"
                    id="jmc_reg_pwd"
                    placeholder="Minimum 6 characters"
                    value={registerForm.password}
                    onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, password: e.target.value }));
                      if (registerErrors.password) setRegisterErrors((prev) => ({ ...prev, password: null }));
                      if (apiError) setApiError('');
                    }}
                    className={`w-full px-4 pr-11 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      registerErrors.password
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Toggle password visibility"
                  >
                    {showRegPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {registerErrors.password && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    name="jmc_reg_confirm_pwd"
                    id="jmc_reg_confirm_pwd"
                    placeholder="Re-enter your password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                      if (registerErrors.confirmPassword) {
                        setRegisterErrors((prev) => ({ ...prev, confirmPassword: null }));
                      }
                      if (apiError) setApiError('');
                    }}
                    className={`w-full px-4 pr-11 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      registerErrors.confirmPassword
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Toggle password visibility"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {registerErrors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {registerErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Register Submit Button */}
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
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Register Account</span>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Official citizen registration for Janmitra Municipal Corporation
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
