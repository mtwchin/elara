import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';
import { notify } from '../toast';

interface Property {
  id: number;
  address: string;
  propertyType: string;
  status: string;
}

interface Tenant {
  id: number;
  name: string;
  propertyId: number;
  leaseStart: string | null;
  leaseEnd: string | null;
  rentAmount: number | null;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function parseLocalDate(iso: string): Date {
  // Parse YYYY-MM-DD as local (not UTC) to avoid off-by-one day shifts
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isExpiringSoon(leaseEnd: string | null): boolean {
  if (!leaseEnd) return false;
  const end = parseLocalDate(leaseEnd);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = end.getTime() - now.getTime();
  return diff >= 0 && diff <= THIRTY_DAYS_MS;
}

function formatShortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

interface RenewalWorkflowResult {
  letter_text: string;
  suggested_rent: number;
  market_context: string;
  days_until_expiry: number | null;
  recommended_deadline: string | null;
  pricing_strategy: string;
  tenant_intent: string;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(12px)',
  borderRadius: '16px',
  border: '1px solid var(--glass-border)',
  padding: '2rem',
  width: '100%',
  maxWidth: '580px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const Calendar: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const [renewalResult, setRenewalResult] = useState<RenewalWorkflowResult | null>(null);
  const [renewalLoading, setRenewalLoading] = useState<number | null>(null);
  const [renewalTenantName, setRenewalTenantName] = useState<string>('');

  const handleRunRenewalWorkflow = async (tenant: Tenant) => {
    setRenewalLoading(tenant.id);
    setRenewalTenantName(tenant.name);
    setRenewalResult(null);
    try {
      const res = await authFetch(`/api/agents/lease-renewal-workflow/${tenant.id}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Workflow failed' }));
        throw new Error(err.detail || 'Workflow failed');
      }
      setRenewalResult(await res.json());
      notify.success('Renewal workflow complete');
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Workflow failed');
    } finally {
      setRenewalLoading(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      authFetch('/api/properties?limit=500').then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch properties')))),
      authFetch('/api/tenants?limit=500').then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch tenants')))),
    ])
      .then(([propsData, tenantsData]) => {
        if (!cancelled) {
          setProperties(propsData.items ?? propsData);
          setTenants(tenantsData.items ?? tenantsData);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  // Days as array [1..daysInMonth]
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // For each property, find tenants whose lease overlaps this month
  function getOverlappingTenants(propertyId: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month, daysInMonth);

    return tenants.filter((t) => {
      if (t.propertyId !== propertyId) return false;
      if (!t.leaseStart || !t.leaseEnd) return false;
      const start = parseLocalDate(t.leaseStart);
      const end = parseLocalDate(t.leaseEnd);
      return end >= firstDay && start <= lastDay;
    });
  }

  function getTenantBar(tenant: Tenant): { startCol: number; endCol: number; leftPct: number; widthPct: number } {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month, daysInMonth);

    const leaseStart = tenant.leaseStart ? parseLocalDate(tenant.leaseStart) : firstDay;
    const leaseEnd = tenant.leaseEnd ? parseLocalDate(tenant.leaseEnd) : lastDay;

    const clampedStart = leaseStart < firstDay ? firstDay : leaseStart;
    const clampedEnd = leaseEnd > lastDay ? lastDay : leaseEnd;

    const startCol = clampedStart.getDate(); // 1-indexed
    const endCol = clampedEnd.getDate();     // 1-indexed

    const leftPct = ((startCol - 1) / daysInMonth) * 100;
    const widthPct = ((endCol - startCol + 1) / daysInMonth) * 100;

    return { startCol, endCol, leftPct, widthPct };
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container fade-in">Loading Calendar...</div>
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

  // Width per day column in px — used to decide if label fits in bar
  // We measure relative: each day is (containerWidth - 200) / daysInMonth px.
  // We use a rough estimate: 28px per day column (spec). Actual rendering uses %.
  const DAY_COL_PX_APPROX = 28;

  return (
    <div className="app-container fade-in">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Occupancy Calendar</h1>
          <p>Property occupancy timeline — see which units are leased and when they become available.</p>
        </div>
      </div>

      {/* Month navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <button className="btn" onClick={prevMonth} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
          Prev
        </button>
        <span
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: '1.35rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            minWidth: '180px',
            textAlign: 'center',
          }}
        >
          {monthLabel}
        </span>
        <button className="btn" onClick={nextMonth} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
          Next
        </button>
      </div>

      {/* Timeline grid */}
      {properties.length === 0 ? (
        <div className="glass-panel-static">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h3>No properties found</h3>
            <p>Add properties in the Properties tab to see the occupancy calendar.</p>
          </div>
        </div>
      ) : (
        <div className="glass-panel-static" style={{ padding: '1rem' }}>
          <div className="calendar-grid">
            {/* Header row */}
            <div className="calendar-header-row">
              <div className="calendar-property-label" style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Property
              </div>
              <div
                className="calendar-days-header"
                style={{ gridTemplateColumns: `repeat(${daysInMonth}, 1fr)` }}
              >
                {days.map((day) => (
                  <div key={day} className="calendar-day-label">
                    {day}
                  </div>
                ))}
              </div>
            </div>

            {/* Property rows */}
            {properties.map((property) => {
              const overlappingTenants = getOverlappingTenants(property.id);

              return (
                <div key={property.id} className="calendar-row">
                  {/* Property label */}
                  <div className="calendar-property-label" title={property.address}>
                    {property.address}
                  </div>

                  {/* Days area with bars */}
                  <div className="calendar-days-row">
                    {/* Day column background lines */}
                    {days.map((day) => (
                      <div
                        key={day}
                        className="calendar-day-bg"
                        style={{
                          left: `${((day - 1) / daysInMonth) * 100}%`,
                          width: `${(1 / daysInMonth) * 100}%`,
                        }}
                      />
                    ))}

                    {/* Tenant bars */}
                    {overlappingTenants.map((tenant) => {
                      const { leftPct, widthPct } = getTenantBar(tenant);
                      const expiring = isExpiringSoon(tenant.leaseEnd);
                      const barColor = expiring ? 'var(--warning)' : 'var(--accent-purple)';
                      const barBg = expiring
                        ? 'rgba(245, 158, 11, 0.85)'
                        : 'rgba(147, 51, 234, 0.85)';

                      // Estimate pixel width for label visibility
                      const approxWidthPx = (widthPct / 100) * (daysInMonth * DAY_COL_PX_APPROX);
                      const showLabel = approxWidthPx > 60;

                      const tooltipText = [
                        tenant.name,
                        `${tenant.leaseStart} to ${tenant.leaseEnd}`,
                        tenant.rentAmount != null ? `$${tenant.rentAmount.toLocaleString()}/mo` : 'No rent on file',
                      ].join('\n');

                      return (
                        <div
                          key={tenant.id}
                          className="calendar-tenant-bar"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            background: barBg,
                            borderRadius: '4px',
                            boxShadow: `0 1px 4px ${barColor}40`,
                          }}
                          onMouseEnter={(e) =>
                            setTooltip({ text: tooltipText, x: e.clientX, y: e.clientY })
                          }
                          onMouseMove={(e) =>
                            setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
                          }
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {showLabel && formatShortName(tenant.name)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="calendar-legend">
            <div className="calendar-legend-item">
              <div
                className="calendar-legend-dot"
                style={{ background: 'rgba(147, 51, 234, 0.85)' }}
              />
              Occupied
            </div>
            <div className="calendar-legend-item">
              <div
                className="calendar-legend-dot"
                style={{ background: 'rgba(245, 158, 11, 0.85)' }}
              />
              Expiring within 30 days
            </div>
            <div className="calendar-legend-item">
              <div
                className="calendar-legend-dot"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)' }}
              />
              Vacant
            </div>
          </div>
        </div>
      )}

      {/* Expiring Soon — AI Renewal Panel */}
      {(() => {
        const expiring = tenants.filter((t) => isExpiringSoon(t.leaseEnd));
        if (expiring.length === 0) return null;
        const propName = (id: number) =>
          properties.find((p) => p.id === id)?.address || `Property ${id}`;
        const daysLeft = (leaseEnd: string | null) => {
          if (!leaseEnd) return null;
          const diff = parseLocalDate(leaseEnd).getTime() - new Date().setHours(0,0,0,0);
          return Math.max(0, Math.round(diff / (24 * 60 * 60 * 1000)));
        };
        return (
          <div className="glass-panel-static" style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--warning)' }}>
              Leases Expiring Soon
            </h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Days Left</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{propName(t.propertyId)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{daysLeft(t.leaseEnd)} days</td>
                    <td>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.3rem 0.8rem', fontSize: '0.82rem' }}
                        disabled={renewalLoading === t.id}
                        onClick={() => handleRunRenewalWorkflow(t)}
                      >
                        {renewalLoading === t.id ? 'Running…' : 'Renewal Workflow'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y - 80,
            left: tooltip.x + 10,
            zIndex: 9999,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            boxShadow: 'var(--glass-shadow)',
            padding: '0.6rem 0.875rem',
            whiteSpace: 'pre',
            fontSize: '0.8rem',
            pointerEvents: 'none',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            maxWidth: '240px',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Renewal Workflow Modal */}
      {renewalResult && (
        <div style={overlayStyle} onClick={() => setRenewalResult(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                Renewal Workflow — {renewalTenantName}
              </h2>
              <button className="btn" style={{ fontSize: '0.8rem' }} onClick={() => setRenewalResult(null)}>
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div className="glass-panel-static">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Suggested Rent</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: '0.25rem' }}>
                  ${renewalResult.suggested_rent.toLocaleString()}/mo
                </div>
              </div>
              <div className="glass-panel-static">
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Days Until Expiry</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                  {renewalResult.days_until_expiry ?? '—'}
                </div>
              </div>
            </div>

            {renewalResult.pricing_strategy && (
              <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', borderRadius: '8px', background: 'rgba(147,51,234,0.08)', border: '1px solid rgba(147,51,234,0.2)', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                <strong>Pricing:</strong> {renewalResult.pricing_strategy}
              </div>
            )}

            {renewalResult.recommended_deadline && (
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong>Response deadline:</strong> {new Date(renewalResult.recommended_deadline).toLocaleDateString()}
              </div>
            )}

            {renewalResult.market_context && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {renewalResult.market_context}
              </p>
            )}

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Renewal Letter
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.7, fontFamily: 'Inter, sans-serif', margin: 0 }}>
                {renewalResult.letter_text}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
