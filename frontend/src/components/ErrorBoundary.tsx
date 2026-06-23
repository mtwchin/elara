import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * Catches render-time errors in the component tree and shows a friendly
 * fallback instead of a blank white screen. Resets when the user clicks
 * "Reload" (full page reload clears transient state).
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface in the console for debugging; a real backend log sink could go here.
    console.error('Render error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container fade-in">
          <div
            className="glass-panel"
            style={{ textAlign: 'center', maxWidth: '600px', margin: '4rem auto' }}
          >
            <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              An unexpected error occurred while rendering this view.
            </p>
            {this.state.message && (
              <pre
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '1.5rem',
                }}
              >
                {this.state.message}
              </pre>
            )}
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
