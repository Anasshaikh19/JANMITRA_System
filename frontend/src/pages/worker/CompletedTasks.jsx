import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import WorkerLayout from '../../components/WorkerLayout';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import ErrorMessage from '../../components/ErrorMessage';
import { getStoredComplaints } from '../../utils/complaintStore';

// Default fallback photo for broken image links
const DEFAULT_FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80';

// Format relative date
const formatCompletedDate = (dateString) => {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Fallback seed tasks for archive if offline or API unavailable
const SEED_COMPLETED_TASKS = [
  {
    id: 'CMP-20483',
    category: 'Water & Drainage',
    dept: 'WSD',
    ward: 2,
    priority: 'Medium',
    status: 'Work Done',
    description: 'Main water delivery valve leaking clean drinking water on Sector 4 road.',
    address: 'Sector 4 Road, Near Water Booster Pump Station, Ward 2',
    created_at: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
    completed_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    repair_notes: 'Replaced faulty gasket and tightened high-pressure brass valve assembly.',
    has_photos: true,
    photo_count: 1,
    proof_photos: [
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600&auto=format&fit=crop&q=80',
    ],
  },
  {
    id: 'CMP-20484',
    category: 'Street Lighting & Electrical',
    dept: 'ELEC',
    ward: 2,
    priority: 'Low',
    status: 'Closed',
    description: 'Street light lamp post #14 flickering continuously at night.',
    address: 'Lane 7, Near Street Light Post #14, Ward 2',
    created_at: new Date(Date.now() - 86400 * 1000 * 5).toISOString(),
    completed_at: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
    repair_notes: 'Replaced blown 45W LED luminaire and cleaned junction contacts.',
    has_photos: false,
    photo_count: 0,
    proof_photos: [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
    ],
  },
  {
    id: 'CMP-20478',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    ward: 2,
    priority: 'High',
    status: 'Closed',
    description: 'Large shoulder crater on 2nd Crossroad causing vehicle slowdown and dust.',
    address: '2nd Crossroad Junction, Sector 2, Ward 2',
    created_at: new Date(Date.now() - 86400 * 1000 * 7).toISOString(),
    completed_at: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
    repair_notes: 'Filled with 40mm wet mix macadam, topped with bitumen patch and roller compacted.',
    has_photos: true,
    photo_count: 2,
    proof_photos: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
    ],
  },
];

/**
 * CompletedTasks Archive Screen:
 * 1. Fetch: GET /api/v1/worker/tasks/?status=completed
 * 2. Layout: Grid / list of resolved tasks
 */
