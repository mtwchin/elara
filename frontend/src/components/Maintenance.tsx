import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface MaintenanceRequest {
  id: number;
  propertyId: number;
  tenantId: number | null;
  title: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  createdAt: string;
}

interface PropertyOption {
  id: number;
  address: string;
}

interface TenantOption {
  id: number;
  name: string;
}

interface FormData {
  property_id: string;
  tenant_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
}

const EMPTY_FORM: FormData = {
  property_id: '',
  tenant_id: '',
  title: '',
  description: '',
  status: 'Open',
  priority: 'Normal',
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

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'var(--text-muted)',
  Normal: 'var(--accent-blue)',
  High: 'var(--warning)',
  Urgent: 'var(--danger)',
};

const STATUS_CLASSES: Record<string, string> = {
  Open: 'badge badge-warning',
  'In Progress': 'badge badge-info',
  Resolved: 'badge badge-success',
  Closed: 'badge',
};

const Maintenance: React.FC = () => {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [suggestingFor, setSuggestingFor] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, { priority: string; reasoning: string }>>({});

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/maintenance');
      if (!res.ok) throw new Error('Failed to fetch maintenance requests');
      const data: MaintenanceRequest[] = await res.json();
      setRequests(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    authFetch('/api/properties')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: PropertyOption[]) => setProperties(d))
      .catch(() => {});
    authFetch('/api/tenants')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: TenantOption[]) => setTenants(d))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setEditingRequest(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (req: MaintenanceRequest) => {
    setEditingRequest(req);
    setForm({
      property_id: String(req.propertyId),
      tenant_id: req.tenantId != null ? String(req.tenantId) : '',
      title: req.title,
      description: req.description || '',
      status: req.status,
      priority: req.priority,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      property_id: parseInt(form.property_id, 10),
      tenant_id: form.tenant_id ? parseInt(form.tenant_id, 10) : null,
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
    };
    try {
      const res = editingRequest
        ? await authFetch(`/api/maintenance/${editingRequest.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/maintenance', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to save request');
      setShowModal(false);
      fetchRequests();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuggestPriority = async (req: MaintenanceRequest) => {
    setSuggestingFor(req.id);
    try {
      const res = await authFetch('/api/agents/suggest-priority', {
        method: 'POST',
        body: JSON.stringify({ title: req.title, description: req.description }),
      });
      if (!res.ok) throw new Error('Suggestion failed');
      const data: { priority: string; reasoning: string } = await res.json();
      setSuggestions((prev) => ({ ...prev, [req.id]: data }));
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSuggestingFor(null);
    }
  };

  const handleApplySuggestion = async (req: MaintenanceRequest, priority: string) => {
    try {
      const res = await authFetch(`/api/maintenance/${req.id}`, {
        method: 'PUT',
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error('Failed to update priority');
      setSuggestions((prev) => {
        const next = { ...prev };
        delete next[req.id];
        return next;
      });
      fetchRequests();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const propName = (id: number) =>
    properties.find((p) => p.id === id)?.address || `Property ${id}`;

  const filtered = requests.filter(
    (r) => statusFilter === 'All' || r.status === statusFilter
  );

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <p className="page-subtitle">Track and manage maintenance requests across your portfolio</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + New Request
        </button>
      </div>

      {error && (
        <div className="glass-panel-static" style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="glass-panel-static" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
          <button
            key={s}
            className={statusFilter === s ? 'btn btn-primary' : 'btn'}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="glass-panel-static">
        {filtered.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            No maintenance requests {statusFilter !== 'All' ? `with status "${statusFilter}"` : ''}.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const suggestion = suggestions[req.id];
                return (
                  <tr key={req.id}>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {propName(req.propertyId)}
                    </td>
                    <td>
                      <strong>{req.title}</strong>
                      {req.description && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {req.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={STATUS_CLASSES[req.status] || 'badge'}>{req.status}</span>
                    </td>
                    <td>
                      <span style={{ color: PRIORITY_COLORS[req.priority] || 'inherit', fontWeight: 600 }}>
                        {req.priority}
                      </span>
                      {suggestion && (
                        <div style={{ marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          AI suggests:{' '}
                          <strong style={{ color: PRIORITY_COLORS[suggestion.priority] }}>
                            {suggestion.priority}
                          </strong>{' '}
                          — {suggestion.reasoning}
                          <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.4rem' }}>
                            <button
                              className="btn"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => handleApplySuggestion(req, suggestion.priority)}
                            >
                              Apply
                            </button>
                            <button
                              className="btn"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() =>
                                setSuggestions((prev) => {
                                  const n = { ...prev };
                                  delete n[req.id];
                                  return n;
                                })
                              }
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn"
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                          onClick={() => openEdit(req)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                          disabled={suggestingFor === req.id}
                          onClick={() => handleSuggestPriority(req)}
                        >
                          {suggestingFor === req.id ? 'Thinking…' : 'AI Priority'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={overlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.3rem' }}>
              {editingRequest ? 'Edit Request' : 'New Maintenance Request'}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Property *
                </label>
                <select
                  required
                  value={form.property_id}
                  onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)' }}
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.address}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Tenant (optional)
                </label>
                <select
                  value={form.tenant_id}
                  onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)' }}
                >
                  <option value="">None</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Title *
                </label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. HVAC repair needed"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue..."
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)' }}
                  >
                    {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)' }}
                  >
                    {['Low', 'Normal', 'High', 'Urgent'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : editingRequest ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
