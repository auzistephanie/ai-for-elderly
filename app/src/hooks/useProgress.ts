import { useCallback } from 'react';
import { fetchProgress, markLessonCompleted, setFamilyShareEnabled, touchStreak } from '../lib/progressApi';
import { useAsyncData } from './useAsyncData';

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
  const fetcher = useCallback(async (): Promise<ProgressState> => {
    if (!userId) return defaultState;
    const remote = await fetchProgress(userId);
    const today = todayISO();
    if (remote.lastActiveDate === today) return remote;
    const touched = await touchStreak(userId, today, calcStreak);
    return { ...remote, streakCount: touched.streakCount, lastActiveDate: touched.lastActiveDate };
  }, [userId]);

  const {
    data,
    error: progressError,
    loaded,
    reload: reloadProgress,
    setData,
  } = useAsyncData<ProgressState>(fetcher, [userId], '攞唔到進度，請再試');

  const state = data ?? defaultState;

  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (!userId || state.completedLessonIds.includes(lessonId)) return;
      await markLessonCompleted(userId, lessonId);
      setData((prev) => ({
        ...(prev ?? defaultState),
        completedLessonIds: [...(prev ?? defaultState).completedLessonIds, lessonId],
      }));
    },
    [userId, state.completedLessonIds, setData],
  );

  const setFamilyShare = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      await setFamilyShareEnabled(userId, enabled);
      setData((prev) => ({ ...(prev ?? defaultState), familyShareEnabled: enabled }));
    },
    [userId, setData],
  );

  return { state, loaded, progressError, reloadProgress, completeLesson, setFamilyShare };
}
