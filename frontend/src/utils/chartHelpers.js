/**
 * Chart and Visual Data Formatting Helpers for JANMITRA
 * Provides standardized labeling, department mappings, and relative date calculation
 * across officer, worker, and admin portals.
 */

// 1. Status label formatter
export const formatStatusLabel = (status) => {
  if (!status) return 'Unknown';
  const clean = String(status).trim();
  const map = {
    submitted: 'Submitted',
    validated: 'Validated',
    routed: 'Routed',
    assigned: 'Assigned',
    'in-progress': 'In-Progress',
    inprogress: 'In-Progress',
    'in progress': 'In-Progress',
    'work done': 'Work Done',
    'work-done': 'Work Done',
    workdone: 'Work Done',
    closed: 'Closed',
    resolved: 'Resolved',
    rejected: 'Rejected',
    invalid: 'Invalid',
  };
  return map[clean.toLowerCase()] || clean;
};

// 2. Priority color returning Tailwind classes
export const formatPriorityColour = (level) => {
  if (!level) return 'text-slate-600 bg-slate-100 border-slate-300';
  const norm = String(level).trim().toLowerCase();
  switch (norm) {
    case 'critical':
      return 'text-danger bg-red-100 border-red-300';
    case 'high':
      return 'text-orange-700 bg-orange-100 border-orange-300';
    case 'medium':
      return 'text-warning bg-amber-100 border-amber-300';
    case 'low':
      return 'text-slate-700 bg-slate-100 border-slate-300';
    default:
      return 'text-slate-700 bg-slate-100 border-slate-300';
  }
};

// 3. Full department name formatter (handles IDs 1, 2, 3, 4, codes PWD/SWM/PHE/ELEC, and custom strings)
export const formatDeptName = (id) => {
  if (!id && id !== 0) return 'Public Works Department (PWD)';
  const str = String(id).trim();
  const norm = str.toUpperCase();

  const deptMap = {
    '1': 'Public Works Department (PWD)',
    '2': 'Solid Waste Management (SWM)',
    '3': 'Public Health Engineering (PHE)',
    '4': 'Street Lighting & Electrical (ELEC)',
    PWD: 'Public Works Department (PWD)',
    SWM: 'Solid Waste Management (SWM)',
    PHE: 'Public Health Engineering (PHE)',
    WSD: 'Public Health Engineering (PHE)',
    ELEC: 'Street Lighting & Electrical (ELEC)',
    ROADS: 'Public Works Department (PWD)',
    GARBAGE: 'Solid Waste Management (SWM)',
    WATER: 'Public Health Engineering (PHE)',
    LIGHTING: 'Street Lighting & Electrical (ELEC)',
  };

  if (deptMap[norm]) return deptMap[norm];
  if (deptMap[str]) return deptMap[str];

  if (norm.includes('PUBLIC WORKS') || norm.includes('PWD') || norm.includes('ROAD')) {
    return 'Public Works Department (PWD)';
  }
  if (norm.includes('SOLID') || norm.includes('WASTE') || norm.includes('SWM') || norm.includes('GARBAGE')) {
    return 'Solid Waste Management (SWM)';
  }
  if (norm.includes('HEALTH') || norm.includes('PHE') || norm.includes('WATER') || norm.includes('DRAIN') || norm.includes('WSD')) {
    return 'Public Health Engineering (PHE)';
  }
  if (norm.includes('LIGHT') || norm.includes('ELECTRICAL') || norm.includes('ELEC') || norm.includes('POWER')) {
    return 'Street Lighting & Electrical (ELEC)';
  }

  // If already a long descriptive string, return it
  if (str.length > 5 && !/^\d+$/.test(str)) {
    return str;
  }

  return 'Public Works Department (PWD)';
};

// 4. Ward name formatter ('Ward X')
export const formatWardName = (id) => {
  if (!id) return 'Ward 1';
  const str = String(id).trim();
  if (str.toLowerCase().startsWith('ward')) {
    return str;
  }
  return `Ward ${str}`;
};

// 5. Date formatter: formats ISO date to '3 days ago' or '12 Sep 2026'
export const formatDate = (dateStr, fallbackToAbsolute = false) => {
  if (!dateStr) return 'Recently';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 86400 * 7 && !fallbackToAbsolute) {
    const days = Math.floor(diffInSeconds / 86400);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }

  // Format as absolute: '12 Sep 2026'
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default {
  formatStatusLabel,
  formatPriorityColour,
  formatDeptName,
  formatWardName,
  formatDate,
};
