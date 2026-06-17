import React, { useState } from 'react';
import { login, register } from '../auth';

interface Props {
  onAuthed: () => void;
}

const Login: React.FC<Props> = ({ onAuthed }) => {
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: 420, padding: '2.5rem' }}>
        <h1 className="text-gradient" style={{ margin: 0, marginBottom: '0.5rem' }}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
          {mode === 'login'
            ? 'Welcome back to your portfolio.'
            : 'Spin up a new portfolio workspace.'}
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
              style={{ padding: '0.6rem', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
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
              minLength={6}
              style={{ padding: '0.6rem', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ padding: '0.65rem 1rem', marginTop: '0.5rem' }}>
            {busy ? 'Working…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <button onClick={() => { setMode('register'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: 0 }}>
                Register
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button onClick={() => { setMode('login'); setError(null); }} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: 0 }}>
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
