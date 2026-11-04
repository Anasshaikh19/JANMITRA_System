/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/officer/AddWorkerPage.jsx
 * Developer: Team ResolveIT & Om (Integration Lead)
 * Description: Dedicated Add Worker page for Department Officers.
 *              Allows Department Officers (PWD, SWM, PHE, ELEC) to register
 *              on-ground municipal field workers for their specific department.
 *              The department is pre-assigned by default based on the officer's
 *              authenticated session.
 * ==============================================================================
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

const DEPARTMENTS = [
  { id: 1, code: 'PWD', name: 'Public Works Department (PWD)', color: 'blue', icon: '🛣️' },
  { id: 2, code: 'SWM', name: 'Solid Waste Management (SWM)', color: 'emerald', icon: '🗑️' },
  { id: 3, code: 'PHE', name: 'Public Health Engineering (PHE)', color: 'cyan', icon: '💧' },
  { id: 4, code: 'ELEC', name: 'Street Lighting & Electrical (ELEC)', color: 'amber', icon: '💡' }
];

const WARDS = [
  { id: 1, name: 'Ward 1', area: 'Dharampeth / West Nagpur' },
  { id: 2, name: 'Ward 2', area: 'Dhantoli / Central Nagpur' },
  { id: 3, name: 'Ward 3', area: 'Nehru Nagar / East Nagpur' },
  { id: 4, name: 'Ward 4', area: 'Mangalwari / North Nagpur' }
];

