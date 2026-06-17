import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface Tenant {
  id: number;
  name: string;
  email: string;
  phone: string;
  propertyId: number;
  propertyAssigned: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  rentAmount: number | null;
  intent: string;
  daysUntilLeaseEnd: number | null;
}

interface PropertyOption {
  id: number;
  address: string;
}

interface TenantFormData {
  name: string;
  email: string;
  phone: string;
  property_id: string;
  lease_start: string;
  lease_end: string;
  rent_amount: string;
  intent: string;
}

interface RenewalLetterResult {
  letter: string;
  tenant: Tenant;
  suggested_rent: number;
}

const EMPTY_TENANT_FORM: TenantFormData = {
  name: '',
  email: '',
  phone: '',
  property_id: '',
  lease_start: '',
  lease_end: '',
  rent_amount: '',
  intent: 'Undecided',
};

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

const TODAY = new Date('2026-06-17');
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function isWithin90Days(leaseEnd: string | null): boolean {
  if (!leaseEnd) return false;
  const end = new Date(leaseEnd);
  const diff = end.getTime() - TODAY.getTime();
  return diff >= 0 && diff <= NINETY_DAYS_MS;
}

const Tenants: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Tenant modal
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantForm, setTenantForm] = useState<TenantFormData>(EMPTY_TENANT_FORM);
  const [tenantSubmitting, setTenantSubmitting] = useState(false);

  // Renewal letter modal
  const [renewalLoading, setRenewalLoading] = useState<number | null>(null);
  const [renewalResult, setRenewalResult] = useState<RenewalLetterResult | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/tenants');
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data: Tenant[] = await res.json();
      setTenants(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    authFetch('/api/properties')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PropertyOption[]) => setProperties(data))
      .catch(() => {});
  }, []);

  const openAddTenant = () => {
    setEditingTenant(null);
    setTenantForm(EMPTY_TENANT_FORM);
    setShowTenantModal(true);
  };

  const openEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setTenantForm({
      name: tenant.name,
      email: tenant.email || '',
      phone: tenant.phone || '',
      property_id: String(tenant.propertyId),
      lease_start: tenant.leaseStart || '',
      lease_end: tenant.leaseEnd || '',
      rent_amount: tenant.rentAmount != null ? String(tenant.rentAmount) : '',
      intent: tenant.intent || 'Undecided',
    });
    setShowTenantModal(true);
  };

  const handleDeleteTenant = async (id: number) => {
    if (!window.confirm('Delete this tenant? This cannot be undone.')) return;
    try {
      const res = await authFetch(`/api/tenants/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete tenant');
      setTenants((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTenantSubmitting(true);
    const payload = {
      name: tenantForm.name,
      email: tenantForm.email || null,
      phone: tenantForm.phone || null,
      property_id: parseInt(tenantForm.property_id, 10),
      lease_start: tenantForm.lease_start || null,
      lease_end: tenantForm.lease_end || null,
      rent_amount: tenantForm.rent_amount ? parseFloat(tenantForm.rent_amount) : null,
      intent: tenantForm.intent,
    };
    try {
      const res = editingTenant
        ? await authFetch(`/api/tenants/${editingTenant.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await authFetch('/api/tenants', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to save tenant');
      setShowTenantModal(false);
      fetchTenants();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setTenantSubmitting(false);
    }
  };

  const handleDraftRenewal = async (tenant: Tenant) => {
    setRenewalLoading(tenant.id);
    try {
      const res = await authFetch('/api/agents/renewal-letter', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenant.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || 'Failed to generate renewal letter');
      }
      const data: RenewalLetterResult = await res.json();
      setRenewalResult(data);
      setShowRenewalModal(true);
    } catch (err: unknown) {
      alert('Error drafting renewal: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setRenewalLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container fade-in">Loading Tenants...</div>
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

  const intentBadge = (intent: string) => {
    const variant =
      intent === 'Renew' ? 'badge-success' :
      intent === 'Vacate' ? 'badge-danger' :
      'badge-warning';
    return <span className={`badge ${variant}`}>{intent}</span>;
  };

  const filteredTenants = tenants.filter((t) =>
    [t.name, t.email, t.propertyAssigned].some((v) =>
      (v || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Tenants</h1>
          <p>Manage your renters and leases.</p>
        </div>
        <div className="page-header-actions">
          <input
            type="text"
            className="form-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px' }}
          />
          <button className="btn btn-primary" onClick={openAddTenant}>Add Tenant</button>
        </div>
      </div>

      {search.length > 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Showing {filteredTenants.length} of {tenants.length}
        </p>
      )}

      <div className="glass-panel-static page-content" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Property</th>
              <th>Lease Period</th>
              <th>Rent</th>
              <th>Intent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((tenant) => {
              const showRenewalCta =
                isWithin90Days(tenant.leaseEnd) && tenant.intent !== 'Vacate';
              return (
                <tr key={tenant.id}>
                  <td style={{ fontWeight: 500 }}>{tenant.name}</td>
                  <td>
                    <div>{tenant.email}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{tenant.phone}</div>
                  </td>
                  <td>{tenant.propertyAssigned}</td>
                  <td>
                    {tenant.leaseStart} {tenant.leaseStart && tenant.leaseEnd ? '→' : ''} {tenant.leaseEnd}
                  </td>
                  <td>
                    {tenant.rentAmount != null
                      ? `$${tenant.rentAmount.toLocaleString()}`
                      : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {intentBadge(tenant.intent)}
                      {showRenewalCta && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', whiteSpace: 'nowrap' }}
                          disabled={renewalLoading === tenant.id}
                          onClick={() => handleDraftRenewal(tenant)}
                        >
                          {renewalLoading === tenant.id ? 'Drafting...' : 'Draft Renewal'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                        onClick={() => openEditTenant(tenant)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)' }}
                        onClick={() => handleDeleteTenant(tenant.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTenants.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <h3>{search.length > 0 ? 'No tenants match your search' : 'No tenants yet'}</h3>
                    <p>{search.length > 0 ? 'Try a different search term.' : 'Add tenants and assign them to your properties.'}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tenant add/edit modal */}
      {showTenantModal && (
        <div style={overlayStyle} onClick={() => setShowTenantModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingTenant ? 'Edit Tenant' : 'Add Tenant'}</h2>
            <form onSubmit={handleTenantSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={tenantForm.email}
                  onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={tenantForm.phone}
                  onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Property</label>
                <select
                  className="form-input"
                  required
                  value={tenantForm.property_id}
                  onChange={(e) => setTenantForm({ ...tenantForm, property_id: e.target.value })}
                >
                  <option value="">Select a property...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.address}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Lease Start</label>
                <input
                  type="date"
                  className="form-input"
                  value={tenantForm.lease_start}
                  onChange={(e) => setTenantForm({ ...tenantForm, lease_start: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Lease End</label>
                <input
                  type="date"
                  className="form-input"
                  value={tenantForm.lease_end}
                  onChange={(e) => setTenantForm({ ...tenantForm, lease_end: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Rent Amount ($)</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  step="0.01"
                  value={tenantForm.rent_amount}
                  onChange={(e) => setTenantForm({ ...tenantForm, rent_amount: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Intent</label>
                <select
                  className="form-input"
                  value={tenantForm.intent}
                  onChange={(e) => setTenantForm({ ...tenantForm, intent: e.target.value })}
                >
                  <option value="Renew">Renew</option>
                  <option value="Undecided">Undecided</option>
                  <option value="Vacate">Vacate</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowTenantModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={tenantSubmitting}>
                  {tenantSubmitting ? 'Saving...' : 'Save Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renewal letter modal */}
      {showRenewalModal && renewalResult && (
        <div style={overlayStyle} onClick={() => setShowRenewalModal(false)}>
          <div
            style={{ ...modalStyle, maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h2>Lease Renewal Letter</h2>
              <button className="btn" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={() => setShowRenewalModal(false)}>
                Close
              </button>
            </div>
            {renewalResult.suggested_rent && (
              <p style={{ marginBottom: '1rem' }}>
                Suggested Rent: <strong>${renewalResult.suggested_rent.toLocaleString()}/mo</strong>
              </p>
            )}
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem',
                maxHeight: '50vh',
                overflowY: 'auto',
              }}
            >
              {renewalResult.letter}
            </pre>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard.writeText(renewalResult.letter);
                }}
              >
                Copy to Clipboard
              </button>
              <a
                className="btn btn-primary"
                href={`mailto:${renewalResult.tenant?.email || ''}?subject=${encodeURIComponent('Lease Renewal — ' + (renewalResult.tenant?.propertyAssigned || ''))}&body=${encodeURIComponent(renewalResult.letter)}`}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                Send via Email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tenants;
