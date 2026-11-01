/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/citizen/Help.jsx (also re-exported via src/citizen/Help.jsx)
 * Developer: Faizan Rayeen (Citizen Portal Lead)
 * Description: Citizen Help, Guidelines & NMC Helpdesk Screen:
 *              1. Header: 'How to Use JANMITRA' -- NMC Helpdesk
 *              2. Search filter bar for instant FAQ search & topic count
 *              3. Accordion FAQ cards:
 *                 - How to report
 *                 - Photo rejection reasons
 *                 - Tracking
 *                 - SLA times
 *                 - Reopening issues
 *              4. NMC Civic Helplines:
 *                 - Central Toll-Free: 1800-233-3766
 *                 - SWM (Solid Waste Management) phone numbers
 *                 - Water (Water Supply & Drainage) phone numbers
 *                 - Electrical (Street Lighting) phone numbers
 *                 - Click-to-call links and Copy-to-clipboard actions
 * ==============================================================================
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Comprehensive Accordion FAQs with exact requested topics
export const FAQS = [
  {
    id: 'how-to-report',
    category: 'Reporting',
    question: 'How do I report an issue?',
    badge: 'Guide',
    answer: [
      'Reporting a civic issue on JANMITRA takes less than 60 seconds:',
      '1. Select Department Category: Tap "Report New Issue" and choose Roads (PWD), Garbage (SWM), Water (PHE), or Street Lighting (Electrical).',
      '2. Detect / Pick GPS Location: Tap "Detect My Location" to automatically locate your issue on the Nagpur Leaflet street map, or drag the red pin to the exact spot.',
      '3. Capture Live On-Site Photo: Take a clear photo of the civic grievance directly with your camera. AI will run instant verification.',
      '4. Add Brief Description & Ward: Describe the issue with any nearby landmark, then tap "Submit Complaint". You will instantly receive an NMC tracking ticket (e.g. NMC-2026-018).'
    ]
  },
  {
    id: 'photo-rejection-reasons',
    category: 'Verification',
    question: 'Why was my photo rejected? (Photo Rejection Reasons)',
    badge: 'AI Camera',
    answer: [
      'JANMITRA uses real-time AI image verification to ensure high field accountability and prevent false reports. Photos are rejected for the following reasons:',
      '• Screen or Device Capture: Photos taken of a computer screen, tablet, or phone display are blocked.',
      '• Downloaded / Web Images: Stock photos or forwarded WhatsApp images lacking genuine camera EXIF metadata are rejected.',
      '• Blurry or Pitch-Dark Photos: Images that are too blurry, out of focus, or taken in total darkness without flash.',
      '• Unrelated Objects: Uploading selfies, documents, pets, or indoor objects instead of road or municipal infrastructure.',
      '• Covered Lens: Photos where fingers or objects obscure the camera lens.',
      'Tip: Always hold your camera steady, ensure adequate lighting, and capture both the issue and surrounding street context.'
    ]
  },
  {
    id: 'tracking-complaint',
    category: 'Tracking',
    question: 'How do I track my complaint status?',
    badge: 'Tracking ID',
    answer: [
      'Every complaint is assigned a unique Municipal Tracking ID (e.g. NMC-2026-018). You can track it through multiple methods:',
      '• In-App Stepper: Go to "My Complaints" in the bottom navigation and tap on any ticket. You will see a live 6-step lifecycle timeline stepper: Submitted → AI Validated → Task Assigned → In-Progress → Work Done → Closed.',
      '• Push Notifications: When municipal field workers update your issue, you receive instant push notifications with deep-links directly opening the complaint.',
      '• Filter by Status: On "My Complaints", easily filter by "All", "In Progress", or "Resolved" tickets.'
    ]
  },
  {
    id: 'sla-times',
    category: 'Resolution',
    question: 'What are the official resolution SLA times?',
    badge: 'SLA Times',
    answer: [
      'Nagpur Municipal Corporation enforces strict Citizen Charter Service Level Agreement (SLA) turnaround targets:',
      '• Dangerous Electrical Hazards / Exposed Wires: Resolution targeted within 24 Hours.',
      '• Main Pipeline Burst / Contaminated Drinking Water: Targeted within 24 Hours.',
      '• Overflowing Garbage Dumps & SWM Waste: Cleared within 24 to 48 Hours.',
      '• Streetlight Faults & Dark Stretches: Repaired within 24 to 48 Hours.',
      '• Road Potholes, Manhole Covers & Footpaths: Resurfaced within 48 to 72 Hours.',
      'Note: If a complaint exceeds its target SLA timeframe, it is automatically escalated to the Ward Executive Engineer.'
    ]
  },
  {
    id: 'reopening-issues',
    category: 'Verification',
    question: 'How does reopening issues and Citizen Verification work?',
    badge: 'Quality Check',
    answer: [
      'Under JANMITRA, a complaint is never closed by workers alone — the citizen has the final say:',
      '1. Proof-of-Work Notification: When the field worker finishes repairs, they upload on-site after-repair proof photos, and the status changes to "Work Done".',
      '2. Inspect Resolution: Open the complaint in your portal to view the worker\'s proof photos using the full-screen photo lightbox.',
      '3. Accept & Close: If satisfied, tap "Verify & Accept Resolution". You can rate the municipal field team from 1 to 5 stars.',
      '4. Reject & Reopen: If the pothole is still visible or garbage remains uncleared, tap "Reject / Issue Not Fixed". Select a reason, add a short note, and submit.',
      '5. Mandatory Rework: The complaint automatically reopens as "In-Progress" and is flagged for mandatory supervisor rework.'
    ]
  }
];

