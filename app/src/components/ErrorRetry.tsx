interface ErrorRetryProps {
  message: string;
  onRetry: () => void;
  busy?: boolean;
}

// Full-page blocking error + retry. Not for inline/nested error states (e.g. a form field's
// error text under a button) — those stay hand-rolled at their own call sites.
export function ErrorRetry({ message, onRetry, busy }: ErrorRetryProps) {
  return (
    <div className="app">
      <div className="screen">
        <div className="fam-card">
          <p className="error-text">{message}</p>
          <button className="bigbtn" disabled={busy} onClick={onRetry}>
            {busy ? '再試緊…' : '再試一次'}
          </button>
        </div>
      </div>
    </div>
  );
}
