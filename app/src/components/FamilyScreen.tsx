import { useState } from 'react';
import { createPairingCode } from '../lib/family';

interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
}

export function FamilyScreen({ shareEnabled, onToggleShare }: FamilyScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGenerateCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const code = await createPairingCode();
      setPairingCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : '攞唔到配對碼，請再試');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h2>👨‍👩‍👧 家人同行</h2>
        <p>俾屋企人知道你學得幾好（可以隨時閂）</p>
      </div>
      <div className="fam-card">
        <div className="toggle-row">
          <span>分享我嘅學習進度</span>
          <button
            className="toggle"
            style={{ background: shareEnabled ? '#2f6f4f' : '#ccc' }}
            onClick={() => onToggleShare(!shareEnabled)}
            aria-pressed={shareEnabled}
          />
        </div>
      </div>
      {shareEnabled && (
        <div className="fam-card">
          {pairingCode ? (
            <>
              <p>配對碼（俾屋企人 10 分鐘內輸入）：</p>
              <p className="otp-display">{pairingCode}</p>
            </>
          ) : (
            <>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生配對碼'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