// Official Nagpur Municipal Corporation (NMC) Civic Helplines
export const NMC_HELPLINES = [
  {
    id: 'nmc-tollfree',
    dept: 'NMC Central Grievance Helpline',
    role: 'Central Municipal Control Room',
    tollFree: true,
    primaryNumber: '1800-233-3766',
    altNumber: '0712-2567000',
    icon: '🏛️',
    color: 'blue',
    timing: '24x7 Toll-Free (All Operators)',
    coverage: 'Nagpur City Central Grievances, Escalations, Emergency Coordination'
  },
  {
    id: 'swm-helpline',
    dept: 'Solid Waste Management (SWM)',
    role: 'Sanitation & Cleanliness Wing',
    tollFree: false,
    primaryNumber: '0712-2567041',
    altNumber: '0712-2567042',
    icon: '🗑️',
    color: 'emerald',
    timing: '07:00 AM - 08:00 PM Daily',
    coverage: 'Garbage collection, overflowing dumpsters, street sweeping, debris removal'
  },
  {
    id: 'water-helpline',
    dept: 'Water Works & Drainage (PHE / OCW)',
    role: 'Orange City Water (OCW) & Municipal PHE',
    tollFree: true,
    primaryNumber: '1800-266-9899',
    altNumber: '0712-2567037',
    icon: '💧',
    color: 'cyan',
    timing: '24x7 Water Supply Control Room',
    coverage: 'Pipeline bursts, water contamination, sewer backflows, manhole covers'
  },
  {
    id: 'electrical-helpline',
    dept: 'Electrical & Street Lighting',
    role: 'Municipal Electrical Department',
    tollFree: true,
    primaryNumber: '0712-2567040',
    altNumber: '1912',
    icon: '💡',
    color: 'amber',
    timing: '24x7 Electric Faults & Streetlight Cell',
    coverage: 'Non-functioning streetlights, exposed live wires, pole repairs, dark stretches'
  },
  {
    id: 'pwd-helpline',
    dept: 'Public Works Department (PWD - Roads)',
    role: 'Civil Infrastructure & Roads Cell',
    tollFree: false,
    primaryNumber: '0712-2567035',
    altNumber: '0712-2567036',
    icon: '🚧',
    color: 'purple',
    timing: '09:00 AM - 06:00 PM Mon-Sat',
    coverage: 'Pothole repairs, asphalt patching, broken footpaths, road divider issues'
  }
];

