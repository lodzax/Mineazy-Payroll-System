import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Loader2, User, Clock, CreditCard, X, ChevronRight, Hash, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  id: string;
  type: 'employee' | 'timesheet' | 'payslip';
  title: string;
  subtitle: string;
  data: any;
}

interface GlobalSearchProps {
  setActiveTab: (tab: string) => void;
  onSelect?: (result: SearchResult) => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ setActiveTab, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
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
        setIsOpen(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const performSearch = async (term: string) => {
    setIsSearching(true);
    setIsOpen(true);
    setActiveIndex(-1);
    
    try {
      const dbTerm = `%${term}%`;
      
      const [userRes, timesheetRes, payslipRes] = await Promise.all([
        supabase.from('profiles').select('*').ilike('full_name', dbTerm).limit(4),
        supabase.from('timesheets').select('*, profiles(full_name)').ilike('description', dbTerm).limit(4),
        supabase.from('payslips').select('*, profiles(full_name)').ilike('month_year', dbTerm).limit(4)
      ]);

      const employees: SearchResult[] = (userRes.data || []).map(u => ({
        id: u.id,
        type: 'employee',
        title: u.full_name,
        subtitle: u.job_title || u.role || 'Corporate Staff',
        data: u
      }));

      const timesheets: SearchResult[] = (timesheetRes.data || []).map(t => ({
        id: t.id,
        type: 'timesheet',
        title: `${(t as any).profiles?.full_name || 'Staff'}: ${t.date}`,
        subtitle: t.description || `Entry ID: ${t.id.slice(0, 8)}`,
        data: t
      }));

      const payslips: SearchResult[] = (payslipRes.data || []).map(p => ({
        id: p.id,
        type: 'payslip',
        title: `${(p as any).profiles?.full_name || 'Staff'}: ${p.month_year}`,
        subtitle: `Salary Voucher • ${p.net_pay} ${p.currency}`,
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
    
    if (onSelect) {
      onSelect(result);
    }

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
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
          onKeyDown={handleKeyDown}
          placeholder="Search personnel, records, payroll..."
          className="w-full bg-white/10 border border-white/20 rounded-full py-2 pl-10 pr-4 text-[11px] text-white placeholder:text-white/40 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-mine-gold/30 transition-all font-medium"
        />
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors">
          {isSearching ? (
            <Loader2 size={14} className="animate-spin text-mine-gold" />
          ) : (
            <Search size={14} className="text-white/40 group-focus-within:text-white/70" />
          )}
        </div>
        {searchTerm && (
          <button 
            onClick={() => { setSearchTerm(''); setResults([]); }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.25)] border border-gray-200 overflow-hidden z-[100]"
          >
            <div className="max-h-[460px] overflow-y-auto custom-scrollbar">
              {isSearching && results.length === 0 && (
                <div className="p-8 text-center bg-gray-50/50">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-mine-gold/10 mb-3">
                    <Database size={20} className="text-mine-gold animate-pulse" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Scanning Database...</p>
                  <p className="text-[9px] text-gray-400 mt-1">Cross-referencing encrypted records</p>
                </div>
              )}

              {results.length > 0 && (
                <div className="p-2 pt-1">
                  {['employee', 'timesheet', 'payslip'].map(type => {
                    const typeResults = results.filter(r => r.type === type);
                    if (typeResults.length === 0) return null;

                    return (
                      <div key={type} className="mb-4 last:mb-1">
                        <header className="px-3 py-2 flex items-center justify-between border-b border-gray-50 mb-1">
                          <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">
                            {type === 'employee' && <User size={10} className="text-blue-500" />}
                            {type === 'timesheet' && <Clock size={10} className="text-orange-500" />}
                            {type === 'payslip' && <CreditCard size={10} className="text-blue-500" />}
                            System {type}s
                          </span>
                          <span className="text-[8px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">{typeResults.length}</span>
                        </header>
                        <div className="space-y-0.5">
                          {typeResults.map((result, idx) => {
                            const globalIdx = results.indexOf(result);
                            const isActive = globalIdx === activeIndex;
                            return (
                              <motion.button
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: globalIdx * 0.03 }}
                                key={result.id}
                                onClick={() => handleSelect(result)}
                                onMouseEnter={() => setActiveIndex(globalIdx)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group ${
                                  isActive ? 'bg-mine-blue/10 ring-1 ring-mine-blue/20' : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className={`p-2 rounded-xl border ${
                                  type === 'employee' ? 'bg-blue-50 border-blue-100 text-blue-600' : 
                                  type === 'timesheet' ? 'bg-orange-50 border-orange-100 text-orange-600' : 
                                  'bg-blue-50 border-blue-100 text-blue-600'
                                }`}>
                                  {type === 'employee' && <User size={14} />}
                                  {type === 'timesheet' && <Clock size={14} />}
                                  {type === 'payslip' && <CreditCard size={14} />}
                                </div>
                                <div className="flex-1">
                                  <div className={`text-[12px] font-bold leading-tight transition-colors ${
                                    isActive ? 'text-mine-blue' : 'text-gray-900 group-hover:text-mine-blue'
                                  }`}>
                                    {result.title}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Hash size={8} className="text-gray-300" />
                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight italic">
                                      {result.subtitle}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight 
                                  size={12} 
                                  className={`transition-all ${isActive ? 'translate-x-0 opacity-100 text-mine-blue' : '-translate-x-2 opacity-0 text-gray-300'}`} 
                                />
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {searchTerm.trim().length >= 2 && results.length === 0 && !isSearching && (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                    <Search size={24} className="text-red-300" />
                  </div>
                  <h4 className="text-[11px] font-black text-gray-800 uppercase tracking-tight">Security Protocol: Zero Matches</h4>
                  <p className="text-[10px] text-gray-400 mt-2 max-w-[180px] mx-auto leading-relaxed">
                    The identifier <span className="font-bold text-gray-700">"{searchTerm}"</span> is not recognized in current registry sectors.
                  </p>
                </div>
              )}
            </div>
            
            <footer className="bg-gray-50/80 border-t border-gray-100 px-4 py-2 flex items-center justify-between">
              <div className="flex gap-3">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded border border-gray-300 bg-white text-[8px] font-bold shadow-sm">↑↓</kbd>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded border border-gray-300 bg-white text-[8px] font-bold shadow-sm">↵</kbd>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Select</span>
                </div>
              </div>
              <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded tracking-widest uppercase">Live Registry</span>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSearch;
