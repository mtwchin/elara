import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface DashboardData {
  metrics: {
    totalPortfolioValue: number;
    monthlyRevenue: number;
    avgRoi: number;
    occupancyRate: number;
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
      .then((json: DashboardData) => {
        setData(json);
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

  return (
    <div className="app-container fade-in">
      <header>
        <div>
          <h1 className="text-gradient">Portfolio Overview</h1>
          <p>Welcome back! Here's what's happening with your properties today.</p>
        </div>
        <div className="header-actions">
          <button className="btn">Export Report</button>
          <button className="btn btn-primary">Add Property</button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Metrics Cards */}
        <div className="glass-panel metric-card" style={{ animationDelay: '0.1s' }}>
          <div className="metric-label">Total Portfolio Value</div>
          <div className="metric-value">${metrics.totalPortfolioValue.toLocaleString()}</div>
          <div className="metric-trend text-success">
            <span>↑ 2.4%</span>
            <span style={{ color: 'var(--text-secondary)' }}>vs last month</span>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ animationDelay: '0.2s' }}>
          <div className="metric-label">Monthly Revenue</div>
          <div className="metric-value">${metrics.monthlyRevenue.toLocaleString()}</div>
          <div className="metric-trend text-success">
            <span>↑ 1.2%</span>
            <span style={{ color: 'var(--text-secondary)' }}>vs last month</span>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ animationDelay: '0.3s' }}>
          <div className="metric-label">Avg. ROI</div>
          <div className="metric-value">{metrics.avgRoi.toFixed(1)}%</div>
          <div className="metric-trend text-success">
            <span>↑ 0.3%</span>
            <span style={{ color: 'var(--text-secondary)' }}>vs last year</span>
          </div>
        </div>

        <div className="glass-panel metric-card" style={{ animationDelay: '0.4s' }}>
          <div className="metric-label">Occupancy Rate</div>
          <div className="metric-value">{metrics.occupancyRate.toFixed(1)}%</div>
          <div className="metric-trend text-warning">
            <span>↓ 1.5%</span>
            <span style={{ color: 'var(--text-secondary)' }}>vs last month</span>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="glass-panel main-chart" style={{ animationDelay: '0.5s' }}>
          <h2>Revenue vs Expenses</h2>
          <p>Year-to-date performance across all properties.</p>
          <div style={{ 
            height: '250px', 
            marginTop: '2rem', 
            display: 'flex', 
            alignItems: 'flex-end', 
            gap: '2%',
            padding: '1rem 0',
            borderBottom: '1px solid var(--glass-border)'
          }}>
            {chartData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', gap: '4px', height: '100%', alignItems: 'flex-end' }}>
                <div style={{ 
                  width: '100%', 
                  background: 'var(--accent-blue)', 
                  height: `${d.revenue}%`, 
                  borderRadius: '6px 6px 0 0', 
                  opacity: 0.9,
                  transition: 'height 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }} title={`Revenue: ${d.revenue}`}></div>
                <div style={{ 
                  width: '100%', 
                  background: 'var(--text-secondary)', 
                  height: `${d.expenses}%`, 
                  borderRadius: '6px 6px 0 0', 
                  opacity: 0.5,
                  transition: 'height 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }} title={`Expenses: ${d.expenses}`}></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {chartData.map((d, i) => (
              <span key={i}>{d.month}</span>
            ))}
          </div>
        </div>

        {/* Agent Alerts */}
        <div className="glass-panel agent-alerts" style={{ animationDelay: '0.6s' }}>
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
