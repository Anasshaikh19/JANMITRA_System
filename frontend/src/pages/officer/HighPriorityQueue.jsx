import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import PriorityBadge from '../../components/PriorityBadge';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import api from '../../api/client';
import { getStoredComplaints, updateComplaint } from '../../utils/complaintStore';
import { useAuth } from '../../context/AuthContext';
import { resolveOfficerDeptCode, matchesDepartment, DEPARTMENT_WORKERS } from '../../utils/departmentData';

// On-duty municipal workers indexed by ward
const ON_DUTY_WORKERS = [
  {
    id: 'WKR-01',
    name: 'Suresh Patil',
    ward: 2,
    status: 'On Duty',
    active_tasks: 3,
    phone: '+91 98765 43210',
    specialization: 'Road Surfacing & Asphalt Repair',
    rating: '4.9 ★',
  },
  {
    id: 'WKR-02',
    name: 'Ramesh Kumar',
    ward: 1,
    status: 'On Duty',
    active_tasks: 1,
    phone: '+91 98765 11223',
    specialization: 'Heavy Machinery & Water Main Repair',
    rating: '4.8 ★',
  },
  {
    id: 'WKR-03',
    name: 'Anil Deshmukh',
    ward: 3,
    status: 'On Duty',
    active_tasks: 4,
    phone: '+91 98765 55667',
    specialization: 'Drainage & Culvert Excavation',
    rating: '4.7 ★',
  },
  {
    id: 'WKR-04',
    name: 'Vikram Singh',
    ward: 4,
    status: 'On Duty',
    active_tasks: 1,
    phone: '+91 98765 88990',
    specialization: 'Footpath & Paver Block Repair',
    rating: '4.9 ★',
  },
  {
    id: 'WKR-05',
    name: 'Santosh Shinde',
    ward: 2,
    status: 'On Duty',
    active_tasks: 2,
    phone: '+91 98765 33445',
    specialization: 'Emergency Patchwork & Potholes',
    rating: '4.6 ★',
  },
  {
    id: 'WKR-06',
    name: 'Pooja Jadhav',
    ward: 1,
    status: 'On Duty',
    active_tasks: 2,
    phone: '+91 98765 77889',
    specialization: 'Sanitation & SWM Dispatch',
    rating: '4.8 ★',
  },
  {
    id: 'WKR-07',
    name: 'Nitin Kadam',
    ward: 3,
    status: 'On Duty',
    active_tasks: 2,
    phone: '+91 98765 99001',
    specialization: 'Electrical & Cable Lines',
    rating: '4.7 ★',
  },
  {
    id: 'WKR-08',
    name: 'Deepak More',
    ward: 4,
    status: 'On Duty',
    active_tasks: 0,
    phone: '+91 98765 22334',
    specialization: 'Waste Disposal & Compactor Operation',
    rating: '5.0 ★',
  },
];

// Seed high and critical priority complaints for fallback / offline testing
const SEED_HIGH_PRIORITY_COMPLAINTS = [
  {
    id: 'CMP-901',
    category: 'Roads & Infrastructure',
    ward: 2,
    priority: 'Critical',
    status: 'Pending',
    created_at: new Date(Date.now() - 3600 * 1000 * 20.5).toISOString(), // ~3.5h left of 24h SLA
    assigned_to: null,
    description:
      'Deep road cave-in and asphalt subsidence near market bus depot causing immediate vehicle rollover hazards.',
    location: 'Near Old Bus Stand, Ring Road, Ward 2',
    image: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'CMP-902',
    category: 'Water & Drainage',
    ward: 1,
    priority: 'Critical',
    status: 'Pending',
    created_at: new Date(Date.now() - 3600 * 1000 * 26).toISOString(), // Overdue by 2h!
    assigned_to: null,
    description:
      'Main potable water pipeline fracture flooding road and submerging electric junction boxes.',
    location: '4th Cross, Gandhi Nagar Market, Ward 1',
    image: 'https://images.unsplash.com/photo-1541888946425-d0fbb18615f8?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'CMP-903',
    category: 'Street Lighting & Electrical',
    ward: 3,
    priority: 'High',
    status: 'In-Progress',
    created_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(), // ~30h left of 48h SLA
    assigned_to: 'Anil Deshmukh',
    description:
      'Live overhead electrical wire snapped and dangling 5 feet above school zone footpath.',
    location: 'School Lane, Sector 3, Ward 3',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'CMP-904',
    category: 'Garbage & Waste Management',
    ward: 4,
    priority: 'High',
    status: 'Pending',
    created_at: new Date(Date.now() - 3600 * 1000 * 39).toISOString(), // ~9h left of 48h SLA
    assigned_to: null,
    description:
      'Hazardous industrial debris dumped illegally adjacent to public drinking water overhead tank.',
    location: 'Industrial Bypass Road, Ward 4',
    image: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'CMP-905',
    category: 'Roads & Infrastructure',
    ward: 2,
    priority: 'Critical',
    status: 'Assigned',
    created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(), // ~12h left of 24h SLA
    assigned_to: 'Suresh Patil',
    description:
      'Open storm drain trench without barricades on dark school street.',
    location: 'Opposite Community Hall, Ward 2',
    image: '',
  },
  {
    id: 'CMP-906',
    category: 'Water & Drainage',
    ward: 1,
    priority: 'High',
    status: 'Pending',
    created_at: new Date(Date.now() - 3600 * 1000 * 41).toISOString(), // ~7h left of 48h SLA
    assigned_to: null,
    description:
      'Severe underground sewage backflow overflowing into residential doorways.',
    location: 'Crossroad #7, Ward 1',
    image: '',
  },
];

