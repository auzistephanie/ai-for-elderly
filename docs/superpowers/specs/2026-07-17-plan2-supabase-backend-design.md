# Plan 2 — Supabase Backend, Phone-OTP Login, DB-Driven Course Engine (Design)

> This is Plan 2 of 5 for the AI老友記 MVP (see `README.md` "下一步" and the roadmap at the top of `docs/superpowers/plans/2026-07-16-mvp-walking-skeleton.md`). Plan 1 (walking skeleton) is complete. This doc is the approved design; the next step is a task-by-task implementation plan (superpowers:writing-plans).

## 1. Goal

Move the app from local-only (Plan 1: hardcoded seed lesson, localStorage progress, no login) to a real backend: elder login (no typing beyond a phone number), a family-member companion account skeleton (pairing, read-only progress view), and lessons/progress stored in Supabase instead of hardcoded/localStorage. Content-authoring/admin-approve UI is **not** in scope — that's Plan 3. Family-side UI polish (comments, likes, invite-link wording) is **not** in scope — that's Plan 4; this plan only needs the pairing + read-only progress view to work.

## 2. Supabase Project

Reuse the existing shared Supabase project (`cmtubaxlniglklmdwlzs`, "auzistephanie's Project") that already backs Travel App, daily-novel, and sales-trainer. All new tables use an `elder_` prefix to stay isolated from other apps' tables (`novel_*`, `coach_*`, `trips`/`flights`/etc.), matching the existing convention in that project.

Out-of-scope note surfaced during discovery, not part of this plan: two existing tables in that project (`brain_chunks`, `service_heartbeat`) have RLS disabled. Flagged to Stephanie separately; not touched here.

## 3. Auth Mechanism

**Real Supabase Auth (phone provider) + a custom Send-SMS Hook that displays the OTP in-app instead of dispatching a real SMS.**

Supabase's native phone-OTP flow runs unmodified — it creates `auth.users` rows, issues standard session/refresh tokens, and RLS works via the normal `auth.uid()`. The only change is the Auth Hook responsible for "sending" the OTP: instead of calling an SMS provider (Twilio etc.), the hook returns the generated code so the app can show it directly on screen. This works because the person entering the phone number (a family member or workshop helper) is physically operating the same device — there is no real requirement to transport the code over a phone network for this MVP.

Why this over a fully custom auth system: we get real `auth.uid()`, standard RLS, and standard session persistence (the "device stays logged in indefinitely" requirement from spec §9) for free, with zero SMS vendor cost and zero vendor signup. Upgrading to real SMS later (e.g. if a funding body requires it) means swapping only the hook's delivery step — no schema or RLS changes.

Both elder and family-member logins use this same mechanism (`elder_profiles.role` distinguishes the two after login).

## 4. Data Model

All new tables, `public` schema, `elder_` prefix:

| Table | Purpose | Key columns |
|---|---|---|
| `elder_profiles` | One row per app user (elder or family) | `user_id` (PK, = `auth.uid()`), `role` (`'elder'` \| `'family'`), `display_name`, `family_share_enabled` (elder-only, default `true`) |
| `elder_family_links` | Elder ↔ family pairing | `elder_user_id`, `family_user_id`, `created_at` |
| `elder_pairing_codes` | One-time 6-digit pairing codes | `code`, `elder_user_id`, `expires_at`, `used_at` |
| `elder_lessons` | Lesson content (replaces hardcoded `seedLesson.ts`) | `id`, `layer` (1\|2\|3), `number`, `title`, `subtitle`, `steps` (jsonb, same shape as the current `Lesson`/`WhyStep`/`DemoStep`/`QuizStep` TS types), `status` (default `'published'`; Plan 3 adds a `'pending'` review queue on top of this same column — no migration needed then) |
| `elder_lesson_completions` | Which user completed which lesson (normalized, not a jsonb array, so Plan 5 analytics — drop-off per lesson — can query it directly) | `user_id`, `lesson_id`, `completed_at` |
| `elder_streaks` | Streak tracking | `user_id`, `streak_count`, `last_active_date` |

