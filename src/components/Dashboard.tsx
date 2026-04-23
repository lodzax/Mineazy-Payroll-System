import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Clock, 
  CalendarDays, 
  Wallet, 
  TrendingUp,
  PlusCircle,
  FileDown
} from 'lucide-react';
import TimesheetForm from './TimesheetForm';
import LeaveForm from './LeaveForm';
import LoanForm from './LoanForm';
import PayslipList from './PayslipList';

interface DashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ activeTab, setActiveTab }) => {
  const { user, profile } = useAuth();
  const [recentPayslip, setRecentPayslip] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setLoading(true);
        try {
          // 1. Fetch Latest Payslip
          const payslipQ = query(
            collection(db, 'payslips'),
            where('employeeId', '==', user.uid),
            orderBy('generatedAt', 'desc'),
            limit(1)
          );
          const payslipSnap = await getDocs(payslipQ);
          if (!payslipSnap.empty) {
            setRecentPayslip(payslipSnap.docs[0].data());
          }

          // 2. Fetch Recent Activities (Leaves, Timesheets, Loans)
          const [leavesSnap, timesheetsSnap, loansSnap] = await Promise.all([
            getDocs(query(collection(db, 'leave_applications'), where('employeeId', '==', user.uid), orderBy('createdAt', 'desc'), limit(3))),
            getDocs(query(collection(db, 'timesheets'), where('employeeId', '==', user.uid), orderBy('submittedAt', 'desc'), limit(3))),
            getDocs(query(collection(db, 'loan_applications'), where('employeeId', '==', user.uid), orderBy('createdAt', 'desc'), limit(3)))
          ]);

          const combined = [
            ...leavesSnap.docs.map(d => ({ ...d.data() as any, id: d.id, actType: 'Leave Application' })),
            ...timesheetsSnap.docs.map(d => ({ ...d.data() as any, id: d.id, actType: 'Timesheet' })),
            ...loansSnap.docs.map(d => ({ ...d.data() as any, id: d.id, actType: 'Loan Application' }))
          ].sort((a: any, b: any) => {
            const dateA = a.createdAt?.toMillis?.() || a.submittedAt?.toMillis?.() || 0;
            const dateB = b.createdAt?.toMillis?.() || b.submittedAt?.toMillis?.() || 0;
            return dateB - dateA;
          }).slice(0, 5);

          setActivities(combined);

        } catch (err) {
          console.error("Dashboard fetch error:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [user]);

  const combinedStatsLeaveBalance = profile?.annualLeaveBalance || 0;

  if (activeTab === 'timesheets') return <TimesheetForm />;
  if (activeTab === 'leave') return <LeaveForm />;
  if (activeTab === 'loans') return <LoanForm />;
  if (activeTab === 'payslips') return <PayslipList />;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-box shadow-sm">
          <div className="stat-label uppercase tracking-widest font-black text-[10px]">Monthly Commitment</div>
          <div className="stat-val">160.00 Hours</div>
        </div>

        <div className="stat-box shadow-sm">
          <div className="stat-label uppercase tracking-widest font-black text-[10px]">Available Leave</div>
          <div className="stat-val text-blue-600 font-mono">{combinedStatsLeaveBalance.toFixed(1)} Days</div>
        </div>

        <div className="stat-box shadow-sm">
          <div className="stat-label uppercase tracking-widest font-black text-[10px]">Latest Net Pay ({profile?.currency})</div>
          <div className="stat-val text-mine-gold font-mono">
            {recentPayslip?.netPay ? recentPayslip.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '--.--'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <section className="card">
            <div className="card-title">Recent Activity</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-app-bg text-gray-500 font-bold uppercase tracking-tighter">
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Action</th>
                    <th className="py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-bg">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-mono text-gray-400">
                        {act.date || (act.createdAt?.toDate ? act.createdAt.toDate().toLocaleDateString() : (act.submittedAt?.toDate ? act.submittedAt.toDate().toLocaleDateString() : 'N/A'))}
                      </td>
                      <td className="py-3 font-semibold text-gray-800 uppercase tracking-tight text-[11px]">{act.actType}</td>
                      <td className="py-3">
                        <span className={`badge ${
                          act.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                          act.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' : 
                          'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                          {act.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400 italic">No historical activities found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-auto pt-6 flex gap-3">
              <button className="btn btn-primary">Generate Report</button>
              <button className="btn btn-outline">Export Logs</button>
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="card bg-slate-900 border-none">
            <div className="card-title text-mine-gold">ZIMRA Compliance Info</div>
            <div className="bg-slate-800 rounded-md p-3 font-mono text-[11px] text-gray-300 space-y-2">
              <div className="flex justify-between border-b border-slate-700 pb-1">
                <span>Tax Band A</span>
                <span className="text-mine-gold">0%</span>
              </div>
              <div className="flex justify-between border-b border-slate-700 pb-1">
                <span>Tax Band B</span>
                <span className="text-mine-gold">20%</span>
              </div>
              <div className="flex justify-between border-b border-slate-700 pb-1">
                <span>Tax Band C</span>
                <span className="text-mine-gold">25%</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-500 italic">AIDS Levy</span>
                <span>3% of PAYE</span>
              </div>
            </div>
          </section>

          <section className="card shrink-0">
            <div className="card-title">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2">
              <div 
                onClick={() => setActiveTab('timesheets')}
                className="p-3 border border-border rounded-md text-center hover:bg-green-50 hover:border-mine-green transition-all cursor-pointer group"
              >
                <div className="flex justify-center mb-1 text-gray-400 group-hover:text-mine-green"><Clock size={16} /></div>
                <div className="font-bold text-[10px] uppercase leading-tight">Submit<br/>Timesheet</div>
              </div>
              <div 
                onClick={() => setActiveTab('leave')}
                className="p-3 border border-border rounded-md text-center hover:bg-green-50 hover:border-mine-green transition-all cursor-pointer group"
              >
                <div className="flex justify-center mb-1 text-gray-400 group-hover:text-mine-green"><CalendarDays size={16} /></div>
                <div className="font-bold text-[10px] uppercase leading-tight">Apply<br/>For Leave</div>
              </div>
              <div 
                onClick={() => setActiveTab('loans')}
                className="p-3 border border-border rounded-md text-center hover:bg-green-50 hover:border-mine-green transition-all cursor-pointer group"
              >
                <div className="flex justify-center mb-1 text-gray-400 group-hover:text-mine-green"><Wallet size={16} /></div>
                <div className="font-bold text-[10px] uppercase leading-tight">Loan<br/>Calculator</div>
              </div>
              <div 
                onClick={() => setActiveTab('payslips')}
                className="p-3 border border-border rounded-md text-center hover:bg-green-50 hover:border-mine-green transition-all cursor-pointer group"
              >
                <div className="flex justify-center mb-1 text-gray-400 group-hover:text-mine-green"><TrendingUp size={16} /></div>
                <div className="font-bold text-[10px] uppercase leading-tight">Tax<br/>Reports</div>
              </div>
            </div>
            <div className="mt-6">
              <div className="card-title !mb-2">System Status</div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-500">NSSA Hub</span>
                <span className="text-green-600 font-bold">Online</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Inter-Bank API</span>
                <span className="text-green-600 font-bold">Active</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
