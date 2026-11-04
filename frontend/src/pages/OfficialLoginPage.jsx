/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/OfficialLoginPage.jsx
 * Developer: Team ResolveIT & Om (Integration Lead)
 * Description: Dedicated Official Staff & Administrative Portal Login.
 *              Exclusive login for Department Officers (PWD, SWM, PHE, ELEC)
 *              and Super Administrators.
 *              Uses real JWT authentication against /api/v1/auth/login/.
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

export const OfficialLoginPage = () => {
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  const { login } = useAuth();

  const [role, setRole] = useState('officer'); // 'officer' | 'admin'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errs = {};
    const id = identifier.trim();
    if (!id) {
      errs.identifier = 'Official email or mobile number is required';
    }
    if (!password) {
      errs.password = 'Password is required';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setApiError('');

    if (!validate()) return;

    setIsLoading(true);

    try {
      const id = identifier.trim();
      const isEmail = id.includes('@');
      const cleanMobile = id.replace(/\D/g, '');

      const payload = {
        username: id,
        mobile: isEmail ? '' : cleanMobile,
        email: isEmail ? id.toLowerCase() : '',
        password: password
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
          'Invalid credentials. Please verify your official employee account.';
        setApiError(errMsg);
        return;
      }

      // Save real JWT tokens in AuthContext & localStorage
      await login(data);

      const returnedRole = (data.role || data.user?.role || role).toLowerCase().trim();

      if (returnedRole === 'admin') {
        navigate('/admin');
      } else if (returnedRole === 'dept_officer' || returnedRole === 'officer') {
        navigate('/officer');
      } else {
        // If non-staff logged in through official portal
        setApiError('Notice: This account is registered as a citizen/worker. Please use the public portal.');
        navigate(returnedRole === 'worker' ? '/worker' : '/citizen');
      }
    } catch (err) {
      console.error('[Official Login Error]', err);
      setApiError('Unable to connect to backend server at ' + API_BASE_URL);
    } finally {
      setIsLoading(false);
    }
  };

  // Real API Quick Login for demo official accounts
  const handleDemoLogin = async (demoRole, demoId, demoPassword, targetPath) => {
    setIsLoading(true);
    setApiError('');
    setIdentifier(demoId);
    setPassword(demoPassword);
    setRole(demoRole);

    try {
      const isEmail = demoId.includes('@');
      const cleanMobile = demoId.replace(/\D/g, '');

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: demoId,
          mobile: isEmail ? '' : cleanMobile,
          email: isEmail ? demoId.toLowerCase() : '',
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
      console.error('[Demo Official Login Error]', err);
      setApiError('Unable to connect to backend server for official login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Top Navigation */}
      <div className="w-full max-w-md mx-auto mb-3 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition py-1.5 px-3 rounded-xl bg-slate-800/80 border border-slate-700 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Public Home</span>
        </Link>

        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition py-1.5 px-3 rounded-xl bg-slate-800/80 border border-slate-700"
        >
          <span>👤 Citizen / Worker Login</span>
        </Link>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-700 bg-slate-800/90 backdrop-blur-md">
        
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0b1e38] to-[#0d2a53] text-white px-6 py-8 text-center border-b border-slate-700/60 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-inner">
            <span className="text-3xl" role="img" aria-label="Official Emblem">🏛️</span>
          </div>

          <h1 className="text-2xl font-black tracking-wide text-white uppercase">
            JANMITRA OFFICIAL
          </h1>

          <div className="mt-1">
            <span className="inline-block bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
              Department & Administration Portal
            </span>
          </div>

          <p className="text-slate-300 text-xs mt-2 max-w-xs mx-auto">
            Authorized access for Department Officers (PWD, SWM, PHE, ELEC) and Central Administration
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          
          {/* API Error Banner */}
          {apiError && (
            <div className="mb-5 p-3.5 bg-red-950/80 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-200 text-xs sm:text-sm">
              <span className="text-base leading-none">⚠️</span>
              <div className="flex-1 font-medium">{apiError}</div>
              <button
                type="button"
                onClick={() => setApiError('')}
                className="text-red-400 hover:text-white font-bold ml-1"
              >
                &times;
              </button>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate className="space-y-4">
            
            {/* Official Designation Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Official Access Role <span className="text-red-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-600 bg-slate-900 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 font-semibold transition"
              >
                <option value="officer">🏢 Department Officer (PWD / SWM / PHE / ELEC)</option>
                <option value="admin">🏛️ Super Administrator (Municipal HQ)</option>
              </select>
            </div>

            {/* Official Identifier */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Official Email or Mobile <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder={role === 'admin' ? 'admin@janmitra.gov.in' : 'pwd.officer@janmitra.gov.in or 9800000001'}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-900 text-white placeholder-slate-500 outline-none transition ${
                    fieldErrors.identifier
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                      : 'border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
              </div>
              {fieldErrors.identifier && (
                <p className="text-red-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                  <span>•</span> {fieldErrors.identifier}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter official password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
                  }}
                  className={`w-full px-4 pr-11 py-2.5 text-sm rounded-xl border bg-slate-900 text-white placeholder-slate-500 outline-none transition ${
                    fieldErrors.password
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                      : 'border-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-red-400 text-xs mt-1.5 font-medium flex items-center gap-1">
                  <span>•</span> {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition duration-200 shadow-md shadow-blue-900/30 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Authenticating Official...</span>
                </>
              ) : (
                <span>Sign In to Official Dashboard</span>
              )}
            </button>
          </form>

          {/* Quick Real API Test Login Buttons */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-2.5">
              ⚡ Quick Official Login (Real Authentication)
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleDemoLogin('officer', '9800000001', 'Demo@12345', '/officer')}
                className="py-2 px-2 text-xs font-semibold rounded-lg bg-blue-900/40 text-blue-200 hover:bg-blue-900/70 transition border border-blue-700/60 flex items-center justify-center gap-1.5"
                title="Login as Rajesh Kumar (PWD Officer)"
              >
                <span>🛣️</span> PWD Officer
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleDemoLogin('officer', '9800000002', 'Demo@12345', '/officer')}
                className="py-2 px-2 text-xs font-semibold rounded-lg bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/70 transition border border-emerald-700/60 flex items-center justify-center gap-1.5"
                title="Login as Sunita Deshmukh (SWM Officer)"
              >
                <span>🗑️</span> SWM Officer
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleDemoLogin('officer', '9800000003', 'Demo@12345', '/officer')}
                className="py-2 px-2 text-xs font-semibold rounded-lg bg-cyan-900/40 text-cyan-200 hover:bg-cyan-900/70 transition border border-cyan-700/60 flex items-center justify-center gap-1.5"
                title="Login as Amitabh Joshi (PHE Officer)"
              >
                <span>💧</span> PHE Officer
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleDemoLogin('officer', '9800000004', 'Demo@12345', '/officer')}
                className="py-2 px-2 text-xs font-semibold rounded-lg bg-amber-900/40 text-amber-200 hover:bg-amber-900/70 transition border border-amber-700/60 flex items-center justify-center gap-1.5"
                title="Login as Pooja Sharma (Electrical Officer)"
              >
                <span>💡</span> ELEC Officer
              </button>
            </div>

            {/* Central Admin Full-width */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleDemoLogin('admin', 'admin@janmitra.gov.in', 'Demo@12345', '/admin')}
              className="w-full mt-2 py-2 px-3 text-xs font-bold rounded-lg bg-rose-900/40 text-rose-200 hover:bg-rose-900/70 transition border border-rose-700/60 flex items-center justify-center gap-2"
              title="Login as Super Administrator"
            >
              <span>🏛️</span> Super Administrator (HQ)
            </button>
          </div>

        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-500">
        JANMITRA Administration Gateway &bull; Nagpur Municipal Corporation
      </footer>
    </div>
  );
};

export default OfficialLoginPage;
