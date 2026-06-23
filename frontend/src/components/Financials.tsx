import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { authFetch, getToken, API_BASE } from '../auth';
import { notify } from '../toast';

interface PropertyCashFlow {
  id: number;
  address: string;
  monthlyCashFlow: number;
  ytdCashFlow: number;
  monthlyDebtService?: number;
  capRate: number | null;
  cocReturn: number | null;
}

interface CashFlowReport {
  portfolio: {
    monthlyCashFlow: number;
    ytdCashFlow: number;
  };
  properties: PropertyCashFlow[];
}

const Financials: React.FC = () => {
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/reports/cashflow')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch cash flow report');
        return res.json();
      })
      .then((data) => setReport(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'An error occurred'))
      .finally(() => setLoading(false));
  }, []);

  const handleExportRentRoll = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/reports/rent-roll?format=csv`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Failed to export rent roll');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rent_roll.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify.success('Rent roll downloaded');
    } catch (err: unknown) {
      notify.error('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleExportScheduleE = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/reports/schedule-e?year=2026&format=csv`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to export Schedule E');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'schedule_e_2026.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify.success('Schedule E downloaded');
    } catch (err: unknown) {
      notify.error('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container fade-in">Loading Financials...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container fade-in">
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '600px', margin: '4rem auto' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  // Compute portfolio-level cap rate and CoC averages from property data
  const propsWithCapRate = report.properties.filter((p) => p.capRate != null);
  const propsWithCoc = report.properties.filter((p) => p.cocReturn != null);
  const avgCapRate =
    propsWithCapRate.length > 0
      ? propsWithCapRate.reduce((sum, p) => sum + (p.capRate as number), 0) / propsWithCapRate.length
      : null;
  const avgCocReturn =
    propsWithCoc.length > 0
      ? propsWithCoc.reduce((sum, p) => sum + (p.cocReturn as number), 0) / propsWithCoc.length
      : null;

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Financials</h1>
          <p>Cash flow and portfolio performance.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn" onClick={handleExportRentRoll} style={{ marginRight: '0.5rem' }}>
            Export Rent Roll
          </button>
          <button className="btn btn-primary" onClick={handleExportScheduleE}>
            Export Schedule E
          </button>
        </div>
      </div>

      <div className="dashboard-grid page-content">
        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Portfolio Monthly Cash Flow</div>
          <div className="metric-value text-success">
            ${report.portfolio.monthlyCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Portfolio YTD Cash Flow</div>
          <div className="metric-value text-success">
            ${report.portfolio.ytdCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Avg Cap Rate</div>
          <div className="metric-value">
            {avgCapRate != null ? `${avgCapRate.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Avg Cash-on-Cash</div>
          <div className="metric-value">
            {avgCocReturn != null ? `${avgCocReturn.toFixed(2)}%` : '—'}
          </div>
        </div>
      </div>

      {report.properties.length > 0 && (
        <div className="glass-panel-static" style={{ marginTop: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Monthly Cash Flow by Property</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.properties.map((p) => ({
                name: p.address.split(',')[0],
                cashFlow: p.monthlyCashFlow,
              }))} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false} tickLine={false} width={50}
                />
                <Tooltip
                  formatter={(v: unknown) => { const n = Number(v); return [`$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Monthly CF']; }}
                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 10 }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                  cursor={{ fill: 'rgba(79,70,229,0.04)' }}
                />
                <Bar dataKey="cashFlow" radius={[4, 4, 0, 0]}>
                  {report.properties.map((p, i) => (
                    <Cell key={i} fill={p.monthlyCashFlow >= 0 ? 'var(--chart-revenue)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="glass-panel-static" style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Property Breakdown</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Monthly Cash Flow</th>
              <th>YTD Cash Flow</th>
              <th>Cap Rate</th>
              <th>Cash-on-Cash</th>
            </tr>
          </thead>
          <tbody>
            {report.properties.map((prop) => (
              <tr key={prop.id}>
                <td style={{ fontWeight: 500 }}>{prop.address}</td>
                <td>
                  <span className={prop.monthlyCashFlow >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 500 }}>
                    ${Math.abs(prop.monthlyCashFlow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {prop.monthlyCashFlow < 0 ? ' (Loss)' : ''}
                  </span>
                </td>
                <td>
                  <span className={prop.ytdCashFlow >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 500 }}>
                    ${Math.abs(prop.ytdCashFlow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {prop.ytdCashFlow < 0 ? ' (Loss)' : ''}
                  </span>
                </td>
                <td>{prop.capRate != null ? `${prop.capRate.toFixed(2)}%` : '—'}</td>
                <td>{prop.cocReturn != null ? `${prop.cocReturn.toFixed(2)}%` : '—'}</td>
              </tr>
            ))}
            {report.properties.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <h3>No data available</h3>
                    <p>Financial data will appear here once you add properties and transactions.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Financials;
