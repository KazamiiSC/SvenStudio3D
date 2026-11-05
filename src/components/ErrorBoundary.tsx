import React from 'react';

type Props = { children: React.ReactNode; label?: string; compact?: boolean };
type State = { error: Error | null; details: string; revision: number };

/** Keep the whole editor usable even if the Three.js renderer fails. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, details: '', revision: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const details = [error.stack || String(error), info.componentStack || ''].filter(Boolean).join('\n\n');
    this.setState({ details });
    console.error(`[SvenStudio] ${this.props.label || 'Application'} failed:`, error, info);
  }

  reset = () => this.setState(s => ({ error: null, details: '', revision: s.revision + 1 }));

  render() {
    if (!this.state.error) return <React.Fragment key={this.state.revision}>{this.props.children}</React.Fragment>;
    const label = this.props.label || 'SvenStudio 3D';
    const message = this.state.error.message || String(this.state.error);
    const diagnostic = `${label}\n${message}\n\n${this.state.details}`;
    return <div className={`error-boundary ${this.props.compact ? 'error-boundary-viewport' : ''}`} role="alert">
      <div className="error-symbol">!</div>
      <h2>Error al iniciar {label}</h2>
      <p>Se detectó un error de JavaScript. Ya no se ocultará la interfaz sin explicación.</p>
      <p><strong>Motivo:</strong> {message}</p>
      <details><summary>Detalles técnicos</summary><pre>{diagnostic}</pre></details>
      <div className="error-actions">
        <button onClick={() => navigator.clipboard?.writeText(diagnostic).catch(() => {})}>Copiar error</button>
        <button onClick={this.reset}>Reintentar</button>
        <button onClick={() => location.reload()}>Recargar página</button>
      </div>
    </div>;
  }
}
