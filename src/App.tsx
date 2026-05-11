import React from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { LogIn, Pickaxe, Mail, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import EmployeeManagement from './components/EmployeeManagement';
import Sidebar from './components/Sidebar';
import SubsidiaryManagement from './components/SubsidiaryManagement';
import AuditTrail from './components/AuditTrail';
import { motion, AnimatePresence } from 'motion/react';

import GlobalSearch from './components/GlobalSearch';
import DevSandbox from './components/DevSandbox';

function LoginScreen() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(`Instruction node sent to ${email}. Please check your communication logs (inbox).`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split('@')[0],
            }
          }
        });
        if (signUpError) throw signUpError;
        toast.success('Registration request sent. Please log in with your credentials.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mine-blue flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-mine-gold/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/20 rounded-full blur-3xl -ml-48 -mb-48"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full card !p-10 text-center border-mine-gold/30 shadow-2xl z-10"
      >
        <div className="w-16 h-16 bg-mine-blue text-mine-gold rounded-xl flex items-center justify-center mx-auto mb-6 border-2 border-mine-gold/50 shadow-inner overflow-hidden">
          <Pickaxe size={32} className="rotate-12" />
        </div>
        <h1 className="text-3xl font-black text-mine-blue uppercase tracking-tighter mb-1">Mineazy</h1>
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[4px] mb-10">Payroll Solutions</p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-[10px] font-bold uppercase tracking-tight text-left">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {isSignUp && (
            <div className="relative text-left">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block px-1">Full Identity</label>
              <div className="relative">
                <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  required
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-mine-blue"
                />
              </div>
            </div>
          )}

          <div className="relative text-left">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block px-1">Credential ID</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-mine-blue"
              />
            </div>
          </div>
          <div className="relative text-left">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block px-1">Access Token</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="password"
                required
                placeholder="System Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-mine-blue"
              />
            </div>
          </div>
          <button
            disabled={loading}
            type="submit"
            className="btn btn-primary w-full !py-4 !text-sm flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <LogIn size={18} />}
            {loading ? (isSignUp ? 'Initializing...' : 'Authorizing...') : (isSignUp ? 'Initialize Profile' : 'Enter System')}
          </button>

          <div className="flex flex-col gap-3 pt-2">
            {!isSignUp && (
              <button 
                type="button"
                onClick={handlePasswordReset}
                className="text-[9px] font-black text-mine-gold uppercase tracking-widest hover:underline decoration-mine-gold/50 underline-offset-4"
              >
                Forgot system credentials? Reset node.
              </button>
            )}
            
            <button 
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-mine-gold transition-colors"
            >
              {isSignUp ? 'Back to Authentication' : 'Request Enterprise Access (Sign Up)'}
            </button>
          </div>
        </form>
        
        <div className="mt-12 flex flex-col items-center gap-2">
          <div className="h-[1px] w-12 bg-mine-gold"></div>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black leading-relaxed">
            Restricted System Access<br/>Authorized Mining Personnel Only
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function MainApp() {
  const { user, profile, loading, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [selectedEmployeeFromSearch, setSelectedEmployeeFromSearch] = React.useState<any | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-mine-blue border-t-mine-gold rounded-full animate-spin"></div>
          <p className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-widest">Encrypting Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleGlobalSearchSelect = (result: any) => {
    if (result.type === 'employee') {
      setSelectedEmployeeFromSearch(result.data);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-16 bg-mine-blue text-white flex items-center justify-between px-4 sm:px-6 border-b-4 border-mine-gold shrink-0 z-50 shadow-lg shadow-blue-900/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`h-0.5 w-full bg-white transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
              <span className={`h-0.5 w-full bg-white transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
              <span className={`h-0.5 w-full bg-white transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
            </div>
          </button>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-mine-gold rounded-lg flex items-center justify-center text-mine-blue shadow-sm shrink-0">
            <Pickaxe size={20} className="-rotate-12 transition-transform hover:rotate-0 duration-300 sm:w-6 sm:h-6" />
          </div>
          <div className="leading-tight hidden xs:block">
            <div className="font-extrabold text-lg sm:text-xl uppercase tracking-tighter">Mineazy</div>
            <div className="text-[7px] sm:text-[9px] opacity-80 font-black tracking-widest">MINING SOLUTIONS</div>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <GlobalSearch setActiveTab={handleSetTab} onSelect={handleGlobalSearchSelect} />
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="text-right">
            <div className="text-xs sm:text-sm font-semibold leading-none mb-0.5">{profile?.full_name}</div>
            <div className="text-[8px] sm:text-[11px] opacity-80 uppercase tracking-wider leading-none">
              {isSuperAdmin ? 'Security Council' : isAdmin ? 'Site Manager' : 'Operational Node'}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full border-2 border-mine-gold overflow-hidden shrink-0 flex items-center justify-center">
            {(user as any).photoURL || user.user_metadata?.avatar_url ? (
              <img src={(user as any).photoURL || user.user_metadata?.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <span className="text-mine-blue font-black text-xs sm:text-sm uppercase">
                {profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'M'}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
            />
          )}
        </AnimatePresence>

        <div className={`
          fixed md:relative inset-y-0 left-0 z-40 transform md:transform-none transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        `}>
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={handleSetTab} 
            isAdmin={isAdmin} 
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
          />
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* Mobile Search - only visible on small screens when header search is hidden */}
          <div className="mb-4 sm:hidden">
            <GlobalSearch setActiveTab={handleSetTab} onSelect={handleGlobalSearchSelect} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isAdmin && activeTab === 'admin' && <AdminDashboard />}
              {isAdmin && activeTab === 'employees' && (
                <EmployeeManagement 
                  preSelectedEmployee={selectedEmployeeFromSearch} 
                  onClearPreSelected={() => setSelectedEmployeeFromSearch(null)}
                />
              )}
              {isSuperAdmin && activeTab === 'subsidiaries' && <SubsidiaryManagement />}
              {isSuperAdmin && activeTab === 'audit' && (
                <AuditTrail 
                  subsidiaryId={profile?.subsidiary_id} 
                  isSuperAdmin={isSuperAdmin} 
                />
              )}
              {(!isAdmin || (activeTab !== 'admin' && activeTab !== 'employees' && activeTab !== 'subsidiaries' && (activeTab !== 'audit' || !isSuperAdmin))) && (
                <Dashboard activeTab={activeTab} setActiveTab={handleSetTab} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <MainApp />
      <DevSandbox />
    </AuthProvider>
  );
}
