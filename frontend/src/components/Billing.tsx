import React, { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { authFetch } from '../auth';
import { notify } from '../toast';
import Spinner from './ui/Spinner';

interface BillingStatus {
  subscription_status: string;
  subscription_tier: string;
  has_stripe_customer: boolean;
  stripe_configured: boolean;
  available_tiers: string[];
}

const planCards = [
  {
    tier: 'Starter',
    price: '$39',
    description: 'For small owners with up to 5 units.',
    bullets: ['Core portfolio dashboard', 'Tenant and lease tracking', 'CSV transaction export'],
  },
  {
    tier: 'Portfolio',
    price: '$89',
    description: 'For active owners with up to 25 units.',
    bullets: ['AI health checks', 'Maintenance workflows', 'Document extraction'],
    featured: true,
  },
  {
    tier: 'Operator',
    price: '$199',
    description: 'For teams and operators with up to 100 units.',
    bullets: ['Priority onboarding', 'Advanced reporting', 'Team-ready operating workflows'],
  },
];

const Billing: React.FC = () => {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/billing/status')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load billing status');
        return res.json();
      })
      .then((json: BillingStatus) => {
        setStatus(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load billing status');
        setLoading(false);
      });
  }, []);

  const startCheckout = async (tier: string) => {
    setCheckoutTier(tier);
    try {
      const res = await authFetch('/api/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || 'Could not start checkout');
      if (!json.url) throw new Error('Checkout URL was not returned');
      window.location.href = json.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start checkout';
      notify.error(message);
    } finally {
      setCheckoutTier(null);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await authFetch('/api/billing/create-portal', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.detail || 'Could not open customer portal');
      if (!json.url) throw new Error('Customer portal URL was not returned');
      window.location.href = json.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open customer portal';
      notify.error(message);
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container fade-in">
          <Spinner size={22} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Billing</h1>
          <p>Manage the subscription path for real customer accounts.</p>
        </div>
      </div>

      {error && (
        <div className="glass-panel-static" style={{ marginBottom: '1.5rem', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {status && (
        <div className="billing-status-grid">
          <section className="glass-panel-static billing-status-card">
            <div className="billing-status-icon">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="metric-label">Current plan</p>
              <h2>{status.subscription_tier || 'Free'}</h2>
              <p>Status: {status.subscription_status || 'inactive'}</p>
              {status.has_stripe_customer && (
                <button className="btn" onClick={openPortal} disabled={portalLoading} style={{ marginTop: '0.75rem' }}>
                  {portalLoading && <Spinner size={14} />}
                  Manage billing
                  {!portalLoading && <ExternalLink size={14} />}
                </button>
              )}
            </div>
          </section>

          <section className="glass-panel-static billing-status-card">
            <div className="billing-status-icon">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="metric-label">Stripe setup</p>
              <h2>{status.stripe_configured ? 'Configured' : 'Needs configuration'}</h2>
              <p>
                {status.stripe_configured
                  ? 'Checkout can create live Stripe sessions for configured tiers.'
                  : 'Add Stripe secret and price IDs before accepting paid users.'}
              </p>
            </div>
          </section>
        </div>
      )}

      <section className="pricing-section billing-pricing-section">
        <div className="features-section-header">
          <h2>Subscription plans</h2>
          <p>These are the same buyer-facing beta plans shown on the public page.</p>
        </div>
        <div className="pricing-grid">
          {planCards.map((plan) => {
            const configured = Boolean(status?.available_tiers.includes(plan.tier));
            const isCurrent = status?.subscription_tier?.toLowerCase() === plan.tier.toLowerCase()
              && status?.subscription_status === 'active';
            return (
              <article className={`pricing-card${plan.featured ? ' pricing-card-featured' : ''}`} key={plan.tier}>
                {plan.featured && <div className="pricing-badge">Recommended</div>}
                <h3>{plan.tier}</h3>
                <p>{plan.description}</p>
                <div className="pricing-price">
                  <span>{plan.price}</span>
                  <small>/mo</small>
                </div>
                <ul>
                  {plan.bullets.map((bullet) => (
                    <li key={bullet}>
                      <Check size={15} />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <button
                  className={`btn ${plan.featured ? 'btn-primary' : ''}`}
                  onClick={() => startCheckout(plan.tier)}
                  disabled={!configured || checkoutTier === plan.tier || isCurrent}
                >
                  {checkoutTier === plan.tier && <Spinner size={14} />}
                  {isCurrent ? 'Current plan' : configured ? 'Start checkout' : 'Configure Stripe price'}
                  {!isCurrent && configured && checkoutTier !== plan.tier && <ExternalLink size={14} />}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="glass-panel-static billing-readiness">
        <div>
          <Sparkles size={19} />
          <h2>Paid beta checklist</h2>
        </div>
        <p>
          Before switching ads on, verify Stripe test checkout, terms and privacy copy, plan limits,
          data export, support contact, and a clean onboarding path for the first property.
        </p>
      </section>
    </div>
  );
};

export default Billing;
