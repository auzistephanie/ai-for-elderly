# Error/Retry-Shape Consolidation (Design)

> This is standalone follow-up work, not part of the original 5-plan MVP roadmap (see `README.md` "未決事項" and `project_bot_reliability`/`project_ai_elder_app` memory — flagged as outstanding since Plan 2, never scoped until now). All 5 MVP plans are complete as of 2026-07-18.

## 1. Goal

Every `lib/*.ts` data function and every component/hook that calls one currently handles failure its own way — four different UI shapes and two genuine bugs have accumulated across Plans 1-5. This plan consolidates them onto one lib-layer convention and two shared hooks, without changing any user-facing behavior except where the current behavior is a bug (silent failure).

**Out of scope:**
- `LessonScreen.tsx`'s `logLessonStart(...).catch(() => {})` stays silent — it's a write-only analytics call (`elder_lesson_starts`, no read policy) and a failure here must never block or interrupt the lesson itself. Migrating it to the new pattern would add a visible error for something that was deliberately designed to fail invisibly.
- No global React Error Boundary or toast/snackbar system. A fleeting auto-dismissing toast is a poor fit for 60-72-year-old users who may not see or read it in time — every error stays as a persistent on-screen message until the user acts, matching the app's existing convention.
- No change to *what* triggers an error (RLS policies, network conditions) — this is purely about how failures already possible today are caught, worded, and displayed.

## 2. Current State (why this needs consolidating)

**Lib layer — inconsistent throw shape:**
- `family.ts`, `comments.ts`, `lessonStarts.ts`: throw `new Error(...)`, sometimes with a baked-in Cantonese fallback (`family.ts`), sometimes just the raw Supabase `error.message` (`comments.ts`, `lessonStarts.ts`).
- `auth.ts`: `ensureProfile()` throws `Error`, but `requestOtp()`/`verifyOtp()` return a `{ error: string | null }` result object instead — a second, incompatible convention inside the same file.
- `progressApi.ts`: **throws the raw Supabase error object directly** (`throw completionsError`), never wrapped in `Error` at all. This is a real bug: every caller that does `err instanceof Error ? err.message : fallback` (which is all of them) will always fail the `instanceof Error` check for this module's errors and silently show the generic fallback instead of the real message — the specific DB/network reason is discarded every time.

**UI layer — four shapes, one silent gap:**
- **Shape A (blocking, full-screen, has retry):** `App.tsx`'s `ElderShell` (lessons load failure) and `FamilyFlow` (family-link load failure) each hand-roll an identical `.fam-card` + `error-text` + `bigbtn` "再試一次" block.
- **Shape B (inline, local state, no dedicated retry button):** `FamilyProgressView`, `FamilyScreen`, `LoginScreen`, `PairingScreen` each maintain their own `error`/`busy` state with their own `.catch()`-chain or `try/catch`, each writing a slightly different fallback string by hand.
- **Shape C (silent swallow):** `LessonScreen.tsx` — intentional, see Out of Scope above.
- **Shape D (no handling at all — the real gap):** `useProgress.ts`'s initial fetch and its `completeLesson`/`setFamilyShare` callbacks have no try/catch anywhere; a failure is an unhandled rejection that the elder never sees — tapping "complete lesson" or the family-share toggle can silently do nothing. `useAuth.ts`'s role lookup never checks its query's `error` at all, so a real DB/network failure there is indistinguishable from "no row yet."

## 3. Lib Layer — One Convention

Every exported `lib/*.ts` function that can fail throws a real `Error` whose `message` is already the Cantonese string to show the user — callers never need to know or care what the underlying error looked like.

New shared helper, `lib/errors.ts`:

```ts
export function toFriendlyMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
```

This is the *only* place `instanceof Error` gets checked from now on — it lives once, in the two new hooks (§4), not copy-pasted at every call site.

Per-file changes:
- **`progressApi.ts`** — wrap every raw throw in `new Error(err.message ?? '<fallback>')`, matching `family.ts`'s existing pattern. This is the bug fix. Fallback strings reuse the exact wording each failure's callers already fall back to today (moving the string from call site into the lib function, not inventing new copy):
  - `fetchProgress()`'s three lookups (`completionsError`/`streakError`/`profileError`) → `'攞唔到進度，請再試'` (matches `FamilyProgressView`'s and `useProgress`'s existing usage of this failure).
  - `markLessonCompleted()` → `'完成課堂紀錄唔到，請再試'` (new wording — this specific path currently has no caller-side fallback since `useProgress.completeLesson` was previously uncaught, §2).
  - `touchStreak()` → `'攞唔到進度，請再試'` (same as `fetchProgress`, since both are part of the same initial-load sequence in `useProgress`).
  - `setFamilyShareEnabled()` → `'設定失敗，請再試'` (new wording, same reason as `markLessonCompleted`).
