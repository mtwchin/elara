import React from 'react';
import type { Theme } from '../theme';
import elaraLogo from '../assets/elara.jpg';

interface Props {
  onLoginClick: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const testimonials = [
  {
    quote:
      'Elara cut the time I spend on monthly reporting from two days down to about 20 minutes. The cap rate and cash-on-cash views are exactly what I need to stay on top of 38 units.',
    name: 'Marcus T.',
    title: 'Multifamily investor, 38 units — Austin, TX',
    initials: 'MT',
  },
  {
    quote:
      'I evaluated three platforms before choosing Elara. The deal analyzer alone paid for itself on the first acquisition. I passed on a property that looked great on paper but broke even at 94% occupancy.',
    name: 'Priya S.',
    title: 'RE syndicator, 12 properties — Phoenix, AZ',
    initials: 'PS',
  },
  {
    quote:
      "We manage properties for a family office with 60+ doors. Elara's Schedule E export saves our accountant hours every quarter. The AI alerts caught a lease expiration we would have missed entirely.",
    name: 'Jonathan R.',
    title: 'Asset manager, family office — Miami, FL',
    initials: 'JR',
  },
];

const features = [
  {
    color: 'rgba(59, 130, 246, 0.1)',
    colorVar: 'var(--accent-blue)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: 'AI-Powered Analytics',
    body: 'Machine learning models surface rent-raise opportunities, flag lease-expiration risks, and benchmark your portfolio against live market comps.',
  },
  {
    color: 'rgba(34, 197, 94, 0.1)',
    colorVar: 'var(--success)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'Real-Time Tracking',
    body: 'Monitor occupancy, cash flows, and maintenance requests across your entire portfolio from a single dashboard with live refresh.',
  },
  {
    color: 'rgba(147, 51, 234, 0.1)',
    colorVar: 'var(--accent-purple)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: 'Bank-Grade Security',
    body: 'End-to-end encryption, SOC 2 Type II compliance, and role-based access control protect your most sensitive financial data.',
  },
  {
    color: 'rgba(245, 158, 11, 0.1)',
    colorVar: 'var(--warning)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    title: 'Financial Calculators',
    body: 'Deal analyzer, mortgage amortization, pro forma projections, depreciation schedules, and refinance analyzer — all in one toolkit.',
  },
  {
    color: 'rgba(239, 68, 68, 0.1)',
    colorVar: 'var(--danger)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    title: 'Tax-Ready Exports',
    body: 'One-click Schedule E and rent roll exports formatted for your accountant. Depreciation tracking built for 27.5-year residential schedules.',
  },
  {
    color: 'rgba(59, 130, 246, 0.08)',
    colorVar: 'var(--accent-blue)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Tenant Management',
    body: 'Track leases, renewal intent, and rent payments across all tenants. Automated alerts surface expiring leases 90 days out.',
  },
];

const trustBadges = [
  { label: 'SOC 2 Type II' },
  { label: '256-bit AES Encryption' },
  { label: 'GDPR Compliant' },
  { label: 'Uptime SLA 99.9%' },
  { label: 'Daily Backups' },
];

const Home: React.FC<Props> = ({ onLoginClick, theme, onToggleTheme }) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <nav style={{
        padding: '1.5rem 3rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(249, 250, 251, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)'
      }}>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          aria-label="Back to top"
        >
          <img src={elaraLogo} alt="Elara" style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: "'EB Garamond', serif", fontWeight: 600 }}>Elara</h2>
        </button>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-secondary)' }} onClick={onLoginClick}>Sign In</button>
          <button className="btn btn-primary" onClick={onLoginClick}>Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="fade-in">
        <div style={{ textAlign: 'center', maxWidth: '820px', padding: '0 2rem', paddingTop: '6rem' }}>
          <div className="home-eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Now in private beta — 2,400 investors on the waitlist
          </div>
          <h1 className="text-gradient" style={{ fontSize: '4.5rem', marginBottom: '1.5rem', lineHeight: 1.05 }}>
            Manage Real Estate<br/>with Unfair Advantage.
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', marginBottom: '2.5rem', lineHeight: 1.7 }}>
            AI-driven insights, live market tracking, professional financial tools, and automated portfolio management — all in one incredibly fast platform.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.05rem' }} onClick={onLoginClick}>
              Create Workspace
            </button>
            <button className="btn" style={{ padding: '0.75rem 2rem', fontSize: '1.05rem' }} onClick={onLoginClick}>
              View Live Demo
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Free 14-day trial. No credit card required.
          </p>
        </div>

        {/* Social Proof Metrics Bar */}
        <div className="social-proof-bar" style={{ width: '100%', maxWidth: '1000px', marginTop: '4rem' }}>
          <div className="social-proof-item scroll-reveal">
            <div className="social-proof-value">$4.1B+</div>
            <div className="social-proof-label">Assets Under Management</div>
          </div>
          <div className="social-proof-item scroll-reveal">
            <div className="social-proof-value">18,400+</div>
            <div className="social-proof-label">Properties Tracked</div>
          </div>
          <div className="social-proof-item scroll-reveal">
            <div className="social-proof-value">99.9%</div>
            <div className="social-proof-label">Platform Uptime</div>
          </div>
          <div className="social-proof-item scroll-reveal">
            <div className="social-proof-value">4.9 / 5</div>
            <div className="social-proof-label">Investor Rating</div>
          </div>
          <div className="social-proof-item scroll-reveal">
            <div className="social-proof-value">62 hrs</div>
            <div className="social-proof-label">Avg. Time Saved / Year</div>
          </div>
        </div>

        {/* Feature Showcase — 6 cards */}
        <div className="features-section">
          <div className="features-section-header">
            <h2>Everything you need to scale</h2>
            <p style={{ maxWidth: '520px', margin: '0 auto', fontSize: '1.05rem' }}>
              Purpose-built tools for professional real estate investors — from your first door to your hundredth.
            </p>
          </div>
          <div className="features-grid features-grid-2col">
            {features.map((f, i) => (
              <div key={i} className="feature-card scroll-reveal">
                <div className="feature-card-icon" style={{ background: f.color, color: f.colorVar }}>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Demo UI Preview */}
        <div style={{ width: '100%', maxWidth: '1100px', padding: '0 2rem', perspective: '1000px', marginBottom: '2rem' }}>
          <div className="glass-panel" style={{
            transform: 'rotateX(5deg) scale(0.95)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.1)',
            padding: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontFamily: "'EB Garamond', serif" }}>Portfolio Overview</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }}></div>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></div>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div className="metric-label">Total Value</div>
                <div className="metric-value" style={{ fontSize: '1.75rem' }}>$14.2M</div>
                <div className="metric-trend text-success">+2.4% vs last month</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div className="metric-label">Monthly Rev</div>
                <div className="metric-value" style={{ fontSize: '1.75rem' }}>$124K</div>
                <div className="metric-trend text-success">+1.2% vs last month</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div className="metric-label">Avg Cap Rate</div>
                <div className="metric-value" style={{ fontSize: '1.75rem' }}>6.8%</div>
                <div className="metric-trend text-success">+0.3% vs last year</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div className="metric-label">Occupancy</div>
                <div className="metric-value" style={{ fontSize: '1.75rem' }}>97.2%</div>
                <div className="metric-trend text-success">3 units leased this month</div>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="testimonials-section">
          <div className="features-section-header" style={{ marginBottom: '3rem' }}>
            <h2>Trusted by serious investors</h2>
            <p style={{ maxWidth: '480px', margin: '0 auto' }}>
              From single-family landlords to family offices — here's what real users say.
            </p>
          </div>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <div key={i} className="testimonial-card scroll-reveal">
                <div className="testimonial-stars">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
                <blockquote className="testimonial-quote">"{t.quote}"</blockquote>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t.initials}</div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-title">{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="trust-badges-row">
          <p className="trust-badges-label">Security &amp; compliance</p>
          <div className="trust-badges">
            {trustBadges.map((b, i) => (
              <div key={i} className="trust-badge">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="home-cta-section">
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Ready to take control of your portfolio?
          </h2>
          <p style={{ fontSize: '1.05rem', maxWidth: '480px', margin: '0 auto 2rem' }}>
            Join 2,400+ investors already on the platform. Set up takes under 5 minutes.
          </p>
          <button className="btn btn-primary" style={{ padding: '0.875rem 2.5rem', fontSize: '1.1rem' }} onClick={onLoginClick}>
            Start Free Trial
          </button>
        </div>
      </main>

      <footer style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', borderTop: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <img src={elaraLogo} alt="Elara" style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }} />
          <span style={{ fontFamily: "'EB Garamond', serif", fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>Elara</span>
        </div>
        © 2026 Elara, Inc. All rights reserved.
      </footer>
    </div>
  );
};

export default Home;
