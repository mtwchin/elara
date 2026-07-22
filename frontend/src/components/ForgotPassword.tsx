import React, { useState } from 'react';
import elaraLogo from '../assets/elara.jpg';
import { API_BASE } from '../auth';
import { notify } from '../toast';

interface Props {
  onBack: () => void;
}

const ForgotPassword: React.FC<Props> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(err.detail || 'Request failed');
      }
      setSubmitted(true);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: 420, padding: '2.5rem' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontSize: '0.9rem', marginBottom: '1.25rem', display: 'block' }}
        >
          ← Back to login
        </button>

        <img
          src={elaraLogo}
          alt="Elara"
          style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'block' }}
        />

        <h1 className="text-gradient" style={{ margin: 0, marginBottom: '0.5rem' }}>
          Reset your password
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          Enter your email and we'll send you a reset link.
        </p>

        {submitted ? (
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'var(--brand-primary-soft)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.5rem' }}>
              Check your email for a reset link
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              If an account exists for <strong>{email}</strong>, you'll receive instructions shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="form-input"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              style={{ padding: '0.65rem 1rem', marginTop: '0.5rem', width: '100%' }}
            >
              {busy ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
