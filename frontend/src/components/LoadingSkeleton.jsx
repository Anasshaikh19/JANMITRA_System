import React from 'react';

/**
 * LoadingSkeleton component:
 * Provides state-of-the-art animated shimmer placeholder states for:
 * - 'kpi': KPI metric summary cards
 * - 'card': Grievance and task cards (with thumbnail, badge pills, text lines)
 * - 'table': Tabular rows (for HighPriorityQueue & Worker tables)
 * - 'chart': Chart containers with placeholder axes and bars
 * - 'detail': Full page grievance inspection skeleton
 */
const LoadingSkeleton = ({ variant = 'card', count = 3, message = 'Loading data...' }) => {
  // KPI Metrics Grid Skeleton
  if (variant === 'kpi') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {Array.from({ length: count || 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs shimmer-mask space-y-2"
            >
              <div className="h-3 w-16 bg-slate-200 rounded-md" />
              <div className="h-7 w-20 bg-slate-300 rounded-lg" />
              <div className="h-2.5 w-24 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
        {message && (
          <p className="text-[11px] text-slate-400 font-medium text-center pt-1 animate-pulse">
            {message}
          </p>
        )}
      </div>
    );
  }

  // Card Queue Skeleton (for ValidationQueue & TaskList)
  if (variant === 'card') {
    return (
      <div className="space-y-4">
        {Array.from({ length: count || 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs shimmer-mask space-y-4"
          >
            {/* Top Row: Badges */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-slate-200 rounded-lg" />
                <div className="h-5 w-24 bg-slate-200 rounded-full" />
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="h-4 w-16 bg-slate-100 rounded" />
            </div>

            {/* Middle Section: Image Thumbnail & Text Content */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-36 h-36 bg-slate-200 rounded-xl shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-full bg-slate-200 rounded" />
                  <div className="h-3.5 w-4/5 bg-slate-200 rounded" />
                  <div className="h-3.5 w-2/3 bg-slate-200 rounded" />
                </div>
                {/* Confidence Bar / Meta */}
                <div className="h-8 w-full bg-slate-100 rounded-xl p-2 flex items-center gap-2">
                  <div className="h-2.5 w-24 bg-slate-200 rounded-md" />
                  <div className="h-2 w-full bg-slate-200 rounded-full" />
                </div>
              </div>
            </div>

            {/* Bottom Row: Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="h-3 w-32 bg-slate-200 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-8 w-20 bg-slate-200 rounded-xl" />
                <div className="h-8 w-24 bg-slate-300 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Tabular Rows Skeleton (for HighPriorityQueue & Worker Roster)
  if (variant === 'table') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {/* Table Header Placeholder */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-4 w-16 bg-slate-200 rounded" />
        </div>
        {/* Table Rows Placeholder */}
        <div className="divide-y divide-slate-100">
          {Array.from({ length: count || 5 }).map((_, i) => (
            <div
              key={i}
              className="p-4 flex items-center justify-between gap-4 shimmer-mask"
            >
              <div className="flex items-center gap-3">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-5 w-24 bg-slate-100 rounded-full hidden sm:block" />
                <div className="h-5 w-16 bg-slate-100 rounded-full" />
              </div>
              <div className="h-5 w-28 bg-slate-200 rounded-full" />
              <div className="h-7 w-24 bg-slate-200 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Chart Box Skeleton
  if (variant === 'chart') {
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs shimmer-mask space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-56 bg-slate-100 rounded" />
          </div>
          <div className="h-6 w-20 bg-slate-100 rounded-lg" />
        </div>
        {/* Chart area with simulated bars */}
        <div className="h-64 w-full bg-slate-50 rounded-xl border border-slate-100 p-4 flex items-end justify-around gap-3">
          <div className="h-32 w-12 bg-slate-200 rounded-t-lg" />
          <div className="h-48 w-12 bg-slate-300 rounded-t-lg" />
          <div className="h-28 w-12 bg-slate-200 rounded-t-lg" />
          <div className="h-40 w-12 bg-slate-300 rounded-t-lg" />
        </div>
      </div>
    );
  }

  // Default Fallback
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center shimmer-mask space-y-3">
      <div className="h-5 w-48 bg-slate-200 rounded mx-auto" />
      <div className="h-3 w-64 bg-slate-100 rounded mx-auto" />
      <div className="h-10 w-32 bg-slate-200 rounded-xl mx-auto mt-4" />
    </div>
  );
};

export default LoadingSkeleton;
