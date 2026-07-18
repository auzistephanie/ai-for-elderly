import { useState } from 'react';
import { requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from '../lib/auth';
import { useAsyncAction } from '../hooks/useAsyncAction';
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

  const sendOtp = useAsyncAction(async () => {
    await requestOtp(phone);

    let code = await fetchDisplayedOtp(phone);
    if (!code) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      code = await fetchDisplayedOtp(phone);
    }
    if (!code) throw new Error('攞唔到驗證碼，撳「傳送驗證碼」再試多次');

    setOtp(code);
    setStep('confirm-otp');
  }, '傳送失敗，check 下電話號碼啱唔啱');

  const confirm = useAsyncAction(async () => {
    if (!otp || !role) return;
    await verifyOtp(phone, otp);
    try {
      await ensureProfile(role, name.trim());
    } catch {
      throw new Error('登入失敗，請再試一次');
    }
    onLoggedIn();
  }, '登入失敗，請再試一次');

  function handleBackToPhone() {
    setOtp(null);
    confirm.clearError();
    setStep('enter-phone');
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
          {sendOtp.error && <p className="error-text">{sendOtp.error}</p>}
          <button className="bigbtn" disabled={sendOtp.busy || phone.length < 8} onClick={() => sendOtp.run()}>
            {sendOtp.busy ? '傳送緊…' : '傳送驗證碼'}
          </button>
        </div>
      )}

      {step === 'confirm-otp' && (
        <div className="fam-card">
          <p>驗證碼：</p>
          {/* 呢個 app 用自訂 Send SMS Auth Hook 代替真實短訊，所以直接喺畫面度顯示驗證碼係故意噉樣設計，唔係漏咗做保安 — 詳見 Plan 2 設計文件。 */}
          <p className="otp-display">{otp}</p>
          {confirm.error && <p className="error-text">{confirm.error}</p>}
          <button className="bigbtn" disabled={confirm.busy} onClick={() => confirm.run()}>
            {confirm.busy ? '確認緊…' : '確認登入'}
          </button>
          {confirm.error && (
            <button className="bigbtn" onClick={handleBackToPhone}>
              撳呢度返去重新輸入電話
            </button>
          )}
        </div>
      )}
    </div>
  );
}
