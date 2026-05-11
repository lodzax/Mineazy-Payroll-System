import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { logAction } from '../services/loggerService';
import { Calendar, CheckCircle, Send, AlertCircle, MapPin, ChevronLeft, ChevronRight, Info, AlertTriangle, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ZIM_PUBLIC_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-02-21', // Youth Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-04-18', // Independence Day
  '2026-05-01', // Workers' Day
  '2026-05-25', // Africa Day
  '2026-08-10', // Heroes' Day
  '2026-08-11', // Defense Forces Day
  '2026-12-22', // Unity Day
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day
];

const Pagination: React.FC<{
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-t border-app-bg">
      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
        {currentPage} / {totalPages}
      </span>
      <div className="flex gap-1">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1 rounded bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-mine-blue transition-all"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1 rounded bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-mine-blue transition-all"
        >
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};

const LeaveForm: React.FC = () => {
  const { user, profile } = useAuth();
  const [type, setType] = useState('annual');
  const [requestedDays, setRequestedDays] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedLeave, setSelectedLeave] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingLeave, setViewingLeave] = useState<any | null>(null);
  const PAGE_SIZE = 5;

  const [dateStats, setDateStats] = useState({
    totalDays: 0,
    workingDays: 0,
    weekends: 0,
    holidays: 0
  });

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end >= start) {
        let current = new Date(start);
        let total = 0;
        let working = 0;
        let weekends = 0;
        let holidays = 0;

        while (current <= end) {
          total++;
          const dayOfWeek = current.getDay();
          const dateString = current.toISOString().split('T')[0];
          
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isHoliday = ZIM_PUBLIC_HOLIDAYS_2026.includes(dateString);

          if (isWeekend) {
            weekends++;
          } else if (isHoliday) {
            holidays++;
          } else {
            working++;
          }

          current.setDate(current.getDate() + 1);
        }

        setDateStats({ totalDays: total, workingDays: working, weekends, holidays });
      } else {
        setDateStats({ totalDays: 0, workingDays: 0, weekends: 0, holidays: 0 });
      }
    } else {
      setDateStats({ totalDays: 0, workingDays: 0, weekends: 0, holidays: 0 });
    }
  }, [startDate, endDate]);

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setHistory((data || []).map(lv => ({
        ...lv,
        startDate: lv.start_date,
        endDate: lv.end_date,
        rejectionReason: lv.rejection_reason || lv.manager_feedback,
        managerFeedback: lv.manager_feedback
      })));
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    try {
      const isCashInLieu = type === 'cash_in_lieu';
      const today = new Date().toISOString().split('T')[0];

      const leaveData: any = {
        user_id: user.id,
        subsidiary_id: profile?.subsidiary_id || null,
        type,
        start_date: isCashInLieu ? today : startDate,
        end_date: isCashInLieu ? today : endDate,
        requested_days: isCashInLieu ? requestedDays : null,
        reason,
        status: 'pending_approval',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('leave_requests').insert(leaveData);

      if (error) {
        console.error("Leave Submission Error:", error);
        throw error;
      }

      setMessage({ type: 'success', text: `Leave request for ${type} transmitted to HQ.` });
      setTimeout(() => setMessage(null), 5000);

      await logAction({
        action: 'Leave Application Submitted',
        category: 'personnel',
        details: `Requested ${type} leave from ${startDate} to ${endDate}. Working days: ${dateStats.workingDays}.`,
        userName: profile?.full_name || user.displayName,
        userEmail: user.email
      });

      setMessage({ type: 'success', text: 'Leave application submitted' });
      setStartDate('');
      setEndDate('');
      setReason('');
      fetchHistory();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to submit application' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 italic serif">Leave Management</h1>
          <p className="text-gray-500">Plan your time away from the mine operations</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white border border-gray-100 rounded-xl px-6 py-3 flex items-center gap-4 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Applications</p>
              <p className="text-xl font-black text-mine-blue font-mono">
                {history.length}
              </p>
            </div>
            <FileText className="text-mine-blue/30" size={24} />
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-6 py-3 flex items-center gap-4 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Available Balance</p>
              <p className="text-xl font-black text-orange-600 font-mono">
                {(profile?.annual_leave_balance ?? 0).toFixed(1)} Days
              </p>
            </div>
            <Calendar className="text-orange-300" size={24} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Leave Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-blue focus:outline-none transition-all"
              >
                <option value="annual">Annual Leave</option>
                <option value="cash_in_lieu">Cash In-Lieu of Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="study">Study Leave</option>
                <option value="compassionate">Compassionate</option>
              </select>
            </div>
            {type === 'cash_in_lieu' ? (
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Days to Cash Out</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max={profile?.annual_leave_balance || 0}
                  value={requestedDays}
                  onChange={(e) => setRequestedDays(parseFloat(e.target.value))}
                  className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-blue focus:outline-none transition-all font-mono"
                  required
                />
                <p className="text-[9px] text-orange-600 mt-1 font-bold">
                  Available: {(profile?.annual_leave_balance ?? 0).toFixed(1)} Days
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-blue focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Until Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-blue focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Supporting Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-blue focus:outline-none transition-all resize-none"
                placeholder="Logistics or details..."
              />
            </div>

            {startDate && endDate && (
              <div className="bg-gray-50/50 border border-app-bg rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Info size={12} className="text-mine-blue" /> Application Summary
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-mine-blue">{dateStats.totalDays} Calendar Days</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white p-2 rounded-lg border border-gray-100 flex flex-col items-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Working</p>
                    <p className="text-sm font-black text-gray-900">{dateStats.workingDays}</p>
                  </div>
                  <div className={`p-2 rounded-lg border flex flex-col items-center ${dateStats.weekends > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Weekend</p>
                    <p className={`text-sm font-black ${dateStats.weekends > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{dateStats.weekends}</p>
                  </div>
                  <div className={`p-2 rounded-lg border flex flex-col items-center ${dateStats.holidays > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Holiday</p>
                    <p className={`text-sm font-black ${dateStats.holidays > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{dateStats.holidays}</p>
                  </div>
                </div>

                {type === 'annual' && dateStats.workingDays > (profile?.annual_leave_balance ?? 0) && (
                  <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
                    <p className="text-[10px] font-bold text-red-700 leading-tight">
                      Insufficient Balance. Requested working days ({dateStats.workingDays}) exceed your available vault credits ({(profile?.annual_leave_balance ?? 0).toFixed(1)}).
                    </p>
                  </div>
                )}

                {(dateStats.weekends > 0 || dateStats.holidays > 0) && (
                  <div className="bg-orange-50 border border-orange-100 p-2.5 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                    <p className="text-[10px] font-bold text-orange-700 leading-tight">
                      Date Range contains {dateStats.weekends > 0 ? `${dateStats.weekends} weekend day(s)` : ''} {dateStats.weekends > 0 && dateStats.holidays > 0 ? 'and' : ''} {dateStats.holidays > 0 ? `${dateStats.holidays} statutory holiday(s)` : ''}. These are usually non-deductible in payroll.
                    </p>
                  </div>
                )}
              </div>
            )}

            {message && (
              <div className={`p-3 rounded-md flex items-center gap-2 text-xs font-semibold ${
                message.type === 'success' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
              }`}>
                {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <p>{message.text}</p>
              </div>
            )}

            <button
              disabled={loading}
              className="btn btn-primary w-full !py-3.5 !text-sm flex items-center justify-center gap-2 mt-4"
            >
              <Send size={16} />
              {loading ? 'Submitting...' : 'Initiate Request'}
            </button>
          </form>
        </section>

        <section className="card !p-0 overflow-hidden">
          <div className="p-4 border-b border-app-bg flex items-center gap-2 bg-gray-50/50">
            <Calendar className="text-gray-400" size={16} />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Leave Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-app-bg text-gray-400 font-bold uppercase tracking-tighter">
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Duration</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-bg">
                {history.length > 0 ? history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((l) => (
                  <tr 
                    key={l.id} 
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                    onClick={() => setViewingLeave(l)}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-700 capitalize">
                      <div className="flex items-center justify-between">
                        {l.type}
                        <Info size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-mine-blue" />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-500 whitespace-nowrap">
                      {l.type === 'cash_in_lieu' ? (
                        <span className="font-bold text-mine-blue">{l.requested_days || 0} DAYS CASH-OUT</span>
                      ) : (
                        `${l.startDate} > ${l.endDate}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`badge ${
                        l.status === 'approved' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        l.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                        l.status === 'pending_approval' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        'bg-gray-50 text-gray-700 border border-gray-100'
                      }`}>
                        {l.status === 'pending_approval' ? 'Pending Approval' : l.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">No leave requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {history.length > 0 && (
              <Pagination 
                currentPage={currentPage}
                totalItems={history.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {viewingLeave && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 px-10">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-mine-blue/5 flex items-center justify-center text-mine-blue">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Leave Node Inspection</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Request ID: {viewingLeave.id.slice(0, 8)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingLeave(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status Identifier</p>
                    <span className={`badge ${
                      viewingLeave.status === 'approved' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                      viewingLeave.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                      viewingLeave.status === 'pending_approval' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                      'bg-gray-50 text-gray-700 border border-gray-100'
                    }`}>
                      {viewingLeave.status === 'pending_approval' ? 'Pending Approval' : viewingLeave.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Category</p>
                    <p className="text-sm font-black text-gray-900 uppercase tracking-widest">{viewingLeave.type}</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                   {viewingLeave.type === 'cash_in_lieu' ? (
                     <div className="flex justify-between items-center text-mine-blue">
                       <span className="text-[9px] font-black uppercase">Requested Cash-out</span>
                       <span className="text-sm font-black font-mono">{viewingLeave.requested_days || viewingLeave.requestedDays} DAYS</span>
                     </div>
                   ) : (
                     <React.Fragment>
                       <div className="flex justify-between">
                         <span className="text-[9px] font-black text-gray-400 uppercase">Commencement</span>
                         <span className="text-xs font-bold font-mono">{viewingLeave.startDate}</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-[9px] font-black text-gray-400 uppercase">Conclusion</span>
                         <span className="text-xs font-bold font-mono">{viewingLeave.endDate}</span>
                       </div>
                     </React.Fragment>
                   )}
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Employee Reason</p>
                  <p className="text-xs text-gray-600 italic leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                    "{viewingLeave.reason || 'No description provided'}"
                  </p>
                </div>

                {(viewingLeave.rejection_reason || viewingLeave.rejectionReason || viewingLeave.manager_feedback || viewingLeave.managerFeedback) && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={10} className={viewingLeave.status === 'rejected' ? 'text-red-500' : 'text-mine-blue'} />
                      <p className={`text-[9px] font-black uppercase tracking-widest ${viewingLeave.status === 'rejected' ? 'text-red-600' : 'text-mine-blue'}`}>
                        {viewingLeave.status === 'rejected' ? 'Auditor Rejection Feedback' : 'Manager Review Feedback'}
                      </p>
                    </div>
                    <div className={`p-4 rounded-xl text-xs font-bold border italic leading-relaxed shadow-sm ${viewingLeave.status === 'rejected' ? 'bg-red-50/50 text-red-700 border-red-100/50' : 'bg-blue-50/50 text-blue-700 border-blue-100/50'}`}>
                      "{viewingLeave.rejection_reason || viewingLeave.rejectionReason || viewingLeave.manager_feedback || viewingLeave.managerFeedback}"
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => setViewingLeave(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all font-bold"
                >
                  Close Data Node
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveForm;
