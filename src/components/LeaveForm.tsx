import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Calendar, CheckCircle, Send, AlertCircle, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

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

const LeaveForm: React.FC = () => {
  const { user, profile } = useAuth();
  const [type, setType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  const fetchHistory = async () => {
    if (!user) return;
    const q = query(
      collection(db, 'leave_applications'),
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
      await addDoc(collection(db, 'leave_applications'), {
        employeeId: user.uid,
        subsidiaryId: profile?.subsidiaryId || '',
        type,
        startDate,
        endDate,
        reason,
        status: 'pending',
        createdAt: serverTimestamp()
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
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-6 py-3 flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Available Balance</p>
            <p className="text-xl font-black text-orange-600 font-mono">
              {(profile?.annualLeaveBalance || 0).toFixed(1)} Days
            </p>
          </div>
          <Calendar className="text-orange-300" size={24} />
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
                className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green focus:outline-none transition-all"
              >
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="study">Study Leave</option>
                <option value="compassionate">Compassionate</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green focus:outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Until Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green focus:outline-none transition-all"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Supporting Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full bg-gray-50 border border-border rounded-md p-2.5 text-sm focus:ring-1 focus:ring-mine-green focus:outline-none transition-all resize-none"
                placeholder="Logistics or details..."
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
                  <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-700 capitalize">{l.type}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-500 whitespace-nowrap">{l.startDate} &gt; {l.endDate}</td>
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
    </div>
  );
};

export default LeaveForm;
