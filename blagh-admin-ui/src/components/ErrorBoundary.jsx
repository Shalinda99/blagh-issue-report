import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: 12,
          fontFamily: 'inherit', color: '#0f172a',
        }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: '#64748b', fontSize: 13 }}>{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8,
              background: '#1d4ed8', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
