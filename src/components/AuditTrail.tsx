import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  AlertCircle
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

  useEffect(() => {
    const fetchLogs = async () => {
      // Defensive check: Only attempt fetch if user has admin context
      // This avoids "Missing or insufficient permissions" console spam if a regular employee somehow loads this
      if (!isSuperAdmin && subsidiaryId === undefined) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
        
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(data);
      } catch (err: any) {
        console.error("Audit log fetch error:", err);
        // Only show fatal error if it's not a standard permission check fail during init
        if (err.code !== 'permission-denied') {
          setError("Failed to synchronize with operational ledger.");
        }
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
      log.details?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'payroll': return <TrendingUp size={14} className="text-mine-green" />;
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
              placeholder="Filter actions or users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-mine-green w-48 md:w-64"
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-mine-green"
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
                {filteredLogs.map((log) => (
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
                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="text-[9px] font-mono text-gray-400">
                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : ''}
                          </span>
                       </div>
                    </td>
                    <td className="py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-white rounded-full border border-gray-200 flex items-center justify-center text-mine-green font-black text-[10px] shadow-sm uppercase">
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
                          {log.details || 'No additional metadata recorded.'}
                       </p>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default AuditTrail;
