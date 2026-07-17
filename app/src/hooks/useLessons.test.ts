import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { useLessons } from './useLessons';

describe('useLessons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads published lessons ordered by layer then number', async () => {
    const then = (cb: (result: { data: unknown }) => void) =>
      cb({
        data: [
          {
            id: 'lesson-001',
            layer: 1,
            number: 1,
            title: 'AI 係咩',
            subtitle: '第一課',
            steps: [{ kind: 'why', title: 'W', body: [], speak: 's' }],
          },
        ],
      });
    const order2 = vi.fn(() => ({ then }));
    const order1 = vi.fn(() => ({ order: order2 }));
    const eq = vi.fn(() => ({ order: order1 }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    const { result } = renderHook(() => useLessons());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(fromMock).toHaveBeenCalledWith('elder_lessons');
    expect(eq).toHaveBeenCalledWith('status', 'published');
    expect(result.current.lessons).toHaveLength(1);
    expect(result.current.lessons[0].id).toBe('lesson-001');
    expect(result.current.error).toBeNull();
  });

  it('exposes an error instead of silently reporting zero lessons when the query fails', async () => {
    const then = (cb: (result: { data: unknown; error: unknown }) => void) =>
      cb({ data: null, error: { message: 'network down' } });
    const order2 = vi.fn(() => ({ then }));
    const order1 = vi.fn(() => ({ order: order2 }));
    const eq = vi.fn(() => ({ order: order1 }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    const { result } = renderHook(() => useLessons());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe('network down');
    expect(result.current.lessons).toEqual([]);
  });
});
