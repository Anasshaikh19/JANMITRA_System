import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import WardBadge from '../../components/WardBadge';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import WorkerRegistrationForm from '../../components/WorkerRegistrationForm';

// 4 Primary Municipal Departments requested: PWD, SWM, PHE, Electrical
const DEPARTMENTS = [
  { id: 'PWD', name: 'Public Works (PWD)', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'SWM', name: 'Solid Waste Management (SWM)', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'PHE', name: 'Public Health Engineering (PHE)', badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'Electrical', name: 'Street Lighting & Electrical', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
];

const WARDS = [1, 2, 3, 4];
const PAGE_SIZE = 20;

// Curated comprehensive initial roster (48 workers) across 4 departments & 4 wards
// to fully support and test pagination (20 per page -> 3 pages: 20 + 20 + 8)
const INITIAL_WORKERS = [
  // --- PWD (Roads & Infrastructure) ---
  { id: 'EMP-W-101', name: 'Suresh Patil', dept: 'PWD', ward: 1, designation: 'Senior Road Inspector', active_tasks: 3, status: 'Active', mobile: '+91 98765 00101', email: 'suresh.patil@janmitra.gov.in' },
  { id: 'EMP-W-102', name: 'Ramesh Kumar', dept: 'PWD', ward: 2, designation: 'Heavy Machinery Operator', active_tasks: 4, status: 'Active', mobile: '+91 98765 00102', email: 'ramesh.kumar@janmitra.gov.in' },
  { id: 'EMP-W-103', name: 'Anil Deshmukh', dept: 'PWD', ward: 3, designation: 'Asphalt & Surfacing Specialist', active_tasks: 2, status: 'Active', mobile: '+91 98765 00103', email: 'anil.deshmukh@janmitra.gov.in' },
  { id: 'EMP-W-104', name: 'Santosh Shinde', dept: 'PWD', ward: 4, designation: 'Emergency Pothole Patch Tech', active_tasks: 1, status: 'Active', mobile: '+91 98765 00104', email: 'santosh.shinde@janmitra.gov.in' },
  { id: 'EMP-W-105', name: 'Vinod Thorat', dept: 'PWD', ward: 1, designation: 'Concrete Paver Mason', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00105', email: 'vinod.thorat@janmitra.gov.in' },
  { id: 'EMP-W-106', name: 'Manoj Jadhav', dept: 'PWD', ward: 2, designation: 'Road Roller Operator', active_tasks: 2, status: 'Active', mobile: '+91 98765 00106', email: 'manoj.jadhav@janmitra.gov.in' },
  { id: 'EMP-W-107', name: 'Pravin Gaikwad', dept: 'PWD', ward: 3, designation: 'Footpath Restoration Lead', active_tasks: 1, status: 'Active', mobile: '+91 98765 00107', email: 'pravin.gaikwad@janmitra.gov.in' },
  { id: 'EMP-W-108', name: 'Kailash More', dept: 'PWD', ward: 4, designation: 'Civic Infrastructure Tech', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00108', email: 'kailash.more@janmitra.gov.in' },
  { id: 'EMP-W-109', name: 'Dattatray Kadam', dept: 'PWD', ward: 1, designation: 'Road Marking & Signage Specialist', active_tasks: 2, status: 'Active', mobile: '+91 98765 00109', email: 'dattatray.kadam@janmitra.gov.in' },
  { id: 'EMP-W-110', name: 'Balasaheb Chavan', dept: 'PWD', ward: 2, designation: 'Bridge & Flyover Inspector', active_tasks: 3, status: 'Active', mobile: '+91 98765 00110', email: 'balasaheb.chavan@janmitra.gov.in' },
  { id: 'EMP-W-111', name: 'Rajendra Joshi', dept: 'PWD', ward: 3, designation: 'Pavement Drainage Surveyor', active_tasks: 1, status: 'Active', mobile: '+91 98765 00111', email: 'rajendra.joshi@janmitra.gov.in' },
  { id: 'EMP-W-112', name: 'Umesh Sawant', dept: 'PWD', ward: 4, designation: 'Excavation Supervisor', active_tasks: 2, status: 'Active', mobile: '+91 98765 00112', email: 'umesh.sawant@janmitra.gov.in' },

  // --- SWM (Solid Waste Management) ---
  { id: 'EMP-W-201', name: 'Ganesh Shinde', dept: 'SWM', ward: 1, designation: 'Sanitation Ward Supervisor', active_tasks: 2, status: 'Active', mobile: '+91 98765 00201', email: 'ganesh.shinde@janmitra.gov.in' },
  { id: 'EMP-W-202', name: 'Pooja Jadhav', dept: 'SWM', ward: 2, designation: 'Waste Collection Route Lead', active_tasks: 5, status: 'Active', mobile: '+91 98765 00202', email: 'pooja.jadhav@janmitra.gov.in' },
  { id: 'EMP-W-203', name: 'Sachin Kamble', dept: 'SWM', ward: 3, designation: 'Bio-Medical Waste Specialist', active_tasks: 1, status: 'Active', mobile: '+91 98765 00203', email: 'sachin.kamble@janmitra.gov.in' },
  { id: 'EMP-W-204', name: 'Mahesh More', dept: 'SWM', ward: 4, designation: 'Dumping Yard Operation Tech', active_tasks: 3, status: 'Active', mobile: '+91 98765 00204', email: 'mahesh.more@janmitra.gov.in' },
  { id: 'EMP-W-205', name: 'Anita Ghorpade', dept: 'SWM', ward: 1, designation: 'Door-to-Door Segregation Lead', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00205', email: 'anita.ghorpade@janmitra.gov.in' },
  { id: 'EMP-W-206', name: 'Sandip Salve', dept: 'SWM', ward: 2, designation: 'Compactor Truck Driver', active_tasks: 2, status: 'Active', mobile: '+91 98765 00206', email: 'sandip.salve@janmitra.gov.in' },
  { id: 'EMP-W-207', name: 'Sunita Bhosale', dept: 'SWM', ward: 3, designation: 'Community Bin Area Manager', active_tasks: 3, status: 'Active', mobile: '+91 98765 00207', email: 'sunita.bhosale@janmitra.gov.in' },
  { id: 'EMP-W-208', name: 'Ashok Lokhande', dept: 'SWM', ward: 4, designation: 'Bulk Waste Enforcement Tech', active_tasks: 1, status: 'Active', mobile: '+91 98765 00208', email: 'ashok.lokhande@janmitra.gov.in' },
  { id: 'EMP-W-209', name: 'Kavita Salve', dept: 'SWM', ward: 1, designation: 'Market Sanitation Inspector', active_tasks: 2, status: 'Active', mobile: '+91 98765 00209', email: 'kavita.salve@janmitra.gov.in' },
  { id: 'EMP-W-210', name: 'Vijay Ghodke', dept: 'SWM', ward: 2, designation: 'Debris & Rubble Clearing Tech', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00210', email: 'vijay.ghodke@janmitra.gov.in' },
  { id: 'EMP-W-211', name: 'Pravin Wagh', dept: 'SWM', ward: 3, designation: 'E-Waste Dispatch Handler', active_tasks: 1, status: 'Active', mobile: '+91 98765 00211', email: 'pravin.wagh@janmitra.gov.in' },
  { id: 'EMP-W-212', name: 'Rekha Kamble', dept: 'SWM', ward: 4, designation: 'Sanitary Landfill Monitor', active_tasks: 2, status: 'Active', mobile: '+91 98765 00212', email: 'rekha.kamble@janmitra.gov.in' },

  // --- PHE (Water Supply & Drainage) ---
  { id: 'EMP-W-301', name: 'Deepak Naik', dept: 'PHE', ward: 1, designation: 'Senior Pipeline Fitter', active_tasks: 4, status: 'Active', mobile: '+91 98765 00301', email: 'deepak.naik@janmitra.gov.in' },
  { id: 'EMP-W-302', name: 'Rahul Sawant', dept: 'PHE', ward: 2, designation: 'Drainage Jetting Operator', active_tasks: 2, status: 'Active', mobile: '+91 98765 00302', email: 'rahul.sawant@janmitra.gov.in' },
  { id: 'EMP-W-303', name: 'Kiran Mane', dept: 'PHE', ward: 3, designation: 'Water Valve Gate Specialist', active_tasks: 3, status: 'Active', mobile: '+91 98765 00303', email: 'kiran.mane@janmitra.gov.in' },
  { id: 'EMP-W-304', name: 'Ajit Pawar', dept: 'PHE', ward: 4, designation: 'Culvert Desilting Lead', active_tasks: 1, status: 'Active', mobile: '+91 98765 00304', email: 'ajit.pawar@janmitra.gov.in' },
  { id: 'EMP-W-305', name: 'Shrikant Jagtap', dept: 'PHE', ward: 1, designation: 'Water Quality Testing Tech', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00305', email: 'shrikant.jagtap@janmitra.gov.in' },
  { id: 'EMP-W-306', name: 'Pandurang Mohite', dept: 'PHE', ward: 2, designation: 'Sewer Suction Machine Operator', active_tasks: 2, status: 'Active', mobile: '+91 98765 00306', email: 'pandurang.mohite@janmitra.gov.in' },
  { id: 'EMP-W-307', name: 'Nilesh Tambe', dept: 'PHE', ward: 3, designation: 'Main Line Leakage Detector', active_tasks: 3, status: 'Active', mobile: '+91 98765 00307', email: 'nilesh.tambe@janmitra.gov.in' },
  { id: 'EMP-W-308', name: 'Sambhaji Shinde', dept: 'PHE', ward: 4, designation: 'Stormwater Nullah Cleaner', active_tasks: 1, status: 'Active', mobile: '+91 98765 00308', email: 'sambhaji.shinde@janmitra.gov.in' },
  { id: 'EMP-W-309', name: 'Gautam Waghmare', dept: 'PHE', ward: 1, designation: 'Booster Pump Station Engineer', active_tasks: 2, status: 'Active', mobile: '+91 98765 00309', email: 'gautam.waghmare@janmitra.gov.in' },
  { id: 'EMP-W-310', name: 'Sharad Kadam', dept: 'PHE', ward: 2, designation: 'Manhole Cover Specialist', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00310', email: 'sharad.kadam@janmitra.gov.in' },
  { id: 'EMP-W-311', name: 'Anant Deshmukh', dept: 'PHE', ward: 3, designation: 'Overhead Tank Maintenance Tech', active_tasks: 1, status: 'Active', mobile: '+91 98765 00311', email: 'anant.deshmukh@janmitra.gov.in' },
  { id: 'EMP-W-312', name: 'Namdev Patil', dept: 'PHE', ward: 4, designation: 'Underground Hydrant Inspector', active_tasks: 3, status: 'Active', mobile: '+91 98765 00312', email: 'namdev.patil@janmitra.gov.in' },

  // --- Electrical (Street Lighting & Electrical) ---
  { id: 'EMP-W-401', name: 'Sunil Gaikwad', dept: 'Electrical', ward: 1, designation: 'Senior Lineman', active_tasks: 3, status: 'Active', mobile: '+91 98765 00401', email: 'sunil.gaikwad@janmitra.gov.in' },
  { id: 'EMP-W-402', name: 'Nitin Kadam', dept: 'Electrical', ward: 2, designation: 'Pole Maintenance Electrician', active_tasks: 2, status: 'Active', mobile: '+91 98765 00402', email: 'nitin.kadam@janmitra.gov.in' },
  { id: 'EMP-W-403', name: 'Pravin Joshi', dept: 'Electrical', ward: 3, designation: 'Transformer Tech', active_tasks: 5, status: 'Active', mobile: '+91 98765 00403', email: 'pravin.joshi@janmitra.gov.in' },
  { id: 'EMP-W-404', name: 'Vikram Salunkhe', dept: 'Electrical', ward: 4, designation: 'LED High-Mast Tech', active_tasks: 0, status: 'Active', mobile: '+91 98765 00404', email: 'vikram.salunkhe@janmitra.gov.in' },
  { id: 'EMP-W-405', name: 'Chandrakant Rao', dept: 'Electrical', ward: 1, designation: 'Feeder Pillar Electrician', active_tasks: 1, status: 'Active', mobile: '+91 98765 00405', email: 'chandrakant.rao@janmitra.gov.in' },
  { id: 'EMP-W-406', name: 'Prashant More', dept: 'Electrical', ward: 2, designation: 'Solar Street Lamp Inspector', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00406', email: 'prashant.more@janmitra.gov.in' },
  { id: 'EMP-W-407', name: 'Rohan Kulkarni', dept: 'Electrical', ward: 3, designation: 'Underground Cable Jointer', active_tasks: 2, status: 'Active', mobile: '+91 98765 00407', email: 'rohan.kulkarni@janmitra.gov.in' },
  { id: 'EMP-W-408', name: 'Kishore Sonawane', dept: 'Electrical', ward: 4, designation: 'Traffic Signal Maintenance Lead', active_tasks: 3, status: 'Active', mobile: '+91 98765 00408', email: 'kishore.sonawane@janmitra.gov.in' },
  { id: 'EMP-W-409', name: 'Tushar Shinde', dept: 'Electrical', ward: 1, designation: 'Emergency Wire Hazard Tech', active_tasks: 2, status: 'Active', mobile: '+91 98765 00409', email: 'tushar.shinde@janmitra.gov.in' },
  { id: 'EMP-W-410', name: 'Sudhir Patil', dept: 'Electrical', ward: 2, designation: 'Street Light Timer & Sensor Tech', active_tasks: 1, status: 'Active', mobile: '+91 98765 00410', email: 'sudhir.patil@janmitra.gov.in' },
  { id: 'EMP-W-411', name: 'Amol Jadhav', dept: 'Electrical', ward: 3, designation: 'Sub-Station Wireman', active_tasks: 0, status: 'Inactive', mobile: '+91 98765 00411', email: 'amol.jadhav@janmitra.gov.in' },
  { id: 'EMP-W-412', name: 'Ganesh Deshpande', dept: 'Electrical', ward: 4, designation: 'Municipal Building Electrician', active_tasks: 2, status: 'Active', mobile: '+91 98765 00412', email: 'ganesh.deshpande@janmitra.gov.in' },
];

const LOCAL_STORAGE_KEY = 'janmitra_admin_workers';

const getStoredWorkers = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading workers from localStorage:', e);
  }
  return INITIAL_WORKERS;
};

const saveStoredWorkers = (list) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving workers to localStorage:', e);
  }
};

/**
 * 4. Active tasks badge styling:
 * - Green if 0
 * - Amber if 1-3
 * - Red if > 4 tasks (or 4+)
 */
const getActiveTasksBadgeStyle = (tasks) => {
  const count = Number(tasks) || 0;
  if (count === 0) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
  }
  if (count >= 1 && count <= 3) {
    return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
  }
  // count > 3 (4 or more)
  return 'bg-red-50 text-danger border-red-200 font-black';
};

const WorkerManagement = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Workers data state
  const [workers, setWorkers] = useState(getStoredWorkers);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 2. Filter bar state
  // Search by name/ID
  const [searchQuery, setSearchQuery] = useState('');
  // Department [All | PWD | SWM | PHE | Electrical]
  const [selectedDept, setSelectedDept] = useState('All');
  // Ward [All | 1 | 2 | 3 | 4]
  const [selectedWard, setSelectedWard] = useState('All');
  // Status [All | Active | Inactive]
  const [selectedStatus, setSelectedStatus] = useState('All');

  // 4. Pagination state (20 per page)
  const [currentPage, setCurrentPage] = useState(1);

  // 1. WorkerRegistrationForm modal state:
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);

  // 3. Deactivation Confirmation Dialog state
  const [deactivatingWorker, setDeactivatingWorker] = useState(null);
  const [isPatchingId, setIsPatchingId] = useState(null);

  // Toast notification helper
  const showToast = (type, text) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Synchronize with API if available
  useEffect(() => {
    const fetchRemote = async () => {
      setLoading(true);
      try {
        const res = await api.get('/v1/admin/workers/');
        const data = res.data?.workers || res.data?.items || res.data;
        if (Array.isArray(data) && data.length > 0) {
          setWorkers(data);
          saveStoredWorkers(data);
        }
      } catch (err) {
        // Fallback to local storage
        const local = getStoredWorkers();
        setWorkers(local);
      } finally {
        setLoading(false);
      }
    };
    fetchRemote();
  }, []);

  // Filter computation
  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      // 1. Search by name or employee ID or designation
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = String(worker.id || '').toLowerCase().includes(q);
        const matchName = String(worker.name || '').toLowerCase().includes(q);
        const matchDesig = String(worker.designation || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchDesig) return false;
      }

      // 2. Department filter [All | PWD | SWM | PHE | Electrical]
      if (selectedDept !== 'All') {
        const itemDept = String(worker.dept || '').toUpperCase();
        const targetDept = selectedDept.toUpperCase();
        if (targetDept === 'PHE') {
          if (!['PHE', 'WSD', 'WATER'].includes(itemDept)) return false;
        } else if (targetDept === 'ELECTRICAL') {
          if (!['ELECTRICAL', 'ELEC', 'LIGHTING'].includes(itemDept)) return false;
        } else {
          if (itemDept !== targetDept) return false;
        }
      }

      // 3. Ward filter [All | 1 | 2 | 3 | 4]
      if (selectedWard !== 'All') {
        if (String(worker.ward) !== String(selectedWard)) return false;
      }

      // 4. Status filter [All | Active | Inactive]
      if (selectedStatus !== 'All') {
        const isCurrentActive = String(worker.status).toLowerCase() === 'active';
        if (selectedStatus === 'Active' && !isCurrentActive) return false;
        if (selectedStatus === 'Inactive' && isCurrentActive) return false;
      }

      return true;
    });
  }, [workers, searchQuery, selectedDept, selectedWard, selectedStatus]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept, selectedWard, selectedStatus]);

  // 4. Pagination calculations (20 per page)
  const totalItems = filteredWorkers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
  const paginatedWorkers = filteredWorkers.slice(startIndex, startIndex + PAGE_SIZE);

  // Stats computation
  const stats = useMemo(() => {
    const total = workers.length;
    const active = workers.filter((w) => String(w.status).toLowerCase() === 'active').length;
    const inactive = total - active;
    const totalActiveTasks = workers.reduce((sum, w) => sum + (Number(w.active_tasks) || 0), 0);
    return { total, active, inactive, totalActiveTasks };
  }, [workers]);

  // 1. Open 'Add New Worker' modal using WorkerRegistrationForm
  const handleOpenAddModal = () => {
    setEditingWorker(null);
    setIsEditMode(false);
    setIsFormOpen(true);
  };

  // 1. Edit button: Opens WorkerRegistrationForm pre-filled with worker data
  const handleOpenEditModal = (worker) => {
    setEditingWorker(worker);
    setIsEditMode(true);
    setIsFormOpen(true);
  };

  // Callback from WorkerRegistrationForm to persist worker additions or edits
  const handleSaveWorker = async (workerData, isEdit) => {
    try {
      if (isEdit && editingWorker) {
        // Calls PATCH to update worker details
        try {
          await api.patch(`/v1/admin/workers/${editingWorker.id}/`, workerData);
        } catch {
          try {
            await api.patch(`/api/v1/admin/workers/${editingWorker.id}/`, workerData);
          } catch {
            // graceful fallback to local state
          }
        }

        const updated = workers.map((w) =>
          w.id === editingWorker.id ? { ...w, ...workerData } : w
        );
        setWorkers(updated);
        saveStoredWorkers(updated);
        showToast('success', `Worker ${workerData.name} (${editingWorker.id}) updated successfully!`);
      } else {
        // Calls POST to register new worker
        try {
          await api.post('/v1/admin/workers/', workerData);
        } catch {
          try {
            await api.post('/api/v1/admin/workers/', workerData);
          } catch {
            // graceful fallback to local state
          }
        }

        const updated = [workerData, ...workers];
        setWorkers(updated);
        saveStoredWorkers(updated);
        showToast('success', `Worker ${workerData.name} (${workerData.id}) registered successfully!`);
      }
    } catch (err) {
      showToast('error', err.message || 'Operation failed. Please try again.');
      throw err;
    }
  };

  /**
   * 2 & 3. Status Toggle Logic:
   * - If currently Active and active_tasks > 0:
   *   Requirement 3: Prompts Confirmation Dialog before deactivating.
   * - If currently Active and active_tasks === 0:
   *   Directly calls PATCH and deactivates.
   * - If currently Inactive:
   *   Directly calls PATCH and activates.
   */
  const handleInitiateToggleStatus = (worker) => {
    const isCurrentlyActive = String(worker.status).toLowerCase() === 'active';

    if (isCurrentlyActive) {
      const activeTasksCount = Number(worker.active_tasks) || 0;
      if (activeTasksCount > 0) {
        // Trigger Requirement 3 confirmation dialog
        setDeactivatingWorker(worker);
        return;
      }
      // 0 active tasks: proceed with direct deactivation
      performStatusToggle(worker.id, 'Inactive');
    } else {
      // Worker is currently Inactive: activate them directly
      performStatusToggle(worker.id, 'Active');
    }
  };

  /**
   * 2. Status Toggle: Calls PATCH to update status on server/local state
   */
  const performStatusToggle = async (workerId, newStatus) => {
    const target = workers.find((w) => w.id === workerId);
    if (!target) return;

    setIsPatchingId(workerId);
    try {
      // 2. Calls PATCH
      try {
        await api.patch(`/v1/admin/workers/${workerId}/status/`, { status: newStatus });
      } catch {
        try {
          await api.patch(`/api/v1/admin/workers/${workerId}/status/`, { status: newStatus });
        } catch {
          try {
            await api.patch(`/v1/worker/${workerId}/status/`, { status: newStatus });
          } catch {
            // local state fallback
          }
        }
      }

      const updated = workers.map((w) =>
        w.id === workerId ? { ...w, status: newStatus } : w
      );
      setWorkers(updated);
      saveStoredWorkers(updated);

      if (newStatus === 'Active') {
        showToast('success', `${target.name} (${target.id}) is now Active On-Duty.`);
      } else {
        showToast(
          'info',
          `${target.name} (${target.id}) marked Inactive.${
            target.active_tasks > 0
              ? ` Note: Re-assign ${target.active_tasks} open tasks.`
              : ''
          }`
        );
      }
    } catch (err) {
      showToast('error', `Failed to update status for ${target.name}`);
    } finally {
      setIsPatchingId(null);
      setDeactivatingWorker(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDept('All');
    setSelectedWard('All');
    setSelectedStatus('All');
    setCurrentPage(1);
  };

  // Helper for Department badge color
  const getDeptBadgeClass = (dept) => {
    const d = String(dept || '').toUpperCase();
    if (d === 'PWD') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (d === 'SWM') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (d === 'PHE' || d === 'WSD') return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (d === 'ELECTRICAL' || d === 'ELEC') return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold transition-all transform animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : toastMessage.type === 'info'
              ? 'bg-slate-800 text-white shadow-slate-900/20'
              : 'bg-red-600 text-white shadow-red-500/20'
          }`}
        >
          <span className="text-base">
            {toastMessage.type === 'success' ? '✓' : toastMessage.type === 'info' ? 'ℹ️' : '✕'}
          </span>
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/80 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center shadow-2xs"
              title="Return to Admin Command Center"
            >
              <span>←</span>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-purple uppercase tracking-wider">
                  JANMITRA Administration
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500 font-semibold">Workforce Operations</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Worker Management</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-primary border border-blue-200">
                  {stats.total} Registered
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation link to Command Overview */}
            <Link
              to="/admin"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition hidden sm:inline-flex items-center gap-1.5 shadow-2xs"
            >
              <span>📊</span>
              <span>Command Overview</span>
            </Link>

            {/* 1. Page Title & Blue 'Add New Worker' Button */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-primary hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold rounded-xl shadow-sm shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer"
              title="Add New Municipal Worker"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add New Worker</span>
            </button>

            <button
              onClick={logout}
              className="px-3 py-2 text-xs font-bold bg-red-50 hover:bg-red-100 text-danger border border-red-200 rounded-xl transition shadow-2xs"
              title="Sign Out"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Total Municipal Staff
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{stats.total}</span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                4 Wards
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block mb-1">
              Active On-Duty
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700">{stats.active}</span>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                {Math.round((stats.active / (stats.total || 1)) * 100)}%
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Inactive / On Leave
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-600">{stats.inactive}</span>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                Standby
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary block mb-1">
              Active Assigned Tasks
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-primary">{stats.totalActiveTasks}</span>
              <span className="text-xs font-bold text-primary bg-blue-100 px-2 py-0.5 rounded-full">
                Dispatched
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            2. FILTER BAR
            - Search by name/ID
            - Department [All | PWD | SWM | PHE | Electrical]
            - Ward [All | 1 | 2 | 3 | 4]
            - Status [All | Active | Inactive]
           ======================================================== */}
        <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by worker name, employee ID, or designation..."
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-slate-800 transition"
              />
              <span className="absolute left-3 top-3 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-3 sm:flex sm:items-center gap-2.5">
              {/* Department [All | PWD | SWM | PHE | Electrical] */}
              <div className="flex-1 sm:w-44">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-slate-700 transition"
                >
                  <option value="All">All Departments</option>
                  <option value="PWD">PWD (Roads)</option>
                  <option value="SWM">SWM (Waste)</option>
                  <option value="PHE">PHE (Water/Drainage)</option>
                  <option value="Electrical">Electrical (Lighting)</option>
                </select>
              </div>

              {/* Ward [All | 1 | 2 | 3 | 4] */}
              <div className="flex-1 sm:w-32">
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-slate-700 transition"
                >
                  <option value="All">All Wards</option>
                  <option value="1">Ward 1</option>
                  <option value="2">Ward 2</option>
                  <option value="3">Ward 3</option>
                  <option value="4">Ward 4</option>
                </select>
              </div>

              {/* Status [All | Active | Inactive] */}
              <div className="flex-1 sm:w-36">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-slate-700 transition"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active On-Duty</option>
                  <option value="Inactive">Inactive / Leave</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Filter Pill Counter and Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">
                Found {totalItems} {totalItems === 1 ? 'worker' : 'workers'}
              </span>
              {(searchQuery || selectedDept !== 'All' || selectedWard !== 'All' || selectedStatus !== 'All') && (
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                  Filters Active
                </span>
              )}
            </div>

            {(searchQuery || selectedDept !== 'All' || selectedWard !== 'All' || selectedStatus !== 'All') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>↺</span>
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        </section>

        {/* ========================================================
            3. WORKER TABLE
            Columns:
            - Employee ID
            - Name
            - Dept
            - Ward
            - Designation
            - Active Tasks (Green: 0, Amber: 1-3, Red: >4)
            - Status (Toggle switch between Active / Inactive)
            - Actions (Edit, Toggle Status)
           ======================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="table" count={5} message="Loading municipal worker roster..." />
            </div>
          ) : paginatedWorkers.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
                👷
              </div>
              <h3 className="text-base font-black text-slate-900">No Workers Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No municipal worker records match your current search and filter selections.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Employee ID</th>
                    <th className="py-3.5 px-4">Name</th>
                    <th className="py-3.5 px-4">Dept</th>
                    <th className="py-3.5 px-4">Ward</th>
                    <th className="py-3.5 px-4">Designation</th>
                    <th className="py-3.5 px-4 text-center">Active Tasks</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedWorkers.map((worker) => {
                    const isActive = String(worker.status).toLowerCase() === 'active';
                    const activeTasks = Number(worker.active_tasks) || 0;
                    const isPatching = isPatchingId === worker.id;

                    return (
                      <tr
                        key={worker.id}
                        className="hover:bg-slate-50/90 transition-colors group"
                      >
                        {/* 1. Employee ID */}
                        <td className="py-3.5 px-4 font-mono font-black text-slate-900">
                          <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-[11px]">
                            {worker.id}
                          </span>
                        </td>

                        {/* 2. Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-xs shrink-0 shadow-2xs">
                              {worker.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 text-xs block truncate">
                                {worker.name}
                              </span>
                              <span className="text-[11px] text-slate-400 block truncate">
                                {worker.mobile || worker.email || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Dept */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${getDeptBadgeClass(
                              worker.dept
                            )}`}
                          >
                            {worker.dept}
                          </span>
                        </td>

                        {/* 4. Ward */}
                        <td className="py-3.5 px-4">
                          <WardBadge ward={worker.ward} />
                        </td>

                        {/* 5. Designation */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {worker.designation}
                        </td>

                        {/* 6. Active Tasks Badge: Green if 0, Amber if 1-3, Red if > 4 tasks */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs inline-flex items-center gap-1 border shadow-2xs ${getActiveTasksBadgeStyle(
                              activeTasks
                            )}`}
                            title={`${activeTasks} tasks currently assigned`}
                          >
                            <span>{activeTasks}</span>
                            <span className="text-[10px] opacity-80 font-semibold">
                              {activeTasks === 1 ? 'task' : 'tasks'}
                            </span>
                          </span>
                        </td>

                        {/* 7. Status Column with Toggle Switch & Indicator */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Interactive Slider Switch (Requirement 2 & 3) */}
                            <button
                              type="button"
                              onClick={() => handleInitiateToggleStatus(worker)}
                              disabled={isPatching}
                              role="switch"
                              aria-checked={isActive}
                              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                                isActive ? 'bg-emerald-500' : 'bg-slate-300'
                              } ${isPatching ? 'opacity-50 cursor-wait' : ''}`}
                              title={
                                isActive
                                  ? 'Click toggle to mark Inactive'
                                  : 'Click toggle to mark Active'
                              }
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  isActive ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>

                            {/* Status label pill */}
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>Inactive</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 8. Actions (Edit, Toggle Status) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Button (Requirement 2 & 3) */}
                            <button
                              type="button"
                              onClick={() => handleInitiateToggleStatus(worker)}
                              disabled={isPatching}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                                isActive
                                  ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              } ${isPatching ? 'opacity-50 cursor-wait' : ''}`}
                              title={
                                isActive
                                  ? 'Deactivate worker'
                                  : 'Activate worker on-duty'
                              }
                            >
                              {isPatching ? 'Updating...' : isActive ? 'Deactivate' : 'Activate'}
                            </button>

                            {/* 1. Edit Button: Opens WorkerRegistrationForm pre-filled */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(worker)}
                              className="px-2.5 py-1.5 bg-blue-50 text-primary hover:bg-blue-100 active:bg-blue-200 border border-blue-200 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                              title="Edit Worker Profile"
                            >
                              <span>✏️</span>
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================
              4. PAGINATION (20 per page)
             ======================================================== */}
          {!loading && totalItems > 0 && (
            <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-medium">
                Showing{' '}
                <strong className="text-slate-800 font-bold">
                  {startIndex + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800 font-bold">
                  {Math.min(startIndex + PAGE_SIZE, totalItems)}
                </strong>{' '}
                of <strong className="text-slate-800 font-bold">{totalItems}</strong>{' '}
                workers (20 per page)
              </div>

              {/* Page Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={validCurrentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                      validCurrentPage === pageNum
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={validCurrentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ========================================================
          1. WORKER REGISTRATION & EDIT MODAL (WorkerRegistrationForm)
         ======================================================== */}
      <WorkerRegistrationForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingWorker(null);
        }}
        initialData={editingWorker}
        isEdit={isEditMode}
        onSave={handleSaveWorker}
      />

      {/* ========================================================
          3. CONFIRMATION DIALOG: DEACTIVATING WORKER WITH ACTIVE TASKS
         ======================================================== */}
      {deactivatingWorker && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeactivatingWorker(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Header */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                ⚠️
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Confirm Deactivation
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">
                    {deactivatingWorker.active_tasks} Active Tasks
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Worker has pending on-ground assignments
                </p>
              </div>
            </div>

            {/* Warning Message Card */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <span>Caution:</span>
                <span>
                  {deactivatingWorker.name} ({deactivatingWorker.id})
                </span>
              </div>
              <p className="leading-relaxed text-amber-800 text-[11px]">
                This worker currently has{' '}
                <strong className="font-extrabold text-red-700">
                  {deactivatingWorker.active_tasks} active assigned{' '}
                  {deactivatingWorker.active_tasks === 1 ? 'task' : 'tasks'}
                </strong>{' '}
                in <strong>Ward {deactivatingWorker.ward} ({deactivatingWorker.dept})</strong>.
              </p>
              <p className="leading-relaxed text-amber-800 text-[11px]">
                Deactivating an on-duty worker with unresolved civic grievances will leave these tasks unmonitored and may trigger municipal SLA breach escalations.
              </p>
            </div>

            {/* Dialog Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeactivatingWorker(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition text-center"
              >
                Cancel (Keep Active)
              </button>

              <button
                type="button"
                onClick={() => performStatusToggle(deactivatingWorker.id, 'Inactive')}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Confirm Deactivation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerManagement;
