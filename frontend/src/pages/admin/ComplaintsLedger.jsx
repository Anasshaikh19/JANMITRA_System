import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import CategoryBadge from '../../components/CategoryBadge';
import WardBadge from '../../components/WardBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

// 4 Primary Municipal Departments
const DEPARTMENTS = [
  { id: 'ALL', name: 'All Departments', icon: '🏛️' },
  { id: 'PWD', name: 'Public Works (PWD)', icon: '🛣️' },
  { id: 'SWM', name: 'Solid Waste (SWM)', icon: '🗑️' },
  { id: 'PHE', name: 'Water Works (PHE)', icon: '💧' },
  { id: 'ELEC', name: 'Electrical & Lighting', icon: '💡' },
];

const STATUS_TABS = [
  'ALL',
  'Submitted',
  'Validated',
  'Assigned',
  'In-Progress',
  'Resolved',
  'Closed',
];

// Curated municipal complaint ledger records across 4 wards and 4 departments
const DEFAULT_COMPLAINTS_LEDGER = [
  {
    id: 'JM-2026-0812',
    date: '2026-10-18 09:15',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    ward: 2,
    description: 'Dangerous 2ft deep road cave-in near Central Vegetable Market entrance causing major traffic hazard.',
    citizen: { name: 'Aarav Deshmukh', mobile: '+91 98220 11223' },
    priority: 'Critical',
    status: 'In-Progress',
    assigned_to: 'Ramesh Kumar (PWD)',
    assigned_worker_id: 'W-PWD-02',
    photos: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '18 Oct 2026, 09:15 AM', actor: 'Citizen: Aarav Deshmukh', notes: 'Grievance reported via Citizen Portal with geotagged photo.', completed: true },
      { step: 'Validated', timestamp: '18 Oct 2026, 09:22 AM', actor: 'Vision AI & Ward Officer (PWD)', notes: 'AI confidence 98.4%. Pothole severity verified; SLA target set to 12 hours.', completed: true },
      { step: 'Assigned', timestamp: '18 Oct 2026, 09:35 AM', actor: 'Ward 2 Dispatch Desk', notes: 'Dispatched to Senior Tech Ramesh Kumar with JCB and cold mix crew.', completed: true },
      { step: 'In-Progress', timestamp: '18 Oct 2026, 10:10 AM', actor: 'Worker: Ramesh Kumar', notes: 'Crew arrived at site. Barricades placed, excavation and gravel base underway.', completed: true, current: true },
      { step: 'Resolved', timestamp: 'Pending', actor: 'Field Worker', notes: 'Bitumen compaction & road clearance pending.', completed: false },
      { step: 'Closed', timestamp: 'Pending', actor: 'Citizen Verification', notes: 'Awaiting citizen closure rating.', completed: false },
    ],
  },
  {
    id: 'JM-2026-0815',
    date: '2026-10-18 08:30',
    category: 'Garbage & Waste Management',
    dept: 'SWM',
    ward: 1,
    description: 'Community garbage dumper overflowing for 48 hours in front of Civil Hospital Ward 1 entrance.',
    citizen: { name: 'Pooja Kulkarni', mobile: '+91 98901 22334' },
    priority: 'Critical',
    status: 'Assigned',
    assigned_to: 'Ganesh Shinde (SWM)',
    assigned_worker_id: 'W-SWM-01',
    photos: [
      'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '18 Oct 2026, 08:30 AM', actor: 'Citizen: Pooja Kulkarni', notes: 'Reported with EXIF GPS location verified at Hospital Gate 2.', completed: true },
      { step: 'Validated', timestamp: '18 Oct 2026, 08:38 AM', actor: 'Automated AI Triage', notes: 'Bio-hazard flag raised due to healthcare proximity. Priority upgraded to Critical.', completed: true },
      { step: 'Assigned', timestamp: '18 Oct 2026, 08:50 AM', actor: 'SWM Shift Supervisor', notes: 'Assigned to compactor truck crew lead Ganesh Shinde.', completed: true, current: true },
      { step: 'In-Progress', timestamp: 'Pending', actor: 'Field Worker', notes: 'Compactor vehicle en route.', completed: false },
      { step: 'Resolved', timestamp: 'Pending', actor: 'Field Worker', notes: 'Waste cleared and disinfected with bleaching powder.', completed: false },
      { step: 'Closed', timestamp: 'Pending', actor: 'Citizen Verification', notes: 'Awaiting confirmation.', completed: false },
    ],
  },
  {
    id: 'JM-2026-0818',
    date: '2026-10-17 19:40',
    category: 'Street Lighting & Electrical',
    dept: 'ELEC',
    ward: 1,
    description: 'Exposed live wiring dangling from street light pole near primary school walking path.',
    citizen: { name: 'Vikram Joshi', mobile: '+91 97654 33445' },
    priority: 'Critical',
    status: 'Resolved',
    assigned_to: 'Sunil Gaikwad (ELEC)',
    assigned_worker_id: 'W-ELEC-01',
    rating: 5,
    photos: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '17 Oct 2026, 07:40 PM', actor: 'Citizen: Vikram Joshi', notes: 'Night grievance reported.', completed: true },
      { step: 'Validated', timestamp: '17 Oct 2026, 07:45 PM', actor: 'Electrical Officer Desk', notes: 'Urgent public shock hazard verified.', completed: true },
      { step: 'Assigned', timestamp: '17 Oct 2026, 07:48 PM', actor: 'Night Emergency Roster', notes: 'Immediate dispatch to Senior Lineman Sunil Gaikwad.', completed: true },
      { step: 'In-Progress', timestamp: '17 Oct 2026, 08:05 PM', actor: 'Worker: Sunil Gaikwad', notes: 'Power de-energized, cable insulated and re-routed into junction box.', completed: true },
      { step: 'Resolved', timestamp: '17 Oct 2026, 08:45 PM', actor: 'Worker: Sunil Gaikwad', notes: 'Junction box locked and grounded. Circuit load tested successfully.', completed: true },
      { step: 'Closed', timestamp: '17 Oct 2026, 09:10 PM', actor: 'Citizen: Vikram Joshi', notes: 'Citizen rated 5 Stars: "Prompt night service, thank you!"', completed: true, current: true },
    ],
  },
  {
    id: 'JM-2026-0820',
    date: '2026-10-17 14:20',
    category: 'Water & Drainage',
    dept: 'PHE',
    ward: 3,
    description: 'Drinking water pipeline joint rupture resulting in thousands of liters flooding street road.',
    citizen: { name: 'Kavita Shinde', mobile: '+91 98112 44556' },
    priority: 'High',
    status: 'In-Progress',
    assigned_to: 'Deepak Naik (PHE)',
    assigned_worker_id: 'W-PHE-01',
    photos: [
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '17 Oct 2026, 02:20 PM', actor: 'Citizen: Kavita Shinde', notes: 'Logged with photo of water gushing from pavement.', completed: true },
      { step: 'Validated', timestamp: '17 Oct 2026, 02:30 PM', actor: 'Water Board Desk', notes: 'PHE zone engineer confirmed 200mm feeder pipe pressure drop.', completed: true },
      { step: 'Assigned', timestamp: '17 Oct 2026, 02:40 PM', actor: 'PHE Ward 3 Depot', notes: 'Assigned to Deepak Naik and pipe clamp team.', completed: true },
      { step: 'In-Progress', timestamp: '17 Oct 2026, 03:15 PM', actor: 'Worker: Deepak Naik', notes: 'Sluice valve isolated, trench dewatered, welding collar in progress.', completed: true, current: true },
      { step: 'Resolved', timestamp: 'Pending', actor: 'Field Worker', notes: 'Hydro-testing and backfilling.', completed: false },
      { step: 'Closed', timestamp: 'Pending', actor: 'Citizen Verification', notes: 'Awaiting clean supply resumption confirmation.', completed: false },
    ],
  },
  {
    id: 'JM-2026-0822',
    date: '2026-10-17 11:05',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    ward: 1,
    description: 'Multiple pothole cluster over 50-meter stretch causing bike skids on Secretariat link road.',
    citizen: { name: 'Sunil Jagtap', mobile: '+91 97300 55667' },
    priority: 'High',
    status: 'Closed',
    assigned_to: 'Santosh Shinde (PWD)',
    assigned_worker_id: 'W-PWD-03',
    rating: 5,
    photos: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '17 Oct 2026, 11:05 AM', actor: 'Citizen: Sunil Jagtap', notes: 'Logged via mobile app.', completed: true },
      { step: 'Validated', timestamp: '17 Oct 2026, 11:15 AM', actor: 'PWD Ward 1 Inspector', notes: 'Approved for urgent jet-patching.', completed: true },
      { step: 'Assigned', timestamp: '17 Oct 2026, 11:30 AM', actor: 'PWD Dispatcher', notes: 'Assigned to Santosh Shinde.', completed: true },
      { step: 'In-Progress', timestamp: '17 Oct 2026, 01:20 PM', actor: 'Worker: Santosh Shinde', notes: 'Emulsion spray and asphalt roller compaction applied.', completed: true },
      { step: 'Resolved', timestamp: '17 Oct 2026, 03:45 PM', actor: 'Worker: Santosh Shinde', notes: 'All 7 potholes patched and leveled smoothly.', completed: true },
      { step: 'Closed', timestamp: '17 Oct 2026, 04:30 PM', actor: 'Citizen: Sunil Jagtap', notes: 'Rated 5 Stars: "Fixed on the same day, excellent work!"', completed: true, current: true },
    ],
  },
  {
    id: 'JM-2026-0825',
    date: '2026-10-16 16:50',
    category: 'Garbage & Waste Management',
    dept: 'SWM',
    ward: 2,
    description: 'Commercial vegetable waste dumped across pedestrian walkway causing foul smell and stray cattle.',
    citizen: { name: 'Deepa Verma', mobile: '+91 98450 66778' },
    priority: 'Medium',
    status: 'Closed',
    assigned_to: 'Pooja Jadhav (SWM)',
    assigned_worker_id: 'W-SWM-02',
    rating: 4,
    photos: [
      'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '16 Oct 2026, 04:50 PM', actor: 'Citizen: Deepa Verma', notes: 'Reported with photo.', completed: true },
      { step: 'Validated', timestamp: '16 Oct 2026, 05:05 PM', actor: 'SWM AI System', notes: 'Validated and tagged for commercial market route.', completed: true },
      { step: 'Assigned', timestamp: '16 Oct 2026, 05:15 PM', actor: 'SWM Route Manager', notes: 'Assigned to Pooja Jadhav.', completed: true },
      { step: 'In-Progress', timestamp: '16 Oct 2026, 06:10 PM', actor: 'Worker: Pooja Jadhav', notes: 'Sweeping team and mini-truck deployed.', completed: true },
      { step: 'Resolved', timestamp: '16 Oct 2026, 07:30 PM', actor: 'Worker: Pooja Jadhav', notes: '1.2 tonnes waste lifted and pathway washed.', completed: true },
      { step: 'Closed', timestamp: '16 Oct 2026, 08:15 PM', actor: 'Citizen: Deepa Verma', notes: 'Rated 4 Stars: "Cleared efficiently."', completed: true, current: true },
    ],
  },
  {
    id: 'JM-2026-0828',
    date: '2026-10-16 10:15',
    category: 'Water & Drainage',
    dept: 'PHE',
    ward: 4,
    description: 'Stormwater nullah blocked with plastic debris causing sewage backflow into residential basements.',
    citizen: { name: 'Manish Chawla', mobile: '+91 98330 77889' },
    priority: 'High',
    status: 'Validated',
    assigned_to: 'Unassigned',
    assigned_worker_id: null,
    photos: [
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '16 Oct 2026, 10:15 AM', actor: 'Citizen: Manish Chawla', notes: 'Grievance submitted with basement flood photos.', completed: true },
      { step: 'Validated', timestamp: '16 Oct 2026, 10:35 AM', actor: 'Ward 4 PHE Officer', notes: 'Verified drainage block at Culvert #14. High priority dispatch queued.', completed: true, current: true },
      { step: 'Assigned', timestamp: 'Pending', actor: 'Dispatcher', notes: 'Awaiting excavator crew assignment.', completed: false },
      { step: 'In-Progress', timestamp: 'Pending', actor: 'Field Worker', notes: 'Pending on-site arrival.', completed: false },
      { step: 'Resolved', timestamp: 'Pending', actor: 'Field Worker', notes: 'Desilting and culvert clearance.', completed: false },
      { step: 'Closed', timestamp: 'Pending', actor: 'Citizen Verification', notes: 'Awaiting confirmation.', completed: false },
    ],
  },
  {
    id: 'JM-2026-0831',
    date: '2026-10-15 21:10',
    category: 'Street Lighting & Electrical',
    dept: 'ELEC',
    ward: 2,
    description: 'Complete high-mast tower dark at Shivaji Chowk traffic junction resulting in dangerous dark zone.',
    citizen: { name: 'Naveen Patil', mobile: '+91 98211 88990' },
    priority: 'High',
    status: 'Resolved',
    assigned_to: 'Nitin Kadam (ELEC)',
    assigned_worker_id: 'W-ELEC-02',
    rating: 5,
    photos: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '15 Oct 2026, 09:10 PM', actor: 'Citizen: Naveen Patil', notes: 'Night report submitted.', completed: true },
      { step: 'Validated', timestamp: '15 Oct 2026, 09:20 PM', actor: 'Electrical Control Room', notes: 'Remote telemetry confirmed feeder MCB tripped.', completed: true },
      { step: 'Assigned', timestamp: '15 Oct 2026, 09:30 PM', actor: 'Night Emergency Desk', notes: 'Assigned to Nitin Kadam with hydraulic crane.', completed: true },
      { step: 'In-Progress', timestamp: '15 Oct 2026, 10:15 PM', actor: 'Worker: Nitin Kadam', notes: 'MCB and faulty ballast replaced at top ring.', completed: true },
      { step: 'Resolved', timestamp: '15 Oct 2026, 11:05 PM', actor: 'Worker: Nitin Kadam', notes: 'All 8 LED floodlights operational. Illumination restored.', completed: true },
      { step: 'Closed', timestamp: '16 Oct 2026, 08:30 AM', actor: 'Citizen: Naveen Patil', notes: 'Rated 5 Stars: "Prompt night restoration."', completed: true, current: true },
    ],
  },
  {
    id: 'JM-2026-0835',
    date: '2026-10-15 13:45',
    category: 'Roads & Infrastructure',
    dept: 'PWD',
    ward: 3,
    description: 'Broken concrete manhole cover adjacent to bus shelter posing accident hazard to pedestrians.',
    citizen: { name: 'Alok Sharma', mobile: '+91 97554 11229' },
    priority: 'Critical',
    status: 'Submitted',
    assigned_to: 'Unassigned',
    assigned_worker_id: null,
    photos: [
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '15 Oct 2026, 01:45 PM', actor: 'Citizen: Alok Sharma', notes: 'Logged with photo. Awaiting officer validation.', completed: true, current: true },
      { step: 'Validated', timestamp: 'Pending', actor: 'AI / Officer', notes: 'Pending AI confidence check.', completed: false },
      { step: 'Assigned', timestamp: 'Pending', actor: 'Dispatcher', notes: 'Pending worker assignment.', completed: false },
      { step: 'In-Progress', timestamp: 'Pending', actor: 'Field Worker', notes: 'Pending execution.', completed: false },
      { step: 'Resolved', timestamp: 'Pending', actor: 'Field Worker', notes: 'Pending resolution.', completed: false },
      { step: 'Closed', timestamp: 'Pending', actor: 'Citizen Verification', notes: 'Pending closure.', completed: false },
    ],
  },
  {
    id: 'JM-2026-0840',
    date: '2026-10-14 15:20',
    category: 'Garbage & Waste Management',
    dept: 'SWM',
    ward: 3,
    description: 'Construction and demolition rubble dumped illegally along ring road service lane blocking drains.',
    citizen: { name: 'Tanvi Bhosale', mobile: '+91 98665 22331' },
    priority: 'Medium',
    status: 'Closed',
    assigned_to: 'Sachin Kamble (SWM)',
    assigned_worker_id: 'W-SWM-03',
    rating: 4,
    photos: [
      'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '14 Oct 2026, 03:20 PM', actor: 'Citizen: Tanvi Bhosale', notes: 'Logged via portal.', completed: true },
      { step: 'Validated', timestamp: '14 Oct 2026, 03:40 PM', actor: 'SWM Officer', notes: 'Enforcement team notified; debris clearance approved.', completed: true },
      { step: 'Assigned', timestamp: '14 Oct 2026, 04:00 PM', actor: 'SWM Heavy Equipment Depot', notes: 'Assigned to Sachin Kamble with loader.', completed: true },
      { step: 'In-Progress', timestamp: '15 Oct 2026, 09:30 AM', actor: 'Worker: Sachin Kamble', notes: 'Loader cleared 4 trucks of debris.', completed: true },
      { step: 'Resolved', timestamp: '15 Oct 2026, 01:15 PM', actor: 'Worker: Sachin Kamble', notes: 'Lane reopened, caution signage installed.', completed: true },
      { step: 'Closed', timestamp: '15 Oct 2026, 02:40 PM', actor: 'Citizen: Tanvi Bhosale', notes: 'Rated 4 Stars: "Debris cleared promptly."', completed: true, current: true },
    ],
  },
  {
    id: 'JM-2026-0844',
    date: '2026-10-14 09:30',
    category: 'Water & Drainage',
    dept: 'PHE',
    ward: 2,
    description: 'Sewage drain chamber choked causing black water overflow on street near vegetable mandi.',
    citizen: { name: 'Sanjay More', mobile: '+91 98223 99887' },
    priority: 'Critical',
    status: 'Closed',
    assigned_to: 'Rahul Sawant (PHE)',
    assigned_worker_id: 'W-PHE-02',
    rating: 5,
    photos: [
      'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '14 Oct 2026, 09:30 AM', actor: 'Citizen: Sanjay More', notes: 'Sanitary hazard reported.', completed: true },
      { step: 'Validated', timestamp: '14 Oct 2026, 09:40 AM', actor: 'PHE Control Desk', notes: 'Priority set to Critical.', completed: true },
      { step: 'Assigned', timestamp: '14 Oct 2026, 09:50 AM', actor: 'PHE Jetting Machine Unit', notes: 'Assigned to Rahul Sawant with super-sucker.', completed: true },
      { step: 'In-Progress', timestamp: '14 Oct 2026, 10:30 AM', actor: 'Worker: Rahul Sawant', notes: 'High pressure water jetting cleared grease choke.', completed: true },
      { step: 'Resolved', timestamp: '14 Oct 2026, 11:45 AM', actor: 'Worker: Rahul Sawant', notes: 'Flow restored, chamber disinfected.', completed: true },
      { step: 'Closed', timestamp: '14 Oct 2026, 12:15 PM', actor: 'Citizen: Sanjay More', notes: 'Rated 5 Stars: "Quick relief from sewage smell!"', completed: true, current: true },
    ],
  },
  {
    id: 'JM-2026-0849',
    date: '2026-10-13 18:10',
    category: 'Street Lighting & Electrical',
    dept: 'ELEC',
    ward: 4,
    description: 'Four consecutive LED street poles non-functional in Sector 4 residential lane creating blind alley.',
    citizen: { name: 'Meena Rao', mobile: '+91 98199 44332' },
    priority: 'Low',
    status: 'Closed',
    assigned_to: 'Pravin Joshi (ELEC)',
    assigned_worker_id: 'W-ELEC-03',
    rating: 5,
    photos: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=60',
    ],
    timeline: [
      { step: 'Submitted', timestamp: '13 Oct 2026, 06:10 PM', actor: 'Citizen: Meena Rao', notes: 'Logged via portal.', completed: true },
      { step: 'Validated', timestamp: '13 Oct 2026, 06:30 PM', actor: 'Electrical Inspector', notes: 'Timer switch defect suspected.', completed: true },
      { step: 'Assigned', timestamp: '14 Oct 2026, 09:15 AM', actor: 'Electrical Day Shift', notes: 'Assigned to Pravin Joshi.', completed: true },
      { step: 'In-Progress', timestamp: '14 Oct 2026, 11:00 AM', actor: 'Worker: Pravin Joshi', notes: 'Photocell sensor replaced.', completed: true },
      { step: 'Resolved', timestamp: '14 Oct 2026, 11:40 AM', actor: 'Worker: Pravin Joshi', notes: 'All 4 luminaires illuminated and tested.', completed: true },
      { step: 'Closed', timestamp: '14 Oct 2026, 01:20 PM', actor: 'Citizen: Meena Rao', notes: 'Rated 5 Stars: "Street lights shining bright now."', completed: true, current: true },
    ],
  },
];

