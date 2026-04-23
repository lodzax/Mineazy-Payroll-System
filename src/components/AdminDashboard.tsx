import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp, where, getDoc, query, writeBatch, runTransaction } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Calculator, 
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  Warehouse,
  AlertTriangle,
  FileDown,
  FileUp
} from 'lucide-react';
import { calculatePaye, calculateNssa, USD_TAX_BANDS, ZWG_TAX_BANDS } from '../lib/payrollUtils';
import TaxCalculator from './TaxCalculator';
import PayrollReports from './PayrollReports';
import AuditTrail from './AuditTrail';
import { useAuth } from '../lib/AuthContext';
import { logAction } from '../services/loggerService';
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-app-bg bg-gray-50/50">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1 rounded bg-white border border-gray-200 text-gray-500 disabled:opacity-50 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1 rounded bg-white border border-gray-200 text-gray-500 disabled:opacity-50 hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { user, profile, isSuperAdmin } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loanRequests, setLoanRequests] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [subFilter, setSubFilter] = useState('');
  const [payrollStatus, setPayrollStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isBatchFinalized, setIsBatchFinalized] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'draft' | 'final', monthDisplay: string } | null>(null);
  const [selectedTimesheets, setSelectedTimesheets] = useState<Set<string>>(new Set());
  const [selectedLeaveRequests, setSelectedLeaveRequests] = useState<Set<string>>(new Set());
  
  // Pagination states
  const [timesheetPage, setTimesheetPage] = useState(1);
  const [loanPage, setLoanPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const PAGE_SIZE = 5;

  const fetchData = async () => {
    setLoading(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const specificSubId = subFilter || profile?.subsidiaryId;
      const batchIds = ['all-month', `${specificSubId}-${month}`];
      
      const batchDocs = await Promise.all([
        getDoc(doc(db, 'payroll_batches', `all-${month}`)),
        specificSubId ? getDoc(doc(db, 'payroll_batches', `${specificSubId}-${month}`)) : Promise.resolve(null)
      ]);

      const finalized = batchDocs.some(d => d && d.exists() && d.data()?.status === 'finalized');
      setIsBatchFinalized(finalized);

      const usersQuery = isSuperAdmin 
        ? collection(db, 'users') 
        : query(collection(db, 'users'), where('subsidiaryId', '==', profile?.subsidiaryId || 'none'));
      
      const [empSnap, subSnap] = await Promise.all([
        getDocs(usersQuery),
        isSuperAdmin ? getDocs(collection(db, 'subsidiaries')) : Promise.resolve({ docs: [] } as any)
      ]);

      let allEmps: any[] = empSnap.docs.map(d => ({ ...d.data() as any, uid: d.id }));
      const allSubs: any[] = subSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      // Filter employees by subsidiary
      if (!isSuperAdmin && profile?.subsidiaryId) {
        allEmps = allEmps.filter((e: any) => e.subsidiaryId === profile.subsidiaryId);
      } else if (isSuperAdmin && subFilter) {
        allEmps = allEmps.filter((e: any) => e.subsidiaryId === subFilter);
      }

      setEmployees(allEmps);
      setSubsidiaries(allSubs);

      // Fetch pending requests
      const getContextQuery = (coll: string) => {
        let base = query(collection(db, coll), where('status', 'in', ['pending', 'submitted']));
        if (!isSuperAdmin && profile?.subsidiaryId) {
          base = query(base, where('subsidiaryId', '==', profile.subsidiaryId));
        }
        return base;
      };

      const [timeSnap, loanSnap, leaveSnap] = await Promise.all([
        getDocs(getContextQuery('timesheets')),
        getDocs(getContextQuery('loan_applications')),
        getDocs(getContextQuery('leave_applications'))
      ]);

      // Map requests and cross-reference with filtered employees
      const filteredEmpIds = new Set(allEmps.map(e => e.uid));
      
      setTimesheets(timeSnap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter((t: any) => filteredEmpIds.has(t.employeeId))
      );
      setLoanRequests(loanSnap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter((l: any) => filteredEmpIds.has(l.employeeId))
      );
      setLeaveRequests(leaveSnap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter((lv: any) => filteredEmpIds.has(lv.employeeId))
      );
    } catch (err) {
      console.error("Fetch failed:", err);
      handleFirestoreError(err, 'list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [subFilter]);

  const calculateLeaveDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // Inclusive
  };

  const handleStatusUpdate = async (collectionName: string, id: string, status: string) => {
    setProcessing(true);
    try {
      const docRef = doc(db, collectionName, id);
      
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(docRef);
        if (!snapshot.exists()) {
          throw new Error("Target record not found in node.");
        }
        const data = snapshot.data();

        // Atomic Deduction: If approving annual leave which wasn't already approved
        if (collectionName === 'leave_applications' && status === 'approved' && data?.status !== 'approved' && data?.type === 'annual') {
          const empRef = doc(db, 'users', data.employeeId);
          const empSnap = await transaction.get(empRef);
          
          if (!empSnap.exists()) {
            throw new Error("Personnel profile missing from ledger.");
          }
          
          const empData = empSnap.data();
          const currentBalance = empData?.annualLeaveBalance || 0;
          const leaveDays = calculateLeaveDays(data.startDate, data.endDate);
          
          transaction.update(empRef, {
            annualLeaveBalance: currentBalance - leaveDays,
            lastActivity: serverTimestamp()
          });
        }

        transaction.update(docRef, { 
          status,
          reviewedAt: serverTimestamp(),
          reviewedBy: user?.email
        });
      });

      await logAction({
        action: 'Status Update',
        category: 'personnel',
        details: `Updated ${collectionName} status for node ${id} to ${status}.`,
        entityId: id,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });

      fetchData();
    } catch (err) {
      console.error("Transactional clear failed:", err);
      handleFirestoreError(err, 'update');
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelection = (id: string, selectionSet: Set<string>, selectionSetter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const next = new Set(selectionSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectionSetter(next);
  };

  const toggleSelectAll = (items: any[], selectionSet: Set<string>, selectionSetter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    if (selectionSet.size === items.length) {
      selectionSetter(new Set());
    } else {
      selectionSetter(new Set(items.map(t => t.id)));
    }
  };

  const handleBulkStatusUpdate = async (collectionName: string, selectionSet: Set<string>, selectionSetter: React.Dispatch<React.SetStateAction<Set<string>>>, status: string) => {
    if (selectionSet.size === 0) return;
    setProcessing(true);
    try {
      // Process one by one to ensure side effects like leave deduction trigger
      for (const id of Array.from(selectionSet)) {
        await handleStatusUpdate(collectionName, id, status);
      }
      selectionSetter(new Set());
      fetchData();
    } catch (err) {
      handleFirestoreError(err, 'update');
    } finally {
      setProcessing(false);
    }
  };

  const initiateGeneratePayroll = () => {
    const displayMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    setConfirmAction({ type: 'draft', monthDisplay: displayMonth });
  };

  const initiateFinalizePayroll = () => {
    const displayMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    setConfirmAction({ type: 'final', monthDisplay: displayMonth });
  };

  const generatePayrollForAll = async () => {
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    const displayMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    setConfirmAction(null);
    setProcessing(true);
    setPayrollStatus({ type: 'info', message: `Initializing batch payroll for ${displayMonth}...` });
    
    try {
      // 1. Check for existing payslips to avoid duplicates
      const existingSnap = await getDocs(query(collection(db, 'payslips'), where('month', '==', month)));
      const existingUserIds = new Set(existingSnap.docs.map(d => d.data().employeeId));

      const eligibleEmployees = employees.filter(emp => !existingUserIds.has(emp.uid));
      
      if (eligibleEmployees.length === 0) {
        setPayrollStatus({ type: 'info', message: 'All active personnel nodes have existing payslips for this period.' });
        setProcessing(false);
        return;
      }

      // 2. Fetch all required data for eligible employees
      const [approvedTimesheets, approvedLoans] = await Promise.all([
        getDocs(query(collection(db, 'timesheets'), where('month', '==', month), where('status', '==', 'approved'))),
        getDocs(query(collection(db, 'loan_applications'), where('status', '==', 'approved')))
      ]);

      let count = 0;
      for (const emp of eligibleEmployees) {
        const empTimesheets = approvedTimesheets.docs.filter(d => d.data().employeeId === emp.uid);
        
        // Sum hours from all approved timesheets for this month
        const standardHours = empTimesheets.reduce((acc, curr: any) => acc + (curr.data().hoursWorked || 0), 0);
        const overtimeHours = empTimesheets.reduce((acc, curr: any) => acc + (curr.data().overtimeHours || 0), 0);
        
        // Basic calculations
        const hourlyRate = (emp.baseSalary || 0) / 160;
        const overtimePay = overtimeHours * (hourlyRate * 1.5);
        const basePay = emp.baseSalary || 0;
        const totalGross = basePay + overtimePay;

        if (totalGross === 0 && empTimesheets.length === 0) continue;

        // Taxes & Statutory deductions
        const bands = emp.currency === 'ZWG' ? ZWG_TAX_BANDS : USD_TAX_BANDS;
        const { tax, aidsLevy } = calculatePaye(totalGross, bands);
        const nssa = calculateNssa(totalGross, emp.currency as 'USD' | 'ZWG');
        
        // Loan deductions: Calculate with interest awareness
        const empLoans = approvedLoans.docs.filter(d => d.data().employeeId === emp.uid);
        const loanDeduction = empLoans.reduce((acc, curr: any) => {
          const lData = curr.data();
          const principal = lData.amount;
          const rate = (lData.interestRate || 0) / 100;
          const term = lData.installmentCount || 1;
          const totalRepayable = principal + (principal * rate * term);
          return acc + (totalRepayable / term);
        }, 0);

        const totalDeductions = tax + aidsLevy + nssa + loanDeduction;
        const netPay = totalGross - totalDeductions;

        // Leave Accrual: Earn 2.5 days per month
        const newBalance = (emp.annualLeaveBalance || 0) + 2.5;

        await Promise.all([
          addDoc(collection(db, 'payslips'), {
            employeeId: emp.uid,
            subsidiaryId: emp.subsidiaryId || '',
            month,
            monthDisplay: displayMonth,
            baseSalary: basePay,
            overtimePay,
            standardHours,
            overtimeHours,
            grossPay: totalGross,
            taxAmount: tax,
            aidsLevy,
            nssaDeduction: nssa,
            loanDeductions: loanDeduction,
            totalDeductions,
            netPay,
            currency: emp.currency || 'USD',
            leaveBalance: newBalance,
            isPublished: false,
            generatedAt: serverTimestamp(),
            breakdown: {
              hourlyRate: hourlyRate.toFixed(2),
              overtimeRate: (hourlyRate * 1.5).toFixed(2),
              nssaRate: emp.currency === 'ZWG' ? '4.5%' : '4.5% (ZWG Base)',
              loanCount: empLoans.length
            },
            metadata: {
              processId: `batch-${Date.now()}`,
              v: '2.1'
            }
          }),
          // Update user's cumulative balance
          updateDoc(doc(db, 'users', emp.uid), {
            annualLeaveBalance: newBalance
          })
        ]);
        count++;
      }
      
      if (count > 0) {
        await logAction({
          action: 'Payroll Run Initiation',
          category: 'payroll',
          details: `Generated ${count} payslips for period ${displayMonth}. Subsidiary: ${subFilter || 'All'}.`,
          userName: profile?.fullName || user?.displayName,
          userEmail: user?.email
        });
        setPayrollStatus({ type: 'success', message: `Vault update complete: ${count} payslips generated successfully. Review data before final publication.` });
      } else {
        setPayrollStatus({ type: 'info', message: 'No eligible records found for processing.' });
      }
      fetchData();
    } catch (err) {
      setPayrollStatus({ type: 'error', message: 'Payroll generation failed. Check node logs.' });
      handleFirestoreError(err, 'write');
    } finally {
      setProcessing(false);
      // Clear status after 10 seconds
      setTimeout(() => setPayrollStatus(null), 10000);
    }
  };

  const finalizePayroll = async () => {
    setConfirmAction(null);
    setProcessing(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const subId = subFilter || profile?.subsidiaryId || 'all';
      const batchId = `${subId}-${month}`;

      const batch = writeBatch(db);

      // 1. Create/Update Batch Status
      batch.set(doc(db, 'payroll_batches', batchId), {
        subsidiaryId: subId,
        month,
        status: 'finalized',
        finalizedAt: serverTimestamp(),
        finalizedBy: user?.email
      });

      // 2. Publish all draft payslips for this period/subsidiary
      let payslipQuery;
      if (subId === 'all' && isSuperAdmin) {
        payslipQuery = query(
          collection(db, 'payslips'),
          where('month', '==', month),
          where('isPublished', '==', false)
        );
      } else {
        payslipQuery = query(
          collection(db, 'payslips'),
          where('month', '==', month),
          where('subsidiaryId', '==', subId),
          where('isPublished', '==', false)
        );
      }
      
      const snap = await getDocs(payslipQuery);
      
      snap.docs.forEach(d => {
        batch.update(d.ref, { isPublished: true });
      });

      await batch.commit();

      await logAction({
        action: 'Payroll Finalization',
        category: 'payroll',
        details: `Finalized and published ${snap.size} payslips for period ${month}. Subsidiary: ${subId}.`,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });

      setPayrollStatus({ type: 'success', message: `Payroll successfully Finalized & Published (${snap.size} records updated).` });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, 'write');
      setPayrollStatus({ type: 'error', message: 'Finalization failed. Internal sync error.' });
    } finally {
      setProcessing(false);
    }
  };

  const exportPayrollToExcel = async () => {
    setProcessing(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const subId = subFilter || profile?.subsidiaryId || 'all';
      
      let q;
      if (subId === 'all' && isSuperAdmin) {
        q = query(
          collection(db, 'payslips'),
          where('month', '==', month),
          where('isPublished', '==', false)
        );
      } else {
        q = query(
          collection(db, 'payslips'),
          where('month', '==', month),
          where('subsidiaryId', '==', subId),
          where('isPublished', '==', false)
        );
      }
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => {
        const d = doc.data() as any;
        return {
          ID: doc.id,
          Employee: d.fullName,
          Month: d.month,
          'Base Salary': d.baseSalary,
          'Hours Worked': d.standardHours,
          'Overtime Hours': d.overtimeHours,
          'Overtime Pay': d.overtimePay,
          'Gross Pay': d.grossPay,
          'Tax Amount': d.taxAmount,
          'AIDS Levy': d.aidsLevy,
          'NSSA Deduction': d.nssaDeduction,
          'Loan Deductions': d.loanDeductions,
          'Net Pay': d.netPay,
          Currency: d.currency
        };
      });

      if (data.length === 0) {
        setPayrollStatus({ type: 'info', message: 'No draft payslips found for export.' });
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Draft Payroll");
      XLSX.writeFile(workbook, `Draft_Payroll_${subId}_${month}.xlsx`);
      
      setPayrollStatus({ type: 'success', message: 'Draft payroll exported successfully.' });
    } catch (err) {
      console.error(err);
      setPayrollStatus({ type: 'error', message: 'Export failed.' });
    } finally {
      setProcessing(false);
    }
  };

  const importPayrollFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      await logAction({
        action: 'Batch Import Initiation',
        category: 'financial',
        details: `Importing payroll updates from Excel (${file.name}). Pending updates: ${jsonData.length}.`,
        userName: profile?.fullName || user?.displayName,
        userEmail: user?.email
      });

      const batch = writeBatch(db);
      let updateCount = 0;

      for (const row of jsonData) {
        if (row.ID) {
          const payslipRef = doc(db, 'payslips', row.ID);
          batch.update(payslipRef, {
            baseSalary: Number(row['Base Salary']),
            standardHours: Number(row['Hours Worked']),
            overtimeHours: Number(row['Overtime Hours']),
            overtimePay: Number(row['Overtime Pay']),
            grossPay: Number(row['Gross Pay']),
            taxAmount: Number(row['Tax Amount']),
            aidsLevy: Number(row['AIDS Levy']),
            nssaDeduction: Number(row['NSSA Deduction']),
            loanDeductions: Number(row['Loan Deductions']),
            netPay: Number(row['Net Pay']),
            updatedAt: serverTimestamp()
          });
          updateCount++;
        }
      }

      await batch.commit();
      setPayrollStatus({ type: 'success', message: `Successfully updated ${updateCount} payslips from Excel.` });
      fetchData();
    } catch (err) {
      console.error(err);
      setPayrollStatus({ type: 'error', message: 'Import failed. Check file format.' });
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-mono text-xs uppercase tracking-widest animate-pulse">Establishing Secure Node Link...</div>;

  const totalEmployees = employees.length;
  // If super admin, branches might be subsidiaries. If regular admin, it's branches within their scope.
  const uniqueBranches = isSuperAdmin 
    ? subsidiaries.length || new Set(employees.map(e => e.branch)).size
    : new Set(employees.map(e => e.branch)).size;

  return (
    <div className="flex flex-col gap-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-mine-green/10 rounded-lg text-mine-green">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Personnel</p>
            <p className="text-xl font-black text-gray-900 font-mono">{totalEmployees}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <Warehouse size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operational Nodes</p>
            <p className="text-xl font-black text-gray-900 font-mono">{uniqueBranches}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Nodes</p>
            <p className="text-xl font-black text-gray-900 font-mono">{timesheets.length + leaveRequests.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-mine-gold/10 rounded-lg text-mine-gold">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Super Global status</p>
            <p className="text-xl font-black text-gray-900 font-mono italic serif">{isSuperAdmin ? 'ACTIVE' : 'RESTRICTED'}</p>
          </div>
        </div>
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-mine-green flex items-center gap-2 uppercase tracking-tight">
            <ShieldCheck size={20} /> Payroll Control Center
          </h1>
          <p className="text-xs text-gray-500 font-medium">Monitoring and processing Mineazy solution operations</p>
        </div>
        <div className="flex flex-col md:flex-row items-end gap-3">
          {isSuperAdmin && (
            <div className="flex flex-col items-end">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Active Entity</label>
              <select 
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-green min-w-[200px]"
              >
                <option value="">All Subsidiaries</option>
                {subsidiaries.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col items-end gap-2">
            {!isBatchFinalized ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={initiateGeneratePayroll}
                    disabled={processing}
                    className="btn btn-outline !text-sm !py-3 !px-8 flex items-center gap-2 group transition-all border-mine-green text-mine-green hover:bg-mine-green hover:text-white"
                  >
                    {processing ? <RefreshCw className="animate-spin" size={18} /> : <Calculator className="group-hover:rotate-12 transition-transform" size={18} />}
                    Run Draft Payroll
                  </button>
                  <button 
                    onClick={initiateFinalizePayroll}
                    disabled={processing}
                    className="btn btn-primary !text-sm !py-3 !px-8 flex items-center gap-2 group transition-all"
                  >
                    {processing ? <RefreshCw className="animate-spin" size={18} /> : <ShieldCheck className="group-hover:scale-110 transition-transform" size={18} />}
                    Finalize & Publish
                  </button>
                </div>
                <div className="flex gap-2 justify-end">
                   <button 
                    onClick={exportPayrollToExcel}
                    disabled={processing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-600/30 hover:bg-green-50 transition-all text-[9px] font-black uppercase tracking-widest"
                  >
                    <FileDown size={14} />
                    Export Draft XLS
                  </button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={importPayrollFromExcel}
                      className="hidden"
                      id="excel-payroll-import"
                      disabled={processing}
                    />
                    <label
                      htmlFor="excel-payroll-import"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-all text-[9px] font-black uppercase tracking-widest cursor-pointer ${processing ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <FileUp size={14} />
                      Import Updates
                    </label>
                  </div>
                </div>
              </div>
            ) : (
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-green-50 border border-green-200 px-8 py-3 rounded-xl flex items-center gap-3 text-green-700">
                    <ShieldCheck size={20} className="text-green-600" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">Payroll Status: Finalized</p>
                      <p className="text-[10px] opacity-70">The vault is locked for this period. Updates disabled.</p>
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <button 
                      onClick={initiateFinalizePayroll}
                      disabled={processing}
                      className="text-[9px] font-black uppercase text-mine-green hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={10} className={processing ? 'animate-spin' : ''} />
                      Force Publication Sync
                    </button>
                  )}
                </div>
            )}
            <AnimatePresence>
            {payrollStatus && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`text-[10px] font-bold px-3 py-1 rounded border flex items-center gap-2 ${
                  payrollStatus.type === 'success' ? 'bg-green-50 text-green-600 border-green-100' :
                  payrollStatus.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
                  'bg-blue-50 text-blue-600 border-blue-100'
                }`}
              >
                {payrollStatus.type === 'info' && <RefreshCw className="animate-spin" size={10} />}
                {payrollStatus.message}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Timesheets Approval */}
        <section className="card">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                checked={timesheets.length > 0 && selectedTimesheets.size === timesheets.length}
                onChange={() => toggleSelectAll(timesheets, selectedTimesheets, setSelectedTimesheets)}
              />
              <h3 className="card-title !mb-0 font-bold uppercase tracking-widest text-[10px] text-gray-400">Timesheet Queue</h3>
            </div>
            <div className="flex items-center gap-2">
              {selectedTimesheets.size > 0 && (
                <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                  <button 
                    onClick={() => handleBulkStatusUpdate('timesheets', selectedTimesheets, setSelectedTimesheets, 'approved')}
                    className="px-2 py-1 bg-green-600 text-white text-[10px] font-bold rounded uppercase hover:bg-green-700 transition-colors"
                  >
                    Approve ({selectedTimesheets.size})
                  </button>
                  <button 
                    onClick={() => handleBulkStatusUpdate('timesheets', selectedTimesheets, setSelectedTimesheets, 'rejected')}
                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
              <span className="badge bg-orange-50 text-orange-600 border border-orange-100 font-mono text-[9px] uppercase font-bold">
                {timesheets.length} Pending
              </span>
            </div>
          </div>
          <div className="divide-y divide-app-bg max-h-[400px] overflow-y-auto">
            {timesheets.slice((timesheetPage - 1) * PAGE_SIZE, timesheetPage * PAGE_SIZE).map(t => {
              const emp = employees.find(e => e.uid === t.employeeId);
              return (
                <div key={t.id} className="py-3 flex items-center justify-between hover:bg-gray-50 transition-colors pr-2">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                      checked={selectedTimesheets.has(t.id)}
                      onChange={() => toggleSelection(t.id, selectedTimesheets, setSelectedTimesheets)}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{emp?.fullName}</p>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-gray-700 font-mono font-black">{t.date || t.month}</p>
                          <p className="text-[10px] text-mine-green font-bold uppercase tracking-tighter bg-mine-green/5 px-1.5 rounded">{t.hoursWorked}h + {t.overtimeHours}h OT</p>
                          {emp?.branch && (
                            <span className="text-[8px] text-gray-400 font-black uppercase flex items-center gap-0.5 border-l pl-2">
                              <MapPin size={8} /> {emp.branch}
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-[9px] text-gray-400 italic line-clamp-1 max-w-[250px]">“{t.description}”</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 scale-90">
                    <button 
                      onClick={() => handleStatusUpdate('timesheets', t.id, 'approved')}
                      className="p-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate('timesheets', t.id, 'rejected')}
                      className="p-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {timesheets.length === 0 && <p className="p-8 text-center text-gray-400 text-[11px] italic">Queue empty. All nodes secure.</p>}
          </div>
          <Pagination 
            currentPage={timesheetPage} 
            totalItems={timesheets.length} 
            pageSize={PAGE_SIZE} 
            onPageChange={setTimesheetPage} 
          />
        </section>

        {/* Loan Requests Approval */}
        <section className="card">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h3 className="card-title !mb-0 font-bold uppercase tracking-widest text-[10px] text-gray-400">Credit Applications</h3>
            <span className="badge bg-blue-50 text-blue-600 border border-blue-100 font-mono text-[9px] uppercase font-bold">
              {loanRequests.length} Review Required
            </span>
          </div>
          <div className="divide-y divide-app-bg max-h-[400px] overflow-y-auto">
            {loanRequests.slice((loanPage - 1) * PAGE_SIZE, loanPage * PAGE_SIZE).map(l => {
              const emp = employees.find(e => e.uid === l.employeeId);
              return (
                <div key={l.id} className="py-3 flex items-center justify-between hover:bg-gray-50 transition-colors pr-2">
                  <div className="max-w-[70%]">
                    <p className="text-xs font-bold text-gray-900">{emp?.fullName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-mono font-bold text-mine-gold tracking-tighter">{l.currency} {l.amount.toFixed(2)} / {l.installmentCount} installments</p>
                      {emp?.branch && (
                        <span className="text-[8px] text-gray-400 font-black uppercase flex items-center gap-0.5 border-l pl-2">
                          <MapPin size={8} /> {emp.branch}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 scale-90">
                    <button 
                      onClick={() => handleStatusUpdate('loan_applications', l.id, 'approved')}
                      className="p-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate('loan_applications', l.id, 'rejected')}
                      className="p-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {loanRequests.length === 0 && <p className="p-8 text-center text-gray-400 text-[11px] italic">No pending credit requests found.</p>}
          </div>
          <Pagination 
            currentPage={loanPage} 
            totalItems={loanRequests.length} 
            pageSize={PAGE_SIZE} 
            onPageChange={setLoanPage} 
          />
        </section>

        {/* Leave Requests Approval */}
        <section className="card">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                checked={leaveRequests.length > 0 && selectedLeaveRequests.size === leaveRequests.length}
                onChange={() => toggleSelectAll(leaveRequests, selectedLeaveRequests, setSelectedLeaveRequests)}
              />
              <h3 className="card-title !mb-0 font-bold uppercase tracking-widest text-[10px] text-gray-400">Leave Applications</h3>
            </div>
            <div className="flex items-center gap-2">
              {selectedLeaveRequests.size > 0 && (
                <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                  <button 
                    onClick={() => handleBulkStatusUpdate('leave_applications', selectedLeaveRequests, setSelectedLeaveRequests, 'approved')}
                    className="px-2 py-1 bg-green-600 text-white text-[10px] font-bold rounded uppercase hover:bg-green-700 transition-colors"
                  >
                    Approve ({selectedLeaveRequests.size})
                  </button>
                  <button 
                    onClick={() => handleBulkStatusUpdate('leave_applications', selectedLeaveRequests, setSelectedLeaveRequests, 'rejected')}
                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase hover:bg-red-700 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
              <span className="badge bg-purple-50 text-purple-600 border border-purple-100 font-mono text-[9px] uppercase font-bold">
                {leaveRequests.length} Pending
              </span>
            </div>
          </div>
          <div className="divide-y divide-app-bg max-h-[400px] overflow-y-auto">
            {leaveRequests.slice((leavePage - 1) * PAGE_SIZE, leavePage * PAGE_SIZE).map(l => {
              const emp = employees.find(e => e.uid === l.employeeId);
              return (
                <div key={l.id} className="py-3 flex items-center justify-between hover:bg-gray-50 transition-colors pr-2">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                      checked={selectedLeaveRequests.has(l.id)}
                      onChange={() => toggleSelection(l.id, selectedLeaveRequests, setSelectedLeaveRequests)}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{emp?.fullName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight flex items-center gap-1">
                          <Calendar size={10} /> {l.type} leave: {l.startDate} to {l.endDate}
                        </p>
                        {emp?.branch && (
                          <span className="text-[8px] text-gray-400 font-black uppercase flex items-center gap-0.5 border-l pl-2">
                            <MapPin size={8} /> {emp.branch}
                          </span>
                        )}
                      </div>
                      {l.reason && <p className="text-[9px] text-gray-500 italic mt-0.5">"{l.reason}"</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 scale-90">
                    <button 
                      onClick={() => handleStatusUpdate('leave_applications', l.id, 'approved')}
                      className="p-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate('leave_applications', l.id, 'rejected')}
                      className="p-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {leaveRequests.length === 0 && <p className="p-8 text-center text-gray-400 text-[11px] italic">No pending leave requests found.</p>}
          </div>
          <Pagination 
            currentPage={leavePage} 
            totalItems={leaveRequests.length} 
            pageSize={PAGE_SIZE} 
            onPageChange={setLeavePage} 
          />
        </section>

        {/* ZIMRA Tax Calculator */}
        <div className="lg:col-span-2">
          <TaxCalculator />
        </div>

        {/* Payroll Intelligence Reports */}
        <div className="lg:col-span-2">
          <PayrollReports />
        </div>

        {/* Audit Trail Intelligence */}
        <div className="lg:col-span-2">
          <AuditTrail subsidiaryId={profile?.subsidiaryId} isSuperAdmin={isSuperAdmin} />
        </div>
      </div>

      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className={`p-6 flex items-center gap-4 ${confirmAction.type === 'final' ? 'bg-red-50' : 'bg-mine-green/5'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${confirmAction.type === 'final' ? 'bg-red-100 text-red-600' : 'bg-mine-green/10 text-mine-green'}`}>
                  {confirmAction.type === 'final' ? <AlertTriangle size={24} /> : <Calculator size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                    {confirmAction.type === 'final' ? 'Critical Action: Finalize' : 'Initiate Draft Batch'}
                  </h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Period: {confirmAction.monthDisplay}</p>
                </div>
              </div>

              <div className="p-8 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                  {confirmAction.type === 'final' ? (
                    <>
                      You are about to <span className="text-red-600 font-bold">LOCK</span> the payroll matrix for this period. 
                      This will make all generated payslips available to employees and prevent any further modifications. 
                      This action is <span className="font-bold underline">irreversible</span>.
                    </>
                  ) : (
                    <>
                      This will calculate gross pay, taxes, and loan deductions for all active personnel in the current subsidiary. 
                      Existing drafts will be updated. No data will be visible to employees until finalized.
                    </>
                  )}
                </p>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-500 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmAction.type === 'final' ? finalizePayroll : generatePayrollForAll}
                    className={`flex-1 px-6 py-3 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-current/20 transition-all active:scale-95 ${
                      confirmAction.type === 'final' ? 'bg-red-600 hover:bg-red-700' : 'bg-mine-green hover:bg-mine-green/90'
                    }`}
                  >
                    Confirm Action
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