// Helper: SLA Countdown calculation
const calculateSla = (item) => {
  const isCritical = String(item.priority || '').toLowerCase() === 'critical';
  const slaMaxHours = isCritical ? 24 : 48; // Critical: 24h SLA, High: 48h SLA

  const createdMs = item.created_at
    ? new Date(item.created_at).getTime()
    : Date.now() - 3600 * 1000 * 14;

  const elapsedMs = Date.now() - createdMs;
  const remainingMs = slaMaxHours * 3600 * 1000 - elapsedMs;

  if (remainingMs <= 0) {
    const overdueHours = Math.max(1, Math.abs(Math.floor(remainingMs / (3600 * 1000))));
    return {
      text: `Overdue by ${overdueHours}h`,
      isOverdue: true,
      urgency: 'overdue',
      badgeClass: 'bg-red-100 text-red-700 border-red-300 font-extrabold animate-pulse',
      icon: '⚠️',
    };
  }

  const hours = Math.floor(remainingMs / (3600 * 1000));
  const minutes = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));

  if (hours < 4) {
    return {
      text: `${hours}h ${minutes}m left`,
      isOverdue: false,
      urgency: 'critical',
      badgeClass: 'bg-red-50 text-red-700 border-red-300 font-extrabold',
      icon: '⏳',
    };
  }

  if (hours < 12) {
    return {
      text: `${hours}h ${minutes}m left`,
      isOverdue: false,
      urgency: 'warning',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
      icon: '⏳',
    };
  }

  return {
    text: `${hours}h left`,
    isOverdue: false,
    urgency: 'healthy',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
    icon: '⏱️',
  };
};

