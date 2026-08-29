import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

// Top-level safety net: catches any render/lifecycle error that escapes every screen's own
// useAsyncData/useAsyncAction handling (e.g. malformed lesson JSON crashing a component render)
// so an elder sees a friendly Cantonese message + reload button instead of a blank white screen.
// React error boundaries must be class components — there is no hook equivalent (as of React 19).
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary] caught render error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <div className="screen">
            <div className="fam-card">
              <p className="error-text">哎呀，個 app 出咗少少問題</p>
              <button className="bigbtn" onClick={this.handleReload}>
                重新載入
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
