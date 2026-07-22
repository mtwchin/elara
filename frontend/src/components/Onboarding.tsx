import React, { useState } from 'react';
import { Building2, Users, CheckCircle2 } from 'lucide-react';
import { authFetch } from '../auth';
import { notify } from '../toast';

interface Props {
  onDismiss: () => void;
}

interface PropertyResult {
  id: number;
  address: string;
}

interface TenantSummary {
  name: string;
  rentAmount: string;
}

const Onboarding: React.FC<Props> = ({ onDismiss }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  // Step 1 — property form
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('Single Family');
  const [purchasePrice, setPurchasePrice] = useState('');

  // Step 2 — tenant form
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');

  // Carry forward results for confirmation
  const [createdProperty, setCreatedProperty] = useState<PropertyResult | null>(null);
  const [createdTenant, setCreatedTenant] = useState<TenantSummary | null>(null);

  const dismiss = () => {
    localStorage.setItem('onboarding_dismissed', 'true');
    onDismiss();
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authFetch('/api/properties', {
        method: 'POST',
        body: JSON.stringify({
          address,
          property_type: propertyType,
          purchase_price: parseFloat(purchasePrice) || 0,
          purchase_date: new Date().toISOString().split('T')[0],
          status: 'Active',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to create property' }));
        throw new Error(err.detail || 'Failed to create property');
      }
      const data: PropertyResult = await res.json();
      setCreatedProperty(data);
      notify.success('Property added');
      setStep(2);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdProperty) return;
    setBusy(true);
    try {
      const res = await authFetch('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: tenantName,
          email: tenantEmail,
          phone: '',
          property_id: createdProperty.id,
          lease_start: leaseStart || null,
          lease_end: leaseEnd || null,
          rent_amount: parseFloat(monthlyRent) || 0,
          intent: 'Undecided',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to create tenant' }));
        throw new Error(err.detail || 'Failed to create tenant');
      }
      setCreatedTenant({ name: tenantName, rentAmount: monthlyRent });
      notify.success('Tenant added');
      setStep(3);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div
        className="glass-panel fade-in"
        style={{ width: '100%', maxWidth: '520px', padding: '2rem', position: 'relative' }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Step {step} of 3
          </span>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
          >
            Skip setup
          </button>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '4px', borderRadius: '999px',
          background: 'var(--glass-border)', marginBottom: '1.75rem', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '999px',
            width: `${progressPct}%`,
            background: 'var(--brand-gradient)',
            transition: 'width 0.4s ease',
          }} />
        </div>

        {/* Step 1 — Add property */}
        {step === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'var(--brand-primary-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <Building2 size={28} color="var(--brand-primary)" />
              </div>
              <h1 className="text-gradient" style={{ fontSize: '1.5rem', margin: '0 0 0.35rem' }}>
                Add your first property
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                Tell us about the property you want to track.
              </p>
            </div>

            <form onSubmit={handleAddProperty} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  className="form-input"
                  placeholder="123 Main St, City, State"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Property Type</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="form-input"
                  style={{ cursor: 'pointer' }}
                >
                  <option>Single Family</option>
                  <option>Multi Family</option>
                  <option>Condo</option>
                  <option>Commercial</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Purchase Price</label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  required
                  min={0}
                  className="form-input"
                  placeholder="e.g. 350000"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                style={{ padding: '0.65rem 1rem', marginTop: '0.25rem', width: '100%' }}
              >
                {busy ? 'Adding…' : 'Add Property'}
              </button>
            </form>
          </>
        )}

        {/* Step 2 — Add tenant */}
        {step === 2 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'var(--brand-primary-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <Users size={28} color="var(--brand-primary)" />
              </div>
              <h1 className="text-gradient" style={{ fontSize: '1.5rem', margin: '0 0 0.35rem' }}>
                Add your first tenant
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                {createdProperty ? `For ${createdProperty.address}` : 'Assign a tenant to your property.'}
              </p>
            </div>

            <form onSubmit={handleAddTenant} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tenant Name</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                  className="form-input"
                  placeholder="Jane Smith"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email</label>
                <input
                  type="email"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  required
                  className="form-input"
                  placeholder="jane@example.com"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Monthly Rent ($)</label>
                <input
                  type="number"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  required
                  min={0}
                  className="form-input"
                  placeholder="e.g. 2000"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Lease Start</label>
                  <input
                    type="date"
                    value={leaseStart}
                    onChange={(e) => setLeaseStart(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Lease End</label>
                  <input
                    type="date"
                    value={leaseEnd}
                    onChange={(e) => setLeaseEnd(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
                style={{ padding: '0.65rem 1rem', marginTop: '0.25rem', width: '100%' }}
              >
                {busy ? 'Adding…' : 'Add Tenant'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                onClick={() => setStep(3)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.88rem', textDecoration: 'underline' }}
              >
                Skip this step
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <CheckCircle2 size={32} color="var(--success)" />
            </div>

            <h1 className="text-gradient" style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>
              Your portfolio is set up
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Here's what you created:
            </p>

            <ul style={{
              textAlign: 'left', display: 'inline-block',
              padding: '1rem 1.25rem', borderRadius: '10px',
              background: 'var(--brand-primary-soft)',
              border: '1px solid var(--glass-border)',
              listStyle: 'none', marginBottom: '2rem',
              minWidth: '260px',
            }}>
              {createdProperty && (
                <li style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: createdTenant ? '0.6rem' : 0 }}>
                  <Building2 size={16} color="var(--brand-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <strong>Property:</strong> {createdProperty.address}
                  </span>
                </li>
              )}
              {createdTenant && (
                <li style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <Users size={16} color="var(--brand-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <strong>Tenant:</strong> {createdTenant.name} — ${parseFloat(createdTenant.rentAmount || '0').toLocaleString()}/mo
                  </span>
                </li>
              )}
              {!createdProperty && !createdTenant && (
                <li style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Nothing added yet — you can add properties and tenants from the main views.
                </li>
              )}
            </ul>

            <div>
              <button
                className="btn btn-primary"
                onClick={dismiss}
                style={{ padding: '0.65rem 2rem' }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
