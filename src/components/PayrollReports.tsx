import React, { useState } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logAction } from '../services/loggerService';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  Loader2, 
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  CreditCard,
  Clock,
  LogOut
} from 'lucide-react';
import { motion } from 'motion/react';

const REPORT_TYPES = [
  { id: 'salary_summary', name: 'Salary Summaries', icon: <TrendingUp size={16} />, collection: 'payslips' },
  { id: 'tax_report', name: 'Tax Reports (PAYE/NSSA)', icon: <FileText size={16} />, collection: 'payslips' },
  { id: 'loan_deduction', name: 'Loan Deductions', icon: <CreditCard size={16} />, collection: 'payslips' },
  { id: 'timesheets', name: 'Timesheets Audit', icon: <Clock size={16} />, collection: 'timesheets' },
  { id: 'leave_applications', name: 'Leave Applications', icon: <LogOut size={16} />, collection: 'leave_applications' }
];

const PayrollReports: React.FC = () => {
  const { profile, isSuperAdmin } = useAuth();
  const [reportType, setReportType] = useState('salary_summary');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const selectedReport = REPORT_TYPES.find(r => r.id === reportType);
      if (!selectedReport) return;

      const collRef = collection(db, selectedReport.collection);
      let q = query(collRef);

      // Filtering by subsidiary for regular admins
      if (!isSuperAdmin && profile?.subsidiaryId) {
        q = query(q, where('subsidiaryId', '==', profile.subsidiaryId));
      }

      // Special handling for date filtering based on collection type
      if (selectedReport.collection === 'payslips' || selectedReport.collection === 'timesheets') {
        // These collections typically use 'month' (YYYY-MM)
        q = query(q, where('month', '>=', startDate), where('month', '<=', endDate));
      } else if (selectedReport.collection === 'leave_applications') {
        // Leave uses startDate/endDate strings or Timestamps?
        // Based on AdminDashboard, it looks like strings (YYYY-MM-DD)
        // We'll filter leave by startDate in the selected range
        const startDay = `${startDate}-01`;
        const endDay = `${endDate}-31`; // Rough approximation for end of month
        q = query(q, where('startDate', '>=', startDay), where('startDate', '<=', endDay));
      }

      const snapshot = await getDocs(q);
      const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (rawData.length === 0) {
        setError('No data found for the selected range and parameters.');
        setIsGenerating(false);
        return;
      }

      // Post-process data for export based on report type
      let exportData: any[] = [];

      // Fetch employees for display names if needed
      const empSnap = await getDocs(collection(db, 'users'));
      const empMap = new Map(empSnap.docs.map(d => [d.id, d.data().fullName]));

      switch (reportType) {
        case 'salary_summary':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.employeeId) || 'Unknown',
            'Period': d.month,
            'Basic Salary': d.baseSalary,
            'Gross Pay': d.grossPay,
            'Total Deductions': d.totalDeductions,
            'Net Pay': d.netPay,
            'Currency': d.currency,
            'Status': d.isPublished ? 'Published' : 'Draft'
          }));
          break;
        case 'tax_report':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.employeeId) || 'Unknown',
            'Period': d.month,
            'Gross Pay': d.grossPay,
            'PAYE Tax': d.taxAmount,
            'AIDS Levy': d.aidsLevy,
            'NSSA Deduction': d.nssaDeduction,
            'Currency': d.currency
          }));
          break;
        case 'loan_deduction':
          exportData = rawData.filter((d: any) => d.loanDeductions > 0).map((d: any) => ({
            'Employee Name': empMap.get(d.employeeId) || 'Unknown',
            'Period': d.month,
            'Gross Pay': d.grossPay,
            'Loan Repayment': d.loanDeductions,
            'Currency': d.currency
          }));
          break;
        case 'timesheets':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.employeeId) || d.employeeName || 'Unknown',
            'Date/Month': d.date || d.month,
            'Hours Worked': d.hoursWorked,
            'Overtime Hours': d.overtimeHours,
            'Status': d.status,
            'Reviewed By': d.reviewedBy || 'N/A'
          }));
          break;
        case 'leave_applications':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.employeeId) || 'Unknown',
            'Type': d.type,
            'Start Date': d.startDate,
            'End Date': d.endDate,
            'Status': d.status,
            'Reason': d.reason || ''
          }));
          break;
      }

      if (exportData.length === 0) {
        setError('Data processing resulted in empty set.');
        return;
      }

      // Export to Excel
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payroll Report");
      XLSX.writeFile(wb, `Mineazy_${reportType}_${startDate}_${endDate}.xlsx`);

      await logAction({
        action: 'Report Generation',
        category: 'report',
        details: `Generated ${selectedReport.name} for period ${startDate} to ${endDate}. Records: ${exportData.length}`,
        userName: profile?.fullName,
        userEmail: profile?.email || ''
      });

    } catch (err: any) {
      console.error("Report generation failed:", err);
      setError("Failed to fetch node data for reports.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="card bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-mine-green/10 text-mine-green rounded-lg">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter">Personnel Intelligence Reports</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Aggregate and export node data</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Report Type */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Dataset Category</label>
            <div className="grid grid-cols-1 gap-2">
              {REPORT_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setReportType(type.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    reportType === type.id 
                      ? 'bg-mine-green text-white border-mine-green shadow-lg shadow-green-100' 
                      : 'bg-white text-gray-500 border-gray-100 hover:border-mine-green hover:text-mine-green'
                  }`}
                >
                  {type.icon}
                  {type.name}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration */}
          <div className="md:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Start Period (Inclusive)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="month" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-mine-green"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">End Period (Inclusive)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input 
                    type="month" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-mine-green"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-700">
              <Filter size={18} className="shrink-0 mt-0.5" />
              <div className="text-[10px] font-medium leading-relaxed">
                <p className="font-black uppercase tracking-widest mb-1">Active Parameters</p>
                <p>Exporting <span className="font-bold underline">{REPORT_TYPES.find(r => r.id === reportType)?.name}</span> for the duration from <span className="font-bold italic">{startDate}</span> to <span className="font-bold italic">{endDate}</span>. Reports will be generated as encrypted XLSX workbooks.</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-tight">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="w-full btn btn-primary !py-4 flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98]"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              <span className="text-sm font-black uppercase tracking-widest">Generate Analysis Workbook</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PayrollReports;
