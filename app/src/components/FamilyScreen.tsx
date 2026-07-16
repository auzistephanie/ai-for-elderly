interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
}

export function FamilyScreen({ shareEnabled, onToggleShare }: FamilyScreenProps) {
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
        <div className="fam-card" style={{ color: '#888', fontSize: 22 }}>
          ➕ 想加多個家人？撳呢度用 WhatsApp 邀請。
        </div>
      )}
    </div>
  );
}
