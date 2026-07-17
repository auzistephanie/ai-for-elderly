import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { calcStreak, computeBadges, todayISO } from './useProgress';

const fetchProgressMock = vi.fn();
const markLessonCompletedMock = vi.fn();
const touchStreakMock = vi.fn();
const setFamilyShareEnabledMock = vi.fn();

vi.mock('../lib/progressApi', () => ({
  fetchProgress: (...args: unknown[]) => fetchProgressMock(...args),
  markLessonCompleted: (...args: unknown[]) => markLessonCompletedMock(...args),
  touchStreak: (...args: unknown[]) => touchStreakMock(...args),
  setFamilyShareEnabled: (...args: unknown[]) => setFamilyShareEnabledMock(...args),
}));

import { useProgress } from './useProgress';

describe('calcStreak', () => {
  it('starts at 1 on the very first visit', () => {
    expect(calcStreak(null, '2026-07-16', 0)).toBe(1);
  });

  it('does not change if already active today', () => {
    expect(calcStreak('2026-07-16', '2026-07-16', 3)).toBe(3);
  });

  it('increments if the last active day was yesterday', () => {
    expect(calcStreak('2026-07-15', '2026-07-16', 3)).toBe(4);
  });

  it('resets to 1 if a day was skipped', () => {
    expect(calcStreak('2026-07-10', '2026-07-16', 5)).toBe(1);
  });
});

describe('computeBadges', () => {
  it('locks all four badges with no progress', () => {
    const badges = computeBadges({ completedCount: 0, streakCount: 0, antiFraudDone: false, allLayersDone: false });
    expect(badges.every((b) => b.locked)).toBe(true);
    expect(badges).toHaveLength(4);
  });
});

describe('useProgress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing until a userId is available', () => {
    renderHook(() => useProgress(null));
    expect(fetchProgressMock).not.toHaveBeenCalled();
  });

  it('loads remote progress and re-touches the streak when the day changed', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: ['l1'],
      streakCount: 3,
      lastActiveDate: '2026-07-15',
      familyShareEnabled: true,
    });
    touchStreakMock.mockResolvedValue({ streakCount: 4, lastActiveDate: todayISO() });

    const { result } = renderHook(() => useProgress('u1'));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(fetchProgressMock).toHaveBeenCalledWith('u1');
    expect(touchStreakMock).toHaveBeenCalledWith('u1', todayISO(), calcStreak);
    expect(result.current.state.streakCount).toBe(4);
    expect(result.current.state.completedLessonIds).toEqual(['l1']);
  });

  it('does not re-touch the streak when already active today', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 2,
      lastActiveDate: todayISO(),
      familyShareEnabled: true,
    });

    const { result } = renderHook(() => useProgress('u1'));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(touchStreakMock).not.toHaveBeenCalled();
    expect(result.current.state.streakCount).toBe(2);
  });

  it('completeLesson calls markLessonCompleted and updates local state optimistically', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: todayISO(),
      familyShareEnabled: true,
    });
    markLessonCompletedMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProgress('u1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.completeLesson('l9');
    });

    expect(markLessonCompletedMock).toHaveBeenCalledWith('u1', 'l9');
    expect(result.current.state.completedLessonIds).toContain('l9');
  });

  it('setFamilyShare calls setFamilyShareEnabled and updates local state', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: todayISO(),
      familyShareEnabled: true,
    });
    setFamilyShareEnabledMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProgress('u1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.setFamilyShare(false);
    });

    expect(setFamilyShareEnabledMock).toHaveBeenCalledWith('u1', false);
    expect(result.current.state.familyShareEnabled).toBe(false);
  });
});
