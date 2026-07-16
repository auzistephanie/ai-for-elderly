import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ai-elder-progress-v1';

export interface Badge {
  id: string;
  icon: string;
  label: string;
  locked: boolean;
}

interface ProgressState {
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
  return d.toISOString().slice(0, 10);
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

function loadState(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch {
    return defaultState;
  }
}

function saveState(state: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useProgress() {
  const [state, setState] = useState<ProgressState>(loadState);

  useEffect(() => {
    const today = todayISO();
    setState((prev) => {
      if (prev.lastActiveDate === today) return prev;
      const next = {
        ...prev,
        streakCount: calcStreak(prev.lastActiveDate, today, prev.streakCount),
        lastActiveDate: today,
      };
      saveState(next);
      return next;
    });
  }, []);

  const completeLesson = useCallback((lessonId: string) => {
    setState((prev) => {
      if (prev.completedLessonIds.includes(lessonId)) return prev;
      const next = { ...prev, completedLessonIds: [...prev.completedLessonIds, lessonId] };
      saveState(next);
      return next;
    });
  }, []);

  const setFamilyShare = useCallback((enabled: boolean) => {
    setState((prev) => {
      const next = { ...prev, familyShareEnabled: enabled };
      saveState(next);
      return next;
    });
  }, []);

  return { state, completeLesson, setFamilyShare };
}
