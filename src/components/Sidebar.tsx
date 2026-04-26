import React from 'react';
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

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isAdmin }) => {
  const { isSuperAdmin, signOut } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'loans', label: 'Loans', icon: BadgeDollarSign },
    { id: 'payslips', label: 'My Payslips', icon: FileText },
    { id: 'performance', label: 'Performance', icon: Users },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'employees', label: 'Staff Directory', icon: Users });
    menuItems.push({ id: 'admin', label: 'Payroll Admin', icon: ShieldCheck });
    if (isSuperAdmin) {
      menuItems.push({ id: 'subsidiaries', label: 'Subsidiaries', icon: Building2 });
    }
  }

  return (
    <div className="w-64 bg-surface border-r border-border h-full flex flex-col shadow-2xl md:shadow-none">
      <nav className="flex-1 mt-6 px-3">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-[13px] font-medium ${
                  activeTab === item.id 
                    ? 'bg-green-50 text-mine-green border-l-4 border-mine-green rounded-l-none' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                }`}
              >
                <item.icon size={16} />
                {item.label}
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
