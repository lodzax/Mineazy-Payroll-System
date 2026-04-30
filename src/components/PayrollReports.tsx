import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
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
  { id: 'salary_summary', name: 'Salary Summaries', icon: <TrendingUp size={16} />, table: 'payslips' },
  { id: 'tax_report', name: 'Tax Reports (PAYE/NSSA)', icon: <FileText size={16} />, table: 'payslips' },
  { id: 'loan_deduction', name: 'Loan Deductions', icon: <CreditCard size={16} />, table: 'payslips' },
  { id: 'timesheets', name: 'Timesheets Audit', icon: <Clock size={16} />, table: 'timesheets' },
  { id: 'leave_requests', name: 'Leave Applications', icon: <LogOut size={16} />, table: 'leave_requests' }
];

const PayrollReports: React.FC = () => {
  const { profile, isSuperAdmin, user } = useAuth();
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

      let query = supabase.from(selectedReport.table).select('*');

      // Date filtering
      if (selectedReport.table === 'payslips' || selectedReport.table === 'timesheets') {
        query = query.gte('month_year', startDate).lte('month_year', endDate);
      } else if (selectedReport.table === 'leave_requests') {
        const startDay = `${startDate}-01`;
        const endDay = `${endDate}-31`;
        query = query.gte('start_date', startDay).lte('start_date', endDay);
      }

      const { data: rawData, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!rawData || rawData.length === 0) {
        setError('No data found for the selected range and parameters.');
        setIsGenerating(false);
        return;
      }

      // Fetch employees for display names
      const { data: usersData, error: userError } = await supabase.from('profiles').select('id, full_name');
      if (userError) throw userError;
      const empMap = new Map((usersData || []).map(u => [u.id, u.full_name]));

      let exportData: any[] = [];

      switch (reportType) {
        case 'salary_summary':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.user_id) || 'Unknown',
            'Period': d.month_year,
            'Basic Salary': d.base_salary,
            'Gross Pay': d.gross_pay,
            'Total Deductions': d.total_deductions,
            'Net Pay': d.net_pay,
            'Currency': d.currency,
          }));
          break;
        case 'tax_report':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.user_id) || 'Unknown',
            'Period': d.month_year,
            'Gross Pay': d.gross_pay,
            'PAYE Tax': d.tax_amount,
            'NSSA Deduction': d.nssa_deduction,
            'Currency': d.currency
          }));
          break;
        case 'loan_deduction':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.user_id) || 'Unknown',
            'Period': d.month_year,
            'Loan Amount': d.loan_deductions,
            'Currency': d.currency,
            'Status': d.status || 'Processed'
          }));
          break;
        case 'timesheets':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.user_id) || 'Unknown',
            'Date': d.date,
            'Month': d.month_year,
            'Hours Worked': d.hours_worked,
            'Overtime Hours': d.overtime_hours,
            'Status': d.status,
          }));
          break;
        case 'leave_requests':
          exportData = rawData.map((d: any) => ({
            'Employee Name': empMap.get(d.user_id) || 'Unknown',
            'Type': d.type,
            'Start Date': d.start_date,
            'End Date': d.end_date,
            'Status': d.status,
            'Reason': d.reason || ''
          }));
          break;
      }

      if (exportData.length === 0) {
        setError('Data processing resulted in empty set.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payroll Report");
      XLSX.writeFile(wb, `Mineazy_${reportType}_${startDate}_${endDate}.xlsx`);

      await logAction({
        action: 'Report Generation',
        category: 'report',
        details: `Generated ${selectedReport.name} for period ${startDate} to ${endDate}. Records: ${exportData.length}`,
        userName: profile?.full_name || user?.email,
        userEmail: user?.email || ''
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
          <div className="p-2 bg-mine-blue/10 text-mine-blue rounded-lg">
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
                      ? 'bg-mine-blue text-white border-mine-blue shadow-lg shadow-blue-100' 
                      : 'bg-white text-gray-500 border-gray-100 hover:border-mine-blue hover:text-mine-blue'
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
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue"
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
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue"
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
