import { useCallback, useState } from 'react';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './components/HomeScreen';
import { LessonScreen } from './components/LessonScreen';
import { LessonListScreen } from './components/LessonListScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { FamilyScreen } from './components/FamilyScreen';
import { LoginScreen } from './components/LoginScreen';
import { PairingScreen } from './components/PairingScreen';
import { FamilyProgressView } from './components/FamilyProgressView';
import { ErrorRetry } from './components/ErrorRetry';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { useProgress, computeBadges } from './hooks/useProgress';
import { useAsyncAction } from './hooks/useAsyncAction';
import { useAsyncData } from './hooks/useAsyncData';
import { fetchFamilyLink } from './lib/family';
import { LAYER_NAMES, getNextLesson, isLayerCompleted } from './lib/courseEngine';
import type { ScreenName } from './types/screen';

function ElderShell({ userId }: { userId: string }) {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const { lessons, loaded: lessonsLoaded, error: lessonsError, reload: reloadLessons } = useLessons();
  const {
    state,
    loaded: progressLoaded,
    progressError,
    reloadProgress,
    completeLesson,
    setFamilyShare,
  } = useProgress(userId);

  function navigate(next: ScreenName) {
    setActiveLessonId(null);
    setScreen(next);
  }

  function openLesson(lessonId: string) {
    setActiveLessonId(lessonId);
    setScreen('lesson');
  }

  if (lessonsError) {
    return <ErrorRetry message={`攞唔到課堂內容：${lessonsError}`} onRetry={reloadLessons} />;
  }
  if (progressError) {
    return <ErrorRetry message={progressError} onRetry={reloadProgress} />;
  }
  if (!lessonsLoaded || !progressLoaded) return <div className="app" />;

  const nextLesson = getNextLesson(lessons, state.completedLessonIds);
  const antiFraudLesson = lessons.find((l) => l.layer === 0) ?? null;
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;

  const layerTotals = ([1, 2, 3] as const).map((layer) => ({
    layer,
    name: LAYER_NAMES[layer],
    totalLessons: lessons.filter((l) => l.layer === layer).length,
    completedLessons: lessons.filter((l) => l.layer === layer && state.completedLessonIds.includes(l.id)).length,
  }));

  const badges = computeBadges({
    completedCount: state.completedLessonIds.length,
    streakCount: state.streakCount,
    antiFraudDone: antiFraudLesson !== null && state.completedLessonIds.includes(antiFraudLesson.id),
    allLayersDone: ([1, 2, 3] as const).every((layer) => isLayerCompleted(lessons, layer, state.completedLessonIds)),
  });

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          nextLesson={nextLesson}
          antiFraudLesson={antiFraudLesson}
          streakCount={state.streakCount}
          onSelectLesson={openLesson}
        />
      )}
      {screen === 'lesson' && activeLesson && (
        <ElderLessonScreen
          lesson={activeLesson}
          userId={userId}
          completeLesson={completeLesson}
          onCompleted={() => navigate('progress')}
        />
      )}
      {screen === 'lesson' && !activeLesson && (
        <LessonListScreen lessons={lessons} completedLessonIds={state.completedLessonIds} onSelectLesson={openLesson} />
      )}
      {screen === 'progress' && <ProgressScreen layers={layerTotals} badges={badges} />}
      {screen === 'family' && (
        <ElderFamilyScreen shareEnabled={state.familyShareEnabled} setFamilyShare={setFamilyShare} userId={userId} />
      )}
      <NavBar active={screen} onNavigate={navigate} />
    </div>
  );
}

// Wraps completeLesson (which throws on failure) in a local useAsyncAction so a failure shows
// inline on LessonScreen and the app only moves to the progress tab on genuine success — closes
// the "fire and forget, navigate regardless" gap the old onComplete={() => { completeLesson(...);
// navigate(...); }} pattern had.
function ElderLessonScreen({
  lesson,
  userId,
  completeLesson,
  onCompleted,
}: {
  lesson: Parameters<typeof LessonScreen>[0]['lesson'];
  userId: string;
  completeLesson: (lessonId: string) => Promise<void>;
  onCompleted: () => void;
}) {
  const { run, error } = useAsyncAction(async () => {
    await completeLesson(lesson.id);
    onCompleted();
  }, '完成課堂紀錄唔到，請再試');

  return <LessonScreen lesson={lesson} userId={userId} completeError={error} onComplete={() => run()} />;
}

// Passes setFamilyShare straight through as onToggleShare. It throws on failure just like
// completeLesson above, but unlike completeLesson it is NOT wrapped in a useAsyncAction here —
// FamilyScreen.tsx wraps it in its own local useAsyncAction instead, so a failed toggle surfaces
// inline there (next to the toggle itself), not at this call site.
function ElderFamilyScreen({
  shareEnabled,
  setFamilyShare,
  userId,
}: {
  shareEnabled: boolean;
  setFamilyShare: (enabled: boolean) => Promise<void>;
  userId: string;
}) {
  return <FamilyScreen shareEnabled={shareEnabled} onToggleShare={setFamilyShare} userId={userId} />;
}

function FamilyFlow({ userId }: { userId: string }) {
  const [pairedLink, setPairedLink] = useState<{ elderUserId: string; elderDisplayName: string | null } | null>(
    null,
  );
  const fetcher = useCallback(() => fetchFamilyLink(userId), [userId]);
  const { data, error, loaded, busy, reload } = useAsyncData(fetcher, [userId], '攞唔到配對狀態，請再試');

  if (error) return <ErrorRetry message={error} onRetry={reload} busy={busy} />;
  if (!loaded) return <div className="app" />;

  const link = pairedLink ?? data ?? null;
  if (link === null) {
    return (
      <div className="app">
        <PairingScreen onPaired={setPairedLink} />
      </div>
    );
  }
  return (
    <div className="app">
      <FamilyProgressView elderUserId={link.elderUserId} elderDisplayName={link.elderDisplayName} />
    </div>
  );
}

export function App() {
  const auth = useAuth();

  if (auth.status === 'loading') return <div className="app" />;

  if (auth.status === 'signed-out') {
    return (
      <div className="app">
        {/* Full reload (not just relying on useAuth's own onAuthStateChange reactivity) is
            deliberate: on first login, ensureProfile() inserts the elder_profiles row AFTER
            verifyOtp() already fires the SIGNED_IN auth event. If we didn't reload, useAuth's
            listener would race that insert and could cache role: null with nothing left to
            re-trigger a re-fetch. Reloading re-runs useAuth's initial getSession() lookup only
            after ensureProfile() has definitely finished, guaranteeing the role is readable. */}
        <LoginScreen onLoggedIn={() => window.location.reload()} />
      </div>
    );
  }

  if (auth.role === null) {
    return <ErrorRetry message="攞唔到你嘅身份資料，請再試" onRetry={() => window.location.reload()} />;
  }

  if (auth.role === 'family') return <FamilyFlow userId={auth.userId as string} />;

  return <ElderShell userId={auth.userId as string} />;
}
