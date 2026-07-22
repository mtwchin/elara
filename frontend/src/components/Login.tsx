import React, { useState } from 'react';
import { login, register } from '../auth';
import elaraLogo from '../assets/elara.jpg';

interface Props {
  onAuthed: () => void;
  onBack?: () => void;
}

const Login: React.FC<Props> = ({ onAuthed, onBack }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
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
            style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontSize: '0.9rem', marginBottom: '1.25rem', display: 'block' }}
          >
            ← Back to Home
          </button>
        )}
        <img src={elaraLogo} alt="Elara" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'block' }} />
        <h1 className="text-gradient" style={{ margin: 0, marginBottom: '0.5rem' }}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          {mode === 'login' ? 'Welcome back to your portfolio.' : 'Spin up a new portfolio workspace.'}
        </p>

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
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 10 : 1}
              className="form-input"
            />
            {mode === 'register' && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Use at least 10 characters with uppercase, lowercase, and a number.
              </span>
            )}
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ padding: '0.65rem 1rem', marginTop: '0.5rem' }}>
            {busy ? 'Working…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <button onClick={() => { setMode('register'); setPassword('DemoPass1234'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0 }}>
                Register
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button onClick={() => { setMode('login'); setPassword('demo1234'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0 }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
