export interface TaxBand {
  min: number;
  max: number | null;
  rate: number;
  cumulative: number;
}

export const ZWG_TAX_BANDS: TaxBand[] = [
  { min: 0, max: 1400, rate: 0, cumulative: 0 },
  { min: 1400, max: 4200, rate: 0.2, cumulative: 0 },
  { min: 4200, max: 14000, rate: 0.25, cumulative: 560 },
  { min: 14000, max: 28000, rate: 0.3, cumulative: 3010 },
  { min: 28000, max: 42000, rate: 0.35, cumulative: 7210 },
  { min: 42000, max: null, rate: 0.4, cumulative: 12110 }
];

export const USD_TAX_BANDS: TaxBand[] = [
  { min: 0, max: 100, rate: 0, cumulative: 0 },
  { min: 100, max: 300, rate: 0.2, cumulative: 0 },
  { min: 300, max: 1000, rate: 0.25, cumulative: 40 },
  { min: 1000, max: 2000, rate: 0.3, cumulative: 215 },
  { min: 2000, max: 3000, rate: 0.35, cumulative: 515 },
  { min: 3000, max: null, rate: 0.4, cumulative: 865 }
];

export function calculatePaye(gross: number, bands: TaxBand[]): { tax: number; aidsLevy: number } {
  let tax = 0;
  for (const band of bands) {
    if (gross > band.min) {
      const taxableInBand = band.max ? Math.min(gross - band.min, band.max - band.min) : gross - band.min;
      tax += taxableInBand * band.rate;
    }
  }
  const aidsLevy = tax * 0.03;
  return { tax, aidsLevy };
}

export function calculateNssa(gross: number, currency: 'USD' | 'ZWG'): number {
  const rate = 0.045;
  // Standard statutory cap: USD 700 or ZWG 14x equivalent 
  const cap = currency === 'USD' ? 700 : 700 * 14; 
  const insurable = Math.min(gross, cap);
  return insurable * rate;
}
