import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';
import { notify } from '../toast';
import { X, Mail, AlertCircle } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  sent_at: string;
  expires_at: string;
  status: string;
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'team'>('team');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Member' | 'Admin'>('Member');
  const [inviting, setInviting] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/invitations');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to fetch invitations');
      }
      const data = await res.json();
      setInvitations(Array.isArray(data) ? data : data.invitations || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch invitations';
      setError(msg);
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      notify.error('Email is required');
      return;
    }

    setInviting(true);
    try {
      const res = await authFetch('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Failed to send invitation' }));
        throw new Error(data.detail || 'Failed to send invitation');
      }

      notify.success('Invitation sent');
      setInviteEmail('');
      setInviteRole('Member');
      await fetchInvitations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      notify.error(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;

    try {
      const res = await authFetch(`/api/invitations/${inviteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: 'Failed to revoke invitation' }));
        throw new Error(data.detail || 'Failed to revoke invitation');
      }

      notify.success('Invitation revoked');
      await fetchInvitations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke invitation';
      notify.error(msg);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 className="text-gradient" style={{ marginBottom: '0.5rem' }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Manage your account and team.</p>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('team')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0',
            fontSize: '1rem',
            color: activeTab === 'team' ? 'var(--brand-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderBottom: activeTab === 'team' ? '2px solid var(--brand-primary)' : 'none',
            fontWeight: activeTab === 'team' ? 600 : 400,
            transition: 'all 0.2s ease',
          }}
        >
          Team
        </button>
      </div>

      {activeTab === 'team' && (
        <div style={{ display: 'grid', gap: '3rem' }}>
          <section className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={20} />
              Invite a team member
            </h2>

            <form onSubmit={handleSendInvite} style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px auto', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="form-input"
                    disabled={inviting}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'Member' | 'Admin')}
                    className="form-input"
                    disabled={inviting}
                  >
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={inviting}
                  style={{ padding: '0.65rem 1.5rem', whiteSpace: 'nowrap' }}
                >
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                They'll receive an email with a link to set up their account. Invitations expire in 7 days.
              </p>
            </form>
          </section>

          <section className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={20} />
              Pending invitations
            </h2>

            {loading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading invitations…</p>
            ) : error ? (
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            ) : invitations.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No pending invitations.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Role</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sent</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Expires</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{inv.email}</td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>
                          <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', fontSize: '0.8rem', fontWeight: 500 }}>
                            {inv.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {formatDate(inv.sent_at)} {formatTime(inv.sent_at)}
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {formatDate(inv.expires_at)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <X size={16} />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Settings;
