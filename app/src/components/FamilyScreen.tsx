import { useEffect, useState } from 'react';
import { createPairingCode } from '../lib/family';
import { fetchComments, likeComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { msg } from '../lib/messages';

const PAIRING_CODE_TTL_SECONDS = 10 * 60;

function formatCodeCountdown(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  if (seconds === 0) return `仲剩 ${minutes} 分鐘`;
  return `仲剩 ${minutes} 分 ${seconds} 秒`;
}

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
  } = useAsyncData<FamilyComment[]>(() => fetchComments(userId), [userId], msg.commentsLoadFailed);

  const [likingId, setLikingId] = useState<string | null>(null);
  const likeAction = useAsyncAction(async (commentId: string) => {
    await likeComment(commentId);
    setComments((prev) => (prev ?? []).map((c) => (c.id === commentId ? { ...c, liked: true } : c)));
  }, msg.likeFailed);

  const generateCode = useAsyncAction(async () => {
    const code = await createPairingCode();
    const generatedAt = Date.now();
    setPairingCode(code);
    setCodeGeneratedAt(generatedAt);
    setNow(generatedAt);
  }, msg.pairingCodeFailed);

  const toggleShare = useAsyncAction(async (enabled: boolean) => {
    await onToggleShare(enabled);
  }, msg.shareToggleFailed);

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
  const countdownLabel = formatCodeCountdown(secondsLeft);

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
            className="share-toggle"
            style={{ background: shareEnabled ? '#2f6f4f' : '#5c5c5c' }}
            disabled={toggleShare.busy}
            onClick={() => toggleShare.run(!shareEnabled)}
            aria-pressed={shareEnabled}
            aria-label={shareEnabled ? '分享進度，開咗' : '分享進度，閂咗'}
          >
            {shareEnabled ? '開咗' : '閂咗'}
          </button>
        </div>
        <p className="hint-text">
          {shareEnabled ? '開咗：屋企人可以睇你嘅進度。' : '閂咗：暫時冇人睇到。開返先有配對碼。'}
        </p>
        {toggleShare.error && <p className="error-text">{toggleShare.error}</p>}
      </div>
      {shareEnabled && (
        <div className="fam-card">
          {pairingCode && !isExpired && (
            <>
              <p>呢組 6 位數字，叫屋企人 10 分鐘內打入去：</p>
              <p className="otp-display">{pairingCode}</p>
              <p>{countdownLabel}</p>
            </>
          )}
          {pairingCode && isExpired && <p>呢組碼過期了。撳下面再出一組新嘅。</p>}
          {!pairingCode && (
            <>
              <p>想俾屋企人睇到你：</p>
              <ol className="step-list">
                <li>開住上面個分享</li>
                <li>撳下面出一組 6 位數字</li>
                <li>叫佢 10 分鐘內打入去</li>
              </ol>
            </>
          )}
          <button className="bigbtn" disabled={generateCode.busy} onClick={() => generateCode.run()}>
            {generateCode.busy ? '產生緊…' : pairingCode ? '產生新碼' : '產生配對碼'}
          </button>
          {generateCode.error && <p className="error-text">{generateCode.error}</p>}
        </div>
      )}
      <div className="fam-card">
        <h4>家人留言</h4>
        {likeAction.error && <p className="error-text">{likeAction.error}</p>}
        <CommentList
          comments={comments ?? []}
          error={commentsError}
          emptyText="仲未有留言。叫屋企人喺佢個 app 寫幾句俾你。"
          onLike={handleLike}
          likingId={likingId}
        />
      </div>
    </div>
  );
}
