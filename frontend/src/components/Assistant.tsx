import React, { useState, useRef, useEffect } from 'react';
import { authFetch } from '../auth';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  toolsUsed?: string[];
}

const SUGGESTIONS = [
  'Which property has the highest cash flow this year?',
  'Which tenants have leases expiring soon?',
  'What is my current occupancy rate and monthly revenue?',
  'Show me a breakdown of income vs expenses by property.',
];

const ToolPill: React.FC<{ name: string }> = ({ name }) => (
  <span
    style={{
      display: 'inline-block',
      fontSize: '0.7rem',
      padding: '2px 8px',
      borderRadius: '999px',
      background: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--glass-border)',
      marginRight: '4px',
      marginTop: '4px',
    }}
  >
    {name.replace(/_/g, ' ')}
  </span>
);

const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '1rem',
        gap: '0.625rem',
        alignItems: 'flex-start',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-purple), #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '0.8rem',
            color: '#fff',
            fontWeight: 700,
          }}
        >
          E
        </div>
      )}
      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            background: isUser
              ? 'linear-gradient(135deg, var(--accent-purple), #6366f1)'
              : 'var(--bg-secondary)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            fontSize: '0.9rem',
            lineHeight: 1.55,
            border: isUser ? 'none' : '1px solid var(--glass-border)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {msg.content}
        </div>
        {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <div style={{ marginTop: '6px', paddingLeft: '4px' }}>
            {msg.toolsUsed.map((t) => (
              <ToolPill key={t} name={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ThinkingIndicator: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '1rem' }}>
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent-purple), #6366f1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '0.8rem',
        color: '#fff',
        fontWeight: 700,
      }}
    >
      E
    </div>
    <div
      style={{
        padding: '0.75rem 1rem',
        borderRadius: '18px 18px 18px 4px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--glass-border)',
        display: 'flex',
        gap: '5px',
        alignItems: 'center',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--text-secondary)',
            animation: 'thinking-pulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  </div>
);

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    // Build history excluding the message we just appended (send prior turns only)
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await authFetch('/api/agents/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(errData.detail || `Error ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: 'model',
        content: data.reply,
        toolsUsed: data.tools_used || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="app-container fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <style>{`
        @keyframes thinking-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.25); }
        }
      `}</style>

      <div className="page-header" style={{ flexShrink: 0 }}>
        <div className="page-header-info">
          <h1 className="text-gradient">AI Assistant</h1>
          <p>Ask questions about your portfolio — Elara queries live data to answer.</p>
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          borderRadius: '16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isEmpty && !loading && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '2rem 1rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-purple), #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                color: '#fff',
                fontWeight: 700,
                margin: '0 auto 1rem',
              }}
            >
              E
            </div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Ask Elara anything</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Elara pulls real data from your portfolio to answer your questions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="btn"
                  style={{ fontSize: '0.825rem', padding: '0.5rem 1rem', borderRadius: '999px', textAlign: 'left' }}
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && <ThinkingIndicator />}

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--danger)',
              fontSize: '0.875rem',
              marginBottom: '0.5rem',
            }}
          >
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '0.75rem',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          placeholder="Ask about your portfolio..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          style={{ flex: 1, borderRadius: '999px', padding: '0.6rem 1.25rem' }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !input.trim()}
          style={{ borderRadius: '999px', padding: '0.6rem 1.5rem', flexShrink: 0 }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Assistant;
