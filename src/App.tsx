import React from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { LogIn, Pickaxe } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './lib/firebase';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import EmployeeManagement from './components/EmployeeManagement';
import Sidebar from './components/Sidebar';
import SubsidiaryManagement from './components/SubsidiaryManagement';
import { motion, AnimatePresence } from 'motion/react';

import GlobalSearch from './components/GlobalSearch';

function LoginScreen() {
  const handleLogin = () => {
    signInWithPopup(auth, new GoogleAuthProvider());
  };

  return (
    <div className="min-h-screen bg-mine-green flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-mine-gold/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/20 rounded-full blur-3xl -ml-48 -mb-48"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full card !p-10 text-center border-mine-gold/30 shadow-2xl z-10"
      >
        <div className="w-16 h-16 bg-mine-green text-mine-gold rounded-xl flex items-center justify-center mx-auto mb-6 border-2 border-mine-gold/50 shadow-inner overflow-hidden">
          <Pickaxe size={32} className="rotate-12" />
        </div>
        <h1 className="text-3xl font-black text-mine-green uppercase tracking-tighter mb-1">Mineazy</h1>
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[4px] mb-10">Payroll Solutions</p>
        
        <button
          onClick={handleLogin}
          className="btn btn-outline w-full !py-4 !text-sm flex items-center justify-center gap-3 border-2 border-app-bg"
        >
          <LogIn size={20} className="text-mine-green" />
          Authenticate via Google
        </button>
        
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-mine-green border-t-mine-gold rounded-full animate-spin"></div>
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

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-16 bg-mine-green text-white flex items-center justify-between px-4 sm:px-6 border-b-4 border-mine-gold shrink-0 z-50">
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
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-mine-gold rounded-lg flex items-center justify-center text-mine-green shadow-sm shrink-0">
            <Pickaxe size={20} className="-rotate-12 transition-transform hover:rotate-0 duration-300 sm:w-6 sm:h-6" />
          </div>
          <div className="leading-tight hidden xs:block">
            <div className="font-extrabold text-lg sm:text-xl uppercase tracking-tighter">Mineazy</div>
            <div className="text-[7px] sm:text-[9px] opacity-80 font-black tracking-widest">MINING SOLUTIONS</div>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-4 hidden sm:block">
          <GlobalSearch setActiveTab={handleSetTab} />
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold">{profile?.fullName}</div>
            <div className="text-[11px] opacity-80 uppercase tracking-wider">{profile?.role} Administrator</div>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-full border-2 border-mine-gold overflow-hidden shrink-0">
            {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : null}
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
          fixed md:relative inset-y-0 left-0 z-40 transform md:transform-none transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <Sidebar activeTab={activeTab} setActiveTab={handleSetTab} isAdmin={isAdmin} />
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* Mobile Search - only visible on small screens when header search is hidden */}
          <div className="mb-4 sm:hidden">
            <GlobalSearch setActiveTab={handleSetTab} />
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
              {isAdmin && activeTab === 'employees' && <EmployeeManagement />}
              {isSuperAdmin && activeTab === 'subsidiaries' && <SubsidiaryManagement />}
              {(!isAdmin || (activeTab !== 'admin' && activeTab !== 'employees' && activeTab !== 'subsidiaries')) && (
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
      <MainApp />
    </AuthProvider>
  );
}
