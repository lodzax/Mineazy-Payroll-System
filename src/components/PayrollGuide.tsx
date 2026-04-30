import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  FileCheck, 
  Calculator, 
  ShieldCheck, 
  Lock, 
  ArrowRight,
  Info 
} from 'lucide-react';

const PayrollGuide: React.FC = () => {
  const steps = [
    {
      title: "1. Timesheet Submission",
      actor: "Employees",
      icon: <Clock className="text-blue-500" />,
      description: "Employees must log and submit their working hours and overtime for the current period via the Timesheet portal.",
      details: "Ensure all staff have submitted before the cut-off date to avoid missing salary components."
    },
    {
      title: "2. Verification & Approval",
      actor: "Admins / Managers",
      icon: <FileCheck className="text-amber-500" />,
      description: "Review and approve submitted timesheets in the 'Timesheet Approval Queue'.",
      details: "Only 'Approved' timesheets are used for payroll calculations. Rejected or pending ones are ignored by the engine."
    },
    {
      title: "3. Integrity Check",
      actor: "Admins",
      icon: <ShieldCheck className="text-purple-500" />,
      description: "Review the 'Readiness & Integrity Matrix' to identify outstanding loans, leave requests, or missing timesheets.",
      details: "A clean matrix ensures that gross calculations, deductions, and accruals are accurate."
    },
    {
      title: "4. Node Generation (Draft)",
      actor: "Admins",
      icon: <Calculator className="text-mine-green" />,
      description: "Initiate the 'Batch Processing' for the specific payroll group (e.g., General, Executive).",
      details: "This phase computes base salaries, overtime pay, PAYE tax, NSSA, and loan deductions based on live system data."
    },
    {
      title: "5. Audit & Validation",
      actor: "Admins",
      icon: <Info className="text-indigo-500" />,
      description: "Review calculated records in the 'Draft Payroll Matrix'.",
      details: "You can 'Regenerate' individual nodes if errors are spotted or 'Purge' drafts that shouldn't be processed."
    },
    {
      title: "6. Publication (Finalize)",
      actor: "Super Admins",
      icon: <Lock className="text-red-500" />,
      description: "Finalize and publish the batch once verification is complete.",
      details: "This action locks the payroll vault for the period, prevents further changes, and makes payslips visible to employees."
    }
  ];

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 max-w-4xl mx-auto">
      <div className="bg-slate-900 p-8 text-white">
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Payroll Execution Protocol</h2>
        <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">End-to-End Workflow Guide for Administrators</p>
      </div>
      
      <div className="p-8 space-y-8">
        <div className="grid gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-6 relative group">
              {idx !== steps.length - 1 && (
                <div className="absolute left-[27px] top-14 bottom-0 w-px bg-gray-100 group-hover:bg-mine-green/30 transition-colors" />
              )}
              
              <div className="shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shadow-sm group-hover:border-mine-green/20 group-hover:bg-mine-green/5 transition-all">
                  {step.icon}
                </div>
              </div>
              
              <div className="pb-8">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">{step.title}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[9px] font-black uppercase tracking-widest text-gray-500">
                    {step.actor}
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-2 font-medium">
                  {step.description}
                </p>
                <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-xl p-3">
                  <p className="text-[11px] text-gray-500 italic flex items-center gap-2">
                    <CheckCircle size={12} className="text-mine-green" />
                    <span className="font-bold uppercase tracking-tighter">Pro Tip:</span> {step.details}
                  </p>
                </div>
              </div>
              
              <div className="absolute right-0 top-6 opacity-0 group-hover:opacity-10 scale-150 transition-all">
                <ArrowRight size={48} />
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight mb-1">Security Disclaimer</h4>
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              Payroll finalization is a destructive administrative action. Once a period is finalized, the vault is locked and can only be reopened via a high-level Security Unlock Protocol. Always verify all timesheet approvals and loan deductions before clicking 'Publish'.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollGuide;
