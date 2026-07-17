import { useCallback, useEffect, useState } from 'react';
import { fetchProgress, type RemoteProgress } from '../lib/progressApi';

interface FamilyProgressViewProps {
  elderUserId: string;
  elderDisplayName: string | null;
}

export function FamilyProgressView({ elderUserId, elderDisplayName }: FamilyProgressViewProps) {
  const [progress, setProgress] = useState<RemoteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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

  const handleRetry = useCallback(() => setReloadToken((n) => n + 1), []);

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
    </div>
  );
}
