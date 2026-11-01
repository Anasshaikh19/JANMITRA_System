/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/citizen/ComplaintDetail.jsx (also via src/citizen/ComplaintDetail.jsx)
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Description: Citizen Complaint Detail view featuring:
 *              - Complaint ID, Category, Ward, Priority badges
 *              - Responsive Status Timeline Stepper (Horizontal desktop, Vertical mobile)
 *              - Photo lightbox gallery for complaint photos
 *              - Description text and read-only Leaflet GPS Map display
 *              - Verification Section (active on 'Work Done'):
 *                * Proof photos uploaded by worker
 *                * 'Yes, It is Fixed' -> 5-star rating modal -> POST /verify/
 *                * 'No, Not Fixed Yet' -> Rejection reason modal -> POST /verify/
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { CategoryBadge, PriorityBadge, StatusBadge, WardBadge } from '../../components/Badges';

// Canonical 6-step lifecycle defined in JANMITRA PRD/SRS
const TIMELINE_STEPS = [
  'Submitted',
  'Validated',
  'Assigned',
  'In-Progress',
  'Work Done',
  'Closed'
];

// Curated municipal defect rejection reasons for dropdown
export const REJECTION_REASONS = [
  'Pothole still visible / Asphalt uneven',
  'Garbage not cleared / Waste still overflowing',
  'Water drainage still clogged / Waterlogging persists',
  'Streetlight still dark or flickering',
  'Work incomplete / Substandard quality repair',
  'Wrong location serviced / Fixed neighboring spot',
  'Debris left on street / Clean-up pending',
  'Other issue (described in note below)'
];

/**
 * RatingSelector Component
 * 5-Star interactive rating selector with star hover micro-animation,
 * dynamic score descriptions, and touch/click bounce effects.
 */
