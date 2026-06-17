import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface PropertyCashFlow {
  id: number;
  address: string;
  monthlyCashFlow: number;
  ytdCashFlow: number;
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
      .then((data: CashFlowReport) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="app-container fade-in">
        <div style={{ padding: '2rem' }}><h2>Loading Financials...</h2></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container fade-in">
        <div style={{ padding: '2rem', color: 'var(--danger)' }}>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="app-container fade-in">
      <header>
        <div>
          <h1 className="text-gradient">Financials</h1>
          <p>Cash flow and portfolio performance.</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="glass-panel metric-card">
          <div className="metric-label">Portfolio Monthly Cash Flow</div>
          <div className="metric-value text-success">
            ${report.portfolio.monthlyCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-label">Portfolio YTD Cash Flow</div>
          <div className="metric-value text-success">
            ${report.portfolio.ytdCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-panel" style={{ gridColumn: 'span 12', overflowX: 'auto', marginTop: '1rem' }}>
          <h3>Property Breakdown</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Property</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Monthly Cash Flow</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>YTD Cash Flow</th>
              </tr>
            </thead>
            <tbody>
              {report.properties.map((prop) => (
                <tr key={prop.id} style={{ transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{prop.address}</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ color: prop.monthlyCashFlow >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ${Math.abs(prop.monthlyCashFlow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {prop.monthlyCashFlow < 0 ? ' (Loss)' : ''}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ color: prop.ytdCashFlow >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      ${Math.abs(prop.ytdCashFlow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {prop.ytdCashFlow < 0 ? ' (Loss)' : ''}
                    </span>
                  </td>
                </tr>
              ))}
              {report.properties.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No properties data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Financials;
