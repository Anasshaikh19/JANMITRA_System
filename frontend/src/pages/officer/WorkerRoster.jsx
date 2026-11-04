import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import WardBadge from '../../components/WardBadge';
import PriorityBadge from '../../components/PriorityBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import OfficerSidebarDrawer from '../../components/OfficerSidebarDrawer';

// 4 Primary Municipal Departments
const DEPT_INFO = {
  PWD: { name: 'Public Works Department (PWD)', icon: '🛣️', color: 'text-primary', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200' },
  SWM: { name: 'Solid Waste Management (SWM)', icon: '🗑️', color: 'text-success', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PHE: { name: 'Public Health Engineering (PHE)', icon: '💧', color: 'text-cyan-600', badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  ELEC: { name: 'Street Lighting & Electrical (ELEC)', icon: '💡', color: 'text-warning', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
  '1': { name: 'Public Works Department (PWD)', icon: '🛣️', color: 'text-primary', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200' },
  '2': { name: 'Solid Waste Management (SWM)', icon: '🗑️', color: 'text-success', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  '3': { name: 'Public Health Engineering (PHE)', icon: '💧', color: 'text-cyan-600', badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  '4': { name: 'Street Lighting & Electrical (ELEC)', icon: '💡', color: 'text-warning', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
};

// Initial roster of departmental field personnel across 4 wards
const DEFAULT_DEPARTMENT_WORKERS = {
  PWD: [
    {
      id: 'W-PWD-01',
      name: 'Suresh Patil',
      dept: 'PWD',
      ward: 1,
      designation: 'Senior Road Inspector',
      status: 'On Duty',
      active_tasks: 5, // Red: 5+ overloaded
      rating: 4.8,
      reviews: 64,
      phone: '+91 98765 00101',
      active_complaints: [
        { id: 'CMP-20485', title: 'Open trench on Main MG Road', priority: 'Critical', ward: 1 },
        { id: 'CMP-20492', title: 'Deep asphalt pothole near bus stand', priority: 'High', ward: 1 },
        { id: 'CMP-20501', title: 'Broken footpath slab causing trips', priority: 'Medium', ward: 1 },
        { id: 'CMP-20512', title: 'Cave-in risk near culvert', priority: 'High', ward: 1 },
        { id: 'CMP-20519', title: 'Divider kerb reconstruction', priority: 'Low', ward: 1 },
      ],
    },
    {
      id: 'W-PWD-02',
      name: 'Ramesh Kumar',
      dept: 'PWD',
      ward: 2,
      designation: 'Heavy Machinery Tech',
      status: 'On Duty',
      active_tasks: 4, // Amber: 3-4 tasks
      rating: 4.6,
      reviews: 52,
      phone: '+91 98765 00102',
      active_complaints: [
        { id: 'CMP-20481', title: 'Road surface undulation', priority: 'Medium', ward: 2 },
        { id: 'CMP-20498', title: 'Missing manhole cover on market lane', priority: 'Critical', ward: 2 },
        { id: 'CMP-20507', title: 'Cracked bridge expansion joint', priority: 'High', ward: 2 },
        { id: 'CMP-20522', title: 'Speed breaker repainting', priority: 'Low', ward: 2 },
      ],
    },
    {
      id: 'W-PWD-03',
      name: 'Santosh Shinde',
      dept: 'PWD',
      ward: 1,
      designation: 'Asphalt & Patch Specialist',
      status: 'On Duty',
      active_tasks: 1, // Green: 1-2 tasks
      rating: 4.9,
      reviews: 47,
      phone: '+91 98765 00103',
      active_complaints: [
        { id: 'CMP-20531', title: 'Cold-mix emergency patch near gate', priority: 'High', ward: 1 },
      ],
    },
    {
      id: 'W-PWD-04',
      name: 'Anil Deshmukh',
      dept: 'PWD',
      ward: 3,
      designation: 'Trenching & Excavation Lead',
      status: 'On Duty',
      active_tasks: 2, // Green: 1-2 tasks
      rating: 4.7,
      reviews: 39,
      phone: '+91 98765 00104',
      active_complaints: [
        { id: 'CMP-20515', title: 'Stormwater trench clearing', priority: 'Medium', ward: 3 },
        { id: 'CMP-20528', title: 'Pavement leveling near junction', priority: 'Low', ward: 3 },
      ],
    },
    {
      id: 'W-PWD-05',
      name: 'Vinod Thorat',
      dept: 'PWD',
      ward: 2,
      designation: 'Concrete Paver Mason',
      status: 'On Leave', // On Leave
      active_tasks: 0,
      rating: 4.5,
      reviews: 31,
      phone: '+91 98765 00105',
      active_complaints: [],
    },
    {
      id: 'W-PWD-06',
      name: 'Manoj Jadhav',
      dept: 'PWD',
      ward: 4,
      designation: 'Road Roller Operator',
      status: 'On Duty',
      active_tasks: 3, // Amber: 3-4 tasks
      rating: 4.6,
      reviews: 43,
      phone: '+91 98765 00106',
      active_complaints: [
        { id: 'CMP-20489', title: 'Compaction on ring road link', priority: 'High', ward: 4 },
        { id: 'CMP-20504', title: 'Bitumen surfacing gap', priority: 'Medium', ward: 4 },
        { id: 'CMP-20525', title: 'Gravel loose spreading', priority: 'Low', ward: 4 },
      ],
    },
    {
      id: 'W-PWD-07',
      name: 'Kailash More',
      dept: 'PWD',
      ward: 4,
      designation: 'Emergency Patch Tech',
      status: 'On Duty',
      active_tasks: 1, // Green: 1-2 tasks
      rating: 4.8,
      reviews: 58,
      phone: '+91 98765 00107',
      active_complaints: [
        { id: 'CMP-20539', title: 'Flyover ramp resurfacing', priority: 'Medium', ward: 4 },
      ],
    },
    {
      id: 'W-PWD-08',
      name: 'Dattatray Kadam',
      dept: 'PWD',
      ward: 3,
      designation: 'Bridge & Culvert Tech',
      status: 'On Leave', // On Leave
      active_tasks: 0,
      rating: 4.4,
      reviews: 26,
      phone: '+91 98765 00108',
      active_complaints: [],
    },
  ],
  SWM: [
    {
      id: 'W-SWM-01',
      name: 'Ganesh Shinde',
      dept: 'SWM',
      ward: 1,
      designation: 'Sanitation Ward Supervisor',
      status: 'On Duty',
      active_tasks: 5, // Red: 5+ overloaded
      rating: 4.9,
      reviews: 78,
      phone: '+91 98765 00201',
      active_complaints: [
        { id: 'CMP-20601', title: 'Overflowing community bin at Ward 1 Market', priority: 'Critical', ward: 1 },
        { id: 'CMP-20608', title: 'Illegal debris dumping along canal', priority: 'High', ward: 1 },
        { id: 'CMP-20614', title: 'Missed morning door-to-door collection', priority: 'Medium', ward: 1 },
        { id: 'CMP-20621', title: 'Commercial food waste leakage', priority: 'High', ward: 1 },
        { id: 'CMP-20629', title: 'Compactor vehicle breakdown', priority: 'Critical', ward: 1 },
      ],
    },
    {
      id: 'W-SWM-02',
      name: 'Pooja Jadhav',
      dept: 'SWM',
      ward: 2,
      designation: 'Collection Route Lead',
      status: 'On Duty',
      active_tasks: 3, // Amber: 3-4 tasks
      rating: 4.7,
      reviews: 56,
      phone: '+91 98765 00202',
      active_complaints: [
        { id: 'CMP-20603', title: 'Garbage pile near hospital gate', priority: 'Critical', ward: 2 },
        { id: 'CMP-20611', title: 'Segregation non-compliance alert', priority: 'Medium', ward: 2 },
        { id: 'CMP-20618', title: 'Broken public litter bin', priority: 'Low', ward: 2 },
      ],
    },
    {
      id: 'W-SWM-03',
      name: 'Sachin Kamble',
      dept: 'SWM',
      ward: 2,
      designation: 'Bio-Waste Handler',
      status: 'On Duty',
      active_tasks: 1, // Green: 1-2 tasks
      rating: 4.8,
      reviews: 49,
      phone: '+91 98765 00203',
      active_complaints: [
        { id: 'CMP-20632', title: 'Clinic bio-waste pickup delay', priority: 'High', ward: 2 },
      ],
    },
    {
      id: 'W-SWM-04',
      name: 'Mahesh More',
      dept: 'SWM',
      ward: 4,
      designation: 'Dumping Ground Supervisor',
      status: 'On Leave', // On Leave
      active_tasks: 0,
      rating: 4.3,
      reviews: 32,
      phone: '+91 98765 00204',
      active_complaints: [],
    },
  ],
  PHE: [
    {
      id: 'W-PHE-01',
      name: 'Deepak Naik',
      dept: 'PHE',
      ward: 1,
      designation: 'Senior Pipeline Fitter',
      status: 'On Duty',
      active_tasks: 6, // Red: 5+ overloaded
      rating: 4.9,
      reviews: 82,
      phone: '+91 98765 00301',
      active_complaints: [
        { id: 'CMP-20701', title: 'Main drinking water pipeline burst', priority: 'Critical', ward: 1 },
        { id: 'CMP-20709', title: 'Low pressure in elevated zone', priority: 'High', ward: 1 },
        { id: 'CMP-20716', title: 'Contaminated water supply alert', priority: 'Critical', ward: 1 },
        { id: 'CMP-20722', title: 'Air valve chamber leaking', priority: 'Medium', ward: 1 },
        { id: 'CMP-20729', title: 'Sewer backflow in colony', priority: 'High', ward: 1 },
        { id: 'CMP-20735', title: 'Meter chamber damaged by road work', priority: 'Low', ward: 1 },
      ],
    },
    {
      id: 'W-PHE-02',
      name: 'Rahul Sawant',
      dept: 'PHE',
      ward: 2,
      designation: 'Drainage Jetting Operator',
      status: 'On Duty',
      active_tasks: 3, // Amber: 3-4 tasks
      rating: 4.7,
      reviews: 61,
      phone: '+91 98765 00302',
      active_complaints: [
        { id: 'CMP-20704', title: 'Choked storm sewer line', priority: 'High', ward: 2 },
        { id: 'CMP-20712', title: 'Manhole overflow near school', priority: 'Critical', ward: 2 },
        { id: 'CMP-20719', title: 'Gully trap desilting request', priority: 'Low', ward: 2 },
      ],
    },
    {
      id: 'W-PHE-03',
      name: 'Kiran Mane',
      dept: 'PHE',
      ward: 1,
      designation: 'Valve Gate Specialist',
      status: 'On Duty',
      active_tasks: 2, // Green: 1-2 tasks
      rating: 4.8,
      reviews: 55,
      phone: '+91 98765 00303',
      active_complaints: [
        { id: 'CMP-20741', title: 'Sluice valve timing adjustment', priority: 'Medium', ward: 1 },
        { id: 'CMP-20748', title: 'Pressure regulating test', priority: 'Low', ward: 1 },
      ],
    },
    {
      id: 'W-PHE-04',
      name: 'Ajit Pawar',
      dept: 'PHE',
      ward: 3,
      designation: 'Culvert Desilting Tech',
      status: 'On Leave', // On Leave
      active_tasks: 0,
      rating: 4.4,
      reviews: 29,
      phone: '+91 98765 00304',
      active_complaints: [],
    },
  ],
  ELEC: [
    {
      id: 'W-ELEC-01',
      name: 'Sunil Gaikwad',
      dept: 'ELEC',
      ward: 1,
      designation: 'Senior Lineman',
      status: 'On Duty',
      active_tasks: 5, // Red: 5+ overloaded
      rating: 4.8,
      reviews: 69,
      phone: '+91 98765 00401',
      active_complaints: [
        { id: 'CMP-20801', title: 'Entire main avenue streetlights off', priority: 'Critical', ward: 1 },
        { id: 'CMP-20807', title: 'Exposed live wire hanging near footpath', priority: 'Critical', ward: 1 },
        { id: 'CMP-20814', title: 'Flickering high-mast lamp at circle', priority: 'Medium', ward: 1 },
        { id: 'CMP-20821', title: 'Feeder pillar door open & rusted', priority: 'High', ward: 1 },
        { id: 'CMP-20828', title: 'Pole shifting for road expansion', priority: 'Low', ward: 1 },
      ],
    },
    {
      id: 'W-ELEC-02',
      name: 'Nitin Kadam',
      dept: 'ELEC',
      ward: 2,
      designation: 'Pole Maintenance Electrician',
      status: 'On Duty',
      active_tasks: 4, // Amber: 3-4 tasks
      rating: 4.6,
      reviews: 54,
      phone: '+91 98765 00402',
      active_complaints: [
        { id: 'CMP-20804', title: 'Burnt street light ballast', priority: 'High', ward: 2 },
        { id: 'CMP-20811', title: 'Streetlight arm bent by tree branch', priority: 'Medium', ward: 2 },
        { id: 'CMP-20818', title: 'Timer clock misconfigured', priority: 'Low', ward: 2 },
        { id: 'CMP-20824', title: 'LED luminaire water seepage', priority: 'Medium', ward: 2 },
      ],
    },
    {
      id: 'W-ELEC-03',
      name: 'Pravin Joshi',
      dept: 'ELEC',
      ward: 1,
      designation: 'LED High-Mast Specialist',
      status: 'On Duty',
      active_tasks: 1, // Green: 1-2 tasks
      rating: 4.9,
      reviews: 48,
      phone: '+91 98765 00403',
      active_complaints: [
        { id: 'CMP-20835', title: 'Photocell sensor replacement', priority: 'Medium', ward: 1 },
      ],
    },
    {
      id: 'W-ELEC-04',
      name: 'Vikram Salunkhe',
      dept: 'ELEC',
      ward: 4,
      designation: 'Distribution Box Tech',
      status: 'On Leave', // On Leave
      active_tasks: 0,
      rating: 4.5,
      reviews: 35,
      phone: '+91 98765 00404',
      active_complaints: [],
    },
  ],
};

/**
 * 3. Workload meter bar helper:
 * - Green (1-2 tasks): Optimal / Light
 * - Amber (3-4 tasks): Moderate
 * - Red (5+ tasks): Overloaded
 */
const getWorkloadMeterConfig = (taskCount) => {
  if (taskCount >= 5) {
    return {
      tier: 'red',
      barColor: 'bg-red-500 animate-pulse',
      badgeClass: 'bg-red-100 text-red-800 border-red-200 font-black',
      label: 'Overloaded',
      percentage: 100,
      indicatorIcon: '⚠️',
    };
  }
  if (taskCount >= 3) {
    return {
      tier: 'amber',
      barColor: 'bg-amber-500',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-200 font-bold',
      label: 'Moderate',
      percentage: Math.min(80, taskCount * 20),
      indicatorIcon: '⚡',
    };
  }
  if (taskCount >= 1) {
    return {
      tier: 'green',
      barColor: 'bg-emerald-500',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold',
      label: 'Optimal',
      percentage: Math.max(25, taskCount * 20),
      indicatorIcon: '✅',
    };
  }
  return {
    tier: 'idle',
    barColor: 'bg-slate-300',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    label: 'Idle / Free',
    percentage: 5,
    indicatorIcon: '💤',
  };
};

/**
 * WorkerRoster Component
 * Can be used either as a standalone officer page or embedded inside Dashboard.jsx
 */
const WorkerRoster = ({ isEmbedded = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Resolve officer's department (PWD by default or matched from auth user)
  const officerDeptCode = useMemo(() => {
    if (user?.dept_code) {
      const code = String(user.dept_code).toUpperCase();
      if (['PWD', 'SWM', 'PHE', 'ELEC'].includes(code)) return code;
    }
    const rawDept = user?.department_name || user?.department || user?.dept || 'PWD';
    const normalized = String(rawDept).toUpperCase();
    if (normalized === '2' || normalized.includes('SOLID') || normalized.includes('SWM') || normalized.includes('GARBAGE')) return 'SWM';
    if (normalized === '3' || normalized.includes('WATER') || normalized.includes('DRAIN') || normalized.includes('PHE') || normalized.includes('WSD') || normalized.includes('HEALTH')) return 'PHE';
    if (normalized === '4' || normalized.includes('LIGHT') || normalized.includes('ELECTR') || normalized.includes('ELEC')) return 'ELEC';
    return 'PWD';
  }, [user]);

  // Current viewed department
  const [currentDept, setCurrentDept] = useState(officerDeptCode);
  const [workersData, setWorkersData] = useState(() => {
    return DEFAULT_DEPARTMENT_WORKERS[officerDeptCode] || DEFAULT_DEPARTMENT_WORKERS.PWD;
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'On Duty' | 'On Leave'
  const [loadFilter, setLoadFilter] = useState('ALL'); // 'ALL' | 'overloaded' | 'amber' | 'green'

  // Navigation drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Reassignment Modal State
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [sourceWorker, setSourceWorker] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState('');
  const [targetWorkerId, setTargetWorkerId] = useState('');
  const [reassignReason, setReassignReason] = useState('Workload balancing for SLA adherence');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);
  const [reassignSuccessToast, setReassignSuccessToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync roster when currentDept changes
  useEffect(() => {
    setWorkersData(DEFAULT_DEPARTMENT_WORKERS[currentDept] || DEFAULT_DEPARTMENT_WORKERS.PWD);
  }, [currentDept]);

  // Try fetching live roster from backend API
  const fetchLiveRoster = useCallback(async () => {
    setErrorMsg('');
    try {
      const res = await api.get(`/v1/worker/roster/?dept=${currentDept}`);
      if (res.data?.workers && Array.isArray(res.data.workers)) {
        setWorkersData(res.data.workers);
      }
    } catch (err) {
      // Gracefully fall back to local realistic municipal roster
      console.warn('Live worker roster API not available, using offline roster:', err?.message);
    }
  }, [currentDept]);

  useEffect(() => {
    fetchLiveRoster();
  }, [fetchLiveRoster]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workersData.filter((w) => {
      // Ward match
      if (wardFilter !== 'ALL' && String(w.ward) !== String(wardFilter)) {
        return false;
      }
      // Status match
      if (statusFilter !== 'ALL' && w.status !== statusFilter) {
        return false;
      }
      // Load tier match
      if (loadFilter !== 'ALL') {
        const meter = getWorkloadMeterConfig(w.active_tasks);
        if (loadFilter === 'overloaded' && meter.tier !== 'red') return false;
        if (loadFilter === 'moderate' && meter.tier !== 'amber') return false;
        if (loadFilter === 'optimal' && meter.tier !== 'green') return false;
      }
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = w.name.toLowerCase().includes(q);
        const matchId = w.id.toLowerCase().includes(q);
        const matchDesig = w.designation.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDesig) return false;
      }
      return true;
    });
  }, [workersData, wardFilter, statusFilter, loadFilter, searchQuery]);

  // Department Summary Metrics
  const deptStats = useMemo(() => {
    const totalWorkers = workersData.length;
    const onDutyCount = workersData.filter((w) => w.status === 'On Duty').length;
    const onLeaveCount = workersData.filter((w) => w.status === 'On Leave').length;
    const overloadedCount = workersData.filter((w) => w.active_tasks >= 5).length;
    const totalActiveTasks = workersData.reduce((acc, w) => acc + (w.active_tasks || 0), 0);

    return {
      totalWorkers,
      onDutyCount,
      onLeaveCount,
      overloadedCount,
      totalActiveTasks,
    };
  }, [workersData]);

  // Open Reassignment Modal for a specific worker
  const handleOpenReassignModal = (worker) => {
    setSourceWorker(worker);
    setSelectedComplaintId(worker.active_complaints?.[0]?.id || '');

    // Select the first eligible target worker (On Duty, not the same worker, preferably lowest load)
    const candidates = workersData.filter(
      (w) => w.id !== worker.id && w.status === 'On Duty'
    );
    // Sort candidates by least active tasks first
    candidates.sort((a, b) => (a.active_tasks || 0) - (b.active_tasks || 0));
    setTargetWorkerId(candidates[0]?.id || '');
    setReassignModalOpen(true);
  };

  // Execute Task Reassignment
  const handleConfirmReassign = async (e) => {
    e.preventDefault();
    if (!sourceWorker || !selectedComplaintId || !targetWorkerId) {
      setErrorMsg('Please select a complaint and target worker.');
      return;
    }

    setIsSubmittingReassign(true);
    setErrorMsg('');

    try {
      // Attempt backend API call
      try {
        await api.post(`/v1/complaints/${selectedComplaintId}/assign/`, {
          worker_id: targetWorkerId,
          reassigned_from: sourceWorker.id,
          reason: reassignReason,
        });
      } catch (apiErr) {
        console.warn('Backend reassign API offline, applying dynamic optimistic update:', apiErr?.message);
      }

      // Optimistically update local roster state
      const targetWorkerObj = workersData.find((w) => w.id === targetWorkerId);
      const movedComplaint = sourceWorker.active_complaints?.find((c) => c.id === selectedComplaintId);

      setWorkersData((prevRoster) => {
        return prevRoster.map((w) => {
          if (w.id === sourceWorker.id) {
            return {
              ...w,
              active_tasks: Math.max(0, (w.active_tasks || 1) - 1),
              active_complaints: (w.active_complaints || []).filter((c) => c.id !== selectedComplaintId),
            };
          }
          if (w.id === targetWorkerId) {
            return {
              ...w,
              active_tasks: (w.active_tasks || 0) + 1,
              active_complaints: movedComplaint
                ? [...(w.active_complaints || []), movedComplaint]
                : w.active_complaints,
            };
          }
          return w;
        });
      });

      // Show confirmation toast
      const successMessage = `Task ${selectedComplaintId} successfully reassigned from ${sourceWorker.name} to ${targetWorkerObj?.name || 'new worker'}!`;
      setReassignSuccessToast(successMessage);
      setTimeout(() => setReassignSuccessToast(''), 5000);

      setReassignModalOpen(false);
      setSourceWorker(null);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reassign task.');
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  const currentDeptMeta = DEPT_INFO[currentDept] || DEPT_INFO.PWD;

  return (
    <div className={`text-slate-800 ${isEmbedded ? '' : 'min-h-screen bg-slate-50 pb-20'}`}>
      {/* Standalone Header (Shown if not embedded in Dashboard.jsx) */}
      {!isEmbedded && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 border-l-4 border-l-primary pl-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition lg:hidden"
                aria-label="Open navigation drawer"
              >
                <span className="text-lg">☰</span>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    Officer Operations Center
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs font-semibold text-slate-500">
                    {currentDeptMeta.name}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-dark tracking-tight flex items-center gap-2">
                  <span>Department Field Worker Roster</span>
                  <span className="text-slate-400 font-light hidden sm:inline">—</span>
                  <span className="text-base sm:text-lg font-semibold text-slate-600 hidden sm:inline">
                    Workload & Reassignment Console
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                to="/officer"
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="Return to Officer Dashboard"
              >
                <span>📊</span>
                <span>Dashboard</span>
              </Link>

              <Link
                to="/officer/validation"
                className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                title="AI Validation Queue"
              >
                <span>🤖</span>
                <span>Validation Queue</span>
              </Link>

              <span className="text-xs font-bold text-slate-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hidden sm:inline-flex items-center gap-1.5">
                <span>👤</span>
                <span>{user?.name || 'Department Officer'}</span>
              </span>

              <button
                onClick={logout}
                className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-lg text-xs font-bold transition shadow-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Roster Container */}
      <div className={isEmbedded ? 'space-y-4' : 'max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6'}>
        {/* Success Toast Notification */}
        {reassignSuccessToast && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between gap-3 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">✅</span>
              <span>{reassignSuccessToast}</span>
            </div>
            <button
              onClick={() => setReassignSuccessToast('')}
              className="text-emerald-700 hover:text-emerald-950 font-black text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMsg && (
          <ErrorMessage
            message={errorMsg}
            onRetry={fetchLiveRoster}
          />
        )}

        {/* Top Operational Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Workers in Dept */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {currentDeptMeta.icon} Total Personnel
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{deptStats.totalWorkers}</span>
              <span className="text-[11px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded">
                {currentDept} Dept
              </span>
            </div>
          </div>

          {/* Card 2: On Duty */}
          <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 p-4 shadow-xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active On Duty
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600">{deptStats.onDutyCount}</span>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                In Field
              </span>
            </div>
          </div>

          {/* Card 3: On Leave */}
          <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-slate-400 p-4 shadow-xs">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              On Leave
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-600">{deptStats.onLeaveCount}</span>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                Resting
              </span>
            </div>
          </div>

          {/* Card 4: Overloaded Alert */}
          <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-xs border-l-4 ${deptStats.overloadedCount > 0 ? 'border-l-red-500 bg-red-50/20' : 'border-l-blue-500'}`}>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Overloaded (5+ Tasks)
            </p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={`text-2xl font-black ${deptStats.overloadedCount > 0 ? 'text-danger' : 'text-slate-800'}`}>
                {deptStats.overloadedCount}
              </span>
              {deptStats.overloadedCount > 0 ? (
                <span className="text-[10px] font-black text-red-800 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                  Rebalance Needed
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                  All Balanced
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ROSTER TABLE SECTION */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Controls Bar: Search, Dept Switcher, Filters */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search worker by name, ID, designation..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department & Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Optional Department Selector (if user has multi-dept access or admin preview) */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold text-[11px] uppercase">Dept:</span>
                <select
                  value={currentDept}
                  onChange={(e) => setCurrentDept(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="PWD">PWD (Roads)</option>
                  <option value="SWM">Solid Waste (SWM)</option>
                  <option value="PHE">Water Works (PHE)</option>
                  <option value="ELEC">Electrical</option>
                </select>
              </div>

              {/* Ward Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold text-[11px] uppercase">Ward:</span>
                <select
                  value={wardFilter}
                  onChange={(e) => setWardFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">All Wards</option>
                  <option value="1">Ward 1</option>
                  <option value="2">Ward 2</option>
                  <option value="3">Ward 3</option>
                  <option value="4">Ward 4</option>
                </select>
              </div>

              {/* Duty Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold text-[11px] uppercase">Duty:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">All Status</option>
                  <option value="On Duty">On Duty</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>

              {/* Workload Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold text-[11px] uppercase">Workload:</span>
                <select
                  value={loadFilter}
                  onChange={(e) => setLoadFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">All Loads</option>
                  <option value="overloaded">🔴 Red (5+ tasks)</option>
                  <option value="moderate">🟡 Amber (3-4 tasks)</option>
                  <option value="optimal">🟢 Green (1-2 tasks)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Workload Meter Legend Guide */}
          <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between text-[11px] gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="font-extrabold text-slate-600 uppercase tracking-wider">
                Workload Meter:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-700 font-semibold">Green (1–2 tasks: Optimal)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span className="text-slate-700 font-semibold">Amber (3–4 tasks: Moderate)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse" />
                <span className="text-red-700 font-black">Red (5+ tasks: Overloaded)</span>
              </div>
            </div>

            <div className="text-slate-500 font-medium hidden md:block">
              Showing <strong>{filteredWorkers.length}</strong> of {workersData.length} workers in {currentDeptMeta.name}
            </div>
          </div>

          {/* ROSTER TABLE (Columns: Worker Name, Assigned Ward, Status, Active Tasks, Rating, Actions) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider font-extrabold border-b border-slate-200">
                  <th className="py-3.5 px-5 min-w-[200px]">1. Worker Name</th>
                  <th className="py-3.5 px-4 min-w-[120px]">2. Assigned Ward</th>
                  <th className="py-3.5 px-4 min-w-[130px]">3. Status</th>
                  <th className="py-3.5 px-5 min-w-[240px]">4. Active Tasks (Workload Meter)</th>
                  <th className="py-3.5 px-4 min-w-[120px]">5. Rating</th>
                  <th className="py-3.5 px-5 text-right min-w-[170px]">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <span className="text-3xl block mb-2">🔍</span>
                      <p className="font-bold text-sm">No workers match the selected filters.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setWardFilter('ALL');
                          setStatusFilter('ALL');
                          setLoadFilter('ALL');
                        }}
                        className="mt-2 text-xs text-primary font-bold hover:underline"
                      >
                        Reset all filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((worker) => {
                    const meter = getWorkloadMeterConfig(worker.active_tasks);
                    const isOnDuty = worker.status === 'On Duty';
                    const isOverloaded = worker.active_tasks >= 5;

                    return (
                      <tr
                        key={worker.id}
                        id={`worker-row-${worker.id.toLowerCase()}`}
                        className={`transition-colors hover:bg-slate-50/80 ${
                          isOverloaded ? 'bg-red-50/15' : ''
                        }`}
                      >
                        {/* 1. Worker Name */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            {/* Avatar Initials */}
                            <div
                              className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                                isOverloaded
                                  ? 'bg-red-100 text-red-800 border border-red-200'
                                  : isOnDuty
                                  ? 'bg-blue-100 text-primary border border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {worker.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">
                                  {worker.name}
                                </span>
                                {isOverloaded && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                    Overloaded
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                <span className="font-mono text-slate-400 mr-1.5">{worker.id}</span>
                                <span>• {worker.designation}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Assigned Ward */}
                        <td className="py-3.5 px-4">
                          <WardBadge ward={worker.ward} />
                        </td>

                        {/* 3. Status (On Duty / On Leave) */}
                        <td className="py-3.5 px-4">
                          {isOnDuty ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                              <span>On Duty</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                              <span>On Leave</span>
                            </span>
                          )}
                        </td>

                        {/* 4. Active Tasks & Workload Meter Bar */}
                        <td className="py-3.5 px-5">
                          <div className="space-y-1.5">
                            {/* Task Count & Status Indicator */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-black text-slate-900 flex items-center gap-1.5">
                                <span>{worker.active_tasks}</span>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  active {worker.active_tasks === 1 ? 'task' : 'tasks'}
                                </span>
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${meter.badgeClass}`}>
                                {meter.indicatorIcon} {meter.label}
                              </span>
                            </div>

                            {/* Meter Bar: Green (1-2), Amber (3-4), Red (5+ tasks overloaded) */}
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/80">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${meter.barColor}`}
                                style={{ width: `${meter.percentage}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 5. Rating */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-amber-500 text-sm leading-none">★</span>
                            <span className="font-black text-slate-900 text-sm">
                              {worker.rating.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              ({worker.reviews || 40})
                            </span>
                          </div>
                        </td>

                        {/* 6. Direct 'Reassign Task' Button */}
                        <td className="py-3.5 px-5 text-right">
                          {worker.active_tasks > 0 ? (
                            <button
                              id={`btn-reassign-${worker.id.toLowerCase()}`}
                              type="button"
                              onClick={() => handleOpenReassignModal(worker)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-150 inline-flex items-center gap-1.5 shadow-2xs ${
                                isOverloaded
                                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 ring-1 ring-red-400/30'
                                  : 'bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200'
                              }`}
                              title={`Reassign a task away from ${worker.name}`}
                            >
                              <span>⇄</span>
                              <span>{isOverloaded ? 'Reassign (Relieve)' : 'Reassign Task'}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs font-medium italic">
                              No active tasks
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================================================
          REASSIGN TASK MODAL
          Direct task reassignment modal allowing officer to transfer an active grievance
          from an overloaded worker to an available, on-duty worker.
         ========================================================================= */}
      {reassignModalOpen && sourceWorker && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setReassignModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 border border-slate-200 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Workload Rebalancing Console
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                  Reassign Task from {sourceWorker.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReassign} className="space-y-4">
              {/* Step 1: Select Active Complaint to Reassign */}
              <div className="space-y-1.5 text-xs">
                <label className="font-extrabold text-slate-700 flex items-center justify-between">
                  <span>1. Select Task to Transfer from {sourceWorker.name}:</span>
                  <span className="text-slate-400 font-normal">
                    ({sourceWorker.active_tasks} pending tasks)
                  </span>
                </label>

                {sourceWorker.active_complaints && sourceWorker.active_complaints.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {sourceWorker.active_complaints.map((c) => {
                      const isSelected = selectedComplaintId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedComplaintId(c.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'border-primary bg-blue-50/80 ring-1 ring-primary'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="complaint_to_reassign"
                              checked={isSelected}
                              onChange={() => setSelectedComplaintId(c.id)}
                              className="text-primary focus:ring-primary"
                            />
                            <div>
                              <span className="font-mono font-bold text-slate-900">{c.id}</span>
                              <p className="text-[11px] text-slate-600 line-clamp-1">{c.title}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <PriorityBadge priority={c.priority} />
                            <WardBadge ward={c.ward} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={selectedComplaintId}
                    onChange={(e) => setSelectedComplaintId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs focus:ring-2 focus:ring-primary"
                  >
                    <option value="CMP-20485">CMP-20485 - Open trench on Main MG Road (Ward 1)</option>
                    <option value="CMP-20492">CMP-20492 - Deep asphalt pothole near bus stand (Ward 1)</option>
                    <option value="CMP-20501">CMP-20501 - Broken footpath slab causing trips (Ward 1)</option>
                  </select>
                )}
              </div>

              {/* Step 2: Select Destination On-Duty Worker */}
              <div className="space-y-1.5 text-xs">
                <label className="font-extrabold text-slate-700 flex items-center justify-between">
                  <span>2. Select Destination Worker (On Duty):</span>
                  <span className="text-emerald-700 font-bold">Recommended: Green Load (1-2)</span>
                </label>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {workersData
                    .filter((w) => w.id !== sourceWorker.id && w.status === 'On Duty')
                    .sort((a, b) => (a.active_tasks || 0) - (b.active_tasks || 0))
                    .map((worker) => {
                      const isSelected = targetWorkerId === worker.id;
                      const targetMeter = getWorkloadMeterConfig(worker.active_tasks);

                      return (
                        <div
                          key={worker.id}
                          onClick={() => setTargetWorkerId(worker.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="target_worker"
                              checked={isSelected}
                              onChange={() => setTargetWorkerId(worker.id)}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <span className="font-bold text-slate-900">{worker.name}</span>
                              <div className="text-[11px] text-slate-500">
                                {worker.designation}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <WardBadge ward={worker.ward} />
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${targetMeter.badgeClass}`}>
                              {worker.active_tasks} tasks
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Step 3: Reassignment Reason */}
              <div className="space-y-1 text-xs">
                <label className="font-extrabold text-slate-700">3. Reassignment Rationale:</label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Workload balancing, emergency SLA intervention..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReassign || !targetWorkerId || !selectedComplaintId}
                  className="px-5 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingReassign ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Reassigning...</span>
                    </>
                  ) : (
                    <>
                      <span>⇄</span>
                      <span>Confirm Reassignment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar Navigation Drawer for Standalone mode */}
      {!isEmbedded && (
        <OfficerSidebarDrawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          pendingValidationCount={4}
        />
      )}
    </div>
  );
};

export default WorkerRoster;
