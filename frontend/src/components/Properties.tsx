import React, { useState, useEffect, useRef } from 'react';
import { authFetch, authUpload } from '../auth';
import { notify } from '../toast';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';

interface Property {
  id: number;
  address: string;
  propertyType: string;
  purchasePrice: number;
  purchaseDate: string;
  status: string;
}

interface Mortgage {
  id: number;
  propertyId: number;
  lender: string | null;
  principal: number;
  interestRate: number;
  termMonths: number;
  monthlyPi: number;
  monthlyEscrow: number;
}

interface PropertyFormData {
  address: string;
  propertyType: string;
  purchasePrice: string;
  purchaseDate: string;
  status: string;
}

interface MortgageFormData {
  lender: string;
  principal: string;
  interest_rate: string;
  term_months: string;
  monthly_pi: string;
  monthly_escrow: string;
}

const EMPTY_PROPERTY_FORM: PropertyFormData = {
  address: '',
  propertyType: 'Residential',
  purchasePrice: '',
  purchaseDate: '',
  status: 'Active',
};

const EMPTY_MORTGAGE_FORM: MortgageFormData = {
  lender: '',
  principal: '',
  interest_rate: '',
  term_months: '',
  monthly_pi: '',
  monthly_escrow: '',
};

const Properties: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyForm, setPropertyForm] = useState<PropertyFormData>(EMPTY_PROPERTY_FORM);
  const [propertySubmitting, setPropertySubmitting] = useState(false);

  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [mortgage, setMortgage] = useState<Mortgage | null | undefined>(undefined);
  const [mortgageLoading, setMortgageLoading] = useState(false);

  const [showMortgageModal, setShowMortgageModal] = useState(false);
  const [mortgageForm, setMortgageForm] = useState<MortgageFormData>(EMPTY_MORTGAGE_FORM);
  const [mortgageSubmitting, setMortgageSubmitting] = useState(false);

  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/properties?limit=500');
      if (!res.ok) throw new Error('Failed to fetch properties');
      const data = await res.json();
      setProperties(data.items ?? data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProperties(); }, []);

  const fetchMortgage = async (propertyId: number) => {
    setMortgageLoading(true);
    setMortgage(undefined);
    try {
      const res = await authFetch(`/api/properties/${propertyId}/mortgage`);
      if (!res.ok) throw new Error('Failed to fetch mortgage');
      setMortgage(await res.json());
    } catch {
      setMortgage(null);
    } finally {
      setMortgageLoading(false);
    }
  };

  const loadPropertyImage = async (id: number) => {
    if (id in imageUrls) return;
    try {
      const res = await authFetch(`/api/properties/${id}/image`);
      if (res.ok) {
        const blob = await res.blob();
        setImageUrls((prev) => ({ ...prev, [id]: URL.createObjectURL(blob) }));
      } else {
        setImageUrls((prev) => ({ ...prev, [id]: null }));
      }
    } catch {
      setImageUrls((prev) => ({ ...prev, [id]: null }));
    }
  };

  const handleImageUpload = async (id: number) => {
    const file = imageInputRef.current?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await authUpload(`/api/properties/${id}/image`, form);
      if (!res.ok) throw new Error('Upload failed');
      setImageUrls((prev) => { const next = { ...prev }; delete next[id]; return next; });
      loadPropertyImage(id);
      if (imageInputRef.current) imageInputRef.current.value = '';
      notify.success('Photo uploaded');
    } catch (err: unknown) {
      notify.error('Image upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSelectRow = (id: number) => {
    if (selectedPropertyId === id) {
      setSelectedPropertyId(null);
      setMortgage(undefined);
    } else {
      setSelectedPropertyId(id);
      fetchMortgage(id);
      loadPropertyImage(id);
    }
  };

  const openAddProperty = () => {
    setEditingProperty(null);
    setPropertyForm(EMPTY_PROPERTY_FORM);
    setShowPropertyModal(true);
  };

  const openEditProperty = (prop: Property, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProperty(prop);
    setPropertyForm({
      address: prop.address,
      propertyType: prop.propertyType,
      purchasePrice: String(prop.purchasePrice),
      purchaseDate: prop.purchaseDate || '',
      status: prop.status,
    });
    setShowPropertyModal(true);
  };

  const handleDeleteProperty = async (id: number) => {
    try {
      const res = await authFetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete property');
      setProperties((prev) => prev.filter((p) => p.id !== id));
      if (selectedPropertyId === id) { setSelectedPropertyId(null); setMortgage(undefined); }
      notify.success('Property deleted');
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setConfirmDelete(null);
    }
  };

  const handlePropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPropertySubmitting(true);
    const payload = {
      address: propertyForm.address,
      propertyType: propertyForm.propertyType,
      purchasePrice: parseFloat(propertyForm.purchasePrice),
      purchaseDate: propertyForm.purchaseDate,
      status: propertyForm.status,
    };
    try {
      const res = editingProperty
        ? await authFetch(`/api/properties/${editingProperty.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await authFetch('/api/properties', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to save property');
      setShowPropertyModal(false);
      notify.success(editingProperty ? 'Property updated' : 'Property added');
      fetchProperties();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPropertySubmitting(false);
    }
  };

  const openMortgageModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mortgage) {
      setMortgageForm({
        lender: mortgage.lender || '',
        principal: String(mortgage.principal),
        interest_rate: String(mortgage.interestRate),
        term_months: String(mortgage.termMonths),
        monthly_pi: String(mortgage.monthlyPi),
        monthly_escrow: String(mortgage.monthlyEscrow),
      });
    } else {
      setMortgageForm(EMPTY_MORTGAGE_FORM);
    }
    setShowMortgageModal(true);
  };

  const handleMortgageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId) return;
    setMortgageSubmitting(true);
    const payload = {
      lender: mortgageForm.lender || null,
      principal: parseFloat(mortgageForm.principal),
      interest_rate: parseFloat(mortgageForm.interest_rate),
      term_months: parseInt(mortgageForm.term_months, 10),
      monthly_pi: parseFloat(mortgageForm.monthly_pi),
      monthly_escrow: mortgageForm.monthly_escrow ? parseFloat(mortgageForm.monthly_escrow) : 0,
    };
    try {
      const method = mortgage ? 'PUT' : 'POST';
      const res = await authFetch(`/api/properties/${selectedPropertyId}/mortgage`, { method, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to save mortgage');
      setShowMortgageModal(false);
      notify.success(mortgage ? 'Mortgage updated' : 'Mortgage added');
      fetchMortgage(selectedPropertyId);
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setMortgageSubmitting(false);
    }
  };

  if (loading) return <div className="app-container"><div className="loading-container fade-in">Loading Properties...</div></div>;
  if (error) return (
    <div className="app-container fade-in">
      <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '600px', margin: '4rem auto' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Error</h2>
        <p>{error}</p>
      </div>
    </div>
  );

  const statusBadge = (status: string) => {
    const variant = status === 'Occupied' ? 'badge-success' : 'badge-warning';
    return <span className={`badge ${variant}`}>{status}</span>;
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const filteredProperties = properties.filter((p) =>
    [p.address, p.propertyType, p.status].some((v) => (v || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Properties</h1>
          <p>Manage your real estate assets.</p>
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
          <button className="btn btn-primary" onClick={openAddProperty}>Add Property</button>
        </div>
      </div>

      {search.length > 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Showing {filteredProperties.length} of {properties.length}
        </p>
      )}

      <div className="glass-panel-static page-content" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Address</th>
              <th>Purchase Price</th>
              <th>Property Type</th>
              <th>Purchase Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProperties.map((prop) => (
              <tr
                key={prop.id}
                onClick={() => handleSelectRow(prop.id)}
                style={{ cursor: 'pointer', background: selectedPropertyId === prop.id ? 'var(--brand-primary-soft)' : undefined }}
              >
                <td style={{ fontWeight: 500 }}>{prop.address}</td>
                <td>${prop.purchasePrice?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                <td>{prop.propertyType}</td>
                <td>{prop.purchaseDate}</td>
                <td>{statusBadge(prop.status)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={(e) => openEditProperty(prop, e)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)' }}
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(prop.id); }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProperties.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <h3>{search.length > 0 ? 'No properties match your search' : 'No properties yet'}</h3>
                    <p>{search.length > 0 ? 'Try a different search term.' : 'Add your first property to get started.'}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPropertyId && selectedProperty && (
        <div className="glass-panel-static" style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Mortgage Details — {selectedProperty.address}</h3>
            {!mortgageLoading && (
              <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }} onClick={openMortgageModal}>
                {mortgage ? 'Edit Mortgage' : 'Add Mortgage'}
              </button>
            )}
          </div>

          {mortgageLoading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading mortgage details...</p>
          ) : mortgage ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Lender', value: mortgage.lender || '—' },
                { label: 'Principal', value: `$${mortgage.principal?.toLocaleString()}` },
                { label: 'Interest Rate', value: `${mortgage.interestRate}%` },
                { label: 'Term', value: `${mortgage.termMonths} mo` },
                { label: 'Monthly P&I', value: `$${mortgage.monthlyPi?.toLocaleString()}` },
                { label: 'Monthly Escrow', value: `$${mortgage.monthlyEscrow?.toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '10px' }}>
                  <div className="metric-label">{label}</div>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginTop: '0.25rem' }}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No mortgage on file for this property.</p>
          )}

          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>Property Photo</h4>
              <label style={{ cursor: 'pointer' }}>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }}
                  onChange={() => handleImageUpload(selectedPropertyId!)}
                />
                <span className="btn" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                  {imageUrls[selectedPropertyId!] ? 'Replace Photo' : 'Upload Photo'}
                </span>
              </label>
            </div>
            {imageUrls[selectedPropertyId!] && (
              <img src={imageUrls[selectedPropertyId!]!} alt="Property"
                style={{ marginTop: '0.75rem', maxWidth: '100%', maxHeight: '240px', borderRadius: '10px', objectFit: 'cover' }} />
            )}
            {imageUrls[selectedPropertyId!] === null && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No photo uploaded yet.</p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Property"
        message="Are you sure you want to delete this property? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDelete !== null && handleDeleteProperty(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <Modal open={showPropertyModal} onClose={() => setShowPropertyModal(false)} title={editingProperty ? 'Edit Property' : 'Add Property'}>
        <form onSubmit={handlePropertySubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Address</label>
            <input type="text" className="form-input" required value={propertyForm.address}
              onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Property Type</label>
            <select className="form-input" value={propertyForm.propertyType}
              onChange={(e) => setPropertyForm({ ...propertyForm, propertyType: e.target.value })}>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Multi-Family">Multi-Family</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Purchase Price</label>
            <input type="number" className="form-input" required min="0" step="1" value={propertyForm.purchasePrice}
              onChange={(e) => setPropertyForm({ ...propertyForm, purchasePrice: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Purchase Date</label>
            <input type="date" className="form-input" required value={propertyForm.purchaseDate}
              onChange={(e) => setPropertyForm({ ...propertyForm, purchaseDate: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={propertyForm.status}
              onChange={(e) => setPropertyForm({ ...propertyForm, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Vacant">Vacant</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setShowPropertyModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={propertySubmitting}>
              {propertySubmitting ? 'Saving...' : 'Save Property'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showMortgageModal} onClose={() => setShowMortgageModal(false)} title={mortgage ? 'Edit Mortgage' : 'Add Mortgage'}>
        <form onSubmit={handleMortgageSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Lender</label>
            <input type="text" className="form-input" value={mortgageForm.lender}
              onChange={(e) => setMortgageForm({ ...mortgageForm, lender: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Principal ($)</label>
            <input type="number" className="form-input" required min="0" step="0.01" value={mortgageForm.principal}
              onChange={(e) => setMortgageForm({ ...mortgageForm, principal: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Interest Rate (%)</label>
            <input type="number" className="form-input" required min="0" step="0.01" value={mortgageForm.interest_rate}
              onChange={(e) => setMortgageForm({ ...mortgageForm, interest_rate: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Term (months)</label>
            <input type="number" className="form-input" required min="1" step="1" value={mortgageForm.term_months}
              onChange={(e) => setMortgageForm({ ...mortgageForm, term_months: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Monthly P&I ($)</label>
            <input type="number" className="form-input" required min="0" step="0.01" value={mortgageForm.monthly_pi}
              onChange={(e) => setMortgageForm({ ...mortgageForm, monthly_pi: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Monthly Escrow ($)</label>
            <input type="number" className="form-input" min="0" step="0.01" value={mortgageForm.monthly_escrow}
              onChange={(e) => setMortgageForm({ ...mortgageForm, monthly_escrow: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setShowMortgageModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mortgageSubmitting}>
              {mortgageSubmitting ? 'Saving...' : 'Save Mortgage'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Properties;
