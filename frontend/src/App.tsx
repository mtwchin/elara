import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Properties from './components/Properties';
import Tenants from './components/Tenants';
import Transactions from './components/Transactions';
import Financials from './components/Financials';
import Login from './components/Login';
import Home from './components/Home';
import { clearSession, getEmail, getToken } from './auth';

type View = 'dashboard' | 'properties' | 'tenants' | 'transactions' | 'financials';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [email, setEmail] = useState<string | null>(getEmail());
  const [showLogin, setShowLogin] = useState<boolean>(false);

  useEffect(() => {
    const handler = () => {
      setAuthed(false);
      setEmail(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const handleLogout = () => {
    clearSession();
    setAuthed(false);
    setEmail(null);
  };

  if (!authed) {
    if (showLogin) {
      return (
        <Login
          onAuthed={() => {
            setAuthed(true);
            setEmail(getEmail());
            setShowLogin(false);
          }}
        />
      );
    }
    return <Home onLoginClick={() => setShowLogin(true)} />;
  }

  const navBtn = (view: View, label: string) => (
    <button
      className="btn"
      style={{
        background: currentView === view ? 'var(--bg-secondary)' : 'transparent',
        border: currentView === view ? '1px solid var(--glass-border)' : '1px solid transparent',
        boxShadow: currentView === view ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
      }}
      onClick={() => setCurrentView(view)}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'center', position: 'sticky', top: '1rem', zIndex: 50 }}>
        <nav style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '999px',
          boxShadow: 'var(--glass-inner-glow), 0 8px 32px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.5rem 1.5rem',
          maxWidth: 'fit-content'
        }}>
          <h2 style={{ margin: 0, marginRight: '1rem', fontSize: '1.25rem', fontFamily: "'EB Garamond', serif" }} className="text-gradient">RE Portfolio</h2>
          {navBtn('dashboard', 'Dashboard')}
          {navBtn('properties', 'Properties')}
          {navBtn('tenants', 'Tenants')}
          {navBtn('transactions', 'Transactions')}
          {navBtn('financials', 'Financials')}
          <div style={{ marginLeft: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px solid var(--glass-border)', paddingLeft: '1rem' }}>
            {email && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{email}</span>}
            <button className="btn" style={{ padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.8rem' }} onClick={handleLogout}>Logout</button>
          </div>
        </nav>
      </div>

      <main style={{ flex: 1, marginTop: '2rem' }}>
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'properties' && <Properties />}
        {currentView === 'tenants' && <Tenants />}
        {currentView === 'transactions' && <Transactions />}
        {currentView === 'financials' && <Financials />}
      </main>
    </div>
  );
}

export default App;
