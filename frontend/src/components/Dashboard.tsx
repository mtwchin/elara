import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertTriangle, Info, XCircle, CheckCircle, Sparkles } from 'lucide-react';
import { authFetch } from '../auth';
import { notify } from '../toast';
import Onboarding from './Onboarding';

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

interface HealthCheckResult {
  executive_summary: string;
  maintenance_alerts: { property: string; category: string; alert: string; severity: string }[];
  portfolio_advice: string;
  lease_warnings: { title: string; description: string }[];
  generated_at: string;
}

const ALERT_ICONS: Record<string, React.ReactNode> = {
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
  danger: <XCircle size={20} />,
  success: <CheckCircle size={20} />,
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
      borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.85rem',
      boxShadow: 'var(--glass-shadow)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          {p.name}: ${p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    authFetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
      })
      .then((json: DashboardData) => { setData(json); setLoading(false); })
      .catch((err) => { console.error(err); setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (localStorage.getItem('onboarding_dismissed') === 'true') return;
    authFetch('/api/properties')
      .then((res) => res.ok ? res.json() : [])
      .then((list: unknown) => {
        const arr = Array.isArray(list) ? list : (list as { items?: unknown[] }).items ?? [];
        if (arr.length === 0) setShowOnboarding(true);
      })
      .catch(() => { /* silently skip onboarding check on error */ });
  }, []);

  const handleHealthCheck = async () => {
    setHealthLoading(true);
    setHealthError(null);
    setHealthCheck(null);
    try {
      const res = await authFetch('/api/agents/health-check');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Health check failed' }));
        throw new Error(err.detail || 'Health check failed');
      }
      setHealthCheck(await res.json());
      notify.success('Health check complete');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setHealthError(msg);
      notify.error('Health check failed: ' + msg);
    } finally {
      setHealthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container fade-in">Loading Portfolio...</div>
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

  const handleOnboardingDismiss = () => setShowOnboarding(false);

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
    <>
    {showOnboarding && <Onboarding onDismiss={handleOnboardingDismiss} />}
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Portfolio Overview</h1>
          <p>Welcome back! Here's what's happening with your properties today.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn">Export Report</button>
          <button
            className="btn btn-primary"
            disabled={healthLoading}
            onClick={handleHealthCheck}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Sparkles size={15} />
            {healthLoading ? 'Analyzing…' : 'Run Health Check'}
          </button>
        </div>
      </div>

      {healthError && (
        <div className="glass-panel-static" style={{ marginBottom: '1.5rem', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Health check failed: {healthError}</span>
          <button className="btn" style={{ fontSize: '0.8rem' }} onClick={() => setHealthError(null)}>Dismiss</button>
        </div>
      )}

      {healthCheck && (
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Portfolio Health Check</h2>
            <button className="btn" style={{ fontSize: '0.8rem' }} onClick={() => setHealthCheck(null)}>Dismiss</button>
          </div>

          <blockquote style={{ borderLeft: '3px solid var(--brand-primary)', paddingLeft: '1rem', color: 'var(--text-primary)', fontStyle: 'normal', margin: '0 0 1.25rem 0', lineHeight: 1.6 }}>
            {healthCheck.executive_summary}
          </blockquote>

          {healthCheck.maintenance_alerts.length > 0 && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: '0.4rem 0' }}>
                Maintenance Flags ({healthCheck.maintenance_alerts.length})
              </summary>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {healthCheck.maintenance_alerts.map((a, i) => (
                  <li key={i} style={{ fontSize: '0.88rem', color: a.severity === 'danger' ? 'var(--danger)' : 'var(--warning)' }}>
                    <strong>{a.property}</strong> — {a.alert}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {healthCheck.lease_warnings.length > 0 && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: '0.4rem 0' }}>
                Lease Warnings ({healthCheck.lease_warnings.length})
              </summary>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {healthCheck.lease_warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: '0.88rem', color: 'var(--warning)' }}>{w.description}</li>
                ))}
              </ul>
            </details>
          )}

          {healthCheck.portfolio_advice && (
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: '0.4rem 0' }}>Strategic Advice</summary>
              <p style={{ marginTop: '0.5rem', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {healthCheck.portfolio_advice}
              </p>
            </details>
          )}

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Generated {new Date(healthCheck.generated_at).toLocaleString()}
          </div>
        </div>
      )}

      <div className="dashboard-grid">
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

        {/* Recharts bar chart */}
        <div className="glass-panel main-chart stagger-enter" style={{ animationDelay: '0.33s' }}>
          <h2>Revenue vs Expenses</h2>
          <p>Year-to-date performance across all properties.</p>
          <div style={{ marginTop: '1.5rem', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  axisLine={false} tickLine={false} width={50}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79,70,229,0.04)' }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--chart-revenue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-expenses)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend" style={{ marginTop: '0.75rem' }}>
            <div className="chart-legend-item">
              <div className="chart-legend-dot" style={{ background: 'var(--chart-revenue)' }} />
              Revenue
            </div>
            <div className="chart-legend-item">
              <div className="chart-legend-dot" style={{ background: 'var(--chart-expenses)' }} />
              Expenses
            </div>
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
                  {ALERT_ICONS[alert.type]}
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
    </>
  );
};

export default Dashboard;
