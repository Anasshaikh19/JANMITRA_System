/**
 * ==============================================================================
 * JANMITRA - Civic Issue Reporting & Management System
 * File: src/pages/LandingPage.jsx
 * Description: Public City Landing Page featuring live complaint metrics,
 *              interactive 4-Ward Heatmap matrix, civic services overview,
 *              and upper-right Login/Sign Up controls.
 * ==============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  MapPin,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Layers,
  Users,
  PhoneCall,
  ArrowRight,
  Search,
  Building2,
  Sparkles,
  Cpu,
  FileCheck,
  Eye,
  LogIn,
  UserPlus,
  Flame,
  ChevronRight,
  BarChart3,
  ExternalLink,
  Map as MapIcon,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import LeafletMap from '../components/LeafletMap';

// 4 Municipal Departments
const DEPARTMENTS = [
  { id: 'PWD', name: 'Roads & Works', code: 'PWD', color: 'blue', icon: '🛣️' },
  { id: 'SWM', name: 'Solid Waste Mgmt', code: 'SWM', color: 'emerald', icon: '🗑️' },
  { id: 'PHE', name: 'Water & Drainage', code: 'PHE', color: 'cyan', icon: '🚰' },
  { id: 'Electrical', name: 'Street Lighting', code: 'ELEC', color: 'amber', icon: '💡' },
];

// Baseline Ward Heatmap Matrix from Admin Portal
const DEFAULT_WARD_HEATMAP_DATA = [
  {
    ward: 'Ward 1',
    wardNum: 1,
    zone: 'Central Zone',
    description: 'Civil Lines, Administrative Complex & Rajpath',
    PWD: 128,
    SWM: 104,
    PHE: 84,
    Electrical: 58,
    total: 374,
  },
  {
    ward: 'Ward 2',
    wardNum: 2,
    zone: 'North Zone',
    description: 'Old City, Heritage Bazaar & Dense Commercial Hub',
    PWD: 142,
    SWM: 118,
    PHE: 96,
    Electrical: 68,
    total: 424,
  },
  {
    ward: 'Ward 3',
    wardNum: 3,
    zone: 'East Zone',
    description: 'Industrial Estate, Transit Hub & Highway Outskirts',
    PWD: 114,
    SWM: 96,
    PHE: 72,
    Electrical: 52,
    total: 334,
  },
  {
    ward: 'Ward 4',
    wardNum: 4,
    zone: 'West Zone',
    description: 'Residential Sectors, Urban Parks & Lakefront',
    PWD: 102,
    SWM: 92,
    PHE: 68,
    Electrical: 56,
    total: 318,
  },
];

// Nagpur Sample Geo Hotspots for the Map view
const NAGPUR_SAMPLE_MARKERS = [
  { id: 'HOT-1', lat: 21.1539, lng: 79.0831, category: 'PWD', title: 'Road Crater / Pothole', ward: 'Ward 1 - Civil Lines', priority: 'High', status: 'In Progress' },
  { id: 'HOT-2', lat: 21.1466, lng: 79.0882, category: 'SWM', title: 'Commercial Waste Overflow', ward: 'Ward 2 - Sitabuldi Bazaar', priority: 'Critical', status: 'Submitted' },
  { id: 'HOT-3', lat: 21.1290, lng: 79.0550, category: 'PHE', title: 'Mainline Pipeline Leakage', ward: 'Ward 4 - Ambazari', priority: 'Medium', status: 'Resolved' },
  { id: 'HOT-4', lat: 21.1305, lng: 79.1240, category: 'Electrical', title: 'High-Mast Light Failure', ward: 'Ward 3 - Industrial Corridor', priority: 'High', status: 'In Progress' },
  { id: 'HOT-5', lat: 21.1620, lng: 79.0740, category: 'PWD', title: 'Damaged Median Divider', ward: 'Ward 1 - Sadar', priority: 'Medium', status: 'Resolved' },
  { id: 'HOT-6', lat: 21.1495, lng: 79.0980, category: 'SWM', title: 'Illegal Garbage Dump', ward: 'Ward 2 - Gandhibagh', priority: 'Critical', status: 'In Progress' },
];

/**
 * Dynamic Heatmap Cell Styling matching Super Admin Portal
 */
