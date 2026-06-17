import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface Tenant {
  id: number;
  name: string;
  email: string;
  phone: string;
  propertyAssigned: string;
  leaseStart: string;
  leaseEnd: string;
  intent: string;
}

const Tenants: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/tenants')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch tenants');
        return res.json();
      })
      .then((data: Tenant[]) => {
        setTenants(data);
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
        <div style={{ padding: '2rem' }}><h2>Loading Tenants...</h2></div>
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

  return (
    <div className="app-container fade-in">
      <header>
        <div>
          <h1 className="text-gradient">Tenants</h1>
          <p>Manage your renters and leases.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary">Add Tenant</button>
        </div>
      </header>

      <div className="glass-panel" style={{ marginTop: '2rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Name</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Contact</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Property</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Lease Period</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Intent</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} style={{ transition: 'background 0.2s' }}>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ fontWeight: 500 }}>{tenant.name}</div>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>{tenant.email}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tenant.phone}</div>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{tenant.propertyAssigned}</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  {tenant.leaseStart} to {tenant.leaseEnd}
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '999px', 
                    fontSize: '0.85rem',
                    background: tenant.intent === 'Renew' ? 'rgba(16, 185, 129, 0.15)' : 
                                tenant.intent === 'Vacate' ? 'rgba(239, 68, 68, 0.15)' : 
                                'rgba(245, 158, 11, 0.15)',
                    color: tenant.intent === 'Renew' ? 'var(--success)' : 
                           tenant.intent === 'Vacate' ? 'var(--danger)' : 
                           'var(--warning)'
                  }}>
                    {tenant.intent}
                  </span>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No tenants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Tenants;
