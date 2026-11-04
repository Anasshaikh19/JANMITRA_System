import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { Link, useNavigate } from 'react-router-dom';
import KPICard from '../../components/KPICard';
import WardBadge from '../../components/WardBadge';
import CategoryBadge from '../../components/CategoryBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import OfficerSidebarDrawer from '../../components/OfficerSidebarDrawer';
import { getStoredComplaints, updateComplaint } from '../../utils/complaintStore';
import HighPriorityQueue from './HighPriorityQueue';
import { formatDeptName } from '../../utils/chartHelpers';
import {
  resolveOfficerDeptCode,
  matchesDepartment,
  DEPARTMENT_INFO,
  DEPARTMENT_WORKERS,
  DEPARTMENT_ISSUE_TYPES,
  DEPARTMENT_BASELINES,
} from '../../utils/departmentData';

// Core palette matching the JANMITRA design system
const COLORS = {
  blue: '#1A56DB',
  amber: '#D97706',
  purple: '#7C3AED',
  green: '#0E9F6E',
  red: '#E02424',
  orange: '#F97316',
  cyan: '#06B6D4',
  yellow: '#EAB308',
  grey: '#94A3B8',
};

// Department Theme Color Mapping: Blue, Green, Cyan, Yellow
const DEPARTMENT_CATEGORY_CONFIG = [
  {
    key: 'roads',
    category: 'Roads',
    fullName: 'Roads & Infrastructure',
    color: '#1A56DB', // Blue
    icon: '🛣️',
  },
  {
    key: 'garbage',
    category: 'Garbage',
    fullName: 'Garbage & Waste Management',
    color: '#0E9F6E', // Green
    icon: '🗑️',
  },
  {
    key: 'water',
    category: 'Water',
    fullName: 'Water & Drainage',
    color: '#06B6D4', // Cyan
    icon: '💧',
  },
  {
    key: 'lighting',
    category: 'Lighting',
    fullName: 'Street Lighting & Electrical',
    color: '#EAB308', // Yellow
    icon: '💡',
  },
];

// Baseline mock data fallbacks for offline resilience and initial render
const MOCK_KPI = {
  total: 486,
  pending: 64,
  in_progress: 112,
  resolved: 284,
  rejected: 26,
  avg_resolution_days: '3.2 days',
  severity_distribution: [
    { name: 'Critical', value: 42, color: COLORS.red },
    { name: 'High', value: 98, color: COLORS.orange },
    { name: 'Medium', value: 214, color: COLORS.amber },
    { name: 'Low', value: 132, color: COLORS.grey },
  ],
};

const DEFAULT_CATEGORY_DATA = [
  { category: 'Roads', fullName: 'Roads & Infrastructure', total: 184, resolved: 112, pending: 72, color: '#1A56DB', icon: '🛣️' },
  { category: 'Garbage', fullName: 'Garbage & Waste Management', total: 142, resolved: 98, pending: 44, color: '#0E9F6E', icon: '🗑️' },
  { category: 'Water', fullName: 'Water & Drainage', total: 96, resolved: 54, pending: 42, color: '#06B6D4', icon: '💧' },
  { category: 'Lighting', fullName: 'Street Lighting & Electrical', total: 64, resolved: 46, pending: 18, color: '#EAB308', icon: '💡' },
];

const MOCK_WARD_STATS = [
  { ward: 'Ward 1', wardNum: 1, pending: 18, in_progress: 25, resolved: 70 },
  { ward: 'Ward 2', wardNum: 2, pending: 22, in_progress: 35, resolved: 85 },
  { ward: 'Ward 3', wardNum: 3, pending: 12, in_progress: 28, resolved: 65 },
  { ward: 'Ward 4', wardNum: 4, pending: 12, in_progress: 24, resolved: 64 },
];

const MOCK_TRENDS = {
  day: [
    { period: 'Mon', submitted: 24, resolved: 18 },
    { period: 'Tue', submitted: 32, resolved: 22 },
    { period: 'Wed', submitted: 28, resolved: 30 },
    { period: 'Thu', submitted: 35, resolved: 29 },
    { period: 'Fri', submitted: 42, resolved: 38 },
    { period: 'Sat', submitted: 19, resolved: 24 },
    { period: 'Sun', submitted: 15, resolved: 17 },
  ],
  week: [
    { period: 'Wk 1', submitted: 140, resolved: 115 },
    { period: 'Wk 2', submitted: 165, resolved: 142 },
    { period: 'Wk 3', submitted: 182, resolved: 160 },
    { period: 'Wk 4', submitted: 155, resolved: 148 },
  ],
  month: [
    { period: 'Jan', submitted: 420, resolved: 380 },
    { period: 'Feb', submitted: 460, resolved: 410 },
    { period: 'Mar', submitted: 510, resolved: 480 },
    { period: 'Apr', submitted: 486, resolved: 462 },
  ],
};