export const AddWorkerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Determine current officer's assigned department
  const currentDept = useMemo(() => {
    const rawDept = user?.department || user?.dept || 'PWD';
    const deptStr = String(rawDept).toUpperCase();

    if (deptStr.includes('PWD') || deptStr.includes('ROAD') || deptStr === '1') {
      return DEPARTMENTS[0];
    }
    if (deptStr.includes('SWM') || deptStr.includes('GARBAGE') || deptStr.includes('SOLID') || deptStr === '2') {
      return DEPARTMENTS[1];
    }
    if (deptStr.includes('PHE') || deptStr.includes('WATER') || deptStr.includes('DRAIN') || deptStr === '3') {
      return DEPARTMENTS[2];
    }
    if (deptStr.includes('ELEC') || deptStr.includes('LIGHT') || deptStr === '4') {
      return DEPARTMENTS[3];
    }
    return DEPARTMENTS[0];
  }, [user]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    ward: '1',
    password: '',
    confirmPassword: '',
    designation: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [registeredWorker, setRegisteredWorker] = useState(null);

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Worker full name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Full name must be at least 3 characters';
    }

    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!cleanMobile) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      newErrors.mobile = 'Enter a valid 10-digit Indian mobile number';
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.ward) {
      newErrors.ward = 'Please assign a municipal ward';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm worker password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const cleanMobile = formData.mobile.replace(/\D/g, '');
      const wardId = parseInt(formData.ward, 10);
      const suffix = cleanMobile.slice(-4);
      const employeeId = `EMP-${currentDept.code}-W${wardId}-${suffix}`;

      const payload = {
        name: formData.name.trim(),
        full_name: formData.name.trim(),
        mobile: cleanMobile,
        email: formData.email.trim().toLowerCase(),
        ward: wardId,
        department: currentDept.id,
        dept: currentDept.code,
        employee_id: employeeId,
        designation: formData.designation.trim() || `${currentDept.code} Field Specialist`,
        password: formData.password,
        status: 'active'
      };

      const res = await api.post('/v1/admin/workers/', payload);

      setRegisteredWorker({
        name: formData.name.trim(),
        mobile: cleanMobile,
        email: formData.email.trim() || 'N/A',
        ward: wardId,
        department: currentDept.name,
        employeeId: res.data?.employee_id || employeeId,
        password: formData.password
      });

      // Reset form
      setFormData({
        name: '',
        mobile: '',
        email: '',
        ward: '1',
        password: '',
        confirmPassword: '',
        designation: ''
      });
      setErrors({});
    } catch (err) {
      console.error('[AddWorker Error]', err);
      const respData = err.response?.data;
      if (respData) {
        if (typeof respData === 'string') {
          setApiError(respData);
        } else if (respData.detail) {
          setApiError(respData.detail);
        } else if (respData.error) {
          setApiError(respData.error);
        } else if (respData.mobile) {
          setApiError(`Mobile Error: ${Array.isArray(respData.mobile) ? respData.mobile.join(' ') : respData.mobile}`);
        } else if (respData.employee_id) {
          setApiError(`Employee ID Error: ${Array.isArray(respData.employee_id) ? respData.employee_id.join(' ') : respData.employee_id}`);
        } else {
          setApiError('Worker creation failed. Please check inputs and ensure mobile number is unique.');
        }
      } else {
        setApiError('Unable to connect to backend server. Please verify backend is running.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/officer"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0d2a53] transition py-1.5 px-3 rounded-xl bg-white border border-slate-200 shadow-xs hover:shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Department Dashboard</span>
          </Link>

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {currentDept.code} Personnel Onboarding
          </span>
        </div>

        {/* Success Modal / Banner */}
        {registeredWorker && (
          <div className="mb-6 bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 shadow-md animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
                ✓
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-emerald-900">
                  Field Worker Registered Successfully!
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Worker account has been onboarded into Nagpur Municipal Corporation database with full login credentials.
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/80 p-4 rounded-xl border border-emerald-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Worker Name</span>
                    <span className="font-bold text-slate-800">{registeredWorker.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Employee ID</span>
                    <span className="font-mono font-bold text-blue-700">{registeredWorker.employeeId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Login Mobile</span>
                    <span className="font-mono font-bold text-slate-800">+91 {registeredWorker.mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Assigned Ward</span>
                    <span className="font-bold text-slate-800">Ward {registeredWorker.ward}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Department</span>
                    <span className="font-bold text-slate-800">{registeredWorker.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[10px]">Assigned Password</span>
                    <span className="font-mono font-bold text-emerald-700">{registeredWorker.password}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisteredWorker(null)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition"
                  >
                    + Add Another Worker
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/officer')}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card Header */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-[#0d2a53] text-white p-6 relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                {currentDept.icon}
              </div>
              <div>
                <h1 className="text-xl font-black tracking-wide text-white">
                  Add New Field Worker
                </h1>
                <p className="text-xs text-blue-200 mt-0.5">
                  Register ground personnel for {currentDept.name}
                </p>
              </div>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-8 space-y-5">
            
            {/* API Error Banner */}
            {apiError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-xs sm:text-sm">
                <span className="text-base leading-none">⚠️</span>
                <div className="flex-1 font-medium">{apiError}</div>
                <button
                  type="button"
                  onClick={() => setApiError('')}
                  className="text-red-400 hover:text-red-700 font-bold"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Department (Auto-Assigned & Locked by Default) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Department <span className="text-slate-400 font-normal lowercase">(default for your department)</span>
              </label>
              <div className="flex items-center gap-3 p-3 bg-slate-100 border border-slate-200 rounded-xl">
                <span className="text-2xl">{currentDept.icon}</span>
                <div className="flex-1">
                  <span className="text-xs font-black text-[#0d2a53] block">
                    {currentDept.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Department code: <code className="bg-white px-1.5 py-0.5 rounded border text-blue-600 font-bold">{currentDept.code}</code> (Auto-locked)
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Default Locked
                </span>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Suresh Patil"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                }}
                className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                  errors.name
                    ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                    : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                  <span>•</span> {errors.name}
                </p>
              )}
            </div>

            {/* Mobile Number & Email (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={formData.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData((prev) => ({ ...prev, mobile: val }));
                      if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: null }));
                    }}
                    className={`w-full pl-11 pr-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      errors.mobile
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {errors.mobile && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {errors.mobile}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="email"
                  autoCapitalize="none"
                  placeholder="worker@janmitra.gov.in"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, email: e.target.value }));
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                    errors.email
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Municipal Ward & Designation (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ward Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Municipal Ward <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.ward}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, ward: e.target.value }));
                    if (errors.ward) setErrors((prev) => ({ ...prev, ward: null }));
                  }}
                  className={`w-full px-4 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 outline-none transition duration-150 ${
                    errors.ward
                      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                  }`}
                >
                  {WARDS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.area})
                    </option>
                  ))}
                </select>
                {errors.ward && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {errors.ward}
                  </p>
                )}
              </div>

              {/* Designation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Designation / Role <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder={`e.g. Senior ${currentDept.code} Tech`}
                  value={formData.designation}
                  onChange={(e) => setFormData((prev) => ({ ...prev, designation: e.target.value }))}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Password & Confirm Password (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, password: e.target.value }));
                      if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                    }}
                    className={`w-full px-4 pr-11 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      errors.password
                        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-300 focus:border-[#0d2a53] focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {errors.password}
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
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }));
                      if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: null }));
                    }}
                    className={`w-full px-4 pr-11 py-2.5 text-sm rounded-xl border bg-slate-50/50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition duration-150 ${
                      errors.confirmPassword
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium flex items-center gap-1">
                    <span>•</span> {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:flex-1 py-3 px-6 rounded-xl text-white font-bold text-sm bg-[#0d2a53] hover:bg-[#133b73] active:bg-[#091e3b] transition duration-200 shadow-md shadow-blue-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Onboarding Worker...</span>
                  </>
                ) : (
                  <>
                    <span>➕ Register Field Worker</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/officer')}
                className="w-full sm:w-auto py-3 px-6 rounded-xl text-slate-700 font-bold text-sm bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center pt-2">
              Registered workers can immediately sign into the Field Worker portal using their Mobile Number or Email.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddWorkerPage;
