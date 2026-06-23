import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Properties from './components/Properties';
import Tenants from './components/Tenants';
import Transactions from './components/Transactions';
import Financials from './components/Financials';
import Tools from './components/Tools';
import Calendar from './components/Calendar';
import Maintenance from './components/Maintenance';
import TenantPortal from './components/TenantPortal';
import Login from './components/Login';
import Home from './components/Home';
import { clearSession, getEmail, getToken, getAccountType } from './auth';
import { getStoredTheme, applyTheme } from './theme';
import type { Theme } from './theme';
import elaraLogo from './assets/elara.jpg';

type View = 'dashboard' | 'properties' | 'tenants' | 'transactions' | 'financials' | 'tools' | 'calendar' | 'maintenance' | 'tenant-portal';

function App() {
  const [accountType, setAccountType] = useState<string | null>(getAccountType());
  const [currentView, setCurrentView] = useState<View>(() => getAccountType() === 'tenant' ? 'tenant-portal' : 'dashboard');
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [email, setEmail] = useState<string | null>(getEmail());
  const [showLogin, setShowLogin] = useState<boolean>(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const t = getStoredTheme();
    applyTheme(t);
    return t;
  });

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  useEffect(() => {
    const handler = () => {
      setAuthed(false);
      setEmail(null);
      setAccountType(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const handleLogout = () => {
    clearSession();
    setAuthed(false);
    setEmail(null);
    setAccountType(null);
  };

  if (!authed) {
    if (showLogin) {
      return (
        <Login
          onAuthed={() => {
            setAuthed(true);
            setEmail(getEmail());
            const accType = getAccountType();
            setAccountType(accType);
            setCurrentView(accType === 'tenant' ? 'tenant-portal' : 'dashboard');
            setShowLogin(false);
          }}
          onBack={() => setShowLogin(false)}
        />
      );
    }
    return <Home onLoginClick={() => setShowLogin(true)} theme={theme} onToggleTheme={toggleTheme} />;
  }

  const adminNavItems: { view: View; label: string }[] = [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'properties', label: 'Properties' },
    { view: 'tenants', label: 'Tenants' },
    { view: 'transactions', label: 'Transactions' },
    { view: 'financials', label: 'Financials' },
    { view: 'maintenance', label: 'Maintenance' },
    { view: 'tools', label: 'Tools' },
    { view: 'calendar', label: 'Calendar' },
  ];

  const tenantNavItems: { view: View; label: string }[] = [
    { view: 'tenant-portal', label: 'Tenant Portal' },
  ];

  const navItems = accountType === 'tenant' ? tenantNavItems : adminNavItems;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '1rem' }}>
      <div className="app-nav-wrapper">
        <nav className="app-nav">
          <button
            onClick={() => setCurrentView(accountType === 'tenant' ? 'tenant-portal' : 'dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="Go to home"
          >
            <img src={elaraLogo} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />
            <h2 className="app-nav-brand text-gradient">Elara</h2>
          </button>
          {navItems.map(({ view, label }) => (
            <button
              key={view}
              className={`nav-btn${currentView === view ? ' active' : ''}`}
              onClick={() => setCurrentView(view)}
            >
              {label}
            </button>
          ))}
          <div className="app-nav-divider">
            <button
              onClick={toggleTheme}
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
            {email && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{email}</span>}
            <button className="btn" style={{ padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.8rem' }} onClick={handleLogout}>Logout</button>
          </div>
        </nav>
      </div>

      <main className="view-transition" key={currentView} style={{ flex: 1, marginTop: '2rem' }}>
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'properties' && <Properties />}
        {currentView === 'tenants' && <Tenants />}
        {currentView === 'transactions' && <Transactions />}
        {currentView === 'financials' && <Financials />}
        {currentView === 'tools' && <Tools />}
        {currentView === 'calendar' && <Calendar />}
        {currentView === 'maintenance' && <Maintenance />}
        {currentView === 'tenant-portal' && <TenantPortal />}
      </main>
    </div>
  );
}

export default App;