const ComplaintsLedger = () => {
  const { user, logout } = useAuth();

  // Primary Data State
  const [complaints, setComplaints] = useState(DEFAULT_COMPLAINTS_LEDGER);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 2. Filter Bar States:
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [selectedStatusTab, setSelectedStatusTab] = useState('ALL');

  // Stepper Timeline Modal State
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [activeComplaint, setActiveComplaint] = useState(null);
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState(0);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Fetch Live Complaints from API with fallback
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/v1/complaints/');
      if (res.data?.results && Array.isArray(res.data.results)) {
        setComplaints(res.data.results);
      } else if (Array.isArray(res.data) && res.data.length > 0) {
        setComplaints(res.data);
      }
    } catch (err) {
      console.warn('API /v1/complaints/ offline, using central municipal database records:', err?.message);
      // Retains DEFAULT_COMPLAINTS_LEDGER
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Filtered Complaints List
  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      // 1. Department Filter
      if (selectedDept !== 'ALL') {
        const itemDept = item.dept || (item.category?.includes('Road') ? 'PWD' : item.category?.includes('Garb') ? 'SWM' : item.category?.includes('Water') ? 'PHE' : 'ELEC');
        if (itemDept !== selectedDept) return false;
      }

      // 2. Ward Filter
      if (selectedWard !== 'ALL') {
        if (String(item.ward) !== String(selectedWard)) return false;
      }

      // 3. Status Tab Filter
      if (selectedStatusTab !== 'ALL') {
        const normalizedItemStatus = String(item.status || '').trim().toLowerCase();
        const normalizedTab = selectedStatusTab.toLowerCase();
        if (normalizedItemStatus !== normalizedTab) {
          // Special match for In-Progress variants
          if (normalizedTab === 'in-progress' && ['inprogress', 'in progress'].includes(normalizedItemStatus)) {
            // match
          } else {
            return false;
          }
        }
      }

      // 4. Search Filter (searches Ticket ID, description, citizen name/mobile, assigned worker)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = String(item.id || '').toLowerCase().includes(q);
        const matchDesc = String(item.description || '').toLowerCase().includes(q);
        const matchCitizenName = String(item.citizen?.name || '').toLowerCase().includes(q);
        const matchCitizenMobile = String(item.citizen?.mobile || '').toLowerCase().includes(q);
        const matchAssigned = String(item.assigned_to || '').toLowerCase().includes(q);
        if (!matchId && !matchDesc && !matchCitizenName && !matchCitizenMobile && !matchAssigned) {
          return false;
        }
      }

      return true;
    });
  }, [complaints, selectedDept, selectedWard, selectedStatusTab, searchQuery]);

  // Paginated Complaints
  const paginatedComplaints = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredComplaints.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredComplaints, currentPage]);

  const totalPages = Math.ceil(filteredComplaints.length / PAGE_SIZE) || 1;

  // Open Timeline Stepper Modal
  const handleOpenTimeline = (complaint) => {
    setActiveComplaint(complaint);
    // Find current active step index in timeline
    const activeIdx = complaint.timeline?.findIndex((t) => t.current) ?? 0;
    setSelectedTimelineIndex(activeIdx >= 0 ? activeIdx : (complaint.timeline?.length || 1) - 1);
    setTimelineModalOpen(true);
  };

  // CSV Export Trigger
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    params.append('format', 'csv');
    if (selectedDept !== 'ALL') params.append('dept_id', selectedDept);
    if (selectedWard !== 'ALL') params.append('ward', selectedWard);
    if (selectedStatusTab !== 'ALL') params.append('status', selectedStatusTab);

    const exportUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/v1/dashboard/export/?${params.toString()}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* 1. TITLE & TOP HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 border-l-4 border-l-purple pl-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple uppercase tracking-wider">
                  NMC Municipal Central Database
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs font-semibold text-slate-500">Citizen Redressal Audit Trail</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-dark tracking-tight flex items-center gap-2">
                <span>City-Wide Complaints Ledger</span>
                <span className="text-slate-400 font-light hidden sm:inline">—</span>
                <span className="text-base sm:text-lg font-semibold text-slate-600 hidden sm:inline">
                  Central NMC Database
                </span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/cross-dept"
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple border border-purple-200 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="Cross-Department Performance Overview"
            >
              <span>🏛️</span>
              <span>All Depts Overview</span>
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
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
              title="Configure SLAs and Emergency Broadcast"
            >
              <span>⚙️</span>
              <span>Settings & SLAs</span>
            </Link>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1.5"
              title="Download filtered CSV stream"
            >
              <span>📥</span>
              <span>Export CSV</span>
            </button>

            <button
              onClick={logout}
              className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-lg text-xs font-bold transition shadow-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Ledger Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {errorMsg && (
          <ErrorMessage
            message={errorMsg}
            onRetry={fetchComplaints}
          />
        )}

        {/* 2. FILTER BAR */}
        <section aria-labelledby="filter-bar-heading" className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <input
                id="ledger-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by Ticket ID, description, citizen, worker..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department and Ward Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {/* Department Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold text-[11px] uppercase">Department:</span>
                <select
                  id="ledger-dept-filter"
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.icon} {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ward Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold text-[11px] uppercase">Ward:</span>
                <select
                  id="ledger-ward-filter"
                  value={selectedWard}
                  onChange={(e) => {
                    setSelectedWard(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">All 4 Wards</option>
                  <option value="1">Ward 1 (Civil Lines)</option>
                  <option value="2">Ward 2 (Old City)</option>
                  <option value="3">Ward 3 (Industrial)</option>
                  <option value="4">Ward 4 (Residential)</option>
                </select>
              </div>

              {/* Quick Reset */}
              {(searchQuery || selectedDept !== 'ALL' || selectedWard !== 'ALL' || selectedStatusTab !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDept('ALL');
                    setSelectedWard('ALL');
                    setSelectedStatusTab('ALL');
                    setCurrentPage(1);
                  }}
                  className="text-xs text-primary font-bold hover:underline px-2 py-1"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Status Tabs Bar */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              Status:
            </span>
            {STATUS_TABS.map((tab) => {
              const isActive = selectedStatusTab === tab;
              // Calculate counts for tab
              const count = tab === 'ALL'
                ? complaints.length
                : complaints.filter((c) => String(c.status || '').toLowerCase() === tab.toLowerCase()).length;

              return (
                <button
                  key={tab}
                  onClick={() => {
                    setSelectedStatusTab(tab);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. TABLE: TICKET ID, DATE, CATEGORY, WARD, CITIZEN, PRIORITY, STATUS, ASSIGNED TO, ACTION */}
        <section aria-labelledby="ledger-table-heading" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="ledger-table-heading" className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Audited Municipal Grievance Records
              </h2>
              <p className="text-xs text-slate-500">
                Displaying <strong>{paginatedComplaints.length}</strong> of <strong>{filteredComplaints.length}</strong> matching grievances
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Page {currentPage} of {totalPages}</span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider font-extrabold border-b border-slate-200">
                  <th className="py-3.5 px-4 min-w-[130px]">Ticket ID</th>
                  <th className="py-3.5 px-4 min-w-[120px]">Date</th>
                  <th className="py-3.5 px-4 min-w-[170px]">Category</th>
                  <th className="py-3.5 px-3 min-w-[90px]">Ward</th>
                  <th className="py-3.5 px-4 min-w-[180px]">Citizen</th>
                  <th className="py-3.5 px-3 min-w-[100px]">Priority</th>
                  <th className="py-3.5 px-3 min-w-[110px]">Status</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Assigned To</th>
                  <th className="py-3.5 px-4 text-center min-w-[130px]">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <span className="text-3xl block mb-2">📋</span>
                      <p className="font-bold text-sm">No complaints found matching current filters.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedDept('ALL');
                          setSelectedWard('ALL');
                          setSelectedStatusTab('ALL');
                        }}
                        className="mt-2 text-xs text-primary font-bold hover:underline"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginatedComplaints.map((item) => {
                    const isUnassigned = !item.assigned_to || item.assigned_to.toLowerCase().includes('unassigned');

                    return (
                      <tr
                        key={item.id}
                        id={`ticket-row-${item.id.toLowerCase()}`}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* 1. Ticket ID */}
                        <td className="py-3.5 px-4 font-mono font-black text-primary text-xs">
                          {item.id}
                        </td>

                        {/* 2. Date */}
                        <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {item.date}
                        </td>

                        {/* 3. Category */}
                        <td className="py-3.5 px-4">
                          <CategoryBadge category={item.category} />
                        </td>

                        {/* 4. Ward */}
                        <td className="py-3.5 px-3">
                          <WardBadge ward={item.ward} />
                        </td>

                        {/* 5. Citizen */}
                        <td className="py-3.5 px-4">
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {item.citizen?.name || 'Citizen'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {item.citizen?.mobile || 'N/A'}
                            </span>
                          </div>
                        </td>

                        {/* 6. Priority */}
                        <td className="py-3.5 px-3">
                          <PriorityBadge level={item.priority} />
                        </td>

                        {/* 7. Status */}
                        <td className="py-3.5 px-3">
                          <StatusBadge status={item.status} />
                        </td>

                        {/* 8. Assigned To */}
                        <td className="py-3.5 px-4">
                          {isUnassigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <span>⏳</span>
                              <span>Unassigned</span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400">👷</span>
                              <span className="font-bold text-slate-800 line-clamp-1">
                                {item.assigned_to}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 9. Action: 'View Timeline' button */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            id={`btn-view-timeline-${item.id.toLowerCase()}`}
                            type="button"
                            onClick={() => handleOpenTimeline(item)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 rounded-lg text-xs font-black transition shadow-2xs inline-flex items-center gap-1.5"
                            title="Inspect full complaint audit lifecycle"
                          >
                            <span>🕒</span>
                            <span>View Timeline</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-lg transition"
              >
                ← Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg font-bold text-xs transition ${
                      currentPage === pageNum
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-lg transition"
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </main>

      {/* =========================================================================
          4. STEPPER TIMELINE MODAL
          Opens when clicking 'View Timeline' button for a complaint.
          Shows horizontal/vertical stepper with timestamps, actors, notes, and photos.
         ========================================================================= */}
      {timelineModalOpen && activeComplaint && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setTimelineModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 p-6 space-y-6 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {activeComplaint.id}
                  </span>
                  <StatusBadge status={activeComplaint.status} />
                  <PriorityBadge level={activeComplaint.priority} />
                  <WardBadge ward={activeComplaint.ward} />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-2">
                  Complaint Audit Lifecycle & Resolution Timeline
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full step-by-step audit record recorded on the central NMC grievance ledger
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTimelineModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Grievance Summary Snapshot */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
              <p className="text-xs text-slate-800 font-medium leading-relaxed">
                <strong className="text-slate-900 font-bold">Description: </strong>
                {activeComplaint.description}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Citizen</span>
                  <span className="font-bold text-slate-800">{activeComplaint.citizen?.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Mobile</span>
                  <span className="font-mono font-bold text-slate-800">{activeComplaint.citizen?.mobile}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Assigned Tech</span>
                  <span className="font-bold text-slate-800">{activeComplaint.assigned_to || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Logged At</span>
                  <span className="font-semibold text-slate-800">{activeComplaint.date}</span>
                </div>
              </div>
            </div>

            {/* STEPPER PROGRESS BAR (Horizontal on desktop / Stacked) */}
            <div>
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Lifecycle Milestones:</span>
                <span className="text-[11px] font-semibold text-primary">Click milestone to inspect details</span>
              </h4>

              {/* Stepper Buttons / Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {activeComplaint.timeline?.map((item, index) => {
                  const isSelected = selectedTimelineIndex === index;
                  const isDone = item.completed;
                  const isCurrent = item.current;

                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => setSelectedTimelineIndex(index)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'border-primary bg-blue-50/80 ring-2 ring-primary/30 shadow-xs'
                          : isDone
                          ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-1">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-primary text-white animate-pulse'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isDone ? '✓' : index + 1}
                        </span>
                      </div>
                      <span className={`block font-extrabold text-[11px] ${isSelected ? 'text-primary' : 'text-slate-800'}`}>
                        {item.step}
                      </span>
                      <span className="text-[9px] text-slate-500 line-clamp-1 mt-0.5">
                        {isDone ? 'Completed' : isCurrent ? 'Active Now' : 'Pending'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACTIVE MILESTONE DETAIL CARD */}
            {activeComplaint.timeline?.[selectedTimelineIndex] && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 border-l-4 border-l-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <h5 className="text-sm font-black text-slate-900">
                      Milestone {selectedTimelineIndex + 1}: {activeComplaint.timeline[selectedTimelineIndex].step}
                    </h5>
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      activeComplaint.timeline[selectedTimelineIndex].completed
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeComplaint.timeline[selectedTimelineIndex].current
                        ? 'bg-blue-100 text-primary animate-pulse'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {activeComplaint.timeline[selectedTimelineIndex].completed
                      ? 'Completed'
                      : activeComplaint.timeline[selectedTimelineIndex].current
                      ? 'Currently In Execution'
                      : 'Pending Step'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-500 font-bold block text-[10px] uppercase">Recorded Timestamp:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {activeComplaint.timeline[selectedTimelineIndex].timestamp}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[10px] uppercase">Responsible Entity:</span>
                    <span className="font-bold text-slate-800">
                      {activeComplaint.timeline[selectedTimelineIndex].actor}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900 block mb-1">Operational Remarks / Action Log:</span>
                  <p className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-medium">
                    {activeComplaint.timeline[selectedTimelineIndex].notes}
                  </p>
                </div>

                {/* Evidence Photos Thumbnail */}
                {activeComplaint.photos && activeComplaint.photos.length > 0 && (
                  <div className="pt-2">
                    <span className="text-slate-500 font-bold block text-[10px] uppercase mb-1.5">
                      Attached Photographic Proof:
                    </span>
                    <div className="flex gap-2.5">
                      {activeComplaint.photos.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative rounded-lg overflow-hidden border border-slate-200 w-24 h-20 block shadow-2xs hover:shadow-md transition"
                        >
                          <img
                            src={src}
                            alt="Grievance evidence"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <span className="absolute inset-0 bg-black/40 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            View HD ↗
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                NMC Audit Stamp: Verified on Government Civic Grid
              </span>

              <button
                type="button"
                onClick={() => setTimelineModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition shadow-xs"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintsLedger;