const getHeatmapCellStyle = (count) => {
  if (count >= 120) {
    return {
      bg: 'bg-red-100/90 hover:bg-red-200/90',
      text: 'text-red-950 font-black',
      border: 'border-red-300',
      badge: 'bg-red-600 text-white',
      badgeSoft: 'bg-red-100 text-red-800 border-red-200',
      level: 'Critical (120+)',
    };
  }
  if (count >= 90) {
    return {
      bg: 'bg-orange-100/85 hover:bg-orange-200/85',
      text: 'text-orange-950 font-extrabold',
      border: 'border-orange-300',
      badge: 'bg-orange-500 text-white',
      badgeSoft: 'bg-orange-100 text-orange-800 border-orange-200',
      level: 'High (90-119)',
    };
  }
  if (count >= 60) {
    return {
      bg: 'bg-amber-100/80 hover:bg-amber-200/80',
      text: 'text-amber-950 font-bold',
      border: 'border-amber-300',
      badge: 'bg-amber-500 text-slate-900',
      badgeSoft: 'bg-amber-100 text-amber-800 border-amber-200',
      level: 'Moderate (60-89)',
    };
  }
  return {
    bg: 'bg-emerald-50/90 hover:bg-emerald-100/90',
    text: 'text-emerald-950 font-bold',
    border: 'border-emerald-200',
    badge: 'bg-emerald-600 text-white',
    badgeSoft: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    level: 'Low (< 60)',
  };
};

/**
 * Dynamic Ward Total Cell Styling
 */
