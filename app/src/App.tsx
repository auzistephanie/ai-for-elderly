import { useEffect, useState } from 'react';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './components/HomeScreen';
import { LessonScreen } from './components/LessonScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { FamilyScreen } from './components/FamilyScreen';
import { LoginScreen } from './components/LoginScreen';
import { PairingScreen } from './components/PairingScreen';
import { FamilyProgressView } from './components/FamilyProgressView';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { useProgress, computeBadges } from './hooks/useProgress';
import { fetchFamilyLink } from './lib/family';
import type { ScreenName } from './types/screen';

interface ElderShellProps {
  userId: string;
  onRetryLessons: () => void;
}

function ElderShell({ userId, onRetryLessons }: ElderShellProps) {
  const [screen, setScreen] = useState<ScreenName>('home');
  const { lessons, loaded: lessonsLoaded, error: lessonsError } = useLessons();
  const { state, completeLesson, setFamilyShare } = useProgress(userId);

  // A fetch failure is distinct from "genuinely zero lessons" (see useLessons) and must not
  // be swallowed into a silent blank/empty-state screen — surface it with the same
  // error+retry affordance used elsewhere (e.g. FamilyProgressView).
  if (lessonsError) {
    return (
      <div className="app">
        <div className="screen">
          <div className="fam-card">
            <p className="error-text">攞唔到課堂內容：{lessonsError}</p>
            <button className="bigbtn" onClick={onRetryLessons}>
              再試一次
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lessonsLoaded) return <div className="app" />;

  const todayLesson = lessons[0] ?? null;
  const layer1Total = lessons.filter((l) => l.layer === 1).length;
  const layer1Completed = lessons.filter((l) => l.layer === 1 && state.completedLessonIds.includes(l.id)).length;

  const badges = computeBadges({
    completedCount: state.completedLessonIds.length,
    streakCount: state.streakCount,
    antiFraudDone: false,
    allLayersDone: false,
  });

  return (
    <div className="app">
      {screen === 'home' && todayLesson && (
        <HomeScreen todayLesson={todayLesson} streakCount={state.streakCount} onStartLesson={() => setScreen('lesson')} />
      )}
      {screen === 'lesson' && todayLesson && (
        <LessonScreen
          lesson={todayLesson}
          onComplete={() => {
            completeLesson(todayLesson.id);
            setScreen('progress');
          }}
        />
      )}
      {screen === 'progress' && (
        <ProgressScreen
          layers={[
            { layer: 1, name: 'AI 入門（淺）', totalLessons: layer1Total, completedLessons: layer1Completed },
            { layer: 2, name: '生活應用（中）', totalLessons: 0, completedLessons: 0 },
            { layer: 3, name: '進階玩法（深）', totalLessons: 0, completedLessons: 0 },
          ]}
          badges={badges}
        />
      )}
      {screen === 'family' && <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} />}
      <NavBar active={screen} onNavigate={setScreen} />
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
  const [elderRetryKey, setElderRetryKey] = useState(0);

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

  if (auth.role === 'family') return <FamilyFlow userId={auth.userId as string} />;

  return (
    <ElderShell
      key={elderRetryKey}
      userId={auth.userId as string}
      onRetryLessons={() => setElderRetryKey((k) => k + 1)}
    />
  );
}
