import { useCallback, useEffect, useState } from 'react';
import { fetchProgress, type RemoteProgress } from '../lib/progressApi';
import { fetchComments, postComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';

interface FamilyProgressViewProps {
  elderUserId: string;
  elderDisplayName: string | null;
}

export function FamilyProgressView({ elderUserId, elderDisplayName }: FamilyProgressViewProps) {
  const [progress, setProgress] = useState<RemoteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [comments, setComments] = useState<FamilyComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setBusy(true);
    fetchProgress(elderUserId)
      .then((result) => {
        if (active) {
          setProgress(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '攞唔到進度，請再試');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [elderUserId, reloadToken]);

  useEffect(() => {
    if (!progress?.familyShareEnabled) return;
    let active = true;
    fetchComments(elderUserId)
      .then((result) => {
        if (active) setComments(result);
      })
      .catch((err) => {
        if (active) setCommentsError(err instanceof Error ? err.message : '攞唔到留言，請再試');
      });
    return () => {
      active = false;
    };
  }, [elderUserId, progress?.familyShareEnabled, reloadToken]);

  const handleRetry = useCallback(() => setReloadToken((n) => n + 1), []);

  async function handlePostComment() {
    if (posting || !commentText.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      await postComment(elderUserId, commentText.trim());
      setCommentText('');
      const updated = await fetchComments(elderUserId);
      setComments(updated);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : '送出失敗，請再試');
    } finally {
      setPosting(false);
    }
  }

  if (error) {
    return (
      <div className="screen">
        <div className="topbar">
          <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
        </div>
        <div className="fam-card">
          <p className="error-text">攞唔到進度：{error}</p>
          <button className="bigbtn" disabled={busy} onClick={handleRetry}>
            {busy ? '再試緊…' : '再試一次'}
          </button>
        </div>
      </div>
    );
  }

  if (!progress) return <div className="screen" />;

  if (!progress.familyShareEnabled) {
    return (
      <div className="screen">
        <div className="topbar">
          <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
        </div>
        <div className="fam-card">
          <p>對方而家冇分享緊進度</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
      </div>
      <div className="fam-card">
        <p>連續學習：{progress.streakCount} 日</p>
        <p>完成咗：{progress.completedLessonIds.length} 課</p>
      </div>
      <div className="fam-card">
        <h4>留言鼓勵</h4>
        <textarea
          className="comment-input"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="寫幾句鼓勵嘅說話…"
        />
        {postError && <p className="error-text">{postError}</p>}
        <button className="bigbtn" disabled={posting || !commentText.trim()} onClick={handlePostComment}>
          {posting ? '送緊出…' : '送出鼓勵'}
        </button>
      </div>
      <div className="fam-card">
        <h4>留言紀錄</h4>
        <CommentList comments={comments} error={commentsError} emptyText="仲未有留言" />
      </div>
    </div>
  );
}
