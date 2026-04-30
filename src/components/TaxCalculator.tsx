import React, { useState, useEffect } from 'react';
import { calculatePaye, calculateNssa, USD_TAX_BANDS, ZWG_TAX_BANDS } from '../lib/payrollUtils';
import { Calculator, Zap, Info, ShieldCheck } from 'lucide-react';

const TaxCalculator: React.FC = () => {
  const [grossSalary, setGrossSalary] = useState<string>('1000');
  const [currency, setCurrency] = useState<'USD' | 'ZWG'>('USD');
  const [results, setResults] = useState<{
    tax: number;
    aidsLevy: number;
    nssa: number;
    totalDeductions: number;
    netPay: number;
  } | null>(null);

  useEffect(() => {
    const gross = parseFloat(grossSalary) || 0;
    const bands = currency === 'USD' ? USD_TAX_BANDS : ZWG_TAX_BANDS;
    
    const { tax, aidsLevy } = calculatePaye(gross, bands);
    const nssa = calculateNssa(gross, currency);
    const totalDeductions = tax + aidsLevy + nssa;
    const netPay = gross - totalDeductions;

    setResults({ tax, aidsLevy, nssa, totalDeductions, netPay });
  }, [grossSalary, currency]);

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-mine-blue" size={20} />
          <h3 className="card-title !mb-0">ZIMRA Compliance Tool</h3>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-md">
          <button 
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1 text-[10px] font-black tracking-widest uppercase transition-all rounded ${currency === 'USD' ? 'bg-white shadow-sm text-mine-blue' : 'text-gray-400'}`}
          >
            USD
          </button>
          <button 
            onClick={() => setCurrency('ZWG')}
            className={`px-3 py-1 text-[10px] font-black tracking-widest uppercase transition-all rounded ${currency === 'ZWG' ? 'bg-white shadow-sm text-mine-blue' : 'text-gray-400'}`}
          >
            ZWG
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Simulated Gross Salary ({currency})</label>
          <div className="relative">
            <input
              type="number"
              value={grossSalary}
              onChange={(e) => setGrossSalary(e.target.value)}
              className="w-full bg-gray-50 border border-border rounded-md p-3 text-lg font-black text-mine-blue focus:ring-1 focus:ring-mine-blue font-mono"
              placeholder="0.00"
            />
            <Calculator className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
          </div>
        </div>

        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">PAYE Tax</p>
                <p className="text-sm font-black text-red-600 font-mono">-{currency} {results.tax.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">AIDS Levy (3%)</p>
                <p className="text-sm font-black text-red-600 font-mono">-{currency} {results.aidsLevy.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">NSSA (4.5%)</p>
                <p className="text-sm font-black text-red-600 font-mono">-{currency} {results.nssa.toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Total Deductions</p>
                <p className="text-sm font-black text-gray-600 font-mono">-{currency} {results.totalDeductions.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-mine-blue text-white p-4 rounded-md flex justify-between items-center shadow-lg shadow-mine-blue/20">
              <div>
                <p className="text-[9px] font-bold text-mine-gold uppercase tracking-widest mb-1">Estimated Net Pay</p>
                <p className="text-2xl font-black font-mono leading-none">{currency} {results.netPay.toFixed(2)}</p>
              </div>
              <Zap className="text-mine-gold" size={24} />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-md flex gap-2 items-start">
              <Info className="text-blue-400 shrink-0 mt-0.5" size={14} />
              <p className="text-[10px] text-blue-700 leading-tight">
                Calculations based on 2025/2026 ZIMRA tax tables for {currency}. NSSA capped at standard statutory limits (USD 700 base). Includes 3% AIDS Levy.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaxCalculator;
