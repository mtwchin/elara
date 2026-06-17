import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface DashboardData {
  metrics: {
    totalPortfolioValue: number;
    monthlyRevenue: number;
    avgRoi: number;
    occupancyRate: number;
    revenueMomPct: number | null;
  };
  chartData: {
    month: string;
    revenue: number;
    expenses: number;
  }[];
  alerts: {
    id: number;
    type: 'warning' | 'info' | 'danger' | 'success';
    title: string;
    description: string;
    time: string;
  }[];
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
      })
      .then((json: DashboardData) => { setData(json); setLoading(false); })
      .catch((err) => { console.error(err); setError(err.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container fade-in">
          Loading Portfolio...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container fade-in">
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '600px', margin: '4rem auto' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Error loading dashboard</h2>
          <p>{error}</p>
          <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, chartData, alerts } = data;

  const revenueTrend = () => {
    if (metrics.revenueMomPct === null || metrics.revenueMomPct === undefined) {
      return <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No prior month data</span>;
    }
    const pct = metrics.revenueMomPct;
    const positive = pct >= 0;
    return (
      <div className={`metric-trend ${positive ? 'text-success' : 'text-warning'}`}>
        <span>{positive ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%</span>
        <span style={{ color: 'var(--text-secondary)' }}>vs last month</span>
      </div>
    );
  };

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Portfolio Overview</h1>
          <p>Welcome back! Here's what's happening with your properties today.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn">Export Report</button>
          <button className="btn btn-primary">Add Property</button>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Metrics Cards */}
        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Total Portfolio Value</div>
          <div className="metric-value">${metrics.totalPortfolioValue.toLocaleString()}</div>
        </div>
        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Monthly Revenue</div>
          <div className="metric-value">${metrics.monthlyRevenue.toLocaleString()}</div>
          {revenueTrend()}
        </div>
        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Avg. ROI</div>
          <div className="metric-value">{metrics.avgRoi.toFixed(1)}%</div>
        </div>
        <div className="glass-panel metric-card stagger-enter">
          <div className="metric-label">Occupancy Rate</div>
          <div className="metric-value">{metrics.occupancyRate.toFixed(1)}%</div>
        </div>

        {/* Main Chart Area (B3: palette + legend) */}
        <div className="glass-panel main-chart stagger-enter" style={{ animationDelay: '0.33s' }}>
          <h2>Revenue vs Expenses</h2>
          <p>Year-to-date performance across all properties.</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <div className="chart-legend">
              <div className="chart-legend-item">
                <div className="chart-legend-dot" style={{ background: 'var(--chart-revenue)' }}></div>
                Revenue
              </div>
              <div className="chart-legend-item">
                <div className="chart-legend-dot" style={{ background: 'var(--chart-expenses)' }}></div>
                Expenses
              </div>
            </div>
          </div>
          <div style={{
            height: '230px',
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '2%',
            padding: '1rem 0',
            borderBottom: '1px solid var(--glass-border)'
          }}>
            {chartData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', gap: '4px', height: '100%', alignItems: 'flex-end' }}>
                <div className="chart-bar-revenue" style={{ height: `${d.revenue}%` }}></div>
                <div className="chart-bar-expenses" style={{ height: `${d.expenses}%` }}></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
            {chartData.map((d, i) => (
              <span key={i}>{d.month}</span>
            ))}
          </div>
        </div>

        {/* Agent Alerts */}
        <div className="glass-panel agent-alerts stagger-enter" style={{ animationDelay: '0.4s' }}>
          <h2>Agent Alerts</h2>
          <p>AI-driven insights and required actions.</p>

          <div className="alert-list">
            {alerts.map((alert) => (
              <div key={alert.id} className="alert-item">
                <div className={`alert-icon ${alert.type}`}>
                  {alert.type === 'warning' && '!'}
                  {alert.type === 'info' && 'i'}
                  {alert.type === 'danger' && '×'}
                  {alert.type === 'success' && '✓'}
                </div>
                <div className="alert-content">
                  <h4>{alert.title}</h4>
                  <p>{alert.description}</p>
                  <span className="alert-time">{alert.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
