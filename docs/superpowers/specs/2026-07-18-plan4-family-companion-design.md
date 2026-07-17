# Plan 4 — Family Companion Polish (Design)

> This is Plan 4 of 5 for the AI老友記 MVP (see `README.md` "下一步" and the roadmap at the top of `docs/superpowers/plans/2026-07-16-mvp-walking-skeleton.md`). Plans 1-3 are complete. This doc is the approved design; the next step is a task-by-task implementation plan (superpowers:writing-plans).

## 1. Goal

Add the comment/like family-engagement feature and pairing-code UX polish that Plan 2's design explicitly deferred here ("Family-side UI polish (comments, likes, invite-link wording) is not in scope — that's Plan 4"). Family members leave encouraging comments on a paired elder's profile; the elder responds with a per-comment 👍 (button-only, no typing, per spec §7). Also fixes a real gap discovered during this design pass: no user (elder or family) currently has any way to set a `display_name`, even though the column has existed since Plan 2 and `fetchFamilyLink`/`redeemPairingCode` already read it — it's always `null` in practice today.

**Kept from the original SPEC's family-companion section (§8), reinterpreted for what Plan 2 actually built:** the SPEC's "WhatsApp invite link" became a 6-digit pairing code in Plan 2 — Stephanie confirmed keeping the pairing-code mechanism rather than switching to a link-based invite; this plan only polishes the pairing code's UX (regenerate + expiry awareness), it does not revisit the underlying mechanism.

**Out of scope:** PWA offline/installable polish (Plan 5). Any change to the pairing-code *mechanism* itself (still 6-digit, still 10-minute expiry, still one active code at a time — this plan adds a way to get a *fresh* code, not a different kind of code).

## 2. Display Name (gap fix)

`LoginScreen.tsx` gains one new step in its existing role→phone→OTP flow: immediately after choosing a role (長者/家人), before entering a phone number, ask "你個名係？" via a text input (a one-time setup step, not a recurring typing requirement — doesn't violate spec §7's "全程撳掣" rule, which governs day-to-day use, not first-time account setup; `LoginScreen` already requires typing a phone number at this same stage). Both elder and family accounts go through this identically — no special-casing.

The name is passed through to `ensureProfile()` (currently `app/src/lib/auth.ts`, only writes `{user_id, role}` on insert) and persisted into `elder_profiles.display_name` at profile-creation time. Existing already-provisioned accounts (elder + Stephanie's own test family accounts from Plan 2/3 testing) will have `display_name = null` until they next go through a *fresh* signup — acceptable for MVP; no backfill migration in this plan.

## 3. Data Model — `elder_family_comments`

New table, `elder_` prefix per this project's convention:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | `gen_random_uuid()` default |
| `elder_user_id` | uuid, references `auth.users` | who the comment is about |
| `family_user_id` | uuid, references `auth.users` | who wrote it |
| `comment_text` | text, not null | |
| `liked` | boolean, not null, default `false` | set by the elder only |
| `created_at` | timestamptz, not null, default `now()` | |

**RLS:**
- Family member: `insert` where `family_user_id = auth.uid()` AND they're linked to `elder_user_id` via `elder_family_links` AND that elder's `family_share_enabled = true` (matching the existing gating on `elder_lesson_completions`/`elder_streaks` family-read policies). `select` under the same linked+sharing condition — this is what makes the comment list *shared* across all of an elder's paired family members (any family member satisfying the link+sharing check can read all comments for that elder, not just their own).
- Elder: `select` where `elder_user_id = auth.uid()`. `update` limited to the `liked` column, same ownership condition — enforced at the RLS `with check` level by only granting `update` on this table to the elder's own rows; the app layer only ever sends `{liked: true}` as the patch body, but RLS is the actual enforcement boundary, not client-side discipline.

No `family_read` policy variant needed beyond what's already described — unlike the progress tables, there's no "elder reads their own, family reads elder's" asymmetry here beyond the insert/select split above.

## 4. Elder-Side UI — `FamilyScreen.tsx`

Below the existing share-toggle and pairing-code cards, add a comments section:
- Lists all comments for this elder (newest first), each showing: family member's `display_name` (fallback "家人" if somehow null), `comment_text`, relative/absolute time, and a 👍 toggle button.
- The 👍 is a **one-way action** — tapping sets `liked = true` via the RLS-scoped update; there's no un-like. Once liked, the button shows a filled/active state (❤️) instead of the tappable outline state (🤍) and becomes non-interactive (already-liked comments don't need to be tapped again). Matches the spec's "覆返個讚" framing — a lightweight acknowledgment, not a toggle needing a two-way state machine.
- Empty state ("仲未有家人留言，快啲叫佢哋嚟支持你啦") when no comments exist yet.

