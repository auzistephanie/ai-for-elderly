import { useCallback, useState } from 'react';
import { fetchProgress, type RemoteProgress } from '../lib/progressApi';
import { fetchComments, postComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { msg } from '../lib/messages';

interface FamilyProgressViewProps {
  elderUserId: string;
  elderDisplayName: string | null;
}

export function FamilyProgressView({ elderUserId, elderDisplayName }: FamilyProgressViewProps) {
  const progressFetcher = useCallback(() => fetchProgress(elderUserId), [elderUserId]);
  const {
    data: progress,
    error: progressError,
    busy: progressBusy,
    reload: reloadProgress,
  } = useAsyncData<RemoteProgress>(progressFetcher, [elderUserId], msg.progressLoadFailed);

  const commentsFetcher = useCallback(() => {
    if (!progress?.familyShareEnabled) return Promise.resolve<FamilyComment[]>([]);
    return fetchComments(elderUserId);
  }, [elderUserId, progress?.familyShareEnabled]);
  const {
    data: comments,
    error: commentsError,
    setData: setComments,
  } = useAsyncData<FamilyComment[]>(
    commentsFetcher,
    [elderUserId, progress?.familyShareEnabled],
    msg.commentsLoadFailed,
  );

  const [commentText, setCommentText] = useState('');
  const postAction = useAsyncAction(async () => {
    if (!commentText.trim()) return;
    await postComment(elderUserId, commentText.trim());
    setCommentText('');
    const updated = await fetchComments(elderUserId);
    setComments(updated);
  }, msg.commentPostFailed);

  if (progressError) {
    return (
      <div className="screen">
        <div className="topbar">
          <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
        </div>
        <div className="fam-card">
          <p className="error-text">{progressError}</p>
          <button className="bigbtn" disabled={progressBusy} onClick={reloadProgress}>
            {progressBusy ? '再試緊…' : '再試一次'}
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
          <p>屋企人暫時閂咗分享。叫佢喺「家人」頁開返「分享我嘅學習進度」。</p>
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
        {postAction.error && <p className="error-text">{postAction.error}</p>}
        <button className="bigbtn" disabled={postAction.busy || !commentText.trim()} onClick={() => postAction.run()}>
          {postAction.busy ? '送緊出…' : '送出鼓勵'}
        </button>
      </div>
      <div className="fam-card">
        <h4>留言紀錄</h4>
        <CommentList comments={comments ?? []} error={commentsError} emptyText="仲未有留言" />
      </div>
    </div>
  );
}
