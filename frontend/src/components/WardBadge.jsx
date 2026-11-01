import React from 'react';

/**
 * WardBadge:
 * Shows 'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4'
 * Small pill with dark blue background.
 * Props: ward (number or string)
 */
const WardBadge = ({ ward = '' }) => {
  const formattedWard = String(ward).toLowerCase().startsWith('ward')
    ? ward
    : `Ward ${ward}`;

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-dark text-white shadow-sm">
      {formattedWard}
    </span>
  );
};

export default WardBadge;