export default function CitizenHelp() {
  const navigate = useNavigate();

  // FAQ Accordion State
  const [openFaqIds, setOpenFaqIds] = useState(['how-to-report']);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFaqCategory, setActiveFaqCategory] = useState('All');
  const [copiedNumber, setCopiedNumber] = useState(null);

  // Toggle individual FAQ accordion
  const toggleFaq = (id) => {
    setOpenFaqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Expand all or collapse all FAQs
  const handleToggleAllFaqs = () => {
    if (openFaqIds.length === FAQS.length) {
      setOpenFaqIds([]);
    } else {
      setOpenFaqIds(FAQS.map((f) => f.id));
    }
  };

  // Copy phone number to clipboard with feedback
  const handleCopyNumber = (number, label) => {
    const cleanNum = number.replace(/\s+/g, '');
    navigator.clipboard?.writeText(cleanNum).then(() => {
      setCopiedNumber(`${label}: ${cleanNum}`);
      setTimeout(() => setCopiedNumber(null), 3000);
    }).catch(() => {
      // Fallback
      setCopiedNumber(`${label}: ${cleanNum}`);
      setTimeout(() => setCopiedNumber(null), 3000);
    });
  };

  // Filter FAQs based on search query and category
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return FAQS.filter((faq) => {
      const matchesCategory =
        activeFaqCategory === 'All' || faq.category === activeFaqCategory;
      if (!matchesCategory) return false;
      if (!q) return true;

      const inQuestion = faq.question.toLowerCase().includes(q);
      const inAnswers = faq.answer.some((line) => line.toLowerCase().includes(q));
      const inCategory = faq.category.toLowerCase().includes(q);
      return inQuestion || inAnswers || inCategory;
    });
  }, [searchQuery, activeFaqCategory]);

  const categories = ['All', 'Reporting', 'Verification', 'Tracking', 'Resolution'];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 font-sans">
      
      {/* Copied Feedback Toast */}
      {copiedNumber && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 border border-slate-700 animate-fadeIn"
        >
          <span className="text-emerald-400">✓</span>
          <span>Copied {copiedNumber} to clipboard!</span>
        </div>
      )}

      {/* ================= 1. HEADER: 'How to Use JANMITRA' -- NMC Helpdesk ================= */}
      <section className="bg-gradient-to-br from-[#0d2a53] via-[#12396e] to-[#1A56DB] text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden border border-blue-900">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">🏛️</span>
            <span className="text-[11px] font-black tracking-wider uppercase px-3 py-1 rounded-full bg-white/15 text-blue-100 backdrop-blur-md border border-white/20">
              NMC Helpdesk & Civic Guidance
            </span>
            <span className="text-[11px] font-bold text-blue-200">
              24x7 Citizen Support
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              How to Use JANMITRA
            </h1>
            <p className="text-sm font-semibold text-blue-200 mt-0.5">
              NMC Helpdesk &bull; Nagpur Municipal Corporation
            </p>
          </div>

          <p className="text-xs text-blue-100/90 leading-relaxed max-w-lg pt-1">
            Learn how to file grievance reports, understand AI photo guidelines, track SLA resolution timeframes, or contact official municipal department helplines directly.
          </p>

          {/* Quick CTA banner within header */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/citizen/submit')}
              className="px-4 py-2 rounded-xl bg-white text-[#0d2a53] hover:bg-blue-50 text-xs font-black shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Report New Issue</span>
            </button>
            <a
              href="#helplines"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5"
            >
              <span>📞</span>
              <span>NMC Helplines</span>
            </a>
          </div>
        </div>

        {/* Decorative Watermark */}
        <div className="absolute -right-6 -bottom-6 text-8xl font-black text-white/5 select-none pointer-events-none tracking-tighter">
          NMC
        </div>
      </section>

      {/* ================= 2. SEARCH FILTER BAR ================= */}
      <section className="space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            type="text"
            id="faq-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs: photo rejection, SLA times, tracking, reopening..."
            className="w-full text-xs font-medium pl-10 pr-20 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:border-[#1A56DB] focus:ring-2 focus:ring-blue-100 transition-all"
          />

          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded cursor-pointer"
                title="Clear Search"
              >
                Clear
              </button>
            )}
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
              {filteredFaqs.length} {filteredFaqs.length === 1 ? 'result' : 'results'}
            </span>
          </div>
        </div>

        {/* Category Pills & Expand/Collapse Toggle */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveFaqCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFaqCategory === cat
                    ? 'bg-[#1A56DB] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleToggleAllFaqs}
            className="shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer border border-blue-200/60"
          >
            {openFaqIds.length === FAQS.length ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </section>

      {/* ================= 3. ACCORDION FAQ CARDS ================= */}
      {/* How to report | Photo rejection reasons | Tracking | SLA times | Reopening issues */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span>❓</span>
            <span>Frequently Asked Questions</span>
          </h2>
          <span className="text-[11px] font-bold text-slate-400">
            Interactive Accordion
          </span>
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2 shadow-sm">
            <span className="text-3xl block">🔍</span>
            <div className="text-xs font-bold text-slate-800">
              No help topics match "{searchQuery}"
            </div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Try searching with different keywords like 'pothole', 'camera', 'SLA', 'verify', or call the NMC toll-free helpline below.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveFaqCategory('All');
              }}
              className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Reset Search Filter
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqIds.includes(faq.id);

              return (
                <div
                  key={faq.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                    isOpen
                      ? 'border-blue-300 ring-2 ring-blue-50/70 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Accordion Trigger Header */}
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full p-4 sm:p-4.5 text-left flex items-start justify-between gap-3 cursor-pointer select-none group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/70">
                          {faq.badge}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {faq.category}
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                        {faq.question}
                      </h3>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 mt-0.5 ${
                        isOpen
                          ? 'rotate-180 bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Accordion Expanded Content */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5 border-t border-slate-100 text-xs text-slate-600 space-y-2.5 animate-fadeIn bg-slate-50/40">
                      {faq.answer.map((paragraph, pIdx) => {
                        const isStepOrBullet = paragraph.startsWith('•') || /^[0-9]\./.test(paragraph);
                        const isTip = paragraph.startsWith('Tip:') || paragraph.startsWith('Note:');

                        return (
                          <div
                            key={pIdx}
                            className={`${
                              isTip
                                ? 'bg-amber-50/80 border border-amber-200 text-amber-900 font-semibold p-2.5 rounded-xl text-[11px]'
                                : isStepOrBullet
                                ? 'pl-2 border-l-2 border-blue-400 text-slate-700 leading-relaxed font-medium'
                                : 'leading-relaxed font-normal text-slate-600'
                            }`}
                          >
                            {paragraph}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================= 4. NMC CIVIC HELPLINES SECTION ================= */}
      {/* Toll-Free 1800-233-3766, SWM, Water, Electrical phone numbers */}
      <section id="helplines" className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-base">📞</span>
              <span>NMC Civic Helplines</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Official Nagpur Municipal Corporation departmental phone numbers
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200/60">
            Verified Contacts
          </span>
        </div>

        {/* Hero Card: Central Toll-Free 1800-233-3766 */}
        <div className="bg-gradient-to-r from-blue-900 via-[#0d2a53] to-[#1A56DB] text-white p-5 rounded-3xl shadow-md border border-blue-950 space-y-3 relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500 text-white">
                  Toll-Free 24x7
                </span>
                <span className="text-xs text-blue-200 font-semibold">
                  Nagpur Municipal Corporation
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
                1800-233-3766
              </div>
              <p className="text-xs text-blue-100/90 leading-tight">
                Central Civic Grievance Control Room &bull; Free from all landlines & mobiles
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href="tel:18002333766"
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>📞</span>
                <span>Call Toll-Free</span>
              </a>
              <button
                type="button"
                onClick={() => handleCopyNumber('1800-233-3766', 'NMC Toll-Free')}
                className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-1 cursor-pointer"
                title="Copy Number"
              >
                <span>📋</span>
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>

        {/* Department Helplines Grid: SWM, Water, Electrical, PWD */}
        <div className="grid grid-cols-1 gap-3">
          {NMC_HELPLINES.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0 border border-slate-200/80">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                      {item.dept}
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {item.role}
                    </p>
                  </div>
                </div>

                {item.tollFree && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                    Toll-Free
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-600 pl-1 font-medium leading-relaxed">
                {item.coverage}
              </div>

              <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Primary Direct Dial */}
                  <a
                    href={`tel:${item.primaryNumber.replace(/\D/g, '')}`}
                    className="font-mono font-black text-xs text-[#1A56DB] hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100/70 px-3 py-1.5 rounded-xl border border-blue-200/60 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📞</span>
                    <span>{item.primaryNumber}</span>
                  </a>

                  {/* Secondary Alternative Dial */}
                  {item.altNumber && (
                    <a
                      href={`tel:${item.altNumber.replace(/\D/g, '')}`}
                      className="font-mono font-bold text-xs text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="text-slate-400">Alt:</span>
                      <span>{item.altNumber}</span>
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(item.primaryNumber, item.dept)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    title="Copy phone number"
                  >
                    Copy
                  </button>
                  <span className="text-[10px] text-slate-400 pl-1 font-medium">
                    {item.timing}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 5. QUICK REPORT ISSUE CTA ================= */}
      <section className="pt-2">
        <button
          type="button"
          onClick={() => navigate('/citizen/submit')}
          className="w-full py-4 px-5 rounded-2xl bg-[#1A56DB] hover:bg-blue-700 active:scale-[0.99] text-white text-xs sm:text-sm font-black shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer group"
        >
          <span className="text-lg leading-none group-hover:scale-110 transition-transform">+</span>
          <span>Ready to Report a New Civic Grievance?</span>
        </button>
      </section>

      <div className="text-center text-[11px] text-slate-400 pt-1">
        JANMITRA Civic Redressal &bull; Nagpur Municipal Corporation &bull; Citizen Portal
      </div>
    </div>
  );
}