- **`auth.ts`** — `requestOtp()` and `verifyOtp()` change from returning `{ error }` to throwing `Error('傳送失敗，check 下電話號碼啱唔啱')` / `Error('驗證失敗，撳返去重新傳送')` respectively, matching `ensureProfile()`'s existing convention. `fetchDisplayedOtp()` is unchanged — its `if (error) return null` is intentional (a missing/undeliverable OTP is handled by `LoginScreen`'s existing retry-once-then-friendly-error logic, not a lib-layer error) and stays out of scope.
- **`comments.ts`, `lessonStarts.ts`** — no behavior change needed (already throw `Error`), left as-is other than confirming their raw `error.message` is acceptable to show directly (it is — Supabase/Postgres messages here are generic enough, e.g. network failures, not something needing a friendlier rewrite).
- **`family.ts`** — already the reference implementation for this convention; unchanged.

## 4. Two Shared Hooks

**`hooks/useAsyncData.ts`** — for "fetch on mount / on a dependency changing, with a manual reload," replacing the hand-rolled `active`-flag + `.then/.catch/.finally` pattern duplicated in `useLessons`, `FamilyFlow`, `FamilyProgressView` (x2: progress + comments), `FamilyScreen`'s comments fetch.

```ts
function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  fallbackMessage: string,
): { data: T | undefined; error: string | null; loaded: boolean; reload: () => void }
```

