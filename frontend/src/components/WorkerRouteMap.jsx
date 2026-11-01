import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LeafletMap from './LeafletMap';
import PriorityBadge from './PriorityBadge';
import CategoryBadge from './CategoryBadge';
import StatusBadge from './StatusBadge';
import { normalizeCategory, CATEGORY_PALETTE } from '../utils/mapIcons';

/**
 * WorkerRouteMap Component
 *
 * Dedicated route view for municipal field workers.
 * - Auto-fits bounds to include all assigned/in-progress complaint markers.
 * - Numbered route stops (1, 2, 3...) styled with Category SVG Pins:
 *   Blue (PWD), Green (SWM), Cyan (PHE), Yellow (Electrical).
 * - Connects stops with a dashed route guideline.
 * - Interactive stop drawer showing task details and direct action buttons.
 */
const WorkerRouteMap = ({
  tasks = [],
  activeTaskId = null,
  onUpdateStatus,
  className = 'h-[440px] sm:h-[500px]',
}) => {
  const navigate = useNavigate();

  // Normalize tasks into route stops with valid coordinates
  const routeStops = useMemo(() => {
    if (!Array.isArray(tasks)) return [];

    return tasks
      .map((t, idx) => {
        // Fallback simulated coordinates within municipal wards if not set
        const baseLat = 28.6139 + (idx % 2 === 0 ? 0.005 * (idx + 1) : -0.004 * (idx + 1));
        const baseLng = 77.209 + (idx % 2 === 0 ? -0.006 * (idx + 1) : 0.005 * (idx + 1));

        const lat = Number(t.location_lat ?? t.lat ?? baseLat);
        const lng = Number(t.location_lng ?? t.lng ?? baseLng);

        return {
          ...t,
          lat,
          lng,
          stopNumber: idx + 1,
          categoryKey: normalizeCategory(t.category || t.dept),
        };
      })
      .filter((t) => !isNaN(t.lat) && !isNaN(t.lng) && t.lat !== 0 && t.lng !== 0);
  }, [tasks]);

  // Selected stop state
  const [selectedStopId, setSelectedStopId] = useState(() => {
    return activeTaskId || (routeStops[0]?.id ?? null);
  });

  const selectedTask = useMemo(() => {
    return routeStops.find((s) => s.id === selectedStopId) || routeStops[0] || null;
  }, [routeStops, selectedStopId]);

  // Department counts for summary
  const deptCounts = useMemo(() => {
    const counts = { PWD: 0, SWM: 0, PHE: 0, Electrical: 0 };
    routeStops.forEach((s) => {
      if (counts[s.categoryKey] !== undefined) {
        counts[s.categoryKey] += 1;
      }
    });
    return counts;
  }, [routeStops]);

  // Generate Google Maps multi-waypoint route URL
  const googleMapsRouteUrl = useMemo(() => {
    if (routeStops.length === 0) return '#';
    if (routeStops.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&destination=${routeStops[0].lat},${routeStops[0].lng}`;
    }

    const origin = `${routeStops[0].lat},${routeStops[0].lng}`;
    const destination = `${routeStops[routeStops.length - 1].lat},${routeStops[routeStops.length - 1].lng}`;
    const waypoints = routeStops
      .slice(1, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
      waypoints ? `&waypoints=${waypoints}` : ''
    }`;
  }, [routeStops]);

  if (routeStops.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto mb-3">
          🗺️
        </div>
        <h3 className="text-base font-bold text-slate-900">
          No Route Points Available
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          There are currently no tasks with coordinate locations in your active queue to display on the route map.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. ROUTE SUMMARY HEADER */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>📍 Route Plan:</span>
              <span className="text-primary">{routeStops.length} Field Stops</span>
            </h2>

            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              Ward Auto-Fit Bounds Active
            </span>
          </div>

          {/* Department Breakdown Chips */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {Object.entries(deptCounts).map(([key, count]) => {
              if (count === 0) return null;
              const meta = CATEGORY_PALETTE[key];
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold border ${meta.badgeBg}`}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span>{meta.code}: {count}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <a
            href={googleMapsRouteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-primary hover:bg-blue-700 active:scale-95 text-white transition shadow-xs"
            title="Open complete multi-stop route in Google Maps app"
          >
            <span>🧭</span>
            <span>Open in Google Maps</span>
          </a>
        </div>
      </div>

      {/* 2. INTERACTIVE ROUTE MAP */}
      <LeafletMap
        markers={routeStops}
        activeMarkerId={selectedStopId}
        showRouteLine={true}
        showLegend={true}
        autoFit={true}
        onMarkerClick={(item) => setSelectedStopId(item.id)}
        className={`${className} w-full rounded-2xl`}
      />

      {/* 3. SELECTED STOP CARD DETAIL DRAWER */}
      {selectedTask && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm transition-all animate-fade-in">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                #{selectedTask.stopNumber}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black text-slate-900">
                    {selectedTask.id}
                  </span>
                  <PriorityBadge priority={selectedTask.priority} />
                  <StatusBadge status={selectedTask.status} />
                </div>
                <div className="mt-1">
                  <CategoryBadge category={selectedTask.category} />
                </div>
              </div>
            </div>

            {/* Direct Status Actions */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {selectedTask.status === 'Assigned' && onUpdateStatus && (
                <button
                  type="button"
                  onClick={(e) => onUpdateStatus(selectedTask.id, 'In-Progress', e)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition active:scale-95"
                >
                  ⚡ Start Work
                </button>
              )}

              {selectedTask.status === 'In-Progress' && onUpdateStatus && (
                <button
                  type="button"
                  onClick={(e) => onUpdateStatus(selectedTask.id, 'Work Done', e)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition active:scale-95"
                >
                  ✓ Mark Done
                </button>
              )}

              <button
                type="button"
                onClick={() => navigate(`/worker/task/${selectedTask.id}`)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white transition active:scale-95"
              >
                Open Details ➔
              </button>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-700 font-medium mt-3 leading-relaxed">
            {selectedTask.description}
          </p>

          <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-red-500 font-bold shrink-0">📍</span>
            <span className="font-semibold text-slate-800 leading-snug break-words">
              {selectedTask.address}
            </span>
          </div>
        </div>
      )}

      {/* 4. ROUTE STOPS HORIZONTAL SCROLL TICKER */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
        {routeStops.map((stop) => {
          const isSelected = stop.id === selectedStopId;
          const meta = CATEGORY_PALETTE[stop.categoryKey];

          return (
            <button
              key={stop.id}
              type="button"
              onClick={() => setSelectedStopId(stop.id)}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm scale-102'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                style={{ backgroundColor: meta?.color || '#2563EB' }}
              >
                {stop.stopNumber}
              </span>
              <span className="font-mono text-[11px]">{stop.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WorkerRouteMap;
