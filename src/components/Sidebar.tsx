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
  Building2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isAdmin }) => {
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
    }
  }

  return (
    <div className="w-64 bg-surface border-r border-border h-full flex flex-col shadow-2xl md:shadow-none">
      <nav className="flex-1 mt-6 px-3">
        <ul className="space-y-1">
          {menuItems.map((item: any) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-all text-[13px] font-medium ${
                  activeTab === item.id 
                    ? 'bg-blue-50 text-mine-blue border-l-4 border-mine-blue rounded-l-none shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={16} />
                  {item.label}
                </div>
                {item.badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-100 mb-2">
        <button 
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-red-600 text-xs font-bold uppercase tracking-wider transition-colors"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
