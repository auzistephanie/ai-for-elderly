import { useEffect, useState } from 'react';
import { createPairingCode } from '../lib/family';
import { fetchComments, likeComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';

const PAIRING_CODE_TTL_SECONDS = 10 * 60;

interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
  userId: string;
}

export function FamilyScreen({ shareEnabled, onToggleShare, userId }: FamilyScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeGeneratedAt, setCodeGeneratedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [comments, setComments] = useState<FamilyComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchComments(userId)
      .then((result) => {
        if (active) setComments(result);
      })
      .catch((err) => {
        if (active) setCommentsError(err instanceof Error ? err.message : '攞唔到留言，請再試');
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!pairingCode) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pairingCode]);

  async function handleGenerateCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const code = await createPairingCode();
      const generatedAt = Date.now();
      setPairingCode(code);
      setCodeGeneratedAt(generatedAt);
      setNow(generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : '攞唔到配對碼，請再試');
    } finally {
      setBusy(false);
    }
  }

  async function handleLike(commentId: string) {
    if (likingId) return;
    setLikingId(commentId);
    setLikeError(null);
    try {
      await likeComment(commentId);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, liked: true } : c)));
    } catch (err) {
      // Leave the comment unliked so the user can tap again, but tell them it didn't
      // silently succeed — previously this failed with zero feedback.
      setLikeError(err instanceof Error ? err.message : '撳讚失敗，請再試');
    } finally {
      setLikingId(null);
    }
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
            onClick={() => onToggleShare(!shareEnabled)}
            aria-pressed={shareEnabled}
          />
        </div>
      </div>
      {shareEnabled && (
        <div className="fam-card">
          {pairingCode && !isExpired && (
            <>
              <p>配對碼（俾屋企人 10 分鐘內輸入）：</p>
              <p className="otp-display">{pairingCode}</p>
              <p>{countdownLabel}</p>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {pairingCode && isExpired && (
            <>
              <p>配對碼已過期</p>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {!pairingCode && (
            <>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生配對碼'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </>
          )}
        </div>
      )}
      <div className="fam-card">
        <h4>家人留言</h4>
        {likeError && <p className="error-text">{likeError}</p>}
        <CommentList
          comments={comments}
          error={commentsError}
          emptyText="仲未有家人留言，快啲叫佢哋嚟支持你啦"
          onLike={handleLike}
          likingId={likingId}
        />
      </div>
    </div>
  );
}
