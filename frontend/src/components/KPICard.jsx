import React from 'react';

/**
 * KPICard:
 * Props:
 * - title: string
 * - value: string | number
 * - subtitle?: string
 * - colour: 'blue' | 'green' | 'amber' | 'red' | 'purple'
 *
 * Shows: coloured left border, big number, title, optional subtitle
 */
const BORDER_COLOUR_MAP = {
  blue: 'border-l-primary text-primary',
  green: 'border-l-success text-success',
  amber: 'border-l-warning text-warning',
  red: 'border-l-danger text-danger',
  purple: 'border-l-purple text-purple',
};

const KPICard = ({ title, value, subtitle, colour = 'blue' }) => {
  const selectedTheme = BORDER_COLOUR_MAP[colour] || BORDER_COLOUR_MAP.blue;
  const borderClass = selectedTheme.split(' ')[0];
  const accentTextClass = selectedTheme.split(' ')[1];

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-slate-200 border-l-4 ${borderClass} p-5 transition-shadow hover:shadow-md`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-extrabold ${accentTextClass}`}>{value}</span>
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{subtitle}</p>
      )}
    </div>
  );
};

export default KPICard;
