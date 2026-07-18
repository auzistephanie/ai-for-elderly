# Error/Retry-Shape Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the AI老友記 app's four inconsistent error/retry UI shapes and two lib-layer bugs onto one convention: every `lib/*.ts` function throws an `Error` with a ready-to-display Cantonese message, and two shared hooks (`useAsyncData` for fetch+retry, `useAsyncAction` for user-triggered actions) replace the hand-rolled `busy`/`error`/`try-catch` boilerplate duplicated across 8 files.

**Architecture:** Bottom-up: build the shared primitives first (`lib/errors.ts`, `hooks/useAsyncData.ts`, `hooks/useAsyncAction.ts`, `components/ErrorRetry.tsx`), fix the two lib-layer bugs, then migrate each hook/component onto the primitives one at a time, verifying the full suite stays green after every task.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react + @testing-library/user-event, Supabase JS client (mocked in tests via `vi.mock`).

**Design doc:** `docs/superpowers/specs/2026-07-18-error-retry-consolidation-design.md`

**Repo root for all paths below:** `/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly/app/` (all file paths are relative to this `app/` directory unless stated otherwise)

**Test command:** `npm test` (= `vitest run`). **Lint:** `npm run lint` (= `oxlint`). **Build:** `npm run build` (= `tsc -b && vite build`). Run all three from the `app/` directory.

---

## Task 1: `toFriendlyMessage` helper

**Files:**
- Create: `src/lib/errors.ts`
- Test: `src/lib/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/errors.test.ts
import { toFriendlyMessage } from './errors';

describe('toFriendlyMessage', () => {
  it('returns the Error message when given a real Error with a message', () => {
    expect(toFriendlyMessage(new Error('攞唔到進度，請再試'), '發生錯誤，請再試')).toBe('攞唔到進度，請再試');
  });

  it('returns the fallback when given a non-Error value', () => {
    expect(toFriendlyMessage({ message: 'raw supabase error' }, '發生錯誤，請再試')).toBe('發生錯誤，請再試');
  });

  it('returns the fallback when given an Error with an empty message', () => {
    expect(toFriendlyMessage(new Error(''), '發生錯誤，請再試')).toBe('發生錯誤，請再試');
  });

  it('returns the fallback for a thrown string', () => {
    expect(toFriendlyMessage('boom', '發生錯誤，請再試')).toBe('發生錯誤，請再試');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/errors.test.ts`
Expected: FAIL — `Cannot find module './errors'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/errors.ts
export function toFriendlyMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/errors.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts src/lib/errors.test.ts
git commit -m "feat: add toFriendlyMessage error-message helper"
```

---

## Task 2: `useAsyncData` hook

**Files:**
- Create: `src/hooks/useAsyncData.ts`
- Test: `src/hooks/useAsyncData.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useAsyncData.test.ts
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
    const { result } = renderHook(() => useAsyncData(fetcher, [], '發生錯誤，請再試'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => result.current.setData((prev) => ({ count: (prev?.count ?? 0) + 1 })));

    expect(result.current.data).toEqual({ count: 2 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useAsyncData.test.ts`
Expected: FAIL — `Cannot find module './useAsyncData'`

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useAsyncData.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useAsyncData.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAsyncData.ts src/hooks/useAsyncData.test.ts
git commit -m "feat: add useAsyncData hook for fetch+retry with optimistic updates"
```

---

## Task 3: `useAsyncAction` hook

**Files:**
- Create: `src/hooks/useAsyncAction.ts`
- Test: `src/hooks/useAsyncAction.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useAsyncAction.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useAsyncAction.test.ts`
Expected: FAIL — `Cannot find module './useAsyncAction'`

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useAsyncAction.ts
import { useCallback, useState } from 'react';
import { toFriendlyMessage } from '../lib/errors';

export interface UseAsyncActionResult<Args extends unknown[]> {
  busy: boolean;
  error: string | null;
  run: (...args: Args) => Promise<void>;
  clearError: () => void;
}

export function useAsyncAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<void>,
  fallbackMessage: string,
): UseAsyncActionResult<Args> {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
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
    [fn],
  );

  const clearError = useCallback(() => setError(null), []);

  return { busy, error, run, clearError };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useAsyncAction.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAsyncAction.ts src/hooks/useAsyncAction.test.ts
git commit -m "feat: add useAsyncAction hook for user-triggered async actions"
```

---

## Task 4: `<ErrorRetry>` shared component

**Files:**
- Create: `src/components/ErrorRetry.tsx`
- Test: `src/components/ErrorRetry.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ErrorRetry.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ErrorRetry } from './ErrorRetry';

describe('ErrorRetry', () => {
  it('shows the message and a 再試一次 button that calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorRetry message="攞唔到課堂內容：network down" onRetry={onRetry} />);

    expect(screen.getByText('攞唔到課堂內容：network down')).toBeInTheDocument();
    await userEvent.click(screen.getByText('再試一次'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a disabled 再試緊… state while busy', () => {
    render(<ErrorRetry message="boom" onRetry={vi.fn()} busy />);

    const button = screen.getByText('再試緊…');
    expect(button).toBeDisabled();
    expect(screen.queryByText('再試一次')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ErrorRetry.test.tsx`
Expected: FAIL — `Cannot find module './ErrorRetry'`

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ErrorRetry.tsx
interface ErrorRetryProps {
  message: string;
  onRetry: () => void;
  busy?: boolean;
}

export function ErrorRetry({ message, onRetry, busy }: ErrorRetryProps) {
  return (
    <div className="app">
      <div className="screen">
        <div className="fam-card">
          <p className="error-text">{message}</p>
          <button className="bigbtn" disabled={busy} onClick={onRetry}>
            {busy ? '再試緊…' : '再試一次'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ErrorRetry.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorRetry.tsx src/components/ErrorRetry.test.tsx
git commit -m "feat: add shared ErrorRetry component"
```

---

## Task 5: Fix `progressApi.ts`'s raw-throw bug

**Files:**
- Modify: `src/lib/progressApi.ts`
- Test: `src/lib/progressApi.test.ts`

This is the bug from design doc §2/§3: every failure path currently does `throw completionsError` (the raw Supabase error object, not an `Error`), so any caller doing `err instanceof Error ? err.message : fallback` always takes the fallback branch and silently discards the real message.

- [ ] **Step 1: Update the failing tests**

Replace the three `.rejects.toEqual({ message: 'boom' })` assertions with `.rejects.toThrow(...)` assertions against the new friendly messages, in `src/lib/progressApi.test.ts`:

```ts
// Replace this test in the `fetchProgress` describe block:
  it('throws instead of silently defaulting when a query returns an error', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_lesson_completions') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
          }),
        };
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

    await expect(fetchProgress('u1')).rejects.toThrow('攞唔到進度，請再試');
  });

// Replace the corresponding assertion in `markLessonCompleted`:
  it('throws a friendly Error (not the raw Supabase error) when the upsert returns an error', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    fromMock.mockReturnValue({ upsert });

    await expect(markLessonCompleted('u1', 'l1')).rejects.toThrow('完成課堂紀錄唔到，請再試');
  });

// Replace the corresponding assertion in `touchStreak`:
  it('throws a friendly Error (not the raw Supabase error) when the upsert returns an error', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { streak_count: 4, last_active_date: '2026-07-15' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    fromMock.mockReturnValue({ select, upsert });

    const calcStreak = vi.fn().mockReturnValue(5);
    await expect(touchStreak('u1', '2026-07-16', calcStreak)).rejects.toThrow('攞唔到進度，請再試');
  });

