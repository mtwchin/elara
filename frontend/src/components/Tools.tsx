import React, { useState, useMemo, useEffect } from 'react';
import { authFetch } from '../auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolId = 'deal' | 'mortgage' | 'proforma' | 'depreciation' | 'refi';

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDollar(n: number): string {
  return '$' + fmt(n);
}

function fmtPct(n: number): string {
  return fmt(n) + '%';
}

function pmt(rate: number, nper: number, pv: number): number {
  // Standard annuity formula: monthly payment
  if (rate === 0) return pv / nper;
  return (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
}

// ---------------------------------------------------------------------------
// 1. Deal Analyzer
// ---------------------------------------------------------------------------

interface DealInputs {
  purchasePrice: string;
  downPaymentPct: string;
  interestRate: string;
  loanTermYears: string;
  grossMonthlyRent: string;
  vacancyPct: string;
  monthlyExpenses: string;
}

interface DealAnalyzerProps {
  prefillPurchasePrice?: string;
}

function DealAnalyzer({ prefillPurchasePrice }: DealAnalyzerProps) {
  const [inputs, setInputs] = useState<DealInputs>({
    purchasePrice: prefillPurchasePrice ?? '500000',
    downPaymentPct: '25',
    interestRate: '7.25',
    loanTermYears: '30',
    grossMonthlyRent: '3200',
    vacancyPct: '5',
    monthlyExpenses: '600',
  });

  // Sync when parent changes the prefill value
  useEffect(() => {
    if (prefillPurchasePrice !== undefined && prefillPurchasePrice !== '') {
      setInputs(prev => ({ ...prev, purchasePrice: prefillPurchasePrice }));
    }
  }, [prefillPurchasePrice]);

  const set = (field: keyof DealInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs(prev => ({ ...prev, [field]: e.target.value }));

  const r = useMemo(() => {
    const price = parseFloat(inputs.purchasePrice) || 0;
    const downPct = parseFloat(inputs.downPaymentPct) / 100 || 0;
    const rate = parseFloat(inputs.interestRate) / 100 / 12 || 0;
    const nper = (parseFloat(inputs.loanTermYears) || 30) * 12;
    const grossRent = parseFloat(inputs.grossMonthlyRent) || 0;
    const vacancyPct = parseFloat(inputs.vacancyPct) / 100 || 0;
    const monthlyExpenses = parseFloat(inputs.monthlyExpenses) || 0;

    const downPayment = price * downPct;
    const loanAmount = price - downPayment;
    const monthlyDebt = pmt(rate, nper, loanAmount);
    const effectiveRent = grossRent * (1 - vacancyPct);
    const noi = (effectiveRent - monthlyExpenses) * 12;
    const capRate = price > 0 ? (noi / price) * 100 : 0;
    const annualCashFlow = noi - monthlyDebt * 12;
    const cocReturn = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
    const grm = grossRent > 0 ? price / (grossRent * 12) : 0;
    const breakEvenOccupancy =
      grossRent > 0
        ? ((monthlyDebt + monthlyExpenses) / grossRent) * 100
        : 0;

    return { downPayment, loanAmount, monthlyDebt, effectiveRent, noi, capRate, annualCashFlow, cocReturn, grm, breakEvenOccupancy };
  }, [inputs]);

  return (
    <div className="tool-layout">
      <div className="tool-inputs glass-panel-static">
        <h3 className="tool-section-title">Property Inputs</h3>
        <div className="form-group">
          <label className="form-label">Purchase Price ($)</label>
          <input className="form-input" type="number" value={inputs.purchasePrice} onChange={set('purchasePrice')} />
        </div>
        <div className="form-group">
          <label className="form-label">Down Payment (%)</label>
          <input className="form-input" type="number" value={inputs.downPaymentPct} onChange={set('downPaymentPct')} min="0" max="100" />
        </div>
        <div className="form-group">
          <label className="form-label">Interest Rate (%)</label>
          <input className="form-input" type="number" value={inputs.interestRate} onChange={set('interestRate')} step="0.05" />
        </div>
        <div className="form-group">
          <label className="form-label">Loan Term (years)</label>
          <input className="form-input" type="number" value={inputs.loanTermYears} onChange={set('loanTermYears')} />
        </div>
        <div className="form-group">
          <label className="form-label">Gross Monthly Rent ($)</label>
          <input className="form-input" type="number" value={inputs.grossMonthlyRent} onChange={set('grossMonthlyRent')} />
        </div>
        <div className="form-group">
          <label className="form-label">Vacancy Rate (%)</label>
          <input className="form-input" type="number" value={inputs.vacancyPct} onChange={set('vacancyPct')} min="0" max="100" />
        </div>
        <div className="form-group">
          <label className="form-label">Monthly Operating Expenses ($)</label>
          <input className="form-input" type="number" value={inputs.monthlyExpenses} onChange={set('monthlyExpenses')} />
        </div>
      </div>
      <div className="tool-results">
        <div className="tool-results-grid">
          <ResultCard label="Cap Rate" value={fmtPct(r.capRate)} highlight={r.capRate >= 6} />
          <ResultCard label="Cash-on-Cash Return" value={fmtPct(r.cocReturn)} highlight={r.cocReturn >= 8} />
          <ResultCard label="Gross Rent Multiplier" value={fmt(r.grm, 1) + 'x'} />
          <ResultCard label="Monthly Debt Service" value={fmtDollar(r.monthlyDebt)} />
          <ResultCard label="Annual NOI" value={fmtDollar(r.noi)} />
          <ResultCard label="Annual Cash Flow" value={fmtDollar(r.annualCashFlow)} highlight={r.annualCashFlow > 0} warning={r.annualCashFlow < 0} />
          <ResultCard label="Down Payment" value={fmtDollar(r.downPayment)} />
          <ResultCard label="Loan Amount" value={fmtDollar(r.loanAmount)} />
        </div>
        <div className="glass-panel-static" style={{ marginTop: '1.25rem' }}>
          <div className="tool-breakeven-row">
            <span className="form-label">Break-Even Occupancy</span>
            <span style={{ fontWeight: 600, fontSize: '1.05rem', color: r.breakEvenOccupancy > 90 ? 'var(--danger)' : r.breakEvenOccupancy > 80 ? 'var(--warning)' : 'var(--success)' }}>
              {fmtPct(r.breakEvenOccupancy)}
            </span>
          </div>
          <div className="tool-progress-bar-track">
            <div className="tool-progress-bar-fill" style={{ width: `${Math.min(r.breakEvenOccupancy, 100)}%`, background: r.breakEvenOccupancy > 90 ? 'var(--danger)' : r.breakEvenOccupancy > 80 ? 'var(--warning)' : 'var(--success)' }} />
          </div>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            At this occupancy your rent exactly covers debt service + expenses. Lower is safer.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Mortgage Calculator
// ---------------------------------------------------------------------------

interface MortgageInputs {
  loanAmount: string;
  interestRate: string;
  loanTermYears: string;
  startYear: string;
}

interface AmortRow {
  year: number;
  openingBalance: number;
  annualPrincipal: number;
  annualInterest: number;
  closingBalance: number;
}

function MortgageCalculator() {
  const [inputs, setInputs] = useState<MortgageInputs>({
    loanAmount: '375000',
    interestRate: '7.25',
    loanTermYears: '30',
    startYear: '2026',
  });

  const set = (field: keyof MortgageInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs(prev => ({ ...prev, [field]: e.target.value }));

  const { monthly, schedule, totalInterest, totalPaid } = useMemo(() => {
    const pv = parseFloat(inputs.loanAmount) || 0;
    const annualRate = parseFloat(inputs.interestRate) / 100 || 0;
    const r = annualRate / 12;
    const n = (parseFloat(inputs.loanTermYears) || 30) * 12;
    const startYear = parseInt(inputs.startYear) || 2026;
    const monthly = pmt(r, n, pv);
    const totalPaid = monthly * n;
    const totalInterest = totalPaid - pv;

    // Build annual schedule
    const schedule: AmortRow[] = [];
    let balance = pv;
    const years = Math.ceil(n / 12);
    for (let y = 0; y < years; y++) {
      const opening = balance;
      let annualPrincipal = 0;
      let annualInterest = 0;
      const months = Math.min(12, n - y * 12);
      for (let m = 0; m < months; m++) {
        const intPmt = balance * r;
        const prinPmt = monthly - intPmt;
        annualInterest += intPmt;
        annualPrincipal += prinPmt;
        balance -= prinPmt;
      }
      schedule.push({ year: startYear + y, openingBalance: opening, annualPrincipal, annualInterest, closingBalance: Math.max(0, balance) });
    }
    return { monthly, schedule, totalInterest, totalPaid };
  }, [inputs]);

  const principalPct = inputs.loanAmount ? ((totalPaid - totalInterest) / totalPaid) * 100 : 0;

  return (
    <div className="tool-layout">
      <div className="tool-inputs glass-panel-static">
        <h3 className="tool-section-title">Loan Inputs</h3>
        <div className="form-group">
          <label className="form-label">Loan Amount ($)</label>
          <input className="form-input" type="number" value={inputs.loanAmount} onChange={set('loanAmount')} />
        </div>
        <div className="form-group">
          <label className="form-label">Interest Rate (%)</label>
          <input className="form-input" type="number" value={inputs.interestRate} onChange={set('interestRate')} step="0.05" />
        </div>
        <div className="form-group">
          <label className="form-label">Loan Term (years)</label>
          <input className="form-input" type="number" value={inputs.loanTermYears} onChange={set('loanTermYears')} />
        </div>
        <div className="form-group">
          <label className="form-label">Start Year</label>
          <input className="form-input" type="number" value={inputs.startYear} onChange={set('startYear')} />
        </div>

        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--bg-tertiary)', borderRadius: '12px' }}>
          <div className="metric-label" style={{ marginBottom: '0.5rem' }}>Monthly Payment</div>
          <div style={{ fontFamily: "'EB Garamond', serif", fontSize: '2rem', fontWeight: 500, color: 'var(--text-primary)' }}>{fmtDollar(monthly)}</div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div className="tool-breakeven-row" style={{ marginBottom: '0.5rem' }}>
            <span className="form-label">Principal vs Interest</span>
          </div>
          <div className="tool-progress-bar-track">
            <div className="tool-progress-bar-fill" style={{ width: `${principalPct}%`, background: 'var(--accent-blue)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Principal: {fmtDollar(totalPaid - totalInterest)}</span>
            <span>Interest: {fmtDollar(totalInterest)}</span>
          </div>
          <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Total paid: {fmtDollar(totalPaid)}
          </div>
        </div>
      </div>

      <div className="tool-results">
        <div className="glass-panel-static" style={{ overflowX: 'auto' }}>
          <h3 className="tool-section-title" style={{ marginBottom: '1rem' }}>Amortization Schedule (Annual)</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Opening Balance</th>
                <th>Principal Paid</th>
                <th>Interest Paid</th>
                <th>Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map(row => (
                <tr key={row.year}>
                  <td style={{ fontWeight: 500 }}>{row.year}</td>
                  <td>{fmtDollar(row.openingBalance)}</td>
                  <td className="text-success">{fmtDollar(row.annualPrincipal)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDollar(row.annualInterest)}</td>
                  <td>{fmtDollar(row.closingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Pro Forma Builder
// ---------------------------------------------------------------------------

interface ProFormaInputs {
  purchasePrice: string;
  grossMonthlyRent: string;
  vacancyPct: string;
  opexPct: string;  // operating expenses as % of effective gross income
  rentGrowthPct: string;
  expenseGrowthPct: string;
  downPaymentPct: string;
  interestRate: string;
  loanTermYears: string;
  exitCapRate: string;
  holdYears: string;
}

interface ProFormaYear {
  year: number;
  egi: number;
  opex: number;
  noi: number;
  debtService: number;
  cashFlow: number;
}

function ProFormaBuilder() {
  const [inputs, setInputs] = useState<ProFormaInputs>({
    purchasePrice: '650000',
    grossMonthlyRent: '4200',
    vacancyPct: '5',
    opexPct: '35',
    rentGrowthPct: '3',
    expenseGrowthPct: '2.5',
    downPaymentPct: '25',
    interestRate: '7.25',
    loanTermYears: '30',
    exitCapRate: '6.5',
    holdYears: '5',
  });

  const set = (field: keyof ProFormaInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs(prev => ({ ...prev, [field]: e.target.value }));

  const { rows, downPayment, exitValue, totalCashFlow, equity } = useMemo(() => {
    const price = parseFloat(inputs.purchasePrice) || 0;
    const grossRent = parseFloat(inputs.grossMonthlyRent) || 0;
    const vacancy = parseFloat(inputs.vacancyPct) / 100 || 0;
    const opexPct = parseFloat(inputs.opexPct) / 100 || 0;
    const rentGrowth = parseFloat(inputs.rentGrowthPct) / 100 || 0;
    const expGrowth = parseFloat(inputs.expenseGrowthPct) / 100 || 0;
    const downPct = parseFloat(inputs.downPaymentPct) / 100 || 0;
    const rate = parseFloat(inputs.interestRate) / 100 / 12 || 0;
    const nper = (parseFloat(inputs.loanTermYears) || 30) * 12;
    const exitCap = parseFloat(inputs.exitCapRate) / 100 || 0.065;
    const holdYears = parseInt(inputs.holdYears) || 5;

    const downPayment = price * downPct;
    const loanAmount = price - downPayment;
    const monthlyDebt = pmt(rate, nper, loanAmount);
    const annualDebtService = monthlyDebt * 12;

    const rows: ProFormaYear[] = [];

    for (let y = 1; y <= holdYears; y++) {
      const scaledRent = grossRent * Math.pow(1 + rentGrowth, y - 1);
      const egi = scaledRent * (1 - vacancy) * 12;
      const opex = egi * opexPct * Math.pow(1 + expGrowth / (1 - vacancy), y - 1); // rough escalation
      const noi = egi - opex;
      const cashFlow = noi - annualDebtService;
      rows.push({ year: y, egi, opex, noi, debtService: annualDebtService, cashFlow });
    }

    // Amortize to find balance at end of hold period
    let runningBalance = loanAmount;
    for (let m = 0; m < holdYears * 12; m++) {
      const intPmt = runningBalance * rate;
      const prinPmt = monthlyDebt - intPmt;
      runningBalance -= prinPmt;
    }

    const lastNoi = rows[rows.length - 1]?.noi ?? 0;
    const exitValue = exitCap > 0 ? lastNoi / exitCap : 0;
    const totalCashFlow = rows.reduce((s, r) => s + r.cashFlow, 0);
    const equity = exitValue - Math.max(0, runningBalance) - downPayment;

    return { rows, downPayment, exitValue, totalCashFlow, equity };
  }, [inputs]);

  return (
    <div className="tool-layout">
      <div className="tool-inputs glass-panel-static">
        <h3 className="tool-section-title">Property & Financing</h3>
        <div className="form-group">
          <label className="form-label">Purchase Price ($)</label>
          <input className="form-input" type="number" value={inputs.purchasePrice} onChange={set('purchasePrice')} />
        </div>
        <div className="form-group">
          <label className="form-label">Gross Monthly Rent ($)</label>
          <input className="form-input" type="number" value={inputs.grossMonthlyRent} onChange={set('grossMonthlyRent')} />
        </div>
        <div className="form-group">
          <label className="form-label">Vacancy Rate (%)</label>
          <input className="form-input" type="number" value={inputs.vacancyPct} onChange={set('vacancyPct')} />
        </div>
        <div className="form-group">
          <label className="form-label">Operating Expenses (% of EGI)</label>
          <input className="form-input" type="number" value={inputs.opexPct} onChange={set('opexPct')} />
        </div>
        <div className="form-group">
          <label className="form-label">Annual Rent Growth (%)</label>
          <input className="form-input" type="number" value={inputs.rentGrowthPct} onChange={set('rentGrowthPct')} step="0.5" />
        </div>
        <div className="form-group">
          <label className="form-label">Annual Expense Growth (%)</label>
          <input className="form-input" type="number" value={inputs.expenseGrowthPct} onChange={set('expenseGrowthPct')} step="0.5" />
        </div>
        <div className="form-group">
          <label className="form-label">Down Payment (%)</label>
          <input className="form-input" type="number" value={inputs.downPaymentPct} onChange={set('downPaymentPct')} />
        </div>
        <div className="form-group">
          <label className="form-label">Interest Rate (%)</label>
          <input className="form-input" type="number" value={inputs.interestRate} onChange={set('interestRate')} step="0.05" />
        </div>
        <div className="form-group">
          <label className="form-label">Exit Cap Rate (%)</label>
          <input className="form-input" type="number" value={inputs.exitCapRate} onChange={set('exitCapRate')} step="0.25" />
        </div>
        <div className="form-group">
          <label className="form-label">Hold Period (years)</label>
          <input className="form-input" type="number" value={inputs.holdYears} onChange={set('holdYears')} min="1" max="20" />
        </div>
      </div>

      <div className="tool-results">
        <div className="tool-results-grid" style={{ marginBottom: '1.25rem' }}>
          <ResultCard label="Projected Exit Value" value={fmtDollar(exitValue)} />
          <ResultCard label="Total Cash Flow" value={fmtDollar(totalCashFlow)} highlight={totalCashFlow > 0} warning={totalCashFlow < 0} />
          <ResultCard label="Equity Created" value={fmtDollar(equity)} highlight={equity > 0} warning={equity < 0} />
          <ResultCard label="Down Payment" value={fmtDollar(downPayment)} />
        </div>
        <div className="glass-panel-static" style={{ overflowX: 'auto' }}>
          <h3 className="tool-section-title" style={{ marginBottom: '1rem' }}>5-Year Pro Forma</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Eff. Gross Income</th>
                <th>Operating Expenses</th>
                <th>NOI</th>
                <th>Debt Service</th>
                <th>Cash Flow</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.year}>
                  <td style={{ fontWeight: 500 }}>Year {row.year}</td>
                  <td>{fmtDollar(row.egi)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDollar(row.opex)}</td>
                  <td>{fmtDollar(row.noi)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDollar(row.debtService)}</td>
                  <td>
                    <span className={row.cashFlow >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 600 }}>
                      {fmtDollar(row.cashFlow)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Depreciation Tracker
// ---------------------------------------------------------------------------

interface DepreciationInputs {
  purchasePrice: string;
  landValuePct: string;
  purchaseYear: string;
  propertyType: 'residential' | 'commercial';
}

interface DepreciationYear {
  year: number;
  calendarYear: number;
  deduction: number;
  cumulativeDeduction: number;
  remainingBasis: number;
  taxShield: number;
}

function DepreciationTracker() {
  const [inputs, setInputs] = useState<DepreciationInputs>({
    purchasePrice: '500000',
    landValuePct: '20',
    purchaseYear: '2023',
    propertyType: 'residential',
  });
  const [taxRate, setTaxRate] = useState<string>('32');

  const { rows, depreciableBasis, annualDeduction, usefulLife } = useMemo(() => {
    const price = parseFloat(inputs.purchasePrice) || 0;
    const landPct = parseFloat(inputs.landValuePct) / 100 || 0.2;
    const startYear = parseInt(inputs.purchaseYear) || 2023;
    const rate = parseFloat(taxRate) / 100 || 0.32;
    const usefulLife = inputs.propertyType === 'residential' ? 27.5 : 39;
    const depreciableBasis = price * (1 - landPct);
    const annualDeduction = depreciableBasis / usefulLife;

    // IRS mid-month convention: first year is partial
    // For simplicity, show Year 1 as a full year (common practice approximation)
    const rows: DepreciationYear[] = [];
    let cumulative = 0;
    const displayYears = Math.min(Math.ceil(usefulLife), 30); // cap table at 30 rows
    for (let y = 1; y <= displayYears; y++) {
      const deduction = y <= Math.floor(usefulLife) ? annualDeduction : depreciableBasis - cumulative;
      if (deduction <= 0) break;
      cumulative += deduction;
      rows.push({
        year: y,
        calendarYear: startYear + y - 1,
        deduction,
        cumulativeDeduction: cumulative,
        remainingBasis: Math.max(0, depreciableBasis - cumulative),
        taxShield: deduction * rate,
      });
    }
    return { rows, depreciableBasis, annualDeduction, usefulLife };
  }, [inputs, taxRate]);

  const totalTaxShield = rows.reduce((s, r) => s + r.taxShield, 0);

  return (
    <div className="tool-layout">
      <div className="tool-inputs glass-panel-static">
        <h3 className="tool-section-title">Property Details</h3>
        <div className="form-group">
          <label className="form-label">Purchase Price ($)</label>
          <input className="form-input" type="number" value={inputs.purchasePrice} onChange={e => setInputs(p => ({ ...p, purchasePrice: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Land Value (% of price)</label>
          <input className="form-input" type="number" value={inputs.landValuePct} onChange={e => setInputs(p => ({ ...p, landValuePct: e.target.value }))} min="0" max="60" />
        </div>
        <div className="form-group">
          <label className="form-label">Purchase Year</label>
          <input className="form-input" type="number" value={inputs.purchaseYear} onChange={e => setInputs(p => ({ ...p, purchaseYear: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Property Type</label>
          <select
            className="form-input"
            value={inputs.propertyType}
            onChange={e => setInputs(p => ({ ...p, propertyType: e.target.value as 'residential' | 'commercial' }))}
          >
            <option value="residential">Residential (27.5 years)</option>
            <option value="commercial">Commercial (39 years)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Your Marginal Tax Rate (%)</label>
          <input className="form-input" type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} min="0" max="60" />
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <div className="tool-results-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <ResultCard label="Depreciable Basis" value={fmtDollar(depreciableBasis)} />
            <ResultCard label="Annual Deduction" value={fmtDollar(annualDeduction)} />
            <ResultCard label="Useful Life" value={`${usefulLife} years`} />
            <ResultCard label="Total Tax Shield" value={fmtDollar(totalTaxShield)} highlight />
          </div>
        </div>
      </div>

      <div className="tool-results">
        <div className="glass-panel-static" style={{ overflowX: 'auto' }}>
          <h3 className="tool-section-title" style={{ marginBottom: '1rem' }}>Depreciation Schedule</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Yr</th>
                <th>Calendar Year</th>
                <th>Annual Deduction</th>
                <th>Cumulative</th>
                <th>Remaining Basis</th>
                <th>Tax Shield</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.year}>
                  <td style={{ fontWeight: 500 }}>{row.year}</td>
                  <td>{row.calendarYear}</td>
                  <td>{fmtDollar(row.deduction)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{fmtDollar(row.cumulativeDeduction)}</td>
                  <td>{fmtDollar(row.remainingBasis)}</td>
                  <td className="text-success" style={{ fontWeight: 500 }}>{fmtDollar(row.taxShield)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Refinance Analyzer
// ---------------------------------------------------------------------------

interface RefiInputs {
  currentBalance: string;
  currentRate: string;
  currentMonthsRemaining: string;
  newRate: string;
  newTermYears: string;
  closingCosts: string;
  taxRate: string;
}

function RefinanceAnalyzer() {
  const [inputs, setInputs] = useState<RefiInputs>({
    currentBalance: '320000',
    currentRate: '7.5',
    currentMonthsRemaining: '324',
    newRate: '6.5',
    newTermYears: '30',
    closingCosts: '7500',
    taxRate: '32',
  });

  const set = (field: keyof RefiInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs(prev => ({ ...prev, [field]: e.target.value }));

  const r = useMemo(() => {
    const balance = parseFloat(inputs.currentBalance) || 0;
    const oldRate = parseFloat(inputs.currentRate) / 100 / 12 || 0;
    const oldN = parseInt(inputs.currentMonthsRemaining) || 324;
    const newRate = parseFloat(inputs.newRate) / 100 / 12 || 0;
    const newN = (parseFloat(inputs.newTermYears) || 30) * 12;
    const closingCosts = parseFloat(inputs.closingCosts) || 0;
    const taxRate = parseFloat(inputs.taxRate) / 100 || 0.32;

    const currentPayment = pmt(oldRate, oldN, balance);
    const newPayment = pmt(newRate, newN, balance);
    const monthlySavings = currentPayment - newPayment;
    const breakEvenMonths = monthlySavings > 0 ? closingCosts / monthlySavings : Infinity;

    // Total interest comparison
    const currentTotalInterest = currentPayment * oldN - balance;
    const newTotalInterest = newPayment * newN - balance;
    const interestSavings = currentTotalInterest - newTotalInterest - closingCosts;

    // NPV of refi using 5% hurdle rate
    const hurdle = 0.05 / 12;
    let npv = -closingCosts;
    const periods = Math.min(oldN, newN);
    for (let i = 1; i <= periods; i++) {
      npv += monthlySavings / Math.pow(1 + hurdle, i);
    }

    // After-tax savings (mortgage interest deduction)
    const afterTaxSavings = monthlySavings * (1 - taxRate);

    return { currentPayment, newPayment, monthlySavings, breakEvenMonths, currentTotalInterest, newTotalInterest, interestSavings, npv, afterTaxSavings };
  }, [inputs]);

  const refiIsGood = r.monthlySavings > 0 && r.breakEvenMonths < 48;

  return (
    <div className="tool-layout">
      <div className="tool-inputs glass-panel-static">
        <h3 className="tool-section-title">Current Loan</h3>
        <div className="form-group">
          <label className="form-label">Current Balance ($)</label>
          <input className="form-input" type="number" value={inputs.currentBalance} onChange={set('currentBalance')} />
        </div>
        <div className="form-group">
          <label className="form-label">Current Interest Rate (%)</label>
          <input className="form-input" type="number" value={inputs.currentRate} onChange={set('currentRate')} step="0.05" />
        </div>
        <div className="form-group">
          <label className="form-label">Months Remaining</label>
          <input className="form-input" type="number" value={inputs.currentMonthsRemaining} onChange={set('currentMonthsRemaining')} />
        </div>

        <h3 className="tool-section-title" style={{ marginTop: '1.5rem' }}>New Loan</h3>
        <div className="form-group">
          <label className="form-label">New Interest Rate (%)</label>
          <input className="form-input" type="number" value={inputs.newRate} onChange={set('newRate')} step="0.05" />
        </div>
        <div className="form-group">
          <label className="form-label">New Loan Term (years)</label>
          <input className="form-input" type="number" value={inputs.newTermYears} onChange={set('newTermYears')} />
        </div>
        <div className="form-group">
          <label className="form-label">Closing Costs ($)</label>
          <input className="form-input" type="number" value={inputs.closingCosts} onChange={set('closingCosts')} />
        </div>
        <div className="form-group">
          <label className="form-label">Marginal Tax Rate (%)</label>
          <input className="form-input" type="number" value={inputs.taxRate} onChange={set('taxRate')} />
        </div>
      </div>

      <div className="tool-results">
        <div className={`tool-verdict ${refiIsGood ? 'tool-verdict-positive' : r.monthlySavings <= 0 ? 'tool-verdict-negative' : 'tool-verdict-neutral'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {refiIsGood
              ? <polyline points="20 6 9 17 4 12"/>
              : r.monthlySavings <= 0
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
            }
          </svg>
          <span>
            {refiIsGood
              ? `Refinance looks favorable — break-even in ${Math.ceil(r.breakEvenMonths)} months`
              : r.monthlySavings <= 0
              ? 'New rate does not reduce payment — refinance not recommended'
              : `Refinance break-even is ${Math.ceil(r.breakEvenMonths)} months — consider your hold period`}
          </span>
        </div>

        <div className="tool-results-grid" style={{ marginTop: '1.25rem' }}>
          <ResultCard label="Current Monthly Payment" value={fmtDollar(r.currentPayment)} />
          <ResultCard label="New Monthly Payment" value={fmtDollar(r.newPayment)} />
          <ResultCard label="Monthly Savings" value={fmtDollar(r.monthlySavings)} highlight={r.monthlySavings > 0} warning={r.monthlySavings <= 0} />
          <ResultCard label="After-Tax Monthly Savings" value={fmtDollar(r.afterTaxSavings)} />
          <ResultCard label="Break-Even (months)" value={isFinite(r.breakEvenMonths) ? Math.ceil(r.breakEvenMonths).toString() : 'Never'} highlight={r.breakEvenMonths < 36} warning={r.breakEvenMonths > 60 || !isFinite(r.breakEvenMonths)} />
          <ResultCard label="NPV of Refinance" value={fmtDollar(r.npv)} highlight={r.npv > 0} warning={r.npv < 0} />
          <ResultCard label="Lifetime Interest Savings (net)" value={fmtDollar(r.interestSavings)} highlight={r.interestSavings > 0} />
          <ResultCard label="Closing Costs" value={fmtDollar(parseFloat(inputs.closingCosts) || 0)} />
        </div>

        <div className="glass-panel-static" style={{ marginTop: '1.25rem' }}>
          <h3 className="tool-section-title" style={{ marginBottom: '1rem' }}>Interest Comparison</h3>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div className="metric-label" style={{ marginBottom: '0.5rem' }}>Current Loan — Total Interest</div>
              <div style={{ fontFamily: "'EB Garamond', serif", fontSize: '1.5rem', color: 'var(--danger)' }}>{fmtDollar(r.currentTotalInterest)}</div>
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div className="metric-label" style={{ marginBottom: '0.5rem' }}>New Loan — Total Interest</div>
              <div style={{ fontFamily: "'EB Garamond', serif", fontSize: '1.5rem', color: 'var(--success)' }}>{fmtDollar(r.newTotalInterest)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared ResultCard component
// ---------------------------------------------------------------------------

interface ResultCardProps {
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}

function ResultCard({ label, value, highlight, warning }: ResultCardProps) {
  const color = warning ? 'var(--danger)' : highlight ? 'var(--success)' : 'var(--text-primary)';
  return (
    <div className="result-card glass-panel-static">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ fontSize: '1.4rem', color }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tools Page
// ---------------------------------------------------------------------------

const TOOLS: { id: ToolId; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'deal',
    label: 'Deal Analyzer',
    description: 'Cap rate, GRM, cash-on-cash, break-even occupancy for any acquisition.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    id: 'mortgage',
    label: 'Mortgage Calculator',
    description: 'Monthly payment, full amortization schedule, principal vs interest breakdown.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    id: 'proforma',
    label: 'Pro Forma Builder',
    description: '5-year cash flow projection with rent growth, expense escalation, and exit valuation.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    id: 'depreciation',
    label: 'Depreciation Tracker',
    description: 'Straight-line schedule (27.5yr residential / 39yr commercial) with tax shield estimates.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    id: 'refi',
    label: 'Refinance Analyzer',
    description: 'Break-even months, NPV of refinance, lifetime interest savings, after-tax impact.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
  },
];

interface PortfolioProperty {
  id: number;
  address: string;
  purchase_price: number | null;
}

const Tools: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolId>('deal');
  const [portfolioProperties, setPortfolioProperties] = useState<PortfolioProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [prefillPurchasePrice, setPrefillPurchasePrice] = useState<string | undefined>(undefined);

  useEffect(() => {
    authFetch('/api/properties')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PortfolioProperty[]) => setPortfolioProperties(data))
      .catch(() => {});
  }, []);

  const handlePropertySelect = (id: string) => {
    setSelectedPropertyId(id);
    if (!id) {
      setPrefillPurchasePrice(undefined);
      return;
    }
    const prop = portfolioProperties.find((p) => String(p.id) === id);
    if (prop && prop.purchase_price != null) {
      setPrefillPurchasePrice(String(prop.purchase_price));
    }
  };

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Financial Tools</h1>
          <p>Professional calculators for serious real estate investors.</p>
        </div>
      </div>

      {/* Tool Selector */}
      <div className="tool-selector">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`tool-selector-btn${activeTool === tool.id ? ' active' : ''}`}
            onClick={() => setActiveTool(tool.id)}
          >
            <span className="tool-selector-icon">{tool.icon}</span>
            <span className="tool-selector-label">{tool.label}</span>
            <span className="tool-selector-desc">{tool.description}</span>
          </button>
        ))}
      </div>

      {/* Property pre-fill — Deal Analyzer only */}
      {activeTool === 'deal' && portfolioProperties.length > 0 && (
        <div className="glass-panel-static" style={{ marginBottom: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Pre-fill from portfolio property (optional)</label>
            <select
              className="form-input"
              value={selectedPropertyId}
              onChange={(e) => handlePropertySelect(e.target.value)}
              style={{ maxWidth: '420px' }}
            >
              <option value="">— Select a property —</option>
              {portfolioProperties.map((p) => (
                <option key={p.id} value={p.id}>{p.address}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active Tool */}
      <div className="tool-container" key={activeTool}>
        {activeTool === 'deal' && <DealAnalyzer prefillPurchasePrice={prefillPurchasePrice} />}
        {activeTool === 'mortgage' && <MortgageCalculator />}
        {activeTool === 'proforma' && <ProFormaBuilder />}
        {activeTool === 'depreciation' && <DepreciationTracker />}
        {activeTool === 'refi' && <RefinanceAnalyzer />}
      </div>
    </div>
  );
};

export default Tools;
