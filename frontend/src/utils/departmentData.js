/**
 * Department Data Registry & Helper Functions
 * Provides department-specific configurations, worker rosters, subcategories,
 * and filtering utilities for JANMITRA.
 */

export const DEPARTMENT_CODES = ['PWD', 'SWM', 'PHE', 'ELEC'];

export const DEPARTMENT_INFO = {
  PWD: {
    id: 'PWD',
    code: 'PWD',
    deptId: 1,
    name: 'Public Works Department (PWD)',
    shortName: 'PWD',
    categoryName: 'Roads & Infrastructure',
    icon: '🛣️',
    color: '#1A56DB',
    bgLight: 'bg-blue-50',
    textCol: 'text-blue-700',
    borderCol: 'border-blue-200',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  SWM: {
    id: 'SWM',
    code: 'SWM',
    deptId: 2,
    name: 'Solid Waste Management (SWM)',
    shortName: 'SWM',
    categoryName: 'Garbage & Waste Management',
    icon: '🗑️',
    color: '#0E9F6E',
    bgLight: 'bg-emerald-50',
    textCol: 'text-emerald-700',
    borderCol: 'border-emerald-200',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  PHE: {
    id: 'PHE',
    code: 'PHE',
    deptId: 3,
    name: 'Public Health Engineering (PHE)',
    shortName: 'PHE',
    categoryName: 'Water & Drainage',
    icon: '💧',
    color: '#06B6D4',
    bgLight: 'bg-cyan-50',
    textCol: 'text-cyan-700',
    borderCol: 'border-cyan-200',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  ELEC: {
    id: 'ELEC',
    code: 'ELEC',
    deptId: 4,
    name: 'Street Lighting & Electrical (ELEC)',
    shortName: 'ELEC',
    categoryName: 'Street Lighting & Electrical',
    icon: '💡',
    color: '#EAB308',
    bgLight: 'bg-amber-50',
    textCol: 'text-amber-700',
    borderCol: 'border-amber-200',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

// Department-specific field workers across 4 wards
export const DEPARTMENT_WORKERS = {
  PWD: [
    {
      id: 'W-PWD-01',
      name: 'Suresh Patil',
      dept: 'PWD',
      ward: 1,
      designation: 'Senior Road Inspector',
      status: 'On Duty',
      active_tasks: 4,
      completed_this_week: 12,
      avg_days: '2.4',
      phone: '+91 98765 00101',
      specialization: 'Road Surfacing & Asphalt',
    },
    {
      id: 'W-PWD-02',
      name: 'Ramesh Kumar',
      dept: 'PWD',
      ward: 2,
      designation: 'Heavy Machinery Tech',
      status: 'On Duty',
      active_tasks: 3,
      completed_this_week: 9,
      avg_days: '3.1',
      phone: '+91 98765 00102',
      specialization: 'Heavy Machinery & Trenching',
    },
    {
      id: 'W-PWD-03',
      name: 'Santosh Shinde',
      dept: 'PWD',
      ward: 1,
      designation: 'Asphalt & Patch Specialist',
      status: 'On Duty',
      active_tasks: 1,
      completed_this_week: 14,
      avg_days: '1.9',
      phone: '+91 98765 00103',
      specialization: 'Emergency Cold-Mix Patch',
    },
    {
      id: 'W-PWD-04',
      name: 'Anil Deshmukh',
      dept: 'PWD',
      ward: 3,
      designation: 'Trenching & Excavation Lead',
      status: 'In Field',
      active_tasks: 2,
      completed_this_week: 8,
      avg_days: '3.8',
      phone: '+91 98765 00104',
      specialization: 'Excavation & Culvert Repairs',
    },
    {
      id: 'W-PWD-05',
      name: 'Vinod Thorat',
      dept: 'PWD',
      ward: 2,
      designation: 'Concrete Paver Mason',
      status: 'On Leave',
      active_tasks: 0,
      completed_this_week: 6,
      avg_days: '2.5',
      phone: '+91 98765 00105',
      specialization: 'Footpath & Paver Blocks',
    },
    {
      id: 'W-PWD-06',
      name: 'Manoj Jadhav',
      dept: 'PWD',
      ward: 4,
      designation: 'Road Roller Operator',
      status: 'On Duty',
      active_tasks: 3,
      completed_this_week: 11,
      avg_days: '2.8',
      phone: '+91 98765 00106',
      specialization: 'Bitumen Compaction',
    },
  ],
  SWM: [
    {
      id: 'W-SWM-01',
      name: 'Ganesh Shinde',
      dept: 'SWM',
      ward: 1,
      designation: 'Sanitation Route Inspector',
      status: 'On Duty',
      active_tasks: 3,
      completed_this_week: 22,
      avg_days: '1.4',
      phone: '+91 98765 00201',
      specialization: 'Community Dumpsters & Bins',
    },
    {
      id: 'W-SWM-02',
      name: 'Pooja Jadhav',
      dept: 'SWM',
      ward: 2,
      designation: 'Waste Route Supervisor',
      status: 'In Field',
      active_tasks: 5,
      completed_this_week: 18,
      avg_days: '1.8',
      phone: '+91 98765 00202',
      specialization: 'Door-to-Door Collection Tracking',
    },
    {
      id: 'W-SWM-03',
      name: 'Sachin Kamble',
      dept: 'SWM',
      ward: 3,
      designation: 'Bio-Medical Waste Tech',
      status: 'On Duty',
      active_tasks: 1,
      completed_this_week: 26,
      avg_days: '1.1',
      phone: '+91 98765 00203',
      specialization: 'Commercial & Hazardous Waste',
    },
    {
      id: 'W-SWM-04',
      name: 'Mahesh More',
      dept: 'SWM',
      ward: 4,
      designation: 'Transfer Station Head',
      status: 'On Duty',
      active_tasks: 2,
      completed_this_week: 19,
      avg_days: '1.9',
      phone: '+91 98765 00204',
      specialization: 'Compactor & Dumping Operations',
    },
    {
      id: 'W-SWM-05',
      name: 'Pravin Deshmukh',
      dept: 'SWM',
      ward: 2,
      designation: 'Litter Mitigation Tech',
      status: 'On Duty',
      active_tasks: 4,
      completed_this_week: 15,
      avg_days: '1.6',
      phone: '+91 98765 00205',
      specialization: 'Marketplace Cleanliness Drives',
    },
    {
      id: 'W-SWM-06',
      name: 'Sunita Gaikwad',
      dept: 'SWM',
      ward: 3,
      designation: 'Sanitation Officer',
      status: 'On Leave',
      active_tasks: 0,
      completed_this_week: 14,
      avg_days: '1.7',
      phone: '+91 98765 00206',
      specialization: 'Zone Sweeping Audits',
    },
  ],
  PHE: [
    {
      id: 'W-PHE-01',
      name: 'Deepak Naik',
      dept: 'PHE',
      ward: 1,
      designation: 'Pipeline Maintenance Fitter',
      status: 'On Duty',
      active_tasks: 4,
      completed_this_week: 14,
      avg_days: '2.1',
      phone: '+91 98765 00301',
      specialization: 'Mains Burst & Valve Repairs',
    },
    {
      id: 'W-PHE-02',
      name: 'Rahul Sawant',
      dept: 'PHE',
      ward: 2,
      designation: 'Drainage Jetting Operator',
      status: 'In Field',
      active_tasks: 3,
      completed_this_week: 11,
      avg_days: '2.6',
      phone: '+91 98765 00302',
      specialization: 'Suction Machine & Sewer Jetting',
    },
    {
      id: 'W-PHE-03',
      name: 'Kiran Mane',
      dept: 'PHE',
      ward: 3,
      designation: 'Water Quality Field Tech',
      status: 'On Duty',
      active_tasks: 2,
      completed_this_week: 16,
      avg_days: '1.7',
      phone: '+91 98765 00303',
      specialization: 'Contamination & Chlorine Testing',
    },
    {
      id: 'W-PHE-04',
      name: 'Ajit Pawar',
      dept: 'PHE',
      ward: 4,
      designation: 'Storm Drain Desilting Lead',
      status: 'On Duty',
      active_tasks: 2,
      completed_this_week: 12,
      avg_days: '2.8',
      phone: '+91 98765 00304',
      specialization: 'Culvert & Open Gutter Clearing',
    },
    {
      id: 'W-PHE-05',
      name: 'Sandeep Shinde',
      dept: 'PHE',
      ward: 1,
      designation: 'Booster Pump Operator',
      status: 'On Duty',
      active_tasks: 1,
      completed_this_week: 15,
      avg_days: '1.9',
      phone: '+91 98765 00305',
      specialization: 'Pumping Station Pressure',
    },
    {
      id: 'W-PHE-06',
      name: 'Vivek Kulkarni',
      dept: 'PHE',
      ward: 2,
      designation: 'Underground Sewer Tech',
      status: 'On Leave',
      active_tasks: 0,
      completed_this_week: 8,
      avg_days: '3.0',
      phone: '+91 98765 00306',
      specialization: 'Manhole Rehabilitation',
    },
  ],
  ELEC: [
    {
      id: 'W-ELEC-01',
      name: 'Sunil Gaikwad',
      dept: 'ELEC',
      ward: 1,
      designation: 'High-Voltage Senior Lineman',
      status: 'On Duty',
      active_tasks: 3,
      completed_this_week: 16,
      avg_days: '1.8',
      phone: '+91 98765 00401',
      specialization: 'Feeder Line & Transformer Inspection',
    },
    {
      id: 'W-ELEC-02',
      name: 'Nitin Kadam',
      dept: 'ELEC',
      ward: 2,
      designation: 'LED Streetlight Specialist',
      status: 'On Duty',
      active_tasks: 2,
      completed_this_week: 20,
      avg_days: '1.3',
      phone: '+91 98765 00402',
      specialization: 'Smart Photocell & Lamp Replacement',
    },
    {
      id: 'W-ELEC-03',
      name: 'Pravin Joshi',
      dept: 'ELEC',
      ward: 3,
      designation: 'Hydraulic Bucket Crane Operator',
      status: 'In Field',
      active_tasks: 5,
      completed_this_week: 12,
      avg_days: '2.5',
      phone: '+91 98765 00403',
      specialization: 'High Mast Tower Maintenance',
    },
    {
      id: 'W-ELEC-04',
      name: 'Vikram Salunkhe',
      dept: 'ELEC',
      ward: 4,
      designation: 'Emergency Electrical Cable Tech',
      status: 'On Duty',
      active_tasks: 1,
      completed_this_week: 19,
      avg_days: '1.2',
      phone: '+91 98765 00404',
      specialization: 'Underground Cable Jointing & Sparking',
    },
    {
      id: 'W-ELEC-05',
      name: 'Amit Deshmukh',
      dept: 'ELEC',
      ward: 1,
      designation: 'Pole Stability Inspector',
      status: 'On Duty',
      active_tasks: 2,
      completed_this_week: 14,
      avg_days: '1.9',
      phone: '+91 98765 00405',
      specialization: 'Bent Pole Realignment',
    },
    {
      id: 'W-ELEC-06',
      name: 'Sanjay More',
      dept: 'ELEC',
      ward: 4,
      designation: 'Timer Automation Tech',
      status: 'On Leave',
      active_tasks: 0,
      completed_this_week: 10,
      avg_days: '2.0',
      phone: '+91 98765 00406',
      specialization: 'Clock Switcher Maintenance',
    },
  ],
};

// Department-specific issue subcategories
export const DEPARTMENT_ISSUE_TYPES = {
  PWD: [
    { type: 'Potholes & Road Surface', baseTotal: 78, baseResolved: 52, icon: '🕳️', color: '#1A56DB' },
    { type: 'Footpath & Paver Blocks', baseTotal: 34, baseResolved: 21, icon: '🚶', color: '#2563EB' },
    { type: 'Open Trenches & Excavation', baseTotal: 29, baseResolved: 16, icon: '🚧', color: '#3B82F6' },
    { type: 'Cave-ins & Culvert Repair', baseTotal: 25, baseResolved: 13, icon: '⚠️', color: '#60A5FA' },
    { type: 'Road Dividers & Kerbs', baseTotal: 18, baseResolved: 10, icon: '🛣️', color: '#93C5FD' },
  ],
  SWM: [
    { type: 'Overflowing Bins & Dumpsters', baseTotal: 62, baseResolved: 45, icon: '🗑️', color: '#0E9F6E' },
    { type: 'Door-to-Door Missed Pickup', baseTotal: 31, baseResolved: 24, icon: '🚛', color: '#059669' },
    { type: 'Illegal Waste Dumping', baseTotal: 24, baseResolved: 14, icon: '🚫', color: '#10B981' },
    { type: 'Public Litter on Main Streets', baseTotal: 15, baseResolved: 10, icon: '🧹', color: '#34D399' },
    { type: 'Bio-Medical & Hazardous Waste', baseTotal: 10, baseResolved: 5, icon: '☣️', color: '#6EE7B7' },
  ],
  PHE: [
    { type: 'Mains Pipeline Burst & Leak', baseTotal: 48, baseResolved: 32, icon: '💧', color: '#06B6D4' },
    { type: 'Drain Clog & Sewage Overflow', baseTotal: 28, baseResolved: 18, icon: '🌊', color: '#0891B2' },
    { type: 'Missing / Broken Manholes', baseTotal: 12, baseResolved: 5, icon: '🕳️', color: '#0E7490' },
    { type: 'Contaminated / Muddy Water', baseTotal: 10, baseResolved: 4, icon: '🧪', color: '#22D3EE' },
    { type: 'Low Pressure in Supply Grid', baseTotal: 8, baseResolved: 5, icon: '🚰', color: '#67E8F9' },
  ],
  ELEC: [
    { type: 'Streetlight Dark / Power Off', baseTotal: 36, baseResolved: 28, icon: '💡', color: '#EAB308' },
    { type: 'Damaged / Flickering LED Lamp', baseTotal: 16, baseResolved: 11, icon: '⚡', color: '#CA8A04' },
    { type: 'Bent / Tilting Lighting Pole', baseTotal: 8, baseResolved: 4, icon: '🗼', color: '#A16207' },
    { type: 'Loose Cable / Short Circuit Risk', baseTotal: 6, baseResolved: 3, icon: '⚠️', color: '#FACC15' },
    { type: 'High Mast Tower Timer Fault', baseTotal: 4, baseResolved: 2, icon: '🏢', color: '#FDE047' },
  ],
};

// Department KPI baseline profiles for realistic departmental metrics
export const DEPARTMENT_BASELINES = {
  PWD: {
    total: 184,
    pending: 24,
    in_progress: 48,
    resolved: 112,
    rejected: 8,
    avgDays: '2.8 days',
    slaTarget: '< 4 days',
    severities: [
      { name: 'Critical', value: 18, color: '#EF4444' },
      { name: 'High', value: 38, color: '#F97316' },
      { name: 'Medium', value: 82, color: '#F59E0B' },
      { name: 'Low', value: 46, color: '#94A3B8' },
    ],
  },
  SWM: {
    total: 142,
    pending: 14,
    in_progress: 30,
    resolved: 98,
    rejected: 6,
    avgDays: '1.6 days',
    slaTarget: '< 2 days',
    severities: [
      { name: 'Critical', value: 12, color: '#EF4444' },
      { name: 'High', value: 28, color: '#F97316' },
      { name: 'Medium', value: 68, color: '#F59E0B' },
      { name: 'Low', value: 34, color: '#94A3B8' },
    ],
  },
  PHE: {
    total: 96,
    pending: 16,
    in_progress: 26,
    resolved: 54,
    rejected: 4,
    avgDays: '2.2 days',
    slaTarget: '< 3 days',
    severities: [
      { name: 'Critical', value: 14, color: '#EF4444' },
      { name: 'High', value: 22, color: '#F97316' },
      { name: 'Medium', value: 44, color: '#F59E0B' },
      { name: 'Low', value: 16, color: '#94A3B8' },
    ],
  },
  ELEC: {
    total: 64,
    pending: 8,
    in_progress: 10,
    resolved: 46,
    rejected: 2,
    avgDays: '1.4 days',
    slaTarget: '< 2 days',
    severities: [
      { name: 'Critical', value: 6, color: '#EF4444' },
      { name: 'High', value: 12, color: '#F97316' },
      { name: 'Medium', value: 32, color: '#F59E0B' },
      { name: 'Low', value: 14, color: '#94A3B8' },
    ],
  },
};

/**
 * Resolve an officer's canonical department code: 'PWD', 'SWM', 'PHE', 'ELEC'
 */
export const resolveOfficerDeptCode = (user) => {
  if (!user) return 'PWD';

  if (user.dept_code) {
    const c = String(user.dept_code).toUpperCase().trim();
    if (DEPARTMENT_CODES.includes(c)) return c;
    if (c === 'WSD') return 'PHE';
  }

  const deptId = user.department_id || (user.department && typeof user.department === 'object' ? user.department.id : null);
  if (deptId === 1 || deptId === '1') return 'PWD';
  if (deptId === 2 || deptId === '2') return 'SWM';
  if (deptId === 3 || deptId === '3') return 'PHE';
  if (deptId === 4 || deptId === '4') return 'ELEC';

  const raw = String(user.department_name || user.department || user.dept || '').toUpperCase();
  if (raw === '2' || raw.includes('SOLID') || raw.includes('SWM') || raw.includes('GARBAGE')) return 'SWM';
  if (raw === '3' || raw.includes('WATER') || raw.includes('DRAIN') || raw.includes('PHE') || raw.includes('WSD') || raw.includes('HEALTH')) return 'PHE';
  if (raw === '4' || raw.includes('LIGHT') || raw.includes('ELECTR') || raw.includes('ELEC') || raw.includes('POWER')) return 'ELEC';
  return 'PWD';
};

/**
 * Check if a complaint belongs to the given department code
 */
export const matchesDepartment = (complaint, deptCode) => {
  if (!complaint || !deptCode) return true;
  const targetCode = String(deptCode).toUpperCase().trim();

  // 1. Check explicit complaint.dept or complaint.department
  const cDept = String(complaint.dept || complaint.department || complaint.dept_code || '').toUpperCase().trim();
  if (cDept === targetCode) return true;
  if (targetCode === 'PHE' && (cDept === 'WSD' || cDept === 'WATER')) return true;
  if (targetCode === 'PWD' && cDept === 'ROADS') return true;
  if (targetCode === 'SWM' && cDept === 'GARBAGE') return true;
  if (targetCode === 'ELEC' && cDept === 'LIGHTING') return true;

  // 2. Check numerical department_id
  const targetId = DEPARTMENT_INFO[targetCode]?.deptId;
  if (complaint.department_id && Number(complaint.department_id) === Number(targetId)) {
    return true;
  }

  // 3. Fallback matching on category or title
  const text = `${complaint.category || ''} ${complaint.title || ''} ${complaint.description || ''}`.toLowerCase();
  if (targetCode === 'PWD') {
    return text.includes('road') || text.includes('infra') || text.includes('pothole') || text.includes('footpath') || text.includes('asphalt') || text.includes('trench') || text.includes('bridge') || text.includes('divider');
  }
  if (targetCode === 'SWM') {
    return text.includes('garb') || text.includes('waste') || text.includes('dump') || text.includes('bin') || text.includes('litter') || text.includes('sanitat');
  }
  if (targetCode === 'PHE') {
    return text.includes('water') || text.includes('drain') || text.includes('sew') || text.includes('pipe') || text.includes('leak') || text.includes('manhole') || text.includes('gutter');
  }
  if (targetCode === 'ELEC') {
    return text.includes('light') || text.includes('electr') || text.includes('lamp') || text.includes('pole') || text.includes('wire') || text.includes('cable') || text.includes('mast');
  }

  return false;
};
