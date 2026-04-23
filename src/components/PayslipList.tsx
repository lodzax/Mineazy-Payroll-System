import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { FileText, Download, Eye, X, ChevronLeft, ChevronRight, MapPin, Loader2, ShieldCheck, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

const Pagination: React.FC<{
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
        Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-1.5 rounded bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-orange-600 transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-1.5 rounded bg-white border border-gray-200 text-gray-400 disabled:opacity-30 hover:text-orange-600 transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

const PayslipList: React.FC = () => {
  const { user, profile } = useAuth();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const payslipRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 8;

  useEffect(() => {
    if (user) {
      const fetchPayslips = async () => {
        const q = query(
          collection(db, 'payslips'),
          where('employeeId', '==', user.uid),
          where('isPublished', '==', true),
          orderBy('month', 'desc')
        );
        const snap = await getDocs(q);
        setPayslips(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      };
      fetchPayslips();
    }
  }, [user]);

  const handleDownloadPDF = async () => {
    if (!payslipRef.current || !selectedPayslip) return;
    
    setDownloading(true);
    try {
      const element = payslipRef.current;
      
      // Use html-to-image which handles modern CSS (oklch) better than html2canvas
      const dataUrl = await htmlToImage.toPng(element, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Need the image dimensions to calculate height
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`payslip-${selectedPayslip.month}-${profile?.fullName?.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 italic serif">Payroll Records</h1>
        <p className="text-gray-500">Access and download your historical payslips</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pay Period</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Net Salary</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Currency</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-mono text-sm">
              {payslips.length > 0 ? payslips.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((p) => (
                <tr 
                  key={p.id} 
                  onClick={() => setSelectedPayslip(p)}
                  className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-bold text-gray-900">{p.month}</td>
                  <td className="px-6 py-4 text-right">{p.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-center font-sans tracking-widest font-bold text-xs text-gray-400">{p.currency}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setSelectedPayslip(p)}
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => setSelectedPayslip(p)}
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic font-sans flex flex-col items-center gap-2">
                    <FileText size={32} className="opacity-20" />
                    No payslips available in history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {payslips.length > 0 && (
          <Pagination 
            currentPage={currentPage}
            totalItems={payslips.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <AnimatePresence>
        {selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setSelectedPayslip(null)}
            />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl relative z-10 flex flex-col"
              >
                {/* Header Actions */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-mine-green/10 flex items-center justify-center text-mine-green">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Payslip Archive</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{selectedPayslip.month} Record</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-mine-green hover:border-mine-green/30 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                    >
                      <Printer size={14} />
                      Print
                    </button>
                    <button 
                      onClick={handleDownloadPDF}
                      disabled={downloading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-gray-900/10 disabled:opacity-50"
                    >
                      {downloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      {downloading ? 'Generating...' : 'Download PDF'}
                    </button>
                    <button 
                      onClick={() => setSelectedPayslip(null)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>

                {/* Content Area - Scrollable */}
                <div className="overflow-y-auto p-12">
                  <div ref={payslipRef} className="print-container mx-auto bg-white" style={{ width: '210mm', minHeight: '140mm', padding: '15mm' }}>
                    {/* Payslip Branding */}
                    <div className="flex justify-between items-start mb-12 border-b-4 border-gray-900 pb-8">
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 bg-gray-900 text-white flex items-center justify-center text-3xl font-black italic serif rounded-2xl">M</div>
                          <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Mineazy Mining Solutions</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Operational Node: {profile?.branch || 'HQ Southern Region'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-12 mt-8">
                          <div>
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Employee Information</h4>
                            <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{profile?.fullName}</p>
                            <p className="text-xs font-mono text-gray-500">{profile?.employeeId}</p>
                            <p className="text-xs font-medium text-gray-500 mt-1">{profile?.jobTitle || profile?.role}</p>
                          </div>
                          <div>
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Reference Details</h4>
                            <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{selectedPayslip.month}</p>
                            <p className="text-xs font-mono text-gray-500">PAY-REF: {selectedPayslip.id.slice(0, 12).toUpperCase()}</p>
                            <p className="text-xs font-medium text-gray-500 mt-1">Processed: {new Date().toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl inline-block text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-70">Net Payment</p>
                          <p className="text-3xl font-black font-mono tracking-tighter">
                            {selectedPayslip.currency} {selectedPayslip.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financial Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-12">
                      {/* Earnings Column */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                          <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Earnings Breakdown</h3>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest italic">Credits</span>
                        </div>
                        <div className="space-y-4 font-mono">
                          <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span className="text-gray-500 font-sans text-xs">Base Salary ({selectedPayslip.currency})</span>
                            <span className="font-bold text-gray-900">{selectedPayslip.baseSalary.toFixed(2)}</span>
                          </div>
                          {selectedPayslip.overtimePay > 0 && (
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                              <div>
                                <span className="text-gray-500 font-sans text-xs">Overtime Allowance</span>
                                <p className="text-[8px] font-bold text-mine-green uppercase tracking-widest">{selectedPayslip.overtimeHours} Hours @ 1.5x Rate</p>
                              </div>
                              <span className="font-bold text-gray-900">{selectedPayslip.overtimePay.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 text-base font-black text-gray-900">
                             <span className="font-sans text-xs uppercase tracking-widest">Total Gross</span>
                             <span className="border-b-2 border-gray-900 pb-1">{selectedPayslip.grossPay.toFixed(2)}</span>
                          </div>
                        </div>
                        
                        {/* Leave Stats */}
                        <div className="mt-12 bg-gray-50 rounded-2xl p-4 border border-gray-100 italic">
                          <div className="flex items-center gap-2 mb-2">
                             <ShieldCheck size={14} className="text-mine-green" />
                             <h4 className="text-[9px] font-black text-gray-900 uppercase tracking-widest">Attendance Metric</h4>
                          </div>
                          <div className="flex justify-between items-end">
                             <p className="text-[10px] text-gray-500 font-medium">Accumulated Leave Entitlement</p>
                             <p className="text-xl font-black text-mine-green font-mono">{selectedPayslip.leaveBalance?.toFixed(1) || '0.0'} <span className="text-[8px] font-sans">Days</span></p>
                          </div>
                        </div>
                      </div>

                      {/* Deductions Column */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
                          <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Statutory Deductions</h3>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest italic">Debits</span>
                        </div>
                        <div className="space-y-4 font-mono text-red-500">
                          <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                             <span className="text-gray-500 font-sans text-xs">PAYE Income Tax</span>
                             <span className="font-bold">- {selectedPayslip.taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                             <span className="text-gray-500 font-sans text-xs">AIDS Levy Contribution</span>
                             <span className="font-bold">- {selectedPayslip.aidsLevy.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                             <span className="text-gray-500 font-sans text-xs">NSSA Pension Scheme</span>
                             <span className="font-bold">- {selectedPayslip.nssaDeduction.toFixed(2)}</span>
                          </div>
                          {selectedPayslip.loanDeductions > 0 && (
                            <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                               <span className="text-gray-500 font-sans text-xs font-bold text-orange-600">Company Loan Repayment</span>
                               <span className="font-black text-orange-600">- {selectedPayslip.loanDeductions.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 text-base font-black text-red-600">
                             <span className="font-sans text-xs font-black uppercase tracking-widest">Total Deductions</span>
                             <span className="border-b-2 border-red-600 pb-1">
                               - {(selectedPayslip.taxAmount + selectedPayslip.aidsLevy + selectedPayslip.nssaDeduction + selectedPayslip.loanDeductions).toFixed(2)}
                             </span>
                          </div>
                        </div>

                        {/* Security Notice */}
                        <div className="mt-12 p-4 border-2 border-dashed border-gray-100 rounded-2xl">
                           <p className="text-[9px] text-gray-400 font-medium leading-relaxed">
                             This document is a certified digital duplicate from the Mineazy Secure Ledger. It serves as legal proof of income for {selectedPayslip.month}. Any unauthorized modification to this integrity-locked node is prohibited.
                           </p>
                           <div className="mt-4 flex items-center justify-between">
                             <div className="flex gap-1">
                               {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-100 rounded-full" />)}
                             </div>
                             <p className="text-[8px] font-black text-gray-300 font-mono italic">NODE-SEC-{selectedPayslip.id.slice(-6).toUpperCase()}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PayslipList;