const CompletedTasks = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // UI state: 'grid' | 'list'
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const workerWard = user?.ward || 2;
  const workerName = user?.name || 'Suresh Patil';

  // 1. Fetch: GET /api/v1/worker/tasks/?status=completed
  const fetchCompletedTasks = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await api.get('/v1/worker/tasks/?status=completed');
      const data = response.data;
      const list = Array.isArray(data) ? data : data?.tasks || [];
      if (Array.isArray(list) && list.length > 0) {
        setTasks(list);
        return;
      }
      throw new Error('Using local synced store');
    } catch {
      // Local fallback from synchronized complaint repository
      const allStored = getStoredComplaints();
      const resolvedList = allStored.filter((item) => {
        const status = String(item.status || '').trim();
        return ['Work Done', 'Closed', 'Resolved', 'Verified'].includes(status);
      });

      const combined = resolvedList.length > 0 ? resolvedList : SEED_COMPLETED_TASKS;

      // Ensure address and completed timestamp
      const normalized = combined.map((item, idx) => ({
        ...item,
        address:
          item.address ||
          item.location_address ||
          `Civic Sector ${item.ward || 2}, Main Road #${idx + 1}, Ward ${item.ward || 2}`,
        completed_at: item.completed_at || item.updated_at || item.created_at,
      }));

      setTasks(normalized);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCompletedTasks();
  }, [fetchCompletedTasks]);

  // Filter tasks by ward, category, and search query
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Ward match
        const itemWard = task.ward ?? task.ward_no ?? null;
        if (workerWard && itemWard && String(itemWard) !== String(workerWard)) {
          return false;
        }

        // Category filter
        if (categoryFilter !== 'all') {
          const cat = String(task.category || '').toLowerCase();
          if (!cat.includes(categoryFilter.toLowerCase())) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchId = task.id && task.id.toLowerCase().includes(q);
          const matchDesc = task.description && task.description.toLowerCase().includes(q);
          const matchAddr = task.address && task.address.toLowerCase().includes(q);
          const matchNotes = task.repair_notes && task.repair_notes.toLowerCase().includes(q);
          return matchId || matchDesc || matchAddr || matchNotes;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort most recently completed first
        const dateA = new Date(a.completed_at || a.created_at).getTime() || 0;
        const dateB = new Date(b.completed_at || b.created_at).getTime() || 0;
        return dateB - dateA;
      });
  }, [tasks, workerWard, categoryFilter, searchQuery]);

  return (
    <WorkerLayout activeBottomTab="completed">
      <div className="px-4 pt-4 sm:pt-6 pb-28 sm:pb-32 space-y-4 max-w-4xl mx-auto">
        {/* ========================================================
            1. PAGE HEADER: Completed Tasks Archive
           ======================================================== */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">✅</span>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Resolved Tasks Archive
              </h1>
              <WardBadge ward={workerWard} />
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {tasks.length} total resolved
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Historical record of verified repairs, proof photos, and closure notes.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle: Grid vs List */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid layout"
              >
                ⊞ Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="List layout"
              >
                ☰ List
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchCompletedTasks(true)}
              disabled={refreshing || loading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition ${
                refreshing ? 'opacity-70 cursor-wait' : ''
              }`}
              title="Refresh archive"
            >
              <span className={`text-sm ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
              <span className="hidden xs:inline">{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            2. SEARCH & CATEGORY FILTERS
           ======================================================== */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resolved tasks by ID, street, or repair remarks..."
                className="w-full bg-slate-50 pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="sm:w-52">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">All Categories</option>
                <option value="road">Roads & Infrastructure</option>
                <option value="garb">Garbage & Waste</option>
                <option value="water">Water & Drainage</option>
                <option value="light">Street Lighting</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && <ErrorMessage message={error} onRetry={() => fetchCompletedTasks(false)} />}

        {/* ========================================================
            3. RESOLVED TASKS GRID / LIST
           ======================================================== */}
        {loading ? (
          <div className="space-y-4">
            <LoadingSkeleton
              variant="card"
              count={3}
              message="Loading resolved tasks archive..."
            />
          </div>
        ) : filteredTasks.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl p-8 sm:p-12 border border-slate-200/90 text-center shadow-xs mt-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
              📂
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              No completed tasks found in archive.
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {searchQuery || categoryFilter !== 'all'
                ? 'No resolved complaints match your search or filter criteria.'
                : 'Tasks marked as Work Done or Closed will be recorded here.'}
            </p>
            {(searchQuery || categoryFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* ========================================================
             GRID LAYOUT (2 Columns on tablet/desktop)
             ======================================================== */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task) => {
              const proofList = task.proof_photos || [];
              const primaryProof = proofList[0];

              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/worker/task/${task.id}`)}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group hover:border-slate-300"
                >
                  <div className="space-y-3">
                    {/* Header Row: ID + Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {task.id}
                        </span>
                        <PriorityBadge level={task.priority} />
                      </div>
                      <WardBadge ward={task.ward} />
                    </div>

                    {/* Category & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CategoryBadge category={task.category} />
                      <StatusBadge status={task.status || 'Work Done'} />
                    </div>

                    {/* Issue Description */}
                    <p className="text-xs text-slate-700 font-medium line-clamp-2 leading-relaxed">
                      {task.description || 'No description provided.'}
                    </p>

                    {/* Address */}
                    <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-red-500 flex-shrink-0 mt-0.5">📍</span>
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {task.address}
                      </span>
                    </div>

                    {/* Worker Remarks if available */}
                    {task.repair_notes && (
                      <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 text-xs space-y-0.5">
                        <span className="font-bold text-emerald-900 text-[10px] uppercase tracking-wider block">
                          Worker Remarks:
                        </span>
                        <p className="text-emerald-800 text-[11px] font-medium line-clamp-2 italic">
                          "{task.repair_notes}"
                        </p>
                      </div>
                    )}

                    {/* Proof Photos Preview */}
                    {proofList.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Resolution Proof ({proofList.length}):
                        </span>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {proofList.map((url, i) => (
                            <div
                              key={i}
                              className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100 relative"
                            >
                              <img
                                src={url}
                                alt={`Proof thumbnail ${i + 1}`}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = DEFAULT_FALLBACK_PHOTO;
                                }}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Completed Date & Action Link */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 font-medium text-[11px]">
                      <span>🗓️</span>
                      <span>Resolved {formatCompletedDate(task.completed_at)}</span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/worker/task/${task.id}`);
                      }}
                      className="font-bold text-xs text-primary group-hover:underline inline-flex items-center gap-1"
                    >
                      <span>View Details</span>
                      <span>➔</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================
             LIST LAYOUT (Compact row view)
             ======================================================== */
          <div className="space-y-2.5">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/worker/task/${task.id}`)}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg flex-shrink-0">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {task.id}
                      </span>
                      <CategoryBadge category={task.category} />
                      <WardBadge ward={task.ward} />
                      <StatusBadge status={task.status || 'Work Done'} />
                    </div>
                    <p className="text-xs text-slate-700 font-medium truncate mt-1">
                      {task.description}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      📍 {task.address}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {formatCompletedDate(task.completed_at)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/worker/task/${task.id}`);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-primary group-hover:text-white text-slate-700 text-xs font-bold transition whitespace-nowrap"
                  >
                    Details ➔
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WorkerLayout>
  );
};

export default CompletedTasks;
