import { renderHook, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useAsyncData } from './useAsyncData';

describe('useAsyncData', () => {
  it('loads data and reports loaded=true, error=null on success', async () => {
    const fetcher = vi.fn().mockResolvedValue(['a', 'b']);
    const { result } = renderHook(() => useAsyncData(fetcher, [], '發生錯誤，請再試'));

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.data).toEqual(['a', 'b']);
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('exposes the thrown Error message on failure, and leaves data undefined', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useAsyncData(fetcher, [], '發生錯誤，請再試'));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe('network down');
    expect(result.current.data).toBeUndefined();
  });

  it('falls back to the given message when a non-Error is thrown', async () => {
    const fetcher = vi.fn().mockRejectedValue('boom');
    const { result } = renderHook(() => useAsyncData(fetcher, [], '發生錯誤，請再試'));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBe('發生錯誤，請再試');
  });

  it('sets busy=true while a fetch (including reload) is in flight', async () => {
    let resolveFetch: (v: string) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFetch = r; }))
      .mockResolvedValueOnce('second');

    const { result } = renderHook(() => useAsyncData(fetcher, [], '發生錯誤，請再試'));
    expect(result.current.busy).toBe(true);

    resolveFetch('first');
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.data).toBe('first');

    act(() => result.current.reload());
    expect(result.current.busy).toBe(true);
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current.data).toBe('second');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale first fetch that resolves after a newer reload has already resolved', async () => {
    let resolveFirst: (v: string) => void = () => {};
    let resolveSecond: (v: string) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));

    const { result } = renderHook(() => useAsyncData(fetcher, [], '發生錯誤，請再試'));
    expect(result.current.busy).toBe(true);

    // Trigger reload while the first fetch is still pending.
    act(() => result.current.reload());
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Resolve the *newer* (second) call first, then the *stale* (first) call after.
    act(() => resolveSecond('second'));
    await waitFor(() => expect(result.current.data).toBe('second'));

    act(() => resolveFirst('first'));
    // Give the stale promise's .then a chance to run, if it were going to.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.data).toBe('second');
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('reload() re-invokes the fetcher and clears a previous error on success', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValueOnce('recovered');

    const { result } = renderHook(() => useAsyncData(fetcher, [], '發生錯誤，請再試'));
    await waitFor(() => expect(result.current.error).toBe('first fail'));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('recovered'));
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when a dependency changes', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    let dep = 'a';
    const { rerender } = renderHook(() => useAsyncData(fetcher, [dep], '發生錯誤，請再試'));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    dep = 'b';
    rerender();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it('setData lets a caller optimistically patch the cached value without refetching', async () => {
    const fetcher = vi.fn().mockResolvedValue({ count: 1 });
    // Explicit generic: vi.fn()'s inferred call signature isn't concrete enough for TS to
    // carry T through to setData's union-typed updater parameter under `tsc -b`'s stricter
    // project-build settings (unlike the looser `tsc --noEmit` default check), which otherwise
    // leaves `prev` an implicit `any` below.
    const { result } = renderHook(() => useAsyncData<{ count: number }>(fetcher, [], '發生錯誤，請再試'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.setData((prev) => ({ count: (prev?.count ?? 0) + 1 })));

    expect(result.current.data).toEqual({ count: 2 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
