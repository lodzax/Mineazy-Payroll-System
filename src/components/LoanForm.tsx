import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  const term = Number(installments);
  const totalRepayable = principal > 0 ? principal + (principal * rate * term) : 0;
  const monthlyRepayment = term > 0 ? totalRepayable / term : 0;

  const fetchHistory = async () => {
    if (!user) return;
    const q = query(
      collection(db, 'loan_applications'),
      where('employeeId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
      await addDoc(collection(db, 'loan_applications'), {
        employeeId: user.uid,
        subsidiaryId: profile?.subsidiaryId || '',
        amount: Number(amount),
        currency: profile?.currency || 'USD',
        installmentCount: Number(installments),
        interestRate: Number(interestRate),
        reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      await logAction({
        action: 'Loan Application Submitted',
        category: 'financial',
        details: `Applied for ${profile?.currency || 'USD'} ${amount} over ${installments} months. Interest rate: ${interestRate}%.`,
        userName: profile?.fullName || user.displayName,
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="card">
          <div className="bg-gray-50 border border-border rounded-md p-3 mb-6 flex gap-3 items-start">
            <Info className="text-gray-400 shrink-0" size={16} />
            <div>
              <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-1">Company Policy</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Advances capped at 50% of basic salary. Auto-deducted per installment plan. 
                Management approval is legally required for processing.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Term</label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green"
                  >
                    <option value="1">1 Mo</option>
                    <option value="2">2 Mo</option>
                    <option value="3">3 Mo</option>
                    <option value="6">6 Mo</option>
                  </select>
                </div>
                <div className="relative group">
                  <label className="block text-[10px] font-black text-slate-800 bg-mine-gold/20 px-1.5 py-0.5 rounded-sm w-fit uppercase tracking-widest mb-1.5">Monthly Rate %</label>
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
                        Interest accrues monthly
                      </div>
                    </div>
                  </div>
                  <p className="text-[8px] text-mine-gold font-black uppercase tracking-tight mt-1 leading-none italic">
                    Accrual basis: 30-day cycle
                  </p>
                </div>
              </div>
            </div>

            {/* Repayment Estimate Card */}
            {principal > 0 && (
              <div className="bg-mine-green/5 border border-mine-green/10 rounded-md p-3 grid grid-cols-2 gap-4">
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
                className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green resize-none font-sans"
                placeholder="Reason for advance..."
                required
              />
            </div>

            {message && (
              <div className={`p-3 rounded-md flex items-center gap-2 text-xs font-semibold ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                <p>{message.text}</p>
              </div>
            )}

            <button
              disabled={loading}
              className="btn btn-primary w-full !py-4 !text-sm flex items-center justify-center gap-2 mt-4"
            >
              <BadgeDollarSign size={18} />
              {loading ? 'Processing...' : 'Apply for Credit'}
            </button>
          </form>
        </section>

        <section className="card !p-0 overflow-hidden">
          <div className="p-4 border-b border-app-bg flex items-center gap-2 bg-gray-50/50">
            <BadgeDollarSign className="text-gray-400" size={16} />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Credit History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-app-bg text-gray-400 font-bold uppercase tracking-tighter">
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Plan</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-bg font-mono">
                {history.length > 0 ? history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((l) => (
                  <tr 
                    key={l.id} 
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLoan(l)}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      <div className="flex items-center gap-2 group-hover:text-mine-green transition-colors">
                        {l.currency} {l.amount?.toFixed(2)}
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{l.installmentCount} mo</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${
                        l.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-100' :
                        l.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                        'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic font-sans">No applications found.</td>
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
