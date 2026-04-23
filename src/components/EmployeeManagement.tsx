import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp, deleteDoc, setDoc, getDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logAction } from '../services/loggerService';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Search,
  Filter,
  RefreshCw,
  X,
  ShieldCheck,
  Mail,
  MapPin,
  Phone,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  ClipboardList,
  FileDown,
  Star,
  CheckCircle2,
  Target,
  Calendar,
  Wallet,
  Fingerprint,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Pagination: React.FC<{
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Node {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:border-mine-green hover:text-mine-green transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === p ? 'bg-mine-green text-white shadow-lg shadow-green-200' : 'bg-white border border-gray-200 text-gray-400 hover:border-mine-green hover:text-mine-green'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:border-mine-green hover:text-mine-green transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

const SearchableSelect: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}> = ({ label, value, options, onChange, placeholder = 'Search...', icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative group">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-mine-green cursor-pointer flex items-center justify-between transition-all"
      >
        <div className="flex items-center gap-2 truncate">
          {icon}
          <span className={value ? 'text-gray-900 font-bold' : 'text-gray-400'}>
            {value || placeholder}
          </span>
        </div>
        <Filter size={12} className="text-gray-400 shrink-0" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden"
            >
              <div className="p-2 border-b border-gray-50 flex items-center gap-2">
                <Search size={12} className="text-gray-400" />
                <input 
                  autoFocus
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter keys..."
                  className="w-full text-xs outline-none bg-transparent"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <button 
                  onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-gray-400 italic"
                >
                  Clear Selection
                </button>
                {filtered.map(opt => (
                  <button 
                    key={opt}
                    onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                    className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-green-50 hover:text-mine-green transition-colors ${value === opt ? 'bg-green-50 text-mine-green' : 'text-gray-600'}`}
                  >
                    {opt}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-4 py-3 text-[10px] text-gray-400 text-center italic font-mono">End of stream. No matching nodes.</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmployeeManagement: React.FC = () => {
  const { user, profile, isSuperAdmin, isAdmin } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [isBulkDeptOpen, setIsBulkDeptOpen] = useState(false);
  const [bulkDept, setBulkDept] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: 'employee',
    department: '',
    jobTitle: '',
    branch: '',
    subsidiaryId: '',
    baseSalary: 1000,
    currency: 'USD',
    status: 'active'
  });

  // PII Visibility & Editing state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'pii' | 'banking' | 'reviews'>('pii');
  const [userPii, setUserPii] = useState<any | null>(null);
  const [fetchingPii, setFetchingPii] = useState(false);
  const [isEditingPii, setIsEditingPii] = useState(false);
  const [piiForm, setPiiForm] = useState({
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyRelation: '',
    emergencyPhone: '',
    nationalId: '',
    medicalAidNo: '',
    bankName: '',
    accountNumber: '',
    branchCode: '',
    accountName: ''
  });

  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);

  // Inactivity Re-lock logic
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (!isVaultLocked) {
        inactivityTimer = setTimeout(() => {
          setIsVaultLocked(true);
          setIsEditingPii(false);
        }, 120000); // 2 minutes of node inactivity
      }
    };

    if (!isVaultLocked) {
      resetTimer();
      document.addEventListener('mousemove', resetTimer);
      document.addEventListener('keypress', resetTimer);
      document.addEventListener('touchstart', resetTimer);
      document.addEventListener('scroll', resetTimer, true);
    }

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      document.removeEventListener('mousemove', resetTimer);
      document.removeEventListener('keypress', resetTimer);
      document.removeEventListener('touchstart', resetTimer);
      document.removeEventListener('scroll', resetTimer, true);
    };
  }, [isVaultLocked]);

  // Performance Review states
  const [reviews, setReviews] = useState<any[]>([]);
  const [fetchingReviews, setFetchingReviews] = useState(false);
  const [isRecordingReview, setIsRecordingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    reviewDate: new Date().toISOString().split('T')[0],
    periodStart: '',
    periodEnd: '',
    overallRating: 3,
    feedback: '',
    goals: '',
    status: 'scheduled' as 'scheduled' | 'conducted' | 'completed'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersQuery = isSuperAdmin 
        ? collection(db, 'users') 
        : query(collection(db, 'users'), where('subsidiaryId', '==', profile?.subsidiaryId || 'none'));

      const [userSnap, subSnap] = await Promise.all([
        getDocs(usersQuery),
        isSuperAdmin ? getDocs(collection(db, 'subsidiaries')) : Promise.resolve({ docs: [] } as any)
      ]);
      
      const allEmps: any[] = userSnap.docs.map(doc => ({ ...doc.data() as any, uid: doc.id }));
      // If not super admin, filter by profile's subsidiary
      if (!isSuperAdmin && profile?.subsidiaryId) {
        setEmployees(allEmps.filter(e => e.subsidiaryId === profile.subsidiaryId));
      } else {
        setEmployees(allEmps);
      }

      if (isSuperAdmin) {
        setSubsidiaries(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const dataToSave = {
        ...form,
        // Ensure subsidiaryId is set if not super admin
        subsidiaryId: isSuperAdmin ? form.subsidiaryId : (profile?.subsidiaryId || '')
      };

      if (editingEmp) {
        await updateDoc(doc(db, 'users', editingEmp.uid), dataToSave);
        await logAction({
          action: 'Personnel Update',
          category: 'personnel',
          details: `Updated details for employee ${editingEmp.fullName} (${editingEmp.uid}).`,
          entityId: editingEmp.uid,
          userName: profile?.fullName || user?.displayName,
          userEmail: user?.email
        });
      } else {
        const id = doc(collection(db, 'users')).id;
        await setDoc(doc(db, 'users', id), {
          ...dataToSave,
          uid: id,
          status: dataToSave.status || 'active',
          createdAt: serverTimestamp()
        });
        await logAction({
          action: 'Personnel Recruitment',
          category: 'personnel',
          details: `Created new employee record for ${dataToSave.fullName} in ${dataToSave.department}.`,
          entityId: id,
          userName: profile?.fullName || user?.displayName,
          userEmail: user?.email
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, editingEmp ? 'update' : 'create');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!window.confirm("Are you sure? This will permanently remove the record.")) return;
    setProcessing(true);
    try {
      await deleteDoc(doc(db, 'users', uid));
      await logAction({
        action: 'Personnel Deletion',
        category: 'personnel',
        details: `Deleted employee record with UID ${uid}.`,
        entityId: uid,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, 'delete');
    } finally {
      setProcessing(false);
    }
  };

  const fetchPii = async (user: any, initialTab: 'pii' | 'banking' = 'pii') => {
    setSelectedUser(user);
    setActiveDetailTab(initialTab);
    setFetchingPii(true);
    setUserPii(null);
    setIsEditingPii(false);
    try {
      const piiSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'details'));
      
      await logAction({
        action: 'PII Access',
        category: 'system',
        details: `Accessed sensitive ${initialTab} data for employee ${user.fullName} (${user.uid}).`,
        entityId: user.uid,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });

      if (piiSnap.exists()) {
        const data = piiSnap.data();
        setUserPii(data);
        setPiiForm({
          phone: data.phone || '',
          address: data.address || '',
          emergencyContact: data.emergencyContact || '',
          emergencyRelation: data.emergencyRelation || '',
          emergencyPhone: data.emergencyPhone || '',
          nationalId: data.nationalId || '',
          medicalAidNo: data.medicalAidNo || '',
          bankName: data.bankName || '',
          accountNumber: data.accountNumber || '',
          branchCode: data.branchCode || '',
          accountName: data.accountName || ''
        });
      } else {
        setUserPii({});
        setPiiForm({
          phone: '',
          address: '',
          emergencyContact: '',
          emergencyRelation: '',
          emergencyPhone: '',
          nationalId: '',
          medicalAidNo: '',
          bankName: '',
          accountNumber: '',
          branchCode: '',
          accountName: ''
        });
      }
    } catch (err) {
      handleFirestoreError(err, 'get');
    } finally {
      setFetchingPii(false);
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authEmail.toLowerCase() === user?.email?.toLowerCase()) {
      setIsVerifyingAdmin(false);
      setIsVaultLocked(false);
      setIsEditingPii(true);
      setAuthEmail('');
    } else {
      alert("Verification failed. Please enter your administrator email correctly.");
    }
  };

  const handlePiiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setProcessing(true);
    try {
      await setDoc(doc(db, 'users', selectedUser.uid, 'private', 'details'), {
        ...piiForm,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'admin'
      });
      
      await logAction({
        action: 'PII Update',
        category: 'system',
        details: `Updated sensitive PII for employee ${selectedUser.fullName} (${selectedUser.uid}).`,
        entityId: selectedUser.uid,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });

      setUserPii(piiForm);
      setIsEditingPii(false);
      setIsVaultLocked(true); // Relock after save
      alert("Sensitive PII updated successfully.");
    } catch (err) {
      handleFirestoreError(err, 'write');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to deactivate ${selectedEmps.size} employee(s)?`)) return;
    setProcessing(true);
    try {
      const promises = Array.from(selectedEmps).map((uid: string) => deleteDoc(doc(db, 'users', uid)));
      await Promise.all(promises);
      
      await logAction({
        action: 'Bulk Personnel Deactivation',
        category: 'personnel',
        details: `Deactivated ${promises.length} employee records in bulk.`,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });

      setSelectedEmps(new Set());
      fetchData();
      alert("Employees deactivated successfully.");
    } catch (err) {
      handleFirestoreError(err, 'delete');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAssignDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkDept) return;
    setProcessing(true);
    try {
      const promises = Array.from(selectedEmps).map((uid: string) => updateDoc(doc(db, 'users', uid), { department: bulkDept }));
      await Promise.all(promises);
      setSelectedEmps(new Set());
      setIsBulkDeptOpen(false);
      setBulkDept('');
      fetchData();
      alert(`Department updated for ${promises.length} employees.`);
    } catch (err) {
      handleFirestoreError(err, 'update');
    } finally {
      setProcessing(false);
    }
  };

  const fetchReviews = async (employee: any) => {
    setSelectedUser(employee);
    setActiveDetailTab('reviews');
    setFetchingReviews(true);
    setReviews([]);
    try {
      const q = query(collection(db, 'users', employee.uid, 'reviews'), orderBy('reviewDate', 'desc'));
      const snap = await getDocs(q);
      setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      handleFirestoreError(err, 'list');
    } finally {
      setFetchingReviews(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setProcessing(true);
    try {
      const id = doc(collection(db, 'users', selectedUser.uid, 'reviews')).id;
      await setDoc(doc(db, 'users', selectedUser.uid, 'reviews', id), {
        ...reviewForm,
        id,
        employeeId: selectedUser.uid,
        employeeName: selectedUser.fullName,
        reviewerId: user?.uid,
        reviewerName: profile?.fullName || user?.email,
        createdAt: serverTimestamp()
      });
      
      await logAction({
        action: 'Performance Review Recording',
        category: 'performance',
        details: `Recorded review for ${selectedUser.fullName} with rating ${reviewForm.overallRating}/5.`,
        entityId: id,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });

      setIsRecordingReview(false);
      fetchReviews(selectedUser);
      alert("Performance review recorded successfully.");
    } catch (err) {
      handleFirestoreError(err, 'write');
    } finally {
      setProcessing(false);
    }
  };

  const downloadReviewPDF = async (review: any) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(15, 23, 42); // slate-900 equivalent
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('MINEAZY PERSONNEL AUDIT', 20, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('OFFICIAL PERFORMANCE MATRIX REPORT', 20, 32);
      
      // Personnel Info
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Personnel Information', 20, 55);
      
      doc.setDrawColor(210, 180, 140); // mine-gold equivalentish
      doc.setLineWidth(0.5);
      doc.line(20, 58, 190, 58);
      
      doc.setFontSize(10);
      doc.text(`Full Name: ${selectedUser?.fullName}`, 20, 68);
      doc.text(`Designation: ${selectedUser?.jobTitle || 'N/A'}`, 20, 75);
      doc.text(`Department: ${selectedUser?.department || 'N/A'}`, 20, 82);
      doc.text(`Review Date: ${new Date(review.reviewDate).toLocaleDateString()}`, 140, 68);
      doc.text(`Rating: ${review.overallRating}.0 / 5.0`, 140, 75);
      
      // Evaluation Matrix
      doc.setFontSize(14);
      doc.text('Operational Evaluation', 20, 100);
      doc.line(20, 103, 190, 103);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const feedbackLines = doc.splitTextToSize(review.feedback || 'No transcript record detected.', 170);
      doc.text(feedbackLines, 20, 110);
      
      let nextY = 110 + (feedbackLines.length * 6) + 15;
      
      if (review.goals) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Strategic Objectives', 20, nextY);
        doc.line(20, nextY + 3, 190, nextY + 3);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const goalLines = doc.splitTextToSize(review.goals, 170);
        doc.text(goalLines, 20, nextY + 10);
        nextY += (goalLines.length * 6) + 20;
      }
      
      // Sig Section
      if (nextY > 250) {
        doc.addPage();
        nextY = 30;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Authorization Digital Fingerprint', 20, nextY);
      doc.line(20, nextY + 3, 100, nextY + 3);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Reviewer: ${review.reviewerName || 'System Admin'}`, 20, nextY + 12);
      doc.text(`Status: ${review.status.toUpperCase()}`, 20, nextY + 17);
      doc.text(`Generation Node: AIS-PROD-ZIMRA-HUB`, 20, nextY + 22);
      doc.text(`Timestamp: ${new Date().toISOString()}`, 20, nextY + 27);
      
      doc.save(`Personnel_Review_${selectedUser?.fullName.replace(/\s+/g, '_')}_${review.reviewDate}.pdf`);
    } catch (err) {
      console.error("PDF Fail:", err);
      alert("Failed to generate PDF audit report.");
    }
  };

  const toggleEmpSelection = (uid: string) => {
    const next = new Set(selectedEmps);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelectedEmps(next);
  };

  const toggleSelectAllEmps = () => {
    if (selectedEmps.size === filtered.length) {
      setSelectedEmps(new Set());
    } else {
      setSelectedEmps(new Set(filtered.map(e => e.uid)));
    }
  };

  const filtered = employees.filter(e => {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = e.fullName.toLowerCase().includes(searchLower);
    const subName = subsidiaries.find(s => s.id === e.subsidiaryId)?.name || '';
    
    // In global search within the component, admins can also find by status, subsidiary name, or subsidiary ID
    const adminSearchMatch = isAdmin && (
      (e.status && e.status.toLowerCase().includes(searchLower)) ||
      subName.toLowerCase().includes(searchLower) ||
      (e.subsidiaryId && e.subsidiaryId.toLowerCase().includes(searchLower))
    );

    const deptMatch = !deptFilter || e.department === deptFilter;
    const roleMatch = !roleFilter || e.role === roleFilter;
    const branchMatch = !branchFilter || e.branch === branchFilter;
    const statusMatch = !statusFilter || e.status === statusFilter;
    const subMatch = !subFilter || e.subsidiaryId === subFilter;
    return (nameMatch || adminSearchMatch) && deptMatch && roleMatch && branchMatch && statusMatch && subMatch;
  });

  const depts = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];
  const roles = Array.from(new Set(employees.map(e => e.role).filter(Boolean))) as string[];
  const branches = Array.from(new Set(employees.map(e => e.branch).filter(Boolean))) as string[];

  if (loading) return <div className="p-8 text-center text-gray-500 font-mono text-xs uppercase tracking-widest animate-pulse">Scanning Personnel Database...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 italic serif">Staff Management</h1>
          <p className="text-sm text-gray-500">Recruit, manage and audit site personnel</p>
        </div>
        <button 
          onClick={() => { setEditingEmp(null); setForm({ fullName: '', email: '', role: 'employee', department: '', jobTitle: '', branch: '', subsidiaryId: '', baseSalary: 1000, currency: 'USD', status: 'active' }); setIsModalOpen(true); }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Recruit Staff
        </button>
      </header>

      {/* Modern Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-mine-green transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Global Personnel</p>
            <p className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{employees.length}</p>
          </div>
          <div className="w-12 h-12 bg-mine-green/5 rounded-xl flex items-center justify-center text-mine-green group-hover:bg-mine-green group-hover:text-white transition-all">
            <Users size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-mine-gold transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operational Entities</p>
            <p className="text-3xl font-black text-slate-900 font-mono tracking-tighter">
              {isSuperAdmin ? subsidiaries.length : (new Set(employees.map(e => e.subsidiaryId)).size || 1)}
            </p>
          </div>
          <div className="w-12 h-12 bg-mine-gold/5 rounded-xl flex items-center justify-center text-mine-gold group-hover:bg-mine-gold group-hover:text-white transition-all">
            <Building2 size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-500 transition-all">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Regional Branches</p>
            <p className="text-3xl font-black text-slate-900 font-mono tracking-tighter">
              {new Set(employees.filter(e => e.branch).map(e => e.branch)).size}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
            <MapPin size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <section className="card bg-slate-900 border-none p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="text-mine-gold" size={16} />
              <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Audit Summary</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-[10px] text-gray-400 uppercase font-black">Total Active</span>
                <span className="text-lg font-black text-mine-gold font-monoLeading-none">{employees.length}</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <span className="text-[10px] text-gray-400 uppercase font-black">Contractors</span>
                <span className="text-sm font-bold text-white font-mono">{employees.filter(e => e.role === 'contractor').length}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-gray-400 uppercase font-black">Site Admins</span>
                <span className="text-sm font-bold text-white font-mono">{employees.filter(e => e.role === 'admin').length}</span>
              </div>
            </div>
          </section>
        </aside>

        <main className="lg:col-span-3 space-y-4">
          <section className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-2">
            <div className="relative flex flex-col justify-end">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Search Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isAdmin ? "Name, status, or subsidiary..." : "Employee name..."}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-mine-green h-10 shadow-sm"
                />
              </div>
            </div>

            {isSuperAdmin && (
              <SearchableSelect 
                label="Subsidiary"
                value={subsidiaries.find(s => s.id === subFilter)?.name || ''}
                options={subsidiaries.map(s => s.name)}
                onChange={(val) => setSubFilter(subsidiaries.find(s => s.name === val)?.id || '')}
                placeholder="All Entities"
                icon={<Building2 size={12} />}
              />
            )}
            
            <div className="relative flex flex-col justify-end">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Access Level</label>
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-mine-green h-10 font-bold uppercase tracking-tight shadow-sm"
              >
                <option value="">All Roles</option>
                <option value="employee">Staff (General)</option>
                <option value="contractor">Contractors</option>
                <option value="admin">Site Admin</option>
              </select>
            </div>

            <SearchableSelect 
              label="Department"
              value={deptFilter}
              options={depts}
              onChange={setDeptFilter}
              placeholder="All Departments"
              icon={<Users size={12} />}
            />

            <SearchableSelect 
              label="Regional Branch"
              value={branchFilter}
              options={branches}
              onChange={setBranchFilter}
              placeholder="All Locations"
              icon={<MapPin size={12} />}
            />

            <div className="relative flex flex-col justify-end">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Operational Status</label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-mine-green h-10 font-bold uppercase tracking-tight shadow-sm"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </section>

          <AnimatePresence>
            {selectedEmps.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-mine-green p-4 mb-4 rounded-xl shadow-lg border border-white/20 flex flex-wrap items-center justify-between gap-4 text-white"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-white/30">
                    {selectedEmps.size} Selected
                  </div>
                  <p className="text-sm font-medium">Bulk Actions Personnel Node</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsBulkDeptOpen(true)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  >
                    <Users size={14} /> Assign Dept
                  </button>
                  <button 
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Deactivate
                  </button>
                  <button 
                    onClick={() => setSelectedEmps(new Set())}
                    className="p-2 hover:bg-white/10 rounded-full"
                  >
                    <X size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="card !p-0 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                      checked={filtered.length > 0 && selectedEmps.size === filtered.length}
                      onChange={toggleSelectAllEmps}
                    />
                  </th>
                  <th className="px-6 py-4">Personnel Info</th>
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Base Salary</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((emp) => (
                  <tr key={emp.uid} className={`hover:bg-gray-50/50 transition-colors group ${selectedEmps.has(emp.uid) ? 'bg-green-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                        checked={selectedEmps.has(emp.uid)}
                        onChange={() => toggleEmpSelection(emp.uid)}
                      />
                    </td>
                    <td className="px-6 py-4 cursor-pointer" onClick={() => fetchPii(emp)}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-mine-green/10 flex items-center justify-center font-bold text-mine-green text-xs border border-mine-green/20">
                          {emp.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm leading-tight">{emp.fullName}</p>
                          <p className="text-[10px] text-gray-500 font-mono italic">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight">{emp.jobTitle || 'Unassigned'}</p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">{emp.department}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{emp.branch || 'Remote/H.O.'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`badge border ${
                        emp.status === 'suspended' ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                        emp.status === 'terminated' ? 'bg-red-50 text-red-700 border-red-100' : 
                        'bg-green-50 text-green-700 border-green-100'
                      }`}>
                        {emp.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${emp.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-mine-green text-sm">
                      {emp.currency} {emp.baseSalary?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => fetchPii(emp)}
                          className="p-2 text-gray-400 hover:text-mine-gold hover:bg-gold-50 rounded-lg transition-all"
                          title="Secure PII Vault"
                        >
                          <ShieldCheck size={16} />
                        </button>
                        <button 
                          onClick={() => fetchPii(emp, 'banking')}
                          className="p-2 text-gray-400 hover:text-mine-green hover:bg-green-50 rounded-lg transition-all"
                          title="Financial Nexus"
                        >
                          <Wallet size={16} />
                        </button>
                        <button 
                          onClick={() => { setEditingEmp(emp); setForm({ fullName: emp.fullName, email: emp.email, role: emp.role, department: emp.department || '', jobTitle: emp.jobTitle || '', branch: emp.branch || '', subsidiaryId: emp.subsidiaryId || '', baseSalary: emp.baseSalary, currency: emp.currency, status: emp.status || 'active' }); setIsModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-mine-green hover:bg-green-50 rounded-lg transition-all"
                          title="Edit Profile"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => fetchReviews(emp)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Performance Reviews"
                        >
                          <ClipboardList size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.uid)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Offboard Staff"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <Pagination 
                currentPage={currentPage}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            )}
            {filtered.length === 0 && (
              <div className="p-12 text-center space-y-4">
                <p className="text-gray-400 italic text-sm">No matching personnel records found.</p>
                <button 
                  onClick={() => { setEditingEmp(null); setForm({ fullName: '', email: '', role: 'employee', department: '', jobTitle: '', branch: '', subsidiaryId: '', baseSalary: 1000, currency: 'USD', status: 'active' }); setIsModalOpen(true); }}
                  className="btn btn-primary mx-auto flex items-center gap-2"
                >
                  <Plus size={18} /> Add New Employee
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-50 p-4 px-6 border-b flex justify-between items-center">
                <h3 className="font-extrabold text-mine-green uppercase text-xs tracking-widest flex items-center gap-2">
                  <Users size={16} /> {editingEmp ? 'Update Record' : 'Site Recruitment'}
                </h3>
                <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                  <input required value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green" />
                </div>
                {!editingEmp && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</label>
                    <input required type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="employee@mineazy.com" className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</label>
                    <input value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Job Title</label>
                    <input value={form.jobTitle} onChange={(e) => setForm({...form, jobTitle: e.target.value})} className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Salary</label>
                    <input type="number" required value={form.baseSalary} onChange={(e) => setForm({...form, baseSalary: Number(e.target.value)})} className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Currency</label>
                    <select value={form.currency} onChange={(e) => setForm({...form, currency: e.target.value})} className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold">
                      <option value="USD">USD</option>
                      <option value="ZWG">ZWG</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Branch</label>
                  <input value={form.branch} onChange={(e) => setForm({...form, branch: e.target.value})} placeholder="e.g. Harare North, Bulawayo Hub" className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green" />
                </div>
                {isSuperAdmin && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assign Entity (Subsidiary)</label>
                    <select 
                      value={form.subsidiaryId} 
                      onChange={(e) => setForm({...form, subsidiaryId: e.target.value})} 
                      className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold"
                    >
                      <option value="">Global/Holding</option>
                      {subsidiaries.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</label>
                    <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})} className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold">
                      <option value="employee">Staff (General Access)</option>
                      <option value="admin">Site Admin (Privileged Access)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operational Status</label>
                    <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold">
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={processing} className="btn btn-primary w-full py-4 flex items-center justify-center gap-2 mt-2">
                  {processing ? <RefreshCw className="animate-spin text-white" size={18} /> : <ShieldCheck size={18} />}
                  {editingEmp ? 'Save Changes' : 'Save New Employee'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 px-8 py-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-mine-gold border border-white/20 font-black text-2xl italic">
                    {selectedUser.fullName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight leading-none mb-1">{selectedUser.fullName}</h2>
                    <p className="text-[10px] font-black uppercase tracking-[3px] text-mine-gold/80 flex items-center gap-2">
                      <ShieldCheck size={12} /> {selectedUser.jobTitle || selectedUser.role} • {selectedUser.department}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {activeDetailTab !== 'reviews' && (
                    <button 
                      onClick={() => {
                        if (isEditingPii) {
                          setIsEditingPii(false);
                          setIsVaultLocked(true);
                        } else {
                          setIsVerifyingAdmin(true);
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isEditingPii ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                      {isEditingPii ? <><X size={14} /> Cancel Editing</> : <><ShieldCheck size={14} className="text-mine-gold" /> Unlock Vault</>}
                    </button>
                  )}
                  <button 
                    onClick={() => { setSelectedUser(null); setIsEditingPii(false); setIsVaultLocked(true); setIsRecordingReview(false); }} 
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="bg-gray-50/50 border-b border-gray-100 px-8 flex gap-8 shrink-0">
                {[
                  { id: 'pii', label: 'Personal Matrix', icon: Fingerprint },
                  { id: 'banking', label: 'Financial Nexus', icon: Wallet },
                  { id: 'reviews', label: 'Performance Matrix', icon: ClipboardList }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDetailTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all relative ${
                      activeDetailTab === tab.id 
                        ? 'text-mine-green border-mine-green' 
                        : 'text-gray-400 border-transparent hover:text-gray-600'
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8">
                {fetchingPii || fetchingReviews ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <RefreshCw className="animate-spin text-mine-green opacity-20" size={64} />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono animate-pulse">Syncing Encrypted Data Node...</p>
                  </div>
                ) : activeDetailTab === 'pii' ? (
                  <div className="space-y-8 max-w-2xl mx-auto">
                    {isEditingPii ? (
                      <form onSubmit={handlePiiSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Phone</label>
                            <input 
                              value={piiForm.phone}
                              onChange={(e) => setPiiForm({...piiForm, phone: e.target.value})}
                              placeholder="+263..."
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm outline-none focus:ring-1 focus:ring-mine-green transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">National Identity Number</label>
                            <input 
                              value={piiForm.nationalId}
                              onChange={(e) => setPiiForm({...piiForm, nationalId: e.target.value})}
                              placeholder="00-000000X00"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-mono uppercase tracking-tighter"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Primary Residence Address</label>
                          <textarea 
                            value={piiForm.address}
                            onChange={(e) => setPiiForm({...piiForm, address: e.target.value})}
                            rows={3}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none focus:ring-1 focus:ring-mine-green leading-relaxed"
                          />
                        </div>

                        <div className="bg-red-50/30 p-8 rounded-2xl border border-red-100/50 space-y-6">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-[2px] flex items-center gap-2">
                              <AlertCircle size={14} /> Emergency Protocol established
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Full Name</label>
                              <input 
                                value={piiForm.emergencyContact}
                                onChange={(e) => setPiiForm({...piiForm, emergencyContact: e.target.value})}
                                className="w-full bg-white border border-red-100 rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-red-400"
                              />
                            </div>
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Relationship</label>
                              <input 
                                value={piiForm.emergencyRelation}
                                onChange={(e) => setPiiForm({...piiForm, emergencyRelation: e.target.value})}
                                placeholder="Next of Kin"
                                className="w-full bg-white border border-red-100 rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-red-400"
                              />
                            </div>
                            <div className="space-y-2 col-span-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Secure Line (Phone)</label>
                              <input 
                                value={piiForm.emergencyPhone}
                                onChange={(e) => setPiiForm({...piiForm, emergencyPhone: e.target.value})}
                                className="w-full bg-white border border-red-100 rounded-xl p-3 text-sm outline-none focus:ring-1 focus:ring-red-400 font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Medical Aid Registration Number</label>
                          <input 
                            value={piiForm.medicalAidNo}
                            onChange={(e) => setPiiForm({...piiForm, medicalAidNo: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-mono uppercase tracking-tighter"
                          />
                        </div>

                        <button 
                          type="submit" 
                          disabled={processing}
                          className="btn btn-primary w-full py-5 flex items-center justify-center gap-3 text-xs uppercase tracking-[2px]"
                        >
                          {processing ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                          Commit Changes to Secure Vault
                        </button>
                      </form>
                    ) : (
                      <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="grid grid-cols-2 gap-12 mb-12">
                          <div className="space-y-6">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Mail size={12} className="text-mine-green" /> Official Email Node</p>
                              <p className="text-sm font-semibold text-gray-900 border-l-2 border-mine-green pl-3 py-1 bg-gray-50/50">{selectedUser.email}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Phone size={12} className="text-mine-green" /> Direct Contact Line</p>
                              <p className="text-sm font-semibold text-gray-900 border-l-2 border-mine-green pl-3 py-1 bg-gray-50/50">{userPii?.phone || 'Not Logged'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><RefreshCw size={12} className="text-mine-green" /> Registration Timestamp</p>
                              <p className="text-sm font-semibold text-gray-900 border-l-2 border-mine-green pl-3 py-1 bg-gray-50/50 font-mono uppercase">
                                {selectedUser.createdAt?.toDate()?.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) || 'Historical Record'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-6">
                             <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={12} className="text-mine-green" /> Deployment Base (Address)</p>
                              <p className="text-sm font-semibold text-gray-900 leading-relaxed border-l-2 border-mine-green pl-3 py-1 bg-gray-50/50">{userPii?.address || 'Restricted Access'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Fingerprint size={12} className="text-mine-green" /> National Identity</p>
                              <p className="text-sm font-semibold text-gray-900 font-mono tracking-tighter border-l-2 border-mine-green pl-3 py-1 bg-gray-50/50 uppercase">{userPii?.nationalId || 'PENDING VERIFICATION'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={12} className="text-mine-green" /> Medical Aid Node</p>
                              <p className="text-sm font-semibold text-gray-900 font-mono tracking-tighter border-l-2 border-mine-green pl-3 py-1 bg-gray-50/50 uppercase">{userPii?.medicalAidNo || '---'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-red-50/50 rounded-2xl p-8 border border-red-100 flex items-start gap-6 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <AlertCircle size={120} />
                          </div>
                          <div className="p-4 bg-red-100/50 rounded-xl text-red-600 shadow-sm"><AlertCircle size={28} /></div>
                          <div className="space-y-4 relative z-10 flex-1">
                            <div>
                              <p className="text-[10px] font-black text-red-600 uppercase tracking-[3px] mb-1">Emergency Protocol Nexus</p>
                              <p className="text-xs text-gray-400 italic">Established contingency contacts for immediate operational safety.</p>
                            </div>
                            {userPii?.emergencyContact ? (
                              <div className="grid grid-cols-2 gap-8">
                                <div>
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Primary Contact</p>
                                  <p className="text-lg font-bold text-gray-900">{userPii.emergencyContact}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Relationship</p>
                                  <p className="text-xs font-black text-red-600 uppercase tracking-widest bg-red-100/50 px-2 py-0.5 rounded inline-block">{userPii.emergencyRelation}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Secure Line</p>
                                  <p className="text-xl font-mono font-black text-slate-800 tracking-tight">{userPii.emergencyPhone}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="py-4 border-2 border-dashed border-red-100 rounded-xl text-center">
                                <p className="text-sm text-red-400 italic font-medium">No emergency protocols established in current node.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeDetailTab === 'banking' ? (
                  <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                           <Wallet className="text-mine-green" size={20} /> Financial Disbursement Credentials
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Personnel payroll routing and banking node configuration.</p>
                      </div>
                      {!isEditingPii && (
                        <button 
                          onClick={() => setIsVerifyingAdmin(true)}
                          className="text-[10px] font-black text-mine-green uppercase tracking-widest hover:underline"
                        >
                          Modify Node
                        </button>
                      )}
                    </div>

                    {isEditingPii ? (
                      <form onSubmit={handlePiiSubmit} className="space-y-8">
                         <div className="bg-blue-50/30 p-8 rounded-2xl border border-blue-100/50 space-y-8">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                            <Wallet size={14} /> Financial Authorization required
                          </p>
                          <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Banking Institution Name</label>
                              <input 
                                value={piiForm.bankName}
                                onChange={(e) => setPiiForm({...piiForm, bankName: e.target.value})}
                                className="w-full bg-white border border-blue-100 rounded-xl p-3.5 text-sm outline-none focus:ring-1 focus:ring-blue-400 transition-all font-bold"
                              />
                            </div>
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Institution Branch Code</label>
                              <input 
                                value={piiForm.branchCode}
                                onChange={(e) => setPiiForm({...piiForm, branchCode: e.target.value})}
                                className="w-full bg-white border border-blue-100 rounded-xl p-3.5 text-sm outline-none focus:ring-1 focus:ring-blue-400 font-mono tracking-widest"
                              />
                            </div>
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Disbursement Account Number</label>
                              <input 
                                value={piiForm.accountNumber}
                                onChange={(e) => setPiiForm({...piiForm, accountNumber: e.target.value})}
                                className="w-full bg-white border border-blue-100 rounded-xl p-3.5 text-sm outline-none focus:ring-1 focus:ring-blue-400 font-mono font-black"
                              />
                            </div>
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Legally Registered Account Name</label>
                              <input 
                                value={piiForm.accountName}
                                onChange={(e) => setPiiForm({...piiForm, accountName: e.target.value})}
                                className="w-full bg-white border border-blue-100 rounded-xl p-3.5 text-sm outline-none focus:ring-1 focus:ring-blue-400 font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        <button 
                          type="submit" 
                          disabled={processing}
                          className="btn btn-primary w-full py-5 flex items-center justify-center gap-3 text-xs uppercase tracking-[2px]"
                        >
                          {processing ? <RefreshCw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                          Commit Financial Routing Change
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-slate-900 rounded-3xl p-10 text-white relative overflow-hidden shadow-2xl border border-slate-800 group">
                          {/* Decorative Elements */}
                          <div className="absolute -top-24 -right-24 w-64 h-64 bg-mine-gold/10 rounded-full blur-3xl group-hover:bg-mine-gold/20 transition-all duration-700"></div>
                          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-mine-green/5 rounded-full blur-3xl"></div>
                          
                          <div className="relative z-10 space-y-12">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-mine-gold uppercase tracking-[4px]">Financial Node Authorized</p>
                                <h4 className="text-3xl font-black italic tracking-tighter serif">{userPii?.bankName || '---'}</h4>
                              </div>
                              <div className="w-16 h-10 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                                <Wallet className="text-mine-gold/40" size={24} />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest opacity-60">Disbursement Account Link</p>
                              <p className="text-4xl font-mono font-black tracking-tight flex items-center gap-4">
                                {userPii?.accountNumber ? (
                                  <>
                                    {userPii.accountNumber.match(/.{1,4}/g)?.join(' ')}
                                  </>
                                ) : '0000 0000 0000 0000'}
                              </p>
                            </div>

                            <div className="flex justify-between items-end">
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest opacity-60">Account Holder</p>
                                <p className="text-sm font-black uppercase tracking-widest">{userPii?.accountName || selectedUser.fullName}</p>
                              </div>
                              <div className="text-right space-y-1">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest opacity-60">Sort/Branch Node</p>
                                <p className="text-sm font-mono font-black">{userPii?.branchCode || '---'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {!userPii?.bankName && (
                          <div className="py-12 border-2 border-dashed border-gray-100 rounded-3xl text-center space-y-4">
                             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                                <Wallet size={32} />
                             </div>
                             <p className="text-sm text-gray-400 font-medium italic">No financial disbursement route detected for this personnel node.</p>
                             <button onClick={() => setIsEditingPii(true)} className="btn btn-outline text-xs !px-6">Initialize Routing</button>
                          </div>
                        )}
                        
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-mine-green shadow-sm"><ShieldCheck size={20} /></div>
                           <div>
                              <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-0.5">Disbursement Security</p>
                              <p className="text-[10px] text-gray-500 leading-tight">All banking credentials are encrypted and stored in an isolated financial vault node. Modifications are logged and audited.</p>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    {!isRecordingReview ? (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                               <Target className="text-mine-green" size={20} /> Performance Evaluation Matrix
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">Personnel operational efficiency and developmental roadmap.</p>
                          </div>
                          <button 
                            onClick={() => setIsRecordingReview(true)}
                            className="btn btn-primary !py-2.5 !px-6 !text-[10px] flex items-center gap-2 uppercase tracking-widest"
                          >
                            <Plus size={14} /> Initialize Evaluation
                          </button>
                        </div>

                        {fetchingReviews ? (
                          <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <RefreshCw className="animate-spin text-mine-green opacity-20" size={48} />
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Querying Review Node...</p>
                          </div>
                        ) : reviews.length === 0 ? (
                          <div className="text-center py-24 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100 space-y-6 max-w-lg mx-auto">
                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto text-gray-200 shadow-sm border border-gray-100 rotate-12">
                              <ClipboardList size={40} />
                            </div>
                            <div>
                               <p className="text-base font-bold text-gray-900">No Historical Data</p>
                               <p className="text-sm text-gray-400 italic">No formal performance evaluations have been logged for this personnel node.</p>
                            </div>
                            <button onClick={() => setIsRecordingReview(true)} className="btn btn-outline text-xs !px-10">Conduct First Review</button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {reviews.map((rev) => (
                              <div key={rev.id} className="bg-white border rounded-3xl p-8 hover:shadow-xl transition-all group border-gray-100 relative overflow-hidden flex flex-col">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 -mr-12 -mt-12 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                                <div className="flex justify-between items-start mb-8 relative z-10">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-mine-green group-hover:text-white transition-colors border border-gray-100">
                                      <Calendar size={22} />
                                    </div>
                                    <div>
                                      <p className="text-base font-black text-gray-900 italic serif">{new Date(rev.reviewDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                         {[...Array(5)].map((_, i) => (
                                           <div key={i} className={`w-2 h-2 rounded-full ${i < rev.overallRating ? 'bg-mine-gold' : 'bg-gray-100'}`}></div>
                                         ))}
                                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{rev.overallRating}.0 / 5.0</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                                      rev.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : 
                                      rev.status === 'conducted' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'
                                    }`}>
                                      {rev.status}
                                    </span>
                                    {rev.status === 'completed' && (
                                      <button 
                                        onClick={() => downloadReviewPDF(rev)}
                                        className="flex items-center gap-1 text-[10px] font-black text-mine-green uppercase tracking-widest hover:underline"
                                      >
                                        <FileDown size={12} /> Audit PDF
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="space-y-6 flex-1 relative z-10">
                                  <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[3px] mb-2 flex items-center gap-1.5"><MessageSquare size={10} className="text-mine-green" /> Feedback Log</p>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium bg-gray-50/50 p-4 rounded-xl italic">{rev.feedback || 'No transcript record detected.'}</p>
                                  </div>
                                  {rev.goals && (
                                    <div className="bg-mine-green/5 p-5 rounded-2xl border border-mine-green/10">
                                      <p className="text-[9px] font-black text-mine-green uppercase tracking-[3px] mb-2 flex items-center gap-1.5">
                                        <Target size={12} /> Strategic Objectives
                                      </p>
                                      <p className="text-xs text-slate-800 font-bold leading-relaxed">{rev.goals}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-mine-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-mine-green/20"><Plus size={24} /></div>
                              <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-none">New Personnel Evaluation</h3>
                                <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black">Performance Capture Matrix</p>
                              </div>
                           </div>
                           <button 
                            type="button" 
                            onClick={() => setIsRecordingReview(false)}
                            className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors border-b-2 border-transparent hover:border-red-500"
                           >
                            Abort Process
                           </button>
                        </div>

                        <form onSubmit={handleReviewSubmit} className="space-y-10 pb-8">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Evaluation Date</label>
                              <input 
                                type="date"
                                required
                                value={reviewForm.reviewDate}
                                onChange={(e) => setReviewForm({...reviewForm, reviewDate: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-1 focus:ring-mine-green transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rating Tier (1-5)</label>
                              <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-2 flex items-center gap-6 px-6 h-[52px]">
                                <span className="text-lg font-black text-mine-green font-mono">{reviewForm.overallRating}.0</span>
                                <input 
                                  type="range" 
                                  min="1" 
                                  max="5" 
                                  step="1"
                                  value={reviewForm.overallRating}
                                  onChange={(e) => setReviewForm({...reviewForm, overallRating: parseInt(e.target.value)})}
                                  className="flex-1 accent-mine-green h-2 rounded-full cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cycle Start</label>
                              <input 
                                type="date"
                                value={reviewForm.periodStart}
                                onChange={(e) => setReviewForm({...reviewForm, periodStart: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-1 focus:ring-mine-green transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cycle End</label>
                              <input 
                                type="date"
                                value={reviewForm.periodEnd}
                                onChange={(e) => setReviewForm({...reviewForm, periodEnd: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm focus:ring-1 focus:ring-mine-green transition-all"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                               <span>Detailed Operational Transcript</span>
                               <span className="text-gray-300 italic font-medium normal-case">Operational Narrative</span>
                            </label>
                            <textarea 
                              required
                              rows={5}
                              value={reviewForm.feedback}
                              onChange={(e) => setReviewForm({...reviewForm, feedback: e.target.value})}
                              placeholder="Detail the personnel's operational efficiency, safety index, and cultural alignment..."
                              className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-6 text-sm focus:ring-1 focus:ring-mine-green leading-relaxed"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between">
                               <span>Strategic Developmental Objectives</span>
                               <span className="text-gray-300 italic font-medium normal-case">Future Roadmap</span>
                            </label>
                            <textarea 
                              rows={3}
                              value={reviewForm.goals}
                              onChange={(e) => setReviewForm({...reviewForm, goals: e.target.value})}
                              placeholder="Define critical KPIs, certification requirements, or leadership evolution goals..."
                              className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-6 text-sm focus:ring-1 focus:ring-mine-green"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Disbursement Status</label>
                                <select 
                                  value={reviewForm.status}
                                  onChange={(e) => setReviewForm({...reviewForm, status: e.target.value as any})}
                                  className="w-full bg-gray-900 border border-slate-700 rounded-xl p-4 text-sm font-black text-white uppercase tracking-widest focus:ring-1 focus:ring-mine-gold"
                                >
                                  <option value="scheduled">Scheduled Evaluation</option>
                                  <option value="conducted">Evaluation Conducted</option>
                                  <option value="completed">Matrix Finalized / Signed</option>
                                </select>
                             </div>
                             <div className="flex items-end">
                                <button 
                                  type="submit" 
                                  disabled={processing}
                                  className="btn btn-primary w-full py-[18px] flex items-center justify-center gap-3 text-xs uppercase tracking-[3px] shadow-xl shadow-mine-green/20"
                                >
                                  {processing ? <RefreshCw className="animate-spin text-white" size={20} /> : <ShieldCheck size={20} />}
                                  Commit Matrix Node
                                </button>
                             </div>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="bg-gray-50/80 p-4 border-t border-gray-100 flex justify-between items-center px-10 text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono italic">
                <div className="flex items-center gap-6">
                   <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-mine-green" /> E2E Vault Protection Active</span>
                   <span className="text-gray-300">|</span>
                   <span>UID: {selectedUser.uid.substring(0, 8)}...</span>
                </div>
                <div className="flex items-center gap-2">
                   <span>Node: {profile?.fullName || user?.email}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkDeptOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-50 p-4 px-6 border-b flex justify-between items-center">
                <h3 className="font-extrabold text-mine-green uppercase text-[10px] tracking-widest flex items-center gap-2">
                  <Users size={16} /> Bulk Department Assignment
                </h3>
                <button onClick={() => setIsBulkDeptOpen(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleBulkAssignDept} className="p-6 space-y-4">
                <p className="text-xs text-gray-500">Update department for {selectedEmps.size} selected personnel.</p>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Department</label>
                  <input 
                    required 
                    value={bulkDept} 
                    onChange={(e) => setBulkDept(e.target.value)} 
                    placeholder="e.g. Operations, Mining, Safety"
                    className="w-full bg-gray-50 border rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green" 
                  />
                </div>
                <button type="submit" disabled={processing} className="btn btn-primary w-full py-3 flex items-center justify-center gap-2">
                  {processing ? <RefreshCw className="animate-spin text-white" size={18} /> : <ShieldCheck size={18} />}
                  Confirm Bulk Assignment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVerifyingAdmin && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="bg-slate-900 p-8 text-white text-center">
                <div className="w-16 h-16 bg-mine-gold/20 rounded-2xl flex items-center justify-center text-mine-gold mx-auto mb-4 border border-mine-gold/30">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Admin Authorization</h3>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2 font-black">Identity Verification Required</p>
              </div>
              <form onSubmit={handleUnlockVault} className="p-8 space-y-6">
                <p className="text-xs text-gray-500 leading-relaxed text-center">
                  You are attempting to access or modify sensitive <span className="text-gray-900 font-bold">Personnel PII/Financial Vault</span>. Please confirm your administrator email to proceed.
                </p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Confirmatory Email</label>
                  <input 
                    autoFocus
                    required 
                    type="email"
                    value={authEmail} 
                    onChange={(e) => setAuthEmail(e.target.value)} 
                    placeholder="Enter your email to authorize"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm outline-none focus:ring-1 focus:ring-mine-green" 
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => { setIsVerifyingAdmin(false); setAuthEmail(''); }}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-4 bg-mine-green text-white rounded-xl shadow-lg shadow-mine-green/20 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    Authorize Access
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default EmployeeManagement;
