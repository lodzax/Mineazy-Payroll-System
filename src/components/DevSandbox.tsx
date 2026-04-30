import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Settings, 
  User, 
  Shield, 
  Briefcase, 
  Database,
  RefreshCw,
  X,
  ChevronRight,
  LogOut,
  Activity,
  Zap,
  LayoutDashboard,
  CreditCard,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DEV_USERS = [
  {
    email: 'admin@mineazy.test',
    password: 'Mining2026!',
    fullName: 'System Administrator',
    role: 'admin',
    label: 'Admin',
    icon: <Shield size={16} />,
    shortcuts: [
      { label: 'Payroll Central', path: '/payroll', icon: <CreditCard size={12} /> },
      { label: 'Staff Roster', path: '/employees', icon: <Users size={12} /> }
    ]
  },
  {
    email: 'payroll@mineazy.test',
    password: 'Mining2026!',
    fullName: 'Payroll Controller',
    role: 'management',
    label: 'Payroll Admin',
    icon: <Database size={16} />,
    shortcuts: [
      { label: 'Payroll Review', path: '/payroll', icon: <CreditCard size={12} /> }
    ]
  },
  {
    email: 'emp1@mineazy.test',
    password: 'Mining2026!',
    fullName: 'Operational Staff A',
    role: 'employee',
    label: 'Employee 1',
    icon: <User size={16} />,
    shortcuts: [
      { label: 'My Dashboard', path: '/', icon: <LayoutDashboard size={12} /> }
    ]
  },
  {
    email: 'emp2@mineazy.test',
    password: 'Mining2026!',
    fullName: 'Operational Staff B',
    role: 'employee',
    label: 'Employee 2',
    icon: <User size={16} />,
    shortcuts: [
      { label: 'My Dashboard', path: '/', icon: <LayoutDashboard size={12} /> }
    ]
  }
];

