import { useEffect, useState } from 'react';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './components/HomeScreen';
import { LessonScreen } from './components/LessonScreen';
import { LessonListScreen } from './components/LessonListScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { FamilyScreen } from './components/FamilyScreen';
import { LoginScreen } from './components/LoginScreen';
import { PairingScreen } from './components/PairingScreen';
import { FamilyProgressView } from './components/FamilyProgressView';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { useProgress, computeBadges } from './hooks/useProgress';
import { fetchFamilyLink } from './lib/family';
import { LAYER_NAMES, getNextLesson, isLayerCompleted } from './lib/courseEngine';
import type { ScreenName } from './types/screen';

function ElderShell({ userId }: { userId: string }) {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const { lessons, loaded: lessonsLoaded, error: lessonsError, reload: reloadLessons } = useLessons();
  const { state, completeLesson, setFamilyShare } = useProgress(userId);

  // Navigating via the bottom tabs always resets to that tab's top-level view — only an
  // explicit tap on a lesson row/card drills into a specific lesson (openLesson below).
  function navigate(next: ScreenName) {
    setActiveLessonId(null);
    setScreen(next);
  }

  function openLesson(lessonId: string) {
    setActiveLessonId(lessonId);
    setScreen('lesson');
  }

  // A fetch failure is distinct from "genuinely zero lessons" (see useLessons) and must not
  // be swallowed into a silent blank/empty-state screen — surface it with the same
  // error+retry affordance used elsewhere (e.g. FamilyProgressView). Retrying calls useLessons'
  // own reload() rather than remounting ElderShell, so useProgress's streak/completion state
  // (which had nothing to do with the failure) is left completely undisturbed.
  if (lessonsError) {
    return (
      <div className="app">
        <div className="screen">
          <div className="fam-card">
            <p className="error-text">攞唔到課堂內容：{lessonsError}</p>
            <button className="bigbtn" onClick={reloadLessons}>
              再試一次
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lessonsLoaded) return <div className="app" />;

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
        <LessonScreen
          lesson={activeLesson}
          onComplete={() => {
            completeLesson(activeLesson.id);
            navigate('progress');
          }}
        />
      )}
      {screen === 'lesson' && !activeLesson && (
        <LessonListScreen lessons={lessons} completedLessonIds={state.completedLessonIds} onSelectLesson={openLesson} />
      )}
      {screen === 'progress' && <ProgressScreen layers={layerTotals} badges={badges} />}
      {screen === 'family' && <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} />}
      <NavBar active={screen} onNavigate={navigate} />
    </div>
  );
}

function FamilyFlow({ userId }: { userId: string }) {
  const [link, setLink] = useState<{ elderUserId: string; elderDisplayName: string | null } | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true);
    fetchFamilyLink(userId)
      .then((result) => {
        if (active) {
          setLink(result);
          setError(null);
        }
      })
      .catch((err) => {
        // Same dead-end-avoidance as FamilyProgressView: without a .catch() here, a rejected
        // fetch leaves `link` at `undefined` forever and the user is stuck on a blank screen.
        if (active) setError(err instanceof Error ? err.message : '攞唔到配對狀態，請再試');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [userId, retryToken]);

  if (error) {
    return (
      <div className="app">
        <div className="screen">
          <div className="fam-card">
            <p className="error-text">{error}</p>
            <button className="bigbtn" disabled={busy} onClick={() => setRetryToken((n) => n + 1)}>
              {busy ? '再試緊…' : '再試一次'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (link === undefined) return <div className="app" />;
  if (link === null) {
    return (
      <div className="app">
        <PairingScreen onPaired={(elder) => setLink(elder)} />
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

  // A signed-in session with role: null means elder_profiles has no row (or no role) for this
  // user — e.g. ensureProfile() never ran, or its insert failed at the DB level. Falling through
  // silently would guess "elder" and hand a family member (or nobody at all) the elder shell, so
  // it gets its own explicit error+retry state instead.
  if (auth.role === null) {
    return (
      <div className="app">
        <div className="screen">
          <div className="fam-card">
            <p className="error-text">攞唔到你嘅身份資料，請再試</p>
            <button className="bigbtn" onClick={() => window.location.reload()}>
              再試一次
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (auth.role === 'family') return <FamilyFlow userId={auth.userId as string} />;

  return <ElderShell userId={auth.userId as string} />;
}
