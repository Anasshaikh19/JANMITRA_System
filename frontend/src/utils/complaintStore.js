/**
 * Central In-Memory & LocalStorage Complaint Repository for JANMITRA
 * Enables seamless reactive synchronization between:
 * - Citizen complaint submission
 * - Field Worker task assignment & execution
 * - Officer Dashboard statistics & priority list
 * - Admin Overview
 */

const STORAGE_KEY = 'janmitra_all_complaints';

const SEED_COMPLAINTS = [
  {
    id: 'CMP-20481',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    ward: 2,
    priority: 'Critical',
    status: 'In-Progress',
    description: 'Deep cave-in and major pothole on 4th Main road crossing near the primary school gate. Water is getting accumulated causing risk to two-wheelers and pedestrians.',
    location_lat: 28.6139,
    location_lng: 77.209,
    created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    assigned_to: 'Suresh Patil',
    worker_id: 'W-01',
    has_photos: true,
    photo_count: 2,
    images: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
    ],
    proof_photos: [],
    days_open: 1,
  },
  {
    id: 'CMP-20482',
    category: 'Garbage & Waste Management',
    dept: 'SWM',
    ward: 2,
    priority: 'High',
    status: 'Assigned',
    description: 'Overflowing commercial waste bin spilling onto pedestrian footpath for the past 48 hours.',
    location_lat: 28.6189,
    location_lng: 77.215,
    created_at: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
    assigned_to: 'Pooja Jadhav',
    worker_id: 'W-SWM-2',
    has_photos: true,
    photo_count: 1,
    images: [],
    proof_photos: [],
    days_open: 2,
  },
  {
    id: 'CMP-20483',
    category: 'Water & Drainage',
    dept: 'WSD',
    ward: 2,
    priority: 'Medium',
    status: 'Work Done',
    description: 'Main water delivery valve leaking clean drinking water on Sector 4 road.',
    location_lat: 28.611,
    location_lng: 77.202,
    created_at: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
    assigned_to: 'Rahul Sawant',
    worker_id: 'W-WSD-2',
    has_photos: true,
    photo_count: 1,
    images: [],
    proof_photos: [
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600&auto=format&fit=crop&q=80',
    ],
    days_open: 3,
  },
  {
    id: 'CMP-20484',
    category: 'Street Lighting & Electrical',
    dept: 'ELEC',
    ward: 2,
    priority: 'Low',
    status: 'Closed',
    description: 'Street light lamp post #14 flickering continuously at night.',
    location_lat: 28.625,
    location_lng: 77.225,
    created_at: new Date(Date.now() - 86400 * 1000 * 5).toISOString(),
    assigned_to: 'Nitin Kadam',
    worker_id: 'W-ELEC-2',
    has_photos: false,
    photo_count: 0,
    images: [],
    proof_photos: [],
    days_open: 5,
  },
  {
    id: 'CMP-20485',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    ward: 1,
    priority: 'Critical',
    status: 'Pending',
    description: 'Open trench on crossroad without barricade or caution signs.',
    location_lat: 28.63,
    location_lng: 77.23,
    created_at: new Date(Date.now() - 86400 * 1000 * 6).toISOString(),
    assigned_to: null,
    worker_id: null,
    has_photos: true,
    photo_count: 1,
    images: [],
    proof_photos: [],
    days_open: 6,
  },
];

// Department category mapping
export const getDeptForCategory = (category) => {
  const norm = String(category || '').toLowerCase();
  if (norm.includes('road') || norm.includes('infra')) return 'PWD';
  if (norm.includes('garb') || norm.includes('waste')) return 'SWM';
  if (norm.includes('water') || norm.includes('drain')) return 'WSD';
  if (norm.includes('light') || norm.includes('electr')) return 'ELEC';
  return 'PWD';
};

// Retrieve all complaints from localStorage
export const getStoredComplaints = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_COMPLAINTS));
      return SEED_COMPLAINTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_COMPLAINTS;
  } catch (err) {
    console.warn('Failed to parse stored complaints:', err);
    return SEED_COMPLAINTS;
  }
};

// Save newly submitted citizen complaint
export const addComplaint = (complaintData) => {
  const list = getStoredComplaints();
  const dept = complaintData.dept || getDeptForCategory(complaintData.category);

  const newRecord = {
    id: complaintData.id || `CMP-${Math.floor(10000 + Math.random() * 90000)}`,
    category: complaintData.category || 'Roads & Infrastructure',
    dept: dept,
    ward: Number(complaintData.ward || 2),
    priority: complaintData.priority || 'High',
    status: complaintData.status || 'Assigned', // Make it directly actionable for workers in demo
    description: complaintData.description || '',
    location_lat: complaintData.location_lat || 28.6139,
    location_lng: complaintData.location_lng || 77.209,
    created_at: new Date().toISOString(),
    assigned_to: complaintData.assigned_to || (dept === 'PWD' ? 'Suresh Patil' : null),
    worker_id: complaintData.worker_id || (dept === 'PWD' ? 'W-01' : null),
    images: complaintData.images || [],
    has_photos: (complaintData.images && complaintData.images.length > 0) || false,
    photo_count: complaintData.images ? complaintData.images.length : 1,
    proof_photos: [],
    days_open: 0,
  };

  const updated = [newRecord, ...list];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
  }
  return newRecord;
};

// Update existing complaint (e.g. status transition, worker assignment, proof photos)
export const updateComplaint = (id, updates) => {
  const list = getStoredComplaints();
  const updated = list.map((item) => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    return item;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed updating complaint in localStorage:', err);
  }
  return updated.find((c) => c.id === id);
};

// Find single complaint
export const getComplaintById = (id) => {
  const list = getStoredComplaints();
  return list.find((c) => String(c.id) === String(id)) || null;
};