// Replace the corresponding assertion in `setFamilyShareEnabled`:
  it('throws a friendly Error (not the raw Supabase error) when the update returns an error', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    await expect(setFamilyShareEnabled('u1', false)).rejects.toThrow('設定失敗，請再試');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/progressApi.test.ts`
Expected: FAIL — actual rejected values are still the raw `{message: 'boom'}` objects, `.rejects.toThrow(...)` fails because the rejection isn't an `Error`.

- [ ] **Step 3: Fix the implementation**

```ts
// src/lib/progressApi.ts — replace the full file
import { supabase } from './supabaseClient';

export interface RemoteProgress {
  completedLessonIds: string[];
  streakCount: number;
  lastActiveDate: string | null;
  familyShareEnabled: boolean;
}

export async function fetchProgress(userId: string): Promise<RemoteProgress> {
  const [
    { data: completions, error: completionsError },
    { data: streak, error: streakError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase.from('elder_lesson_completions').select('lesson_id').eq('user_id', userId),
    supabase.from('elder_streaks').select('streak_count,last_active_date').eq('user_id', userId).maybeSingle(),
    supabase.from('elder_profiles').select('family_share_enabled').eq('user_id', userId).maybeSingle(),
  ]);

  if (completionsError) throw new Error(completionsError.message ?? '攞唔到進度，請再試');
  if (streakError) throw new Error(streakError.message ?? '攞唔到進度，請再試');
  if (profileError) throw new Error(profileError.message ?? '攞唔到進度，請再試');

  return {
    completedLessonIds: (completions ?? []).map((row: { lesson_id: string }) => row.lesson_id),
    streakCount: streak?.streak_count ?? 0,
    lastActiveDate: streak?.last_active_date ?? null,
    familyShareEnabled: profile?.family_share_enabled ?? true,
  };
}

export async function markLessonCompleted(userId: string, lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('elder_lesson_completions')
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true });

  if (error) throw new Error(error.message ?? '完成課堂紀錄唔到，請再試');
}

export async function touchStreak(
  userId: string,
  today: string,
  calcStreak: (lastActiveDate: string | null, today: string, prevCount: number) => number,
): Promise<{ streakCount: number; lastActiveDate: string }> {
  const { data: existing } = await supabase
    .from('elder_streaks')
    .select('streak_count,last_active_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.last_active_date === today) {
    return { streakCount: existing.streak_count, lastActiveDate: today };
  }

  const nextCount = calcStreak(existing?.last_active_date ?? null, today, existing?.streak_count ?? 0);
  const { error } = await supabase
    .from('elder_streaks')
    .upsert({ user_id: userId, streak_count: nextCount, last_active_date: today, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message ?? '攞唔到進度，請再試');

  return { streakCount: nextCount, lastActiveDate: today };
}

export async function setFamilyShareEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('elder_profiles').update({ family_share_enabled: enabled }).eq('user_id', userId);

  if (error) throw new Error(error.message ?? '設定失敗，請再試');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/progressApi.test.ts`
Expected: PASS (all tests, including the 3 unchanged success-path tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progressApi.ts src/lib/progressApi.test.ts
git commit -m "fix: progressApi throws friendly Error instead of raw Supabase error object"
```

---

## Task 6: `auth.ts` throw-based OTP functions + `LoginScreen` on `useAsyncAction`

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth.test.ts`
- Modify: `src/components/LoginScreen.tsx`
- Modify: `src/components/LoginScreen.test.tsx`

`requestOtp`/`verifyOtp` change from returning `{ error: string | null }` to throwing `Error`, matching `ensureProfile`'s existing convention (design doc §3). This must land together with `LoginScreen.tsx` since it's the only caller.

- [ ] **Step 1: Update `auth.test.ts`**

```ts
// src/lib/auth.test.ts — replace the requestOtp and verifyOtp describe blocks
describe('requestOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signInWithOtp with the normalized phone on success', async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    await requestOtp('91234567');
    expect(signInWithOtpMock).toHaveBeenCalledWith({ phone: '+85291234567' });
  });

  it('throws a friendly message on failure', async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: 'boom' } });
    await expect(requestOtp('91234567')).rejects.toThrow('傳送失敗，check 下電話號碼啱唔啱');
  });
});

describe('fetchDisplayedOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the code from the RPC', async () => {
    rpcMock.mockResolvedValue({ data: '561166', error: null });
    const code = await fetchDisplayedOtp('91234567');
    expect(rpcMock).toHaveBeenCalledWith('get_pending_otp', { p_phone: '+85291234567' });
    expect(code).toBe('561166');
  });

  it('returns null on error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await fetchDisplayedOtp('91234567')).toBeNull();
  });
});

describe('verifyOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls supabase verifyOtp with the sms type on success', async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    await verifyOtp('91234567', '561166');
    expect(verifyOtpMock).toHaveBeenCalledWith({ phone: '+85291234567', token: '561166', type: 'sms' });
  });

  it('throws a friendly message on failure', async () => {
    verifyOtpMock.mockResolvedValue({ error: { message: 'boom' } });
    await expect(verifyOtp('91234567', '561166')).rejects.toThrow('驗證失敗，撳返去重新傳送');
  });
});
```

Leave `toE164` and `ensureProfile` describe blocks unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/auth.test.ts`
Expected: FAIL — `requestOtp`/`verifyOtp` still return `{error}` objects instead of throwing.

- [ ] **Step 3: Update `auth.ts`**

```ts
// src/lib/auth.ts — replace requestOtp and verifyOtp; toE164, fetchDisplayedOtp, ensureProfile unchanged
export async function requestOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
  if (error) throw new Error('傳送失敗，check 下電話號碼啱唔啱');
}

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'sms' });
  if (error) throw new Error('驗證失敗，撳返去重新傳送');
}
```

(Keep `toE164`, `fetchDisplayedOtp`, `ensureProfile` exactly as they are today.)

- [ ] **Step 4: Run `auth.test.ts` to verify it passes**

Run: `npm test -- src/lib/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Update `LoginScreen.test.tsx`**

`requestOtp`/`verifyOtp` mocks change from resolving `{error}` objects to resolving `undefined` / rejecting:

```tsx
// src/components/LoginScreen.test.tsx — replace the whole file
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const requestOtpMock = vi.fn();
const fetchDisplayedOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const ensureProfileMock = vi.fn();

