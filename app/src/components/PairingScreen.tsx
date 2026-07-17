import { useState } from 'react';
import { redeemPairingCode } from '../lib/family';

interface PairingScreenProps {
  onPaired: (elder: { elderUserId: string; elderDisplayName: string | null }) => void;
}

export function PairingScreen({ onPaired }: PairingScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePair() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const elder = await redeemPairingCode(code);
      onPaired(elder);
    } catch (err) {
      setError(err instanceof Error ? err.message : '配對失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h2>輸入配對碼</h2>
        <p>問返屋企嗰位攞個 6 位數配對碼</p>
      </div>
      <div className="fam-card">
        <input
          className="phone-input"
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="配對碼"
        />
        {error && <p className="error-text">{error}</p>}
        <button className="bigbtn" disabled={busy || code.length < 6} onClick={handlePair}>
          {busy ? '配對緊…' : '配對'}
        </button>
      </div>
    </div>
  );
}
