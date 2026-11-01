import React, { useState, useEffect } from 'react';

const DEPARTMENTS = [
  { id: 'PWD', name: 'Public Works (PWD - Roads & Infra)' },
  { id: 'SWM', name: 'Solid Waste Management (SWM)' },
  { id: 'PHE', name: 'Public Health Engineering (PHE - Water & Drainage)' },
  { id: 'Electrical', name: 'Street Lighting & Electrical' },
];

const WARDS = [1, 2, 3, 4];

/**
 * WorkerRegistrationForm:
 * Modal form for registering a new worker or editing an existing worker.
 * Supports pre-filled data when isEdit is true.
 */
const WorkerRegistrationForm = ({
  isOpen,
  onClose,
  initialData = null,
  onSave,
  isEdit = false,
}) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    dept: 'PWD',
    ward: 1,
    designation: '',
    mobile: '',
    email: '',
    status: 'Active',
    active_tasks: 0,
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Synchronize initialData when modal opens or worker changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id || '',
        name: initialData.name || '',
        dept: initialData.dept || 'PWD',
        ward: Number(initialData.ward) || 1,
        designation: initialData.designation || '',
        mobile: initialData.mobile || '',
        email: initialData.email || '',
        status: initialData.status || 'Active',
        active_tasks: Number(initialData.active_tasks) || 0,
      });
    } else {
      setFormData({
        id: `EMP-W-${Math.floor(100 + Math.random() * 900)}`,
        name: '',
        dept: 'PWD',
        ward: 1,
        designation: '',
        mobile: '+91 98765 ',
        email: '',
        status: 'Active',
        active_tasks: 0,
      });
    }
    setFormError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter the full name of the worker.');
      return;
    }

    if (!formData.designation.trim()) {
      setFormError('Please enter the worker designation / role.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        ward: Number(formData.ward),
        active_tasks: Number(formData.active_tasks) || 0,
      };

      if (onSave) {
        await onSave(payload, isEdit);
      }
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to save worker record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-modal-title"
        className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-primary flex items-center justify-center text-xl shadow-inner shrink-0">
              {isEdit ? '✏️' : '👷'}
            </div>
            <div>
              <h3 id="worker-modal-title" className="text-base font-black text-slate-900 tracking-tight">
                {isEdit ? 'Edit Worker Profile' : 'Register New Worker'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isEdit
                  ? `Updating record for ${formData.id}`
                  : 'Deploy municipal personnel to department and ward'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold text-base transition btn-micro focus-ring"
            aria-label="Close form"
          >
            ✕
          </button>
        </div>

        {/* Error notification banner */}
        {formError && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 rounded-xl bg-red-50 border border-red-200 text-danger text-xs font-semibold flex items-center gap-2"
          >
            <span>⚠️</span>
            <span>{formError}</span>
          </div>
        )}

        {/* Worker Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee ID & Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="worker-id" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Employee ID <span className="text-danger">*</span>
              </label>
              <input
                id="worker-id"
                name="id"
                type="text"
                required
                disabled={isEdit}
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="e.g. EMP-W-101"
                className={`w-full px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl focus-ring text-slate-800 transition ${
                  isEdit ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-slate-50'
                }`}
              />
            </div>

            <div>
              <label htmlFor="worker-name" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                id="worker-name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Suresh Patil"
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
              />
            </div>
          </div>

          {/* Department & Ward */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="worker-dept" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Department <span className="text-danger">*</span>
              </label>
              <select
                id="worker-dept"
                name="dept"
                value={formData.dept}
                onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="worker-ward" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Assigned Ward <span className="text-danger">*</span>
              </label>
              <select
                id="worker-ward"
                name="ward"
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
              >
                {WARDS.map((w) => (
                  <option key={w} value={w}>
                    Ward {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Designation */}
          <div>
            <label htmlFor="worker-designation" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              Designation / Role <span className="text-danger">*</span>
            </label>
            <input
              id="worker-designation"
              name="designation"
              type="text"
              required
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              placeholder="e.g. Senior Road Inspector / Pipeline Fitter"
              className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
            />
          </div>

          {/* Mobile & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="worker-mobile" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Contact Mobile
              </label>
              <input
                id="worker-mobile"
                name="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+91 98765 00000"
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
              />
            </div>

            <div>
              <label htmlFor="worker-email" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Email Address
              </label>
              <input
                id="worker-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="worker@janmitra.gov.in"
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
              />
            </div>
          </div>

          {/* Status & Active Tasks Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="worker-status" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Duty Status
              </label>
              <select
                id="worker-status"
                name="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
              >
                <option value="Active">Active (On Duty)</option>
                <option value="Inactive">Inactive (On Leave / Standby)</option>
              </select>
            </div>

            <div>
              <label htmlFor="worker-tasks" className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                Active Assigned Tasks
              </label>
              <input
                id="worker-tasks"
                name="active_tasks"
                type="number"
                min="0"
                max="50"
                value={formData.active_tasks}
                onChange={(e) => setFormData({ ...formData, active_tasks: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus-ring text-slate-800 transition"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition btn-micro focus-ring"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-primary hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 btn-micro focus-ring"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Register Worker'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerRegistrationForm;