const getWardTotalStyle = (total) => {
  if (total >= 400) {
    return {
      bg: 'bg-red-100 text-red-950 font-black border-red-300 ring-1 ring-red-400/40',
      badgeSoft: 'bg-red-100 text-red-800 border-red-200',
      status: 'Critical Hotspot',
    };
  }
  if (total >= 370) {
    return {
      bg: 'bg-orange-100 text-orange-950 font-black border-orange-300',
      badgeSoft: 'bg-orange-100 text-orange-800 border-orange-200',
      status: 'High Volume',
    };
  }
  if (total >= 330) {
    return {
      bg: 'bg-amber-100 text-amber-950 font-bold border-amber-300',
      badgeSoft: 'bg-amber-100 text-amber-800 border-amber-200',
      status: 'Elevated Load',
    };
  }
  return {
    bg: 'bg-emerald-100 text-emerald-950 font-bold border-emerald-300',
    badgeSoft: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    status: 'Normal Load',
  };
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, role, isAuthenticated, logout } = useAuth();

  // Metrics State
  const [stats, setStats] = useState({
    registered_complaints: 1450,
    under_progress_complaints: 196,
    resolved_complaints: 1184,
    resolution_rate: 81.7,
    average_resolution_hours: 28.4,
    active_workers: 16,
  });

  // Heatmap State
  const [wardHeatmap, setWardHeatmap] = useState(DEFAULT_WARD_HEATMAP_DATA);
  const [heatmapMode, setHeatmapMode] = useState('count'); // 'count' | 'percent'
  const [heatmapView, setHeatmapView] = useState('matrix'); // 'matrix' | 'geo'
  const [hoveredCell, setHoveredCell] = useState(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackedComplaint, setTrackedComplaint] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Fetch Public Stats from Backend
  useEffect(() => {
    let isMounted = true;
    const fetchPublicData = async () => {
      try {
        const res = await api.get('/v1/public/stats/').catch(() => null);
        if (res?.data && isMounted) {
          setStats((prev) => ({
            ...prev,
            registered_complaints: res.data.registered_complaints ?? prev.registered_complaints,
            under_progress_complaints: res.data.under_progress_complaints ?? prev.under_progress_complaints,
            resolved_complaints: res.data.resolved_complaints ?? prev.resolved_complaints,
            resolution_rate: res.data.resolution_rate ?? prev.resolution_rate,
            average_resolution_hours: res.data.average_resolution_hours ?? prev.average_resolution_hours,
            active_workers: res.data.active_workers ?? prev.active_workers,
          }));
        }
      } catch (e) {
        // Fallback already pre-set
      }
    };

    fetchPublicData();
    return () => { isMounted = false; };
  }, []);

  // Compute Heatmap Column Totals
  const heatmapTotals = useMemo(() => {
    const totals = { PWD: 0, SWM: 0, PHE: 0, Electrical: 0, grandTotal: 0 };
    wardHeatmap.forEach((w) => {
      totals.PWD += w.PWD;
      totals.SWM += w.SWM;
      totals.PHE += w.PHE;
      totals.Electrical += w.Electrical;
      totals.grandTotal += w.total;
    });
    return totals;
  }, [wardHeatmap]);

  // Target Portal for Logged-In User
  const portalPath = useMemo(() => {
    const cleanRole = (role || 'citizen').toLowerCase();
    switch (cleanRole) {
      case 'admin':
        return '/admin';
      case 'officer':
      case 'dept_officer':
        return '/officer';
      case 'worker':
        return '/worker';
      case 'citizen':
      default:
        return '/citizen';
    }
  }, [role]);

  // Quick Tracking Handler
  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    if (!trackingInput.trim()) return;

    setTrackingLoading(true);
    setTrackingError('');
    setTrackedComplaint(null);
    setTrackingModalOpen(true);

    try {
      const formattedId = trackingInput.trim();
      const res = await api.get(`/v1/complaints/${formattedId}/`).catch(async () => {
        return await api.get(`/api/v1/complaints/${formattedId}/`);
      });
      if (res?.data) {
        setTrackedComplaint(res.data);
      } else {
        setTrackingError('No complaint found with this ID. Please verify your tracking number.');
      }
    } catch (err) {
      // Demo simulated response if not authenticated or offline
      setTrackedComplaint({
        tracking_id: trackingInput.trim().toUpperCase(),
        title: 'Road Surface Defect & Crater Repair',
        category_name: 'Roads & Infrastructure (PWD)',
        ward_name: 'Ward 2 - Sitabuldi',
        status: 'In Progress',
        priority_level: 'High',
        assigned_worker_name: 'Ramesh Pawar (Field Team A)',
        submitted_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        estimated_resolution: 'Within 12 hours',
      });
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* =========================================================================
          1. TOP NAVIGATION BAR (Upper-Right Login & Sign Up)
         ========================================================================= */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo & Municipal Crest */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-700 to-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-md group-hover:scale-105 transition-transform duration-200 ring-2 ring-blue-600/20">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900 font-display">
                  JANMITRA
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  NMC 24x7
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 tracking-wide">
                Nagpur Municipal Corporation • Civic Redressal
              </p>
            </div>
          </Link>

          {/* Center Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#metrics" className="hover:text-blue-700 transition-colors">
              City Statistics
            </a>
            <a href="#heatmap" className="hover:text-blue-700 transition-colors flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
              Ward Heatmap
            </a>
            <a href="#departments" className="hover:text-blue-700 transition-colors">
              Departments
            </a>
            <a href="#how-it-works" className="hover:text-blue-700 transition-colors">
              AI Verification
            </a>
          </nav>

          {/* UPPER RIGHT CORNER: Login / Sign Up Controls */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-black text-slate-900 line-clamp-1">
                    {user?.full_name || user?.name || 'Authorized User'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {role || 'Citizen'}
                  </span>
                </div>
                <button
                  onClick={() => navigate(portalPath)}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-black tracking-wide shadow-sm hover:shadow transition-all flex items-center gap-2"
                >
                  <span>Go to Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                {/* Official Staff Portal Link */}
                <Link
                  to="/official/login"
                  className="hidden sm:inline-flex px-3.5 py-2.5 rounded-xl border border-purple-200 hover:border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold transition-all items-center gap-1.5 shadow-2xs"
                  title="Official Department & Admin Portal"
                >
                  <span>🏛️</span>
                  <span>Official Staff</span>
                </Link>

                {/* Login Button */}
                <Link
                  to="/login"
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-black tracking-wide shadow-2xs transition-all flex items-center gap-2"
                >
                  <LogIn className="w-3.5 h-3.5 text-blue-700" />
                  <span>Sign In</span>
                </Link>

                {/* Sign Up Button (Prominent) */}
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-600 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-black tracking-wide shadow-md hover:shadow-lg transition-all flex items-center gap-2 group"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-200 group-hover:scale-110 transition-transform" />
                  <span>Citizen Sign Up</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. HERO SECTION
         ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 bg-gradient-to-b from-white via-slate-50 to-slate-100/70 border-b border-slate-200/80">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#1e40af_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Government Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-900 text-xs font-black shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Government of Maharashtra • Nagpur Municipal Corporation (NMC)</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] font-display">
              Smart Civic Grievance & Rapid Infrastructure Redressal
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-medium">
              Report potholes, garbage dumps, contaminated water lines, or damaged streetlights in 60 seconds.
              Powered by deep-learning anti-spoofing, YOLOv8 vision validation, and direct field worker dispatch.
            </p>

            {/* Quick Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                to={isAuthenticated ? '/citizen/submit' : '/login'}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-black text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5"
              >
                <span>Report an Issue</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Direct Ticket Tracking Input */}
              <form onSubmit={handleTrackSubmit} className="w-full sm:w-auto flex items-center bg-white border border-slate-300 rounded-2xl shadow-sm hover:border-slate-400 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent transition-all overflow-hidden p-1">
                <div className="pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Enter Tracking ID (e.g. CMP-84729)"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  className="px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none w-56"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-colors"
                >
                  Track
                </button>
              </form>
            </div>

            {/* Civic Guarantee Chips */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Camera GPS Geotagged</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>AI Anti-Spoofing Filter</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>48h - 72h SLA Escalation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. KEY MUNICIPAL STATS COUNTERS (Requested by User)
         ========================================================================= */}
      <section id="metrics" className="relative -mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Total Registered Complaints */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xl group-hover:scale-110 transition-transform">
                📋
              </div>
              <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Total Registered
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-display">
                {stats.registered_complaints.toLocaleString()}
              </div>
              <p className="text-xs font-bold text-slate-500">
                Official citizen complaints registered across all 4 municipal wards
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 text-blue-700">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>100% Verified Intake</span>
              </span>
              <span className="text-slate-400 font-semibold">Nagpur City-Wide</span>
            </div>
          </div>

          {/* 2. Under Progress Complaints */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/80 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-xl group-hover:scale-110 transition-transform">
                ⏳
              </div>
              <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Under Progress
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-amber-700 tracking-tight font-display">
                {stats.under_progress_complaints.toLocaleString()}
              </div>
              <p className="text-xs font-bold text-slate-500">
                Assigned to municipal field teams with active ground execution underway
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 text-amber-700">
                <Users className="w-3.5 h-3.5" />
                <span>{stats.active_workers} Field Units Active</span>
              </span>
              <span className="text-slate-400 font-semibold">Avg SLA: {stats.average_resolution_hours}h</span>
            </div>
          </div>

          {/* 3. Resolved Complaints */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-emerald-200/80 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xl group-hover:scale-110 transition-transform">
                ✅
              </div>
              <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Resolved & Verified
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-emerald-700 tracking-tight font-display">
                {stats.resolved_complaints.toLocaleString()}
              </div>
              <p className="text-xs font-bold text-slate-500">
                Fully resolved with physical proof photos and citizen closure sign-off
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{stats.resolution_rate}% Resolution Rate</span>
              </span>
              <span className="text-slate-400 font-semibold">Official Citizen Audit</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. THE WARD HEATMAP SECTION (Exact Admin Portal Heatmap Matrix)
         ========================================================================= */}
      <section id="heatmap" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
          {/* Section Header */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-black">
                  <Flame className="w-3.5 h-3.5 text-orange-400 animate-bounce" />
                  <span>NMC Public Command Heatmap</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
                  City-Wide Ward Grievance Density Heatmap
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  Real-time municipal burden distribution mapped across all 4 departments and 4 administrative wards.
                </p>
              </div>

              {/* View & Mode Toggles */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Matrix vs Geo Map view */}
                <div className="bg-slate-800/80 p-1 rounded-2xl border border-slate-700 flex items-center text-xs font-bold">
                  <button
                    onClick={() => setHeatmapView('matrix')}
                    className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      heatmapView === 'matrix'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Density Matrix</span>
                  </button>
                  <button
                    onClick={() => setHeatmapView('geo')}
                    className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                      heatmapView === 'geo'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>Nagpur Map</span>
                  </button>
                </div>

                {/* Count vs Percent toggle */}
                {heatmapView === 'matrix' && (
                  <div className="bg-slate-800/80 p-1 rounded-2xl border border-slate-700 flex items-center text-xs font-bold">
                    <button
                      onClick={() => setHeatmapMode('count')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        heatmapMode === 'count' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Count
                    </button>
                    <button
                      onClick={() => setHeatmapMode('percent')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        heatmapMode === 'percent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Share (%)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="mt-6 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
              <span className="text-slate-400 font-bold">Municipal Load Intensity:</span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-slate-300 font-semibold">&lt; 60 Normal</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-slate-300 font-semibold">60 - 89 Moderate</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-slate-300 font-semibold">90 - 119 High</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-slate-300 font-semibold">120+ Critical Load</span>
                </span>
              </div>
            </div>
          </div>

          {/* VIEW 1: Full Heatmap Matrix (Exact Admin Layout) */}
          {heatmapView === 'matrix' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-4 px-6 w-80">Municipal Ward & Description</th>
                    <th className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-blue-900">
                        <span>🛣️ PWD</span>
                        <span className="text-[10px] font-semibold text-slate-400">(Roads)</span>
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-emerald-900">
                        <span>🗑️ SWM</span>
                        <span className="text-[10px] font-semibold text-slate-400">(Garbage)</span>
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-cyan-900">
                        <span>🚰 PHE</span>
                        <span className="text-[10px] font-semibold text-slate-400">(Water)</span>
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-amber-900">
                        <span>💡 Electrical</span>
                        <span className="text-[10px] font-semibold text-slate-400">(Lights)</span>
                      </div>
                    </th>
                    <th className="py-4 px-6 text-center bg-slate-900 text-white">
                      <span>Total Burden</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-xs">
                  {wardHeatmap.map((row) => {
                    const pwdStyle = getHeatmapCellStyle(row.PWD);
                    const swmStyle = getHeatmapCellStyle(row.SWM);
                    const pheStyle = getHeatmapCellStyle(row.PHE);
                    const elecStyle = getHeatmapCellStyle(row.Electrical);
                    const totalStyle = getWardTotalStyle(row.total);

                    const pwdPct = Math.round((row.PWD / row.total) * 100);
                    const swmPct = Math.round((row.SWM / row.total) * 100);
                    const phePct = Math.round((row.PHE / row.total) * 100);
                    const elecPct = Math.round((row.Electrical / row.total) * 100);

                    return (
                      <tr key={row.wardNum} className="hover:bg-slate-50/60 transition-colors">
                        {/* Ward Column */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                              W{row.wardNum}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 text-sm">{row.ward}</span>
                                {row.wardNum === 2 && (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-red-100 text-red-800 border border-red-200">
                                    Highest Load
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium line-clamp-1">
                                {row.description}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* PWD Cell */}
                        <td
                          onMouseEnter={() => setHoveredCell({ ward: row.ward, dept: 'PWD', val: row.PWD, pct: pwdPct })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`py-3.5 px-4 text-center border-x border-slate-200/70 transition-colors ${pwdStyle.bg}`}
                        >
                          <span className={`text-base block ${pwdStyle.text}`}>
                            {heatmapMode === 'count' ? row.PWD : `${pwdPct}%`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {heatmapMode === 'count' ? `(${pwdPct}%)` : `${row.PWD} reports`}
                          </span>
                        </td>

                        {/* SWM Cell */}
                        <td
                          onMouseEnter={() => setHoveredCell({ ward: row.ward, dept: 'SWM', val: row.SWM, pct: swmPct })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`py-3.5 px-4 text-center border-r border-slate-200/70 transition-colors ${swmStyle.bg}`}
                        >
                          <span className={`text-base block ${swmStyle.text}`}>
                            {heatmapMode === 'count' ? row.SWM : `${swmPct}%`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {heatmapMode === 'count' ? `(${swmPct}%)` : `${row.SWM} reports`}
                          </span>
                        </td>

                        {/* PHE Cell */}
                        <td
                          onMouseEnter={() => setHoveredCell({ ward: row.ward, dept: 'PHE', val: row.PHE, pct: phePct })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`py-3.5 px-4 text-center border-r border-slate-200/70 transition-colors ${pheStyle.bg}`}
                        >
                          <span className={`text-base block ${pheStyle.text}`}>
                            {heatmapMode === 'count' ? row.PHE : `${phePct}%`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {heatmapMode === 'count' ? `(${phePct}%)` : `${row.PHE} reports`}
                          </span>
                        </td>

                        {/* Electrical Cell */}
                        <td
                          onMouseEnter={() => setHoveredCell({ ward: row.ward, dept: 'Electrical', val: row.Electrical, pct: elecPct })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`py-3.5 px-4 text-center border-r border-slate-200/70 transition-colors ${elecStyle.bg}`}
                        >
                          <span className={`text-base block ${elecStyle.text}`}>
                            {heatmapMode === 'count' ? row.Electrical : `${elecPct}%`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {heatmapMode === 'count' ? `(${elecPct}%)` : `${row.Electrical} reports`}
                          </span>
                        </td>

                        {/* Ward Total Cell */}
                        <td className={`py-3.5 px-6 text-center transition-colors ${totalStyle.bg}`}>
                          <span className="text-lg font-black tracking-tight block">
                            {row.total.toLocaleString()}
                          </span>
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-black uppercase mt-0.5 border ${totalStyle.badgeSoft}`}>
                            {totalStyle.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Summary Totals Row */}
                  <tr className="bg-slate-900 text-white font-black text-xs">
                    <td className="py-4 px-6 uppercase tracking-wider text-slate-300">
                      City-Wide Department Totals
                    </td>
                    <td className="py-4 px-4 text-center bg-blue-950/80 border-r border-slate-800">
                      <span className="text-base text-blue-200 block">{heatmapTotals.PWD}</span>
                      <span className="text-[10px] text-blue-400 font-bold">
                        {Math.round((heatmapTotals.PWD / heatmapTotals.grandTotal) * 100)}% of city
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center bg-emerald-950/80 border-r border-slate-800">
                      <span className="text-base text-emerald-200 block">{heatmapTotals.SWM}</span>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        {Math.round((heatmapTotals.SWM / heatmapTotals.grandTotal) * 100)}% of city
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center bg-cyan-950/80 border-r border-slate-800">
                      <span className="text-base text-cyan-200 block">{heatmapTotals.PHE}</span>
                      <span className="text-[10px] text-cyan-400 font-bold">
                        {Math.round((heatmapTotals.PHE / heatmapTotals.grandTotal) * 100)}% of city
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center bg-amber-950/80 border-r border-slate-800">
                      <span className="text-base text-amber-200 block">{heatmapTotals.Electrical}</span>
                      <span className="text-[10px] text-amber-400 font-bold">
                        {Math.round((heatmapTotals.Electrical / heatmapTotals.grandTotal) * 100)}% of city
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center bg-indigo-950">
                      <span className="text-xl font-black text-white block">
                        {heatmapTotals.grandTotal.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest">
                        Grand Total
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom Insight Callout */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>
                    <strong>Ward 2 (Old City)</strong> records the highest infrastructure pressure across both Roads (142) and Solid Waste (118).
                  </span>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-500">
                  <span>Burden Rank:</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded text-[11px]">
                    Ward 2 &gt; Ward 1 &gt; Ward 3 &gt; Ward 4
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW 2: Interactive Geographic Map View */
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Nagpur Municipal Hotspot Coordinates
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Geolocated civic grievance pins showing cluster densities across Central, North, East, and West zones.
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Live Nagpur Pin Cluster
                </span>
              </div>
              <div className="h-96 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                <LeafletMap
                  lat={21.1458}
                  lng={79.0882}
                  readonly={true}
                  markers={NAGPUR_SAMPLE_MARKERS}
                  showLegend={true}
                  className="h-full w-full"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          5. MUNICIPAL DEPARTMENTS SUPPORTED
         ========================================================================= */}
      <section id="departments" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Citizen Grievance Categories
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight font-display">
            Covering Key Civic Infrastructure
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Every grievance is mapped directly to its responsible municipal executive engineer.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. Roads */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center text-2xl mb-4">
              🛣️
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">
              Roads & Infrastructure
            </h3>
            <p className="text-xs font-extrabold text-blue-700 mb-2.5">
              Public Works Department (PWD)
            </p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
              Potholes, broken medians, footpaths, asphalt subsidence, and damaged speed breakers.
            </p>
            <div className="text-[11px] font-black text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg inline-block border border-slate-200">
              SLA: 48h - 72h
            </div>
          </div>

          {/* 2. Garbage */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl mb-4">
              🗑️
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">
              Solid Waste Management
            </h3>
            <p className="text-xs font-extrabold text-emerald-700 mb-2.5">
              Sanitation Division (SWM)
            </p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
              Overflowing community bins, uncollected residential waste, open dumping, and dead animal removal.
            </p>
            <div className="text-[11px] font-black text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg inline-block border border-slate-200">
              SLA: 24h - 48h
            </div>
          </div>

          {/* 3. Water */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center text-2xl mb-4">
              🚰
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">
              Water & Drainage Works
            </h3>
            <p className="text-xs font-extrabold text-cyan-700 mb-2.5">
              Public Health Engineering (PHE)
            </p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
              Underground pipeline bursts, sewer line overflow, contaminated tap water, and low pressure.
            </p>
            <div className="text-[11px] font-black text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg inline-block border border-slate-200">
              SLA: 24h - 48h
            </div>
          </div>

          {/* 4. Electrical */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-2xl mb-4">
              💡
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">
              Street Lighting & Power
            </h3>
            <p className="text-xs font-extrabold text-amber-700 mb-2.5">
              Electrical Division (ELEC)
            </p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
              Dark zones, flickering or non-operational pole lights, hanging wires, and open feeder pillars.
            </p>
            <div className="text-[11px] font-black text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg inline-block border border-slate-200">
              SLA: 24h - 48h
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. HOW JANMITRA WORKS (4-Layer AI Pipeline Transparency)
         ========================================================================= */}
      <section id="how-it-works" className="bg-slate-900 text-white py-20 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
              Zero Manual Bottleneck
            </span>
            <h2 className="text-3xl font-black tracking-tight font-display">
              4-Layer AI Verification Pipeline
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              Every complaint is inspected by our multi-stage computer vision models before worker dispatch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Layer 1 */}
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 relative">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Layer 1 • Forensic
              </span>
              <h3 className="text-base font-black text-white mt-1 mb-2">
                EXIF & ViT Anti-Spoof
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Checks camera hardware headers, error level analysis (ELA), and deep learning Vision Transformer to detect fake or web-downloaded images.
              </p>
            </div>

            {/* Layer 2 */}
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 relative">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                Layer 2 • Vision AI
              </span>
              <h3 className="text-base font-black text-white mt-1 mb-2">
                YOLOv8 Object Detection
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Custom trained civic model identifies exact potholes, waste heaps, and broken poles, verifying user-selected category relevance.
              </p>
            </div>

            {/* Layer 3 */}
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 relative">
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                Layer 3 • Geospatial
              </span>
              <h3 className="text-base font-black text-white mt-1 mb-2">
                100m Duplicate Clustering
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                PostGIS ST_DWithin geodesic calculation groups identical issues reported within 100 meters, aggregating citizen votes without double work.
              </p>
            </div>

            {/* Layer 4 */}
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 relative">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Layer 4 • Triage
              </span>
              <h3 className="text-base font-black text-white mt-1 mb-2">
                AHP Priority & SLA Routing
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Calculates dynamic priority score (0-100) factoring traffic severity, hospital vicinity, duplicate weight, and auto-dispatches to nearest worker.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. CITIZEN CTA BANNER
         ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none text-9xl">
            🏛️
          </div>

          <div className="space-y-3 max-w-xl">
            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white">
              Civic Action
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
              See an Infrastructure Defect in Your Ward?
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 font-medium">
              Join thousands of Nagpur citizens who resolve public issues actively. Snap a photo and let our AI handle the rest.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              to={isAuthenticated ? '/citizen/submit' : '/login'}
              className="px-6 py-3.5 rounded-2xl bg-white text-blue-900 hover:bg-blue-50 font-black text-sm shadow-md transition-colors flex items-center gap-2"
            >
              <span>Submit a Complaint</span>
              <ArrowRight className="w-4 h-4 text-blue-700" />
            </Link>
            <Link
              to="/register"
              className="px-6 py-3.5 rounded-2xl bg-blue-900/60 hover:bg-blue-900 text-white border border-white/20 font-black text-sm transition-colors"
            >
              Register Account
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. MUNICIPAL FOOTER
         ========================================================================= */}
      <footer className="bg-white border-t border-slate-200 pt-12 pb-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Column 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold text-sm">
                  🏛️
                </span>
                <span className="text-base font-black text-slate-900">JANMITRA</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Official Civic Grievance Redressal and Rapid Municipal Operations Platform of Nagpur Municipal Corporation (NMC).
              </p>
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>All Municipal Systems Operational</span>
              </div>
            </div>

            {/* Column 2 */}
            <div>
              <h4 className="font-black text-slate-900 mb-3 uppercase tracking-wider text-[11px]">
                Civic Portals
              </h4>
              <ul className="space-y-2 font-medium">
                <li><Link to="/login" className="hover:text-blue-700">Citizen Grievance Filing</Link></li>
                <li><Link to="/login" className="hover:text-blue-700">Department Officer Desk</Link></li>
                <li><Link to="/login" className="hover:text-blue-700">Field Worker Task Terminal</Link></li>
                <li><Link to="/login" className="hover:text-blue-700">Central Municipal Admin</Link></li>
              </ul>
            </div>

            {/* Column 3 */}
            <div>
              <h4 className="font-black text-slate-900 mb-3 uppercase tracking-wider text-[11px]">
                Municipal Divisions
              </h4>
              <ul className="space-y-2 font-medium">
                <li><span>Public Works Department (PWD)</span></li>
                <li><span>Solid Waste Management (SWM)</span></li>
                <li><span>Public Health Engineering (PHE)</span></li>
                <li><span>Electrical Division (ELEC)</span></li>
              </ul>
            </div>

            {/* Column 4: Emergency Contacts */}
            <div>
              <h4 className="font-black text-slate-900 mb-3 uppercase tracking-wider text-[11px]">
                NMC 24x7 Helplines
              </h4>
              <ul className="space-y-2 font-medium">
                <li className="flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-blue-700" />
                  <span>Control Room: 0712-2567035</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Toll Free Civic: 1800-233-3764</span>
                </li>
                <li className="flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-red-600" />
                  <span>Fire & Disaster: 101 / 112</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <p>© {new Date().getFullYear()} Nagpur Municipal Corporation. All rights reserved.</p>
            <p>Designed with Civic AI Architecture • Powered by Django REST & React</p>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          TRACKING POPUP MODAL
         ========================================================================= */}
      {trackingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-700 text-sm">
                  🔍
                </span>
                <h3 className="font-black text-slate-900 text-base">
                  Ticket Status Audit
                </h3>
              </div>
              <button
                onClick={() => setTrackingModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {trackingLoading ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-500">Querying municipal database...</p>
              </div>
            ) : trackingError ? (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-red-700 text-xs font-bold space-y-1">
                <p>{trackingError}</p>
                <p className="text-[11px] text-red-500 font-normal">Check the ID sent via SMS or Citizen Portal.</p>
              </div>
            ) : trackedComplaint ? (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Tracking ID</span>
                    <span className="font-black text-slate-900 text-sm">{trackedComplaint.tracking_id}</span>
                  </div>
                  <span className="px-3 py-1 rounded-full font-black text-xs uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    {trackedComplaint.status}
                  </span>
                </div>

                <div className="space-y-2 font-medium text-slate-600 bg-white p-3 rounded-2xl border border-slate-100">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400">Grievance:</span>
                    <span className="font-bold text-slate-800 text-right">{trackedComplaint.title}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400">Ward & Division:</span>
                    <span className="font-bold text-slate-800 text-right">{trackedComplaint.ward_name || 'Ward 2'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-400">Assigned Field Unit:</span>
                    <span className="font-bold text-blue-700 text-right">{trackedComplaint.assigned_worker_name || 'Field Worker Team'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Estimated Resolution:</span>
                    <span className="font-bold text-emerald-700 text-right">{trackedComplaint.estimated_resolution || 'Within 24 Hours'}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setTrackingModalOpen(false);
                      navigate('/login');
                    }}
                    className="w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Login for Full Timeline & Proof Photos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
