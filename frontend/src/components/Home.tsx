import React from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ClipboardList,
  FileText,
  HomeIcon,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Wrench,
} from 'lucide-react';
import type { Theme } from '../theme';
import elaraLogo from '../assets/elara.jpg';

interface Props {
  onLoginClick: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onPrivacyClick?: () => void;
  onTermsClick?: () => void;
}

const customerSegments = [
  {
    icon: <HomeIcon size={20} />,
    title: 'Small rental owners',
    body: 'For owners with 3-25 doors who need rent, lease, maintenance, document, and cash-flow visibility without spreadsheet sprawl.',
  },
  {
    icon: <Building2 size={20} />,
    title: 'Growing operators',
    body: 'For owner-operators and small teams managing 25-100 units who need portfolio health, renewal workflows, and cleaner reporting.',
  },
  {
    icon: <ClipboardList size={20} />,
    title: 'Property managers',
    body: 'For service businesses that want a focused operating layer before graduating into heavier enterprise platforms.',
  },
];

const featureGroups = [
  {
    icon: <BarChart3 size={21} />,
    title: 'Portfolio command center',
    body: 'Track occupancy, revenue, expenses, property value, lease timing, and maintenance pressure from one operating dashboard.',
  },
  {
    icon: <Sparkles size={21} />,
    title: 'AI-assisted workflows',
    body: 'Generate renewal drafts, portfolio health checks, document extraction summaries, and grounded assistant responses from live account data.',
  },
  {
    icon: <FileText size={21} />,
    title: 'Documents and reporting',
    body: 'Attach receipts and property files, export transactions, prepare accountant-friendly views, and keep records tied to the right asset.',
  },
  {
    icon: <Wrench size={21} />,
    title: 'Maintenance visibility',
    body: 'Centralize requests, priorities, status, tenant context, and recurring-property signals before issues become expensive surprises.',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: '$39',
    cadence: '/mo',
    description: 'For owners getting out of spreadsheets.',
    details: ['Up to 5 units', 'Portfolio dashboard', 'Tenant and lease tracking', 'Transaction exports'],
    cta: 'Start trial',
  },
  {
    name: 'Portfolio',
    price: '$89',
    cadence: '/mo',
    description: 'For active owners with a growing rental portfolio.',
    details: ['Up to 25 units', 'AI health checks', 'Maintenance workflows', 'Document extraction'],
    cta: 'Choose Portfolio',
    featured: true,
  },
  {
    name: 'Operator',
    price: '$199',
    cadence: '/mo',
    description: 'For small teams and higher-volume operators.',
    details: ['Up to 100 units', 'Team-ready workflows', 'Priority onboarding', 'Advanced portfolio reporting'],
    cta: 'Choose Operator',
  },
];

const launchProof = [
  { value: '14 days', label: 'Free beta trial' },
  { value: '3-100', label: 'Ideal unit range' },
  { value: 'CSV', label: 'Export-ready data' },
  { value: 'AI', label: 'Grounded in your records' },
];

const trustItems = [
  'Local JWT authentication',
  'Per-account portfolio isolation',
  'Configurable CORS origins',
  'Stripe-ready billing path',
  'AI disclaimers required before launch',
];

