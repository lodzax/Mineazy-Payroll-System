import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Loader2, User, Clock, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  id: string;
  type: 'employee' | 'timesheet' | 'payslip';
  title: string;
  subtitle: string;
  data: any;
}

const GlobalSearch: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performSearch(searchTerm.trim());
      } else {
        setResults([]);
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const performSearch = async (term: string) => {
    setIsSearching(true);
    setIsOpen(true);
    
    try {
      const dbTerm = `%${term}%`;
      
      const [userRes, timesheetRes, payslipRes] = await Promise.all([
        supabase.from('users').select('*').ilike('full_name', dbTerm).limit(5),
        supabase.from('timesheets').select('*').ilike('description', dbTerm).limit(5), // Fallback to description if no user name in timesheet
        supabase.from('payslips').select('*').ilike('month_year', dbTerm).limit(5)
      ]);

      const employees: SearchResult[] = (userRes.data || []).map(u => ({
        id: u.id,
        type: 'employee',
        title: u.full_name,
        subtitle: u.job_title || u.role || 'Personnel',
        data: u
      }));

      const timesheets: SearchResult[] = (timesheetRes.data || []).map(t => ({
        id: t.id,
        type: 'timesheet',
        title: `Timesheet: ${t.date}`,
        subtitle: `Ref: ${t.id.slice(0, 8)}`,
        data: t
      }));

      const payslips: SearchResult[] = (payslipRes.data || []).map(p => ({
        id: p.id,
        type: 'payslip',
        title: `Payslip: ${p.month_year}`,
        subtitle: `Ref: ${p.id.slice(0, 8)}`,
        data: p
      }));

      setResults([...employees, ...timesheets, ...payslips]);
    } catch (error) {
      console.error('Global search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setSearchTerm('');
    
    switch (result.type) {
      case 'employee':
        setActiveTab('employees');
        break;
      case 'timesheet':
        setActiveTab('admin');
        break;
      case 'payslip':
        setActiveTab('payslips');
        break;
    }
  };

  return (
    <div className="relative flex-1 max-w-sm hidden md:block" ref={searchRef}>
      <div className="relative group">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
          placeholder="Global search personnel, payroll..."
          className="w-full bg-white/10 border border-white/20 rounded-full py-1.5 pl-10 pr-4 text-[11px] text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-mine-gold/30 transition-all font-medium"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-white/70 transition-colors">
          {isSearching ? <Loader2 size={14} className="animate-spin text-mine-gold" /> : <Search size={14} />}
        </div>
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute top-full left-0 right-0 mt-3 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-200 overflow-hidden z-[100]"
          >
            <div className="max-h-[420px] overflow-y-auto p-2">
              {['employee', 'timesheet', 'payslip'].map(type => {
                const typeResults = results.filter(r => r.type === type);
                if (typeResults.length === 0) return null;

                return (
                  <div key={type} className="mb-3 last:mb-0">
                    <h3 className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-50 mb-1 flex items-center justify-between">
                       <span className="flex items-center gap-2">
                         {type === 'employee' && <User size={10} className="text-blue-500" />}
                         {type === 'timesheet' && <Clock size={10} className="text-orange-500" />}
                         {type === 'payslip' && <FileText size={10} className="text-green-500" />}
                         {type}s
                       </span>
                       <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[8px]">{typeResults.length}</span>
                    </h3>
                    <div className="space-y-0.5">
                      {typeResults.map(result => (
                        <button
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-mine-green/5 rounded-lg transition-colors text-left group"
                        >
                          <div className={`p-1.5 rounded-md ${
                            type === 'employee' ? 'bg-blue-50 text-blue-600' : 
                            type === 'timesheet' ? 'bg-orange-50 text-orange-600' : 
                            'bg-green-50 text-green-600'
                          }`}>
                            {type === 'employee' && <User size={12} />}
                            {type === 'timesheet' && <Clock size={12} />}
                            {type === 'payslip' && <FileText size={12} />}
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-gray-900 group-hover:text-mine-green transition-colors">{result.title}</div>
                            <div className="text-[9px] text-gray-500 font-medium uppercase tracking-tighter italic">{result.subtitle}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
        {isOpen && searchTerm.trim().length >= 2 && results.length === 0 && !isSearching && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-3 bg-white rounded-xl shadow-2xl border border-gray-200 p-8 text-center z-[100]"
          >
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search size={22} className="text-gray-300" />
            </div>
            <p className="text-xs font-black text-gray-600 uppercase tracking-tight">Security Check: Zero Matches</p>
            <p className="text-[10px] text-gray-400 mt-1">Found no trace of "{searchTerm}" in the sector records.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSearch;
