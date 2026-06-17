import React from 'react';

interface Props {
  onLoginClick: () => void;
}

const Home: React.FC<Props> = ({ onLoginClick }) => {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--text-primary)', borderRadius: '6px' }}></div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: "'EB Garamond', serif", fontWeight: 600 }}>RE Portfolio</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }} onClick={onLoginClick}>Sign In</button>
          <button className="btn btn-primary" onClick={onLoginClick}>Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '6rem', paddingBottom: '4rem' }} className="fade-in">
        <div style={{ textAlign: 'center', maxWidth: '800px', padding: '0 2rem' }}>
          <h1 className="text-gradient" style={{ fontSize: '4.5rem', marginBottom: '1.5rem' }}>
            Manage Real Estate<br/>with Unfair Advantage.
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', marginBottom: '3rem' }}>
            AI-driven insights, live market tracking, and automated property management—all in one incredibly fast platform.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.05rem' }} onClick={onLoginClick}>
              Create Workspace
            </button>
            <button className="btn" style={{ padding: '0.75rem 2rem', fontSize: '1.05rem' }} onClick={onLoginClick}>
              View Live Demo
            </button>
          </div>
        </div>

        {/* Demo UI Preview */}
        <div style={{ marginTop: '5rem', width: '100%', maxWidth: '1100px', padding: '0 2rem', perspective: '1000px' }}>
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
                <div className="metric-trend text-success">↑ 2.4%</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div className="metric-label">Monthly Rev</div>
                <div className="metric-value" style={{ fontSize: '1.75rem' }}>$124K</div>
                <div className="metric-trend text-success">↑ 1.2%</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', gridColumn: 'span 2' }}>
                <div className="metric-label">AI Alert</div>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', padding: '0.5rem', borderRadius: '8px' }}>✓</div>
                  <div>
                    <strong style={{ display: 'block' }}>Optimal Pricing Found</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Raise Unit 402 by $150 based on comps.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', borderTop: '1px solid var(--glass-border)' }}>
        © 2026 RE Portfolio. All rights reserved.
      </footer>
    </div>
  );
};

export default Home;
