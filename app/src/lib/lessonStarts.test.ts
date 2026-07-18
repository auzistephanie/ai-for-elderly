import { vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { logLessonStart } from './lessonStarts';

describe('logLessonStart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a start record for the given user and lesson', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await logLessonStart('u1', 'l1');

    expect(fromMock).toHaveBeenCalledWith('elder_lesson_starts');
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', lesson_id: 'l1' });
  });

  it('throws a friendly message (not the raw Supabase error) when the insert fails', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'TypeError: Failed to fetch' } });
    fromMock.mockReturnValue({ insert });

    await expect(logLessonStart('u1', 'l1')).rejects.toThrow('課堂開始紀錄唔到');
  });
});
