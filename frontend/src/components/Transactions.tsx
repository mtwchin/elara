import React, { useState, useEffect, useRef } from 'react';
import { authFetch, authUpload } from '../auth';
import type { PropertyOption } from '../types';
import { notify } from '../toast';
import Modal from './ui/Modal';

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
  description: string | null;
}

interface TxDocument {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number | null;
  uploadedAt: string | null;
}

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [docModalTxId, setDocModalTxId] = useState<number | null>(null);
  const [docModalDocs, setDocModalDocs] = useState<TxDocument[]>([]);
  const [docModalLoading, setDocModalLoading] = useState(false);

  const [date, setDate] = useState('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [type, setType] = useState('Income');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Paid');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);

  const [categorizing, setCategorizing] = useState(false);
  const [categorizeProgress, setCategorizeProgress] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/transactions?limit=500');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.items ?? data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await authFetch('/api/transactions/export.csv');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success('CSV downloaded');
    } catch (err: unknown) {
      notify.error('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const openDocModal = async (txId: number) => {
    setDocModalTxId(txId);
    setDocModalDocs([]);
    setDocModalLoading(true);
    try {
      const res = await authFetch(`/api/transactions/${txId}/documents`);
      if (res.ok) setDocModalDocs(await res.json());
    } finally {
      setDocModalLoading(false);
    }
  };

  const downloadDoc = async (docId: number, filename: string) => {
    try {
      const res = await authFetch(`/api/documents/${docId}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      notify.error('Download failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    fetchTransactions();
    authFetch('/api/properties?limit=500')
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setProperties(data.items ?? data))
      .catch((err) => console.error('Failed to load properties for dropdown', err));
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) {
      notify.warning('Please select a property.');
      return;
    }
    const newTx = {
      date, property_id: parseInt(propertyId, 10), type, category,
      amount: parseFloat(amount), description: description || null, status,
    };
    try {
      const res = await authFetch('/api/transactions', { method: 'POST', body: JSON.stringify(newTx) });
      if (!res.ok) throw new Error('Failed to add transaction');
      const created: Transaction = await res.json();

      const file = fileInputRef.current?.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await authUpload(`/api/transactions/${created.id}/documents`, formData);
        if (!uploadRes.ok) {
          const errBody = await uploadRes.json().catch(() => ({ detail: 'Upload failed' }));
          notify.warning('Transaction saved but file upload failed: ' + (errBody.detail || 'Unknown error'));
        }
      }

      setDate(''); setPropertyId(''); setType('Income'); setCategory('');
      setAmount(''); setDescription(''); setStatus('Paid');
      if (fileInputRef.current) fileInputRef.current.value = '';
      notify.success('Transaction logged');
      fetchTransactions();
    } catch (err: unknown) {
      notify.error('Error adding transaction: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSyncBank = async () => {
    setSyncing(true);
    try {
      const res = await authFetch('/api/bank/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync bank');
      const data = await res.json();
      notify.success(`Bank sync complete: ${data.message || 'New transactions loaded.'}`);
      fetchTransactions();
    } catch (err: unknown) {
      notify.error('Error syncing bank: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleAutoCategorize = async () => {
    const uncategorized = transactions.filter((tx) => !tx.category || tx.category === 'Other');
    if (uncategorized.length === 0) {
      notify.info('No uncategorized transactions found.');
      return;
    }

    setCategorizing(true);
    let updated = 0;

    for (let i = 0; i < uncategorized.length; i++) {
      const tx = uncategorized[i];
      setCategorizeProgress(`Categorizing ${i + 1} of ${uncategorized.length}…`);
      try {
        const res = await authFetch('/api/agents/categorize-transaction', {
          method: 'POST',
          body: JSON.stringify({ description: tx.description || tx.category || '', amount: tx.amount, property_id: tx.propertyId }),
        });
        if (!res.ok) continue;
        const result: { category: string; confidence: number; reasoning: string } = await res.json();
        if (result.confidence > 0.6 && result.category && result.category !== 'Other') {
          const putRes = await authFetch(`/api/transactions/${tx.id}`, {
            method: 'PUT', body: JSON.stringify({ category: result.category }),
          });
          if (putRes.ok) updated++;
        }
      } catch { /* non-fatal */ }
    }

    setCategorizing(false);
    setCategorizeProgress(null);
    notify.success(`Done. Updated ${updated} of ${uncategorized.length} transactions.`);
    fetchTransactions();
  };

  if (loading && transactions.length === 0) {
    return <div className="app-container"><div className="loading-container fade-in">Loading Transactions...</div></div>;
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

  const statusBadge = (s: string) => <span className={`badge ${s === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{s}</span>;
  const typeBadge = (t: string) => <span className={`badge ${t === 'Income' ? 'badge-success' : 'badge-danger'}`}>{t}</span>;

  const filteredTransactions = transactions.filter((tx) =>
    [tx.property, tx.category, tx.type, tx.status, tx.description].some((v) =>
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
          <button className="btn" onClick={handleAutoCategorize} disabled={categorizing} title="Use AI to classify uncategorized transactions">
            {categorizing ? (categorizeProgress || 'Categorizing…') : 'Auto-Categorize'}
          </button>
          <button className="btn" onClick={handleExportCsv} title="Download all transactions as CSV">Export CSV</button>
          <button className="btn btn-primary" onClick={handleSyncBank} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Bank (Mock)'}
          </button>
          <input type="text" className="form-input" placeholder="Search..." value={search}
            onChange={(e) => setSearch(e.target.value)} style={{ width: '220px' }} />
        </div>
      </div>

      {search.length > 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Showing {filteredTransactions.length} of {transactions.length}
        </p>
      )}

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
              {properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}
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
            <input type="text" placeholder="e.g. Rent, Maintenance" value={category}
              onChange={(e) => setCategory(e.target.value)} required className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Amount</label>
            <input type="number" step="0.01" placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)} required className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input type="text" placeholder="Optional note" value={description}
              onChange={(e) => setDescription(e.target.value)} className="form-input" />
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
            <input type="file" ref={fileInputRef} accept=".pdf,.png,.jpg,.jpeg"
              className="form-input" style={{ paddingTop: '0.4rem' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '40px' }}>Add Transaction</button>
        </form>
      </div>

      <div className="glass-panel-static" style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Property</th><th>Type</th><th>Category</th>
              <th>Amount</th><th>Status</th><th>Docs</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.property}</td>
                <td>{typeBadge(tx.type)}</td>
                <td>
                  <span title={tx.description || undefined}>{tx.category}</span>
                  {tx.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      {tx.description.length > 50 ? tx.description.slice(0, 50) + '…' : tx.description}
                    </div>
                  )}
                </td>
                <td style={{ fontWeight: 500 }}>
                  ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>{statusBadge(tx.status)}</td>
                <td>
                  {tx.documentCount > 0 ? (
                    <button className="btn" onClick={() => openDocModal(tx.id)}
                      title={`View ${tx.documentCount} document${tx.documentCount !== 1 ? 's' : ''}`}
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: 'var(--accent-purple)' }}>
                      {tx.documentCount}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>
                  )}
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

      <Modal open={docModalTxId !== null} onClose={() => setDocModalTxId(null)} title="Documents" maxWidth={480}>
        {docModalLoading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : docModalDocs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No documents found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {docModalDocs.map((doc) => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-tertiary)', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                  {doc.sizeBytes && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(doc.sizeBytes / 1024).toFixed(1)} KB</div>}
                </div>
                <button className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', flexShrink: 0 }}
                  onClick={() => downloadDoc(doc.id, doc.filename)}>Download</button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transactions;
