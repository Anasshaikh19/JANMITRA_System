import React from 'react';

/**
 * Categories:
 * - Roads & Infrastructure: road icon 🛣️, amber colour
 * - Garbage & Waste Management: trash icon 🗑️, green colour
 * - Water & Drainage: droplet icon 💧, blue colour
 * - Street Lighting & Electrical: lightbulb icon 💡, yellow colour
 */
const CATEGORY_MAP = {
  roads: {
    icon: '🛣️',
    label: 'Roads & Infrastructure',
    style: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  garbage: {
    icon: '🗑️',
    label: 'Garbage & Waste Management',
    style: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  water: {
    icon: '💧',
    label: 'Water & Drainage',
    style: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  lighting: {
    icon: '💡',
    label: 'Street Lighting & Electrical',
    style: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  },
};

const getCategoryConfig = (category = '') => {
  const normalized = String(category || '').toLowerCase();

  if (normalized.includes('road') || normalized.includes('infra')) {
    return CATEGORY_MAP.roads;
  }
  if (normalized.includes('garb') || normalized.includes('waste')) {
    return CATEGORY_MAP.garbage;
  }
  if (normalized.includes('water') || normalized.includes('drain')) {
    return CATEGORY_MAP.water;
  }
  if (normalized.includes('light') || normalized.includes('electr')) {
    return CATEGORY_MAP.lighting;
  }

  return {
    icon: '📌',
    label: category || 'General',
    style: 'bg-slate-50 text-slate-700 border-slate-200',
  };
};

const CategoryBadge = ({ category = '' }) => {
  const config = getCategoryConfig(category);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${config.style}`}
    >
      <span aria-hidden="true" className="text-sm leading-none">{config.icon}</span>
      <span>{category || config.label}</span>
    </span>
  );
};

export default CategoryBadge;