export const RatingSelector = ({ rating = 5, hoverRating = 0, onRatingChange, onHoverChange }) => {
  const ratingLabels = {
    1: '★☆☆☆☆ Poor / Defect still persists',
    2: '★★☆☆☆ Needs Improvement / Substandard repair',
    3: '★★★☆☆ Satisfactory / Work acceptable',
    4: '★★★★☆ Good Quality / Clean resolution',
    5: '★★★★★ Outstanding / Fast & thorough fix'
  };

  const activeRating = hoverRating || rating || 5;

  return (
    <div className="space-y-2 text-center py-2">
      {/* 5-Star Row */}
      <div className="flex justify-center items-center gap-2 sm:gap-3">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeRating;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onRatingChange(star)}
              onMouseEnter={() => onHoverChange && onHoverChange(star)}
              onMouseLeave={() => onHoverChange && onHoverChange(0)}
              className="group p-1 transition-all duration-150 transform hover:scale-125 active:scale-95 focus:outline-none cursor-pointer"
              aria-label={`Select ${star} star${star > 1 ? 's' : ''}`}
            >
              <svg
                className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors duration-150 ${
                  isFilled
                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]'
                    : 'text-slate-300 fill-slate-100 hover:text-amber-200'
                }`}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Dynamic Descriptive Feedback Label */}
      <div className="h-6 flex items-center justify-center">
        <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 transition-all">
          {ratingLabels[activeRating]}
        </span>
      </div>
    </div>
  );
};

/**
 * ==============================================================================
 * PhotoLightboxModal Component
 * ==============================================================================
 * Full-screen lightbox modal for inspecting complaint photos and proof-of-work photos.
 *
 * Requirements Met:
 * 1. Full-screen lightbox modal with dark glassmorphic backdrop.
 * 2. Prominent image badge: 'Original Report' vs 'Proof of Work'.
 * 3. Next / Previous navigation buttons for multi-image complaints with cyclic navigation.
 * 4. Keyboard support: ESC to close, Left/Right arrow keys to navigate.
 * 5. Touch swipe gestures and thumbnail ribbon for smooth mobile/desktop browsing.
 */
export const PhotoLightboxModal = ({
  isOpen = true,
  images = [],
  currentIndex = 0,
  onClose = () => {},
  onNavigate = () => {},
  complaintId = '',
  complaintTitle = ''
}) => {
  // Normalize images to structured objects
  const normalizedImages = (images || []).map((img, i) => {
    if (typeof img === 'string') {
      return {
        url: img,
        type: 'Original Report',
        title: `Defect Photo #${i + 1}`,
        description: 'Original citizen complaint attachment'
      };
    }
    return {
      url: img.url || img.image || img.file || '',
      type: img.type || 'Original Report',
      title: img.title || (img.type === 'Proof of Work' ? `Proof Photo #${i + 1}` : `Report Photo #${i + 1}`),
      description: img.description || ''
    };
  });

  const total = normalizedImages.length;
  const activeIndex = Math.max(0, Math.min(currentIndex, Math.max(0, total - 1)));
  const activeImage = normalizedImages[activeIndex] || null;

  // Touch tracking for mobile swipe & image loaded state
  const [touchStartX, setTouchStartX] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset loaded status on image change
  useEffect(() => {
    setImageLoaded(false);
  }, [activeIndex]);

  // Cyclic navigation handlers
  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    if (total <= 1) return;
    const prevIdx = (activeIndex - 1 + total) % total;
    onNavigate(prevIdx);
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (total <= 1) return;
    const nextIdx = (activeIndex + 1) % total;
    onNavigate(nextIdx);
  };

  // Keyboard navigation & body scroll locking
  useEffect(() => {
    if (!isOpen || total === 0) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (total > 1) {
          const prevIdx = (activeIndex - 1 + total) % total;
          onNavigate(prevIdx);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (total > 1) {
          const nextIdx = (activeIndex + 1) % total;
          onNavigate(nextIdx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, activeIndex, total, onClose, onNavigate]);

  // Touch swipe handlers
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    if (e.changedTouches && e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchStartX - touchEndX;
      // Minimum swipe threshold 45px
      if (diffX > 45) {
        handleNext();
      } else if (diffX < -45) {
        handlePrev();
      }
    }
    setTouchStartX(null);
  };

  if (!isOpen || total === 0 || !activeImage) {
    return null;
  }

  const isProofOfWork = (activeImage.type || '').toLowerCase().includes('proof');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Lightbox Modal"
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between text-white animate-fadeIn select-none"
      onClick={onClose}
    >
      {/* 1. TOP HEADER BAR */}
      <header
        className="relative z-30 w-full px-4 py-3 sm:py-4 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/45 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Badges */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Badge: 'Original Report' vs 'Proof of Work' */}
          {isProofOfWork ? (
            <span
              id="lightbox-badge-proof"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/40 tracking-wide"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-200 animate-pulse" />
              <span>👷‍♂️ Proof of Work</span>
            </span>
          ) : (
            <span
              id="lightbox-badge-original"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40 tracking-wide"
            >
              <span className="w-2 h-2 rounded-full bg-blue-200 animate-pulse" />
              <span>📋 Original Report</span>
            </span>
          )}

          {/* Image Counter */}
          <span className="inline-flex items-center text-xs font-bold text-slate-300 bg-white/10 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md">
            {activeIndex + 1} of {total}
          </span>

          {/* Optional Complaint ID Tag */}
          {complaintId && (
            <span className="hidden sm:inline-flex items-center text-xs font-mono font-bold text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-500/30">
              #{complaintId}
            </span>
          )}
        </div>

        {/* Right: Close Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="lightbox-close-btn"
            onClick={onClose}
            className="group px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white transition backdrop-blur-md border border-white/15 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            aria-label="Close lightbox modal (Esc)"
            title="Close (ESC)"
          >
            <span className="hidden sm:inline font-mono text-[10px] bg-white/15 px-1.5 py-0.5 rounded text-slate-300 group-hover:text-white">
              ESC
            </span>
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* 2. CENTER VIEWPORT: MAIN IMAGE & ARROWS */}
      <div
        className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous Button (Multi-image only) */}
        {total > 1 && (
          <button
            type="button"
            id="lightbox-prev-btn"
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 active:scale-90 text-white/90 hover:text-white backdrop-blur-md border border-white/20 shadow-2xl transition flex items-center justify-center cursor-pointer group"
            aria-label="Previous photo (Left arrow key)"
            title="Previous (←)"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next Button (Multi-image only) */}
        {total > 1 && (
          <button
            type="button"
            id="lightbox-next-btn"
            onClick={handleNext}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 active:scale-90 text-white/90 hover:text-white backdrop-blur-md border border-white/20 shadow-2xl transition flex items-center justify-center cursor-pointer group"
            aria-label="Next photo (Right arrow key)"
            title="Next (→)"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Loading Spinner */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Active High-Res Image */}
        <div className="relative max-h-[72vh] sm:max-h-[76vh] max-w-[94vw] sm:max-w-[85vw] flex items-center justify-center">
          <img
            key={activeImage.url}
            src={activeImage.url}
            alt={activeImage.title || `Complaint image ${activeIndex + 1}`}
            onLoad={() => setImageLoaded(true)}
            className={`max-h-[72vh] sm:max-h-[76vh] max-w-[94vw] sm:max-w-[85vw] object-contain rounded-2xl shadow-2xl border border-white/10 transition-opacity duration-200 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>

      {/* 3. BOTTOM BAR: CAPTION, THUMBNAIL RIBBON & KEYBOARD HINTS */}
      <footer
        className="relative z-30 w-full px-4 py-2 sm:py-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Caption Title */}
        <div className="text-center max-w-lg mx-auto">
          <p className="text-xs sm:text-sm font-bold text-white tracking-tight">
            {activeImage.title}
          </p>
          {activeImage.description && (
            <p className="text-[11px] text-slate-300 line-clamp-1">
              {activeImage.description}
            </p>
          )}
        </div>

        {/* Multi-image Thumbnail Strip */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto max-w-full px-2 py-1 scrollbar-none">
            {normalizedImages.map((img, idx) => {
              const isCurrent = idx === activeIndex;
              const isProofThumb = (img.type || '').toLowerCase().includes('proof');
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onNavigate(idx)}
                  className={`relative rounded-xl overflow-hidden shrink-0 transition-all duration-150 cursor-pointer ${
                    isCurrent
                      ? isProofThumb
                        ? 'ring-2 ring-emerald-400 scale-110 shadow-lg shadow-emerald-500/40 opacity-100'
                        : 'ring-2 ring-blue-400 scale-110 shadow-lg shadow-blue-500/40 opacity-100'
                      : 'opacity-50 hover:opacity-85 scale-95 border border-white/10'
                  }`}
                  aria-label={`Jump to photo ${idx + 1}`}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="w-11 h-11 sm:w-13 sm:h-13 object-cover"
                  />
                  {/* Category dot on thumbnail */}
                  <span
                    className={`absolute bottom-1 right-1 w-2 h-2 rounded-full border border-black/50 ${
                      isProofThumb ? 'bg-emerald-400' : 'bg-blue-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Keyboard and Swipe Hints */}
        <div className="text-[11px] text-slate-400 flex items-center justify-center gap-3 sm:gap-4 select-none pb-0.5">
          <span className="hidden sm:inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-slate-300 font-mono">ESC</kbd> Close
          </span>
          {total > 1 && (
            <>
              <span className="hidden sm:inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-slate-300 font-mono">←</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-slate-300 font-mono">→</kbd> Navigate
              </span>
              <span className="sm:hidden text-[10px] text-slate-400">
                Swipe left / right or tap arrows to navigate
              </span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

/**
 * Determine the active step index based on backend complaint status
 */
const getActiveStepIndex = (status) => {
  const s = (status || '').toLowerCase().replace(/[\s_]+/g, '-');
  switch (s) {
    case 'closed':
      return 5;
    case 'work-done':
    case 'resolved':
      return 4;
    case 'in-progress':
      return 3;
    case 'assigned':
      return 2;
    case 'validated':
    case 'routed':
      return 1;
    case 'submitted':
    default:
      return 0;
  }
};

export const ComplaintDetail = () => {
  const { id } = useParams();
  let navigate;
  try {
    navigate = useNavigate();
  } catch (e) {
    navigate = (path) => { window.location.href = path; };
  }

  // Component state
  const [complaint, setComplaint] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Lightbox Modal state for full-screen photo preview (tracked by index in galleryImages)
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Verification Modals State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [rejectionReason, setRejectionReason] = useState(REJECTION_REASONS[0]);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationSuccessMsg, setVerificationSuccessMsg] = useState('');
  const [verificationErrorMsg, setVerificationErrorMsg] = useState('');

  /**
   * Fetch Complaint Detail:
   * GET /api/v1/complaints/:id/
   */
  const fetchComplaintDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/v1/complaints/${id}/`);
      setComplaint(response.data);
    } catch (err) {
      console.error('[ComplaintDetail] Error loading complaint:', err);
      setError('Could not load complaint details. It may not exist or network failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchComplaintDetails();
    }
  }, [id]); // eslint-disable-line

  /**
   * Handle Citizen Verification (Accept with Rating)
   * POST /api/v1/complaints/:id/verify/
   * Body: { action: 'accept', accepted: true, rating: 5, feedback: "..." }
   */
  const handleAcceptVerification = async (e) => {
    e.preventDefault();
    setIsSubmittingVerification(true);
    setVerificationErrorMsg('');
    try {
      const response = await api.post(`/api/v1/complaints/${id}/verify/`, {
        action: 'accept',
        accepted: true,
        rating: selectedRating,
        feedback: ratingFeedback.trim()
      });

      const updatedData = response.data?.complaint || {};
      const nowStr = new Date().toLocaleString();

      // Update state locally (instantly updates stepper, badges, and verification box)
      setComplaint((prev) => ({
        ...prev,
        ...updatedData,
        status: 'Closed',
        status_step: 6,
        citizen_verified: true,
        rating: selectedRating,
        feedback: ratingFeedback.trim(),
        timeline: [
          ...(prev?.timeline || []),
          {
            status: 'Closed',
            timestamp: nowStr,
            actor: `Citizen Verified (${selectedRating} Stars)${ratingFeedback.trim() ? ': ' + ratingFeedback.trim() : ''}`
          }
        ]
      }));

      setShowRatingModal(false);
      setVerificationSuccessMsg(`✓ Resolution Verified! Thank you for closing Complaint #${complaint?.tracking_id || id} and rating the Municipal field team.`);
    } catch (err) {
      console.error('[Verification Error]', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message;
      setVerificationErrorMsg(msg || 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  /**
   * Handle Citizen Verification (Reject with Reason & Note)
   * POST /api/v1/complaints/:id/verify/
   * Body: { action: 'reject', accepted: false, reason: "...", note: "..." }
   */
  const handleRejectVerification = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please select a reason why the issue is not resolved.');
      return;
    }

    setIsSubmittingVerification(true);
    setVerificationErrorMsg('');
    try {
      const response = await api.post(`/api/v1/complaints/${id}/verify/`, {
        action: 'reject',
        accepted: false,
        reason: rejectionReason.trim(),
        note: rejectionNote.trim()
      });

      const updatedData = response.data?.complaint || {};
      const nowStr = new Date().toLocaleString();

      // Update state locally (re-opened back to In-Progress)
      setComplaint((prev) => ({
        ...prev,
        ...updatedData,
        status: 'In-Progress',
        status_step: 3,
        citizen_verified: false,
        rejection_reason: rejectionReason.trim(),
        rejection_note: rejectionNote.trim(),
        timeline: [
          ...(prev?.timeline || []),
          {
            status: 'Re-opened',
            timestamp: nowStr,
            actor: `Citizen Rejected: ${rejectionReason.trim()}${rejectionNote.trim() ? ' (' + rejectionNote.trim() + ')' : ''}`
          }
        ]
      }));

      setShowRejectModal(false);
      setVerificationSuccessMsg(`⚠️ Complaint #${complaint?.tracking_id || id} has been Reopened. The Municipal field supervisor and worker have been alerted for re-inspection.`);
    } catch (err) {
      console.error('[Rejection Error]', err);
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message;
      setVerificationErrorMsg(msg || 'Failed to submit rejection. Please try again.');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-6 px-4 font-sans">
        <div className="max-w-xl mx-auto space-y-4 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 rounded-lg" />
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="h-8 w-44 bg-slate-200 rounded-md" />
            <div className="h-5 w-64 bg-slate-200 rounded-md" />
            <div className="h-28 bg-slate-100 rounded-xl" />
            <div className="h-44 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center max-w-sm w-full space-y-3">
          <div className="text-4xl">⚠️</div>
          <h2 className="font-bold text-slate-800 text-base">Unable to Load Complaint</h2>
          <p className="text-xs text-slate-500">{error || 'Complaint not found.'}</p>
          <button
            onClick={() => navigate('/citizen/complaints')}
            className="w-full py-2.5 px-4 bg-[#0d2a53] text-white text-xs font-bold rounded-xl"
          >
            Back to My Complaints
          </button>
        </div>
      </div>
    );
  }

  const activeIndex = getActiveStepIndex(complaint.status);
  const statusNormalized = (complaint.status || '').toLowerCase().replace(/[\s_]+/g, '-');
  const isWorkDone = statusNormalized === 'work-done';
  const isClosed = statusNormalized === 'closed' || statusNormalized === 'resolved';
  const complaintPhotos = complaint.photos || complaint.images || (complaint.photo_url ? [complaint.photo_url] : []);
  const proofPhotos = complaint.proof_photos || complaint.proof_images || (complaint.resolved_photo_url ? [complaint.resolved_photo_url] : []);
  
  // Unified images array with 'Original Report' vs 'Proof of Work' classification
  const galleryImages = [
    ...complaintPhotos.map((item, idx) => {
      const url = typeof item === 'string' ? item : (item.image || item.file || item.url);
      return {
        url,
        type: 'Original Report',
        title: `Original Report Photo #${idx + 1}`,
        description: complaint.title || complaint.description || 'Uploaded by citizen during reporting'
      };
    }),
    ...proofPhotos.map((item, idx) => {
      const url = typeof item === 'string' ? item : (item.image || item.file || item.url);
      return {
        url,
        type: 'Proof of Work',
        title: `Worker Proof of Work #${idx + 1}`,
        description: complaint.worker_name ? `Uploaded by ${complaint.worker_name}` : 'Field repair verification proof'
      };
    })
  ];

  const latitude = complaint.latitude || 21.1458; // Default Nagpur
  const longitude = complaint.longitude || 79.0882;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="sticky top-0 z-30 bg-[#0d2a53] text-white shadow-md">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-sm font-mono font-bold text-blue-200">
                #{complaint.tracking_id || complaint.id}
              </h1>
              <p className="text-xs text-slate-300">Complaint Details</p>
            </div>
          </div>

          <StatusBadge status={complaint.status} />
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">

        {/* Verification Alert Banner */}
        {verificationSuccessMsg && (
          <div className="p-3.5 bg-green-50 border border-green-200 rounded-2xl text-green-800 text-xs flex items-center justify-between shadow-sm">
            <span>🎉 {verificationSuccessMsg}</span>
            <button
              onClick={() => setVerificationSuccessMsg('')}
              className="font-bold text-green-900 ml-2"
            >
              &times;
            </button>
          </div>
        )}

        {/* ================= 1. HEADER CARD (Badges & Meta) ================= */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CategoryBadge category={complaint.category?.name || complaint.category} />
            <StatusBadge status={complaint.status} />
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <WardBadge ward={complaint.ward?.name || complaint.ward} />
            <span className="text-slate-400">
              Submitted: {new Date(complaint.submitted_at || complaint.created_at).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
        </section>

        {/* ================= 2. STATUS TIMELINE STEPPER ================= */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Resolution Timeline
          </h2>

          {/* Stepper: Responsive (Vertical on mobile, Horizontal on desktop) */}
          <div className="py-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center relative gap-4 sm:gap-0">
              {TIMELINE_STEPS.map((step, idx) => {
                const isCompleted = idx < activeIndex;
                const isCurrent = idx === activeIndex;
                const isFuture = idx > activeIndex;

                return (
                  <div
                    key={step}
                    className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-1.5 flex-1 relative z-10 w-full sm:w-auto"
                  >
                    {/* Connecting Line (Desktop: Horizontal) */}
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <div
                        className={`hidden sm:block absolute top-3.5 left-1/2 w-full h-0.5 z-0 transition-colors ${
                          idx < activeIndex ? 'bg-[#1A56DB]' : 'bg-slate-200'
                        }`}
                      />
                    )}

                    {/* Step Icon / Circle */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all relative z-10 ${
                        isCompleted
                          ? 'bg-[#1A56DB] text-white shadow-sm'
                          : isCurrent
                          ? 'bg-[#1A56DB] text-white ring-4 ring-blue-100 animate-pulse'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>

                    {/* Step Label */}
                    <div className="text-left sm:text-center">
                      <p
                        className={`text-xs font-bold leading-tight ${
                          isCurrent
                            ? 'text-[#1A56DB]'
                            : isCompleted
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {step}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] text-blue-600 font-medium block">
                          Current Stage
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================= 3. DESCRIPTION & COMPLAINT PHOTOS ================= */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Issue Description
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            {complaint.description || 'No description provided by citizen.'}
          </p>

          {/* Citizen Photos Gallery */}
          {complaintPhotos.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>📸</span> Attached Photos ({complaintPhotos.length})
                </h3>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Original Report
                </span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {complaintPhotos.map((imgUrl, index) => {
                  const url = typeof imgUrl === 'string' ? imgUrl : (imgUrl.image || imgUrl.file);
                  return (
                    <div
                      key={index}
                      onClick={() => setLightboxIndex(index)}
                      className="group relative cursor-pointer shrink-0 rounded-xl overflow-hidden border border-slate-200 hover:border-blue-500 shadow-xs hover:shadow-md transition-all duration-200"
                    >
                      <img
                        src={url}
                        alt={`Complaint photo ${index + 1}`}
                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-blue-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                        🔍 View
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Tap any photo to open full-screen lightbox</p>
            </div>
          )}
        </section>

        {/* ================= 4. LOCATION: READ-ONLY LEAFLET MAP ================= */}
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Issue Location
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              {Number(latitude).toFixed(4)}° N, {Number(longitude).toFixed(4)}° E
            </span>
          </div>

          {/* Embedded Leaflet / OSM display map */}
          <div className="h-44 w-full rounded-xl overflow-hidden border border-slate-200 relative shadow-inner">
            <iframe
              title="Complaint GPS Map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight="0"
              marginWidth="0"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.005}%2C${latitude - 0.005}%2C${longitude + 0.005}%2C${latitude + 0.005}&layer=mapnik&marker=${latitude}%2C${longitude}`}
              className="w-full h-full"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{complaint.address || 'Nagpur, Maharashtra'}</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1A56DB] font-bold hover:underline"
            >
              Open in Maps &rarr;
            </a>
          </div>
        </section>

        {/* ================= 5. CITIZEN VERIFICATION SECTION ================= */}
        {/* Shown when status is 'Work Done' */}
        {isWorkDone && (
          <section className="bg-gradient-to-br from-emerald-50/70 via-blue-50/50 to-indigo-50/70 border-2 border-emerald-300/80 p-5 rounded-2xl shadow-md space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-sm shrink-0">
                👷‍♂️
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">
                    Citizen Verification Required
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    Action Needed
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Field worker <strong>{complaint.worker_name || 'Municipal Supervisor'}</strong> marked this issue as repaired and submitted resolution proof. Please inspect the photos below to confirm resolution.
                </p>
              </div>
            </div>

            {/* Proof Photos Gallery */}
            {proofPhotos.length > 0 ? (
              <div className="bg-white p-3.5 rounded-xl border border-emerald-100/90 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5 text-emerald-800">
                    <span>📸</span> Worker Proof-of-Work Photos ({proofPhotos.length}):
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Click to zoom</span>
                </div>

                <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
                  {proofPhotos.map((proofUrl, index) => {
                    const url = typeof proofUrl === 'string' ? proofUrl : (proofUrl.image || proofUrl.file);
                    const galleryIndex = complaintPhotos.length + index;
                    return (
                      <div
                        key={index}
                        onClick={() => setLightboxIndex(galleryIndex)}
                        className="group relative cursor-pointer shrink-0 rounded-xl overflow-hidden border-2 border-emerald-400/80 hover:border-emerald-600 shadow-sm transition-all"
                      >
                        <img
                          src={url}
                          alt={`Proof of work ${index + 1}`}
                          className="w-24 h-24 sm:w-28 sm:h-28 object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-emerald-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                          🔍 Proof
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200 text-xs text-slate-500 italic flex items-center gap-2">
                <span>ℹ️</span> Field worker reported resolution on-site without photographic proof.
              </div>
            )}

            {/* Dual CTAs as explicitly required by prompt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Green Accept Resolution Button */}
              <button
                type="button"
                onClick={() => setShowRatingModal(true)}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="text-base font-black">✓</span>
                <span>Verify & Accept Resolution</span>
              </button>

              {/* Red Reject Resolution Button */}
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-700/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="text-base font-black">✕</span>
                <span>Reject / Issue Not Fixed</span>
              </button>
            </div>
          </section>
        )}

        {/* Verification Record Card (Displayed when already verified/closed) */}
        {(isClosed || complaint.citizen_verified) && (
          <section className="bg-emerald-50/80 border border-emerald-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span>✓</span> Citizen Verification Completed
              </span>
              <div className="flex text-amber-400 text-sm">
                {'★'.repeat(complaint.rating || 5)}{'☆'.repeat(5 - (complaint.rating || 5))}
              </div>
            </div>
            <p className="text-xs text-emerald-900/90 leading-relaxed">
              This issue was verified and approved by the reporting citizen. Target resolution SLA met.
            </p>
            {complaint.feedback && (
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100 text-xs text-emerald-950 italic">
                "{complaint.feedback}"
              </div>
            )}
          </section>
        )}

      </main>

      {/* ================= PHOTO LIGHTBOX MODAL ================= */}
      <PhotoLightboxModal
        isOpen={lightboxIndex !== null && galleryImages.length > 0}
        images={galleryImages}
        currentIndex={lightboxIndex !== null ? lightboxIndex : 0}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
        complaintId={complaint?.tracking_id || complaint?.id}
        complaintTitle={complaint?.title}
      />

      {/* ================= 2. ACCEPT MODAL (5-Star Rating & Feedback) ================= */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-100 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto shadow-sm">
                ⭐
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Verify & Accept Resolution
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Rate the quality of the on-site civic repair work conducted by the Municipal team.
              </p>
            </div>

            {/* Standalone 5-Star Rating Selector Component with Hover Micro-Animations */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <RatingSelector
                rating={selectedRating}
                hoverRating={hoverRating}
                onRatingChange={setSelectedRating}
                onHoverChange={setHoverRating}
              />
            </div>

            {/* Feedback Comment Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Feedback Comment (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Share your appreciation or feedback for the Municipal field crew..."
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 outline-none placeholder:text-slate-400 text-slate-800 transition"
              />
            </div>

            {/* Modal Action Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowRatingModal(false)}
                className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcceptVerification}
                disabled={isSubmittingVerification}
                className="flex-1 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmittingVerification ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit & Close Issue</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= 3. REJECT MODAL (Reason Dropdown & Note) ================= */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-100 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl shadow-sm mb-2">
                ✕
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Reject / Issue Not Fixed
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Explain what defect persists so the Municipal engineer can reassign field workers for immediate rework.
              </p>
            </div>

            {/* Reason Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 pr-8 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none appearance-none cursor-pointer"
                >
                  {REJECTION_REASONS.map((reason, i) => (
                    <option key={i} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Additional Note Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Field Instructions / Note <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Explain the remaining problem (e.g., left lane still damaged, rubbish scattered behind dumpster)..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none placeholder:text-slate-400 text-slate-800 transition"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectVerification}
                disabled={isSubmittingVerification || !rejectionReason.trim()}
                className="flex-1 py-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmittingVerification ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Reopen Complaint</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ComplaintDetail;
