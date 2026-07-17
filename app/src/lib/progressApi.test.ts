import { vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { fetchProgress, markLessonCompleted, touchStreak, setFamilyShareEnabled } from './progressApi';

describe('fetchProgress', () => {
  it('combines completions, streak, and share-flag queries', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_lesson_completions') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ lesson_id: 'l1' }, { lesson_id: 'l2' }] }) }) };
      }
      if (table === 'elder_streaks') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { streak_count: 3, last_active_date: '2026-07-16' } }) }),
          }),
        };
      }
      if (table === 'elder_profiles') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { family_share_enabled: false } }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await fetchProgress('u1');
    expect(result).toEqual({
      completedLessonIds: ['l1', 'l2'],
      streakCount: 3,
      lastActiveDate: '2026-07-16',
      familyShareEnabled: false,
    });
  });
});

describe('markLessonCompleted', () => {
  it('upserts with ignoreDuplicates so re-completing is a no-op', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert });

    await markLessonCompleted('u1', 'l1');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', lesson_id: 'l1' },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: true },
    );
  });
});

describe('touchStreak', () => {
  it('does not write again if already active today', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { streak_count: 4, last_active_date: '2026-07-16' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const upsert = vi.fn();
    fromMock.mockReturnValue({ select, upsert });

    const calcStreak = vi.fn();
    const result = await touchStreak('u1', '2026-07-16', calcStreak);

    expect(result).toEqual({ streakCount: 4, lastActiveDate: '2026-07-16' });
    expect(upsert).not.toHaveBeenCalled();
    expect(calcStreak).not.toHaveBeenCalled();
  });

  it('computes and upserts the new streak when the day changed', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { streak_count: 4, last_active_date: '2026-07-15' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ select, upsert });

    const calcStreak = vi.fn().mockReturnValue(5);
    const result = await touchStreak('u1', '2026-07-16', calcStreak);

    expect(calcStreak).toHaveBeenCalledWith('2026-07-15', '2026-07-16', 4);
    expect(result).toEqual({ streakCount: 5, lastActiveDate: '2026-07-16' });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', streak_count: 5, last_active_date: '2026-07-16' }),
    );
  });
});

describe('setFamilyShareEnabled', () => {
  it('updates the profile row', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    await setFamilyShareEnabled('u1', false);
    expect(update).toHaveBeenCalledWith({ family_share_enabled: false });
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
  });
});
