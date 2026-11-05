/**
 * ==============================================================================
 * JANMITRA - Janmitra Municipal Corporation (JMC)
 * File: src/pages/LandingHome.jsx
 * Description: Master Public Home Page.
 *              - 100% English language throughout.
 *              - Branding: Janmitra Municipal Corporation (JMC).
 *              - Header Right Actions: STRICTLY Login (Citizen & Worker dropdown)
 *                and Citizen Register only. Zero Staff/Officer/Admin options on home page.
 *              - PowerBI-style interactive Geo-Density Heatmap with live slicers,
 *                density gradients, cluster pins, and drilldown scorecard.
 *              - 4 clean transparency metrics (Total, In-Progress, Resolved, SLA Adherence).
 * ==============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  Search,
  ChevronDown,
  Building2,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Droplets,
  Truck,
  HardHat,
  ArrowRight,
  Check,
  X,
  PhoneCall,
  Layers,
  Filter,
  BarChart3,
  Flame,
} from 'lucide-react';

// Municipal Ward Master Data
const MUNICIPAL_WARDS = [
  {
    id: 1,
    name: 'Ward 1 — South Zone',
    zone: 'South Zone',
    center: [21.1215, 79.0665],
    total: 342,
    resolved: 301,
    inProgress: 41,
    slaRate: '93.5%',
    densityIndex: 74,
    densityLevel: 'Moderate',
    densityColor: '#f59e0b',
    officer: 'Er. R. K. Meshram',
  },
  {
    id: 2,
    name: 'Ward 2 — West Zone',
    zone: 'West Zone',
    center: [21.1442, 79.0601],
    total: 418,
    resolved: 386,
    inProgress: 32,
    slaRate: '95.2%',
    densityIndex: 88,
    densityLevel: 'High Hotspot',
    densityColor: '#ef4444',
    officer: 'Er. Sandeep Patil',
  },
  {
    id: 3,
    name: 'Ward 3 — East Zone',
    zone: 'East Zone',
    center: [21.1200, 79.0980],
    total: 310,
    resolved: 268,
    inProgress: 42,
    slaRate: '91.8%',
    densityIndex: 71,
    densityLevel: 'Moderate',
    densityColor: '#f59e0b',
    officer: 'Er. V. N. Gaikwad',
  },
  {
    id: 4,
    name: 'Ward 4 — Central Zone',
    zone: 'Central Zone',
    center: [21.1350, 79.0820],
    total: 358,
    resolved: 319,
    inProgress: 39,
    slaRate: '94.6%',
    densityIndex: 65,
    densityLevel: 'Controlled',
    densityColor: '#10b981',
    officer: 'Er. Rajesh Tijare',
  },
];

// Heatmap Cluster Coordinates (PowerBI Hotspots)
const HEATMAP_POINTS = [
  // West Zone Hotspots (High Density)
  {
    id: 'HP-101',
    wardId: 2,
    wardName: 'Ward 2 (West Zone)',
    lat: 21.1458,
    lng: 79.0882,
    title: 'Interchange Junction Road Crater',
    category: 'PWD',
    categoryName: 'Roads & Infrastructure',
    count: 28,
    status: 'In-Progress',
    severity: 'Critical',
    color: '#ef4444',
    radius: 18,
    slaClock: '8 hrs remaining',
  },
  {
    id: 'HP-102',
    wardId: 2,
    wardName: 'Ward 2 (West Zone)',
    lat: 21.1398,
    lng: 79.0552,
    title: 'Commercial Market Waste Pile',
    category: 'SWM',
    categoryName: 'Garbage & Waste',
    count: 22,
    status: 'Resolved',
    severity: 'Critical',
    color: '#ef4444',
    radius: 16,
    slaClock: 'Resolved within SLA',
  },
  {
    id: 'HP-103',
    wardId: 2,
    wardName: 'Ward 2 (West Zone)',
    lat: 21.1520,
    lng: 79.0620,
    title: 'West Corridor Streetlight Feeder',
    category: 'ELEC',
    categoryName: 'Street Lighting',
    count: 14,
    status: 'In-Progress',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 13,
    slaClock: '4 hrs remaining',
  },
  {
    id: 'HP-104',
    wardId: 2,
    wardName: 'Ward 2 (West Zone)',
    lat: 21.1410,
    lng: 79.0720,
    title: 'Transit Square Broken Pavement',
    category: 'PWD',
    categoryName: 'Roads & Infrastructure',
    count: 11,
    status: 'Resolved',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 12,
    slaClock: 'Resolved within SLA',
  },

  // South Zone Hotspots
  {
    id: 'HP-201',
    wardId: 1,
    wardName: 'Ward 1 (South Zone)',
    lat: 21.1182,
    lng: 79.0715,
    title: 'Metro Corridor High-Mast Lighting',
    category: 'ELEC',
    categoryName: 'Street Lighting',
    count: 18,
    status: 'Resolved',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 14,
    slaClock: 'Resolved within SLA',
  },
  {
    id: 'HP-202',
    wardId: 1,
    wardName: 'Ward 1 (South Zone)',
    lat: 21.1140,
    lng: 79.0620,
    title: 'Main Pipeline Pressure Leakage',
    category: 'PHE',
    categoryName: 'Water & Drainage',
    count: 15,
    status: 'In-Progress',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 13,
    slaClock: '11 hrs remaining',
  },
  {
    id: 'HP-203',
    wardId: 1,
    wardName: 'Ward 1 (South Zone)',
    lat: 21.1080,
    lng: 79.0580,
    title: 'Residential Sector Cleanliness Drive',
    category: 'SWM',
    categoryName: 'Garbage & Waste',
    count: 8,
    status: 'Resolved',
    severity: 'Low',
    color: '#10b981',
    radius: 10,
    slaClock: 'Resolved within SLA',
  },

  // East Zone Hotspots
  {
    id: 'HP-301',
    wardId: 3,
    wardName: 'Ward 3 (East Zone)',
    lat: 21.1285,
    lng: 79.0945,
    title: 'Hospital Avenue Drainage Choke',
    category: 'PHE',
    categoryName: 'Water & Drainage',
    count: 24,
    status: 'In-Progress',
    severity: 'Critical',
    color: '#ef4444',
    radius: 17,
    slaClock: '6 hrs remaining',
  },
  {
    id: 'HP-302',
    wardId: 3,
    wardName: 'Ward 3 (East Zone)',
    lat: 21.1220,
    lng: 79.0990,
    title: 'Inner Ring Road Deep Potholes',
    category: 'PWD',
    categoryName: 'Roads & Infrastructure',
    count: 16,
    status: 'Resolved',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 13,
    slaClock: 'Resolved within SLA',
  },
  {
    id: 'HP-303',
    wardId: 3,
    wardName: 'Ward 3 (East Zone)',
    lat: 21.1340,
    lng: 79.1050,
    title: 'Sector 5 Secondary Bin Clearance',
    category: 'SWM',
    categoryName: 'Garbage & Waste',
    count: 9,
    status: 'Resolved',
    severity: 'Low',
    color: '#10b981',
    radius: 10,
    slaClock: 'Resolved within SLA',
  },

  // Central Zone Hotspots
  {
    id: 'HP-401',
    wardId: 4,
    wardName: 'Ward 4 (Central Zone)',
    lat: 21.1350,
    lng: 79.0820,
    title: 'Central Avenue Heavy Waterlogging',
    category: 'PHE',
    categoryName: 'Water & Drainage',
    count: 19,
    status: 'In-Progress',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 14,
    slaClock: '9 hrs remaining',
  },
  {
    id: 'HP-402',
    wardId: 4,
    wardName: 'Ward 4 (Central Zone)',
    lat: 21.1380,
    lng: 79.0780,
    title: 'Metro Underpass Overhead Line',
    category: 'ELEC',
    categoryName: 'Street Lighting',
    count: 13,
    status: 'Resolved',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 12,
    slaClock: 'Resolved within SLA',
  },
  {
    id: 'HP-403',
    wardId: 4,
    wardName: 'Ward 4 (Central Zone)',
    lat: 21.1310,
    lng: 79.0860,
    title: 'Civic Center Road Resurfacing',
    category: 'PWD',
    categoryName: 'Roads & Infrastructure',
    count: 15,
    status: 'Resolved',
    severity: 'Moderate',
    color: '#f59e0b',
    radius: 13,
    slaClock: 'Resolved within SLA',
  },
];

// Recent Public Resolutions with Real Authentic Civic Photographs
const RECENT_RESOLUTIONS = [
  {
    id: 'CMP-2026-1048',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    title: 'Severe road crater near main transit flyover junction',
    address: 'Near Variety Square, Ward 2 (West Zone)',
    status: 'Resolved',
    resolvedHours: '19 hrs',
    worker: 'Nitin Bawankar (PWD Lead)',
    citizenVerified: true,
    photoBefore: '/civic-photos/pothole_before.jpg',
    photoAfter: '/civic-photos/pothole_after.jpg',
    date: 'Today, 2:40 PM',
  },
  {
    id: 'CMP-2026-1044',
    category: 'Garbage & Waste',
    dept: 'SWM',
    title: 'Overflowing community bin and scattered waste dump',
    address: 'Outer Ring Market Corridor, Ward 2 (West Zone)',
    status: 'Resolved',
    resolvedHours: '14 hrs',
    worker: 'Vinod Meshram (SWM Sanitation)',
    citizenVerified: true,
    photoBefore: '/civic-photos/garbage_before.jpg',
    photoAfter: '/civic-photos/cleaned_area.jpg',
    date: 'Yesterday, 5:15 PM',
  },
  {
    id: 'CMP-2026-1039',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    title: 'Heavy surface erosion and broken pavement reconstruction',
    address: 'Expressway Avenue, Opposite Metro Station, Ward 1',
    status: 'Resolved',
    resolvedHours: '24 hrs',
    worker: 'Pravin Wankhede (PWD Supervisor)',
    citizenVerified: true,
    photoBefore: '/civic-photos/road_damage.jpg',
    photoAfter: '/civic-photos/pothole_after.jpg',
    date: '2 Nov, 8:30 PM',
  },
  {
    id: 'CMP-2026-1032',
    category: 'Water & Drainage',
    dept: 'PHE',
    title: 'Underground pipeline excavation and storm-drain desilting',
    address: 'Hospital Square intersection, Ward 3 (East Zone)',
    status: 'Resolved',
    resolvedHours: '22 hrs',
    worker: 'Sunil Thakre (PHE Maintenance)',
    citizenVerified: true,
    photoBefore: '/civic-photos/drainage_work.jpg',
    photoAfter: '/civic-photos/cleaned_area.jpg',
    date: '1 Nov, 11:10 AM',
  },
];

// Municipal Departments Info
const DEPARTMENTS = [
  {
    code: 'PWD',
    name: 'Public Works (PWD)',
    desc: 'Pothole restoration, road resurfacing, broken pavements and bridge maintenance.',
    sla: '48 Hours',
    icon: HardHat,
    color: 'from-blue-600 to-indigo-700',
    badge: 'bg-blue-100 text-blue-800',
    activeCount: 68,
  },
  {
    code: 'SWM',
    name: 'Solid Waste Management',
    desc: 'Garbage dump clearance, door-to-door collection and community bin sanitation.',
    sla: '24 Hours',
    icon: Truck,
    color: 'from-emerald-600 to-teal-700',
    badge: 'bg-emerald-100 text-emerald-800',
    activeCount: 42,
  },
  {
    code: 'PHE',
    name: 'Water & Drainage (PHE)',
    desc: 'Drinking water pipeline bursts, sewage overflow and storm-drain desilting.',
    sla: '24 Hours',
    icon: Droplets,
    color: 'from-cyan-600 to-blue-700',
    badge: 'bg-cyan-100 text-cyan-800',
    activeCount: 39,
  },
  {
    code: 'ELEC',
    name: 'Street Lighting & Power',
    desc: 'Dark spots, faulty streetlights, hanging electric wires and smart LED feeder panels.',
    sla: '12 Hours',
    icon: Lightbulb,
    color: 'from-amber-500 to-orange-600',
    badge: 'bg-amber-100 text-amber-800',
    activeCount: 35,
  },
];

// Helper to smoothly pan and zoom map
function MapCenterController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true, duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function LandingHome() {
  const navigate = useNavigate();

  // Header Dropdown state (STRICTLY Login only)
  const [isLoginDropdownOpen, setIsLoginDropdownOpen] = useState(false);

  // PowerBI Heatmap Slicer States
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [mapCenter, setMapCenter] = useState([21.1458, 79.0882]);
  const [mapZoom, setMapZoom] = useState(13);
  const [activeHotspot, setActiveHotspot] = useState(null);

  // Interactive Tracking Bar state
  const [trackingQuery, setTrackingQuery] = useState('');
  const [trackedComplaint, setTrackedComplaint] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [isSearchingTrack, setIsSearchingTrack] = useState(false);

  // Close dropdown on outside click
  const loginRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (loginRef.current && !loginRef.current.contains(event.target)) {
        setIsLoginDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Heatmap Points based on Slicers
  const filteredPoints = HEATMAP_POINTS.filter((p) => {
    if (selectedWard !== 'ALL' && p.wardId !== Number(selectedWard)) return false;
    if (selectedDept !== 'ALL' && p.category !== selectedDept) return false;
    if (selectedSeverity !== 'ALL' && p.severity !== selectedSeverity) return false;
    return true;
  });

  // Selected Ward metadata for PowerBI Card
  const currentWardData =
    selectedWard !== 'ALL'
      ? MUNICIPAL_WARDS.find((w) => w.id === Number(selectedWard))
      : {
          name: 'Citywide Municipal Overview',
          zone: 'All 4 Operational Wards',
          total: 1428,
          resolved: 1192,
          inProgress: 184,
          slaRate: '94.2%',
          densityIndex: 82,
          densityLevel: 'Active Monitoring',
          densityColor: '#ef4444',
          officer: 'JMC Command Center Direct',
        };

  // Quick Tracking Handler
  const handleTrackSubmit = (e) => {
    e.preventDefault();
    const query = trackingQuery.trim().toUpperCase();
    if (!query) {
      setTrackingError('Please enter a complaint tracking ID (e.g. CMP-2026-1048)');
      return;
    }

    setIsSearchingTrack(true);
    setTrackingError('');

    setTimeout(() => {
      const found = RECENT_RESOLUTIONS.find(
        (c) => c.id.toUpperCase().includes(query) || query.includes(c.id.toUpperCase())
      );

      if (found) {
        setTrackedComplaint(found);
      } else {
        setTrackedComplaint({
          id: query.startsWith('CMP-') ? query : `CMP-2026-${query}`,
          category: 'Roads & Infrastructure',
          dept: 'PWD',
          title: `Reported Grievance Record [${query}]`,
          address: 'Ward 2 — West Zone, JMC',
          status: 'In-Progress',
          resolvedHours: 'Est. 12 hrs remaining',
          worker: 'Field Worker Assigned (JMC Ward Team)',
          citizenVerified: false,
          date: 'Yesterday, 3:30 PM',
          photoBefore: '/civic-photos/pothole_before.jpg',
          photoAfter: null,
        });
      }
      setIsSearchingTrack(false);
    }, 350);
  };

  // Zoom to a specific hotspot
  const handleFocusHotspot = (point) => {
    setActiveHotspot(point);
    setMapCenter([point.lat, point.lng]);
    setMapZoom(15);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* ========================================================================= */}
      {/* 1. TOP ANNOUNCEMENT & MUNICIPAL STATUS BAR                                */}
      {/* ========================================================================= */}
      <div className="bg-[#0b1d3a] text-slate-200 text-xs py-2 px-4 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              24x7 Command Center Live
            </span>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden md:inline text-slate-300">
              Janmitra Municipal Corporation (JMC) Civic Grievance Redressal System
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-300">
            <span className="flex items-center gap-1 hover:text-white transition">
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              Toll-Free Helpline: <strong className="text-white">1800-233-3764</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MASTER NAVBAR (STRICTLY LOGIN & CITIZEN REGISTER ONLY)                 */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Emblem - Official Municipal Gold Crest */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3.5 group min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-600 p-[2px] shadow-md shadow-blue-900/20 group-hover:scale-105 transition transform flex items-center justify-center shrink-0">
              <img 
                src="/janmitra-logo.png" 
                alt="Janmitra Municipal Corporation Official Seal" 
                className="w-full h-full rounded-full object-contain filter drop-shadow-sm" 
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-[#0d2a53]">
                  JANMITRA
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 rounded-md border border-blue-200 shrink-0">
                  JMC
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 leading-tight truncate">
                Janmitra Municipal Corporation
              </p>
            </div>
          </Link>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#statistics" className="hover:text-[#0d2a53] transition">
              Live Statistics
            </a>
            <a href="#civic-heatmap" className="hover:text-[#0d2a53] transition">
              Interactive Heatmap
            </a>
            <a href="#resolutions" className="hover:text-[#0d2a53] transition">
              Recent Resolutions
            </a>
            <a href="#how-it-works" className="hover:text-[#0d2a53] transition">
              AI Redressal Flow
            </a>
            <a href="#departments" className="hover:text-[#0d2a53] transition">
              Departments
            </a>
          </nav>

          {/* Right Action Buttons: STRICTLY LOGIN & CITIZEN REGISTER ONLY */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* LOGIN BUTTON WITH DROPDOWN (Citizen & Worker Only) */}
            <div className="relative" ref={loginRef}>
              <button
                type="button"
                onClick={() => setIsLoginDropdownOpen((prev) => !prev)}
                className="px-4 py-2.5 text-xs font-bold text-[#0d2a53] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200/80 flex items-center gap-1.5 transition shadow-sm"
              >
                <span>Login</span>
                <ChevronDown className="w-3.5 h-3.5 text-blue-700" />
              </button>

              {/* Dropdown: Citizen Login & Worker Login */}
              {isLoginDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Choose Login Portal
                  </div>

                  {/* Citizen Login Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginDropdownOpen(false);
                      navigate('/login?role=citizen');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-start gap-3 transition group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition">
                      👤
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                        Citizen Login
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Report issues & track progress
                      </div>
                    </div>
                  </button>

                  {/* Worker Login Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginDropdownOpen(false);
                      navigate('/login?role=worker');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-amber-50 flex items-start gap-3 transition group border-t border-slate-100"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base shrink-0 group-hover:scale-105 transition">
                      👷
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                        Field Worker Login
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Assigned municipal repair tasks
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* CITIZEN REGISTER BUTTON */}
            <button
              type="button"
              onClick={() => navigate('/login?tab=register&role=citizen')}
              className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#0d2a53] to-[#1e40af] hover:from-[#0a2040] hover:to-[#17338e] rounded-xl shadow-md shadow-blue-900/20 flex items-center gap-1.5 transition transform active:scale-95 shrink-0"
            >
              <span><span className="hidden sm:inline">Citizen </span>Register</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. HERO SECTION WITH GRIEVANCE TRACKER                                    */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0d2a53] via-[#0f3468] to-[#0a1e3b] text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#93c5fd_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>

        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-blue-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Janmitra Municipal Corporation • Official Civic Redressal</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
            Crowdsourced Civic Issue <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-amber-400">Reporting &amp; Resolution</span>
          </h1>

          <p className="text-sm sm:text-base text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
            Empowering citizens to report road potholes, waste dumps, broken streetlights, and drainage issues.
            Auto-verified by computer vision AI and resolved by municipal field staff with photographic proof.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/login?role=citizen')}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/25 flex items-center gap-2 transition transform hover:-translate-y-0.5"
            >
              <AlertTriangle className="w-4 h-4 text-slate-900" />
              <span>Report Civic Grievance</span>
            </button>

            <a
              href="#civic-heatmap"
              className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/20 backdrop-blur-sm flex items-center gap-2 transition"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>City Heatmap Analytics</span>
            </a>
          </div>

          {/* Instant Complaint Tracker Search Bar */}
          <div className="pt-6 max-w-2xl mx-auto">
            <form
              onSubmit={handleTrackSubmit}
              className="bg-white/95 backdrop-blur-lg p-2 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-2"
            >
              <div className="pl-3 text-slate-400">
                <Search className="w-5 h-5 text-blue-900" />
              </div>
              <input
                type="text"
                placeholder="Track grievance by ID (e.g. CMP-2026-1048 or c-101)..."
                value={trackingQuery}
                onChange={(e) => setTrackingQuery(e.target.value)}
                className="w-full py-2.5 px-2 text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none font-medium"
              />
              <button
                type="submit"
                disabled={isSearchingTrack}
                className="px-5 py-2.5 bg-[#0d2a53] hover:bg-[#153e78] text-white font-bold text-xs rounded-xl transition shrink-0 flex items-center gap-1.5 shadow-md"
              >
                {isSearchingTrack ? 'Searching...' : 'Track Status'}
              </button>
            </form>

            {trackingError && (
              <p className="text-amber-300 text-xs mt-2 font-medium">{trackingError}</p>
            )}

            {/* Instant Track Result Card */}
            {trackedComplaint && (
              <div className="mt-4 p-4 rounded-2xl bg-white text-slate-800 text-left shadow-2xl border border-blue-200 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-blue-100 text-blue-800">
                      {trackedComplaint.id}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 mt-1">
                      {trackedComplaint.title}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {trackedComplaint.address}
                    </p>
                  </div>
                  <button
                    onClick={() => setTrackedComplaint(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Department
                    </span>
                    <span className="font-bold text-slate-700">{trackedComplaint.dept}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Current Status
                    </span>
                    <span
                      className={`font-bold inline-block px-2 py-0.5 rounded text-[11px] ${
                        trackedComplaint.status === 'Resolved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {trackedComplaint.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Resolution Time
                    </span>
                    <span className="font-bold text-slate-700">
                      {trackedComplaint.resolvedHours}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">
                      Validation
                    </span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Assigned: <strong>{trackedComplaint.worker}</strong>
                  </span>
                  <Link
                    to={`/citizen/complaint/${trackedComplaint.id}`}
                    className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <span>View Public Timeline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. LIVE PUBLIC TRANSPARENCY STATISTICS (4 Clean Core Metric Cards)        */}
      {/* ========================================================================= */}
      <section id="statistics" className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Public Transparency Ledger
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a53] mt-2">
              Municipal Real-time Civic Counters
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live statistics updated across all 4 operational wards of Janmitra Municipal Corporation.
            </p>
          </div>

          {/* 4 Clean Core Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Total Grievances */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Total Registered
                </span>
                <span className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base">
                  📋
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-[#0d2a53]">1,428</div>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Citywide civic issues submitted by citizens across all 4 municipal zones.
              </p>
            </div>

            {/* Card 2: In-Progress */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-amber-50/40 border border-amber-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  Under Active Action
                </span>
                <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base">
                  ⚙️
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-700">184</div>
              <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
                Field teams and repair crews currently deployed on-site in wards.
              </p>
            </div>

            {/* Card 3: Resolved & Closed */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/40 border border-emerald-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Successfully Resolved
                </span>
                <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base">
                  ✅
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-700">1,192</div>
              <p className="text-xs text-emerald-700 mt-1.5 leading-relaxed">
                Verified with resolution photographs and approved by citizens.
              </p>
            </div>

            {/* Card 4: SLA Adherence Rate */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/40 border border-purple-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">
                  SLA Adherence Rate
                </span>
                <span className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base">
                  🏆
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-purple-700">94.2%</div>
              <p className="text-xs text-purple-700 mt-1.5 leading-relaxed">
                Grievances closed strictly within departmental SLA turnaround limits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. MUNICIPAL GEO-INTELLIGENCE & REAL-TIME HEATMAP                          */}
      {/* ========================================================================= */}
      <section id="civic-heatmap" className="py-14 bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Heatmap Top Navigation Ribbon */}
          <div className="bg-slate-800/90 rounded-2xl p-4 sm:p-5 border border-slate-700 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-extrabold shadow-md">
                <BarChart3 className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    Municipal Geo-Intelligence &amp; Heatmap Analytics
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-md">
                    LIVE TELEMETRY
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Janmitra Municipal Corporation | Real-Time Issue Concentration & Spatial Triage
                </p>
              </div>
            </div>

            {/* Quick Reset Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedWard('ALL');
                  setSelectedDept('ALL');
                  setSelectedSeverity('ALL');
                  setMapCenter([21.1458, 79.0882]);
                  setMapZoom(13);
                  setActiveHotspot(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold border border-slate-600 transition"
              >
                Reset Map Filters
              </button>
            </div>
          </div>

          {/* PowerBI Slicer Bar (Interactive Filters) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/80">
            {/* Slicer 1: Ward Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Filter className="w-3 h-3 text-amber-400" /> Ward Slicer
              </label>
              <select
                value={selectedWard}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedWard(val);
                  if (val === 'ALL') {
                    setMapCenter([21.1458, 79.0882]);
                    setMapZoom(13);
                  } else {
                    const w = MUNICIPAL_WARDS.find((item) => item.id === Number(val));
                    if (w) {
                      setMapCenter(w.center);
                      setMapZoom(14);
                    }
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Municipal Wards (Citywide)</option>
                <option value="1">Ward 1 — South Zone</option>
                <option value="2">Ward 2 — West Zone</option>
                <option value="3">Ward 3 — East Zone</option>
                <option value="4">Ward 4 — Central Zone</option>
              </select>
            </div>

            {/* Slicer 2: Department Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" /> Department Category
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="ALL">All Municipal Domains</option>
                <option value="PWD">PWD — Roads & Infrastructure</option>
                <option value="SWM">SWM — Solid Waste Management</option>
                <option value="PHE">PHE — Water & Drainage</option>
                <option value="ELEC">ELEC — Street Lighting & Electrical</option>
              </select>
            </div>

            {/* Slicer 3: Intensity / Severity Slicer */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" /> Heat Density Threshold
              </label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-rose-400"
              >
                <option value="ALL">All Concentration Levels</option>
                <option value="Critical">Critical Density Hotspots (Red &gt; 20)</option>
                <option value="Moderate">Moderate Density Clusters (Amber 10-20)</option>
                <option value="Low">Controlled Density Zones (Green &lt; 10)</option>
              </select>
            </div>
          </div>

          {/* Main PowerBI Visual Canvas (Map + Analytical Drilldown Panel) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Interactive Leaflet Map (8 Cols) */}
            <div className="lg:col-span-8 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl relative bg-slate-950 min-h-[480px]">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                scrollWheelZoom={true}
                className="w-full h-[480px] sm:h-[540px] z-10"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapCenterController center={mapCenter} zoom={mapZoom} />

                {/* Ward Level Semi-Transparent Density Circles (PowerBI Thermal Effect) */}
                {MUNICIPAL_WARDS.map((w) => {
                  if (selectedWard !== 'ALL' && w.id !== Number(selectedWard)) return null;
                  return (
                    <Circle
                      key={`circle-ward-${w.id}`}
                      center={w.center}
                      radius={w.id === 2 ? 1400 : 1100}
                      pathOptions={{
                        color: w.densityColor,
                        fillColor: w.densityColor,
                        fillOpacity: 0.18,
                        weight: 2,
                        dashArray: '4, 6',
                      }}
                    >
                      <Tooltip permanent direction="center">
                        <span className="text-[10px] font-black text-slate-900 bg-white/90 px-2 py-0.5 rounded shadow">
                          {w.name} ({w.densityIndex} Index)
                        </span>
                      </Tooltip>
                    </Circle>
                  );
                })}

                {/* Individual Issue Hotspots (Interactive Pins with Gradient Rings) */}
                {filteredPoints.map((point) => (
                  <React.Fragment key={point.id}>
                    {/* Outer Heat Aura */}
                    <Circle
                      center={[point.lat, point.lng]}
                      radius={point.count * 20}
                      pathOptions={{
                        color: point.color,
                        fillColor: point.color,
                        fillOpacity: 0.25,
                        weight: 1,
                      }}
                    />

                    {/* Core Point Marker */}
                    <CircleMarker
                      center={[point.lat, point.lng]}
                      radius={point.radius}
                      pathOptions={{
                        color: '#ffffff',
                        fillColor: point.color,
                        fillOpacity: 0.95,
                        weight: 2.5,
                      }}
                      eventHandlers={{
                        click: () => setActiveHotspot(point),
                      }}
                    >
                      <Popup>
                        <div className="p-2 space-y-1.5 text-slate-900 max-w-xs font-sans">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                              {point.category} &bull; {point.wardName}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                                point.severity === 'Critical'
                                  ? 'bg-red-100 text-red-700'
                                  : point.severity === 'Moderate'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {point.count} Reports
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900">{point.title}</h4>
                          <div className="text-[11px] text-slate-600 flex justify-between">
                            <span>Status: <strong>{point.status}</strong></span>
                            <span>SLA: <strong className="text-blue-700">{point.slaClock}</strong></span>
                          </div>
                          <div className="pt-1 text-[10px] text-slate-400">
                            Coordinates: {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                ))}
              </MapContainer>

              {/* In-Map PowerBI Legend Overlay */}
              <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 text-[11px] text-slate-200 shadow-xl space-y-1">
                <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider block">
                  Density Gradient Legend
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span> High (&gt;20)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></span> Moderate (10-20)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span> Controlled (&lt;10)
                  </span>
                </div>
              </div>
            </div>

            {/* Right Analytical Drilldown Panel (4 Cols - PowerBI Scorecard Style) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Selected Ward Scorecard Card */}
              <div className="bg-slate-800/90 rounded-3xl p-5 border border-slate-700 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block">
                      Active Ward Analytics
                    </span>
                    <h3 className="text-base font-bold text-white">{currentWardData.name}</h3>
                    <p className="text-xs text-slate-400">{currentWardData.zone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-white">{currentWardData.total}</span>
                    <span className="text-[10px] text-slate-400 block">Total Issues</span>
                  </div>
                </div>

                {/* Density Index Meter */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Density Index:</span>
                    <strong style={{ color: currentWardData.densityColor }}>
                      {currentWardData.densityIndex} / 100 ({currentWardData.densityLevel})
                    </strong>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${currentWardData.densityIndex}%`,
                        backgroundColor: currentWardData.densityColor,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Sub Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-bold">Active Fixes</span>
                    <span className="text-base font-black text-amber-400">
                      {currentWardData.inProgress}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block font-bold">SLA Adherence</span>
                    <span className="text-base font-black text-emerald-400">
                      {currentWardData.slaRate}
                    </span>
                  </div>
                </div>

                {/* Departmental Share Bar Breakdown */}
                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Domain Distribution (Top Complaints)
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>Roads & Potholes (PWD)</span>
                      <strong className="text-white">42%</strong>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full w-[42%]"></div>
                    </div>

                    <div className="flex justify-between text-slate-400 pt-1">
                      <span>Garbage & Cleanliness (SWM)</span>
                      <strong className="text-white">28%</strong>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[28%]"></div>
                    </div>

                    <div className="flex justify-between text-slate-400 pt-1">
                      <span>Water Pipeline & Leaks (PHE)</span>
                      <strong className="text-white">18%</strong>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-cyan-500 h-full w-[18%]"></div>
                    </div>

                    <div className="flex justify-between text-slate-400 pt-1">
                      <span>Streetlights (ELEC)</span>
                      <strong className="text-white">12%</strong>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full w-[12%]"></div>
                    </div>
                  </div>
                </div>

                {/* Ward Executive Contact */}
                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-700 flex items-center justify-between">
                  <span>Nodal Officer:</span>
                  <strong className="text-slate-200">{currentWardData.officer}</strong>
                </div>
              </div>

              {/* Hotspot Focus Quick Selector */}
              <div className="bg-slate-800/90 rounded-3xl p-4 border border-slate-700 shadow-xl space-y-2.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Quick Focus High-Density Spots
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {HEATMAP_POINTS.slice(0, 4).map((pt) => (
                    <button
                      key={pt.id}
                      onClick={() => handleFocusHotspot(pt)}
                      className="w-full text-left p-2 rounded-xl bg-slate-900/60 hover:bg-slate-700/80 border border-slate-700 transition flex items-center justify-between text-xs group"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-white group-hover:text-amber-300 truncate">
                          {pt.title}
                        </div>
                        <div className="text-[10px] text-slate-400">{pt.wardName}</div>
                      </div>
                      <span
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: `${pt.color}22`, color: pt.color }}
                      >
                        {pt.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. LIVE PUBLIC REDRESSALS FEED (Recent Resolved Complaints)               */}
      {/* ========================================================================= */}
      <section id="resolutions" className="py-14 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Verifiable Public Redressal
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a53] mt-2">
                Recent Civic Fixes Across Janmitra City
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Every closed grievance contains verifiable photographic proof approved by the citizen.
              </p>
            </div>

            <button
              onClick={() => navigate('/login?role=citizen')}
              className="px-4 py-2 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl transition flex items-center gap-1.5 self-start md:self-auto"
            >
              <span>View Citizen Grievance Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {RECENT_RESOLUTIONS.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition space-y-3 flex flex-col justify-between"
              >
                <div>
                  {/* Before / After Photo Comparison Preview */}
                  <div className="relative h-44 bg-slate-100 overflow-hidden group">
                    <img
                      src={item.photoBefore}
                      alt="Before fix"
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-extrabold backdrop-blur-sm">
                      {item.dept}
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm">
                      <Check className="w-3 h-3" />
                      <span>{item.resolvedHours}</span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-[10px] font-bold text-slate-800 truncate">
                      {item.id}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{item.address}</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-slate-100 mt-auto">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2">
                    <span>{item.worker}</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. THE 4-STEP AI REDRESSAL LIFECYCLE (How It Works)                       */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-14 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
              Autonomous Municipal Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a53] mt-2">
              How JANMITRA Resolves Issues in 4 Steps
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Zero human delays between citizen submission and field worker dispatch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center text-sm shadow-sm">
                01
              </div>
              <h3 className="font-bold text-base text-slate-900">Geo-Tagged Capture</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Citizen clicks a photograph. GPS coordinates and municipal ward boundaries are
                automatically tagged with camera metadata.
              </p>
              <div className="text-[11px] font-semibold text-blue-600 pt-1">
                Camera EXIF & Ward Verification
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 font-extrabold flex items-center justify-center text-sm shadow-sm">
                02
              </div>
              <h3 className="font-bold text-base text-slate-900">Computer Vision Triage</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Automated validation inspects defect authenticity in seconds. The spatial engine
                detects and links duplicate civic reports.
              </p>
              <div className="text-[11px] font-semibold text-indigo-600 pt-1">
                Precision & Duplicate Clustering
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 font-extrabold flex items-center justify-center text-sm shadow-sm">
                03
              </div>
              <h3 className="font-bold text-base text-slate-900">Automated Dispatch</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Complaint is auto-routed to the exact department (PWD, SWM, PHE, ELEC) and assigned
                to on-duty ward workers.
              </p>
              <div className="text-[11px] font-semibold text-amber-600 pt-1">
                SLA Countdown & Push Alerts
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm shadow-sm">
                04
              </div>
              <h3 className="font-bold text-base text-slate-900">Proof & Citizen Closure</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Worker uploads resolution photo proof. Ticket is only closed when the citizen
                verifies satisfaction or 48 hours elapse.
              </p>
              <div className="text-[11px] font-semibold text-emerald-600 pt-1">
                Citizen Approval & Rating
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. 4 CANONICAL CIVIC DEPARTMENTS                                          */}
      {/* ========================================================================= */}
      <section id="departments" className="py-14 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Departmental Coverage
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0d2a53] mt-2">
              Janmitra Municipal Core Service Domains
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Guaranteed resolution SLAs backed by dedicated municipal field teams.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {DEPARTMENTS.map((dept) => {
              const IconComp = dept.icon;
              return (
                <div
                  key={dept.code}
                  className="rounded-2xl border border-slate-200 p-6 bg-slate-50/60 hover:bg-white hover:border-blue-300 hover:shadow-lg transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${dept.color} text-white flex items-center justify-center shadow-md`}
                    >
                      <IconComp className="w-6 h-6" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-400">
                          {dept.code}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dept.badge}`}>
                          SLA: {dept.sla}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{dept.name}</h3>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{dept.desc}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 text-xs flex items-center justify-between font-semibold text-slate-600">
                    <span>Active Dispatches:</span>
                    <strong className="text-[#0d2a53]">{dept.activeCount}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. MUNICIPAL FOOTER & EMERGENCY HELPLINES                                */}
      {/* ========================================================================= */}
      <footer className="bg-[#0b192c] text-slate-300 pt-12 pb-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Col 1: About JMC Janmitra */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-600 flex items-center justify-center shrink-0 shadow-lg">
                  <img src="/janmitra-logo.png" alt="Janmitra Municipal Corporation Seal" className="w-full h-full object-contain rounded-full" />
                </div>
                <div>
                  <span className="text-xl font-black tracking-tight text-white block leading-none">JANMITRA</span>
                  <span className="text-[10px] font-semibold text-amber-400 tracking-wider uppercase">Municipal Corporation</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Official Civic Grievance Redressal and Municipal Operations Management Portal
                for Janmitra Municipal Corporation (JMC).
              </p>
              <div className="text-[11px] text-amber-400 font-semibold">
                Clean City &bull; Smart City &bull; Digital Municipal Governance
              </div>
            </div>

            {/* Col 2: Official Civic Helplines */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-sm text-white uppercase tracking-wider">
                Official Civic Helplines
              </h4>
              <p className="text-slate-400">JMC Toll-Free: <strong>1800-233-3764</strong></p>
              <p className="text-slate-400">Municipal Control Room: <strong>0712-2567035</strong></p>
              <p className="text-slate-400">Citizen WhatsApp Bot: <strong>+91-8600004747</strong></p>
              <p className="text-slate-400">OCW Water Helpline: <strong>1800-266-9899</strong></p>
              <p className="text-slate-400">MSEDCL Power Helpline: <strong>1912</strong></p>
              <p className="text-slate-400">Disaster Management: <strong>1077</strong></p>
            </div>

            {/* Col 3: Operational Wards */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-sm text-white uppercase tracking-wider">
                Operational Wards
              </h4>
              <p className="text-slate-400">Ward 1: South Zone</p>
              <p className="text-slate-400">Ward 2: West Zone</p>
              <p className="text-slate-400">Ward 3: East Zone</p>
              <p className="text-slate-400">Ward 4: Central Zone</p>
            </div>

            {/* Col 4: Public Portals Access (STRICTLY CITIZEN & WORKER ONLY) */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-sm text-white uppercase tracking-wider">
                Public Portals
              </h4>
              <div className="flex flex-col gap-1.5">
                <Link to="/login?role=citizen" className="hover:text-blue-400 transition">
                  Citizen Redressal Portal
                </Link>
                <Link to="/login?role=worker" className="hover:text-amber-400 transition">
                  Field Worker Portal
                </Link>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              &copy; 2026 Janmitra Municipal Corporation (JMC). All Rights Reserved. Developed by Team
              ResolveIT.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
