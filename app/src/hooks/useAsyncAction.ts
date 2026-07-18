import { useCallback, useState } from 'react';
import { toFriendlyMessage } from '../lib/errors';

export interface UseAsyncActionResult<Args extends unknown[]> {
  busy: boolean;
  error: string | null;
  run: (...args: Args) => Promise<void>;
  clearError: () => void;
}

/**
 * Wrap a user-triggered async action (e.g. a button tap) with `busy`/`error` tracking.
 *
 * Counterpart to `useAsyncData`: where that hook fetches on mount/dep-change with retry,
 * this hook runs `fn` on demand via `run(...)` and swallows/records any rejection so
 * callers don't need hand-rolled try/catch/finally around event handlers.
 *
 * `run`'s identity depends on `fn` and `busy` (via `useCallback([fn, busy])`, the latter needed
 * so the re-entrancy guard below reads a fresh value) — callers are expected to pass a stable
 * `fn`, though an inline closure recreated each render is fine too since `run` is invoked from
 * event handlers, not used as an effect dependency in the planned call sites. Because `busy` is
 * in the deps, `run`'s identity also changes on every busy transition — don't put `run` itself
 * in an effect/memo dependency array, or it will re-fire on every action start/stop.
 *
 * `run` is re-entrancy-guarded: calling it again while a prior call is still in flight is a
 * no-op (the second call returns immediately without invoking `fn`), so two overlapping runs
 * can never race to set `busy`/`error` out of order.
 */
export function useAsyncAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<void>,
  fallbackMessage: string,
): UseAsyncActionResult<Args> {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await fn(...args);
      } catch (err) {
        setError(toFriendlyMessage(err, fallbackMessage));
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, busy],
  );

  const clearError = useCallback(() => setError(null), []);

  return { busy, error, run, clearError };
}
