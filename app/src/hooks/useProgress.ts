import { useCallback, useEffect, useState } from 'react';
import { fetchProgress, markLessonCompleted, setFamilyShareEnabled, touchStreak } from '../lib/progressApi';

export interface Badge {
  id: string;
  icon: string;
  label: string;
  locked: boolean;
}

export interface ProgressState {
  completedLessonIds: string[];
  streakCount: number;
  lastActiveDate: string | null;
  familyShareEnabled: boolean;
}

const defaultState: ProgressState = {
  completedLessonIds: [],
  streakCount: 0,
  lastActiveDate: null,
  familyShareEnabled: true,
};

export function todayISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calcStreak(lastActiveDate: string | null, today: string, prevCount: number): number {
  if (lastActiveDate === today) return prevCount;
  if (!lastActiveDate) return 1;
  const diffDays = Math.round(
    (new Date(today).getTime() - new Date(lastActiveDate).getTime()) / 86_400_000,
  );
  return diffDays === 1 ? prevCount + 1 : 1;
}

export function computeBadges(state: {
  completedCount: number;
  streakCount: number;
  antiFraudDone: boolean;
  allLayersDone: boolean;
}): Badge[] {
  return [
    { id: 'first-lesson', icon: '🐣', label: '初次見面', locked: state.completedCount < 1 },
    { id: 'streak-5', icon: '🔥', label: '連學 5 日', locked: state.streakCount < 5 },
    { id: 'anti-fraud', icon: '🛡️', label: '防騙高手', locked: !state.antiFraudDone },
    { id: 'ai-master', icon: '🎓', label: 'AI 達人', locked: !state.allLayersDone },
  ];
}

export function useProgress(userId: string | null) {
  const [state, setState] = useState<ProgressState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const remote = await fetchProgress(userId);
      const today = todayISO();
      let next = remote;
      if (remote.lastActiveDate !== today) {
        const touched = await touchStreak(userId, today, calcStreak);
        next = { ...remote, streakCount: touched.streakCount, lastActiveDate: touched.lastActiveDate };
      }
      if (!active) return;
      setState(next);
      setLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (!userId || state.completedLessonIds.includes(lessonId)) return;
      await markLessonCompleted(userId, lessonId);
      setState((prev) => ({ ...prev, completedLessonIds: [...prev.completedLessonIds, lessonId] }));
    },
    [userId, state.completedLessonIds],
  );

  const setFamilyShare = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      await setFamilyShareEnabled(userId, enabled);
      setState((prev) => ({ ...prev, familyShareEnabled: enabled }));
    },
    [userId],
  );

  return { state, loaded, completeLesson, setFamilyShare };
}
