/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/components/Badges.jsx
 * Author: Team ResolveIT
 * Description: Reusable Tailwind badges for Categories, Priorities, Wards & Statuses.
 * ==============================================================================
 */

import React from 'react';

/**
 * 4 Categories in JANMITRA
 */
export const CategoryBadge = ({ category }) => {
  const cat = (category || '').toLowerCase();

  if (cat.includes('road')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <span>🚧</span> Roads & Infra
      </span>
    );
  }
  if (cat.includes('garbage') || cat.includes('waste')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <span>🗑️</span> Garbage & Waste
      </span>
    );
  }
  if (cat.includes('water') || cat.includes('drain')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        <span>🚰</span> Water & Drainage
      </span>
    );
  }
  if (cat.includes('light') || cat.includes('electric') || cat.includes('street')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
        <span>💡</span> Street Lighting
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
      <span>📌</span> {category || 'General'}
    </span>
  );
};

/**
 * Priority Badge (High, Medium, Low, Critical)
 */
export const PriorityBadge = ({ priority }) => {
  const p = (priority || 'medium').toLowerCase();

  if (p === 'critical' || p === 'urgent') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider">
        Critical
      </span>
    );
  }
  if (p === 'high') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase tracking-wider">
        High
      </span>
    );
  }
  if (p === 'medium') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
      Low
    </span>
  );
};

/**
 * Ward Badge (Ward 1 - Ward 4)
 */
export const WardBadge = ({ ward }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
      <span>📍</span> {ward || 'Ward 1'}
    </span>
  );
};

/**
 * Status Badge for Complaint Lifecycle
 */
export const StatusBadge = ({ status }) => {
  const s = (status || 'submitted').toLowerCase().replace('_', '-');

  switch (s) {
    case 'work-done':
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
          <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> Work Done
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Closed
        </span>
      );
    case 'in-progress':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span> In Progress
        </span>
      );
    case 'assigned':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span> Assigned
        </span>
      );
    case 'routed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span> Routed
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Rejected
        </span>
      );
    case 'submitted':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Submitted
        </span>
      );
  }
};
