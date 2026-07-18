import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useAsyncAction } from './useAsyncAction';

describe('useAsyncAction', () => {
  it('runs the action and stays error-free on success', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAsyncAction(fn, '發生錯誤，請再試'));

    await act(async () => {
      await result.current.run('arg1');
    });

    expect(fn).toHaveBeenCalledWith('arg1');
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('sets busy=true while the action is in flight', async () => {
    let resolveAction: () => void = () => {};
    const fn = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolveAction = r; }));
    const { result } = renderHook(() => useAsyncAction(fn, '發生錯誤，請再試'));

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.run();
    });
    expect(result.current.busy).toBe(true);

    resolveAction();
    await act(async () => {
      await runPromise;
    });
    expect(result.current.busy).toBe(false);
  });

  it('captures the thrown Error message and swallows the rejection', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('撳讚失敗，請再試'));
    const { result } = renderHook(() => useAsyncAction(fn, '發生錯誤，請再試'));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe('撳讚失敗，請再試');
    expect(result.current.busy).toBe(false);
  });

  it('falls back to the given message for a non-Error rejection', async () => {
    const fn = vi.fn().mockRejectedValue('boom');
    const { result } = renderHook(() => useAsyncAction(fn, '發生錯誤，請再試'));

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe('發生錯誤，請再試');
  });

  it('clears a previous error at the start of a new run', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('first fail')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAsyncAction(fn, '發生錯誤，請再試'));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe('first fail');

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBeNull();
  });

  it('clearError() clears the error without running the action', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAsyncAction(fn, '發生錯誤，請再試'));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBe('boom');

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores a second run() call while the first is still in flight', async () => {
    let resolveFirst: () => void = () => {};
    const fn = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolveFirst = r; }));
    const { result } = renderHook(() => useAsyncAction(fn, '發生錯誤，請再試'));

    let firstRun!: Promise<void>;
    act(() => {
      firstRun = result.current.run('a');
    });
    expect(result.current.busy).toBe(true);

    // A second call while the first is still pending should be a no-op — fn is not invoked again.
    await act(async () => {
      await result.current.run('b');
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');

    resolveFirst();
    await act(async () => {
      await firstRun;
    });
    expect(result.current.busy).toBe(false);
  });
});
