import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Archive, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  ChevronRight,
  MoreVertical,
  Layers,
  Settings2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { logAction } from '../services/loggerService';

interface PayrollBatch {
  id: string;
  month_year: string;
  status: 'draft' | 'processing' | 'finalized';
  payroll_group: string;
  subsidiary_id: string;
  notes?: string;
  created_at: string;
  finalized_at?: string;
  created_by?: string;
}

const PayrollBatchManagement: React.FC = () => {
  const { isSuperAdmin, profile } = useAuth();
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subsidiaries, setSubsidiaries] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    group: 'General',
    subsidiaryId: '',
    notes: ''
  });

  const fetchBatches = async () => {
    setLoading(true);
    try {
      let query = supabase.from('payroll_batches').select('*').order('created_at', { ascending: false });
      
      if (!isSuperAdmin && profile?.subsidiary_id) {
        query = query.eq('subsidiary_id', profile.subsidiary_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBatches(data || []);

      if (isSuperAdmin) {
        const { data: subs } = await supabase.from('subsidiaries').select('*');
        setSubsidiaries(subs || []);
      }
    } catch (err) {
      console.error("Batch fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('payroll_batches').insert({
        month_year: form.month,
        payroll_group: form.group,
        subsidiary_id: form.subsidiaryId || (isSuperAdmin ? null : profile?.subsidiary_id) || null,
        notes: form.notes,
        status: 'draft'
      });

      if (error) throw error;

      await logAction({
        action: 'Payroll Batch Created',
        category: 'payroll',
        details: `Created ${form.group} batch for ${form.month}.`,
      });

      setIsModalOpen(false);
      toast.success(`Successfully created ${form.group} batch for ${form.month}`);
      fetchBatches();
    } catch (err) {
      toast.error("Failed to create batch: " + (err as any).message);
    }
  };

  const deleteBatch = async (id: string) => {
    if (!window.confirm("Are you sure? This will not delete payslips but will remove the batch grouping.")) return;
    try {
      await supabase.from('payroll_batches').delete().eq('id', id);
      toast.success("Batch successfully deleted");
      fetchBatches();
    } catch (err) {
      console.error(err);
      toast.error("Deletion failed");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finalized': return 'bg-green-50 text-green-700 border-green-200';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'finalized': return <CheckCircle2 size={12} />;
      case 'processing': return <Clock size={12} className="animate-spin-slow" />;
      default: return <AlertCircle size={12} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
            <Archive size={20} className="text-mine-green" /> Financial Batches
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Active nodes for payroll lifecycle management</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary !py-2 !px-4 flex items-center gap-2"
        >
          <Plus size={16} /> New Batch
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {batches.map(batch => (
          <div key={batch.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${batch.status === 'finalized' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                  <Layers size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{batch.month_year}</h3>
                    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase flex items-center gap-1 ${getStatusBadge(batch.status)}`}>
                      {getStatusIcon(batch.status)} {batch.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] text-gray-500 font-bold">GROUP: <span className="text-mine-green">{batch.payroll_group}</span></p>
                    <p className="text-[10px] text-gray-500 font-bold">NODE: <span className="text-mine-gold">{!batch.subsidiary_id ? 'GLOBAL' : subsidiaries.find(s => s.id === batch.subsidiary_id)?.name || 'LOCAL'}</span></p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-4 hidden md:block">
                  <p className="text-[9px] text-gray-400 font-bold uppercase">Created</p>
                  <p className="text-[10px] text-gray-900 font-mono">{new Date(batch.created_at).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => deleteBatch(batch.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Settings2 size={16} />
                </button>
              </div>
            </div>
            {batch.notes && (
              <div className="mt-3 bg-gray-50 rounded-lg p-2 text-[10px] text-gray-500 border-l-2 border-mine-gold font-medium italic">
                “{batch.notes}”
              </div>
            )}
          </div>
        ))}
        {batches.length === 0 && !loading && (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Archive size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-[10px]">No active batches found in node cache</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-mine-green p-6 text-white">
              <h3 className="text-lg font-black uppercase tracking-tight">Initialize New Payroll Batch</h3>
              <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">Define processing parameters for node synchronization</p>
            </div>
            <form onSubmit={handleCreateBatch} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Processing Period</label>
                <input 
                  type="month" 
                  required
                  value={form.month}
                  onChange={e => setForm({...form, month: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Group</label>
                  <select 
                    value={form.group}
                    onChange={e => setForm({...form, group: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold"
                  >
                    <option value="General">General Staff</option>
                    <option value="Management">Management</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Node</label>
                  <select 
                    value={form.subsidiaryId}
                    onChange={e => setForm({...form, subsidiaryId: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2.5 text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold"
                  >
                    <option value="">{isSuperAdmin ? 'Global (All)' : 'Current Subsidiary'}</option>
                    {isSuperAdmin && subsidiaries.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Internal Notes</label>
                <textarea 
                  value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})}
                  placeholder="e.g., Q1 Special Bonus Inclusion..."
                  className="w-full bg-gray-50 border border-gray-200 rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-mine-green font-medium h-24"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-mine-green text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-mine-green-dark"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollBatchManagement;
