import { renderHook, act } from '@testing-library/react';
import { calcStreak, computeBadges, useProgress } from './useProgress';

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
    const badges = computeBadges({
      completedCount: 0,
      streakCount: 0,
      antiFraudDone: false,
      allLayersDone: false,
    });
    expect(badges.every((b) => b.locked)).toBe(true);
    expect(badges).toHaveLength(4);
  });

  it('unlocks 初次見面 after one completed lesson and 連學5日 at streak >= 5', () => {
    const badges = computeBadges({
      completedCount: 1,
      streakCount: 5,
      antiFraudDone: false,
      allLayersDone: false,
    });
    expect(badges.find((b) => b.id === 'first-lesson')?.locked).toBe(false);
    expect(badges.find((b) => b.id === 'streak-5')?.locked).toBe(false);
    expect(badges.find((b) => b.id === 'anti-fraud')?.locked).toBe(true);
    expect(badges.find((b) => b.id === 'ai-master')?.locked).toBe(true);
  });
});

describe('useProgress', () => {
  beforeEach(() => localStorage.clear());

  it('persists a completed lesson across a full remount (simulating app reload)', () => {
    const first = renderHook(() => useProgress());
    act(() => first.result.current.completeLesson('lesson-001'));
    first.unmount();

    const second = renderHook(() => useProgress());
    expect(second.result.current.state.completedLessonIds).toContain('lesson-001');
  });

  it('persists the family share toggle across a full remount', () => {
    const first = renderHook(() => useProgress());
    act(() => first.result.current.setFamilyShare(false));
    first.unmount();

    const second = renderHook(() => useProgress());
    expect(second.result.current.state.familyShareEnabled).toBe(false);
  });
});
