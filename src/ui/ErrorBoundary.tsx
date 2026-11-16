import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 'screen' fills the app; 'page' covers it like an open page so the tabs underneath keep working. */
  variant?: 'screen' | 'page';
  onClose?: () => void;
}

/**
 * Catches errors thrown while drawing a screen (including failed reads from on-device storage,
 * which some phone browsers produce after the app has been in the background) and shows what
 * happened instead of leaving a blank screen.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false };

  static getDerivedStateFromError(error: Error) {
    return { error, copied: false };
  }

  private details(): string {
    const e = this.state.error;
    return [`${e?.name ?? 'Error'}: ${e?.message ?? 'unknown'}`, (e?.stack ?? '').split('\n').slice(0, 6).join('\n'), navigator.userAgent].join('\n');
  }

  private copy = async () => {
    try {
      await navigator.clipboard.writeText(this.details());
      this.setState({ copied: true });
    } catch {
      // Clipboard access can be refused; the details are also shown on screen to select by hand.
    }
  };

  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    const storage = /indexed ?db|database|backing store|quota|idb/i.test(`${error.name} ${error.message}`);
    return (
      <div className={this.props.variant === 'page' ? 'page' : 'onb'} role="alert">
        <div className={this.props.variant === 'page' ? 'page-body' : 'stack'} style={{ paddingTop: this.props.variant === 'page' ? 'calc(env(safe-area-inset-top, 0px) + 24px)' : undefined }}>
          <h1 style={{ font: '700 24px/1.15 var(--display)' }}>Something went wrong on this screen</h1>
          <p className="lede" style={{ color: 'var(--ink-2)' }}>
            {storage
              ? 'The browser could not read your saved data just now. This is usually temporary. Your diary has not been deleted.'
              : 'Your diary is safe. Trying again usually clears it.'}
          </p>
          <div className="stack tight">
            <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
            <button className="btn ghost" onClick={() => location.reload()}>Reload the app</button>
            {this.props.onClose && <button className="btn ghost" onClick={this.props.onClose}>Close this page</button>}
          </div>
          <div className="card stack tight">
            <div className="card-head" style={{ marginBottom: 0 }}>
              <h2>Details</h2>
              <button className="link" onClick={this.copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: 'var(--ink-2)', userSelect: 'text' }}>{this.details()}</pre>
          </div>
        </div>
      </div>
    );
  }
}
