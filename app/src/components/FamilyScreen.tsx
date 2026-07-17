import { useEffect, useState } from 'react';
import { createPairingCode } from '../lib/family';
import { fetchComments, likeComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';

interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
  userId: string;
}

export function FamilyScreen({ shareEnabled, onToggleShare, userId }: FamilyScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [comments, setComments] = useState<FamilyComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);

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

  async function handleLike(commentId: string) {
    if (likingId) return;
    setLikingId(commentId);
    try {
      await likeComment(commentId);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, liked: true } : c)));
    } catch {
      // Best-effort: leave the comment unliked so the user can tap again.
    } finally {
      setLikingId(null);
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
      <div className="fam-card">
        <h4>家人留言</h4>
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
