import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { logAction } from '../services/loggerService';
import { Clock, CheckCircle, Send, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, FileUp, Download, Pencil, X, Trash2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';

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
          className="p-1 rounded bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-mine-green transition-all"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1 rounded bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-mine-green transition-all"
        >
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};

const TimesheetForm: React.FC = () => {
  const { user, profile } = useAuth();
  const [submissionMode, setSubmissionMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('8');
  const [overtime, setOvertime] = useState('0');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editOvertime, setEditOvertime] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [viewingEntry, setViewingEntry] = useState<any | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkHours, setBulkHours] = useState('');
  const [bulkOvertime, setBulkOvertime] = useState('');
  const [bulkDescription, setBulkDescription] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error(error);
      if (error.code === 'PGRST204') {
        setMessage({ 
          type: 'error', 
          text: 'Database schema mismatch. Please run the SQL in supabase_schema.sql to add missing columns (submission_mode, subsidiary_id).' 
        });
      }
    } else {
      setHistory((data || []).map(t => ({
        ...t,
        employeeId: t.user_id,
        hoursWorked: t.hours_worked,
        overtimeHours: t.overtime_hours,
        submissionMode: t.submission_mode,
        submittedAt: t.submitted_at
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
      const month = date.slice(0, 7); // YYYY-MM
      const timesheetData = {
        user_id: user.id,
        subsidiary_id: profile?.subsidiary_id || null,
        submission_mode: submissionMode,
        date,
        month_year: month,
        description,
        hours_worked: Number(hours),
        overtime_hours: Number(overtime) || 0,
        status: 'pending',
        submitted_at: new Date().toISOString()
      };

      const { error } = await supabase.from('timesheets').insert(timesheetData);

      if (error) {
        console.error("Timesheet Submission Error:", error);
        throw error;
      }
      const modeLabel = submissionMode ? (submissionMode.charAt(0).toUpperCase() + submissionMode.slice(1)) : 'Timesheet';
      setMessage({ type: 'success', text: `${modeLabel} submission logged in the ledger.` });
      
      // Auto-clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
      
      await logAction({
        action: 'Timesheet Submission',
        category: 'performance',
        details: `Submitted ${submissionMode} timesheet for ${date}: ${hours}h std, ${overtime}h OT.`,
        userName: profile?.full_name || user.email,
        userEmail: user.email
      });

      // Reset defaults based on mode
      if (submissionMode === 'daily') setHours('8');
      else if (submissionMode === 'weekly') setHours('40');
      else setHours('160');
      
      setOvertime('0');
      setDescription('');
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      const text = err.code === 'PGRST204' 
        ? 'Database schema mismatch (submission_mode column missing). Please update schema.' 
        : 'Failed to submit timesheet';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['date', 'hoursWorked', 'overtimeHours', 'description', 'submissionMode'];
    const example = [
      ['2026-04-20', '8', '2', 'Daily mining operation tasks', 'daily'],
      ['2026-04-18', '40', '5', 'Weekly summary of shaft maintenance', 'weekly'],
      ['2026-04-01', '160', '0', 'Standard monthly engineering support', 'monthly']
    ];
    const csvContent = [headers, ...example].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "timesheet_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    setMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const validModes = ['daily', 'weekly', 'monthly'];
          let successCount = 0;
          
          for (const row of results.data as any[]) {
            const dateStr = (row.date || '').trim();
            if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
            
            const month = dateStr.slice(0, 7);
            const mode = validModes.includes(row.submissionMode?.toLowerCase()) 
                         ? row.submissionMode.toLowerCase() 
                         : 'daily';
            
            const { error } = await supabase.from('timesheets').insert({
              user_id: user.id,
              subsidiary_id: profile?.subsidiary_id || null,
              submission_mode: mode,
              date: dateStr,
              month_year: month,
              description: row.description || 'Bulk Import',
              hours_worked: Number(row.hoursWorked) || 0,
              overtime_hours: Number(row.overtimeHours) || 0,
              status: 'pending',
              submitted_at: new Date().toISOString()
            });
            if (!error) successCount++;
          }

          if (successCount > 0) {
            await logAction({
              action: 'Bulk Timesheet Import',
              category: 'performance',
              details: `Successfully imported ${successCount} timesheet entries via CSV.`,
              userName: profile?.full_name || user.email,
              userEmail: user.email
            });
          }

          setMessage({ type: 'success', text: successCount > 0 
            ? `Successfully imported ${successCount} entries` 
            : 'No valid entries found in CSV' });
          fetchHistory();
        } catch (err: any) {
          console.error(err);
          const text = err.code === 'PGRST204' 
            ? 'Database schema mismatch (submission_mode missing). Please update schema.' 
            : 'Failed to process bulk import. Check file format.';
          setMessage({ type: 'error', text });
        } finally {
          setLoading(false);
          e.target.value = '';
        }
      },
      error: (error) => {
        console.error(error);
        setMessage({ type: 'error', text: 'Error parsing CSV file.' });
        setLoading(false);
      }
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('timesheets')
        .update({
          hours_worked: Number(editHours),
          overtime_hours: Number(editOvertime) || 0,
          description: editDescription,
        })
        .eq('id', editingEntry.id);

      if (error) throw error;

      await logAction({
        action: 'Timesheet Update',
        category: 'performance',
        details: `Updated entry ${editingEntry.id}: ${editHours}h std, ${editOvertime}h OT.`,
        entityId: editingEntry.id,
        userName: profile?.full_name || user.email,
        userEmail: user.email
      });

      setMessage({ type: 'success', text: 'Timesheet entry updated successfully' });
      setEditingEntry(null);
      fetchHistory();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to update timesheet entry' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this specific timesheet entry? This action is irreversible.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Timesheet entry purged from nodes' });
      fetchHistory();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to delete timesheet entry' });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (t: any) => {
    setEditingEntry(t);
    setEditHours(String(t.hoursWorked));
    setEditOvertime(String(t.overtimeHours));
    setEditDescription(t.description);
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEntries.size === 0) return;
    setLoading(true);
    try {
      const updates = Array.from(selectedEntries).map(async (id: string) => {
        const entry = history.find(h => h.id === id);
        if (entry?.status !== 'pending') return null;
        
        const updateData: any = {};
        if (bulkHours !== '') updateData.hours_worked = Number(bulkHours);
        if (bulkOvertime !== '') updateData.overtime_hours = Number(bulkOvertime);
        if (bulkDescription !== '') updateData.description = bulkDescription;
        
        const { error } = await supabase
          .from('timesheets')
          .update(updateData)
          .eq('id', id);
        
        return error ? null : id;
      });

      const results = await Promise.all(updates);
      const successfulUpdates = results.filter(r => r !== null);
      
      setMessage({ type: 'success', text: `Successfully updated ${successfulUpdates.length} entries` });
      setIsBulkEditing(false);
      setSelectedEntries(new Set());
      setBulkHours('');
      setBulkOvertime('');
      setBulkDescription('');
      fetchHistory();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to perform bulk update' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectEntry = (id: string) => {
    const next = new Set(selectedEntries);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntries(next);
  };

  const toggleSelectAll = () => {
    const pageEntries = history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
      .filter(t => t.status === 'pending');
    
    if (selectedEntries.size === pageEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(pageEntries.map(t => t.id)));
    }
  };

  const getModeLabel = () => {
    if (submissionMode === 'daily') return 'Work Date';
    if (submissionMode === 'weekly') return 'Week Commencing (Mon)';
    return 'Pay Period';
  };

  const getModeInputType = () => {
    if (submissionMode === 'monthly') return 'month';
    return 'date';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 italic serif uppercase tracking-tight">Performance Logging</h1>
          <p className="text-xs text-gray-500 font-medium font-mono">Precision time tracking for the Mineazy ecosystem</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm text-center min-w-[100px]">
            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Submissions</span>
            <span className="text-xl font-black text-mine-blue leading-none">{history.length}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm text-center min-w-[100px]">
            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Hours</span>
            <span className="text-xl font-black text-mine-gold leading-none">
              {history.reduce((acc, curr) => acc + (Number(curr.hoursWorked) || 0), 0)}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-1">
          <div className="card sticky top-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Send size={10} className="text-mine-blue" /> Submit Log
              </h2>
            </div>
            
            {/* Mode Selector */}
            <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
              {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSubmissionMode(mode);
                    if (mode === 'daily') setHours('8');
                    else if (mode === 'weekly') setHours('40');
                    else setHours('160');
                  }}
                  className={`flex-1 text-[9px] font-black uppercase py-2 rounded-md transition-all tracking-widest ${
                    submissionMode === mode 
                      ? 'bg-white text-mine-blue shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{getModeLabel()}</label>
                <input
                  type={getModeInputType()}
                  value={submissionMode === 'monthly' ? date.slice(0, 7) : date}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDate(submissionMode === 'monthly' ? `${val}-01` : val);
                  }}
                  className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-sm font-bold focus:ring-1 focus:ring-mine-blue focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-mine-green focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Overtime</label>
                  <input
                    type="number"
                    step="0.5"
                    value={overtime}
                    onChange={(e) => setOvertime(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-mine-green focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  {submissionMode === 'daily' ? 'Task Description' : 'Summary of Activities'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What have you achieved?"
                  className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-sm min-h-[100px] focus:ring-1 focus:ring-mine-blue focus:outline-none transition-all resize-none"
                  required
                />
              </div>

              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${
                    message.type === 'success' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-red-50 text-red-700 border border-red-100'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  <p>{message.text}</p>
                </motion.div>
              )}

              <button
                disabled={loading}
                className="btn btn-primary w-full !py-4 !text-xs font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 mt-2 shadow-lg shadow-mine-blue/10"
              >
                {loading ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
                {loading ? 'Processing...' : `Submit ${submissionMode}`}
              </button>
            </form>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="card !p-0 overflow-hidden border-none shadow-xl shadow-gray-200/50">
            <div className="p-5 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between bg-white gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-mine-green/5 flex items-center justify-center text-mine-green">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Entry History</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Reviewing your logged performance</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {selectedEntries.size > 0 && (
                    <motion.button
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onClick={() => setIsBulkEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mine-blue text-white hover:bg-mine-blue/90 transition-all text-[9px] font-black uppercase tracking-widest shadow-lg shadow-mine-blue/20"
                    >
                      <Pencil size={12} />
                      Bulk Edit ({selectedEntries.size})
                    </motion.button>
                  )}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-mine-blue hover:border-mine-blue/30 hover:bg-mine-blue/5 transition-all text-[9px] font-black uppercase tracking-widest"
                  title="Download CSV Template"
                >
                  <Download size={12} />
                  Template
                </button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleBulkImport}
                    className="hidden"
                    id="bulk-timesheet-import"
                    disabled={loading}
                  />
                  <label
                    htmlFor="bulk-timesheet-import"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-all text-[9px] font-black uppercase tracking-widest cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <FileUp size={12} />
                    {loading ? 'Importing...' : 'Bulk Import'}
                  </label>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 w-10">
                      <input 
                        type="checkbox"
                        checked={selectedEntries.size > 0 && selectedEntries.size === history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).filter(t => t.status === 'pending').length}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-mine-blue focus:ring-mine-blue cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Period</th>
                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Summary</th>
                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Time</th>
                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history.length > 0 ? history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox"
                          disabled={t.status !== 'pending'}
                          checked={selectedEntries.has(t.id)}
                          onChange={() => toggleSelectEntry(t.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-mine-green focus:ring-mine-green cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-gray-900 group-hover:text-mine-blue transition-colors">
                            {t.date}
                          </span>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                            {t.submissionMode || 'daily'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[300px]">
                        <p className="text-xs text-gray-500 line-clamp-1 italic">{t.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-gray-900">{t.hoursWorked}h Std</span>
                          {t.overtimeHours > 0 && <span className="text-[9px] font-bold text-orange-600">+{t.overtimeHours}h OT</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                          t.status === 'approved' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          t.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                          'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {t.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => startEditing(t)}
                                className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-mine-blue hover:border-mine-blue/30 transition-all shadow-sm"
                                title="Edit Entry"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                                title="Delete Entry"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setViewingEntry(t)}
                              className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-500 hover:border-blue-200 transition-all shadow-sm"
                              title="View Details"
                            >
                              <Eye size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-bold text-[10px] uppercase tracking-widest italic opacity-50">
                        No activity detected in local nodes
                      </td>
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
          </div>
        </section>
      </div>

      <AnimatePresence>
        {isBulkEditing && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-mine-blue/10 flex items-center justify-center text-mine-blue border border-mine-blue/20">
                    <Pencil size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Bulk Matrix Update</h3>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Processing {selectedEntries.size} pending nodes</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBulkEditing(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleBulkUpdate} className="p-10 space-y-8">
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-4">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={14} /> Fields left empty will remain unchanged
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Keep original"
                        value={bulkHours}
                        onChange={(e) => setBulkHours(e.target.value)}
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-mine-green focus:outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Overtime</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Keep original"
                        value={bulkOvertime}
                        onChange={(e) => setBulkOvertime(e.target.value)}
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs font-mono focus:ring-2 focus:ring-mine-green focus:outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Batch Task Description</label>
                  <textarea
                    value={bulkDescription}
                    onChange={(e) => setBulkDescription(e.target.value)}
                    placeholder="Apply new summary to all selected entries..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-xs min-h-[140px] focus:ring-2 focus:ring-mine-blue focus:outline-none transition-all resize-none shadow-inner"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsBulkEditing(false)}
                    className="flex-1 px-8 py-4 rounded-2xl border border-gray-200 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                  >
                    Abort
                  </button>
                  <button
                    disabled={loading || (!bulkHours && !bulkOvertime && !bulkDescription)}
                    className="flex-3 px-8 py-4 rounded-2xl bg-mine-blue text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-mine-blue/30 hover:bg-mine-blue/90 transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    Commit Bulk Update
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-mine-green/5 flex items-center justify-center text-mine-green">
                    <Pencil size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Adjust Performance Entry</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Modifying record for {editingEntry.date}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingEntry(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-mine-green focus:outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Overtime</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editOvertime}
                      onChange={(e) => setEditOvertime(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-mine-green focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Task Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded px-3 py-2 text-sm min-h-[120px] focus:ring-1 focus:ring-mine-green focus:outline-none transition-all resize-none"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingEntry(null)}
                    className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={loading}
                    className="flex-1 px-6 py-3 rounded-xl bg-mine-green text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-mine-green/20 hover:bg-mine-green/90 transition-all disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <Eye size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Archive Details</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Record for {viewingEntry.date}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingEntry(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Standard</p>
                    <p className="text-lg font-black text-gray-900 font-mono">{viewingEntry.hoursWorked}h</p>
                  </div>
                  <div className="h-8 w-[1px] bg-gray-200"></div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Overtime</p>
                    <p className="text-lg font-black text-orange-600 font-mono">{viewingEntry.overtimeHours || 0}h</p>
                  </div>
                  <div className="h-8 w-[1px] bg-gray-200"></div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                      viewingEntry.status === 'approved' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      viewingEntry.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                      'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {viewingEntry.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Task Transcript</p>
                  <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-600 italic leading-relaxed">
                    {viewingEntry.description}
                  </div>
                </div>

                {viewingEntry.status === 'rejected' && (viewingEntry.rejection_reason || viewingEntry.rejectionReason) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={10} className="text-red-500" />
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Rejection Feedback</p>
                    </div>
                    <div className="p-4 bg-red-50/50 rounded-xl text-xs text-red-700 font-bold border border-red-100/50 italic leading-relaxed shadow-sm">
                      "{viewingEntry.rejection_reason || viewingEntry.rejectionReason}"
                    </div>
                  </div>
                )}

                {viewingEntry.reviewedBy && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      Reviewed by Auditor: <span className="text-gray-900">{viewingEntry.reviewedBy}</span>
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setViewingEntry(null)}
                  className="w-full py-4 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-900/20 hover:bg-gray-800 transition-all"
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

export default TimesheetForm;
