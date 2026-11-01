import React from 'react';

/**
 * Status colours:
 * - Submitted: grey
 * - Validated: blue
 * - Routed: cyan
 * - Assigned: indigo
 * - In-Progress: amber (warning)
 * - Work Done: purple
 * - Closed: green (success)
 * - Rejected / Invalid: red (danger)
 */
const STATUS_STYLES = {
  submitted: 'bg-slate-100 text-slate-700 border-slate-300',
  validated: 'bg-blue-50 text-primary border-blue-200',
  routed: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  assigned: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'in-progress': 'bg-amber-50 text-warning border-amber-200',
  inprogress: 'bg-amber-50 text-warning border-amber-200',
  'in progress': 'bg-amber-50 text-warning border-amber-200',
  'work done': 'bg-purple-50 text-purple border-purple-200',
  'work-done': 'bg-purple-50 text-purple border-purple-200',
  workdone: 'bg-purple-50 text-purple border-purple-200',
  closed: 'bg-emerald-50 text-success border-emerald-200',
  rejected: 'bg-red-50 text-danger border-red-200',
  invalid: 'bg-red-50 text-danger border-red-200',
};

const StatusBadge = ({ status = '' }) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const badgeStyle = STATUS_STYLES[normalizedStatus] || 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}
    >
      {status || 'Unknown'}
    </span>
  );
};

export default StatusBadge;
