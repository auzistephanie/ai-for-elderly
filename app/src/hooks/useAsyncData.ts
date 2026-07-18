import { useCallback, useEffect, useState } from 'react';
import { toFriendlyMessage } from '../lib/errors';

export interface UseAsyncDataResult<T> {
  data: T | undefined;
  error: string | null;
  loaded: boolean;
  busy: boolean;
  reload: () => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Fetch `T` via `fetcher`, re-running whenever `deps` change or `reload()` is called.
 *
 * - On failure, `data` is left at its last successful value (not cleared) — "keep last
 *   known good data" is intentional, so a transient error doesn't blank the screen.
 * - `loaded` only ever flips `false → true` once; it does not reset on later dep-driven
 *   refetches, so use `busy` (not `loaded`) as the signal for "a fetch is in flight now."
 * - `setData` is an optimistic-update escape hatch and should only be called when
 *   `busy === false`. Calling it while a fetch is pending is safe from a crash standpoint,
 *   but that fetch's own result can land afterward and silently overwrite the optimistic
 *   value with no signal to the caller.
 * - `deps` must include every value `fetcher` closes over from outside itself, same as a
 *   normal `useEffect` deps array. `fetcher` and `fallbackMessage` themselves are assumed
 *   stable per caller (wrapped in `useCallback` / a literal string) and are intentionally
 *   left out of the effect's own deps.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  fallbackMessage: string,
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true);
    fetcher()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(toFriendlyMessage(err, fallbackMessage));
      })
      .finally(() => {
        if (!active) return;
        setLoaded(true);
        setBusy(false);
      });
    return () => {
      active = false;
    };
    // deps + reloadToken intentionally drive re-fetching; fetcher/fallbackMessage are expected
    // to be stable per caller (wrapped in useCallback / literal string) same as useLessons' and
    // FamilyFlow's pre-existing hand-rolled effects this replaces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, error, loaded, busy, reload, setData };
}