export default function DevSandbox() {
  const { user, profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Monitor backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${window.location.origin}/api/health`);
        const data = await response.json();
        if (data.status === 'online') {
          setHealthStatus('online');
        } else {
          setHealthStatus('offline');
        }
      } catch (err) {
        setHealthStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const switchUser = async (devUser: typeof DEV_USERS[0]) => {
    setLoading(devUser.email);
    console.log(`Starting identity swap to: ${devUser.email}`);
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('mineazy-auth-token');
      await new Promise(r => setTimeout(r, 400));

      const { data, error } = await supabase.auth.signInWithPassword({
        email: devUser.email,
        password: devUser.password,
      });

      if (error) {
        console.error('Sign in error during switch:', error);
        throw error;
      }

      if (!data.session) {
        throw new Error('Login successful but no session established.');
      }
      
      toast.success(`Identity assumed: ${devUser.label}`);
      setIsOpen(false);
      
      console.log('Switch successful, reloading app...');
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      console.error('Identity Switch Failure:', err);
      
      if (err.message?.includes('Encryption') || err.message?.includes('decryption')) {
        localStorage.removeItem('mineazy-auth-token');
        toast.error('Session vault corrupted. Resetting...');
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      
      if (err.message?.includes('Invalid login credentials')) {
        toast.error('Authentication rejected. Ensure dev nodes are synchronized.');
      } else if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        toast.error('Network disconnect. Supabase unreachable.');
      } else {
        toast.error(err.message || 'System identity failure.');
      }
    } finally {
      setLoading(null);
    }
  };

  const seedUsers = async () => {
    if (!profile && !user) {
      toast.error('Admin identity required for synchronization.');
      return;
    }
    
    setIsSeeding(true);
    let successCount = 0;
    let skipCount = 0;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      for (const devUser of DEV_USERS) {
        try {
          const apiUrl = `${window.location.origin}/api/admin/create-user`;
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              email: devUser.email,
              password: devUser.password,
              fullName: devUser.fullName,
              metadata: {
                role: devUser.role,
                status: 'active',
                department: devUser.role === 'employee' ? 'Mining Operations' : 'Administration',
                base_salary: devUser.role === 'employee' ? 1200 : 2500
              }
            })
          });

          if (!response.ok) {
            const err = await response.json();
            console.log(`Seed status for ${devUser.email}:`, err.error);
            skipCount++;
          } else {
            successCount++;
          }
        } catch (innerErr: any) {
          console.error(`Failed to sync ${devUser.email}:`, innerErr);
          if (innerErr.name === 'TypeError' && innerErr.message === 'Failed to fetch') {
            toast.error(`Network error syncing ${devUser.label}. Check server connectivity.`);
          }
        }
      }
      
      toast.success(`Sync Complete: ${successCount} node(s) created, ${skipCount} updated.`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error('Seed fail:', err);
      toast.error('Seeding protocol failed.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-[9999] hover:bg-black transition-all group border-2 border-mine-gold/30"
      >
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${healthStatus === 'online' ? 'bg-mine-gold' : 'bg-red-500'}`}></span>
          <span className={`relative inline-flex rounded-full h-3 w-3 ${healthStatus === 'online' ? 'bg-mine-gold' : 'bg-red-500'}`}></span>
        </span>
        <Settings className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[10000] flex justify-end overflow-hidden pointer-events-none">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
            />

            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm bg-slate-950 h-full shadow-2xl pointer-events-auto flex flex-col border-l border-mine-gold/20 font-sans"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b-4 border-mine-gold shrink-0">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter italic">Dev Suite</h2>
                  <p className="text-[10px] font-bold text-mine-gold uppercase tracking-[3px]">Kernel Debugger 04.26</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} className="text-mine-gold" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Health Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                      <Activity size={24} className="text-mine-gold" />
                    </div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Node API</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${healthStatus === 'online' ? 'bg-mine-green' : healthStatus === 'offline' ? 'bg-red-500' : 'bg-mine-gold animate-pulse'}`} />
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">{healthStatus}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                      <Zap size={24} className="text-mine-gold" />
                    </div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Protocol</p>
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">REST + WS</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <User size={10} className="text-mine-gold" /> 
                    Current Identity
                  </div>
                  {user ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-mine-gold text-slate-900 rounded-xl flex items-center justify-center font-black text-xl shadow-lg">
                          {profile?.full_name?.[0] || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{profile?.full_name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{user.email}</p>
                          <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 bg-mine-gold/10 text-mine-gold rounded border border-mine-gold/20 text-[9px] font-black uppercase tracking-tighter">
                            <Briefcase size={10} /> {profile?.role || 'Guest'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Active Node Shortcuts */}
                      {DEV_USERS.find(du => du.email === user.email)?.shortcuts && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {DEV_USERS.find(du => du.email === user.email)?.shortcuts?.map((s) => (
                            <button
                              key={s.label}
                              onClick={() => {
                                window.location.href = s.path;
                                setIsOpen(false);
                              }}
                              className="px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-mine-gold text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all"
                            >
                              {s.icon}
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-500 italic">No heartbeat found.</p>
                  )}
                </div>

                {/* Identity Selection */}
                <div className="space-y-3">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Simulate Endpoint</div>
                  <div className="grid grid-cols-1 gap-2">
                    {DEV_USERS.map((devUser) => (
                      <button
                        key={devUser.email}
                        disabled={loading !== null || user?.email === devUser.email}
                        onClick={() => switchUser(devUser)}
                        className={`
                          flex items-center justify-between p-3 rounded-xl border transition-all text-left relative overflow-hidden group
                          ${user?.email === devUser.email 
                            ? 'bg-slate-800 border-mine-gold ring-1 ring-mine-gold/50' 
                            : 'bg-slate-900 border-slate-800 hover:border-mine-gold hover:bg-slate-800'}
                          ${loading === devUser.email ? 'animate-pulse' : ''}
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        <div className="flex items-center gap-3 relative z-10">
                          <div className={`
                            w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                            ${user?.email === devUser.email ? 'bg-mine-gold text-slate-900 font-bold' : 'bg-slate-800 text-slate-400 group-hover:text-mine-gold'}
                          `}>
                            {devUser.icon}
                          </div>
                          <div>
                            <p className="text-xs font-black text-white">{devUser.label}</p>
                            <p className="text-[9px] font-bold text-slate-500">{devUser.email}</p>
                          </div>
                        </div>
                        {user?.email === devUser.email && (
                          <div className="text-[7px] font-black text-slate-900 uppercase tracking-widest bg-mine-gold px-2 py-1 rounded-sm shadow-sm relative z-10">Running</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* System Terminal Tools */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 mb-4">Diagnostic Commands</div>
                  <div className="space-y-2">
                    <button 
                      onClick={seedUsers}
                      disabled={isSeeding}
                      className="w-full h-10 bg-slate-900 border border-slate-700 hover:border-mine-gold text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[2px] transition-all rounded-xl"
                    >
                      {isSeeding ? <RefreshCw className="animate-spin text-mine-gold" size={14} /> : <Database className="text-mine-gold" size={14} />}
                      Sync Global Nodes
                    </button>
                    <button 
                      onClick={async () => {
                        await signOut();
                        localStorage.removeItem('mineazy-auth-token');
                        setIsOpen(false);
                        toast.success('Session purge successful.');
                        setTimeout(() => window.location.reload(), 500);
                      }}
                      className="w-full h-10 bg-transparent border border-red-900/50 hover:bg-red-950 text-red-500 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[2px] transition-all rounded-xl"
                    >
                      <LogOut size={14} /> Purge Terminal Session
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-900/50 text-center shrink-0 border-t border-slate-800">
                <p className="text-[8px] font-bold text-slate-600 uppercase tracking-[4px]">Mineazy Ledger System // Kernel Access Verified</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
