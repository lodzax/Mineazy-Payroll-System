import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { logAction } from '../services/loggerService';
import { BadgeDollarSign, CheckCircle, Send, AlertCircle, Info, ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
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

const LoanForm: React.FC = () => {
  const { user, profile } = useAuth();
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('3');
  const [isCustomTerm, setIsCustomTerm] = useState(false);
  const [customTerm, setCustomTerm] = useState('');
  const [interestRate, setInterestRate] = useState('5'); // Default 5% per month
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  // Estimation Calculation
  const principal = Number(amount) || 0;
  const rate = Number(interestRate) / 100;
  const term = isCustomTerm ? (Number(customTerm) || 0) : Number(installments);
  const totalRepayable = principal > 0 && term > 0 ? principal + (principal * rate * term) : 0;
  const monthlyRepayment = term > 0 ? totalRepayable / term : 0;

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('loan_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setHistory((data || []).map(l => ({
        ...l,
        employeeId: l.user_id,
        installmentCount: l.installment_count,
        interestRate: l.interest_rate
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
      const finalTerm = isCustomTerm ? Number(customTerm) : Number(installments);
      
      if (finalTerm <= 0) {
        toast.error("Please enter a valid loan term");
        setLoading(false);
        return;
      }

      const loanData = {
        user_id: user.id,
        subsidiary_id: profile?.subsidiary_id || null,
        amount: Number(amount),
        currency: profile?.currency || 'USD',
        installment_count: finalTerm,
        installments: finalTerm, // Supporting both schema versions
        interest_rate: Number(interestRate),
        reason: reason,
        purpose: reason, // Supporting both schema versions
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('loan_requests').insert(loanData);

      if (error) {
        console.error("Loan Submission Error:", error);
        throw error;
      }

      await logAction({
        action: 'Loan Application Submitted',
        category: 'financial',
        details: `Applied for ${profile?.currency || 'USD'} ${amount} over ${finalTerm} months. Interest rate: ${interestRate}%.`,
        userName: profile?.full_name || user.email,
        userEmail: user.email
      });

      setMessage({ type: 'success', text: 'Loan application submitted for review' });
      setAmount('');
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
      <header>
        <h1 className="text-2xl font-bold text-gray-900 italic serif">Salary Advances & Loans</h1>
        <p className="text-gray-500">Apply for financial assistance with standard repayment terms</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5 space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-mine-green/10 flex items-center justify-center text-mine-green">
                <Send size={16} />
              </div>
              <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest">New Application</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Amount ({profile?.currency})</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green font-mono"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Loan Term</label>
                    <div className="flex gap-2">
                      <select
                        value={isCustomTerm ? 'custom' : installments}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setIsCustomTerm(true);
                          } else {
                            setIsCustomTerm(false);
                            setInstallments(e.target.value);
                          }
                        }}
                        className={`flex-1 bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green ${isCustomTerm ? 'max-w-[100px]' : 'w-full'}`}
                      >
                        <option value="1">1 Month</option>
                        <option value="2">2 Months</option>
                        <option value="3">3 Months</option>
                        <option value="6">6 Months</option>
                        <option value="custom">Custom</option>
                      </select>
                      {isCustomTerm && (
                        <input
                          type="number"
                          min="1"
                          placeholder="Duration"
                          value={customTerm}
                          onChange={(e) => setCustomTerm(e.target.value)}
                          className="flex-1 bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green font-mono"
                          required
                        />
                      )}
                    </div>
                  </div>
                  <div className="relative group">
                    <label className="block text-[10px] font-black text-slate-800 bg-mine-gold/20 px-1.5 py-0.5 rounded-sm w-fit uppercase tracking-widest mb-1.5">Monthly Interest Rate %</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="w-full bg-mine-gold/5 border border-mine-gold/30 rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-gold focus:border-mine-gold font-mono outline-none transition-all"
                        placeholder="5"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 group-hover:block hidden">
                        <div className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-lg whitespace-nowrap animate-in fade-in zoom-in duration-200">
                          Accrues monthly
                        </div>
                      </div>
                    </div>
                    <p className="text-[8px] text-mine-gold font-black uppercase tracking-tight mt-1 leading-none italic">
                      Accrual basis: 30-day performance cycle
                    </p>
                  </div>
                </div>
              </div>

              {/* Repayment Estimate Card */}
              {principal > 0 && (
                <div className="bg-mine-green/5 border border-mine-green/10 rounded-2xl p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-mine-green uppercase tracking-tighter">Est. Monthly Repayment</p>
                    <p className="text-lg font-black text-mine-green font-mono">
                      {profile?.currency} {monthlyRepayment.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Total Repayable</p>
                    <p className="text-sm font-bold text-gray-600 font-mono">
                      {profile?.currency} {totalRepayable.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Business Purpose</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-50 border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-mine-green resize-none font-sans"
                  placeholder="Justify this advance request..."
                  required
                />
              </div>

              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider ${
                  message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  <p>{message.text}</p>
                </div>
              )}

              <button
                disabled={loading}
                className="btn btn-primary w-full !py-4 !text-xs font-black uppercase tracking-[0.25em] flex items-center justify-center gap-3 mt-4 shadow-lg shadow-mine-green/10"
              >
                <BadgeDollarSign size={18} />
                {loading ? 'Processing Transaction...' : 'Initiate Application'}
              </button>
            </form>
          </div>
        </section>

        <section className="lg:col-span-7 space-y-8">
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-200/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-mine-gold/10 -mr-16 -mt-16 rounded-full blur-2xl group-hover:bg-mine-gold/20 transition-all duration-700" />
            <div className="flex gap-6 items-start relative z-10">
              <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10 shadow-inner">
                <Info className="text-mine-gold" size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-mine-gold uppercase tracking-[0.3em] mb-3">Operational Directive: Loan Policy</p>
                <p className="text-sm text-gray-300 leading-relaxed italic">
                  Salaried advances are capped at <span className="text-white font-black underline decoration-mine-gold decoration-2">50% of monthly base salary</span>. 
                  Repayment schedules are synchronized with payroll cycles and auto-deducted at source. 
                  All credit nodes are subject to audit clearance before transmission.
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[8px] font-black uppercase tracking-widest text-gray-400">
                    ID: POL-FIN-882
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[8px] font-black uppercase tracking-widest text-gray-400">
                    v4.2.1
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card !p-0 overflow-hidden border-none shadow-xl shadow-gray-200/50">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-mine-gold/10 flex items-center justify-center text-mine-green border border-mine-gold/20 font-black italic serif">
                  <BadgeDollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Credit Transaction History</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Monitoring your personal credit nodes</p>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 uppercase font-black text-gray-400 text-[9px] tracking-[0.2em]">
                    <th className="px-6 py-4">Financial Amount</th>
                    <th className="px-6 py-4">Repayment Plan</th>
                    <th className="px-6 py-4 text-center">Lifecycle Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-mono">
                  {history.length > 0 ? history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((l) => (
                    <tr 
                      key={l.id} 
                      className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLoan(l)}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 font-black text-gray-900 text-sm">
                          {l.currency} {l.amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-gray-500 font-bold">{l.installmentCount} Monthly Cycles</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                          l.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' :
                          l.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                          'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="inline-flex items-center gap-2 text-mine-green opacity-0 group-hover:opacity-100 transition-all font-black text-[10px] uppercase">
                          Inspect Node <ExternalLink size={12} />
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic font-sans font-bold text-[10px] uppercase tracking-widest opacity-50">
                        No credit activity detected in history.
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
        {selectedLoan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setSelectedLoan(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-sm rounded-xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="text-mine-gold" size={18} />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Loan Node Details</h3>
                </div>
                <button onClick={() => setSelectedLoan(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status Identifier</p>
                    <span className={`badge ${
                      selectedLoan.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-100' :
                      selectedLoan.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                      'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {selectedLoan.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Principal Sum</p>
                    <p className="text-xl font-black text-gray-900 font-mono">
                      {selectedLoan.currency} {selectedLoan.amount?.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Interest Rate</p>
                    <p className="text-xs font-bold text-gray-700 font-mono">{selectedLoan.interestRate}% Monthly</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Installment Count</p>
                    <p className="text-xs font-bold text-gray-700 font-mono">{selectedLoan.installmentCount} Monthly Cycles</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Justification / Reason</p>
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md italic leading-relaxed">
                    "{selectedLoan.reason}"
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-50 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-gray-400 uppercase">Monthly Repayment</span>
                    <span className="text-mine-green font-mono">
                      {selectedLoan.currency} {((selectedLoan.amount + (selectedLoan.amount * (selectedLoan.interestRate/100) * selectedLoan.installmentCount)) / selectedLoan.installmentCount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-gray-400 uppercase">Total Interest</span>
                    <span className="text-orange-600 font-mono">
                      {selectedLoan.currency} {(selectedLoan.amount * (selectedLoan.interestRate/100) * selectedLoan.installmentCount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 border-t border-gray-100">
                <button 
                  onClick={() => setSelectedLoan(null)}
                  className="w-full py-2 bg-white border border-gray-200 rounded text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Close Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoanForm;