const Home: React.FC<Props> = ({ onLoginClick, theme, onToggleTheme, onPrivacyClick, onTermsClick }) => {
  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="marketing-shell">
      <nav className="marketing-nav">
        <button className="marketing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
          <img src={elaraLogo} alt="Elara" />
          <span>Elara</span>
        </button>

        <div className="marketing-nav-links" aria-label="Primary">
          <button onClick={() => document.getElementById('fit')?.scrollIntoView({ behavior: 'smooth' })}>Who it is for</button>
          <button onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' })}>Product</button>
          <button onClick={scrollToPricing}>Pricing</button>
        </div>

        <div className="marketing-nav-actions">
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="icon-btn"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button className="btn" onClick={onLoginClick}>Sign in</button>
          <button className="btn btn-primary" onClick={onLoginClick}>Start beta</button>
        </div>
      </nav>

      <main>
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <div className="home-eyebrow">
              <ShieldCheck size={14} />
              Private beta for rental owners and small operators
            </div>
            <h1>Elara</h1>
            <p className="marketing-hero-subtitle">
              The AI-assisted operating dashboard for rental property owners who need cleaner records, faster decisions, and fewer things falling through the cracks.
            </p>
            <div className="marketing-hero-actions">
              <button className="btn btn-accent" onClick={onLoginClick}>
                Start free trial
                <ArrowRight size={16} />
              </button>
              <button className="btn" onClick={scrollToPricing}>See pricing</button>
            </div>
            <p className="marketing-note">No credit card required during beta. Paid plans begin after setup is confirmed.</p>
          </div>

          <div className="marketing-product-preview" aria-label="Elara product preview">
            <div className="preview-window-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="preview-header">
              <div>
                <p className="metric-label">Portfolio health</p>
                <h2>Rental Operations</h2>
              </div>
              <div className="preview-status">Beta</div>
            </div>
            <div className="preview-metrics">
              <div>
                <p>Monthly revenue</p>
                <strong>$18,420</strong>
                <span className="text-success">On track</span>
              </div>
              <div>
                <p>Occupancy</p>
                <strong>94%</strong>
                <span>1 vacancy</span>
              </div>
              <div>
                <p>Lease risk</p>
                <strong>3</strong>
                <span>Expiring soon</span>
              </div>
            </div>
            <div className="preview-insight">
              <Sparkles size={17} />
              <p>One renewal is inside the 60-day window. Draft the letter and compare rent against market assumptions before contacting the tenant.</p>
            </div>
          </div>
        </section>

        <section className="social-proof-bar" aria-label="Launch focus">
          {launchProof.map((item) => (
            <div className="social-proof-item" key={item.label}>
              <div className="social-proof-value">{item.value}</div>
              <div className="social-proof-label">{item.label}</div>
            </div>
          ))}
        </section>

        <section id="fit" className="features-section">
          <div className="features-section-header">
            <h2>Built for the underserved middle of rental ownership</h2>
            <p>Elara is intentionally aimed below enterprise platforms and above a single spreadsheet.</p>
          </div>
          <div className="features-grid">
            {customerSegments.map((segment) => (
              <article className="feature-card" key={segment.title}>
                <div className="feature-card-icon">{segment.icon}</div>
                <h3>{segment.title}</h3>
                <p>{segment.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="product" className="features-section marketing-band">
          <div className="features-section-header">
            <h2>What early users can actually use today</h2>
            <p>Real product surface first, heavier integrations second.</p>
          </div>
          <div className="features-grid features-grid-2col">
            {featureGroups.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-card-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="pricing-section">
          <div className="features-section-header">
            <h2>Simple beta pricing</h2>
            <p>Plans are designed around the number of units an owner or operator needs to manage.</p>
          </div>
          <div className="pricing-grid">
            {pricingPlans.map((plan) => (
              <article className={`pricing-card${plan.featured ? ' pricing-card-featured' : ''}`} key={plan.name}>
                {plan.featured && <div className="pricing-badge">Best first plan</div>}
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <div className="pricing-price">
                  <span>{plan.price}</span>
                  <small>{plan.cadence}</small>
                </div>
                <ul>
                  {plan.details.map((detail) => (
                    <li key={detail}>
                      <Check size={15} />
                      {detail}
                    </li>
                  ))}
                </ul>
                <button className={`btn ${plan.featured ? 'btn-primary' : ''}`} onClick={onLoginClick}>{plan.cta}</button>
              </article>
            ))}
          </div>
          <p className="pricing-footnote">100+ units, hotel operations, short-term rental channel management, and custom data migration are handled as custom onboarding.</p>
        </section>

        <section className="trust-badges-row">
          <p className="trust-badges-label">Launch readiness focus</p>
          <div className="trust-badges">
            {trustItems.map((item) => (
              <div className="trust-badge" key={item}>
                <Check size={13} />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="home-cta-section">
          <h2>Get the first real portfolio into Elara</h2>
          <p>
            The next milestone is paid beta customers: onboard a real owner, import their data, prove weekly usefulness, then tighten the product around what they repeat.
          </p>
          <div className="marketing-hero-actions">
            <button className="btn btn-primary" onClick={onLoginClick}>
              Create workspace
              <ArrowRight size={16} />
            </button>
            <a className="btn" href="mailto:hello@elara.app?subject=Elara%20beta%20demo">Request guided setup</a>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div>
          <img src={elaraLogo} alt="" />
          <span>Elara</span>
        </div>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem', marginLeft: 'auto' }}>
          {onPrivacyClick && (
            <button onClick={onPrivacyClick} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
              Privacy Policy
            </button>
          )}
          {onTermsClick && (
            <button onClick={onTermsClick} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
              Terms of Service
            </button>
          )}
        </div>
        <p>© 2026 Elara. Beta product for rental portfolio operations. AI outputs should be reviewed before use.</p>
      </footer>
    </div>
  );
};

export default Home;
