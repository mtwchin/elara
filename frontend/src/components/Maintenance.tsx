import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface MaintenanceRequest {
  id: number;
  property_id: number;
  tenant_id: number | null;
  title: string;
  description: string;
  status: string;
  priority: string;
}

interface PropertyOption {
  id: number;
  address: string;
}

const Maintenance: React.FC = () => {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [status, setStatus] = useState('Open');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/maintenance');
      if (!res.ok) throw new Error('Failed to fetch maintenance requests');
      const data = await res.json();
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    authFetch('/api/properties')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setProperties(data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) {
      alert('Please select a property');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          property_id: parseInt(propertyId, 10),
          priority,
          status,
        }),
      });
      if (!res.ok) throw new Error('Failed to create request');
      
      setTitle('');
      setDescription('');
      setPropertyId('');
      setPriority('Normal');
      setStatus('Open');
      fetchRequests();
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && requests.length === 0) {
    return <div className="app-container"><div className="loading-container fade-in">Loading Maintenance...</div></div>;
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

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Maintenance</h1>
          <p>Manage property maintenance requests.</p>
        </div>
      </div>

      <div className="glass-panel-static page-content">
        <h3 style={{ marginBottom: '1rem' }}>Log New Request</h3>
        <form onSubmit={handleSubmit} className="form-inline">
          <div className="form-group">
            <label className="form-label">Property</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required className="form-input">
              <option value="">Select a property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.address}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="form-input" placeholder="e.g. Broken AC" />
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="form-input">
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input">
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="form-group" style={{ width: '100%', marginTop: '0.5rem' }}>
            <label className="form-label">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required className="form-input" style={{ width: '100%' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '40px', marginTop: '0.5rem' }} disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Request'}
          </button>
        </form>
      </div>

      <div className="glass-panel-static" style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Description</th>
              <th>Status</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td style={{ fontWeight: 500 }}>{r.title}</td>
                <td>{r.description}</td>
                <td>
                  <span className={`badge ${r.status === 'Completed' ? 'badge-success' : r.status === 'Open' ? 'badge-danger' : 'badge-warning'}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <span className={`badge ${r.priority === 'Urgent' || r.priority === 'High' ? 'badge-danger' : 'badge-warning'}`}>
                    {r.priority}
                  </span>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <h3>No maintenance requests</h3>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Maintenance;
