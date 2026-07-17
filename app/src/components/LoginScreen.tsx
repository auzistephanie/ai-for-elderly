import { useState } from 'react';
import { requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from '../lib/auth';
import type { UserRole } from '../types/auth';

type Step = 'choose-role' | 'enter-name' | 'enter-phone' | 'confirm-otp';

interface LoginScreenProps {
  onLoggedIn: () => void;
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('choose-role');
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendOtp() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: reqError } = await requestOtp(phone);
    if (reqError) {
      setError('傳送失敗，check 下電話號碼啱唔啱');
      setBusy(false);
      return;
    }

    let code = await fetchDisplayedOtp(phone);
    if (!code) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      code = await fetchDisplayedOtp(phone);
    }
    if (!code) {
      setError('攞唔到驗證碼，撳「傳送驗證碼」再試多次');
      setBusy(false);
      return;
    }

    setOtp(code);
    setStep('confirm-otp');
    setBusy(false);
  }

  function handleBackToPhone() {
    setOtp(null);
    setError(null);
    setStep('enter-phone');
  }

  async function handleConfirm() {
    if (busy || !otp || !role) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await verifyOtp(phone, otp);
    if (verifyError) {
      setError('驗證失敗，撳返去重新傳送');
      setBusy(false);
      return;
    }
    try {
      await ensureProfile(role, name.trim());
    } catch {
      setError('登入失敗，請再試一次');
      setBusy(false);
      return;
    }
    setBusy(false);
    onLoggedIn();
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h2>AI老友記</h2>
      </div>

      {step === 'choose-role' && (
        <div className="fam-card">
          <p>邊個登入？</p>
          <button
            className="bigbtn"
            onClick={() => {
              setRole('elder');
              setStep('enter-name');
            }}
          >
            我係長者
          </button>
          <button
            className="bigbtn"
            onClick={() => {
              setRole('family');
              setStep('enter-name');
            }}
          >
            我係仔女
          </button>
        </div>
      )}

      {step === 'enter-name' && (
        <div className="fam-card">
          <p>你個名係？</p>
          <input
            className="phone-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="你個名"
          />
          <button className="bigbtn" disabled={!name.trim()} onClick={() => setStep('enter-phone')}>
            下一步
          </button>
        </div>
      )}

      {step === 'enter-phone' && (
        <div className="fam-card">
          <p>幫手輸入電話號碼</p>
          <input
            className="phone-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="912345678"
          />
          {error && <p className="error-text">{error}</p>}
          <button className="bigbtn" disabled={busy || phone.length < 8} onClick={handleSendOtp}>
            {busy ? '傳送緊…' : '傳送驗證碼'}
          </button>
        </div>
      )}

      {step === 'confirm-otp' && (
        <div className="fam-card">
          <p>驗證碼：</p>
          {/* 呢個 app 用自訂 Send SMS Auth Hook 代替真實短訊，所以直接喺畫面度顯示驗證碼係故意噉樣設計，唔係漏咗做保安 — 詳見 Plan 2 設計文件。 */}
          <p className="otp-display">{otp}</p>
          {error && <p className="error-text">{error}</p>}
          <button className="bigbtn" disabled={busy} onClick={handleConfirm}>
            {busy ? '確認緊…' : '確認登入'}
          </button>
          {error && (
            <button className="bigbtn" onClick={handleBackToPhone}>
              撳呢度返去重新輸入電話
            </button>
          )}
        </div>
      )}
    </div>
  );
}
