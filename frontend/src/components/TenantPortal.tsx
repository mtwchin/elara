import React, { useState, useEffect } from 'react';
import { authFetch, getEmail } from '../auth';

interface Tenant {
  id: number;
  email: string;
  propertyId: number;
  propertyAssigned: string;
}

const TenantPortal: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tenantInfo, setTenantInfo] = useState<Tenant | null>(null);

  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        const res = await authFetch('/api/tenants');
        if (res.ok) {
          const tenants: Tenant[] = await res.json();
          const email = getEmail();
          const me = tenants.find((t) => t.email === email);
          if (me) setTenantInfo(me);
        }
      } catch (err) {
        console.error('Failed to fetch tenant info', err);
      }
    };
    fetchTenantInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const propertyId = tenantInfo ? tenantInfo.propertyId : 1; // Fallback to 1 if no tenant profile

    try {
      const res = await authFetch('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          property_id: propertyId,
          tenant_id: tenantInfo ? tenantInfo.id : null,
          priority: 'Normal',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit maintenance request');

      setMessage({ type: 'success', text: 'Maintenance request submitted successfully!' });
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Unknown error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Tenant Portal</h1>
          <p>Submit and track your maintenance requests.</p>
        </div>
      </div>

      <div className="glass-panel-static page-content" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>New Maintenance Request</h3>

        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Issue Title</label>
            <input
              type="text"
              className="form-input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Leaking Faucet"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide details about the issue..."
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '44px' }} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TenantPortal;
