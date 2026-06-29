import React, { useState, useEffect, useRef } from 'react';
import { authFetch, authUpload } from '../auth';

interface Transaction {
  id: number;
  propertyId: number;
  date: string;
  property: string;
  type: string;
  category: string;
  amount: number;
  status: string;
  documentCount: number;
}

interface PropertyOption {
  id: number;
  address: string;
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Form state
  const [date, setDate] = useState('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [type, setType] = useState('Income');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('Paid');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/transactions');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    authFetch('/api/properties')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PropertyOption[]) => setProperties(data))
      .catch((err) => console.error('Failed to load properties for dropdown', err));
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) {
      alert('Please select a property.');
      return;
    }
    const newTx = {
      date,
      property_id: parseInt(propertyId, 10),
      type,
      category,
      amount: parseFloat(amount),
      status,
    };

    try {
      const res = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(newTx),
      });
      if (!res.ok) throw new Error('Failed to add transaction');
      const created: Transaction = await res.json();

      // Upload file if one was selected
      const file = fileInputRef.current?.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await authUpload(`/api/transactions/${created.id}/documents`, formData);
        if (!uploadRes.ok) {
          const errBody = await uploadRes.json().catch(() => ({ detail: 'Upload failed' }));
          alert('Transaction saved but file upload failed: ' + (errBody.detail || 'Unknown error'));
        }
      }

      // Reset form
      setDate('');
      setPropertyId('');
      setType('Income');
      setCategory('');
      setAmount('');
      setStatus('Paid');
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchTransactions();
    } catch (err: unknown) {
      alert('Error adding transaction: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSyncBank = async () => {
    setSyncing(true);
    try {
      const res = await authFetch('/api/bank/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync bank');
      const data = await res.json();
      alert(`Bank sync complete: ${data.message || 'New transactions loaded.'}`);
      fetchTransactions();
    } catch (err: unknown) {
      alert('Error syncing bank: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="app-container">
        <div className="loading-container fade-in">Loading Transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container fade-in">
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '600px', margin: '4rem auto' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const statusBadge = (s: string) => {
    const variant = s === 'Paid' ? 'badge-success' : 'badge-warning';
    return <span className={`badge ${variant}`}>{s}</span>;
  };

  const typeBadge = (t: string) => {
    const variant = t === 'Income' ? 'badge-success' : 'badge-danger';
    return <span className={`badge ${variant}`}>{t}</span>;
  };

  const filteredTransactions = transactions.filter((tx) =>
    [tx.property, tx.category, tx.type, tx.status].some((v) =>
      (v || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="app-container fade-in">
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="text-gradient">Transactions</h1>
          <p>Ledger and financial records.</p>
        </div>
        <div className="page-header-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleSyncBank}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Bank (Mock)'}
          </button>
          <input
            type="text"
            className="form-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px' }}
          />
        </div>
      </div>

      {search.length > 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Showing {filteredTransactions.length} of {transactions.length}
        </p>
      )}

      {/* Transaction form */}
      <div className="glass-panel-static page-content">
        <h3 style={{ marginBottom: '1rem' }}>Log New Transaction</h3>
        <form onSubmit={handleAddTransaction} className="form-inline">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Property</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required className="form-input">
              <option value="">Select a property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.address}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="form-input">
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input
              type="text"
              placeholder="e.g. Rent, Maintenance"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input">
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Attach Receipt (optional)</label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.png,.jpg,.jpeg"
              className="form-input"
              style={{ paddingTop: '0.4rem' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>
            Add Transaction
          </button>
        </form>
      </div>

      {/* Transactions table */}
      <div className="glass-panel-static" style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Property</th>
              <th>Type</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Docs</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.property}</td>
                <td>{typeBadge(tx.type)}</td>
                <td>{tx.category}</td>
                <td style={{ fontWeight: 500 }}>
                  ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>{statusBadge(tx.status)}</td>
                <td>
                  <span
                    title={`${tx.documentCount} document${tx.documentCount !== 1 ? 's' : ''}`}
                    style={{ color: tx.documentCount > 0 ? 'var(--accent-purple)' : 'var(--text-secondary)', fontSize: '0.85rem' }}
                  >
                    {tx.documentCount > 0 ? tx.documentCount : '—'}
                  </span>
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <h3>{search.length > 0 ? 'No transactions match your search' : 'No transactions yet'}</h3>
                    <p>{search.length > 0 ? 'Try a different search term.' : 'Log your first transaction using the form above.'}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Transactions;
