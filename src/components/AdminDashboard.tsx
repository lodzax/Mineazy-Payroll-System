import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
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
  AlertCircle,
  FileDown,
  FileUp,
  AlertCircle as FileWarning,
  CheckCircle,
  HelpCircle,
  Trash2,
  MoreVertical,
  Briefcase
} from 'lucide-react';
import { calculatePaye, calculateNssa, USD_TAX_BANDS, ZWG_TAX_BANDS } from '../lib/payrollUtils';
import TaxCalculator from './TaxCalculator';
import PayrollReports from './PayrollReports';
import PayrollBatchManagement from './PayrollBatchManagement';
import PayrollGuide from './PayrollGuide';
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
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
          Record {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:border-mine-blue hover:text-mine-blue transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-7 h-7 rounded text-[9px] font-bold transition-all ${currentPage === p ? 'bg-mine-blue text-white shadow-lg shadow-blue-200' : 'bg-white border border-gray-200 text-gray-400 hover:border-mine-blue hover:text-mine-blue'}`}
            >
              {p}
            </button>
          )).filter((_, idx) => {
            if (totalPages <= 5) return true;
            if (idx === 0 || idx === totalPages - 1) return true;
            return Math.abs(idx - (currentPage - 1)) <= 1;
          })}
        </div>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:border-mine-blue hover:text-mine-blue transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { user, profile, isSuperAdmin, loading: authLoading } = useAuth();

  const [employees, setEmployees] = useState<any[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<any[]>([]);
  const [loanRequests, setLoanRequests] = useState<any[]>([]);
  const [timesheetRequests, setTimesheetRequests] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [subFilter, setSubFilter] = useState('');
  const [payrollStatus, setPayrollStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [payrollGroupFilter, setPayrollGroupFilter] = useState('employee');
  const [isBatchFinalized, setIsBatchFinalized] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'draft' | 'final', monthDisplay: string, group?: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [viewMode, setViewMode] = useState<'draft' | 'finalized'>('draft');
  
  // New state for Payroll Review & Readiness
  const [draftPayslips, setDraftPayslips] = useState<any[]>([]);
  const [readinessMetrics, setReadinessMetrics] = useState({
    totalEmployees: 0,
    approvedTimesheets: 0,
    pendingTimesheets: 0,
    pendingLoans: 0,
    pendingLeave: 0
  });

  const [rejectionModal, setRejectionModal] = useState<{ 
    collection: string, 
    id: string, 
    selectionSet?: Set<string>, 
    selectionSetter?: React.Dispatch<React.SetStateAction<Set<string>>> 
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [activeTab, setActiveTab] = useState<'run' | 'batches' | 'reports' | 'help' | 'cash-balance'>('run');
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Specific filters for Cash in-Lieu tab
  const [cashBalanceFilters, setCashBalanceFilters] = useState({
    role: 'All',
    branch: 'All',
    position: 'All',
    status: 'All'
  });
  const [selectedTimesheets, setSelectedTimesheets] = useState<Set<string>>(new Set());
  const [selectedLeaveRequests, setSelectedLeaveRequests] = useState<Set<string>>(new Set());
  const [selectedLoanRequests, setSelectedLoanRequests] = useState<Set<string>>(new Set());
  
  // Pagination states
  const [loanPage, setLoanPage] = useState(1);
  const [timesheetPage, setTimesheetPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    setLoanPage(1);
    setTimesheetPage(1);
    setLeavePage(1);
  }, [globalSearch, subFilter, payrollGroupFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const month = selectedMonth;
      const specificSubId = subFilter || profile?.subsidiary_id;
      
      const { data: batchData } = await supabase
        .from('payroll_batches')
        .select('*')
        .eq('month_year', month);

      const finalized = (batchData || []).some(b => 
        b.status === 'finalized' && 
        (!specificSubId || b.subsidiary_id === specificSubId || b.subsidiary_id === 'all') &&
        b.payroll_group === payrollGroupFilter
      );
      setIsBatchFinalized(finalized);

      // IMPORTANT: Explicitly check for isSuperAdmin flag derived from email as well for robustness
      const effectivelySuperAdmin = isSuperAdmin || ['lodzax@gmail.com', 'accounts@mineazy.co.zw'].includes(user?.email?.toLowerCase() || '');

      let usersQuery = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (!effectivelySuperAdmin && profile?.subsidiary_id) {
        usersQuery = usersQuery.eq('subsidiary_id', profile.subsidiary_id);
      } else if (!effectivelySuperAdmin) {
        // If not superadmin and no subsidiary, show no users to be safe
        usersQuery = usersQuery.eq('subsidiary_id', '00000000-0000-0000-0000-000000000000');
      }
      
      const [empRes, subRes] = await Promise.all([
        usersQuery,
        effectivelySuperAdmin ? supabase.from('subsidiaries').select('*') : Promise.resolve({ data: [] } as any)
      ]);

      let allEmps: any[] = (empRes.data || []).map(u => ({ 
        ...u, 
        uid: u.id, 
        subsidiaryId: u.subsidiary_id, 
        fullName: u.full_name || 'Anonymous User', 
        baseSalary: u.base_salary || 0, 
        annualLeaveBalance: u.annual_leave_balance || 0,
        shortageBalance: u.shortage_balance || 0,
        payrollGroup: u.payroll_group || 'General'
      }));
      const allSubs: any[] = (subRes.data || []);
      
      if (effectivelySuperAdmin && subFilter) {
        allEmps = allEmps.filter((e: any) => e.subsidiaryId === subFilter);
      }

      setEmployees(allEmps);
      setSubsidiaries(allSubs);

      const filteredEmpsForReadiness = allEmps.filter(u => {
        if (payrollGroupFilter === 'management') {
          return ['management', 'admin', 'superadmin'].includes(u.role);
        }
        return u.role === payrollGroupFilter;
      });

      const readinessEmpIds = filteredEmpsForReadiness.map(e => e.id);

      // Fetch Draft Payslips for Review
      await fetchDraftPayslips();

      // Fetch group-specific metrics
      const [pendingTimesheets, pendingLoans, pendingLeave, approvedTS] = await Promise.all([
        supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'submitted').eq('month_year', month).in('user_id', readinessEmpIds.length > 0 ? readinessEmpIds : ['']),
        supabase.from('loan_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('user_id', readinessEmpIds.length > 0 ? readinessEmpIds : ['']),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('user_id', readinessEmpIds.length > 0 ? readinessEmpIds : ['']),
        supabase.from('timesheets').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('month_year', month).in('user_id', readinessEmpIds.length > 0 ? readinessEmpIds : [''])
      ]);

      setReadinessMetrics({
        totalEmployees: filteredEmpsForReadiness.length,
        approvedTimesheets: approvedTS.count || 0,
        pendingTimesheets: pendingTimesheets.count || 0,
        pendingLoans: pendingLoans.count || 0,
        pendingLeave: pendingLeave.count || 0
      });

      // Fetch pending requests (loans, timesheets, leaves)
      const fetchCollection = async (table: string) => {
        let q = supabase.from(table).select('*').in('status', ['pending', 'submitted', 'pending_approval']);
        if (!effectivelySuperAdmin) {
          if (profile?.subsidiary_id) {
            q = q.or(`subsidiary_id.eq.${profile.subsidiary_id},subsidiary_id.is.null`);
          } else {
            // If admin has no subsidiary, only show unassigned requests
            q = q.is('subsidiary_id', null);
          }
        }
        return q;
      };

      const [loanRes, timesheetRes, leaveRes] = await Promise.all([
        fetchCollection('loan_requests').catch(() => ({ data: [] })),
        fetchCollection('timesheets').catch(() => ({ data: [] })),
        fetchCollection('leave_requests').catch(() => ({ data: [] }))
      ]);

      const filteredEmpIds = new Set(allEmps.map(e => e.id));
      
      setLoanRequests((loanRes.data || [])
        .map(l => ({ 
          ...l, 
          employeeId: l.user_id, 
          subsidiaryId: l.subsidiary_id, 
          installmentCount: l.installment_count ?? l.installments ?? 1,
          reason: l.reason ?? l.purpose ?? 'Personal'
        }))
        .filter((l: any) => effectivelySuperAdmin || filteredEmpIds.has(l.employeeId))
      );

      setTimesheetRequests((timesheetRes.data || [])
        .map(t => ({
          ...t,
          employeeId: t.user_id,
          subsidiaryId: t.subsidiary_id,
          month: t.month_year || t.month,
          hoursWorked: t.hours_worked,
          overtimeHours: t.overtime_hours
        }))
        .filter((t: any) => effectivelySuperAdmin || filteredEmpIds.has(t.employeeId))
      );

      setLeaveRequests((leaveRes.data || [])
        .map(lv => ({
          ...lv,
          employeeId: lv.user_id,
          subsidiaryId: lv.subsidiary_id,
          startDate: lv.start_date,
          endDate: lv.end_date
        }))
        .filter((lv: any) => effectivelySuperAdmin || filteredEmpIds.has(lv.employeeId))
      );
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, subFilter, isSuperAdmin, profile?.subsidiary_id, payrollGroupFilter, selectedMonth, viewMode]);

  const fetchDraftPayslips = async () => {
    const displayMonth = selectedMonth;
    try {
      let query = supabase
        .from('payslips')
        .select('*')
        .eq('month_year', displayMonth)
        .eq('is_published', viewMode === 'finalized');

      if (payrollGroupFilter !== 'All') {
        // Since we are filtering by a referenced table, we might need a different approach or join filtering
        // For now, we'll fetch all and filter in JS if needed, or stick to the group filter if it's in payslips (it's not)
      }

      if (subFilter) {
        query = query.eq('subsidiary_id', subFilter);
      }

      const { data: payslips, error: fetchErr } = await query;
      
      if (fetchErr) {
        console.error("Draft payslip fetch failed:", fetchErr);
        return;
      }

      if (payslips && payslips.length > 0) {
        const userIds = [...new Set(payslips.map(p => p.user_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, role, payroll_group, job_title')
          .in('id', userIds);
        
        if (profilesError) {
          console.error("Profiles fetch failed:", profilesError);
          setDraftPayslips(payslips);
        } else {
          const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
          const joinedData = payslips.map(p => ({
            ...p,
            profiles: profileMap[p.user_id]
          }));
          
          if (payrollGroupFilter !== 'All') {
            setDraftPayslips(joinedData.filter(p => {
              if (!p.profiles) return false;
              const role = p.profiles.role;
              if (payrollGroupFilter === 'management') {
                return ['management', 'admin', 'superadmin'].includes(role);
              }
              return role === payrollGroupFilter;
            }));
          } else {
            setDraftPayslips(joinedData);
          }
        }
      } else {
        setDraftPayslips([]);
      }
    } catch (err) {
      console.error("Draft payslip fetch failed:", err);
    }
  };

  const regenerateSinglePayslip = async (employeeId: string) => {
    setProcessing(true);
    setPayrollStatus({ type: 'info', message: 'Recomputing single record...' });
    try {
      // 1. Delete existing draft
      const displayMonth = selectedMonth;
      await supabase.from('payslips').delete().eq('user_id', employeeId).eq('month_year', displayMonth).eq('is_published', false);
      
      // 2. Fetch fresh data for this employee
      const { data: emp, error: empErr } = await supabase.from('profiles').select('*').eq('id', employeeId).single();
      if (empErr) throw empErr;

      const { data: timesheets } = await supabase.from('timesheets').select('*').eq('user_id', employeeId).eq('month_year', displayMonth).eq('status', 'approved');
      const { data: loans } = await supabase.from('loan_requests').select('*').eq('user_id', employeeId).eq('status', 'approved');
      const { data: cashOuts } = await supabase.from('leave_requests').select('*').eq('user_id', employeeId).eq('type', 'cash_in_lieu').eq('status', 'approved');

      // 3. Calculate (Matches main generatePayrollForAll logic)
      const empTimesheets = (timesheets || []);
      const empCashOuts = (cashOuts || []);
      
      const standardHours = empTimesheets.reduce((acc, curr) => acc + (curr.hours_worked || 0), 0);
      const overtimeHours = empTimesheets.reduce((acc, curr) => acc + (curr.overtime_hours || 0), 0);
      
      const basePay = Number(emp.base_salary || 0);
      const hourlyRate = basePay / 160;
      const overtimePay = overtimeHours * (hourlyRate * 1.5);
      
      const cashInLieuDays = empCashOuts.reduce((acc, curr) => acc + parseFloat(curr.requested_days || 0), 0);
      const dailyRate = basePay / 22;
      const cashInLieuPay = cashInLieuDays * dailyRate;

      const totalGross = basePay + overtimePay + cashInLieuPay;

      const bands = emp.currency === 'ZWG' ? ZWG_TAX_BANDS : USD_TAX_BANDS;
      const { tax, aidsLevy } = calculatePaye(totalGross, bands);
      const nssa = calculateNssa(totalGross, emp.currency as any);
      
      const empLoans = (loans || []);
      const loanDeduction = empLoans.reduce((acc, curr) => {
        const principal = curr.amount;
        const rate = (curr.interest_rate || 0) / 100;
        const term = curr.installment_count || curr.installments || 1;
        const totalRepayable = principal + (principal * rate * term);
        return acc + (totalRepayable / term);
      }, 0);

      const totalDeductions = tax + aidsLevy + nssa + loanDeduction;
      const preliminaryNetPay = totalGross - totalDeductions;

      // Handle Sales Rep Reconciliation Shortage
      let shortageDeduction = 0;
      if (emp.job_title === 'Sales Rep' && (emp.shortage_balance || 0) > 0) {
        const maxDeduction = preliminaryNetPay * 0.10;
        shortageDeduction = Math.min(maxDeduction, Number(emp.shortage_balance || 0));
      }

      const netPay = preliminaryNetPay - shortageDeduction;

      const { error: insertErr } = await supabase.from('payslips').insert({
        user_id: employeeId,
        month_year: displayMonth,
        basic_salary: basePay,
        base_salary: basePay,
        standard_hours: standardHours,
        overtime_hours: overtimeHours,
        overtime_pay: overtimePay,
        gross_pay: totalGross,
        tax_amount: tax,
        aids_levy: aidsLevy,
        nssa_deduction: nssa,
        loan_deductions: loanDeduction,
        total_deductions: totalDeductions + shortageDeduction,
        net_pay: netPay,
        currency: emp.currency || 'USD',
        subsidiary_id: emp.subsidiary_id,
        is_published: false,
        breakdown: {
          hourlyRate: hourlyRate.toFixed(2),
          overtimeRate: (hourlyRate * 1.5).toFixed(2),
          nssaRate: '4.5%',
          loanCount: empLoans.length,
          cashInLieuDays,
          cashInLieuPay: cashInLieuPay.toFixed(2),
          shortageDeduction: shortageDeduction.toFixed(2),
          shortageRemaining: ((emp.shortage_balance || 0) - shortageDeduction).toFixed(2)
        }
      });

      if (insertErr) throw insertErr;

      toast.success("Record regenerated successfully.");
      await fetchDraftPayslips();
    } catch (err) {
      console.error(err);
      toast.error("Regeneration failed.");
    } finally {
      setProcessing(false);
      setPayrollStatus(null);
    }
  };

  const deleteDraftPayslip = async (id: string) => {
    if (!window.confirm("Remove this draft payslip?")) return;
    try {
      const { error } = await supabase.from('payslips').delete().eq('id', id);
      if (error) throw error;
      toast.success("Draft removed");
      fetchDraftPayslips();
    } catch (err) {
      toast.error("Failed to delete draft");
    }
  };

  const calculateLeaveDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleStatusUpdate = async (collectionName: string, id: string, status: string, skipRefresh = false, reason?: string) => {
    if (!skipRefresh) setProcessing(true);
    console.log(`Initiating status update: ${collectionName}.${id} -> ${status}`);
    try {
      const { data: record, error: fetchErr } = await supabase
        .from(collectionName)
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchErr || !record) {
        console.error(`Fetch record fail [${collectionName}.${id}]:`, fetchErr);
        throw new Error(`Target record not found in node. (Ref: ${id})`);
      }

      // Handle leave deduction
      if (collectionName === 'leave_requests' && status === 'approved' && record.status !== 'approved') {
        const { data: emp, error: empErr } = await supabase
          .from('profiles')
          .select('annual_leave_balance')
          .eq('id', record.user_id)
          .maybeSingle();
          
        if (empErr) throw empErr;

        if (emp) {
          let daysToDeduct = 0;
          if (record.type === 'annual') {
            daysToDeduct = calculateLeaveDays(record.start_date, record.end_date);
          } else if (record.type === 'cash_in_lieu') {
            daysToDeduct = parseFloat(record.requested_days || 0);
          }

          if (daysToDeduct > 0) {
            const currentAnnual = emp.annual_leave_balance || 0;
            const { error: profileUpdateErr } = await supabase
              .from('profiles')
              .update({
                annual_leave_balance: currentAnnual - daysToDeduct
              })
              .eq('id', record.user_id);
            
            if (profileUpdateErr) throw profileUpdateErr;
            console.log(`Deducted ${daysToDeduct} days from employee ${record.user_id} for ${record.type}`);
          }
        }
      }

      // Handle leave accumulation for monthly timesheets
      if (collectionName === 'timesheets' && status === 'approved' && record.status !== 'approved' && record.submission_mode === 'monthly') {
        const { data: emp, error: empErr } = await supabase
          .from('profiles')
          .select('annual_leave_balance')
          .eq('id', record.user_id)
          .maybeSingle();
          
        if (empErr) throw empErr;

        if (emp) {
          const currentAnnual = emp.annual_leave_balance || 0;

          const { error: profileUpdateErr } = await supabase
            .from('profiles')
            .update({
              annual_leave_balance: currentAnnual + 2.5
            })
            .eq('id', record.user_id);
          
          if (profileUpdateErr) throw profileUpdateErr;
          console.log(`Accumulated 2.5 days for employee ${record.user_id}`);
        } else {
          console.warn(`CRITICAL: Personnel profile missing for user ${record.user_id}. Leave accumulation skipped for timesheet ${id}.`);
        }
      }

      // Determine valid update fields based on collection schema
      const updatePayload: any = { status };
      if (reason) {
        updatePayload.rejection_reason = reason;
        if (collectionName === 'leave_requests') {
          updatePayload.manager_feedback = reason;
        }
      }
      
      // Tables that support reviewed_at/by tracking
      const trackingTables = ['timesheets', 'leave_requests', 'loan_requests', 'personnel_reviews'];
      
      if (trackingTables.includes(collectionName)) {
        updatePayload.reviewed_at = new Date().toISOString();
        updatePayload.reviewed_by = user?.email || 'System Admin';
      }

      const { error: updateErr } = await supabase
        .from(collectionName)
        .update(updatePayload)
        .eq('id', id);

      if (updateErr) {
        console.error(`Update failed for ${collectionName}.${id}:`, updateErr);
        throw new Error(`Update failed: ${updateErr.message}`);
      }

      await logAction({
        action: 'Status Update',
        category: 'personnel',
        details: `Updated ${collectionName} status for node ${id} to ${status}.`,
        entityId: id,
        userName: profile?.full_name || user?.email || 'Admin',
        userEmail: user?.email || 'admin@system.local'
      });

      console.log(`Status update successful: ${collectionName}.${id} -> ${status}`);
      if (!skipRefresh) {
        toast.success(`Success: Record marked as ${status}`);
        fetchData();
      }
    } catch (err: any) {
      console.error("Status update procedure failed:", err);
      if (!skipRefresh) {
        toast.error(`Action failed: ${err.message || 'Unknown protocol error'}`);
      }
      throw err;
    } finally {
      if (!skipRefresh) setProcessing(false);
    }
  };

  const toggleSelection = (id: string, selectionSet: Set<string>, selectionSetter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const next = new Set(selectionSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectionSetter(next);
  };

  const toggleSelectAllItems = (items: any[], selectionSet: Set<string>, selectionSetter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    if (selectionSet.size === items.length) {
      selectionSetter(new Set());
    } else {
      selectionSetter(new Set(items.map(i => i.id)));
    }
  };

  const handleBulkStatusUpdate = async (collectionName: string, selectionSet: Set<string>, selectionSetter: React.Dispatch<React.SetStateAction<Set<string>>>, status: string, reason?: string) => {
    if (selectionSet.size === 0) return;
    setProcessing(true);
    let successCount = 0;
    let failCount = 0;
    try {
      const ids = Array.from(selectionSet);
      // Process one by one to handle balance updates logic in handleStatusUpdate
      for (const id of ids) {
        try {
          await handleStatusUpdate(collectionName, id, status, true, reason);
          successCount++;
        } catch (err) {
          console.error(`Bulk item ${id} failed:`, err);
          failCount++;
        }
      }
      selectionSetter(new Set());
      fetchData();
      if (failCount > 0) {
        toast.error(`Bulk action partial result: ${successCount} successful, ${failCount} failed.`);
      } else {
        toast.success(`Successfully processed ${successCount} items.`);
      }
    } catch (err) {
      console.error("Bulk action failed:", err);
      toast.error("Bulk operation encountered a critical exception.");
    } finally {
      setProcessing(false);
    }
  };

  const filterBySearch = (items: any[]) => {
    if (!globalSearch) return items;
    const query = globalSearch.toLowerCase();
    return items.filter(item => {
      const emp = employees.find(e => e.id === item.user_id);
      return (
        emp?.fullName?.toLowerCase().includes(query) ||
        emp?.email?.toLowerCase().includes(query) ||
        item.status?.toLowerCase().includes(query) ||
        (item.reason && item.reason.toLowerCase().includes(query)) ||
        (item.type && item.type.toLowerCase().includes(query))
      );
    });
  };

  const filteredTimesheets = filterBySearch(timesheetRequests);
  const filteredLeave = filterBySearch(leaveRequests);
  const filteredLoans = filterBySearch(loanRequests);

  const initiateGeneratePayroll = () => {
    const displayMonth = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
    setConfirmAction({ type: 'draft', monthDisplay: displayMonth, group: payrollGroupFilter });
  };

  const initiateFinalizePayroll = () => {
    const displayMonth = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
    setConfirmAction({ type: 'final', monthDisplay: displayMonth });
  };

  const generatePayrollForAll = async () => {
    const month = selectedMonth;
    const displayMonth = new Date(selectedMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
    const groupToProcess = confirmAction?.group || payrollGroupFilter;
    
    setConfirmAction(null);
    setProcessing(true);
    setPayrollStatus({ type: 'info', message: `Initializing batch payroll for ${displayMonth}...` });
    setViewMode('draft');
    
    try {
      // 1. Check for existing payslips
      const { data: existingPayslips } = await supabase
        .from('payslips')
        .select('user_id')
        .eq('month_year', month);

      const existingUserIds = new Set((existingPayslips || []).map(d => d.user_id));
      const eligibleEmployees = employees.filter(emp => {
        const isEligibleRole = groupToProcess === 'management' 
          ? ['management', 'admin', 'superadmin'].includes(emp.role)
          : emp.role === groupToProcess;
          
        return !existingUserIds.has(emp.id) && isEligibleRole;
      });
      
      if (eligibleEmployees.length === 0) {
        setPayrollStatus({ type: 'info', message: `All active personnel in the ${groupToProcess} group have existing payslips for this period.` });
        setProcessing(false);
        return;
      }

      // 2. Fetch approved timesheets, loans and cash-outs
      const [timesheetsRes, loansRes, cashOutsRes] = await Promise.all([
        supabase.from('timesheets').select('*').eq('month_year', month).eq('status', 'approved'),
        supabase.from('loan_requests').select('*').eq('status', 'approved'),
        supabase.from('leave_requests').select('*').eq('type', 'cash_in_lieu').eq('status', 'approved')
      ]);

      const approvedTimesheets = timesheetsRes.data || [];
      const approvedLoans = loansRes.data || [];
      const approvedCashOuts = cashOutsRes.data || [];

      let count = 0;
      for (const emp of eligibleEmployees) {
        const empTimesheets = approvedTimesheets.filter(d => d.user_id === emp.id);
        const empCashOuts = approvedCashOuts.filter(d => d.user_id === emp.id);
        
        const standardHours = empTimesheets.reduce((acc, curr) => acc + (curr.hours_worked || 0), 0);
        const overtimeHours = empTimesheets.reduce((acc, curr) => acc + (curr.overtime_hours || 0), 0);
        
        const basePay = emp.baseSalary || 0;
        const hourlyRate = basePay / 160;
        const overtimePay = overtimeHours * (hourlyRate * 1.5);
        
        // Calculate Cash In-Lieu
        const cashInLieuDays = empCashOuts.reduce((acc, curr) => acc + parseFloat(curr.requested_days || 0), 0);
        const dailyRate = basePay / 22; // 22 working days average
        const cashInLieuPay = cashInLieuDays * dailyRate;

        const totalGross = basePay + overtimePay + cashInLieuPay;

        if (totalGross === 0 && empTimesheets.length === 0) continue;

        const bands = emp.currency === 'ZWG' ? ZWG_TAX_BANDS : USD_TAX_BANDS;
        const { tax, aidsLevy } = calculatePaye(totalGross, bands);
        const nssa = calculateNssa(totalGross, emp.currency as 'USD' | 'ZWG');
        
        const empLoans = approvedLoans.filter(d => d.user_id === emp.id);
        const loanDeduction = empLoans.reduce((acc, curr) => {
          const principal = curr.amount;
          const rate = (curr.interest_rate || 0) / 100;
          const term = curr.installment_count || 1;
          const totalRepayable = principal + (principal * rate * term);
          return acc + (totalRepayable / term);
        }, 0);

        const totalDeductions = tax + aidsLevy + nssa + loanDeduction;
        const preliminaryNetPay = totalGross - totalDeductions;

        // Handle Sales Rep Reconciliation Shortage
        let shortageDeduction = 0;
        if (emp.job_title === 'Sales Rep' && (emp.shortageBalance || 0) > 0) {
          const maxDeduction = preliminaryNetPay * 0.10;
          shortageDeduction = Math.min(maxDeduction, Number(emp.shortageBalance || 0));
        }

        const netPay = preliminaryNetPay - shortageDeduction;

        const { error: payslipErr } = await supabase.from('payslips').insert({
          user_id: emp.id,
          subsidiary_id: emp.subsidiaryId || null,
          month_year: month,
          month_display: displayMonth,
          basic_salary: basePay,
          base_salary: basePay,
          overtime_pay: overtimePay,
          standard_hours: standardHours,
          overtime_hours: overtimeHours,
          gross_pay: totalGross,
          tax_amount: tax,
          aids_levy: aidsLevy,
          nssa_deduction: nssa,
          loan_deductions: loanDeduction,
          total_deductions: totalDeductions + shortageDeduction,
          net_pay: netPay,
          currency: emp.currency || 'USD',
          is_published: false,
          generated_at: new Date().toISOString(),
          breakdown: {
            hourlyRate: hourlyRate.toFixed(2),
            overtimeRate: (hourlyRate * 1.5).toFixed(2),
            nssaRate: emp.currency === 'ZWG' ? '4.5%' : '4.5% (ZWG Base)',
            loanCount: empLoans.length,
            cashInLieuDays,
            cashInLieuPay: cashInLieuPay.toFixed(2),
            shortageDeduction: shortageDeduction.toFixed(2),
            shortageRemaining: ((emp.shortageBalance || 0) - shortageDeduction).toFixed(2)
          }
        });

        if (!payslipErr) {
          count++;
        } else {
          console.error(`Payslip generation failed for ${emp.fullName}:`, payslipErr);
          toast.error(`Failed to generate payslip for ${emp.fullName}: ${payslipErr.message}`);
        }
      }
      
      if (count > 0) {
        await logAction({
          action: 'Payroll Run Initiation',
          category: 'payroll',
          details: `Generated ${count} payslips for period ${displayMonth}. Group: ${groupToProcess}.`,
          userName: profile?.full_name || user?.email,
          userEmail: user?.email
        });
        setPayrollStatus({ type: 'success', message: `Vault update complete: ${count} payslips generated successfully. Review data before final publication.` });
      } else {
        setPayrollStatus({ type: 'info', message: 'No eligible records found for processing.' });
      }
      fetchData();
    } catch (err) {
      setPayrollStatus({ type: 'error', message: 'Payroll generation failed. Check node logs.' });
      console.error(err);
    } finally {
      setProcessing(false);
      // Clear status after 10 seconds
      setTimeout(() => setPayrollStatus(null), 10000);
    }
  };

  const finalizePayroll = async () => {
    setConfirmAction(null);
    setProcessing(true);
    setPayrollStatus({ type: 'info', message: 'Finalizing payroll run...' });
    
    try {
      const month = selectedMonth;
      const subIdRaw = subFilter || profile?.subsidiary_id || 'all';
      const subId = subIdRaw === 'all' ? null : subIdRaw;

      // 1. Create/Update Batch Status
      const { error: batchError } = await supabase.from('payroll_batches').upsert({
        subsidiary_id: subId,
        month_year: month,
        payroll_group: payrollGroupFilter,
        status: 'finalized',
        finalized_at: new Date().toISOString(),
        finalized_by: user?.email
      }, { onConflict: 'subsidiary_id,month_year,payroll_group' });

      if (batchError) {
        console.error('Batch Finalization Error:', batchError);
        throw new Error(`Batch creation failed: ${batchError.message}`);
      }

      // 2. Publish draft payslips for this group only
      const userIdsInGroup = employees.filter(emp => {
        if (payrollGroupFilter === 'management') {
          return ['management', 'admin', 'superadmin'].includes(emp.role);
        }
        return emp.role === payrollGroupFilter;
      }).map(e => e.id);

      if (userIdsInGroup.length === 0) {
        throw new Error("No eligible employees found in the current group filter to publish.");
      }

      let q = supabase.from('payslips')
        .update({ is_published: true })
        .eq('month_year', month)
        .eq('is_published', false)
        .in('user_id', userIdsInGroup);
        
      if (subId) {
        q = q.eq('subsidiary_id', subId);
      }
      
      const { data, error: publishError } = await q.select('*');

      if (publishError) {
        console.error('Publishing Error:', publishError);
        throw new Error(`Payslip publication failed: ${publishError.message}`);
      }
      
      const publishedCount = data?.length || 0;

      // 3. Handle specific deductions and updates on finalization
      if (data && data.length > 0) {
        for (const payslip of data) {
          const shortageDeduction = Number(payslip.breakdown?.shortageDeduction || 0);
          if (shortageDeduction > 0) {
            // Fetch current balance to be precise (avoid race conditions if multiple admins)
            const { data: currentProfile } = await supabase
              .from('profiles')
              .select('shortage_balance')
              .eq('id', payslip.user_id)
              .single();
            
            if (currentProfile) {
              await supabase
                .from('profiles')
                .update({ 
                  shortage_balance: Math.max(0, (currentProfile.shortage_balance || 0) - shortageDeduction) 
                })
                .eq('id', payslip.user_id);
            }
          }
        }
      }

      // 4. Mark approved Cash In-Lieu requests as finalized for these users
      if (userIdsInGroup.length > 0) {
        await supabase
          .from('leave_requests')
          .update({ status: 'finalized' })
          .eq('type', 'cash_in_lieu')
          .eq('status', 'approved')
          .in('user_id', userIdsInGroup);
      }

      await logAction({
        action: 'Payroll Finalization',
        category: 'payroll',
        details: `Finalized and published ${publishedCount} payslips for period ${month}. Group: ${payrollGroupFilter}.`,
        userName: profile?.full_name || user?.email,
        userEmail: user?.email
      });

      setPayrollStatus({ type: 'success', message: `Payroll successfully Finalized & Published (${publishedCount} records updated).` });
      setViewMode('finalized');
      fetchData();
    } catch (err: any) {
      console.error('Payroll Finalization Failed:', err);
      setPayrollStatus({ 
        type: 'error', 
        message: err.message?.includes('violates unique constraint') 
          ? 'Finalization failed. A finalized batch already exists for this criteria.'
          : `Finalization failed: ${err.message || 'Internal sync error'}`
      });
    } finally {
      setProcessing(false);
    }
  };

  const unlockVault = async () => {
    // Security verification
    const effectivelySuperAdmin = isSuperAdmin || ['lodzax@gmail.com', 'accounts@mineazy.co.zw'].includes(user?.email?.toLowerCase() || '');
    if (!effectivelySuperAdmin) {
      toast.error("Security Breach Detect: Unauthorized Vault Access Attempted.");
      return;
    }

    const confirmUnlock = window.confirm("SECURITY ALERT: Initiating Vault Unlock Protocol. This will revert publication and allow modifications. Proceed?");
    if (!confirmUnlock) return;

    setProcessing(true);
    setPayrollStatus({ type: 'info', message: 'Initiating Decryption & Vault Unlock...' });

    try {
      const month = selectedMonth;
      const subIdRaw = subFilter || profile?.subsidiary_id || 'all';
      const subId = subIdRaw === 'all' ? null : subIdRaw;

      // 1. Remove the finalized batch record
      const { error: batchError } = await supabase
        .from('payroll_batches')
        .delete()
        .match({
          month_year: month,
          payroll_group: payrollGroupFilter,
          subsidiary_id: subId
        });

      if (batchError) throw batchError;

      // 2. Revert payslips to draft status (is_published = false)
      let q = supabase.from('payslips')
        .update({ is_published: false })
        .eq('month_year', month)
        .eq('is_published', true);
        
      if (subId) {
        q = q.eq('subsidiary_id', subId);
      }

      const { data: revertedPayslips, error: publishError } = await q.select('*');
      if (publishError) throw publishError;

      // 3. Restore Shortage Balances if they were deducted
      if (revertedPayslips && revertedPayslips.length > 0) {
        for (const payslip of revertedPayslips) {
          const shortageDeduction = Number(payslip.breakdown?.shortageDeduction || 0);
          if (shortageDeduction > 0) {
             const { data: currentProfile } = await supabase
              .from('profiles')
              .select('shortage_balance')
              .eq('id', payslip.user_id)
              .single();
            
            if (currentProfile) {
              await supabase
                .from('profiles')
                .update({ 
                  shortage_balance: (currentProfile.shortage_balance || 0) + shortageDeduction 
                })
                .eq('id', payslip.user_id);
            }
          }
        }
      }

      // 4. Revert finalized Cash In-Lieu requests to approved status
      const userIdsInGroup = employees.filter(emp => {
        if (payrollGroupFilter === 'management') {
          return ['management', 'admin', 'superadmin'].includes(emp.role);
        }
        return emp.role === payrollGroupFilter;
      }).map(e => e.id);

      if (userIdsInGroup.length > 0) {
        await supabase
          .from('leave_requests')
          .update({ status: 'approved' })
          .eq('type', 'cash_in_lieu')
          .eq('status', 'finalized')
          .in('user_id', userIdsInGroup);
      }

      await logAction({
        action: 'Vault Unlock',
        category: 'financial',
        details: `Unlocked payroll vault for period ${month}. Group: ${payrollGroupFilter}. Reverted records to draft state.`,
        userName: profile?.full_name || user?.email,
        userEmail: user?.email
      });

      toast.success("Vault Unlocked. Draft state restored.");
      setPayrollStatus({ type: 'success', message: 'Vault Unlocked: High-level access granted. Updates enabled.' });
      fetchData();
    } catch (err: any) {
      console.error('Vault Unlock Failed:', err);
      toast.error(`Unlock Protocol Failure: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const exportPayrollToExcel = async () => {
    setProcessing(true);
    try {
      const month = selectedMonth;
      const subIdRaw = subFilter || profile?.subsidiary_id || 'all';
      const subId = subIdRaw === 'all' ? null : subIdRaw;
      
      let query = supabase
        .from('payslips')
        .select(`
          *,
          profiles (
            full_name
          )
        `)
        .eq('month_year', month)
        .eq('is_published', viewMode === 'finalized');

      if (subId) {
        query = query.eq('subsidiary_id', subId);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      const exportRows = (data || []).map(d => {
        return {
          ID: d.id,
          Employee: d.profiles?.full_name || 'N/A',
          Month: d.month_year,
          'Base Salary': d.base_salary,
          'Hours Worked': d.standard_hours,
          'Overtime Hours': d.overtime_hours,
          'Overtime Pay': d.overtime_pay,
          'Cash In-Lieu Days': d.breakdown?.cashInLieuDays || 0,
          'Cash In-Lieu Pay': d.breakdown?.cashInLieuPay || 0,
          'Gross Pay': d.gross_pay,
          'Tax Amount': d.tax_amount,
          'AIDS Levy': d.aids_levy,
          'NSSA Deduction': d.nssa_deduction,
          'Loan Deductions': d.loan_deductions,
          'Net Pay': d.net_pay,
          Currency: d.currency
        };
      });

      if (exportRows.length === 0) {
        setPayrollStatus({ type: 'info', message: 'No draft payslips found for export.' });
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
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
        userName: profile?.full_name || user?.email,
        userEmail: user?.email
      });

      let updateCount = 0;

      for (const row of jsonData) {
        if (row.ID) {
          const { error } = await supabase
            .from('payslips')
            .update({
              base_salary: Number(row['Base Salary']),
              standard_hours: Number(row['Hours Worked']),
              overtime_hours: Number(row['Overtime Hours']),
              overtime_pay: Number(row['Overtime Pay']),
              gross_pay: Number(row['Gross Pay']),
              tax_amount: Number(row['Tax Amount']),
              aids_levy: Number(row['AIDS Levy']),
              nssa_deduction: Number(row['NSSA Deduction']),
              loan_deductions: Number(row['Loan Deductions']),
              net_pay: Number(row['Net Pay']),
              updated_at: new Date().toISOString()
            })
            .eq('id', row.ID);
          
          if (!error) updateCount++;
        }
      }

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
          <div className="p-3 bg-mine-blue/10 rounded-lg text-mine-blue">
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
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Requests</p>
            <p className="text-xl font-black text-gray-900 font-mono">{loanRequests.length + timesheetRequests.length + leaveRequests.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-mine-blue/10 rounded-lg text-mine-blue">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Super Global status</p>
            <p className="text-xl font-black text-gray-900 font-mono italic serif">{isSuperAdmin ? 'ACTIVE' : 'RESTRICTED'}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('run')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'run' ? 'bg-white text-mine-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Payroll Run
        </button>
        <button 
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'batches' ? 'bg-white text-mine-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Batch Management
        </button>
        <button 
          onClick={() => setActiveTab('cash-balance')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'cash-balance' ? 'bg-white text-mine-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Cash in-Lieu Balance
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'reports' ? 'bg-white text-mine-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Insights & Reports
        </button>
        <button 
          onClick={() => setActiveTab('help')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'help' ? 'bg-white text-mine-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Help & Workflow
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'cash-balance' && (
          <motion.div
            key="cash-balance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-mine-blue uppercase tracking-tight flex items-center gap-2">
                  <Calculator size={20} /> Cash in-Lieu of Leave Balance
                </h1>
                <p className="text-xs text-gray-500 font-medium italic">Accrued liability monitoring based on current leave balances (Valuation: Basic Salary / 22 Days)</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-mine-blue/5 border border-mine-blue/10 rounded-xl px-6 py-3 text-right">
                  <p className="text-[9px] font-black text-mine-blue uppercase tracking-widest leading-none mb-1">Total Liability</p>
                  <p className="text-lg font-black font-mono text-gray-900">
                    USD {employees
                      .filter(e => {
                        const matchRole = cashBalanceFilters.role === 'All' || e.role === cashBalanceFilters.role;
                        const matchBranch = cashBalanceFilters.branch === 'All' || e.branch === cashBalanceFilters.branch;
                        const matchPosition = cashBalanceFilters.position === 'All' || e.job_title === cashBalanceFilters.position;
                        const matchStatus = cashBalanceFilters.status === 'All' || e.status === cashBalanceFilters.status;
                        return matchRole && matchBranch && matchPosition && matchStatus;
                      })
                      .reduce((acc, e) => acc + ( (Number(e.base_salary || 0) / 22) * (Number(e.annual_leave_balance || 0))), 0)
                      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    }
                  </p>
                </div>
              </div>
            </header>

            {/* Filters Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Search Staff</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Filter by name..."
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-white border border-gray-100 shadow-sm rounded-xl text-xs outline-none focus:ring-1 focus:ring-mine-blue transition-all"
                  />
                  <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Role Filter</label>
                <select 
                  value={cashBalanceFilters.role}
                  onChange={(e) => setCashBalanceFilters({ ...cashBalanceFilters, role: e.target.value })}
                  className="w-full bg-white border border-gray-100 shadow-sm rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue appearance-none"
                >
                  <option value="All">All Roles</option>
                  {[...new Set(employees.map(e => e.role))].filter(Boolean).map(role => (
                    <option key={role as string} value={role as string}>{(role as string).charAt(0).toUpperCase() + (role as string).slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Branch/Dept</label>
                <select 
                  value={cashBalanceFilters.branch}
                  onChange={(e) => setCashBalanceFilters({ ...cashBalanceFilters, branch: e.target.value })}
                  className="w-full bg-white border border-gray-100 shadow-sm rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue appearance-none"
                >
                  <option value="All">All Branches</option>
                  {[...new Set(employees.map(e => e.branch))].filter(Boolean).map(branch => (
                    <option key={branch as string} value={branch as string}>{branch as string}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Position</label>
                <select 
                  value={cashBalanceFilters.position}
                  onChange={(e) => setCashBalanceFilters({ ...cashBalanceFilters, position: e.target.value })}
                  className="w-full bg-white border border-gray-100 shadow-sm rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue appearance-none"
                >
                  <option value="All">All Positions</option>
                  {[...new Set(employees.map(e => e.job_title))].filter(Boolean).map(pos => (
                    <option key={pos as string} value={pos as string}>{pos as string}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1">Status</label>
                <select 
                  value={cashBalanceFilters.status}
                  onChange={(e) => setCashBalanceFilters({ ...cashBalanceFilters, status: e.target.value })}
                  className="w-full bg-white border border-gray-100 shadow-sm rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue appearance-none"
                >
                  <option value="All">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {/* Balances Table */}
            <div className="card !p-0 overflow-hidden border border-gray-100 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Personnel</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Role & Position</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Leave Balance</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Daily Rate (Est)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-mine-blue uppercase tracking-widest text-right bg-mine-blue/5">Cash in-Lieu Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {employees
                      .filter(e => {
                        const matchSearch = !globalSearch || e.fullName?.toLowerCase().includes(globalSearch.toLowerCase());
                        const matchRole = cashBalanceFilters.role === 'All' || e.role === cashBalanceFilters.role;
                        const matchBranch = cashBalanceFilters.branch === 'All' || e.branch === cashBalanceFilters.branch;
                        const matchPosition = cashBalanceFilters.position === 'All' || e.job_title === cashBalanceFilters.position;
                        const matchStatus = cashBalanceFilters.status === 'All' || e.status === cashBalanceFilters.status;
                        return matchSearch && matchRole && matchBranch && matchPosition && matchStatus;
                      })
                      .map(e => {
                        const dailyRate = Number(e.base_salary || 0) / 22;
                        const leaveBalance = Number(e.annual_leave_balance || 0);
                        const cashValue = dailyRate * leaveBalance;
                        return { ...e, dailyRate, leaveBalance, cashValue };
                      })
                      .sort((a, b) => b.cashValue - a.cashValue)
                      .map(e => (
                        <tr key={e.id} className="hover:bg-gray-50/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 group-hover:bg-mine-blue group-hover:text-white transition-colors uppercase">
                                {(e.fullName || '?').charAt(0)}
                              </div>
                              <div>
                                <p className="font-black text-gray-900 uppercase tracking-tight">{e.fullName}</p>
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                  <MapPin size={8} /> {e.branch || 'Head Office'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-mine-blue uppercase tracking-widest leading-none mb-1">{e.role}</span>
                              <span className="font-bold text-gray-600 line-clamp-1">{e.job_title || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                              <span className="font-mono font-bold text-sm tracking-tighter">{e.leaveBalance.toFixed(1)}</span>
                              <span className="text-[8px] font-black uppercase tracking-widest">Days</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-gray-500 font-bold">
                            {e.currency || 'USD'} {e.dailyRate.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right bg-mine-blue/5">
                            <span className="text-base font-black font-mono text-gray-900">
                              {e.currency || 'USD'} {e.cashValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic font-mono text-[10px] uppercase">Initiating Data Nodes...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'batches' && (
          <motion.div
            key="batches"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PayrollBatchManagement 
              onViewBatch={(batch) => {
                setPayrollGroupFilter(batch.payroll_group);
                setSubFilter(batch.subsidiary_id || '');
                setSelectedMonth(batch.month_year);
                setViewMode(batch.status === 'finalized' ? 'finalized' : 'draft');
                setActiveTab('run');
              }}
            />
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PayrollReports />
          </motion.div>
        )}

        {activeTab === 'help' && (
          <motion.div
            key="help"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PayrollGuide />
          </motion.div>
        )}

        {activeTab === 'run' && (
          <motion.div
            key="run"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Stats and Queues nested here */}
            <AnimatePresence>
              {showGuide && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-8"
                >
                  <PayrollGuide />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-8">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-mine-blue flex items-center gap-2 uppercase tracking-tight">
            <ShieldCheck size={20} /> Payroll Control Center
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className={`ml-4 p-2 rounded-xl border transition-all flex items-center gap-2 ${showGuide ? 'bg-mine-blue text-white border-mine-blue shadow-lg shadow-mine-blue/20' : 'bg-white text-gray-400 border-gray-100 hover:border-mine-blue/30 hover:text-mine-blue'}`}
              title="Payroll Execution Guide"
            >
              <HelpCircle size={16} />
              <span className="text-[9px] font-black uppercase tracking-widest leading-none">Workflow Help</span>
            </button>
          </h1>
          <p className="text-xs text-gray-500 font-medium">Monitoring and processing Mineazy solution operations</p>
        </div>
        <div className="flex flex-col md:flex-row items-end gap-3">
          <div className="flex flex-col items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Processing Month</label>
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-200 rounded px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue"
            />
          </div>
          <div className="relative group min-w-[300px]">
             <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-mine-blue transition-colors" size={16} />
             <input 
               type="text"
               placeholder="Global Search (Name, Status, Reason...)"
               value={globalSearch}
               onChange={(e) => setGlobalSearch(e.target.value)}
               className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 shadow-sm rounded text-xs outline-none focus:ring-1 focus:ring-mine-blue transition-all"
             />
          </div>
          <div className="flex flex-col items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Payroll Run Control</label>
            <select 
              value={payrollGroupFilter}
              onChange={(e) => setPayrollGroupFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue min-w-[200px]"
            >
              <option value="employee">General Staff Payroll</option>
              <option value="management">Management Payroll</option>
            </select>
          </div>
          {isSuperAdmin && (
            <div className="flex flex-col items-end">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Active Entity</label>
              <select 
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue min-w-[200px]"
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
                    className="btn btn-outline !text-sm !py-3 !px-8 flex items-center gap-2 group transition-all border-mine-blue text-mine-blue hover:bg-mine-blue hover:text-white"
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
                    <div className="flex gap-4">
                      <button 
                        onClick={initiateFinalizePayroll}
                        disabled={processing}
                        className="text-[9px] font-black uppercase text-mine-green hover:underline flex items-center gap-1"
                      >
                        <RefreshCw size={10} className={processing ? 'animate-spin' : ''} />
                        Force Publication Sync
                      </button>
                      <button 
                        onClick={unlockVault}
                        disabled={processing}
                        className="text-[9px] font-black uppercase text-red-500 hover:underline flex items-center gap-1"
                      >
                        <AlertTriangle size={10} />
                        Unlock Vault (Reset Batch)
                      </button>
                    </div>
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

      {/* READINESS SUMMARY CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-150 rotate-12 group-hover:scale-[1.6] transition-transform pointer-events-none">
          <ShieldCheck size={120} />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${readinessMetrics.pendingTimesheets === 0 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
              {readinessMetrics.pendingTimesheets === 0 ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Readiness & Integrity Matrix</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Dataset verification for {new Date(selectedMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${readinessMetrics.pendingTimesheets === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              <div className={`w-2 h-2 rounded-full ${readinessMetrics.pendingTimesheets === 0 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">Timesheets: {readinessMetrics.pendingTimesheets === 0 ? 'CLEAN' : 'PENDING'}</span>
            </div>
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${readinessMetrics.pendingLoans === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <div className={`w-2 h-2 rounded-full ${readinessMetrics.pendingLoans === 0 ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">Loans: {readinessMetrics.pendingLoans === 0 ? 'PROCESSED' : 'OUTSTANDING'}</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('draft')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'draft' ? 'bg-white text-mine-blue' : 'text-gray-400 hover:text-white'}`}
              >
                Draft Mode
              </button>
              <button 
                onClick={() => setViewMode('finalized')}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'finalized' ? 'bg-white text-mine-blue' : 'text-gray-400 hover:text-white'}`}
              >
                Published Mode
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Approved Coverage</p>
              <span className="text-[10px] font-mono font-bold text-gray-900">
                {Math.round((readinessMetrics.approvedTimesheets / Math.max(1, readinessMetrics.totalEmployees)) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(readinessMetrics.approvedTimesheets / Math.max(1, readinessMetrics.totalEmployees)) * 100}%` }}
                className={`h-full ${readinessMetrics.approvedTimesheets === readinessMetrics.totalEmployees ? 'bg-green-500' : 'bg-blue-500'}`}
              />
            </div>
            <p className="text-[8px] text-gray-400 font-bold uppercase">{readinessMetrics.approvedTimesheets} / {readinessMetrics.totalEmployees} Personnel Verified</p>
          </div>

          <div className="space-y-1 border-l border-gray-100 pl-6">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pending Submissions</p>
            <p className={`text-xl font-black font-mono ${readinessMetrics.pendingTimesheets > 0 ? 'text-red-500' : 'text-gray-900'}`}>{readinessMetrics.pendingTimesheets}</p>
            <p className="text-[8px] text-gray-400 font-bold uppercase italic">Affects gross calcs</p>
          </div>

          <div className="space-y-1 border-l border-gray-100 pl-6">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Open Credit Req.</p>
            <p className={`text-xl font-black font-mono ${readinessMetrics.pendingLoans > 0 ? 'text-amber-500' : 'text-gray-900'}`}>{readinessMetrics.pendingLoans}</p>
            <p className="text-[8px] text-gray-400 font-bold uppercase italic">Loan ledger sync</p>
          </div>

          <div className="space-y-1 border-l border-gray-100 pl-6">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Leave Sync</p>
            <p className={`text-xl font-black font-mono ${readinessMetrics.pendingLeave > 0 ? 'text-amber-500' : 'text-gray-900'}`}>{readinessMetrics.pendingLeave}</p>
            <p className="text-[8px] text-gray-400 font-bold uppercase italic">Accrual data</p>
          </div>
        </div>

        {readinessMetrics.pendingTimesheets > 0 && (
          <div className="mt-8 bg-red-50/50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-700 animate-pulse">
            <FileWarning size={18} />
            <p className="text-[10px] font-bold uppercase tracking-tight">Warning: {readinessMetrics.pendingTimesheets} personnel have not had their timesheets approved. Generating payroll now will lead to incomplete salary calculations.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Timesheet Approval Queue */}
        <section className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50/50 border-b">
            <div className="flex items-center gap-3">
              <input 
                 type="checkbox" 
                 className="w-4 h-4 rounded border-gray-300 text-mine-blue focus:ring-mine-blue cursor-pointer"
                 checked={filteredTimesheets.length > 0 && selectedTimesheets.size === filteredTimesheets.length}
                 onChange={() => toggleSelectAllItems(filteredTimesheets, selectedTimesheets, setSelectedTimesheets)}
              />
              <h3 className="font-bold uppercase tracking-widest text-[10px] text-gray-400">Timesheet Queue</h3>
              <span className="badge bg-green-50 text-green-600 border border-green-100 font-mono text-[9px] uppercase font-bold">
                {filteredTimesheets.length} Pending
              </span>
              <span className="badge bg-white text-mine-gold border border-gold-100 font-mono text-[9px] uppercase font-bold">
                {filteredTimesheets.reduce((acc, t) => acc + (Number(t.hours_worked) || 0), 0)} Total Hours
              </span>
            </div>
            {selectedTimesheets.size > 0 && (
              <div className="flex gap-2">
                <button 
                  onClick={() => handleBulkStatusUpdate('timesheets', selectedTimesheets, setSelectedTimesheets, 'approved')}
                  className="px-3 py-1 bg-green-600 text-white text-[9px] font-black uppercase rounded hover:bg-green-700 transition-colors"
                >
                  Approve ({selectedTimesheets.size})
                </button>
                <button 
                   onClick={() => setRejectionModal({ collection: 'timesheets', id: '', selectionSet: selectedTimesheets, selectionSetter: setSelectedTimesheets })}
                   className="px-3 py-1 bg-red-600 text-white text-[9px] font-black uppercase rounded hover:bg-red-700 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
          <div className="divide-y divide-app-bg max-h-[300px] overflow-y-auto px-4">
            {filteredTimesheets.slice((timesheetPage - 1) * PAGE_SIZE, timesheetPage * PAGE_SIZE).map(t => {
              const emp = employees.find(e => e.id === t.user_id);
              return (
                <div key={t.id} className="py-3 flex items-center justify-between hover:bg-gray-50 transition-colors pr-2">
                  <div className="flex items-center gap-3 max-w-[70%]">
                    <input 
                       type="checkbox" 
                       className="w-4 h-4 rounded border-gray-300 text-mine-blue focus:ring-mine-blue cursor-pointer"
                       checked={selectedTimesheets.has(t.id)}
                       onChange={() => toggleSelection(t.id, selectedTimesheets, setSelectedTimesheets)}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{emp?.fullName || 'Unknown Staff'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold text-gray-400">{t.date}</span>
                        <span className="text-[10px] font-black text-mine-blue uppercase tracking-tighter">
                          {t.hours_worked}h Std + {t.overtime_hours}h OT
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 scale-90">
                    <button 
                      onClick={() => handleStatusUpdate('timesheets', t.id, 'approved')}
                      className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                    >
                      <Check size={12} />
                    </button>
                    <button 
                      onClick={() => setRejectionModal({ collection: 'timesheets', id: t.id })}
                      className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredTimesheets.length === 0 && (
              <p className="py-8 text-center text-gray-400 text-[10px] uppercase font-bold tracking-widest opacity-50 italic">No pending timesheets</p>
            )}
          </div>
          <Pagination 
            currentPage={timesheetPage} 
            totalItems={filteredTimesheets.length} 
            pageSize={PAGE_SIZE} 
            onPageChange={setTimesheetPage} 
          />
        </section>

        {/* Leave Requests Queue */}
        <section className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50/50 border-b">
            <div className="flex items-center gap-3">
              <input 
                 type="checkbox" 
                 className="w-4 h-4 rounded border-gray-300 text-mine-blue focus:ring-mine-blue cursor-pointer"
                 checked={filteredLeave.length > 0 && selectedLeaveRequests.size === filteredLeave.length}
                 onChange={() => toggleSelectAllItems(filteredLeave, selectedLeaveRequests, setSelectedLeaveRequests)}
              />
              <h3 className="font-bold uppercase tracking-widest text-[10px] text-gray-400">Leave Requests</h3>
              <span className="badge bg-orange-50 text-orange-600 border border-orange-100 font-mono text-[9px] uppercase font-bold">
                {filteredLeave.length} Awaiting Approval
              </span>
              <span className="badge bg-white text-slate-500 border border-slate-100 font-mono text-[9px] uppercase font-bold">
                {filteredLeave.reduce((acc, lv) => acc + calculateLeaveDays(lv.start_date, lv.end_date), 0)} Est. Days
              </span>
            </div>
            {selectedLeaveRequests.size > 0 && (
              <div className="flex gap-2">
                 <button 
                  onClick={() => handleBulkStatusUpdate('leave_requests', selectedLeaveRequests, setSelectedLeaveRequests, 'approved')}
                  className="px-3 py-1 bg-green-600 text-white text-[9px] font-black uppercase rounded hover:bg-green-700 transition-colors"
                >
                  Approve ({selectedLeaveRequests.size})
                </button>
                <button 
                   onClick={() => setRejectionModal({ collection: 'leave_requests', id: '', selectionSet: selectedLeaveRequests, selectionSetter: setSelectedLeaveRequests })}
                   className="px-3 py-1 bg-red-600 text-white text-[9px] font-black uppercase rounded hover:bg-red-700 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
          <div className="divide-y divide-app-bg max-h-[300px] overflow-y-auto px-4">
            {filteredLeave.slice((leavePage - 1) * PAGE_SIZE, leavePage * PAGE_SIZE).map(lv => {
              const emp = employees.find(e => e.id === lv.user_id);
              return (
                <div key={lv.id} className="py-3 flex items-center justify-between hover:bg-gray-50 transition-colors pr-2">
                  <div className="flex items-center gap-3 max-w-[70%]">
                    <input 
                       type="checkbox" 
                       className="w-4 h-4 rounded border-gray-300 text-mine-blue focus:ring-mine-blue cursor-pointer"
                       checked={selectedLeaveRequests.has(lv.id)}
                       onChange={() => toggleSelection(lv.id, selectedLeaveRequests, setSelectedLeaveRequests)}
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold text-gray-900">{emp?.fullName || 'Unknown Staff'}</p>
                        {lv.status === 'pending_approval' && (
                          <span className="text-[7px] font-black bg-amber-100 text-amber-700 px-1 rounded border border-amber-200 uppercase tracking-tighter">Review Req.</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase">{lv.type}</span>
                        <span className="text-[9px] font-mono font-bold text-orange-600">{lv.start_date} &gt; {lv.end_date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 scale-90">
                    <button 
                      onClick={() => handleStatusUpdate('leave_requests', lv.id, 'approved')}
                      className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                    >
                      <Check size={12} />
                    </button>
                    <button 
                      onClick={() => setRejectionModal({ collection: 'leave_requests', id: lv.id })}
                      className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredLeave.length === 0 && (
              <p className="py-8 text-center text-gray-400 text-[10px] uppercase font-bold tracking-widest opacity-50 italic">No waiting leave requests</p>
            )}
          </div>
          <Pagination 
            currentPage={leavePage} 
            totalItems={filteredLeave.length} 
            pageSize={PAGE_SIZE} 
            onPageChange={setLeavePage} 
          />
        </section>

        {/* Loan Requests Approval */}
        <section className="card lg:col-span-2 !p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50/50 border-b">
            <div className="flex items-center gap-3">
              <input 
                 type="checkbox" 
                 className="w-4 h-4 rounded border-gray-300 text-mine-blue focus:ring-mine-blue cursor-pointer"
                 checked={filteredLoans.length > 0 && selectedLoanRequests.size === filteredLoans.length}
                 onChange={() => toggleSelectAllItems(filteredLoans, selectedLoanRequests, setSelectedLoanRequests)}
              />
              <h3 className="font-bold uppercase tracking-widest text-[10px] text-gray-400">Credit Applications</h3>
              <span className="badge bg-blue-50 text-blue-600 border border-blue-100 font-mono text-[9px] uppercase font-bold">
                {filteredLoans.length} Review Required
              </span>
            </div>
            {selectedLoanRequests.size > 0 && (
              <div className="flex gap-2">
                 <button 
                  onClick={() => handleBulkStatusUpdate('loan_requests', selectedLoanRequests, setSelectedLoanRequests, 'approved')}
                  className="px-3 py-1 bg-green-600 text-white text-[9px] font-black uppercase rounded hover:bg-green-700 transition-colors"
                >
                  Approve ({selectedLoanRequests.size})
                </button>
                <button 
                   onClick={() => setRejectionModal({ collection: 'loan_requests', id: '', selectionSet: selectedLoanRequests, selectionSetter: setSelectedLoanRequests })}
                   className="px-3 py-1 bg-red-600 text-white text-[9px] font-black uppercase rounded hover:bg-red-700 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
          <div className="divide-y divide-app-bg max-h-[400px] overflow-y-auto px-4">
            {filteredLoans.slice((loanPage - 1) * PAGE_SIZE, loanPage * PAGE_SIZE).map(l => {
              const emp = employees.find(e => e.id === l.user_id);
              return (
                <div key={l.id} className="py-3 flex items-center justify-between hover:bg-gray-50 transition-colors pr-2">
                  <div className="flex items-center gap-3 max-w-[70%]">
                    <input 
                       type="checkbox" 
                       className="w-4 h-4 rounded border-gray-300 text-mine-blue focus:ring-mine-blue cursor-pointer"
                       checked={selectedLoanRequests.has(l.id)}
                       onChange={() => toggleSelection(l.id, selectedLoanRequests, setSelectedLoanRequests)}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{emp?.fullName || 'Unknown Staff'}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-mono font-bold text-mine-gold tracking-tighter">{l.currency || 'USD'} {l.amount.toFixed(2)} / {l.installmentCount} installments</p>
                        {emp?.branch && (
                          <span className="text-[8px] text-gray-400 font-black uppercase flex items-center gap-0.5 border-l pl-2">
                            <MapPin size={8} /> {emp.branch}
                          </span>
                        )}
                      </div>
                      {l.reason && <p className="text-[9px] text-gray-400 italic mt-0.5 tracking-tight line-clamp-1 truncate w-full">"{l.reason}"</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 scale-90">
                    <button 
                      onClick={() => handleStatusUpdate('loan_requests', l.id, 'approved')}
                      className="p-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => setRejectionModal({ collection: 'loan_requests', id: l.id })}
                      className="p-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredLoans.length === 0 && <p className="p-8 text-center text-gray-400 text-[11px] italic">No pending credit requests found.</p>}
          </div>
          <Pagination 
            currentPage={loanPage} 
            totalItems={filteredLoans.length} 
            pageSize={PAGE_SIZE} 
            onPageChange={setLoanPage} 
          />
        </section>

        {/* PAYROLL MATRIX - {viewMode === 'draft' ? 'DRAFT REVIEW' : 'PUBLISHED ARCHIVE'} */}
        <section className="card lg:col-span-2 !p-0 overflow-hidden bg-white border border-gray-100 shadow-sm">
          <div className={`flex items-center justify-between p-6 ${viewMode === 'draft' ? 'bg-slate-900' : 'bg-mine-blue'} text-white`}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Calculator size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">{viewMode === 'draft' ? 'Draft Payroll Matrix' : 'Published Payroll Ledger'}</h3>
                <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Review {draftPayslips.length} {viewMode} node results</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right hidden md:block">
                  <p className="text-[9px] opacity-50 font-black uppercase tracking-widest">Total Projected Net</p>
                  <p className="text-sm font-black font-mono">USD {draftPayslips.reduce((acc, p) => acc + (p.net_pay || 0), 0).toLocaleString()}</p>
               </div>
               <button 
                onClick={fetchDraftPayslips}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Refresh Matrix"
               >
                 <RefreshCw size={18} />
               </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Employee Profile</th>
                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Base Salary</th>
                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Hrs (Std/OT)</th>
                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right text-mine-green">Gross Pay</th>
                   <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right text-red-500">Ded. (Tax/Loan)</th>
                   <th className="px-6 py-4 text-[10px] font-black text-gray-900 uppercase tracking-widest text-right">Net Salary</th>
                   <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs">
                {draftPayslips.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 group-hover:bg-mine-blue group-hover:text-white transition-colors uppercase">
                          {(p.profiles?.full_name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 uppercase tracking-tight">{p.profiles?.full_name}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{p.profiles?.job_title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-gray-600">
                      {p.currency} {p.base_salary?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-bold text-gray-900">{p.standard_hours}h</span>
                        <span className="text-[9px] font-black text-mine-green uppercase tracking-tighter">+{p.overtime_hours}h OT</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-black text-mine-green">
                      {p.currency} {p.gross_pay?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end font-mono">
                        <span className="text-red-500 font-bold">-{p.tax_amount?.toLocaleString()} PAYE</span>
                        <span className="text-[9px] text-orange-600 font-black tracking-tighter">-{p.loan_deductions?.toLocaleString()} LOAN</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="py-2 px-4 rounded-lg bg-gray-50 border border-gray-100 inline-block">
                        <span className="text-sm font-black font-mono text-gray-900">{p.currency} {p.net_pay?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {viewMode === 'draft' && (
                          <>
                            <button 
                              onClick={() => regenerateSinglePayslip(p.user_id)}
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Recompute calculation for this node"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button 
                              onClick={() => deleteDraftPayslip(p.id)}
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                              title="Purge draft record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {viewMode === 'finalized' && (
                          <span className="text-[9px] font-black text-gray-400 uppercase">ReadOnly</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {draftPayslips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                      <div className="flex flex-col items-center gap-3">
                        <Briefcase size={32} className="opacity-10" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Ready for batch deployment. No draft nodes generated yet.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ZIMRA Tax Calculator */}
        <div>
          <TaxCalculator />
        </div>
      </div>
      </div>
      </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectionModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="p-6 bg-red-50 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <X size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                    Rejection Feedback
                  </h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Provide a reason for the employee</p>
                </div>
              </div>

              <div className="p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Reason for Rejection</label>
                  <textarea 
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="E.g., Incomplete documentation, Missing hours verification..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs min-h-[120px] focus:ring-1 focus:ring-red-500 outline-none transition-all resize-none font-medium"
                    required
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => {
                      setRejectionModal(null);
                      setRejectionReason('');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-500 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!rejectionReason.trim() || processing}
                    onClick={async () => {
                      if (!rejectionModal) return;
                      if (rejectionModal.selectionSet && rejectionModal.selectionSetter) {
                        await handleBulkStatusUpdate(rejectionModal.collection, rejectionModal.selectionSet, rejectionModal.selectionSetter, 'rejected', rejectionReason);
                      } else {
                        await handleStatusUpdate(rejectionModal.collection, rejectionModal.id, 'rejected', false, rejectionReason);
                      }
                      setRejectionModal(null);
                      setRejectionReason('');
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
               <div className={`p-6 flex items-center gap-4 ${confirmAction.type === 'final' ? 'bg-red-50' : 'bg-mine-blue/5'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${confirmAction.type === 'final' ? 'bg-red-100 text-red-600' : 'bg-mine-blue/10 text-mine-blue'}`}>
                  {confirmAction.type === 'final' ? <AlertTriangle size={24} /> : <Calculator size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                    {confirmAction.type === 'final' ? 'Critical Action: Finalize' : 'Initiate Draft Batch'}
                  </h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Period: {confirmAction.monthDisplay}</p>
                  {confirmAction.type === 'draft' && (
                    <p className="text-[10px] font-black text-mine-blue uppercase tracking-widest">Group: {confirmAction.group}</p>
                  )}
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
                      This will calculate gross pay, taxes, and loan deductions for all personnel in the <span className="font-bold text-mine-green">{confirmAction.group}</span> group for the current subsidiary. 
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
