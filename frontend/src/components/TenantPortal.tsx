import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';
import type { MaintenanceRequest } from '../types';
import { notify } from '../toast';

interface TenantInfo {
  id: number;
  name: string;
  propertyAssigned: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  rentAmount: number | null;
  intent: string;
  daysUntilLeaseEnd: number | null;
  propertyId: number;
}

interface PortalData {
  tenant: TenantInfo | null;
  maintenanceRequests: MaintenanceRequest[];
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
  maxWidth: '520px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const STATUS_CLASSES: Record<string, string> = {
  Open: 'badge badge-warning',
  'In Progress': 'badge badge-info',
  Resolved: 'badge badge-success',
  Closed: 'badge',
};

function leaseUrgencyColor(days: number | null): string {
  if (days === null) return 'var(--text-primary)';
  if (days < 30) return 'var(--danger)';
  if (days < 90) return 'var(--warning)';
  return 'var(--success)';
}

const TenantPortal: React.FC = () => {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPortal = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/tenant-portal/me');
      if (res.status === 404) {
        setError('No tenant record is linked to your account. Contact your property manager.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load portal data');
      const d: PortalData = await res.json();
      setData(d);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortal();
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.tenant) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          property_id: data.tenant.propertyId,
          tenant_id: data.tenant.id,
          title,
          description: description || null,
          status: 'Open',
          priority: 'Normal',
        }),
      });
      if (!res.ok) throw new Error('Failed to submit request');
      setShowModal(false);
      setTitle('');
      setDescription('');
      notify.success('Maintenance request submitted');
      fetchPortal();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading your portal…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="glass-panel-static" style={{ color: 'var(--danger)', padding: '2rem', textAlign: 'center' }}>
          {error}
        </div>
      </div>
    );
  }

  const tenant = data?.tenant;
  const requests = data?.maintenanceRequests ?? [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Lease</h1>
          <p className="page-subtitle">Welcome back{tenant ? `, ${tenant.name.split(' ')[0]}` : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Submit Request
        </button>
      </div>

      {tenant && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            Lease Summary
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                Property
              </div>
              <div style={{ fontWeight: 600 }}>{tenant.propertyAssigned}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                Monthly Rent
              </div>
              <div style={{ fontWeight: 600 }}>
                {tenant.rentAmount != null ? `$${tenant.rentAmount.toLocaleString()}/mo` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                Lease Start
              </div>
              <div style={{ fontWeight: 600 }}>
                {tenant.leaseStart ? new Date(tenant.leaseStart).toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                Lease End
              </div>
              <div style={{ fontWeight: 600 }}>
                {tenant.leaseEnd ? new Date(tenant.leaseEnd).toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                Days Remaining
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: leaseUrgencyColor(tenant.daysUntilLeaseEnd) }}>
                {tenant.daysUntilLeaseEnd != null
                  ? tenant.daysUntilLeaseEnd <= 0
                    ? 'Expired'
                    : `${tenant.daysUntilLeaseEnd} days`
                  : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                Renewal Intent
              </div>
              <div style={{ fontWeight: 600 }}>{tenant.intent || 'Undecided'}</div>
            </div>
          </div>

          {tenant.daysUntilLeaseEnd !== null && tenant.daysUntilLeaseEnd < 60 && tenant.daysUntilLeaseEnd >= 0 && (
            <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)', fontSize: '0.88rem' }}>
              Your lease expires in {tenant.daysUntilLeaseEnd} day{tenant.daysUntilLeaseEnd !== 1 ? 's' : ''}.
              {' '}Contact your property manager to discuss renewal options.
            </div>
          )}
        </div>
      )}

      <div className="glass-panel-static">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>My Maintenance Requests</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{requests.length} total</span>
        </div>

        {requests.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            No maintenance requests submitted yet.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>
                    <strong>{req.title}</strong>
                    {req.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {req.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={STATUS_CLASSES[req.status] || 'badge'}>{req.status}</span>
                  </td>
                  <td style={{ fontSize: '0.88rem' }}>{req.priority}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>Submit Maintenance Request</h2>
            <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Title *
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Leaking faucet in kitchen"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantPortal;