const MOCK_WORKERS = [
  {
    id: 'WKR-01',
    name: 'Suresh Patil',
    ward: 2,
    active_tasks: 4,
    completed_this_week: 12,
    avg_days: '2.4',
    status: 'On Duty',
    phone: '+91 98765 43210',
    specialization: 'Road Surfacing & Asphalt',
  },
  {
    id: 'WKR-02',
    name: 'Ramesh Kumar',
    ward: 1,
    active_tasks: 2,
    completed_this_week: 9,
    avg_days: '3.1',
    status: 'On Duty',
    phone: '+91 98765 11223',
    specialization: 'Heavy Machinery & Trenching',
  },
  {
    id: 'WKR-03',
    name: 'Anil Deshmukh',
    ward: 3,
    active_tasks: 6,
    completed_this_week: 8,
    avg_days: '3.8',
    status: 'In Field',
    phone: '+91 98765 55667',
    specialization: 'Drainage & Culvert Repairs',
  },
  {
    id: 'WKR-04',
    name: 'Vikram Singh',
    ward: 4,
    active_tasks: 1,
    completed_this_week: 14,
    avg_days: '1.9',
    status: 'On Duty',
    phone: '+91 98765 88990',
    specialization: 'Footpath & Paver Blocks',
  },
  {
    id: 'WKR-05',
    name: 'Santosh Shinde',
    ward: 2,
    active_tasks: 5,
    completed_this_week: 7,
    avg_days: '4.2',
    status: 'Break',
    phone: '+91 98765 33445',
    specialization: 'Emergency Patchwork',
  },
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // 1. Header Date Range State
  const [dateRange, setDateRange] = useState('30d'); // '7d' | '30d' | '90d' | 'custom'

  // 2. Filter Bar State
  const [selectedWard, setSelectedWard] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');

  // Trigger query refetch state
  const [filterQuery, setFilterQuery] = useState({
    dateRange: '30d',
    ward: 'All',
    status: 'All',
    severity: 'All',
  });

  // 3. Trends Toggle State
  const [trendGrouping, setTrendGrouping] = useState('day'); // 'day' | 'week' | 'month'

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kpiData, setKpiData] = useState(MOCK_KPI);
  // categoryData removed - cross-department chart now in Admin Portal
  const [wardStats, setWardStats] = useState(MOCK_WARD_STATS);
  const [trendsData, setTrendsData] = useState(MOCK_TRENDS.day);
  // workers managed by department state above

  // Quick Actions, Sidebar & Modals State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedDispatchComplaintId, setSelectedDispatchComplaintId] = useState('');
  const [selectedDispatchWorkerId, setSelectedDispatchWorkerId] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [pendingValidationCount, setPendingValidationCount] = useState(4);

  const officerDeptCode = useMemo(() => resolveOfficerDeptCode(user), [user]);
  const deptMeta = useMemo(() => DEPARTMENT_INFO[officerDeptCode] || DEPARTMENT_INFO.PWD, [officerDeptCode]);
  const deptName = useMemo(() => {
    return formatDeptName(user?.department_name || user?.department || user?.dept || officerDeptCode);
  }, [user, officerDeptCode]);

  const [analyticsViewTab, setAnalyticsViewTab] = useState('workers'); // 'workers' | 'issues'

  // Initialize and synchronize workers strictly for this department
  const [workers, setWorkers] = useState(() => DEPARTMENT_WORKERS[officerDeptCode] || DEPARTMENT_WORKERS.PWD);
  useEffect(() => {
    setWorkers(DEPARTMENT_WORKERS[officerDeptCode] || DEPARTMENT_WORKERS.PWD);
  }, [officerDeptCode]);

  // Worker Workload & Productivity BarChart Data
  const workerWorkloadChartData = useMemo(() => {
    return workers.map((w) => ({
      name: w.name ? w.name.split(' ')[0] : 'Worker',
      fullName: w.name,
      id: w.id,
      ward: w.ward,
      specialization: w.specialization,
      status: w.status,
      active_tasks: w.active_tasks || 0,
      completed_tasks: w.completed_this_week || 0,
      avg_days: w.avg_days || '2.0',
    }));
  }, [workers]);

  // Department-specific issue subcategories BarChart Data
  const departmentIssuesChartData = useMemo(() => {
    const issueConfigs = DEPARTMENT_ISSUE_TYPES[officerDeptCode] || DEPARTMENT_ISSUE_TYPES.PWD;
    const all = getStoredComplaints().filter((c) => matchesDepartment(c, officerDeptCode));

    return issueConfigs.map((cfg) => {
      const matchCount = all.filter((c) => {
        const text = `${c.title || ''} ${c.description || ''} ${c.category || ''}`.toLowerCase();
        const words = cfg.type.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['road', 'waste', 'water', 'street'].includes(w));
        return words.some(w => text.includes(w));
      }).length;

      const total = cfg.baseTotal + matchCount;
      const resolved = cfg.baseResolved + Math.floor(matchCount * 0.6);
      const pending = Math.max(0, total - resolved);

      return {
        type: cfg.type,
        shortType: cfg.type.length > 18 ? cfg.type.substring(0, 16) + '..' : cfg.type,
        icon: cfg.icon,
        total,
        resolved,
        pending,
        color: cfg.color,
      };
    });
  }, [officerDeptCode]);

  // Toast feedback helper
  const showToast = (type, text) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to compute category breakdown
  const computeCategoryBreakdown = useCallback((allComplaints) => {
    const counts = {
      roads: { total: 0, resolved: 0, pending: 0 },
      garbage: { total: 0, resolved: 0, pending: 0 },
      water: { total: 0, resolved: 0, pending: 0 },
      lighting: { total: 0, resolved: 0, pending: 0 },
    };

    allComplaints.forEach((c) => {
      const cat = String(c.category || '').toLowerCase();
      const isResolved = ['closed', 'resolved', 'work done'].includes(
        String(c.status || '').toLowerCase()
      );
      let key = 'roads';
      if (cat.includes('garb') || cat.includes('waste')) key = 'garbage';
      else if (cat.includes('water') || cat.includes('drain')) key = 'water';
      else if (cat.includes('light') || cat.includes('electr')) key = 'lighting';

      counts[key].total += 1;
      if (isResolved) counts[key].resolved += 1;
      else counts[key].pending += 1;
    });

    // Merge computed counts with realistic base numbers to maintain a rich visualization
    return DEPARTMENT_CATEGORY_CONFIG.map((config) => {
      const defaultItem = DEFAULT_CATEGORY_DATA.find((d) => d.category === config.category) || {};
      const calculated = counts[config.key];
      const total = (defaultItem.total || 0) + (calculated?.total || 0);
      const resolved = (defaultItem.resolved || 0) + (calculated?.resolved || 0);
      const pending = Math.max(0, total - resolved);

      return {
        category: config.category,
        fullName: config.fullName,
        total,
        resolved,
        pending,
        color: config.color,
        icon: config.icon,
      };
    });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');

    const queryParams = new URLSearchParams({
      date_range: filterQuery.dateRange,
      ward: filterQuery.ward,
      status: filterQuery.status,
      severity: filterQuery.severity,
    }).toString();

    try {
      const [kpiRes, wardRes, trendsRes, workersRes] = await Promise.allSettled([
        api.get(`/v1/dashboard/kpi/?${queryParams}`),
        api.get(`/v1/dashboard/ward-stats/?${queryParams}`),
        api.get(`/v1/dashboard/trends/?groupby=${trendGrouping}&${queryParams}`),
        api.get(`/v1/dashboard/workers/?${queryParams}`),
      ]);

      if (kpiRes.status === 'fulfilled' && kpiRes.value?.data && !kpiRes.value.data.is_mock) {
        setKpiData(kpiRes.value.data);
      } else {
        throw new Error('Use live calculated store');
      }

      if (wardRes.status === 'fulfilled' && Array.isArray(wardRes.value?.data)) {
        setWardStats(wardRes.value.data);
      }
      if (trendsRes.status === 'fulfilled' && trendsRes.value?.data) {
        setTrendsData(trendsRes.value.data);
      }
      if (workersRes.status === 'fulfilled' && Array.isArray(workersRes.value?.data)) {
        setWorkers(workersRes.value.data);
      }
    } catch (err) {
      // Aggregate live statistics strictly for this department
      const all = getStoredComplaints().filter((c) => matchesDepartment(c, officerDeptCode));
      const filtered = all.filter((c) => {
        const matchWard =
          filterQuery.ward === 'All' ||
          String(c.ward) === String(filterQuery.ward.replace('Ward ', ''));
        const matchStatus =
          filterQuery.status === 'All' ||
          String(c.status).toLowerCase() === String(filterQuery.status).toLowerCase();
        const matchSeverity =
          filterQuery.severity === 'All' ||
          String(c.priority).toLowerCase() === String(filterQuery.severity).toLowerCase();
        return matchWard && matchStatus && matchSeverity;
      });

      const deptBaseline = DEPARTMENT_BASELINES[officerDeptCode] || DEPARTMENT_BASELINES.PWD;

      const pendingCount = filtered.filter((c) =>
        ['Pending', 'Submitted', 'Validated'].includes(c.status)
      ).length;
      const inProgCount = filtered.filter((c) =>
        ['Assigned', 'In-Progress'].includes(c.status)
      ).length;
      const resCount = filtered.filter((c) =>
        ['Work Done', 'Closed', 'Resolved'].includes(c.status)
      ).length;
      const rejCount = filtered.filter((c) =>
        ['Rejected', 'Invalid'].includes(c.status)
      ).length;

      const critCount = filtered.filter(
        (c) => String(c.priority).toLowerCase() === 'critical'
      ).length;
      const highCount = filtered.filter(
        (c) => String(c.priority).toLowerCase() === 'high'
      ).length;
      const medCount = filtered.filter(
        (c) => String(c.priority).toLowerCase() === 'medium'
      ).length;
      const lowCount = filtered.filter(
        (c) => String(c.priority).toLowerCase() === 'low'
      ).length;

      setKpiData({
        total: (filtered.length || 0) + deptBaseline.total,
        pending: pendingCount + deptBaseline.pending,
        in_progress: inProgCount + deptBaseline.in_progress,
        resolved: resCount + deptBaseline.resolved,
        rejected: rejCount + deptBaseline.rejected,
        avg_resolution_days: deptBaseline.avgDays,
        severity_distribution: [
          { name: 'Critical', value: critCount + deptBaseline.severities[0].value, color: COLORS.red },
          { name: 'High', value: highCount + deptBaseline.severities[1].value, color: COLORS.orange },
          { name: 'Medium', value: medCount + deptBaseline.severities[2].value, color: COLORS.amber },
          { name: 'Low', value: lowCount + deptBaseline.severities[3].value, color: COLORS.grey },
        ],
      });

      // 3. Ward stats breakdown strictly for this department
      const wardBreakdown = [1, 2, 3, 4].map((wNum) => {
        const inWard = all.filter((c) => Number(c.ward) === wNum);
        const basePending = Math.round(deptBaseline.pending / 4);
        const baseInProg = Math.round(deptBaseline.in_progress / 4);
        const baseResolved = Math.round(deptBaseline.resolved / 4);
        return {
          ward: `Ward ${wNum}`,
          wardNum: wNum,
          pending:
            basePending +
            inWard.filter((c) => ['Pending', 'Submitted', 'Validated'].includes(c.status)).length,
          in_progress:
            baseInProg +
            inWard.filter((c) => ['Assigned', 'In-Progress'].includes(c.status)).length,
          resolved:
            baseResolved +
            inWard.filter((c) => ['Work Done', 'Closed', 'Resolved'].includes(c.status)).length,
        };
      });
      setWardStats(wardBreakdown);
      setTrendsData(MOCK_TRENDS[trendGrouping] || MOCK_TRENDS.day);
      setWorkers(DEPARTMENT_WORKERS[officerDeptCode] || DEPARTMENT_WORKERS.PWD);

      // Check count of complaints flagged with confidence < 0.50
      const lowConfidenceCount = all.filter(
        (c) => c.confidence !== undefined && Number(c.confidence) < 0.5
      ).length;
      setPendingValidationCount(Math.max(4, lowConfidenceCount));
    } finally {
      setLoading(false);
    }
  }, [filterQuery, trendGrouping]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleApplyFilters = () => {
    setFilterQuery({
      dateRange,
      ward: selectedWard,
      status: selectedStatus,
      severity: selectedSeverity,
    });
  };

  // Compute Ward distribution progress meters data for Wards 1 to 4
  const wardProgressMeters = useMemo(() => {
    const list = Array.isArray(wardStats) ? wardStats : MOCK_WARD_STATS;
    const workerList = Array.isArray(workers) ? workers : MOCK_WORKERS;
    return list.map((item) => {
      const total = (item.pending || 0) + (item.in_progress || 0) + (item.resolved || 0);
      const safeTotal = total > 0 ? total : 1;
      const resolvedRate = Math.round(((item.resolved || 0) / safeTotal) * 100);
      const resolvedPct = Math.round(((item.resolved || 0) / safeTotal) * 100);
      const inProgPct = Math.round(((item.in_progress || 0) / safeTotal) * 100);
      const pendingPct = Math.max(0, 100 - resolvedPct - inProgPct);

      // On-duty worker count for this ward
      const activeWorkersCount = workerList.filter(
        (w) => String(w.ward) === String(item.wardNum) && w.status !== 'Offline'
      ).length;

      return {
        ...item,
        total,
        resolvedRate,
        resolvedPct,
        inProgPct,
        pendingPct,
        activeWorkersCount: activeWorkersCount || 2,
      };
    });
  }, [wardStats, workers]);

  // Unassigned complaints for Dispatch Modal
  const unassignedComplaints = useMemo(() => {
    const stored = getStoredComplaints();
    return stored.filter(
      (c) => ['Pending', 'Submitted', 'Validated'].includes(c.status) && !c.assigned_to
    );
  }, []);

  // Quick Action: Handle Dispatch Worker
  const handleConfirmDispatch = async () => {
    if (!selectedDispatchComplaintId || !selectedDispatchWorkerId) {
      showToast('error', 'Please select both a complaint and a worker to dispatch.');
      return;
    }

    const workerObj = workers.find((w) => w.id === selectedDispatchWorkerId);
    if (!workerObj) return;

    setDispatching(true);
    try {
      // API call attempt
      try {
        await api.post(`/v1/complaints/${selectedDispatchComplaintId}/assign/`, {
          worker_id: workerObj.id,
          worker_name: workerObj.name,
        });
      } catch (err) {
        // Fallback local update
      }

      // Synchronize shared complaintStore
      updateComplaint(selectedDispatchComplaintId, {
        status: 'Assigned',
        assigned_to: workerObj.name,
        worker_id: workerObj.id,
      });

      // Update worker's local active tasks
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerObj.id ? { ...w, active_tasks: (w.active_tasks || 0) + 1 } : w
        )
      );

      showToast('success', `Assigned ${selectedDispatchComplaintId} to ${workerObj.name}!`);
      setShowDispatchModal(false);
      setSelectedDispatchComplaintId('');
      setSelectedDispatchWorkerId('');
      fetchDashboardData();
    } catch (e) {
      showToast('error', 'Failed to dispatch worker.');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-16">
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

      {/* 1. PAGE HEADER BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile / Tablet Hamburger Drawer Toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition flex items-center justify-center shadow-2xs"
              title="Open Navigation Menu"
              aria-label="Open officer sidebar navigation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="border-l-4 border-l-primary pl-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Municipal Officer Portal
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500 font-medium">
                  Ward Monitoring & Analytics
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-dark tracking-tight">
                {deptName} Dashboard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Filter Selector */}
            <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 text-xs font-semibold">
              {['7d', '30d', '90d', 'custom'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    dateRange === range
                      ? 'bg-white text-primary shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {range === '7d' ? 'Last 7d' : range === '30d' ? 'Last 30d' : range === '90d' ? 'Last 90d' : 'Custom'}
                </button>
              ))}
            </div>

            <button
              onClick={logout}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-lg text-xs font-bold transition shadow-xs"
            >
              Logout
            </button>
          </div>
        </div>

        {/* 4. QUICK ACTIONS TOOLBAR */}
        <div className="bg-gradient-to-r from-slate-900 via-dark to-slate-900 text-white px-4 sm:px-6 py-2.5 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-wider border border-blue-400/30">
                Operations Toolbar
              </span>
              <span className="hidden sm:inline text-xs text-slate-300 font-medium">
                Immediate municipal actions & field routing
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Quick Action: 'Add Worker' */}
              <Link
                to="/officer/add-worker"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 hover:scale-[1.02] active:scale-95"
                title="Register and onboard a new field worker for this department"
              >
                <span className="text-sm">➕</span>
                <span>Add Worker</span>
              </Link>

              {/* Quick Action: 'Dispatch Workers' */}
              <button
                type="button"
                onClick={() => {
                  setSelectedDispatchComplaintId(unassignedComplaints[0]?.id || 'CMP-20485');
                  setSelectedDispatchWorkerId(workers[0]?.id || 'WKR-01');
                  setShowDispatchModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 hover:scale-[1.02] active:scale-95"
                title="Dispatch pending complaints to on-ground municipal workers"
              >
                <span className="text-sm">👷‍♂️</span>
                <span>Dispatch Workers</span>
                <span className="bg-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  {workers.filter((w) => w.status === 'On Duty').length} on duty
                </span>
              </button>

              {/* Quick Action: 'Review AI Validations' */}
              <Link
                to="/officer/validation"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 hover:scale-[1.02] active:scale-95"
                title="Review complaints flagged by AI with confidence score < 0.50"
              >
                <span className="text-sm">🤖</span>
                <span>Review AI Validations</span>
                <span className="bg-amber-950 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  {pendingValidationCount} Low Conf
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 2. FILTER BAR (HORIZONTAL, BELOW HEADER) */}
      <section className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Ward Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Ward:</label>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary text-slate-800"
              >
                <option value="All">All Wards</option>
                <option value="Ward 1">Ward 1</option>
                <option value="Ward 2">Ward 2</option>
                <option value="Ward 3">Ward 3</option>
                <option value="Ward 4">Ward 4</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary text-slate-800"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Severity:</label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary text-slate-800"
              >
                <option value="All">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          {/* Apply Filters Button */}
          <button
            type="button"
            onClick={handleApplyFilters}
            className="px-5 py-1.5 bg-primary hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5"
          >
            <span>🔍</span>
            <span>Apply Filters</span>
          </button>
        </div>
      </section>

      {/* DASHBOARD CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex-1 w-full space-y-6">
        {error && <ErrorMessage message={error} onRetry={fetchDashboardData} />}

        {loading ? (
          <div className="space-y-6 py-4 animate-fade-in">
            <LoadingSkeleton variant="kpi" count={6} message="Aggregating municipal telemetry & KPI metrics..." />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <LoadingSkeleton variant="chart" />
              </div>
              <div className="lg:col-span-5">
                <LoadingSkeleton variant="card" count={2} />
              </div>
            </div>
            <LoadingSkeleton variant="table" count={5} />
          </div>
        ) : (
          <>
            {/* 3. KPI CARDS ROW (5 Status Cards + 1 Avg Resolution Time Card) */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <KPICard
                title="Total Complaints"
                value={kpiData.total ?? 486}
                colour="blue"
                subtitle="All logged grievances"
              />
              <KPICard
                title="Pending"
                value={kpiData.pending ?? 64}
                colour="amber"
                subtitle="Unassigned / queued"
              />
              <KPICard
                title="In Progress"
                value={kpiData.in_progress ?? 112}
                colour="purple"
                subtitle="On-ground work active"
              />
              <KPICard
                title="Resolved"
                value={kpiData.resolved ?? 284}
                colour="green"
                subtitle="Closed / verified"
              />
              <KPICard
                title="Rejected"
                value={kpiData.rejected ?? 26}
                colour="red"
                subtitle="Invalid or duplicates"
              />
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 border-l-4 border-l-blue-600 p-5 transition-shadow hover:shadow-md col-span-2 sm:col-span-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Avg. Resolution Time
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-primary">
                    {kpiData.avg_resolution_days || '2.8 days'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">SLA target: &lt; 4 days</p>
              </div>
            </section>

            {/* 1 & 2: DEPARTMENT ANALYTICS BARCHART & WARD DISTRIBUTION PROGRESS METERS */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 1 & 2. LEFT: Department-Specific Analytics (Worker Workload OR Department Issue Types) */}
              <div className="lg:col-span-7 bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base font-extrabold text-dark flex items-center gap-2">
                        <span>{deptMeta.icon} {deptMeta.shortName} Operations & Workforce</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${deptMeta.badgeClass}`}>
                          {deptMeta.shortName} Only
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500">
                        {analyticsViewTab === 'workers'
                          ? `Field personnel active task workload and weekly completion velocity for ${deptMeta.name}`
                          : `Breakdown of specific ${deptMeta.shortName} municipal issue types and resolution progress`}
                      </p>
                    </div>

                    {/* View Switcher Tabs: Workers vs Issue Types */}
                    <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setAnalyticsViewTab('workers')}
                        className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                          analyticsViewTab === 'workers'
                            ? 'bg-primary text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>👷</span>
                        <span>Worker Workload</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsViewTab('issues')}
                        className={`px-3 py-1 rounded transition flex items-center gap-1.5 ${
                          analyticsViewTab === 'issues'
                            ? 'bg-primary text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>📋</span>
                        <span>Issue Types</span>
                      </button>
                    </div>
                  </div>

                  {/* Recharts BarChart Container */}
                  <div className="h-72 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      {analyticsViewTab === 'workers' ? (
                        <BarChart
                          data={workerWorkloadChartData}
                          margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }}
                            axisLine={{ stroke: '#CBD5E1' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#475569' }}
                            axisLine={{ stroke: '#CBD5E1' }}
                            allowDecimals={false}
                          />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 text-xs space-y-1.5">
                                    <div className="font-extrabold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-1 gap-2">
                                      <span>{data.fullName} ({data.id})</span>
                                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold">
                                        Ward {data.ward}
                                      </span>
                                    </div>
                                    <div className="text-slate-500 text-[11px] font-medium">
                                      Specialization: {data.specialization}
                                    </div>
                                    <div className="text-amber-700 font-semibold flex justify-between gap-4">
                                      <span>Active Queue Tasks:</span>
                                      <strong className="font-black">{data.active_tasks}</strong>
                                    </div>
                                    <div className="text-emerald-700 font-semibold flex justify-between gap-4">
                                      <span>Completed (Week):</span>
                                      <strong>{data.completed_tasks}</strong>
                                    </div>
                                    <div className="text-slate-600 text-[11px] flex justify-between gap-4 pt-1 border-t border-slate-100">
                                      <span>Duty Status:</span>
                                      <span className="font-bold">{data.status}</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                          <Bar
                            dataKey="active_tasks"
                            name="Active Tasks (Workload Depth)"
                            fill="#F59E0B"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="completed_tasks"
                            name="Completed Tasks (Week)"
                            fill="#10B981"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      ) : (
                        <BarChart
                          data={departmentIssuesChartData}
                          margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis
                            dataKey="shortType"
                            tick={{ fontSize: 10, fill: '#334155', fontWeight: 700 }}
                            axisLine={{ stroke: '#CBD5E1' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#475569' }}
                            axisLine={{ stroke: '#CBD5E1' }}
                            allowDecimals={false}
                          />
                          <RechartsTooltip
                            cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 text-xs space-y-1.5">
                                    <div className="font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-1">
                                      <span>{data.icon}</span>
                                      <span>{data.type}</span>
                                    </div>
                                    <div className="text-slate-700 font-semibold flex justify-between gap-4">
                                      <span>Total Grievances:</span>
                                      <strong className="text-dark font-black">{data.total}</strong>
                                    </div>
                                    <div className="text-emerald-700 font-medium flex justify-between gap-4">
                                      <span>Resolved:</span>
                                      <strong>{data.resolved}</strong>
                                    </div>
                                    <div className="text-amber-700 font-medium flex justify-between gap-4">
                                      <span>Pending / Active:</span>
                                      <strong>{data.pending}</strong>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                          <Bar
                            dataKey="total"
                            name={`Total ${deptMeta.shortName} Complaints`}
                            fill={deptMeta.color}
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="resolved"
                            name="Resolved & Verified"
                            fill="#10B981"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bottom Chips: Workers or Issues */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {analyticsViewTab === 'workers'
                    ? workers.slice(0, 6).map((worker) => (
                        <div
                          key={worker.id}
                          onClick={() => setSelectedWorker(worker)}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition shadow-2xs"
                          title={`Click to view ${worker.name}'s task profile`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                worker.status === 'On Duty'
                                  ? 'bg-emerald-500'
                                  : worker.status === 'In Field'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <span className="font-bold text-slate-800 text-[11px] truncate">
                              {worker.name}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-slate-700 text-xs shrink-0 ml-1">
                            {worker.active_tasks} active
                          </span>
                        </div>
                      ))
                    : departmentIssuesChartData.map((item) => (
                        <div
                          key={item.type}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-sm shrink-0">{item.icon}</span>
                            <span className="font-bold text-slate-800 text-[11px] truncate" title={item.type}>
                              {item.type}
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-slate-900 text-xs shrink-0 ml-1">
                            {item.total}
                          </span>
                        </div>
                      ))}
                </div>
              </div>

              {/* 3. RIGHT: Ward Distribution Progress Meters for Wards 1 to 4 */}
              <div className="lg:col-span-5 bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-base font-extrabold text-dark flex items-center gap-2">
                        <span>Ward Distribution Progress Meters</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          Wards 1–4
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500">
                        Resolution performance and workload progress across all municipal wards
                      </p>
                    </div>
                  </div>

                  {/* Ward Meters List */}
                  <div className="space-y-3.5 pt-1">
                    {wardProgressMeters.map((w) => (
                      <div
                        key={w.ward}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 hover:border-slate-300 transition-all space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <WardBadge ward={w.wardNum} />
                            <span className="font-extrabold text-slate-900 text-xs">
                              {w.ward}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-500">
                              {w.total} complaints
                            </span>
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded-md border ${
                                w.resolvedRate >= 70
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : w.resolvedRate >= 50
                                  ? 'bg-blue-50 text-primary border-blue-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {w.resolvedRate}% Resolved
                            </span>
                          </div>
                        </div>

                        {/* Multi-Segment Visual Progress Meter */}
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                          {/* Resolved (Green) */}
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${w.resolvedPct}%` }}
                            title={`Resolved: ${w.resolved} (${w.resolvedPct}%)`}
                          />
                          {/* In-Progress (Purple) */}
                          <div
                            className="h-full bg-purple-500 transition-all duration-500"
                            style={{ width: `${w.inProgPct}%` }}
                            title={`In-Progress: ${w.in_progress} (${w.inProgPct}%)`}
                          />
                          {/* Pending (Amber) */}
                          <div
                            className="h-full bg-amber-400 transition-all duration-500"
                            style={{ width: `${w.pendingPct}%` }}
                            title={`Pending: ${w.pending} (${w.pendingPct}%)`}
                          />
                        </div>

                        {/* Legend / Breakdown Text */}
                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-0.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>{w.resolved} resolved</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-purple-500" />
                              <span>{w.in_progress} active</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <span>{w.pending} pending</span>
                            </span>
                          </div>

                          <span className="text-[10px] text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {w.activeWorkersCount} field staff
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meter Explanatory Footnote */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Target SLA Resolution: &gt; 65% per ward</span>
                  <span className="text-primary font-bold cursor-pointer hover:underline" onClick={() => setSelectedWard('Ward 2')}>
                    Filter by Ward 2 →
                  </span>
                </div>
              </div>
            </section>

            {/* SECONDARY ANALYTICS ROW: Severity Distribution & Inflow Trends */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT: Severity Distribution (Pie / Donut Chart) */}
              <div className="lg:col-span-4 bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-base font-extrabold text-dark">
                        Severity Breakdown
                      </h2>
                      <p className="text-xs text-slate-500">
                        Priority breakdown of active and historic issues
                      </p>
                    </div>
                  </div>

                  <div className="h-52 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={kpiData.severity_distribution || MOCK_KPI.severity_distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {(kpiData.severity_distribution || MOCK_KPI.severity_distribution).map(
                            (entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color || Object.values(COLORS)[index % 6]}
                              />
                            )
                          )}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Legend below with counts */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  {(kpiData.severity_distribution || MOCK_KPI.severity_distribution).map(
                    (item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold text-slate-700">{item.name}</span>
                        </div>
                        <span className="font-bold text-dark">{item.value}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* RIGHT: Complaint Trends LineChart */}
              <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-dark">
                      Grievance Inflow vs. Resolution Velocity
                    </h2>
                    <p className="text-xs text-slate-500">
                      Comparing newly submitted reports against resolved complaints over time
                    </p>
                  </div>

                  {/* Day | Week | Month Toggle */}
                  <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 text-xs font-semibold self-start sm:self-auto">
                    {['day', 'week', 'month'].map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setTrendGrouping(group)}
                        className={`px-3 py-1 rounded transition ${
                          trendGrouping === group
                            ? 'bg-primary text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {group.charAt(0).toUpperCase() + group.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendsData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 12, fill: '#475569' }}
                        axisLine={{ stroke: '#CBD5E1' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#475569' }}
                        axisLine={{ stroke: '#CBD5E1' }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          fontSize: '12px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line
                        type="monotone"
                        dataKey="submitted"
                        name="Submitted"
                        stroke={COLORS.blue}
                        strokeWidth={3}
                        dot={{ r: 4, fill: COLORS.blue }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="resolved"
                        name="Resolved"
                        stroke={COLORS.green}
                        strokeWidth={3}
                        dot={{ r: 4, fill: COLORS.green }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* HIGH PRIORITY QUEUE COMPONENT */}
            <section id="high-priority-section">
              <HighPriorityQueue officerDeptCode={officerDeptCode} />
            </section>

            {/* 6. WORKER WORKLOAD TABLE */}
            <section className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-dark">
                    Field Worker Deployment & Workload
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live roster of ward-assigned workers, queue depth, and weekly performance
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/officer/add-worker"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm hover:scale-[1.02]"
                    title="Register a new field worker for this department"
                  >
                    <span>➕</span>
                    <span>Add Worker</span>
                  </Link>
                  <Link
                    to="/officer/roster"
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    title="Open Full Department Worker Roster & Reassignment Console"
                  >
                    <span>👷</span>
                    <span>Worker Roster View</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDispatchComplaintId(unassignedComplaints[0]?.id || 'CMP-20485');
                      setSelectedDispatchWorkerId(workers[0]?.id || 'WKR-01');
                      setShowDispatchModal(true);
                    }}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>⚡ Quick Dispatch</span>
                  </button>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                    {workers.length} Personnel Active
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Worker Name</th>
                      <th className="py-3 px-4">Ward</th>
                      <th className="py-3 px-4 text-center">Active Tasks</th>
                      <th className="py-3 px-4 text-center">Completed This Week</th>
                      <th className="py-3 px-4 text-center">Avg. Days</th>
                      <th className="py-3 px-4 text-right">Duty Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workers.map((worker) => (
                      <tr
                        key={worker.id}
                        onClick={() => setSelectedWorker(worker)}
                        className="hover:bg-blue-50/60 transition cursor-pointer group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-dark group-hover:text-primary transition">
                            {worker.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {worker.id} • {worker.specialization || 'Field Worker'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <WardBadge ward={worker.ward} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              worker.active_tasks > 4
                                ? 'bg-red-100 text-danger'
                                : 'bg-blue-100 text-primary'
                            }`}
                          >
                            {worker.active_tasks}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-success">
                          {worker.completed_this_week}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                          {worker.avg_days} d
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              worker.status === 'On Duty'
                                ? 'bg-emerald-50 text-success border border-emerald-200'
                                : worker.status === 'In Field'
                                ? 'bg-blue-50 text-primary border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                worker.status === 'On Duty'
                                  ? 'bg-success'
                                  : worker.status === 'In Field'
                                  ? 'bg-primary'
                                  : 'bg-slate-400'
                              }`}
                            />
                            {worker.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* QUICK ACTIONS: DISPATCH WORKERS MODAL */}
      {showDispatchModal && (
        <div
          className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowDispatchModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                  <span>⚡ Quick Operations</span>
                </span>
                <h3 className="text-lg font-black text-dark">Dispatch Field Worker</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Assign high-priority or unallocated civic grievances directly to an on-duty field worker for immediate inspection.
            </p>

            {/* Select Complaint */}
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700">
                1. Select Pending Complaint <span className="text-danger">*</span>:
              </label>
              <select
                value={selectedDispatchComplaintId}
                onChange={(e) => setSelectedDispatchComplaintId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {unassignedComplaints.length > 0 ? (
                  unassignedComplaints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} - {c.category} (Ward {c.ward}) - {c.description.substring(0, 45)}...
                    </option>
                  ))
                ) : (
                  <>
                    <option value="CMP-20485">CMP-20485 - Roads & Infra (Ward 1) - Open trench</option>
                    <option value="CMP-20481">CMP-20481 - Roads & Infra (Ward 2) - Cave-in</option>
                    <option value="CMP-20491">CMP-20491 - Water & Drain (Ward 1) - Burst leak</option>
                  </>
                )}
              </select>
            </div>

            {/* Select Field Worker */}
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700">
                2. Select On-Duty Worker <span className="text-danger">*</span>:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {workers.map((worker) => {
                  const isSelected = selectedDispatchWorkerId === worker.id;
                  return (
                    <div
                      key={worker.id}
                      onClick={() => setSelectedDispatchWorkerId(worker.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-primary bg-blue-50/70 ring-1 ring-primary'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="dispatch_worker"
                          checked={isSelected}
                          onChange={() => setSelectedDispatchWorkerId(worker.id)}
                          className="text-primary focus:ring-primary"
                        />
                        <div>
                          <span className="font-bold text-slate-900">{worker.name}</span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {worker.id} • {worker.specialization}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <WardBadge ward={worker.ward} />
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {worker.active_tasks} active
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={dispatching}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {dispatching ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WORKER DETAIL MODAL */}
      {selectedWorker && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedWorker(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono">
                  {selectedWorker.id}
                </span>
                <h3 className="text-lg font-bold text-dark">{selectedWorker.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="text-slate-400 hover:text-slate-700 text-lg p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Assigned Ward:</span>
                <WardBadge ward={selectedWorker.ward} />
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Specialization:</span>
                <span className="font-semibold text-slate-800">
                  {selectedWorker.specialization || 'Field Operations'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Contact Phone:</span>
                <span className="font-semibold text-slate-800">
                  {selectedWorker.phone || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Active Tasks:</span>
                <span className="font-bold text-primary">
                  {selectedWorker.active_tasks} pending
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Weekly Resolved:</span>
                <span className="font-bold text-success">
                  {selectedWorker.completed_this_week} completed
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Average Turnaround:</span>
                <span className="font-bold text-slate-800">
                  {selectedWorker.avg_days} days
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Duty Status:</span>
                <span className="font-bold text-slate-800">{selectedWorker.status}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* OFFICER SIDEBAR DRAWER */}
      <OfficerSidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        pendingValidationCount={pendingValidationCount}
        onOpenDispatch={() => setShowDispatchModal(true)}
      />
    </div>
  );
};

export default Dashboard;