## 5. Family-Side UI — `FamilyProgressView.tsx`

Below the existing progress card:
- A text input + "送出鼓勵" button to post a new comment (`insert` into `elder_family_comments` with the current family user's id).
- The same shared comment list rendered here too (all comments from all of this elder's paired family members, not just the current viewer's own), each showing author name, text, time, and like status (❤️/🤍 — read-only here, family members don't tap it, only the elder does).
- **Gated on the same `family_share_enabled` flag** as the progress numbers — if the elder has sharing off, the existing "對方而家冇分享緊進度" branch covers this too; comments aren't a separate opt-in from progress sharing, they're both covered by the one existing toggle (keeps the mental model simple: one switch, "family can see how I'm doing and cheer me on," fully on or off).

## 6. Pairing Code UX Polish — `FamilyScreen.tsx`

Once a pairing code is generated and displayed:
- Show a live countdown to the known 10-minute expiry (`create_pairing_code()`'s `now() + interval '10 minutes'` — the countdown is purely a client-side display computed from when the code was fetched, not a new server round-trip).
- Once expired, replace the code display with "配對碼已過期" and a "產生新碼" button.
- Even before expiry, always show a "產生新碼" button alongside the current code — tapping it calls `createPairingCode()` again and replaces the displayed code with the fresh one (the old code becomes unusable the moment a family member tries it after a newer one exists only in the sense that the DB doesn't retroactively invalidate old codes on new-code-generation — this is an accepted, pre-existing property of the pairing-code RPC from Plan 2, not something this plan changes; regenerating is purely a convenience for the elder/helper who mistyped or ran out of time, not a security invalidation mechanism).

## 7. Testing

- `LoginScreen`'s new name-input step, `ensureProfile`'s name-persisting behavior: unit-tested with Vitest/RTL + mocked Supabase calls, following this project's existing TDD convention.
- New comment/like data-layer functions (`lib/comments.ts` or similar — exact module boundary decided at plan-writing time): unit-tested with mocked Supabase client, matching `lib/family.ts`'s existing pattern (functions throw on error, tests cover both success and error paths from the start — no repeat of the Plan 2/3 pattern where error-handling got added reactively after review).
- `FamilyScreen`/`FamilyProgressView` comment UI additions: unit-tested with RTL, mocking the comment data-layer functions.
- Pairing-code countdown/regenerate: unit-tested with fake timers (Vitest's `vi.useFakeTimers()`) to avoid a real 10-minute wait in the test suite.
- Live RLS/schema verification (new table, policies): verified against the actual Supabase project via `execute_sql`/`list_tables`, same style as every schema change in Plans 2-3.
- Final live walkthrough (two real browser contexts, elder + family, matching Plan 2 Task 13's and Plan 3 Task 11's style): family posts a comment → elder sees it and likes it → family sees the like reflected back.

## 8. Open Items Not Decided Here

- Exact relative-time formatting for comment timestamps (e.g. "3 小時前" vs a fixed date string) — left for implementation time, not a design blocker.
- Whether a maximum comment length or rate-limit is needed — no such constraint requested; can be added later if it becomes a real problem (this is a low-traffic, trusted-relationship feature — an elder and their own family, not a public feed).
