import { useRegisterSW } from 'virtual:pwa-register/react';

// 新版本喺背景下載好之後出現。長者撳「立即更新」先 reload，唔會喺佢上緊堂時自己跳走。
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-banner" role="alert">
      <p>🎉 有新版本喇</p>
      <button className="bigbtn next-btn" onClick={() => updateServiceWorker(true)}>
        <span>立即更新</span>
      </button>
      <button className="bigbtn back-btn" onClick={() => setNeedRefresh(false)}>
        <span>遲啲先</span>
      </button>
    </div>
  );
}
