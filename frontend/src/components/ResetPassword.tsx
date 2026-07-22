import React, { useState } from 'react';
import elaraLogo from '../assets/elara.jpg';
import { API_BASE } from '../auth';
import { notify } from '../toast';

interface Props {
  onBack: () => void;
}

const ResetPassword: React.FC<Props> = ({ onBack }) => {
  const token = new URLSearchParams(window.location.search).get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [matchError, setMatchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: 420, padding: '2.5rem', textAlign: 'center' }}>
          <img
            src={elaraLogo}
            alt="Elara"
            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'block', margin: '0 auto 1.5rem' }}
          />
          <h1 className="text-gradient" style={{ margin: '0 0 0.75rem' }}>Invalid reset link</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            This password reset link is missing or malformed.
          </p>
          <button
            onClick={onBack}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.5rem' }}
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError(null);
    setServerError(null);

    if (newPassword !== confirmPassword) {
      setMatchError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      if (!res.ok) {
        if (res.status === 400) {
          setServerError('This link has expired or already been used.');
        } else {
          const err = await res.json().catch(() => ({ detail: 'Reset failed' }));
          throw new Error(err.detail || 'Reset failed');
        }
        return;
      }
      setSucceeded(true);
      notify.success('Password updated successfully');
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
          Choose a new password
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          Create a strong password for your account.
        </p>

        {succeeded ? (
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.5rem' }}>
              Password updated
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Your password has been changed. You can now sign in with your new credentials.
            </p>
            <button
              onClick={onBack}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.5rem' }}
            >
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={10}
                className="form-input"
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                10+ characters, upper and lowercase, at least one number.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setMatchError(null); }}
                required
                autoComplete="new-password"
                className="form-input"
              />
              {matchError && (
                <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{matchError}</span>
              )}
            </div>

            {serverError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{serverError}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              style={{ padding: '0.65rem 1rem', marginTop: '0.5rem', width: '100%' }}
            >
              {busy ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
