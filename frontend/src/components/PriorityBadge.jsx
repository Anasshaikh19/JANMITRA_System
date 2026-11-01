import React from 'react';

/**
 * Priority colours:
 * - Critical: red with pulsing animation
 * - High: orange
 * - Medium: amber
 * - Low: grey
 */
const PriorityBadge = ({ level = '' }) => {
  const normalizedLevel = String(level || '').trim().toLowerCase();

  switch (normalizedLevel) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-danger border border-red-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </span>
          {level || 'Critical'}
        </span>
      );

    case 'high':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300">
          {level || 'High'}
        </span>
      );

    case 'medium':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-warning border border-amber-300">
          {level || 'Medium'}
        </span>
      );

    case 'low':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
          {level || 'Low'}
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
          {level || 'Normal'}
        </span>
      );
  }
};

export default PriorityBadge;
