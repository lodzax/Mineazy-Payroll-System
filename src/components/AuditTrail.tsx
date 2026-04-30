import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  History, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Shield, 
  Briefcase, 
  FileText, 
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuditTrailProps {
  subsidiaryId?: string;
  isSuperAdmin?: boolean;
}

const AuditTrail: React.FC<AuditTrailProps> = ({ subsidiaryId, isSuperAdmin }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchLogs = async () => {
      // Defensive check
      if (!isSuperAdmin && subsidiaryId === undefined) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let queryBuilder = supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(200);
        
        if (!isSuperAdmin && subsidiaryId) {
          queryBuilder = queryBuilder.eq('subsidiary_id', subsidiaryId);
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;

        setLogs((data || []).map(l => ({
          ...l,
          userName: l.details?.userName || 'Unknown',
          userEmail: l.details?.userEmail || 'N/A',
          details: l.details?.details || l.action
        })));
      } catch (err: any) {
        console.error("Audit log fetch error:", err);
        setError("Failed to synchronize with operational ledger.");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [subsidiaryId, isSuperAdmin]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.userName?.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
      String(log.details)?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'payroll': return <TrendingUp size={14} className="text-mine-blue" />;
      case 'personnel': return <User size={14} className="text-blue-600" />;
      case 'report': return <FileText size={14} className="text-orange-600" />;
      case 'system': return <Shield size={14} className="text-purple-600" />;
      case 'performance': return <Briefcase size={14} className="text-mine-gold" />;
      default: return <Clock size={14} className="text-gray-400" />;
    }
  };

  return (
    <section className="card">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-mine-gold rounded-lg shadow-inner">
            <History size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">System Audit Trail</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Operational Intelligence Log</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Filter actions or personnel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-mine-blue w-48 md:w-64"
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-blue"
          >
            <option value="all">All Categories</option>
            <option value="payroll">Payroll</option>
            <option value="personnel">Personnel</option>
            <option value="performance">Performance</option>
            <option value="report">Reports</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <History size={32} className="text-gray-200 animate-spin-slow mb-4" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Querying Ledger...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-400 italic bg-red-50/50 rounded-xl border border-dashed border-red-200">
            <AlertCircle size={32} className="mb-2 opacity-50" />
            <p className="text-xs font-black uppercase tracking-tight">{error}</p>
            <p className="text-[10px] mt-2">Security context validation required for operational clearance.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 italic bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <AlertCircle size={32} className="mb-2 opacity-20" />
            <p className="text-xs">No matching audit logs detected in the current scope.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="py-3 pl-2">Timestamp</th>
                <th className="py-3">Executor</th>
                <th className="py-3">Action</th>
                <th className="py-3">Category</th>
                <th className="py-3 pr-2">Contextual Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode='popLayout'>
                {paginatedLogs.map((log) => (
                  <motion.tr 
                    key={log.id} 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-4 pl-2">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-bold text-gray-900">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                          <span className="text-[9px] font-mono text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                       </div>
                    </td>
                    <td className="py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white rounded-full border border-gray-200 flex items-center justify-center text-mine-blue font-black text-[10px] shadow-sm uppercase">
                            {log.userName?.slice(0, 2) || '??'}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs font-bold text-slate-800">{log.userName || 'Unknown'}</span>
                             <span className="text-[9px] text-gray-400 font-medium tracking-tight">{log.userEmail}</span>
                          </div>
                       </div>
                    </td>
                    <td className="py-4">
                       <span className="text-[11px] font-black text-gray-900 uppercase tracking-tighter italic serif">
                          {log.action}
                       </span>
                    </td>
                    <td className="py-4">
                       <div className="flex items-center gap-1.5">
                          {getCategoryIcon(log.category)}
                          <span className="text-[9px] font-black uppercase tracking-[2px] text-gray-500">
                            {log.category}
                          </span>
                       </div>
                    </td>
                    <td className="py-4 pr-2">
                       <p className="text-[10px] text-gray-600 leading-tight bg-gray-100/50 p-2 rounded border border-gray-200/50 italic line-clamp-2 group-hover:line-clamp-none transition-all">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                       </p>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Record {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:border-mine-blue hover:text-mine-blue transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${currentPage === p ? 'bg-mine-blue text-white' : 'bg-white border border-gray-200 text-gray-400 hover:border-mine-blue hover:text-mine-blue'}`}
                >
                  {p}
                </button>
              )).filter((_, idx) => {
                 // Basic middle truncation if too many pages
                 if (totalPages <= 7) return true;
                 if (idx === 0 || idx === totalPages - 1) return true;
                 return Math.abs(idx - (currentPage - 1)) <= 2;
              })}
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:border-mine-blue hover:text-mine-blue transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AuditTrail;
