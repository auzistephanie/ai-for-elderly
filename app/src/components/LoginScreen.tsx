import { useState } from 'react';
import { requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from '../lib/auth';
import { msg } from '../lib/messages';
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
    if (!code) throw new Error(msg.otpMissing);

    setOtp(code);
    setStep('confirm-otp');
  }, msg.otpSendFailed);

  const confirm = useAsyncAction(async () => {
    if (!otp || !role) return;
    await verifyOtp(phone, otp);
    try {
      await ensureProfile(role, name.trim());
    } catch {
      throw new Error(msg.loginFailed);
    }
    onLoggedIn();
  }, msg.loginFailed);

  function handlePhoneChange(value: string) {
    // 長者好多時打「9123 4567」或者連 +852 一齊打，淨留數字，亦去走 852 區號。
    let digits = value.replace(/\D/g, '');
    if (digits.length > 8 && digits.startsWith('852')) digits = digits.slice(3);
    setPhone(digits);
  }

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
          <div className="step-pill">第 1 步，共 4 步</div>
          <p>你係邊個？撳下面一個</p>
          <button
            className="bigbtn"
            onClick={() => {
              setRole('elder');
              setStep('enter-name');
            }}
          >
            <span>
              <span>我係長者</span>
              <small>我想自己學</small>
            </span>
          </button>
          <button
            className="bigbtn"
            onClick={() => {
              setRole('family');
              setStep('enter-name');
            }}
          >
            <span>
              <span>我係仔女</span>
              <small>我想睇屋企人學成點</small>
            </span>
          </button>
        </div>
      )}

      {step === 'enter-name' && (
        <div className="fam-card">
          <div className="step-pill">第 2 步，共 4 步</div>
          <p>你個名係？</p>
          <input
            className="phone-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="你個名"
          />
          {!name.trim() && <p className="hint-text">請先寫低你個名，先撳得「下一步」</p>}
          <button className="bigbtn" disabled={!name.trim()} onClick={() => setStep('enter-phone')}>
            下一步
          </button>
          <button className="bigbtn back-btn" onClick={() => setStep('choose-role')}>
            ◀ 返去
          </button>
        </div>
      )}

      {step === 'enter-phone' && (
        <div className="fam-card">
          <div className="step-pill">第 3 步，共 4 步</div>
          <p>你嘅電話號碼</p>
          <input
            className="phone-input"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="91234567"
          />
          {phone.length < 8 && (
            <p className="hint-text">
              {phone.length === 0
                ? '打齊 8 位數字，先撳得「傳送驗證碼」。唔使打 +852'
                : `仲差 ${8 - phone.length} 個數字，先撳得「傳送驗證碼」`}
            </p>
          )}
          {sendOtp.error && <p className="error-text">{sendOtp.error}</p>}
          <button className="bigbtn" disabled={sendOtp.busy || phone.length < 8} onClick={() => sendOtp.run()}>
            {sendOtp.busy ? '傳送緊…' : '傳送驗證碼'}
          </button>
          <button className="bigbtn back-btn" onClick={() => setStep('enter-name')}>
            ◀ 返去
          </button>
        </div>
      )}

      {step === 'confirm-otp' && (
        <div className="fam-card">
          <div className="step-pill">第 4 步，共 4 步</div>
          <p>驗證碼已經幫你填好 ✅</p>
          <p className="hint-text">唔使自己打，撳下面「確認登入」就得</p>
          {/* 呢個 app 用自訂 Send SMS Auth Hook 代替真實短訊，所以直接喺畫面度顯示驗證碼係故意噉樣設計，唔係漏咗做保安 — 詳見 Plan 2 設計文件。 */}
          <p className="otp-display">{otp}</p>
          {confirm.error && <p className="error-text">{confirm.error}</p>}
          <button className="bigbtn" disabled={confirm.busy} onClick={() => confirm.run()}>
            {confirm.busy ? '確認緊…' : '確認登入'}
          </button>
          <button className="bigbtn back-btn" onClick={handleBackToPhone}>
            ◀ {confirm.error ? '撳呢度返去重新輸入電話' : '返去'}
          </button>
        </div>
      )}
    </div>
  );
}