No `badges` table — `computeBadges()` stays a pure function computed client-side from `elder_lesson_completions` + `elder_streaks`, same as Plan 1.

### RLS

- `elder_lessons`: any authenticated user can read rows where `status = 'published'`. Satisfies acceptance criterion "unapproved lessons are completely invisible in the app."
- `elder_profiles` / `elder_lesson_completions` / `elder_streaks`: a user can read/write their own row. When `family_share_enabled = true` and an `elder_family_links` row exists, the linked family user gets **read-only** access to that elder's rows.
- `elder_pairing_codes`: not directly readable/writable by clients. Code validation + link creation happens through a `SECURITY DEFINER` RPC, so a family user can't enumerate/guess codes by querying the table.

## 5. Frontend Integration

**Elder side:**
- New login screen ahead of the existing 4-tab shell: helper taps "add this device" → enters a phone number → the OTP is shown directly on screen → taps confirm (or it's pre-filled, since we already have it) → logged in. Session persists via Supabase's normal refresh-token handling — no re-login on subsequent opens.
- `useProgress` is rewritten to read/write Supabase (`elder_lesson_completions`, `elder_streaks`) instead of `localStorage`, keyed by the logged-in `user_id`.
- `FamilyScreen` gains a "generate pairing code" button: writes a row to `elder_pairing_codes`, displays the 6-digit code large on screen for the elder to read aloud or photograph.
- The existing share toggle in `FamilyScreen` (currently a localStorage boolean from Plan 1) switches to reading/writing `elder_profiles.family_share_enabled`. No UI change — same toggle, new storage.

**Family side (same app, routed by role):**
- Family member opens the same PWA link, goes through the same phone-OTP login (`elder_profiles.role = 'family'`).
- After login, sees a simple "enter pairing code" screen → calls the `SECURITY DEFINER` RPC to validate the code and create the `elder_family_links` row.
- Once paired, routing switches them to a read-only progress view (streak / completed lessons / layer progress). This plan only needs the numbers to render correctly — comment/like UI and nicer copy are Plan 4.

**Lesson content migration:**
- One-off migration script inserts the current hardcoded seed lesson from `data/seedLesson.ts` into `elder_lessons` (`status='published'`).
- `LessonScreen`/`HomeScreen` switch from importing the local data file to querying Supabase. The existing `Lesson`/`WhyStep`/`DemoStep`/`QuizStep` TS types are unchanged — `steps` jsonb deserializes directly into them.

## 6. Error Handling

- Wrong/expired OTP: gentle retry prompt (matching the spec's tone rules), with a button to generate a fresh OTP rather than a bare error code.
- Wrong/expired/already-used pairing code: same gentle-retry treatment, with a prompt for the family member to ask the elder for a new code.
- Login requires network; the existing offline cache only covers already-unlocked lesson content. The login screen should say so plainly ("需要有網先登入到，之後離線都睇得返已學嘅課").

## 7. Security Notes

- Pairing codes are single-use (`used_at` set on consumption) with a short expiry (10 minutes), to limit the window for a third party to guess/reuse a code.
- The "display OTP in-app instead of sending it" approach is safe under this spec's own assumption (a helper is physically operating the device) — it is not a new risk introduced by this plan, but the hook implementation must avoid leaking the code anywhere public (no `console.log` reaching production browser consoles; be mindful of Supabase log retention).
- Pre-existing RLS gaps on `brain_chunks`/`service_heartbeat` are out of scope for this plan (flagged separately to Stephanie).

## 8. Testing

Same TDD approach as Plan 1 (build → review each unit):
- OTP generation/verification logic (via the Auth Hook).
- Pairing-code generation/verification RPC.
- Rewritten `useProgress` hook (Supabase client mocked in unit tests).
- RLS policies verified against a real/test Supabase project using actual `anon`/authenticated-role queries — not just reading the policy SQL.

Acceptance for this plan:
- [ ] An elder device, once logged in, stays logged in across reload/app close-reopen.
- [ ] A family member entering the correct pairing code immediately sees the elder's real progress numbers.
- [ ] Lessons with `status != 'published'` are unreachable via the API, not just hidden in the UI.