vi.mock('../lib/auth', () => ({
  requestOtp: (...args: unknown[]) => requestOtpMock(...args),
  fetchDisplayedOtp: (...args: unknown[]) => fetchDisplayedOtpMock(...args),
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
  ensureProfile: (...args: unknown[]) => ensureProfileMock(...args),
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('walks through role choice -> name -> phone -> OTP confirm -> onLoggedIn', async () => {
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue(undefined);
    ensureProfileMock.mockResolvedValue('elder');

    const onLoggedIn = vi.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    await userEvent.click(screen.getByText('我係長者'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳生');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('561166')).toBeInTheDocument();

    await userEvent.click(screen.getByText('確認登入'));

    expect(verifyOtpMock).toHaveBeenCalledWith('91234567', '561166');
    expect(ensureProfileMock).toHaveBeenCalledWith('elder', '陳生');
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('disables the next button until a name is entered', async () => {
    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係仔女'));
    expect(screen.getByText('下一步')).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    expect(screen.getByText('下一步')).not.toBeDisabled();
  });

  it('shows an error and stays on the phone step when sending fails', async () => {
    requestOtpMock.mockRejectedValue(new Error('傳送失敗，check 下電話號碼啱唔啱'));

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係仔女'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('傳送失敗，check 下電話號碼啱唔啱')).toBeInTheDocument();
  });

  it('shows an error when the OTP never becomes available after a retry', async () => {
    // The 1s internal retry delay in handleSendOtp races against RTL's default ~1000ms
    // findByText timeout — fake timers avoid a flaky test, same approach as
    // FamilyScreen.test.tsx's countdown tests already use in this suite.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue(null);

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await user.click(screen.getByText('我係仔女'));
    await user.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    await user.click(screen.getByText('下一步'));
    await user.type(screen.getByPlaceholderText('912345678'), '91234567');
    await user.click(screen.getByText('傳送驗證碼'));

    await vi.advanceTimersByTimeAsync(1000);

    expect(await screen.findByText('攞唔到驗證碼，撳「傳送驗證碼」再試多次')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows verifyOtp\'s thrown message when verification fails', async () => {
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockRejectedValue(new Error('驗證失敗，撳返去重新傳送'));

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係長者'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳生');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));
    expect(await screen.findByText('561166')).toBeInTheDocument();

    await userEvent.click(screen.getByText('確認登入'));

    expect(await screen.findByText('驗證失敗，撳返去重新傳送')).toBeInTheDocument();
  });

  it('recovers when ensureProfile throws after a successful verifyOtp', async () => {
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue(undefined);
    ensureProfileMock.mockRejectedValue(new Error('boom'));

    const onLoggedIn = vi.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    await userEvent.click(screen.getByText('我係長者'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳生');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('561166')).toBeInTheDocument();

    const confirmBtn = screen.getByText('確認登入');
    await userEvent.click(confirmBtn);

    expect(await screen.findByText('登入失敗，請再試一次')).toBeInTheDocument();
    expect(onLoggedIn).not.toHaveBeenCalled();
    expect(confirmBtn).not.toBeDisabled();
  });
});
```

- [ ] **Step 6: Run `LoginScreen.test.tsx` to verify it fails**

Run: `npm test -- src/components/LoginScreen.test.tsx`
Expected: FAIL — `LoginScreen.tsx` still destructures `{error}` from the now-throwing `requestOtp`/`verifyOtp`.

- [ ] **Step 7: Rewrite `LoginScreen.tsx` on `useAsyncAction`**

```tsx
// src/components/LoginScreen.tsx — replace the full file
import { useState } from 'react';
import { requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from '../lib/auth';
import { useAsyncAction } from '../hooks/useAsyncAction';
import type { UserRole } from '../types/auth';

type Step = 'choose-role' | 'enter-name' | 'enter-phone' | 'confirm-otp';

interface LoginScreenProps {
  onLoggedIn: () => void;
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('choose-role');
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string | null>(null);

  const sendOtp = useAsyncAction(async () => {
    await requestOtp(phone);

    let code = await fetchDisplayedOtp(phone);
    if (!code) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      code = await fetchDisplayedOtp(phone);
    }
    if (!code) throw new Error('攞唔到驗證碼，撳「傳送驗證碼」再試多次');

    setOtp(code);
    setStep('confirm-otp');
  }, '傳送失敗，check 下電話號碼啱唔啱');

  const confirm = useAsyncAction(async () => {
    if (!otp || !role) return;
    await verifyOtp(phone, otp);
    try {
      await ensureProfile(role, name.trim());
    } catch {
      throw new Error('登入失敗，請再試一次');
    }
    onLoggedIn();
  }, '登入失敗，請再試一次');

  function handleBackToPhone() {
    setOtp(null);
    confirm.clearError();
    setStep('enter-phone');
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h2>AI老友記</h2>
      </div>

      {step === 'choose-role' && (
        <div className="fam-card">
          <p>邊個登入？</p>
          <button
            className="bigbtn"
            onClick={() => {
              setRole('elder');
              setStep('enter-name');
            }}
          >
            我係長者
          </button>
          <button
            className="bigbtn"
            onClick={() => {
              setRole('family');
              setStep('enter-name');
            }}
          >
            我係仔女
          </button>
        </div>
      )}

      {step === 'enter-name' && (
        <div className="fam-card">
          <p>你個名係？</p>
          <input
            className="phone-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="你個名"
          />
          <button className="bigbtn" disabled={!name.trim()} onClick={() => setStep('enter-phone')}>
            下一步
          </button>
        </div>
      )}

      {step === 'enter-phone' && (
        <div className="fam-card">
          <p>幫手輸入電話號碼</p>
          <input
            className="phone-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="912345678"
          />
          {sendOtp.error && <p className="error-text">{sendOtp.error}</p>}
          <button className="bigbtn" disabled={sendOtp.busy || phone.length < 8} onClick={() => sendOtp.run()}>
            {sendOtp.busy ? '傳送緊…' : '傳送驗證碼'}
          </button>
        </div>
      )}

      {step === 'confirm-otp' && (
        <div className="fam-card">
          <p>驗證碼：</p>
          {/* 呢個 app 用自訂 Send SMS Auth Hook 代替真實短訊，所以直接喺畫面度顯示驗證碼係故意噉樣設計，唔係漏咗做保安 — 詳見 Plan 2 設計文件。 */}
          <p className="otp-display">{otp}</p>
          {confirm.error && <p className="error-text">{confirm.error}</p>}
          <button className="bigbtn" disabled={confirm.busy} onClick={() => confirm.run()}>
            {confirm.busy ? '確認緊…' : '確認登入'}
          </button>
          {confirm.error && (
            <button className="bigbtn" onClick={handleBackToPhone}>
              撳呢度返去重新輸入電話
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run `LoginScreen.test.tsx` to verify it passes**

Run: `npm test -- src/components/LoginScreen.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 9: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — no other file imports `requestOtp`/`verifyOtp`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/components/LoginScreen.tsx src/components/LoginScreen.test.tsx
git commit -m "refactor: auth.ts OTP functions throw instead of returning {error}; LoginScreen uses useAsyncAction"
```

---

## Task 7: Rebuild `useLessons` on `useAsyncData`

**Files:**
- Modify: `src/hooks/useLessons.ts`
- Test: `src/hooks/useLessons.test.ts` (no changes expected — this task's own test run is the regression check)

Public return shape (`{ lessons, loaded, error, reload }`) is unchanged, so no consumer needs updating in this task.

- [ ] **Step 1: Confirm the existing test currently passes (baseline)**

Run: `npm test -- src/hooks/useLessons.test.ts`
Expected: PASS (3 tests, against the pre-refactor implementation)

- [ ] **Step 2: Rebuild the implementation on `useAsyncData`**

```ts
// src/hooks/useLessons.ts — replace the full file
import { useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAsyncData } from './useAsyncData';
import type { Lesson } from '../types/lesson';

export function useLessons() {
  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('elder_lessons')
      .select('id,layer,number,title,subtitle,steps')
      .eq('status', 'published')
      .order('layer', { ascending: true })
      .order('number', { ascending: true });
    if (error) throw new Error(error.message ?? '攞唔到課堂內容');
    return (data ?? []) as Lesson[];
  }, []);

  const { data, error, loaded, reload } = useAsyncData<Lesson[]>(fetcher, [], '攞唔到課堂內容');

  return { lessons: data ?? [], loaded, error, reload };
}
```

- [ ] **Step 3: Run test to verify it still passes**

Run: `npm test -- src/hooks/useLessons.test.ts`
Expected: PASS (same 3 tests, unmodified, now against the refactored implementation) — confirms the public contract (including the "error stays distinguishable from zero lessons" behavior and `reload()` re-invoking the query in isolation) is preserved.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLessons.ts
git commit -m "refactor: rebuild useLessons on useAsyncData (no public API change)"
```

---

## Task 8: Rebuild `useProgress` on `useAsyncData`

**Files:**
- Modify: `src/hooks/useProgress.ts`
- Modify: `src/hooks/useProgress.test.ts`

Gains `progressError`/`reloadProgress` (new — closes the Shape-D gap for the initial fetch). `completeLesson`/`setFamilyShare` keep throwing on failure exactly as before (they already had no try/catch); they now optimistically patch `useAsyncData`'s cache via `setData` instead of a local `useState` setter.

- [ ] **Step 1: Update `useProgress.test.ts`**

```ts
// src/hooks/useProgress.test.ts — replace the full file
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
    expect(result.current.progressError).toBeNull();
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

  it('exposes progressError and a working reloadProgress when the initial fetch fails', async () => {
    fetchProgressMock.mockRejectedValueOnce(new Error('攞唔到進度，請再試'));

    const { result } = renderHook(() => useProgress('u1'));
    await waitFor(() => expect(result.current.progressError).toBe('攞唔到進度，請再試'));

    fetchProgressMock.mockResolvedValueOnce({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: todayISO(),
      familyShareEnabled: true,
    });

    act(() => result.current.reloadProgress());
    await waitFor(() => expect(result.current.progressError).toBeNull());
    expect(fetchProgressMock).toHaveBeenCalledTimes(2);
  });

  it('completeLesson calls markLessonCompleted and optimistically updates local state once the write succeeds', async () => {
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
    expect(fetchProgressMock).toHaveBeenCalledTimes(1); // optimistic update, no refetch
  });

  it('completeLesson propagates the thrown error (caller decides how to show it)', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: todayISO(),
      familyShareEnabled: true,
    });
    markLessonCompletedMock.mockRejectedValue(new Error('完成課堂紀錄唔到，請再試'));

    const { result } = renderHook(() => useProgress('u1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await expect(result.current.completeLesson('l9')).rejects.toThrow('完成課堂紀錄唔到，請再試');
    expect(result.current.state.completedLessonIds).not.toContain('l9');
  });

  it('setFamilyShare calls setFamilyShareEnabled and optimistically updates local state', async () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useProgress.test.ts`
Expected: FAIL — `progressError`/`reloadProgress` don't exist yet on the old implementation.

- [ ] **Step 3: Rebuild the implementation**

```ts
// src/hooks/useProgress.ts — replace the full file
import { useCallback } from 'react';
import { fetchProgress, markLessonCompleted, setFamilyShareEnabled, touchStreak } from '../lib/progressApi';
import { useAsyncData } from './useAsyncData';

export interface Badge {
  id: string;
  icon: string;
  label: string;
  locked: boolean;
}

export interface ProgressState {
  completedLessonIds: string[];
  streakCount: number;
  lastActiveDate: string | null;
  familyShareEnabled: boolean;
}

const defaultState: ProgressState = {
  completedLessonIds: [],
  streakCount: 0,
  lastActiveDate: null,
  familyShareEnabled: true,
};

export function todayISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calcStreak(lastActiveDate: string | null, today: string, prevCount: number): number {
  if (lastActiveDate === today) return prevCount;
  if (!lastActiveDate) return 1;
  const diffDays = Math.round(
    (new Date(today).getTime() - new Date(lastActiveDate).getTime()) / 86_400_000,
  );
  return diffDays === 1 ? prevCount + 1 : 1;
}

export function computeBadges(state: {
  completedCount: number;
  streakCount: number;
  antiFraudDone: boolean;
  allLayersDone: boolean;
}): Badge[] {
  return [
    { id: 'first-lesson', icon: '🐣', label: '初次見面', locked: state.completedCount < 1 },
    { id: 'streak-5', icon: '🔥', label: '連學 5 日', locked: state.streakCount < 5 },
    { id: 'anti-fraud', icon: '🛡️', label: '防騙高手', locked: !state.antiFraudDone },
    { id: 'ai-master', icon: '🎓', label: 'AI 達人', locked: !state.allLayersDone },
  ];
}

export function useProgress(userId: string | null) {
  const fetcher = useCallback(async (): Promise<ProgressState> => {
    if (!userId) return defaultState;
    const remote = await fetchProgress(userId);
    const today = todayISO();
    if (remote.lastActiveDate === today) return remote;
    const touched = await touchStreak(userId, today, calcStreak);
    return { ...remote, streakCount: touched.streakCount, lastActiveDate: touched.lastActiveDate };
  }, [userId]);

  const {
    data,
    error: progressError,
    loaded,
    reload: reloadProgress,
    setData,
  } = useAsyncData<ProgressState>(fetcher, [userId], '攞唔到進度，請再試');

  const state = data ?? defaultState;

  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (!userId || state.completedLessonIds.includes(lessonId)) return;
      await markLessonCompleted(userId, lessonId);
      setData((prev) => ({
        ...(prev ?? defaultState),
        completedLessonIds: [...(prev ?? defaultState).completedLessonIds, lessonId],
      }));
    },
    [userId, state.completedLessonIds, setData],
  );

  const setFamilyShare = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      await setFamilyShareEnabled(userId, enabled);
      setData((prev) => ({ ...(prev ?? defaultState), familyShareEnabled: enabled }));
    },
    [userId, setData],
  );

  return { state, loaded, progressError, reloadProgress, completeLesson, setFamilyShare };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useProgress.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgress.ts src/hooks/useProgress.test.ts
git commit -m "feat: useProgress gains progressError/reloadProgress; optimistic updates via useAsyncData"
```

---

## Task 9: Make `useAuth`'s role-query error handling explicit

**Files:**
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/hooks/useAuth.test.ts`

Today, a query error on the `elder_profiles` role lookup already happens to degrade to `role: null` (the code destructures `{ data }` without checking `error`, and Supabase resolves `data: null` on a query error too) — but this is accidental, untested, and unreadable as intentional. This task makes it explicit and adds a regression test, per design doc §6.

- [ ] **Step 1: Add the failing test**

Add this test inside the existing `describe('useAuth', ...)` block in `src/hooks/useAuth.test.ts`, after the "resolves the role..." test:

```ts
  it('treats a role-query error the same as no role found, rather than crashing or hanging', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'network down' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe('signed-in'));
    expect(result.current.userId).toBe('u1');
    expect(result.current.role).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `npm test -- src/hooks/useAuth.test.ts`
Expected: PASS already (this documents the existing accidental-but-correct fallback) — this step is a characterization check, not a red/green TDD step, since Step 3 doesn't change observable behavior.

- [ ] **Step 3: Make the fallback explicit in the implementation**

```ts
// src/hooks/useAuth.ts:22-32 — replace the resolve() function body
    async function resolve(userId: string) {
      requestId += 1;
      const myRequestId = requestId;
      const { data, error } = await supabase
        .from('elder_profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active || myRequestId !== requestId) return;
      // A query error is treated the same as "no role row yet" rather than a separate error
      // state — App.tsx already renders a full error+retry screen whenever role is null
      // (it can't tell "signup didn't finish" from "the lookup itself failed", and doesn't
      // need to: both cases dead-end the same way, "attempt again").
      setState({ status: 'signed-in', userId, role: error ? null : ((data?.role as UserRole) ?? null) });
    }
```

- [ ] **Step 4: Run tests to verify they still pass**

Run: `npm test -- src/hooks/useAuth.test.ts`
Expected: PASS (4 tests, including the new one)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/useAuth.test.ts
git commit -m "test: make useAuth's role-query-error-as-null fallback explicit and covered"
```

---

## Task 10: `App.tsx` — `ErrorRetry` + wired-up `completeLesson`/`setFamilyShare` errors

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

`ElderShell` blocks on `lessonsError` OR `progressError` (both full-screen, via `<ErrorRetry>`); `FamilyFlow` moves its hand-rolled fetch onto `useAsyncData` + `<ErrorRetry>`. `completeLesson`/`setFamilyShare` get wrapped in local `useAsyncAction`s so their errors surface inline and the app only navigates away on actual success (closes the "fire and forget" gap noted in design doc §2/§6).

- [ ] **Step 1: Update `App.test.tsx`**

Two changes: (a) `useProgressMock` return values across the file gain `progressError: null, reloadProgress: vi.fn()` so `ElderShell` doesn't hit an `undefined` where it now expects a value; (b) a new test for the `completeLesson`-failure path.

Apply this find-and-replace across every `useProgressMock.mockReturnValue({...})` call in `src/App.test.tsx` (there are 9 occurrences — in the `mockElder` helper and in each of the individual `it()` blocks that call `useProgressMock.mockReturnValue` directly): add `progressError: null,` and `reloadProgress: vi.fn(),` alongside the existing `completeLesson`/`setFamilyShare` fields. For example, the `mockElder` helper becomes:

```tsx
  function mockElder(lessons: Lesson[], completedLessonIds: string[]) {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
    useLessonsMock.mockReturnValue({ lessons, loaded: true, error: null, reload: vi.fn() });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds, streakCount: 3, lastActiveDate: '2026-07-17', familyShareEnabled: true },
      loaded: true,
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });
  }
```

...and every other `useProgressMock.mockReturnValue({ state: {...}, loaded: ..., completeLesson: vi.fn(), setFamilyShare: vi.fn() })` in the file gains the same two extra fields (`progressError: null, reloadProgress: vi.fn(),`) right after `loaded`.

Then add these two new tests inside `describe('App auth gate', ...)`, after the existing "shows an error+retry message when useLessons fails..." test:

```tsx
  it('shows an error+retry message when useProgress fails to load, and retry calls reloadProgress()', async () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true, error: null, reload: vi.fn() });
    const reloadProgressMock = vi.fn();
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: true,
      progressError: '攞唔到進度，請再試',
      reloadProgress: reloadProgressMock,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText('攞唔到進度，請再試')).toBeInTheDocument();
    await userEvent.click(screen.getByText('再試一次'));
    expect(reloadProgressMock).toHaveBeenCalledTimes(1);
  });

  it('completing a lesson that fails shows an inline error and does not navigate to the progress tab', async () => {
    mockElder([layer1], []);
    const completeLessonMock = vi.fn().mockRejectedValue(new Error('完成課堂紀錄唔到，請再試'));
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: true,
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: completeLessonMock,
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('當參考，有疑問問返醫生'));
    await userEvent.click(screen.getByText('完成課堂 🎉'));

    expect(await screen.findByText('完成課堂紀錄唔到，請再試')).toBeInTheDocument();
    // Still on LessonScreen, not navigated to the progress tab.
    expect(screen.getByText('完成課堂 🎉')).toBeInTheDocument();
  });

  const layer1: Lesson = { ...seedLesson, id: 'l1', layer: 1, number: 1, subtitle: '第一層課' };
```

`layer1`/`mockElder` are already defined lower in the file inside `describe('App course engine (elder)', ...)` — since the new "completing a lesson that fails" test needs them and lives in the `App auth gate` describe block, either (a) move `layer1`'s definition + `mockElder` helper to file-level scope above both `describe` blocks so both can use it, or (b) duplicate a minimal `layer1` inline in the new test. **Use (a)**: cut the existing `const layer1 = ...`, `const layer2 = ...`, `const antiFraud = ...`, and `function mockElder(...)` block out of `describe('App course engine (elder)', ...)` and paste it at module scope, right after the `seedLesson` constant near the top of the file — both describe blocks then share the same helpers, and the "quiz correct-answer" click sequence in the new test (`下一步 ▶` → `下一步 ▶` → click the correct quiz option → `完成課堂 🎉`) matches `seedLesson`'s actual step shape from `src/data/seedLesson.ts` (not the local 3-step `seedLesson` fixture already at the top of `App.test.tsx`, which only has `why`/`demo`/`quiz` with generic `'A'`/`'B'` options) — adjust the click sequence in the new test to match whichever lesson fixture you use (`layer1`, built from the file's own `seedLesson` fixture at the top, uses `'開始上堂 ▶'` from Home, then its quiz options are `'A'` (correct) / `'B'` (wrong) per the fixture at the top of the file — so the click sequence should be `下一步 ▶` (why→demo), `下一步 ▶` (demo→quiz), then click `'A'`, then `'完成課堂 🎉'`). Use this corrected sequence:

```tsx
    render(<App />);
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('A'));
    await userEvent.click(screen.getByText('完成課堂 🎉'));
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL — `App.tsx` doesn't yet read `progressError`/`reloadProgress`, and `completeLesson` failures aren't caught anywhere (unhandled rejection, navigates regardless).

- [ ] **Step 3: Update `App.tsx`**

```tsx
// src/App.tsx — replace the full file
import { useCallback, useEffect, useState } from 'react';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './components/HomeScreen';
import { LessonScreen } from './components/LessonScreen';
import { LessonListScreen } from './components/LessonListScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { FamilyScreen } from './components/FamilyScreen';
import { LoginScreen } from './components/LoginScreen';
import { PairingScreen } from './components/PairingScreen';
import { FamilyProgressView } from './components/FamilyProgressView';
import { ErrorRetry } from './components/ErrorRetry';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { useProgress, computeBadges } from './hooks/useProgress';
import { useAsyncAction } from './hooks/useAsyncAction';
import { useAsyncData } from './hooks/useAsyncData';
import { fetchFamilyLink } from './lib/family';
import { LAYER_NAMES, getNextLesson, isLayerCompleted } from './lib/courseEngine';
import type { ScreenName } from './types/screen';

function ElderShell({ userId }: { userId: string }) {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const { lessons, loaded: lessonsLoaded, error: lessonsError, reload: reloadLessons } = useLessons();
  const {
    state,
    loaded: progressLoaded,
    progressError,
    reloadProgress,
    completeLesson,
    setFamilyShare,
  } = useProgress(userId);

  function navigate(next: ScreenName) {
    setActiveLessonId(null);
    setScreen(next);
  }

  function openLesson(lessonId: string) {
    setActiveLessonId(lessonId);
    setScreen('lesson');
  }

  // The whole shell's data (lessons, progress) must be loaded before anything below can render
  // meaningfully — either failure blocks with the same error+retry affordance, matching the
  // pre-existing convention for the lessons fetch (now shared via ErrorRetry).
  if (lessonsError) {
    return <ErrorRetry message={`攞唔到課堂內容：${lessonsError}`} onRetry={reloadLessons} />;
  }
  if (progressError) {
    return <ErrorRetry message={progressError} onRetry={reloadProgress} />;
  }
  if (!lessonsLoaded || !progressLoaded) return <div className="app" />;

  const nextLesson = getNextLesson(lessons, state.completedLessonIds);
  const antiFraudLesson = lessons.find((l) => l.layer === 0) ?? null;
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;

  const layerTotals = ([1, 2, 3] as const).map((layer) => ({
    layer,
    name: LAYER_NAMES[layer],
    totalLessons: lessons.filter((l) => l.layer === layer).length,
    completedLessons: lessons.filter((l) => l.layer === layer && state.completedLessonIds.includes(l.id)).length,
  }));

  const badges = computeBadges({
    completedCount: state.completedLessonIds.length,
    streakCount: state.streakCount,
    antiFraudDone: antiFraudLesson !== null && state.completedLessonIds.includes(antiFraudLesson.id),
    allLayersDone: ([1, 2, 3] as const).every((layer) => isLayerCompleted(lessons, layer, state.completedLessonIds)),
  });

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          nextLesson={nextLesson}
          antiFraudLesson={antiFraudLesson}
          streakCount={state.streakCount}
          onSelectLesson={openLesson}
        />
      )}
      {screen === 'lesson' && activeLesson && (
        <ElderLessonScreen
          lesson={activeLesson}
          userId={userId}
          completeLesson={completeLesson}
          onCompleted={() => navigate('progress')}
        />
      )}
      {screen === 'lesson' && !activeLesson && (
        <LessonListScreen lessons={lessons} completedLessonIds={state.completedLessonIds} onSelectLesson={openLesson} />
      )}
      {screen === 'progress' && <ProgressScreen layers={layerTotals} badges={badges} />}
      {screen === 'family' && (
        <ElderFamilyScreen shareEnabled={state.familyShareEnabled} setFamilyShare={setFamilyShare} userId={userId} />
      )}
      <NavBar active={screen} onNavigate={navigate} />
    </div>
  );
}

// Wraps completeLesson (which throws on failure) in a local useAsyncAction so a failure shows
// inline on LessonScreen and the app only moves to the progress tab on genuine success — closes
// the "fire and forget, navigate regardless" gap the old onComplete={() => { completeLesson(...);
// navigate(...); }} pattern had.
function ElderLessonScreen({
  lesson,
  userId,
  completeLesson,
  onCompleted,
}: {
  lesson: Parameters<typeof LessonScreen>[0]['lesson'];
  userId: string;
  completeLesson: (lessonId: string) => Promise<void>;
  onCompleted: () => void;
}) {
  const { run, error } = useAsyncAction(async () => {
    await completeLesson(lesson.id);
    onCompleted();
  }, '完成課堂紀錄唔到，請再試');

  return <LessonScreen lesson={lesson} userId={userId} completeError={error} onComplete={() => run()} />;
}

// Wraps setFamilyShare (which throws on failure) the same way, so a failed toggle shows inline
// on FamilyScreen instead of silently doing nothing.
function ElderFamilyScreen({
  shareEnabled,
  setFamilyShare,
  userId,
}: {
  shareEnabled: boolean;
  setFamilyShare: (enabled: boolean) => Promise<void>;
  userId: string;
}) {
  return <FamilyScreen shareEnabled={shareEnabled} onToggleShare={setFamilyShare} userId={userId} />;
}

function FamilyFlow({ userId }: { userId: string }) {
  const [pairedLink, setPairedLink] = useState<{ elderUserId: string; elderDisplayName: string | null } | null>(
    null,
  );
  const fetcher = useCallback(() => fetchFamilyLink(userId), [userId]);
  const { data, error, loaded, busy, reload } = useAsyncData(fetcher, [userId], '攞唔到配對狀態，請再試');

  if (error) return <ErrorRetry message={error} onRetry={reload} busy={busy} />;
  if (!loaded) return <div className="app" />;

  const link = pairedLink ?? data ?? null;
  if (link === null) {
    return (
      <div className="app">
        <PairingScreen onPaired={setPairedLink} />
      </div>
    );
  }
  return (
    <div className="app">
      <FamilyProgressView elderUserId={link.elderUserId} elderDisplayName={link.elderDisplayName} />
    </div>
  );
}

export function App() {
  const auth = useAuth();

  if (auth.status === 'loading') return <div className="app" />;

  if (auth.status === 'signed-out') {
    return (
      <div className="app">
        {/* Full reload (not just relying on useAuth's own onAuthStateChange reactivity) is
            deliberate: on first login, ensureProfile() inserts the elder_profiles row AFTER
            verifyOtp() already fires the SIGNED_IN auth event. If we didn't reload, useAuth's
            listener would race that insert and could cache role: null with nothing left to
            re-trigger a re-fetch. Reloading re-runs useAuth's initial getSession() lookup only
            after ensureProfile() has definitely finished, guaranteeing the role is readable. */}
        <LoginScreen onLoggedIn={() => window.location.reload()} />
      </div>
    );
  }

  if (auth.role === null) {
    return <ErrorRetry message="攞唔到你嘅身份資料，請再試" onRetry={() => window.location.reload()} />;
  }

  if (auth.role === 'family') return <FamilyFlow userId={auth.userId as string} />;

  return <ElderShell userId={auth.userId as string} />;
}
```

Note: `useEffect` import is no longer used directly in `App.tsx` (it was only ever used inside the old hand-rolled `FamilyFlow` effect, now replaced by `useAsyncData`) — drop it from the import line as shown above (only `useCallback, useState` remain).

- [ ] **Step 4: Add the `completeError` prop to `LessonScreen`**

This is a dependency of Task 10's `ElderLessonScreen` wrapper above — do it now so `App.tsx` compiles (Task 11 covers `LessonScreen.tsx`'s own tests in full; this step only adds the prop and its rendering):

```tsx
// src/components/LessonScreen.tsx:6-10 — add completeError to the props interface
interface LessonScreenProps {
  lesson: Lesson;
  userId: string;
  onComplete: () => void;
  completeError?: string | null;
}
```

```tsx
// src/components/LessonScreen.tsx — update the function signature and the quiz-complete block
export function LessonScreen({ lesson, userId, onComplete, completeError }: LessonScreenProps) {
  // ...unchanged body until the quiz JSX...
            {answeredCorrect && (
              <>
                {completeError && <p className="error-text">{completeError}</p>}
                <button className="bigbtn next-btn" onClick={onComplete}>
                  <span>完成課堂 🎉</span>
                </button>
              </>
            )}
```

- [ ] **Step 5: Run `App.test.tsx` to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — `LessonScreen.test.tsx` is unaffected since `completeError` is optional and unused in its existing tests; `FamilyScreen.test.tsx`'s "toggles share via the callback" test still passes `onToggleShare = vi.fn()` (resolves `undefined`, awaits fine).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/LessonScreen.tsx
git commit -m "refactor: App.tsx adopts ErrorRetry + useAsyncData/useAsyncAction; wire up completeLesson/setFamilyShare error surfacing"
```

---

## Task 11: `LessonScreen.test.tsx` — cover the new `completeError` prop directly

**Files:**
- Modify: `src/components/LessonScreen.test.tsx`

Task 10 added the prop and wiring; this task adds direct component-level coverage (App.test.tsx's Task 10 test already covers it end-to-end, but `LessonScreen` should also be tested in isolation, matching this suite's existing convention of testing each component standalone).

- [ ] **Step 1: Add the failing test**

Add to `src/components/LessonScreen.test.tsx`, inside the existing `describe('LessonScreen', ...)` block:

```tsx
  it('shows completeError next to the 完成課堂 button when present, without hiding the button', async () => {
    render(
      <LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} completeError="完成課堂紀錄唔到，請再試" />,
    );

    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('當參考，有疑問問返醫生'));

    expect(screen.getByText('完成課堂紀錄唔到，請再試')).toBeInTheDocument();
    expect(screen.getByText('完成課堂 🎉')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/LessonScreen.test.tsx`
Expected: FAIL if Task 10's Step 4 wasn't applied yet in this execution order — since this plan executes tasks in order and Task 10 already added the prop, this should actually PASS immediately. Run it anyway to confirm.

- [ ] **Step 3: (No implementation change needed — already done in Task 10)**

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/LessonScreen.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/LessonScreen.test.tsx
git commit -m "test: cover LessonScreen's completeError prop directly"
```

---

## Task 12: `FamilyScreen.tsx` on `useAsyncData` + `useAsyncAction`

**Files:**
- Modify: `src/components/FamilyScreen.tsx`
- Modify: `src/components/FamilyScreen.test.tsx`

Comments fetch moves onto `useAsyncData`; pairing-code generation and comment-liking move onto `useAsyncAction` (`likingId` stays bespoke local state since it tracks *which* comment, per design doc §4); the share-toggle gains a local `useAsyncAction` wrapper since `onToggleShare` now throws (Task 10 already changed its caller in `App.tsx` to pass the raw throwing `setFamilyShare`).

- [ ] **Step 1: Update `FamilyScreen.test.tsx`**

Add these two new tests to the existing `describe('FamilyScreen', ...)` block (after the "toggles share via the callback" test), and change that existing test's `onToggleShare` mock to reflect the new throwing contract:

```tsx
  it('toggles share via the callback', async () => {
    const onToggleShare = vi.fn().mockResolvedValue(undefined);
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} userId="u1" />);
    await userEvent.click(screen.getByRole('button', { name: '' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
  });

  it('shows an inline error when toggling share fails', async () => {
    const onToggleShare = vi.fn().mockRejectedValue(new Error('設定失敗，請再試'));
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} userId="u1" />);

    await userEvent.click(screen.getByRole('button', { name: '' }));

    expect(await screen.findByText('設定失敗，請再試')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/FamilyScreen.test.tsx`
Expected: FAIL — `onToggleShare`'s rejection is currently unhandled (`FamilyScreen.tsx` calls it fire-and-forget), so no error text appears.

- [ ] **Step 3: Update `FamilyScreen.tsx`**

```tsx
// src/components/FamilyScreen.tsx — replace the full file
import { useEffect, useState } from 'react';
import { createPairingCode } from '../lib/family';
import { fetchComments, likeComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAsyncAction } from '../hooks/useAsyncAction';

const PAIRING_CODE_TTL_SECONDS = 10 * 60;

interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => Promise<void>;
  userId: string;
}

export function FamilyScreen({ shareEnabled, onToggleShare, userId }: FamilyScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeGeneratedAt, setCodeGeneratedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const {
    data: comments,
    error: commentsError,
    setData: setComments,
  } = useAsyncData<FamilyComment[]>(() => fetchComments(userId), [userId], '攞唔到留言，請再試');

  const [likingId, setLikingId] = useState<string | null>(null);
  const likeAction = useAsyncAction(async (commentId: string) => {
    await likeComment(commentId);
    setComments((prev) => (prev ?? []).map((c) => (c.id === commentId ? { ...c, liked: true } : c)));
  }, '撳讚失敗，請再試');

  const generateCode = useAsyncAction(async () => {
    const code = await createPairingCode();
    const generatedAt = Date.now();
    setPairingCode(code);
    setCodeGeneratedAt(generatedAt);
    setNow(generatedAt);
  }, '攞唔到配對碼，請再試');

  const toggleShare = useAsyncAction(async (enabled: boolean) => {
    await onToggleShare(enabled);
  }, '設定失敗，請再試');

  useEffect(() => {
    if (!pairingCode) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pairingCode]);

  async function handleLike(commentId: string) {
    if (likingId) return;
    setLikingId(commentId);
    await likeAction.run(commentId);
    setLikingId(null);
  }

  const secondsElapsed = codeGeneratedAt ? Math.floor((now - codeGeneratedAt) / 1000) : 0;
  const secondsLeft = Math.max(0, PAIRING_CODE_TTL_SECONDS - secondsElapsed);
  const isExpired = pairingCode !== null && secondsLeft === 0;
  const countdownLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} 後過期`;

  return (
    <div className="screen">
      <div className="topbar">
        <h2>👨‍👩‍👧 家人同行</h2>
        <p>俾屋企人知道你學得幾好（可以隨時閂）</p>
      </div>
      <div className="fam-card">
        <div className="toggle-row">
          <span>分享我嘅學習進度</span>
          <button
            className="toggle"
            style={{ background: shareEnabled ? '#2f6f4f' : '#ccc' }}
            disabled={toggleShare.busy}
            onClick={() => toggleShare.run(!shareEnabled)}
            aria-pressed={shareEnabled}
          />
        </div>
        {toggleShare.error && <p className="error-text">{toggleShare.error}</p>}
      </div>
      {shareEnabled && (
        <div className="fam-card">
          {pairingCode && !isExpired && (
            <>
              <p>配對碼（俾屋企人 10 分鐘內輸入）：</p>
              <p className="otp-display">{pairingCode}</p>
              <p>{countdownLabel}</p>
              <button className="bigbtn" disabled={generateCode.busy} onClick={() => generateCode.run()}>
                {generateCode.busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {pairingCode && isExpired && (
            <>
              <p>配對碼已過期</p>
              <button className="bigbtn" disabled={generateCode.busy} onClick={() => generateCode.run()}>
                {generateCode.busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {!pairingCode && (
            <>
              <button className="bigbtn" disabled={generateCode.busy} onClick={() => generateCode.run()}>
                {generateCode.busy ? '產生緊…' : '產生配對碼'}
              </button>
              {generateCode.error && <p className="error-text">{generateCode.error}</p>}
            </>
          )}
        </div>
      )}
      <div className="fam-card">
        <h4>家人留言</h4>
        {likeAction.error && <p className="error-text">{likeAction.error}</p>}
        <CommentList
          comments={comments ?? []}
          error={commentsError}
          emptyText="仲未有家人留言，快啲叫佢哋嚟支持你啦"
          onLike={handleLike}
          likingId={likingId}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/FamilyScreen.test.tsx`
Expected: PASS (all tests, including the 2 new/updated ones) — the existing "shows an error when liking a comment fails, and lets the user retry" test still works because `likeAction.error` renders the same way as the old `likeError`; "shows the thrown error message when code generation fails" still works via `generateCode.error`; the countdown/expiry/regenerate tests are untouched by this refactor (same local `pairingCode`/`codeGeneratedAt`/`now` state as before).

- [ ] **Step 5: Commit**

```bash
git add src/components/FamilyScreen.tsx src/components/FamilyScreen.test.tsx
git commit -m "refactor: FamilyScreen on useAsyncData/useAsyncAction; share-toggle errors now surface inline"
```

---

## Task 13: `FamilyProgressView.tsx` on `useAsyncData` + `useAsyncAction`

**Files:**
- Modify: `src/components/FamilyProgressView.tsx`
- Test: `src/components/FamilyProgressView.test.tsx` (no changes expected — regression check; the component's rendered contract doesn't change)

- [ ] **Step 1: Confirm the existing tests currently pass (baseline)**

Run: `npm test -- src/components/FamilyProgressView.test.tsx`
Expected: PASS (11 tests, against the pre-refactor implementation)

- [ ] **Step 2: Rebuild the implementation**

```tsx
// src/components/FamilyProgressView.tsx — replace the full file
import { useCallback, useState } from 'react';
import { fetchProgress, type RemoteProgress } from '../lib/progressApi';
import { fetchComments, postComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAsyncAction } from '../hooks/useAsyncAction';

interface FamilyProgressViewProps {
  elderUserId: string;
  elderDisplayName: string | null;
}

export function FamilyProgressView({ elderUserId, elderDisplayName }: FamilyProgressViewProps) {
  const progressFetcher = useCallback(() => fetchProgress(elderUserId), [elderUserId]);
  const {
    data: progress,
    error: progressError,
    busy: progressBusy,
    reload: reloadProgress,
  } = useAsyncData<RemoteProgress>(progressFetcher, [elderUserId], '攞唔到進度，請再試');

  const commentsFetcher = useCallback(() => fetchComments(elderUserId), [elderUserId]);
  const {
    data: comments,
    error: commentsError,
    setData: setComments,
  } = useAsyncData<FamilyComment[]>(
    commentsFetcher,
    [elderUserId, progress?.familyShareEnabled, reloadProgress],
    '攞唔到留言，請再試',
  );

  const [commentText, setCommentText] = useState('');
  const postAction = useAsyncAction(async () => {
    if (!commentText.trim()) return;
    await postComment(elderUserId, commentText.trim());
    setCommentText('');
    const updated = await fetchComments(elderUserId);
    setComments(updated);
  }, '送出失敗，請再試');

  if (progressError) {
    return (
      <div className="screen">
        <div className="topbar">
          <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
        </div>
        <div className="fam-card">
          <p className="error-text">攞唔到進度：{progressError}</p>
          <button className="bigbtn" disabled={progressBusy} onClick={reloadProgress}>
            {progressBusy ? '再試緊…' : '再試一次'}
          </button>
        </div>
      </div>
    );
  }

  if (!progress) return <div className="screen" />;

  if (!progress.familyShareEnabled) {
    return (
      <div className="screen">
        <div className="topbar">
          <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
        </div>
        <div className="fam-card">
          <p>對方而家冇分享緊進度</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
      </div>
      <div className="fam-card">
        <p>連續學習：{progress.streakCount} 日</p>
        <p>完成咗：{progress.completedLessonIds.length} 課</p>
      </div>
      <div className="fam-card">
        <h4>留言鼓勵</h4>
        <textarea
          className="comment-input"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="寫幾句鼓勵嘅說話…"
        />
        {postAction.error && <p className="error-text">{postAction.error}</p>}
        <button className="bigbtn" disabled={postAction.busy || !commentText.trim()} onClick={() => postAction.run()}>
          {postAction.busy ? '送緊出…' : '送出鼓勵'}
        </button>
      </div>
      <div className="fam-card">
        <h4>留言紀錄</h4>
        <CommentList comments={comments ?? []} error={commentsError} emptyText="仲未有留言" />
      </div>
    </div>
  );
}
```

Note on the comments-fetch `deps` array: the original used `reloadToken` (bumped by `handleRetry`, which only re-ran on the *progress* retry button) as a shared dependency so retrying the progress fetch also re-fetched comments. Here, `reloadProgress` (from `useAsyncData`) is a stable `useCallback`-wrapped function reference that does NOT change identity on retry, so including it as a dep does **not** reproduce the old "retry progress also re-fetches comments" behavior. Since the progress-error branch returns early before the comments section ever renders, and comments only ever matter once `progress` is loaded successfully, this is fine — drop `reloadProgress` from the comments-fetcher's deps entirely:

```tsx
  const {
    data: comments,
    error: commentsError,
    setData: setComments,
  } = useAsyncData<FamilyComment[]>(
    commentsFetcher,
    [elderUserId, progress?.familyShareEnabled],
    '攞唔到留言，請再試',
  );
```

- [ ] **Step 3: Run tests to verify they still pass**

Run: `npm test -- src/components/FamilyProgressView.test.tsx`
Expected: PASS (all 11 tests unmodified) — including "re-invokes fetchProgress and recovers to the success state when retry is clicked" (now driven by `useAsyncData`'s `reload`) and "posts a new comment and refreshes the list" (now driven by `useAsyncAction` + a direct `setComments` call after the manual re-fetch, same as the original's manual `fetchComments` + `setComments` pairing).

- [ ] **Step 4: Commit**

```bash
git add src/components/FamilyProgressView.tsx
git commit -m "refactor: rebuild FamilyProgressView on useAsyncData/useAsyncAction (no public behavior change)"
```

---

## Task 14: `PairingScreen.tsx` on `useAsyncAction`

**Files:**
- Modify: `src/components/PairingScreen.tsx`
- Test: `src/components/PairingScreen.test.tsx` (no changes expected — regression check)

- [ ] **Step 1: Confirm the existing tests currently pass (baseline)**

Run: `npm test -- src/components/PairingScreen.test.tsx`
Expected: PASS (2 tests, against the pre-refactor implementation)

- [ ] **Step 2: Rebuild the implementation**

```tsx
// src/components/PairingScreen.tsx — replace the full file
import { useState } from 'react';
import { redeemPairingCode } from '../lib/family';
import { useAsyncAction } from '../hooks/useAsyncAction';

interface PairingScreenProps {
  onPaired: (elder: { elderUserId: string; elderDisplayName: string | null }) => void;
}

export function PairingScreen({ onPaired }: PairingScreenProps) {
  const [code, setCode] = useState('');
  const { run, busy, error } = useAsyncAction(async () => {
    const elder = await redeemPairingCode(code);
    onPaired(elder);
  }, '配對失敗');

  return (
    <div className="screen">
      <div className="topbar">
        <h2>輸入配對碼</h2>
        <p>問返屋企嗰位攞個 6 位數配對碼</p>
      </div>
      <div className="fam-card">
        <input
          className="phone-input"
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="配對碼"
        />
        {error && <p className="error-text">{error}</p>}
        <button className="bigbtn" disabled={busy || code.length < 6} onClick={() => run()}>
          {busy ? '配對緊…' : '配對'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests to verify they still pass**

Run: `npm test -- src/components/PairingScreen.test.tsx`
Expected: PASS (2 tests, unmodified)

- [ ] **Step 4: Commit**

```bash
git add src/components/PairingScreen.tsx
git commit -m "refactor: rebuild PairingScreen on useAsyncAction (no public behavior change)"
```

---

## Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests across all files (baseline was 137 tests as of Plan 5; this plan adds new test files for `errors.ts`, `useAsyncData.ts`, `useAsyncAction.ts`, `ErrorRetry.tsx`, plus new cases within `progressApi.test.ts`, `auth.test.ts`, `useProgress.test.ts`, `useAuth.test.ts`, `App.test.tsx`, `LoginScreen.test.tsx`, `FamilyScreen.test.tsx`, `LessonScreen.test.tsx` — net addition, no drop).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: clean (no errors/warnings)

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: clean `tsc -b` + `vite build`, no type errors (this is the main risk point given how many prop/return-type shapes changed — e.g. `FamilyScreen`'s `onToggleShare` now typed `Promise<void>`, `LessonScreen`'s new `completeError` prop, `useProgress`'s new return fields).

- [ ] **Step 4: Live walkthrough (per this repo's CLAUDE.md DoD — `app/` changed, must open the PWA and drive the affected flows)**

Run: `npm run dev` in `app/`, open the served URL in a browser, and manually verify:
- Elder account: complete a lesson successfully (should navigate to progress tab as before).
- Elder account: toggle family-share off/on (should still work with no visible error in the normal case).
- Family account: generate a pairing code, like a comment (if a paired test account is available) — should behave identically to before.
- If feasible, simulate one failure path (e.g. temporarily break a Supabase URL/key in `.env.local` or use browser devtools to block a request) and confirm an error+retry message appears instead of a silent hang, for at least the lessons-load and pairing-code-generation cases.

Record the outcome in the PR/commit description or directly to Stephanie — this step can't be automated away per this repo's existing convention (Plan 5's retro explicitly notes headless Playwright can't complete real Supabase OTP login, so a manual pass is the only way to verify the authenticated paths end-to-end).

- [ ] **Step 5: Push**

```bash
python3 ../scripts/github_push.py "refactor: consolidate error/retry handling across lib layer, hooks, and components"
```

(Run from `app/`, so the path to the push script is `../scripts/github_push.py` relative to `app/` — or run from the repo root with `scripts/github_push.py` and no `..`; either way, verify the resulting GitHub HEAD as this repo's Standards §S1 requires.)

- [ ] **Step 6: Update README's outstanding-items note**

If `README.md`'s "未決事項"/backlog section still lists this error/retry-shape consolidation as outstanding (it was flagged there since Plan 2 per this plan's own design doc intro), remove that line — this plan closes it out.
