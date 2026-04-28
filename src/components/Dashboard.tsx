import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { 
  Clock, 
  CalendarDays, 
  Wallet, 
  TrendingUp,
  PlusCircle,
  FileDown,
  ClipboardList,
  Target,
  Calendar,
  RefreshCw
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
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setLoading(true);
        try {
          // 1. Fetch Latest Payslip
          const { data: payslipData, error: payslipError } = await supabase
            .from('payslips')
            .select('*')
            .eq('user_id', user.id)
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (payslipError) throw payslipError;
          if (payslipData) {
            setRecentPayslip({
              ...payslipData,
              netPay: payslipData.net_pay
            });
          }

          // 2. Fetch Recent Activities (Leaves, Timesheets, Loans)
          const [leavesRes, timesheetsRes, loansRes] = await Promise.all([
            supabase.from('leave_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('timesheets').select('*').eq('user_id', user.id).order('submitted_at', { ascending: false }),
            supabase.from('loan_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
          ]);

          const pendingLeaves = (leavesRes.data || []).filter(d => d.status === 'pending').length;
          const pendingTimesheets = (timesheetsRes.data || []).filter(d => d.status === 'pending').length;
          const pendingLoans = (loansRes.data || []).filter(d => d.status === 'pending').length;
          setPendingCount(pendingLeaves + pendingTimesheets + pendingLoans);

          const combined = [
            ...(leavesRes.data || []).slice(0, 3).map(d => ({ ...d, id: d.id, actType: 'Leave Application', status: d.status, createdAt: d.created_at })),
            ...(timesheetsRes.data || []).slice(0, 3).map(d => ({ ...d, id: d.id, actType: 'Timesheet', status: d.status, createdAt: d.submitted_at })),
            ...(loansRes.data || []).slice(0, 3).map(d => ({ ...d, id: d.id, actType: 'Loan Application', status: d.status, createdAt: d.created_at }))
          ].sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt).getTime() || 0;
            const dateB = new Date(b.createdAt).getTime() || 0;
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

  const combinedStatsLeaveBalance = profile?.annual_leave_balance || 0;

  if (activeTab === 'timesheets') return <TimesheetForm />;
  if (activeTab === 'leave') return <LeaveForm />;
  if (activeTab === 'loans') return <LoanForm />;
  if (activeTab === 'payslips') return <PayslipList />;

  if (activeTab === 'performance') {
    return <PerformanceView />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="stat-box shadow-sm">
          <div className="stat-label uppercase tracking-widest font-black text-[10px]">Monthly Commitment</div>
          <div className="stat-val">160.00 Hours</div>
        </div>

        <div className="stat-box shadow-sm">
          <div className="stat-label uppercase tracking-widest font-black text-[10px]">Available Leave</div>
          <div className="stat-val text-blue-600 font-mono">{combinedStatsLeaveBalance.toFixed(1)} Days</div>
        </div>

        <div className="stat-box shadow-sm border-l-4 border-orange-400">
          <div className="stat-label uppercase tracking-widest font-black text-[10px] text-orange-600">Pending Approvals</div>
          <div className="stat-val text-orange-600 font-mono">{pendingCount} Items</div>
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
            <div className="card-title text-mine-green flex items-center justify-between">
              Performance Insights
              <button 
                onClick={() => setActiveTab('performance')}
                className="text-[10px] font-black uppercase tracking-widest text-mine-green hover:underline"
              >
                View Full Matrix
              </button>
            </div>
            <div className="p-4 bg-green-50/50 rounded-xl border border-green-100 flex items-center gap-4">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-mine-green shadow-sm"><Target size={20} /></div>
               <div>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-0.5">Development Roadmap</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Access your finalized evaluation matrices and strategic growth objectives.</p>
               </div>
            </div>
          </section>

          <section className="card">
            <div className="card-title">Recent Activity</div>
            {/* ... table content remains same ... */}
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
                        {act.date || (act.createdAt ? new Date(act.createdAt).toLocaleDateString() : 'N/A')}
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

const PerformanceView: React.FC = () => {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchReviews = async () => {
        try {
          const { data, error } = await supabase
            .from('personnel_reviews') // Assuming this table exists or I should add it
            .select('*')
            .eq('user_id', user.id)
            .order('review_date', { ascending: false });

          if (error) throw error;
          const mappedData = (data || []).map(rev => ({
            ...rev,
            reviewDate: rev.review_date,
            overallRating: rev.overall_rating,
          }));
          setReviews(mappedData);
        } catch (err) {
          console.error("Review fetch error:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchReviews();
    }
  }, [user]);

  const downloadReviewPDF = async (review: any) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('MINEAZY PERSONNEL AUDIT', 20, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('OFFICIAL PERFORMANCE MATRIX REPORT', 20, 32);
      
      // Personnel Info
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Personnel Information', 20, 55);
      
      doc.setDrawColor(210, 180, 140);
      doc.setLineWidth(0.5);
      doc.line(20, 58, 190, 58);
      
      doc.setFontSize(10);
      doc.text(`Full Name: ${profile?.full_name || user?.email}`, 20, 68);
      doc.text(`Designation: ${profile?.job_title || 'N/A'}`, 20, 75);
      doc.text(`Department: ${profile?.department || 'N/A'}`, 20, 82);
      doc.text(`Review Date: ${new Date(review.reviewDate).toLocaleDateString()}`, 140, 68);
      doc.text(`Rating: ${review.overallRating}.0 / 5.0`, 140, 75);
      
      // Evaluation Matrix
      doc.setFontSize(14);
      doc.text('Operational Evaluation', 20, 100);
      doc.line(20, 103, 190, 103);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const feedbackLines = doc.splitTextToSize(review.feedback || 'No transcript record detected.', 170);
      doc.text(feedbackLines, 20, 110);
      
      let nextY = 110 + (feedbackLines.length * 6) + 15;
      
      if (review.goals) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Strategic Objectives', 20, nextY);
        doc.line(20, nextY + 3, 190, nextY + 3);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const goalLines = doc.splitTextToSize(review.goals, 170);
        doc.text(goalLines, 20, nextY + 10);
        nextY += (goalLines.length * 6) + 20;
      }
      
      // Digital Fingerprint
      if (nextY > 250) {
        doc.addPage();
        nextY = 30;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Authorization Digital Fingerprint', 20, nextY);
      doc.line(20, nextY + 3, 100, nextY + 3);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Reviewer: ${review.reviewerName || 'System Admin'}`, 20, nextY + 12);
      doc.text(`Status: ${review.status.toUpperCase()}`, 20, nextY + 17);
      doc.text(`Generation Node: AIS-PROD-ZIMRA-HUB`, 20, nextY + 22);
      doc.text(`Timestamp: ${new Date().toISOString()}`, 20, nextY + 27);
      
      doc.save(`Personnel_Review_${(profile?.full_name || 'User').replace(/\s+/g, '_')}_${review.reviewDate}.pdf`);
    } catch (err) {
      console.error("PDF Fail:", err);
      toast.error("Failed to generate PDF audit report.");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-gray-900 italic serif">Performance Matrix</h2>
        <p className="text-sm text-gray-500 underline decoration-mine-green decoration-2 underline-offset-4 font-black uppercase tracking-widest text-[10px]">Development Roadmap Audit</p>
      </header>

      {loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="animate-spin text-mine-green mx-auto mb-4" size={32} />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">Querying Review Node...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card text-center py-24 space-y-4">
          <ClipboardList className="mx-auto text-gray-200" size={64} />
          <p className="text-sm text-gray-400 italic">No finalized performance evaluations found in your personnel node.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map(rev => (
            <div key={rev.id} className="card group relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 -mr-12 -mt-12 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
               <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 group-hover:bg-mine-green group-hover:text-white transition-colors">
                      <Calendar size={22} />
                    </div>
                    <div>
                      <p className="text-base font-black text-gray-900 italic serif">{new Date(rev.reviewDate).toLocaleDateString()}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                           <div key={i} className={`w-2 h-2 rounded-full ${i < rev.overallRating ? 'bg-mine-gold' : 'bg-gray-100'}`}></div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`badge border ${rev.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                      {rev.status}
                    </span>
                    {rev.status === 'completed' && (
                      <button 
                        onClick={() => downloadReviewPDF(rev)}
                        className="flex items-center gap-1 text-[10px] font-black text-mine-green uppercase tracking-widest hover:underline"
                      >
                        <FileDown size={12} /> Audit PDF
                      </button>
                    )}
                  </div>
               </div>
               
               <div className="space-y-6 relative z-10">
                  <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[3px] mb-2">Manager Feedback</p>
                    <p className="text-xs text-gray-600 leading-relaxed italic bg-gray-50/50 p-4 rounded-xl">{rev.feedback}</p>
                  </div>
                  {rev.goals && (
                    <div className="bg-mine-green/5 p-4 rounded-xl border border-mine-green/10">
                      <p className="text-[9px] font-black text-mine-green uppercase tracking-[3px] mb-2 flex items-center gap-1">
                        <Target size={12} /> Strategic Objectives
                      </p>
                      <p className="text-xs text-slate-800 font-bold">{rev.goals}</p>
                    </div>
                  )}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