const HighPriorityQueue = ({ officerDeptCode: propDeptCode }) => {
  const { user } = useAuth();
  const deptCode = useMemo(() => {
    return propDeptCode || resolveOfficerDeptCode(user);
  }, [propDeptCode, user]);

  const departmentWorkers = useMemo(() => {
    return DEPARTMENT_WORKERS[deptCode] || ON_DUTY_WORKERS;
  }, [deptCode]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  // Filters & layout mode
  const [wardFilter, setWardFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Quick Assign Modal state
  const [assignModalComplaint, setAssignModalComplaint] = useState(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [showAllWardsOverride, setShowAllWardsOverride] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Auto-refresh countdown every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (type, text) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch: Table/card list of complaints with priority Critical and High
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let fetched = null;
      try {
        const res = await api.get('/v1/dashboard/high-priority/');
        const data = res.data?.complaints || res.data?.items || res.data;
        if (Array.isArray(data) && data.length > 0) fetched = data;
      } catch (err) {
        // Fallback to local shared store
      }

      if (fetched) {
        const highPriorityOnly = fetched.filter((c) =>
          ['critical', 'high'].includes(String(c.priority || '').toLowerCase())
        );
        setComplaints(highPriorityOnly);
      } else {
        const stored = getStoredComplaints().filter((c) =>
          ['critical', 'high'].includes(String(c.priority || '').toLowerCase()) &&
          matchesDepartment(c, deptCode)
        );
        const seedFiltered = SEED_HIGH_PRIORITY_COMPLAINTS.filter((c) => matchesDepartment(c, deptCode));
        setComplaints(stored.length > 0 ? stored : (seedFiltered.length > 0 ? seedFiltered : SEED_HIGH_PRIORITY_COMPLAINTS));
      }
    } catch (e) {
      console.warn('High priority fetch error, loading seed queue:', e.message);
      setComplaints(SEED_HIGH_PRIORITY_COMPLAINTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Open the Quick Assign Worker Modal
  const openAssignModal = (complaint) => {
    setAssignModalComplaint(complaint);
    setShowAllWardsOverride(false);

    // Default select first available worker matching that ward
    const wardNum = Number(String(complaint.ward).replace(/\D/g, '')) || 1;
    const matchingWorker = ON_DUTY_WORKERS.find(
      (w) => Number(w.ward) === wardNum && w.status === 'On Duty'
    );
    setSelectedWorkerId(matchingWorker?.id || departmentWorkers[0]?.id || '');
  };

  const closeAssignModal = () => {
    setAssignModalComplaint(null);
    setSelectedWorkerId('');
    setShowAllWardsOverride(false);
  };

  // 3. 'Assign Worker' submission
  const handleConfirmAssignment = async () => {
    if (!assignModalComplaint || !selectedWorkerId) return;

    const worker = departmentWorkers.find((w) => w.id === selectedWorkerId);
    if (!worker) return;

    const complaintId = assignModalComplaint.id;
    setAssigning(true);

    try {
      // Backend API call
      try {
        await api.post(`/v1/complaints/${complaintId}/assign/`, {
          worker_id: worker.id,
          worker_name: worker.name,
        });
      } catch (err) {
        console.warn('API assign endpoint fallback:', err.message);
      }

      // Synchronize shared complaintStore
      updateComplaint(complaintId, {
        status: 'Assigned',
        assigned_to: worker.name,
        worker_id: worker.id,
      });

      // Update local state in table
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintId
            ? { ...c, status: 'Assigned', assigned_to: worker.name, worker_id: worker.id }
            : c
        )
      );

      showToast('success', `Assigned ${complaintId} to ${worker.name} (Ward ${worker.ward})!`);
      closeAssignModal();
    } catch (err) {
      showToast('error', 'Failed to assign worker.');
    } finally {
      setAssigning(false);
    }
  };

  // Filtered queue
  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      // Ward filter
      if (wardFilter !== 'All') {
        const itemWardStr = String(item.ward || '');
        const targetWardNum = wardFilter.replace(/\D/g, '');
        if (!itemWardStr.includes(targetWardNum)) return false;
      }

      // Priority filter
      if (priorityFilter !== 'All') {
        if (String(item.priority || '').toLowerCase() !== priorityFilter.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = String(item.id || '').toLowerCase().includes(q);
        const matchDesc = String(item.description || '').toLowerCase().includes(q);
        const matchCat = String(item.category || '').toLowerCase().includes(q);
        const matchLoc = String(item.location || '').toLowerCase().includes(q);
        if (!matchId && !matchDesc && !matchCat && !matchLoc) return false;
      }

      return true;
    });
  }, [complaints, wardFilter, priorityFilter, searchQuery]);

  // Available on-duty workers for the selected modal complaint's ward
  const availableWardWorkers = useMemo(() => {
    if (!assignModalComplaint) return [];
    const wardNum =
      Number(String(assignModalComplaint.ward).replace(/\D/g, '')) || 1;

    if (showAllWardsOverride) {
      return departmentWorkers;
    }
    return departmentWorkers.filter(
      (w) => Number(w.ward) === wardNum && w.status === 'On Duty'
    );
  }, [assignModalComplaint, showAllWardsOverride]);

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-bounce transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-red-600 text-white shadow-red-500/20'
          }`}
        >
          <span>{toastMessage.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <h2 className="text-base sm:text-lg font-black text-dark tracking-tight">
              High Priority & Critical Queue
            </h2>
            <span className="bg-red-100 text-danger text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-red-200">
              {filteredComplaints.length} Cases
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Grievances with SLA deadlines requiring rapid on-duty worker dispatch
          </p>
        </div>

        {/* Controls: Search, Filters, View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, category..."
              className="text-xs py-1.5 pl-7 pr-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary w-40 sm:w-48 font-medium text-slate-800"
            />
            <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">🔍</span>
          </div>

          {/* Ward Filter */}
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="text-xs font-semibold py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700"
          >
            <option value="All">All Wards</option>
            <option value="Ward 1">Ward 1</option>
            <option value="Ward 2">Ward 2</option>
            <option value="Ward 3">Ward 3</option>
            <option value="Ward 4">Ward 4</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs font-semibold py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Only</option>
          </select>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg transition ${
                viewMode === 'table'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              ☰ Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 rounded-lg transition ${
                viewMode === 'cards'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              ⊞ Cards
            </button>
          </div>

          <button
            type="button"
            onClick={fetchComplaints}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
            title="Refresh High Priority Queue"
          >
            🔄
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchComplaints} />}

      {/* Content Area */}
      {loading ? (
        <div className="p-4 sm:p-6 space-y-4">
          <LoadingSkeleton
            variant="table"
            count={5}
            message="Scanning high-priority grievances and SLA timers..."
          />
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="py-12 text-center text-slate-500 space-y-2">
          <span className="text-3xl">🛡️</span>
          <p className="text-xs font-bold text-slate-700">No High or Critical Priority Complaints Found</p>
          <p className="text-[11px] text-slate-400">All escalated SLA deadlines are currently within normal thresholds.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* 1 & 2. TABLE VIEW */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Complaint ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Ward</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-center">SLA Time Remaining</th>
                <th className="py-3 px-4">Status & Allocation</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredComplaints.map((item) => {
                const isCritical = String(item.priority || '').toLowerCase() === 'critical';
                const sla = calculateSla(item);
                const isAssigned = Boolean(item.assigned_to);

                // Row background accent
                const rowClass = isCritical
                  ? 'bg-red-50/40 hover:bg-red-50/80'
                  : 'hover:bg-slate-50/80';

                return (
                  <tr key={item.id} className={`${rowClass} transition-colors group`}>
                    {/* Complaint ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-extrabold text-primary flex items-center gap-1.5">
                        {isCritical && <span className="text-danger text-xs">●</span>}
                        <span>{item.id}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[180px] mt-0.5">
                        {item.description}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <CategoryBadge category={item.category} />
                    </td>

                    {/* Ward */}
                    <td className="py-3.5 px-4">
                      <WardBadge ward={item.ward} />
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      <PriorityBadge level={item.priority} />
                    </td>

                    {/* 2. SLA Time Remaining (countdown pill) */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border shadow-2xs ${sla.badgeClass}`}
                        title={`SLA Target: ${isCritical ? '24 Hours' : '48 Hours'}`}
                      >
                        <span>{sla.icon}</span>
                        <span>{sla.text}</span>
                      </span>
                    </td>

                    {/* Status & Allocation */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <StatusBadge status={item.status} />
                        <div className="text-[11px]">
                          {isAssigned ? (
                            <span className="text-slate-700 font-semibold flex items-center gap-1">
                              <span>👤</span>
                              <span>{item.assigned_to}</span>
                            </span>
                          ) : (
                            <span className="text-danger font-bold flex items-center gap-1">
                              <span>⚠️</span>
                              <span>Pending Allocation</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 3. 'Assign Worker' Button */}
                    <td className="py-3.5 px-4 text-right">
                      {isAssigned ? (
                        <button
                          type="button"
                          onClick={() => openAssignModal(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold transition text-xs shadow-2xs"
                        >
                          Reassign
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAssignModal(item)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold transition text-xs shadow-sm flex items-center gap-1.5 ml-auto hover:scale-105 active:scale-95"
                        >
                          <span>👷‍♂️</span>
                          <span>Assign Worker</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* 1 & 2. CARD GRID VIEW */
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComplaints.map((item) => {
            const isCritical = String(item.priority || '').toLowerCase() === 'critical';
            const sla = calculateSla(item);
            const isAssigned = Boolean(item.assigned_to);

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all shadow-xs flex flex-col justify-between space-y-3 ${
                  isCritical
                    ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-primary text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {item.id}
                    </span>
                    <PriorityBadge level={item.priority} />
                  </div>
                  <WardBadge ward={item.ward} />
                </div>

                {/* Description & Category */}
                <div className="space-y-1.5">
                  <CategoryBadge category={item.category} />
                  <p className="text-xs text-slate-800 font-medium line-clamp-2 leading-relaxed">
                    "{item.description}"
                  </p>
                </div>

                {/* 2. SLA Countdown Pill */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">SLA Remaining:</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border shadow-2xs ${sla.badgeClass}`}
                  >
                    <span>{sla.icon}</span>
                    <span>{sla.text}</span>
                  </span>
                </div>

                {/* Card Footer: Assigned info + Action button */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs">
                    {isAssigned ? (
                      <span className="text-slate-700 font-semibold text-[11px] flex items-center gap-1">
                        <span>👤</span>
                        <span className="truncate max-w-[110px]">{item.assigned_to}</span>
                      </span>
                    ) : (
                      <span className="text-danger font-extrabold text-[11px] flex items-center gap-1">
                        <span>⚠️ Unassigned</span>
                      </span>
                    )}
                  </div>

                  {/* 3. 'Assign Worker' button */}
                  <button
                    type="button"
                    onClick={() => openAssignModal(item)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition shadow-2xs flex items-center gap-1 ${
                      isAssigned
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <span>👷‍♂️</span>
                    <span>{isAssigned ? 'Reassign' : 'Assign Worker'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. QUICK MODAL: SHOWING AVAILABLE ON-DUTY WORKERS FOR THAT WARD */}
      {assignModalComplaint && (
        <div
          className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
          onClick={closeAssignModal}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-900">
                    Assign Field Worker
                  </span>
                  <span className="font-mono text-xs font-bold text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {assignModalComplaint.id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Select an available on-duty municipal worker for{' '}
                  <strong className="text-slate-800">Ward {assignModalComplaint.ward}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={closeAssignModal}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Complaint Snapshot Bar */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={assignModalComplaint.category} />
                  <WardBadge ward={assignModalComplaint.ward} />
                  <PriorityBadge level={assignModalComplaint.priority} />
                </div>
                {/* SLA countdown pill inside modal */}
                {(() => {
                  const sla = calculateSla(assignModalComplaint);
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] border ${sla.badgeClass}`}>
                      {sla.icon} {sla.text}
                    </span>
                  );
                })()}
              </div>

              <p className="text-xs text-slate-700 font-medium italic">
                "{assignModalComplaint.description}"
              </p>
            </div>

            {/* Available on-duty workers list */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  On-Duty Workers in Ward {assignModalComplaint.ward}
                </label>
                <button
                  type="button"
                  onClick={() => setShowAllWardsOverride(!showAllWardsOverride)}
                  className="text-[11px] text-primary font-bold hover:underline"
                >
                  {showAllWardsOverride
                    ? `← Filter Ward ${assignModalComplaint.ward} Only`
                    : 'Show Workers from All Wards'}
                </button>
              </div>

              {availableWardWorkers.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <p className="font-bold">⚠️ No on-duty workers currently allocated to Ward {assignModalComplaint.ward}.</p>
                  <p className="text-[11px] text-amber-800">
                    You can allocate field staff from adjacent wards using cross-ward override.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAllWardsOverride(true)}
                    className="px-3 py-1 bg-amber-200 hover:bg-amber-300 font-bold rounded-lg text-xs transition"
                  >
                    View All Wards On-Duty Roster
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availableWardWorkers.map((worker) => {
                    const isSelected = selectedWorkerId === worker.id;
                    const isSameWard =
                      Number(worker.ward) ===
                      Number(String(assignModalComplaint.ward).replace(/\D/g, ''));

                    return (
                      <div
                        key={worker.id}
                        onClick={() => setSelectedWorkerId(worker.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                          isSelected
                            ? 'border-primary bg-blue-50/80 ring-1 ring-primary shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="assigned_worker"
                            checked={isSelected}
                            onChange={() => setSelectedWorkerId(worker.id)}
                            className="text-primary focus:ring-primary h-4 w-4"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>{worker.name}</span>
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-bold">
                                ● On Duty
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {worker.id} • {worker.specialization}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              📞 {worker.phone} • Rating: {worker.rating}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            <WardBadge ward={worker.ward} />
                            {!isSameWard && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                Cross-Ward
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              worker.active_tasks > 3
                                ? 'bg-red-100 text-danger'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {worker.active_tasks} active tasks
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Worker will receive an instant push notification on worker portal
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  disabled={assigning}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  disabled={assigning || !selectedWorkerId}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {assigning ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Confirm Assignment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HighPriorityQueue;
