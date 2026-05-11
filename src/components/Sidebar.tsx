import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Clock, 
  Calendar, 
  BadgeDollarSign, 
  FileText, 
  Settings,
  LogOut,
  ShieldCheck,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  History
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isAdmin, isCollapsed, setIsCollapsed }) => {
  const { isSuperAdmin, signOut, profile } = useAuth();
  const [counts, setCounts] = useState<{timesheets: number, leave: number, loans: number}>({ timesheets: 0, leave: 0, loans: 0 });

  useEffect(() => {
    if (isAdmin) {
      const fetchCounts = async () => {
        try {
          const fetchOne = async (table: string) => {
            let q = supabase.from(table).select('id', { count: 'exact', head: true }).in('status', ['pending', 'submitted']);
            if (!isSuperAdmin) {
              if (profile?.subsidiary_id) {
                q = q.or(`subsidiary_id.eq.${profile.subsidiary_id},subsidiary_id.is.null`);
              } else {
                q = q.is('subsidiary_id', null);
              }
            }
            const { count } = await q;
            return count || 0;
          };

          const [t, l, lo] = await Promise.all([
            fetchOne('timesheets'),
            fetchOne('leave_requests'),
            fetchOne('loan_requests')
          ]);
          setCounts({ timesheets: t, leave: l, loans: lo });
        } catch (err) {
          console.error("Failed to fetch sidebar counts:", err);
        }
      };

      fetchCounts();
      // Set up a refresh interval every 30 seconds for badges
      const interval = setInterval(fetchCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, isSuperAdmin, profile?.subsidiary_id]);

  const menuItems: { id: string, label: string, icon: any, badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'loans', label: 'Loans', icon: BadgeDollarSign },
    { id: 'payslips', label: 'My Payslips', icon: FileText },
    { id: 'performance', label: 'Performance', icon: Users },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'employees', label: 'Staff Directory', icon: Users, badge: counts.timesheets + counts.leave });
    menuItems.push({ id: 'admin', label: 'Payroll Admin', icon: ShieldCheck, badge: counts.timesheets + counts.leave + counts.loans });
    if (isSuperAdmin) {
      menuItems.push({ id: 'subsidiaries', label: 'Subsidiaries', icon: Building2 });
      menuItems.push({ id: 'audit', label: 'Audit Trail', icon: History });
    }
  }

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-surface border-r border-border h-full flex flex-col shadow-2xl md:shadow-none transition-all duration-300 relative`}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center text-gray-400 hover:text-mine-blue hover:border-mine-blue shadow-sm z-50 hidden md:flex transition-all"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className="flex-1 mt-6 px-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <ul className="space-y-1">
          {menuItems.map((item: any) => (
            <li key={item.id} className="group/item">
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-2.5 rounded-md transition-all text-[13px] font-medium relative ${
                  activeTab === item.id 
                    ? 'bg-blue-50 text-mine-blue border-l-4 border-mine-blue rounded-l-none shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 flex items-center justify-center w-5 h-5">
                    <item.icon size={16} />
                  </div>
                  {!isCollapsed && (
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  )}
                </div>
                {!isCollapsed && item.badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                    {item.badge}
                  </span>
                )}
                
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider rounded opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all whitespace-nowrap z-50 shadow-xl pointer-events-none">
                    {item.label}
                    {item.badge > 0 && (
                      <span className="ml-2 bg-red-500 text-white px-1 rounded-sm text-[8px]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                
                {isCollapsed && item.badge > 0 && (
                  <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-100 mb-2">
        <button 
          onClick={() => signOut()}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-gray-500 hover:text-red-600 text-xs font-bold uppercase tracking-wider transition-colors relative group/logout`}
        >
          <LogOut size={16} />
          {!isCollapsed && <span>Logout</span>}
          
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded opacity-0 invisible group-hover/logout:opacity-100 group-hover/logout:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              Terminate Session
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
