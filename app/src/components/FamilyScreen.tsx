import { useEffect, useState } from 'react';
import { createPairingCode } from '../lib/family';
import { fetchComments, likeComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAsyncAction } from '../hooks/useAsyncAction';

const PAIRING_CODE_TTL_SECONDS = 10 * 60;

interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => Promise<void>;
  userId: string;
}

export function FamilyScreen({ shareEnabled, onToggleShare, userId }: FamilyScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeGeneratedAt, setCodeGeneratedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const {
    data: comments,
    error: commentsError,
    setData: setComments,
  } = useAsyncData<FamilyComment[]>(() => fetchComments(userId), [userId], '攞唔到留言，請再試');

  const [likingId, setLikingId] = useState<string | null>(null);
  const likeAction = useAsyncAction(async (commentId: string) => {
    await likeComment(commentId);
    setComments((prev) => (prev ?? []).map((c) => (c.id === commentId ? { ...c, liked: true } : c)));
  }, '撳讚失敗，請再試');

  const generateCode = useAsyncAction(async () => {
    const code = await createPairingCode();
    const generatedAt = Date.now();
    setPairingCode(code);
    setCodeGeneratedAt(generatedAt);
    setNow(generatedAt);
  }, '攞唔到配對碼，請再試');

  const toggleShare = useAsyncAction(async (enabled: boolean) => {
    await onToggleShare(enabled);
  }, '設定失敗，請再試');

  useEffect(() => {
    if (!pairingCode) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pairingCode]);

  async function handleLike(commentId: string) {
    if (likingId) return;
    setLikingId(commentId);
    await likeAction.run(commentId);
    setLikingId(null);
  }

  const secondsElapsed = codeGeneratedAt ? Math.floor((now - codeGeneratedAt) / 1000) : 0;
  const secondsLeft = Math.max(0, PAIRING_CODE_TTL_SECONDS - secondsElapsed);
  const isExpired = pairingCode !== null && secondsLeft === 0;
  const countdownLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} 後過期`;

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
            disabled={toggleShare.busy}
            onClick={() => toggleShare.run(!shareEnabled)}
            aria-pressed={shareEnabled}
          />
        </div>
        {toggleShare.error && <p className="error-text">{toggleShare.error}</p>}
      </div>
      {shareEnabled && (
        <div className="fam-card">
          {pairingCode && !isExpired && (
            <>
              <p>配對碼（俾屋企人 10 分鐘內輸入）：</p>
              <p className="otp-display">{pairingCode}</p>
              <p>{countdownLabel}</p>
              <button className="bigbtn" disabled={generateCode.busy} onClick={() => generateCode.run()}>
                {generateCode.busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {pairingCode && isExpired && (
            <>
              <p>配對碼已過期</p>
              <button className="bigbtn" disabled={generateCode.busy} onClick={() => generateCode.run()}>
                {generateCode.busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {!pairingCode && (
            <>
              <button className="bigbtn" disabled={generateCode.busy} onClick={() => generateCode.run()}>
                {generateCode.busy ? '產生緊…' : '產生配對碼'}
              </button>
              {generateCode.error && <p className="error-text">{generateCode.error}</p>}
            </>
          )}
        </div>
      )}
      <div className="fam-card">
        <h4>家人留言</h4>
        {likeAction.error && <p className="error-text">{likeAction.error}</p>}
        <CommentList
          comments={comments ?? []}
          error={commentsError}
          emptyText="仲未有家人留言，快啲叫佢哋嚟支持你啦"
          onLike={handleLike}
          likingId={likingId}
        />
      </div>
    </div>
  );
}
