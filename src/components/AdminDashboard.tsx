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
  FileDown,
  FileUp
} from 'lucide-react';
import { calculatePaye, calculateNssa, USD_TAX_BANDS, ZWG_TAX_BANDS } from '../lib/payrollUtils';
import TaxCalculator from './TaxCalculator';
import PayrollReports from './PayrollReports';
import PayrollBatchManagement from './PayrollBatchManagement';
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
  const [payrollGroupFilter, setPayrollGroupFilter] = useState('General');
  const [isBatchFinalized, setIsBatchFinalized] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'draft' | 'final', monthDisplay: string, group?: string } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'run' | 'batches' | 'reports'>('run');
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedTimesheets, setSelectedTimesheets] = useState<Set<string>>(new Set());
  const [selectedLeaveRequests, setSelectedLeaveRequests] = useState<Set<string>>(new Set());
  const [selectedLoanRequests, setSelectedLoanRequests] = useState<Set<string>>(new Set());
  
  // Pagination states
  const [loanPage, setLoanPage] = useState(1);
  const [timesheetPage, setTimesheetPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);
  const PAGE_SIZE = 5;

  const fetchData = async () => {
    setLoading(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const specificSubId = subFilter || profile?.subsidiary_id;
      
      const { data: batchData } = await supabase
        .from('payroll_batches')
        .select('*')
        .eq('month_year', month);

      const finalized = (batchData || []).some(b => b.status === 'finalized' && (!specificSubId || b.subsidiary_id === specificSubId || b.subsidiary_id === 'all'));
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
        payrollGroup: u.payroll_group || 'General'
      }));
      const allSubs: any[] = (subRes.data || []);
      
      if (effectivelySuperAdmin && subFilter) {
        allEmps = allEmps.filter((e: any) => e.subsidiaryId === subFilter);
      }

      setEmployees(allEmps);
      setSubsidiaries(allSubs);

      // Fetch pending requests (loans, timesheets, leaves)
      const fetchCollection = async (table: string) => {
        let q = supabase.from(table).select('*').in('status', ['pending', 'submitted']);
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
  }, [authLoading, subFilter, isSuperAdmin, profile?.subsidiary_id]);

  const calculateLeaveDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleStatusUpdate = async (collectionName: string, id: string, status: string, skipRefresh = false) => {
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
      if (collectionName === 'leave_requests' && status === 'approved' && record.status !== 'approved' && record.type === 'annual') {
        const { data: emp, error: empErr } = await supabase
          .from('profiles')
          .select('annual_leave_balance')
          .eq('id', record.user_id)
          .maybeSingle();
          
        if (empErr) throw empErr;

        if (emp) {
          const leaveDays = calculateLeaveDays(record.start_date, record.end_date);
          const currentAnnual = emp.annual_leave_balance || 0;

          const { error: profileUpdateErr } = await supabase
            .from('profiles')
            .update({
              annual_leave_balance: currentAnnual - leaveDays
            })
            .eq('id', record.user_id);
          
          if (profileUpdateErr) throw profileUpdateErr;
          console.log(`Deducted ${leaveDays} days from employee ${record.user_id}`);
        } else {
          console.warn(`CRITICAL: Personnel profile missing for user ${record.user_id}. Leave deduction skipped for request ${id}.`);
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
        userName: profile?.fullName || user?.displayName || user?.email || 'Admin',
        userEmail: user?.email || 'admin@system.local'
      });

      console.log(`Status update successful: ${collectionName}.${id} -> ${status}`);
      if (!skipRefresh) {
        toast.success(`Success: Record marked as ${status}`);
        fetchData();
      }
    } catch (err: any) {
      console.error("Transactional clear failed:", err);
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

  const handleBulkStatusUpdate = async (collectionName: string, selectionSet: Set<string>, selectionSetter: React.Dispatch<React.SetStateAction<Set<string>>>, status: string) => {
    if (selectionSet.size === 0) return;
    setProcessing(true);
    let successCount = 0;
    let failCount = 0;
    try {
      const ids = Array.from(selectionSet);
      // Process one by one to handle balance updates logic in handleStatusUpdate
      for (const id of ids) {
        try {
          await handleStatusUpdate(collectionName, id, status, true);
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
    const displayMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    setConfirmAction({ type: 'draft', monthDisplay: displayMonth, group: payrollGroupFilter });
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
      // 1. Check for existing payslips
      const { data: existingPayslips } = await supabase
        .from('payslips')
        .select('user_id')
        .eq('month_year', month);

      const existingUserIds = new Set((existingPayslips || []).map(d => d.user_id));
      const eligibleEmployees = employees.filter(emp => 
        !existingUserIds.has(emp.id) && emp.payrollGroup === confirmAction?.group
      );
      
      if (eligibleEmployees.length === 0) {
        setPayrollStatus({ type: 'info', message: `All active personnel in the ${confirmAction?.group} group have existing payslips for this period.` });
        setProcessing(false);
        return;
      }

      // 2. Fetch approved timesheets and loans
      const [timesheetsRes, loansRes] = await Promise.all([
        supabase.from('timesheets').select('*').eq('month_year', month).eq('status', 'approved'),
        supabase.from('loan_requests').select('*').eq('status', 'approved')
      ]);

      const approvedTimesheets = timesheetsRes.data || [];
      const approvedLoans = loansRes.data || [];

      let count = 0;
      for (const emp of eligibleEmployees) {
        const empTimesheets = approvedTimesheets.filter(d => d.user_id === emp.id);
        
        const standardHours = empTimesheets.reduce((acc, curr) => acc + (curr.hours_worked || 0), 0);
        const overtimeHours = empTimesheets.reduce((acc, curr) => acc + (curr.overtime_hours || 0), 0);
        
        const hourlyRate = (emp.baseSalary || 0) / 160;
        const overtimePay = overtimeHours * (hourlyRate * 1.5);
        const basePay = emp.baseSalary || 0;
        const totalGross = basePay + overtimePay;

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
        const netPay = totalGross - totalDeductions;
        const newBalance = (emp.annual_leave_balance || 0) + 2.5;

        const { error: payslipErr } = await supabase.from('payslips').insert({
          user_id: emp.id,
          subsidiary_id: emp.subsidiaryId || null,
          month_year: month,
          month_display: displayMonth,
          base_salary: basePay,
          overtime_pay: overtimePay,
          standard_hours: standardHours,
          overtime_hours: overtimeHours,
          gross_pay: totalGross,
          tax_amount: tax,
          aids_levy: aidsLevy,
          nssa_deduction: nssa,
          loan_deductions: loanDeduction,
          total_deductions: totalDeductions,
          net_pay: netPay,
          currency: emp.currency || 'USD',
          is_published: false,
          generated_at: new Date().toISOString(),
          breakdown: {
            hourlyRate: hourlyRate.toFixed(2),
            overtimeRate: (hourlyRate * 1.5).toFixed(2),
            nssaRate: emp.currency === 'ZWG' ? '4.5%' : '4.5% (ZWG Base)',
            loanCount: empLoans.length
          }
        });

        if (!payslipErr) {
          await supabase.from('profiles').update({ 
            annual_leave_balance: newBalance
          }).eq('id', emp.id);
          count++;
        }
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
    try {
      const month = new Date().toISOString().slice(0, 7);
      const subIdRaw = subFilter || profile?.subsidiaryId || 'all';
      const subId = subIdRaw === 'all' ? null : subIdRaw;

      // 1. Create/Update Batch Status
      await supabase.from('payroll_batches').upsert({
        subsidiary_id: subId,
        month_year: month,
        status: 'finalized',
        finalized_at: new Date().toISOString(),
        finalized_by: user?.email
      }, { onConflict: 'subsidiary_id,month_year' });

      // 2. Publish all draft payslips
      let q = supabase.from('payslips').update({ is_published: true }).eq('month_year', month).eq('is_published', false);
      if (subId !== 'all') {
        q = q.eq('subsidiary_id', subId);
      }
      const { data, error } = await q.select('*');

      if (error) throw error;
      const publishedCount = data?.length || 0;

      await logAction({
        action: 'Payroll Finalization',
        category: 'payroll',
        details: `Finalized and published ${publishedCount} payslips for period ${month}. Subsidiary: ${subId}.`,
        userName: profile?.fullName || user?.email,
        userEmail: user?.email
      });

      setPayrollStatus({ type: 'success', message: `Payroll successfully Finalized & Published (${publishedCount} records updated).` });
      fetchData();
    } catch (err) {
      console.error(err);
      setPayrollStatus({ type: 'error', message: 'Finalization failed. Internal sync error.' });
    } finally {
      setProcessing(false);
    }
  };

  const exportPayrollToExcel = async () => {
    setProcessing(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const subIdRaw = subFilter || profile?.subsidiaryId || 'all';
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
        .eq('is_published', false);

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
          'Base Salary': d.basic_salary,
          'Hours Worked': d.standard_hours,
          'Overtime Hours': d.overtime_hours,
          'Overtime Pay': d.overtime_pay,
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
        userName: profile?.fullName || user?.email,
        userEmail: user?.email
      });

      let updateCount = 0;

      for (const row of jsonData) {
        if (row.ID) {
          const { error } = await supabase
            .from('payslips')
            .update({
              basic_salary: Number(row['Base Salary']),
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
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Requests</p>
            <p className="text-xl font-black text-gray-900 font-mono">{loanRequests.length + timesheetRequests.length + leaveRequests.length}</p>
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

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('run')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'run' ? 'bg-white text-mine-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Payroll Run
        </button>
        <button 
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'batches' ? 'bg-white text-mine-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Batch Management
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'reports' ? 'bg-white text-mine-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Insights & Reports
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'batches' && (
          <motion.div
            key="batches"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PayrollBatchManagement />
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

        {activeTab === 'run' && (
          <motion.div
            key="run"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Stats and Queues nested here */}
            <div className="space-y-8">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-mine-green flex items-center gap-2 uppercase tracking-tight">
            <ShieldCheck size={20} /> Payroll Control Center
          </h1>
          <p className="text-xs text-gray-500 font-medium">Monitoring and processing Mineazy solution operations</p>
        </div>
        <div className="flex flex-col md:flex-row items-end gap-3">
          <div className="relative group min-w-[300px]">
             <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-mine-green transition-colors" size={16} />
             <input 
               type="text"
               placeholder="Global Search (Name, Status, Reason...)"
               value={globalSearch}
               onChange={(e) => setGlobalSearch(e.target.value)}
               className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 shadow-sm rounded text-xs outline-none focus:ring-1 focus:ring-mine-green transition-all"
             />
          </div>
          <div className="flex flex-col items-end">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Payroll Group</label>
            <select 
              value={payrollGroupFilter}
              onChange={(e) => setPayrollGroupFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-green min-w-[150px]"
            >
              <option value="General">General Staff</option>
              <option value="Management">Management</option>
            </select>
          </div>
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
        {/* Timesheet Approval Queue */}
        <section className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50/50 border-b">
            <div className="flex items-center gap-3">
              <input 
                 type="checkbox" 
                 className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
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
                   onClick={() => handleBulkStatusUpdate('timesheets', selectedTimesheets, setSelectedTimesheets, 'rejected')}
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
                       className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                       checked={selectedTimesheets.has(t.id)}
                       onChange={() => toggleSelection(t.id, selectedTimesheets, setSelectedTimesheets)}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{emp?.fullName || 'Unknown Staff'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold text-gray-400">{t.date}</span>
                        <span className="text-[10px] font-black text-mine-green uppercase tracking-tighter">
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
                      onClick={() => handleStatusUpdate('timesheets', t.id, 'rejected')}
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
                 className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                 checked={filteredLeave.length > 0 && selectedLeaveRequests.size === filteredLeave.length}
                 onChange={() => toggleSelectAllItems(filteredLeave, selectedLeaveRequests, setSelectedLeaveRequests)}
              />
              <h3 className="font-bold uppercase tracking-widest text-[10px] text-gray-400">Leave Requests</h3>
              <span className="badge bg-orange-50 text-orange-600 border border-orange-100 font-mono text-[9px] uppercase font-bold">
                {filteredLeave.length} Waiting
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
                   onClick={() => handleBulkStatusUpdate('leave_requests', selectedLeaveRequests, setSelectedLeaveRequests, 'rejected')}
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
                       className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
                       checked={selectedLeaveRequests.has(lv.id)}
                       onChange={() => toggleSelection(lv.id, selectedLeaveRequests, setSelectedLeaveRequests)}
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{emp?.fullName || 'Unknown Staff'}</p>
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
                      onClick={() => handleStatusUpdate('leave_requests', lv.id, 'rejected')}
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
                 className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
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
                   onClick={() => handleBulkStatusUpdate('loan_requests', selectedLoanRequests, setSelectedLoanRequests, 'rejected')}
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
                       className="w-4 h-4 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer"
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
                      onClick={() => handleStatusUpdate('loan_requests', l.id, 'rejected')}
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
                  {confirmAction.type === 'draft' && (
                    <p className="text-[10px] font-black text-mine-green uppercase tracking-widest">Group: {confirmAction.group}</p>
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
