import { useState } from 'react';
import { redeemPairingCode } from '../lib/family';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { msg } from '../lib/messages';

interface PairingScreenProps {
  onPaired: (elder: { elderUserId: string; elderDisplayName: string | null }) => void;
}

export function PairingScreen({ onPaired }: PairingScreenProps) {
  const [code, setCode] = useState('');
  const { run, busy, error } = useAsyncAction(async () => {
    const elder = await redeemPairingCode(code);
    onPaired(elder);
  }, msg.pairingFailed);

  return (
    <div className="screen">
      <div className="topbar">
        <h2>輸入配對碼</h2>
        <p>問屋企人攞組 6 位數字</p>
      </div>
      <div className="fam-card">
        <div className="step-pill">打入個碼，再撳確認</div>
        <input
          className="phone-input"
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6 位數字"
        />
        {code.length < 6 && (
          <p className="hint-text">
            {code.length === 0 ? '打齊 6 個數字，先撳得「確認配對」' : `仲差 ${6 - code.length} 個數字，先撳得「確認配對」`}
          </p>
        )}
        {error && <p className="error-text">{error}</p>}
        <button className="bigbtn" disabled={busy || code.length < 6} onClick={() => run()}>
          {busy ? '配對緊…' : '確認配對'}
        </button>
      </div>
    </div>
  );
}
