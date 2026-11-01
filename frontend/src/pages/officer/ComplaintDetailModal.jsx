import React, { useState } from 'react';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LeafletMap from '../../components/LeafletMap';
import AssignWorker from './AssignWorker';

/**
 * ComplaintDetailModal:
 * Reusable modal triggered from HighPriorityList and ValidationQueue.
 * Shows:
 * - Complaint photos gallery with thumbnail modal
 * - Description, Category, Ward, Priority
 * - Status timeline
 * - 'Assign Worker' button (opens AssignWorker modal)
 */
const ComplaintDetailModal = ({
  complaint,
  isOpen,
  onClose,
  onWorkerAssigned,
}) => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  if (!isOpen || !complaint) return null;

  const photos = complaint.images || complaint.photos || [];

  const timelineSteps = [
    { status: 'Submitted', done: true, label: 'Logged by Citizen' },
    {
      status: 'Validated',
      done: ['Validated', 'Routed', 'Assigned', 'In-Progress', 'Work Done', 'Closed'].includes(
        complaint.status
      ),
      label: 'AI & Officer Approved',
    },
    {
      status: 'Assigned',
      done: ['Assigned', 'In-Progress', 'Work Done', 'Closed'].includes(complaint.status),
      label: complaint.assigned_to ? `Assigned to ${complaint.assigned_to}` : 'Pending Allocation',
    },
    {
      status: 'In-Progress',
      done: ['In-Progress', 'Work Done', 'Closed'].includes(complaint.status),
      label: 'Work in Execution',
    },
    {
      status: 'Closed',
      done: complaint.status === 'Closed',
      label: 'Resolved & Verified',
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-mono font-bold text-primary">
                {complaint.id}
              </span>
              <h2 className="text-xl font-black text-dark">Complaint Overview</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 leading-none"
            >
              ✕
            </button>
          </div>

          {/* Badges Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={complaint.status} />
            <PriorityBadge level={complaint.priority} />
            <CategoryBadge category={complaint.category} />
            <WardBadge ward={complaint.ward} />
          </div>

          {/* Photos Section */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Citizen Photos
            </h3>
            {photos.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {photos.map((url, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedPhoto(url)}
                    className="w-28 h-28 shrink-0 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 relative group shadow-sm"
                  >
                    <img
                      src={url}
                      alt={`Complaint evidence ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold">
                      🔍 View
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                No photo attachments available.
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description
            </h3>
            <p className="text-sm text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed font-medium">
              {complaint.description}
            </p>
          </div>

          {/* Location Map */}
          {complaint.location_lat && complaint.location_lng && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Location Pinpoint
              </h3>
              <LeafletMap
                lat={complaint.location_lat}
                lng={complaint.location_lng}
                category={complaint.category || complaint.dept}
                readonly={true}
                className="h-48 w-full rounded-2xl"
              />
            </div>
          )}

          {/* Status Timeline */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Status Lifecycle Timeline
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              {timelineSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border flex flex-col justify-between ${
                    step.done
                      ? 'bg-blue-50/70 border-primary text-primary font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="text-base mb-1">{step.done ? '✓' : '○'}</span>
                  <span className="text-[11px] leading-tight">{step.status}</span>
                  <span className="text-[9px] font-normal text-slate-500 mt-1 line-clamp-1">
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Assigned Worker:{' '}
              <span className="font-bold text-dark">
                {complaint.assigned_to || 'Unassigned'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 bg-primary hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
              >
                <span>👷‍♂️</span>
                <span>Assign Worker</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modal: Assign Worker */}
      {showAssignModal && (
        <AssignWorker
          complaint={complaint}
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onAssigned={(workerName) => {
            if (onWorkerAssigned) {
              onWorkerAssigned(complaint.id, workerName);
            }
          }}
        />
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-xl max-h-[85vh]">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-3 -right-3 bg-white text-slate-900 rounded-full h-8 w-8 flex items-center justify-center font-bold shadow-lg"
            >
              ✕
            </button>
            <img
              src={selectedPhoto}
              alt="Enlarged"
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ComplaintDetailModal;
