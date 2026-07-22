import React, { useState } from 'react';
import { setSession } from '../auth';
import { notify } from '../toast';
import { ArrowLeft } from 'lucide-react';
import elaraLogo from '../assets/elara.jpg';

interface Props {
  onBack?: () => void;
}

const AcceptInvite: React.FC<Props> = ({ onBack }) => {
  const queryParams = new URLSearchParams(window.location.search);
  const token = queryParams.get('token');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: 420, padding: '2.5rem', textAlign: 'center' }}>
          <img src={elaraLogo} alt="Elara" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'block', margin: '0 auto 1.5rem' }} />
          <h1 className="text-gradient" style={{ margin: 0, marginBottom: '0.5rem' }}>Invalid Invite Link</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '1.5rem' }}>
            This invitation link is missing or invalid. Please contact your team admin for a new invite.
          </p>
          <button className="btn btn-primary" onClick={() => { window.location.href = '/'; }} style={{ padding: '0.65rem 1rem' }}>
            Go to login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      });

      if (res.status === 400) {
        throw new Error('This invite has expired or already been used');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Failed to accept invitation' }));
        throw new Error(data.detail || 'Failed to accept invitation');
      }

      const data = await res.json();
      setSession(data.access_token, data.email, data.account_type);
      window.location.href = '/';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation';
      setError(msg);
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: 420, padding: '2.5rem' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        <img src={elaraLogo} alt="Elara" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'block' }} />
        <h1 className="text-gradient" style={{ margin: 0, marginBottom: '0.5rem' }}>Create Your Account</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          Accept your team invitation and set up your account.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="form-input"
              disabled={busy}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={10}
              className="form-input"
              disabled={busy}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              At least 10 characters with uppercase, lowercase, and a number.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={10}
              className="form-input"
              disabled={busy}
            />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ padding: '0.65rem 1rem', marginTop: '0.5rem' }}>
            {busy ? 'Setting up…' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Already have an account?{' '}
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default AcceptInvite;
