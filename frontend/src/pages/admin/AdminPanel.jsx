import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import WardBadge from '../../components/WardBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { formatDeptName } from '../../utils/chartHelpers';

// 4 Municipal Departments
const DEPARTMENTS = [
  { id: 'PWD', name: 'Public Works (PWD)', icon: '🛣️', color: 'border-l-primary', accent: 'text-primary' },
  { id: 'SWM', name: 'Solid Waste Management (SWM)', icon: '🗑️', color: 'border-l-success', accent: 'text-success' },
  { id: 'WSD', name: 'Water Supply & Drainage (WSD)', icon: '💧', color: 'border-l-blue-600', accent: 'text-blue-600' },
  { id: 'ELEC', name: 'Street Lighting & Electrical (ELEC)', icon: '💡', color: 'border-l-warning', accent: 'text-warning' },
];

// 16 Demo Workers (4 per department across 4 wards)
const DEMO_WORKERS_16 = [
  // PWD
  { id: 'W-PWD-1', name: 'Suresh Patil', dept: 'PWD', ward: 1, designation: 'Senior Road Tech', active_tasks: 3, completed_week: 11, status: 'On Duty' },
  { id: 'W-PWD-2', name: 'Ramesh Kumar', dept: 'PWD', ward: 2, designation: 'Heavy Machinery Tech', active_tasks: 4, completed_week: 8, status: 'On Duty' },
  { id: 'W-PWD-3', name: 'Anil Deshmukh', dept: 'PWD', ward: 3, designation: 'Asphalt Specialist', active_tasks: 2, completed_week: 14, status: 'In Field' },
  { id: 'W-PWD-4', name: 'Santosh Shinde', dept: 'PWD', ward: 4, designation: 'Emergency Patch Tech', active_tasks: 1, completed_week: 15, status: 'On Duty' },
  // SWM
  { id: 'W-SWM-1', name: 'Ganesh Shinde', dept: 'SWM', ward: 1, designation: 'Sanitation Inspector', active_tasks: 2, completed_week: 22, status: 'On Duty' },
  { id: 'W-SWM-2', name: 'Pooja Jadhav', dept: 'SWM', ward: 2, designation: 'Waste Route Lead', active_tasks: 5, completed_week: 18, status: 'In Field' },
  { id: 'W-SWM-3', name: 'Sachin Kamble', dept: 'SWM', ward: 3, designation: 'Bio-Waste Handler', active_tasks: 1, completed_week: 26, status: 'On Duty' },
  { id: 'W-SWM-4', name: 'Mahesh More', dept: 'SWM', ward: 4, designation: 'Dumping Ground Supervisor', active_tasks: 3, completed_week: 19, status: 'On Duty' },
  // WSD
  { id: 'W-WSD-1', name: 'Deepak Naik', dept: 'WSD', ward: 1, designation: 'Pipeline Fitter', active_tasks: 4, completed_week: 12, status: 'On Duty' },
  { id: 'W-WSD-2', name: 'Rahul Sawant', dept: 'WSD', ward: 2, designation: 'Drainage Jetting Operator', active_tasks: 2, completed_week: 9, status: 'In Field' },
  { id: 'W-WSD-3', name: 'Kiran Mane', dept: 'WSD', ward: 3, designation: 'Valve Gate Specialist', active_tasks: 3, completed_week: 11, status: 'On Duty' },
  { id: 'W-WSD-4', name: 'Ajit Pawar', dept: 'WSD', ward: 4, designation: 'Culvert Desilting Tech', active_tasks: 1, completed_week: 14, status: 'Break' },
  // ELEC
  { id: 'W-ELEC-1', name: 'Sunil Gaikwad', dept: 'ELEC', ward: 1, designation: 'Lineman', active_tasks: 3, completed_week: 16, status: 'On Duty' },
  { id: 'W-ELEC-2', name: 'Nitin Kadam', dept: 'ELEC', ward: 2, designation: 'Pole Maintenance Electrician', active_tasks: 2, completed_week: 18, status: 'On Duty' },
  { id: 'W-ELEC-3', name: 'Pravin Joshi', dept: 'ELEC', ward: 3, designation: 'Transformer Tech', active_tasks: 6, completed_week: 10, status: 'In Field' },
  { id: 'W-ELEC-4', name: 'Vikram Salunkhe', dept: 'ELEC', ward: 4, designation: 'LED High-Mast Tech', active_tasks: 0, completed_week: 20, status: 'On Duty' },
];

