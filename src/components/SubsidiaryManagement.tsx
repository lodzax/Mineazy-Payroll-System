import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Building2, Plus, Edit2, Shield, Trash2, CheckCircle2, AlertCircle, X, Search, Globe, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../lib/AuthContext';

const SubsidiaryManagement: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [subsidiaries, setSubsidiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    taxId: '',
    registrationNumber: '',
    address: '',
    country: 'Zimbabwe',
    currency: 'USD',
    status: 'active'
  });

  const fetchSubsidiaries = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'subsidiaries'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setSubsidiaries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      handleFirestoreError(err, 'list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubsidiaries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    try {
      if (editingSub) {
        await updateDoc(doc(db, 'subsidiaries', editingSub.id), {
          ...form,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'subsidiaries'), {
          ...form,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchSubsidiaries();
    } catch (err) {
      handleFirestoreError(err, 'write');
    }
  };

  if (!isSuperAdmin) return <div className="p-12 text-center text-red-500 font-bold uppercase tracking-widest">Unauthorized Access - Super User Clearance Required</div>;
  if (loading) return <div className="p-8 text-center text-gray-500 font-mono text-xs uppercase tracking-widest animate-pulse">Establishing Multi-Node Connection...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 italic serif">Business Group Management</h1>
          <p className="text-sm text-gray-500">Configure and monitor subsidiary corporate nodes</p>
        </div>
        <button 
          onClick={() => { setEditingSub(null); setForm({ name: '', taxId: '', registrationNumber: '', address: '', country: 'Zimbabwe', currency: 'USD', status: 'active' }); setIsModalOpen(true); }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Spawn Subsidiary
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subsidiaries.map((sub) => (
          <motion.div 
            layout
            key={sub.id} 
            className="card group hover:border-mine-green transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-full -mr-12 -mt-12 group-hover:bg-green-50 transition-colors"></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="w-12 h-12 bg-gray-900 text-mine-gold rounded-lg flex items-center justify-center border border-white/10 shadow-lg">
                <Building2 size={24} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => { setEditingSub(sub); setForm({ ...sub }); setIsModalOpen(true); }}
                  className="p-2 text-gray-400 hover:text-mine-green"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>

            <div className="relative z-10 space-y-1">
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight leading-none mb-1">{sub.name}</h3>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                <Globe size={10} /> {sub.country} • <span className="text-mine-gold">{sub.currency} Vault</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">Tax Reference</p>
                <p className="text-xs font-mono font-bold text-gray-700">{sub.taxId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">Status</p>
                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${sub.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {sub.status === 'active' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                  {sub.status}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-[10px] items-center text-gray-500 bg-gray-50 p-2 rounded">
                 <span className="font-bold">Managed Nodes</span>
                 <span className="font-mono text-gray-900">0 Staff / 0 Leads</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-mine-gold/20 rounded">
                    <Shield className="text-mine-gold" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold italic serif">
                      {editingSub ? 'Update Subsidiary Node' : 'Initialize New Subsidiary'}
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[2px]">Primary Corporate Infrastructure</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Legal Company Name</label>
                    <div className="relative">
                       <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                       <input 
                        type="text" 
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-mine-green transition-all"
                        placeholder="e.g. Mineazy Logistics Ltd"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tax Representative ID</label>
                      <input 
                        type="text" 
                        value={form.taxId}
                        onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-mine-green"
                        placeholder="BP-88129-ZW"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Reporting Currency</label>
                      <select 
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold"
                      >
                        <option value="USD">USD (US Dollar)</option>
                        <option value="ZWG">ZWG (Zimbabwe Gold)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                     <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Registered Physical Address</label>
                     <textarea 
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-mine-green min-h-[80px]"
                        placeholder="Plot 44, Mining District, Harare..."
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Operative Status</label>
                      <select 
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-mine-green font-bold uppercase tracking-widest text-[10px]"
                      >
                        <option value="active">Active Terminal</option>
                        <option value="suspended">Suspended Service</option>
                      </select>
                    </div>
                    <div className="flex items-end flex-col justify-end">
                       <p className="text-[8px] text-gray-400 text-right uppercase font-bold italic leading-tight">By spawning a subsidiary, you initialize a new payroll silo with independent audit trails.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit" 
                    className="flex-3 px-6 py-3 bg-mine-green text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-green-100 hover:brightness-110 active:scale-95 transition-all"
                  >
                    {editingSub ? 'Authorize Update' : 'Authorize Initialization'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubsidiaryManagement;
