import { vi } from 'vitest';

const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  },
}));

import { fetchComments, postComment, likeComment } from './comments';

describe('fetchComments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('joins comment rows with author display names', async () => {
    const commentsOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'c1', family_user_id: 'f1', comment_text: '好叻呀！', liked: false, created_at: '2026-07-18T10:00:00Z' },
        { id: 'c2', family_user_id: 'f2', comment_text: '加油！', liked: true, created_at: '2026-07-17T10:00:00Z' },
      ],
      error: null,
    });
    const commentsEq = vi.fn(() => ({ order: commentsOrder }));
    const commentsSelect = vi.fn(() => ({ eq: commentsEq }));

    const profilesIn = vi.fn().mockResolvedValue({
      data: [
        { user_id: 'f1', display_name: '陳小姐' },
        { user_id: 'f2', display_name: null },
      ],
      error: null,
    });
    const profilesSelect = vi.fn(() => ({ in: profilesIn }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_family_comments') return { select: commentsSelect };
      if (table === 'elder_profiles') return { select: profilesSelect };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await fetchComments('e1');

    expect(commentsEq).toHaveBeenCalledWith('elder_user_id', 'e1');
    expect(commentsOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(profilesIn).toHaveBeenCalledWith('user_id', ['f1', 'f2']);
    expect(result).toEqual([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
      { id: 'c2', familyUserId: 'f2', familyDisplayName: null, commentText: '加油！', liked: true, createdAt: '2026-07-17T10:00:00Z' },
    ]);
  });

  it('returns an empty array without querying profiles when there are no comments', async () => {
    const commentsOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const commentsEq = vi.fn(() => ({ order: commentsOrder }));
    const commentsSelect = vi.fn(() => ({ eq: commentsEq }));
    const profilesSelect = vi.fn();
    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_family_comments') return { select: commentsSelect };
      if (table === 'elder_profiles') return { select: profilesSelect };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await fetchComments('e1');

    expect(result).toEqual([]);
    expect(profilesSelect).not.toHaveBeenCalled();
  });

  it('throws when the comments query errors', async () => {
    const commentsOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const commentsEq = vi.fn(() => ({ order: commentsOrder }));
    const commentsSelect = vi.fn(() => ({ eq: commentsEq }));
    fromMock.mockReturnValue({ select: commentsSelect });

    await expect(fetchComments('e1')).rejects.toThrow('boom');
  });
});

describe('postComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a comment authored by the current user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'f1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await postComment('e1', '好叻呀！');

    expect(insert).toHaveBeenCalledWith({ elder_user_id: 'e1', family_user_id: 'f1', comment_text: '好叻呀！' });
  });

  it('throws when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(postComment('e1', '好叻呀！')).rejects.toThrow('not authenticated');
  });

  it('throws when the insert fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'f1' } } });
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    fromMock.mockReturnValue({ insert });

    await expect(postComment('e1', '好叻呀！')).rejects.toThrow('boom');
  });
});

describe('likeComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets liked to true for the given comment id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    await likeComment('c1');

    expect(update).toHaveBeenCalledWith({ liked: true });
    expect(eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('throws when the update fails', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    await expect(likeComment('c1')).rejects.toThrow('boom');
  });
});