const DEPT_STATS_DATA = {
  ALL: { total: 1450, pending: 180, in_progress: 320, resolved: 950 },
  PWD: { total: 486, pending: 64, in_progress: 112, resolved: 310 },
  SWM: { total: 410, pending: 42, in_progress: 88, resolved: 280 },
  WSD: { total: 320, pending: 45, in_progress: 72, resolved: 203 },
  ELEC: { total: 234, pending: 29, in_progress: 48, resolved: 157 },
};

const AdminPanel = () => {
  const { user, logout } = useAuth();

  // Dept Switcher: 'ALL' | 'PWD' | 'SWM' | 'WSD' | 'ELEC'
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Worker table filters
  const [workerSearch, setWorkerSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workersList, setWorkersList] = useState(DEMO_WORKERS_16);

  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/v1/admin/overview/?dept=${selectedDept}`);
        if (res.data?.workers) {
          setWorkersList(res.data.workers);
        }
      } catch (err) {
        console.warn('Admin API not found, using 16 demo workers roster:', err.message);
        setWorkersList(DEMO_WORKERS_16);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [selectedDept]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workersList.filter((w) => {
      const matchDept = selectedDept === 'ALL' || w.dept === selectedDept;
      const matchWard = wardFilter === 'ALL' || String(w.ward) === String(wardFilter);
      const matchSearch =
        !workerSearch ||
        w.name.toLowerCase().includes(workerSearch.toLowerCase()) ||
        w.designation.toLowerCase().includes(workerSearch.toLowerCase()) ||
        w.id.toLowerCase().includes(workerSearch.toLowerCase());
      return matchDept && matchWard && matchSearch;
    });
  }, [workersList, selectedDept, wardFilter, workerSearch]);

  const currentStats = DEPT_STATS_DATA[selectedDept] || DEPT_STATS_DATA.ALL;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 border-l-4 border-l-purple pl-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple uppercase tracking-wider">
                  Municipal Administrator Portal
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500 font-medium">Cross-Department Governance</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-dark tracking-tight">
                JANMITRA City Operations Command
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/admin/cross-dept"
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple border border-purple-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="View Cross-Department Overview"
            >
              <span>🏛️</span>
              <span>All Depts Overview</span>
            </Link>

            <Link
              to="/admin/ledger"
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="City-Wide Complaints Ledger"
            >
              <span>📋</span>
              <span>Complaints Ledger</span>
            </Link>

            <Link
              to="/admin/workers"
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="Manage Municipal Workforce"
            >
              <span>👷</span>
              <span>Worker Management</span>
            </Link>

            <Link
              to="/admin/settings"
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple border border-purple-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="System Configuration & SLAs"
            >
              <span>⚙️</span>
              <span>Settings & SLAs</span>
            </Link>

            <span className="text-xs font-bold text-slate-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg hidden sm:inline-block">
              👤 {user?.name || 'Municipal Commissioner'} (Admin)
            </span>
            <button
              onClick={logout}
              className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-lg text-xs font-bold transition shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* DEPARTMENT SWITCHER TABS */}
      <section className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-slate-600 shrink-0">Filter Dept:</span>
            <button
              onClick={() => setSelectedDept('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                selectedDept === 'ALL'
                  ? 'bg-purple text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🌐 All Departments
            </button>

            {DEPARTMENTS.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  selectedDept === dept.id
                    ? 'bg-purple text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{dept.icon}</span>
                <span>{dept.id}</span>
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold text-slate-500">
            Viewing: <strong className="text-dark">{selectedDept === 'ALL' ? 'Entire Municipal Corporation' : formatDeptName(selectedDept)}</strong>
          </span>
        </div>
      </section>

      {/* MAIN ADMIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {error && <ErrorMessage message={error} />}

        {loading ? (
          <div className="py-20">
            <LoadingSpinner message="Aggregating cross-department telemetry..." />
          </div>
        ) : (
          <>
            {/* 1. CROSS-DEPT 4 CARDS OVERVIEW */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEPARTMENTS.map((dept) => {
                const stats = DEPT_STATS_DATA[dept.id];
                const isSelected = selectedDept === dept.id;

                return (
                  <div
                    key={dept.id}
                    onClick={() => setSelectedDept(dept.id)}
                    className={`bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 ${dept.color} p-5 cursor-pointer transition hover:shadow-md ${
                      isSelected ? 'ring-2 ring-purple shadow-md bg-purple-50/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{dept.icon}</span>
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        {dept.id}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-dark mt-2 line-clamp-1">
                      {dept.name}
                    </h3>

                    <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-xs text-slate-500">Total</span>
                        <div className="text-xl font-black text-dark">{stats.total}</div>
                      </div>
                      <div>
                        <span className="text-xs text-amber-700">Pending</span>
                        <div className="text-sm font-bold text-warning">{stats.pending}</div>
                      </div>
                      <div>
                        <span className="text-xs text-emerald-700">Resolved</span>
                        <div className="text-sm font-bold text-success">{stats.resolved}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* 2. SUMMARY METRICS FOR SELECTED VIEW */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-dark">
                    {selectedDept === 'ALL'
                      ? 'Consolidated Civic Grievances Overview'
                      : `${formatDeptName(selectedDept)} Operations`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live tally of incoming citizen reports vs resolution progress
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded text-slate-700">
                    {filteredWorkers.length} Field Workers Filtered
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-center">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div className="text-xs font-bold text-primary">Total Grievances</div>
                  <div className="text-2xl font-black text-dark mt-1">{currentStats.total}</div>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                  <div className="text-xs font-bold text-warning">Pending Review</div>
                  <div className="text-2xl font-black text-dark mt-1">{currentStats.pending}</div>
                </div>
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                  <div className="text-xs font-bold text-purple">In Progress</div>
                  <div className="text-2xl font-black text-dark mt-1">{currentStats.in_progress}</div>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <div className="text-xs font-bold text-success">Resolved & Verified</div>
                  <div className="text-2xl font-black text-dark mt-1">{currentStats.resolved}</div>
                </div>
              </div>
            </section>

            {/* 3. WORKER MANAGEMENT TABLE (SHOWS ALL 16 DEMO WORKERS, FILTERABLE) */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-dark">
                    Municipal Field Workforce Roster
                  </h2>
                  <p className="text-xs text-slate-500">
                    Complete personnel directory with live ward allocations and workload depth
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    type="text"
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                    placeholder="Search worker / designation..."
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple"
                  />

                  <select
                    value={wardFilter}
                    onChange={(e) => setWardFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple bg-white"
                  >
                    <option value="ALL">All Wards</option>
                    <option value="1">Ward 1</option>
                    <option value="2">Ward 2</option>
                    <option value="3">Ward 3</option>
                    <option value="4">Ward 4</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Worker ID & Name</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Ward</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-4 text-center">Active Tasks</th>
                      <th className="py-3 px-4 text-center">Completed (Week)</th>
                      <th className="py-3 px-4 text-right">Duty Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredWorkers.map((worker) => (
                      <tr key={worker.id} className="hover:bg-purple-50/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-dark">{worker.name}</div>
                          <div className="font-mono text-[11px] text-slate-400">{worker.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {worker.dept}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <WardBadge ward={worker.ward} />
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {worker.designation}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              worker.active_tasks > 3
                                ? 'bg-red-100 text-danger'
                                : 'bg-blue-100 text-primary'
                            }`}
                          >
                            {worker.active_tasks}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-success">
                          {worker.completed_week}
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
    </div>
  );
};

export default AdminPanel;
