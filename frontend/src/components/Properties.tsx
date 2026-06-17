import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface Property {
  id: number;
  address: string;
  propertyType: string;
  purchaseDate: string;
  status: string;
}

const Properties: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/properties')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch properties');
        return res.json();
      })
      .then((data: Property[]) => {
        setProperties(data);
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
        <div style={{ padding: '2rem' }}><h2>Loading Properties...</h2></div>
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
          <h1 className="text-gradient">Properties</h1>
          <p>Manage your real estate assets.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary">Add Property</button>
        </div>
      </header>

      <div className="glass-panel" style={{ marginTop: '2rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Address</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Property Type</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Purchase Date</th>
              <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((prop) => (
              <tr key={prop.id} style={{ transition: 'background 0.2s' }}>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{prop.address}</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{prop.propertyType}</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{prop.purchaseDate}</td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '999px', 
                    fontSize: '0.85rem',
                    background: prop.status === 'Occupied' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: prop.status === 'Occupied' ? 'var(--success)' : 'var(--warning)'
                  }}>
                    {prop.status}
                  </span>
                </td>
              </tr>
            ))}
            {properties.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No properties found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Properties;