Internally: the existing `active`-flag-guarded effect + `reloadToken` pattern from `useLessons.ts`, generalized. `error` and `data` are independent (mirrors `useLessons`'s existing "fetch failure must stay distinguishable from genuinely-empty" comment) — a failure never clears previously-loaded `data`.

**`hooks/useAsyncAction.ts`** — for "fire on a user action" (button taps), replacing the hand-rolled `busy`/`error`/`try-catch-finally` in `LoginScreen`, `PairingScreen`, `FamilyScreen` (generate-code, like), `FamilyProgressView` (post-comment), `useProgress` (`completeLesson`, `setFamilyShare`).

```ts
function useAsyncAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<void>,
  fallbackMessage: string,
): { busy: boolean; error: string | null; run: (...args: Args) => Promise<void>; clearError: () => void }
```

`run` sets `busy`, clears any previous `error`, awaits `fn`, and on throw sets `error` via `toFriendlyMessage`. Multi-step actions (e.g. `LoginScreen`'s "verify OTP, then ensure profile") stay a single `fn` closure that awaits both lib calls in sequence — whichever throws first supplies the message, since both already carry their own specific Cantonese text per §3.

**Not covered by either hook:** `FamilyScreen`'s per-comment like button needs to track *which* comment is mid-request (`likingId`), not just a single boolean — that stays as bespoke local state (`setLikingId(commentId)` around the `run()` call), with only the error-message plumbing delegated to `useAsyncAction`. Not every piece of local state is worth generalizing away.

## 5. Shared `<ErrorRetry>` Component

Replaces the two byte-identical hand-rolled blocking-error blocks in `App.tsx` (`ElderShell`, `FamilyFlow`):

```tsx
function ErrorRetry({ message, onRetry, busy }: { message: string; onRetry: () => void; busy?: boolean }) {
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

`FamilyProgressView`'s blocking progress-load error keeps its own layout (it renders inside an existing `topbar`/`elderDisplayName` header the shared component doesn't know about) — it adopts `useAsyncData` for the data-fetching part but keeps its bespoke JSX, it does not switch to `<ErrorRetry>`. Only the two call sites with genuinely identical markup (`App.tsx`'s two blocks) get replaced.

## 6. Closing the Shape-D Gaps

- **`useProgress.ts`** — initial fetch (`fetchProgress` + conditional `touchStreak`) moves onto `useAsyncData`, gaining an `error`/`reload` pair mirroring `useLessons`. `completeLesson`/`setFamilyShare` each move onto their own `useAsyncAction`. Surfacing: these are user-triggered actions on already-loaded screens, not initial-load failures, so they get **inline** treatment (a small `error-text` line near the triggering button, e.g. under the "完成課堂" button and under the family-share toggle) — not a full-screen `<ErrorRetry>`, matching how `FamilyScreen` already treats its own action failures (like-error, pairing-code-error) as inline rather than blocking.
- **`useAuth.ts`** — the `elder_profiles` role SELECT starts checking its `error`. On a genuine query error, treat it the same as "no role row found" (`role: null`) rather than adding a separate error field — `App.tsx` already renders a full error+retry screen for `role === null` ("攞唔到你嘅身份資料，請再試" + reload), so a real query failure now correctly lands on that same existing screen instead of being silently indistinguishable from a slow/incomplete signup.

## 7. Migration List

| File | Change |
|---|---|
| `lib/errors.ts` | new — `toFriendlyMessage` |
| `lib/progressApi.ts` | wrap raw throws in `Error` (bug fix) |
| `lib/auth.ts` | `requestOtp`/`verifyOtp` become throw-based |
| `hooks/useAsyncData.ts` | new |
| `hooks/useAsyncAction.ts` | new |
| `components/ErrorRetry.tsx` | new |
| `hooks/useLessons.ts` | rebuilt on `useAsyncData` (same public return shape — no consumer changes needed) |
| `hooks/useProgress.ts` | initial fetch on `useAsyncData`; `completeLesson`/`setFamilyShare` on `useAsyncAction`; gains `error` in its return shape |
| `hooks/useAuth.ts` | check role-query `error`, fold into existing `role: null` path |
| `App.tsx` | `ElderShell`/`FamilyFlow` adopt `<ErrorRetry>`; `FamilyFlow`'s link-fetch on `useAsyncData`; `ElderShell` renders `useProgress`'s new inline action errors |
| `components/FamilyProgressView.tsx` | progress + comments fetches on `useAsyncData`; post-comment on `useAsyncAction`; keeps existing bespoke error layout (§5) |
| `components/FamilyScreen.tsx` | comments fetch on `useAsyncData`; generate-code + like on `useAsyncAction` (`likingId` stays bespoke, §4) |
| `components/LoginScreen.tsx` | send-OTP and confirm steps each become one `useAsyncAction` |
| `components/PairingScreen.tsx` | pair action on `useAsyncAction` |
| `components/CommentList.tsx` | unchanged — already a pure props-driven presentational component |

## 8. Testing

- `hooks/useAsyncData.ts`, `hooks/useAsyncAction.ts`: new unit tests (Vitest/RTL, mocked fetcher/action functions) covering success, failure-with-`Error`, failure-with-non-`Error` (defensive fallback path), and `useAsyncData`'s reload/dep-change behavior — following this project's existing convention of writing the error-path test alongside the happy-path from the start (not added reactively after review, per the Plan 4 retro note).
- `lib/progressApi.test.ts`: existing tests asserting raw-error-throw behavior get updated to assert an `Error` instance with the expected message — this is the regression test for the bug fix in §3.
- `lib/auth.test.ts`: `requestOtp`/`verifyOtp` tests updated from asserting `{error}` return values to asserting thrown `Error`s.
- Component tests (`FamilyProgressView`, `FamilyScreen`, `LoginScreen`, `PairingScreen`, `useLessons`, `useProgress`, `useAuth`): stay black-box (rendered error text, retry-button presence/behavior) wherever possible — expected to mostly keep passing unchanged since the *visible* contract doesn't change, only the internal plumbing. Any test currently asserting internal state shape directly gets updated as part of the same task that touches that file.
- Full existing suite (137 tests as of Plan 5) must stay green throughout — this is a refactor of working code, not new functionality, so no test count should meaningfully drop; new tests for the two hooks are the only expected net addition.
- No live Supabase/Playwright walkthrough required for most of this (pure client-side refactor of already-covered paths), but the `useAuth.ts` role-error fold-in (§6) is worth one live spot-check if easy to arrange (e.g. temporarily revoking the `elder_profiles` select grant) since it's the one place behavior for a previously-silent case becomes newly visible.

## 9. Open Items Not Decided Here

- Exact inline placement/wording for `useProgress`'s new `completeLesson`/`setFamilyShare` error text — left for implementation time, follow `FamilyScreen`'s existing like-error placement as the closest precedent.
- Whether `useLessons.ts` and `useProgress.ts` end up as thin wrappers around `useAsyncData` or are simplified further once the extraction is done — implementation detail, not a design blocker.
