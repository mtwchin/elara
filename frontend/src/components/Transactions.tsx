import React, { useState, useEffect } from 'react';
import { authFetch } from '../auth';

interface Transaction {
  id: number;
  propertyId: number;
  date: string;
  property: string;
  type: string;
  category: string;
  amount: number;
  status: string;
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

  // Form state
  const [date, setDate] = useState('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [type, setType] = useState('Income');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('Paid');

  const fetchTransactions = () => {
    setLoading(true);
    authFetch('/api/transactions')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch transactions');
        return res.json();
      })
      .then((data: Transaction[]) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTransactions();
    authFetch('/api/properties')
      .then((res) => res.ok ? res.json() : [])
      .then((data: PropertyOption[]) => setProperties(data))
      .catch((err) => console.error('Failed to load properties for dropdown', err));
  }, []);

  const handleAddTransaction = (e: React.FormEvent) => {
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
      status
    };

    authFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(newTx)
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to add transaction');
        fetchTransactions();
        setDate('');
        setPropertyId('');
        setType('Income');
        setCategory('');
        setAmount('');
        setStatus('Paid');
      })
      .catch((err) => {
        console.error(err);
        alert('Error adding transaction: ' + err.message);
      });
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="app-container fade-in">
        <div style={{ padding: '2rem' }}><h2>Loading Transactions...</h2></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container fade-in">
        <div style={{ padding: '2rem', color: 'var(--danger)' }}>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container fade-in">
      <header>
        <div>
          <h1 className="text-gradient">Transactions</h1>
          <p>Ledger and financial records.</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="glass-panel" style={{ gridColumn: 'span 12', overflowX: 'auto' }}>
          <h3>Log New Transaction</h3>
          <form onSubmit={handleAddTransaction} style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Property</label>
              <select value={propertyId} onChange={e => setPropertyId(e.target.value)} required style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white' }}>
                <option value="">Select a property...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.address}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white' }}>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Category</label>
              <input type="text" placeholder="e.g. Rent, Maintenance" value={category} onChange={e => setCategory(e.target.value)} required style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Amount</label>
              <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white' }}>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', height: '37px' }}>Add Transaction</button>
          </form>
        </div>

        <div className="glass-panel" style={{ gridColumn: 'span 12', overflowX: 'auto', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Date</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Property</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Type</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Category</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Amount</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={{ transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{tx.date}</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{tx.property}</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ color: tx.type === 'Income' ? 'var(--success)' : 'var(--danger)' }}>{tx.type}</span>
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>{tx.category}</td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                    ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '999px', 
                      fontSize: '0.85rem',
                      background: tx.status === 'Paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: tx.status === 'Paid' ? 'var(--success)' : 'var(--warning)'
                    }}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
