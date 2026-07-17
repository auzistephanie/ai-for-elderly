# Plan 2 — Supabase Backend, Phone-OTP Login, DB-Driven Course Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Plan 1's local-only app (hardcoded seed lesson, localStorage progress, no login) with a real Supabase backend: phone-OTP login for elders (no real SMS — a custom Send SMS Hook displays the code in-app instead), a family-member companion account skeleton (pairing code, read-only progress view), and lessons/progress stored in Supabase instead of hardcoded data/localStorage.

**Architecture:** Real Supabase Auth (phone provider) with a custom "Send SMS" Auth Hook that persists the generated OTP to a table instead of dispatching a real SMS, so the client can read and display it directly. Standard `auth.uid()`-based RLS throughout. All new tables use an `elder_` prefix in the existing shared Supabase project (`cmtubaxlniglklmdwlzs`), which already hosts other apps' tables (`novel_*`, `coach_*`, `trips`/etc.). React app gains an auth gate: signed-out → `LoginScreen`; signed-in elder → existing 4-tab shell (now DB-backed); signed-in family → pairing screen or read-only progress view. Full design rationale is in `docs/superpowers/specs/2026-07-17-plan2-supabase-backend-design.md` — this plan implements that approved design; don't re-litigate decisions already made there.

**Tech Stack:** Adds `@supabase/supabase-js` (`^2.110.0`, matching the version already used by the sibling Travel App project) to the existing Vite + React 19 + TypeScript + Vitest stack. No new state library, no router — same `App` owns top-level state pattern as Plan 1.

**Out of scope (later plans):** Admin approve UI / AI content-generation pipeline (Plan 3). Family comment/like UI and nicer invite copy (Plan 4) — this plan only needs pairing + read-only numbers to work correctly. Native app packaging, payments, PWA offline polish (Plans 4–5, spec §10).

**Repo push convention:** never `git add`/`git commit`/`git push` directly. Push via `python3 scripts/github_push.py "<message>"` from the repo root (`AI for elderly/`). Each task ends with one push.

---

## File Structure

```
AI for elderly/
├── supabase/
│   └── schema.sql                        # full elder_ schema: tables, RLS, RPCs, hook fn (source of truth, mirrors what's applied live)
├── app/
│   ├── .env.example                      # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (blank)
│   ├── package.json                      # + @supabase/supabase-js
│   └── src/
│       ├── types/
│       │   └── auth.ts                   # UserRole type
│       ├── lib/
│       │   ├── supabaseClient.ts         # createClient() singleton
│       │   ├── auth.ts                   # requestOtp/fetchDisplayedOtp/verifyOtp/ensureProfile
│       │   ├── auth.test.ts
│       │   ├── progressApi.ts            # fetchProgress/markLessonCompleted/touchStreak/setFamilyShareEnabled
│       │   ├── progressApi.test.ts
│       │   ├── family.ts                 # createPairingCode/redeemPairingCode/fetchFamilyLink
│       │   └── family.test.ts
│       ├── hooks/
│       │   ├── useAuth.ts                # session + resolved role
│       │   ├── useAuth.test.ts
│       │   ├── useProgress.ts            # MODIFIED: Supabase-backed, no more localStorage
│       │   ├── useProgress.test.ts       # MODIFIED: rewritten for the new backend
│       │   ├── useLessons.ts             # fetch published lessons from elder_lessons
│       │   └── useLessons.test.ts
│       └── components/
│           ├── LoginScreen.tsx           # role choice -> phone -> OTP confirm
│           ├── LoginScreen.test.tsx
│           ├── PairingScreen.tsx         # family: enter pairing code
│           ├── PairingScreen.test.tsx
│           ├── FamilyProgressView.tsx    # family: read-only progress of the linked elder
│           ├── FamilyProgressView.test.tsx
│           ├── FamilyScreen.tsx          # MODIFIED: share toggle now Supabase-backed, + "generate pairing code"
│           ├── FamilyScreen.test.tsx     # MODIFIED
│           └── App.tsx                   # MODIFIED: auth gate + role-based routing; feeds HomeScreen/LessonScreen
│                                          # from useLessons instead of the old seedLesson import (those two
│                                          # components' own code is untouched — they already just take a lesson prop)
```

---

## Task 1: Core Supabase schema (tables + RLS)

**Files:**
- Create: `supabase/schema.sql` (this task writes the first half of it — core tables)

- [ ] **Step 1: Write the schema SQL for the core tables**

Create `supabase/schema.sql` with this content:

```sql
-- AI老友記 — Supabase schema (shared project cmtubaxlniglklmdwlzs, elder_ prefix)
-- Applied via the Supabase MCP tool / SQL editor. This file is the committed source of truth;
-- keep it in sync whenever schema changes are applied live.

create extension if not exists pgcrypto;

-- One row per app user (elder or family member).
create table public.elder_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('elder', 'family')),
  display_name text,
  family_share_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.elder_profiles enable row level security;

create policy "elder_profiles_self_select"
  on public.elder_profiles for select
  using (auth.uid() = user_id);

create policy "elder_profiles_self_insert"
  on public.elder_profiles for insert
  with check (auth.uid() = user_id);

create policy "elder_profiles_self_update"
  on public.elder_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Elder <-> family pairing links (rows only ever created via the redeem_pairing_code RPC below).
create table public.elder_family_links (
  elder_user_id uuid not null references auth.users(id) on delete cascade,
  family_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (elder_user_id, family_user_id)
);

alter table public.elder_family_links enable row level security;

create policy "elder_family_links_participant_select"
  on public.elder_family_links for select
  using (auth.uid() = elder_user_id or auth.uid() = family_user_id);

-- Now that elder_family_links exists, add the family-read policy to elder_profiles.
create policy "elder_profiles_family_read"
  on public.elder_profiles for select
  using (
    role = 'elder'
    and family_share_enabled = true
    and exists (
      select 1 from public.elder_family_links l
      where l.elder_user_id = elder_profiles.user_id
        and l.family_user_id = auth.uid()
    )
  );

-- Lesson content (replaces the hardcoded seed lesson file).
create table public.elder_lessons (
  id text primary key,
  layer smallint not null check (layer in (1, 2, 3)),
  number integer not null,
  title text not null,
  subtitle text not null,
  steps jsonb not null,
  status text not null default 'published' check (status in ('published', 'pending')),
  created_at timestamptz not null default now()
);

alter table public.elder_lessons enable row level security;

create policy "elder_lessons_published_read"
  on public.elder_lessons for select
  using (status = 'published');

-- Which user completed which lesson (normalized, not a jsonb array — Plan 5 analytics needs to query this directly).
create table public.elder_lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.elder_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.elder_lesson_completions enable row level security;

create policy "elder_lesson_completions_self_all"
  on public.elder_lesson_completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "elder_lesson_completions_family_read"
  on public.elder_lesson_completions for select
  using (
    exists (
      select 1
      from public.elder_profiles p
      join public.elder_family_links l on l.elder_user_id = p.user_id
      where p.user_id = elder_lesson_completions.user_id
        and p.family_share_enabled = true
        and l.family_user_id = auth.uid()
    )
  );

-- Streak tracking.
create table public.elder_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_count integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

alter table public.elder_streaks enable row level security;

create policy "elder_streaks_self_all"
  on public.elder_streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "elder_streaks_family_read"
  on public.elder_streaks for select
  using (
    exists (
      select 1
      from public.elder_profiles p
      join public.elder_family_links l on l.elder_user_id = p.user_id
      where p.user_id = elder_streaks.user_id
        and p.family_share_enabled = true
        and l.family_user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply the migration**

Call the Supabase MCP tool:
```
mcp__claude_ai_Supabase__apply_migration
  project_id: cmtubaxlniglklmdwlzs
  name: elder_core_schema
  query: <the full SQL from Step 1>
```
(If this MCP tool isn't available in your environment, paste the same SQL into the Supabase Dashboard's SQL Editor for project `cmtubaxlniglklmdwlzs` and run it there instead.)

- [ ] **Step 3: Verify the tables exist**

Call `mcp__claude_ai_Supabase__list_tables` with `project_id: cmtubaxlniglklmdwlzs`, `schemas: ["public"]`.
Expected: `elder_profiles`, `elder_family_links`, `elder_lessons`, `elder_lesson_completions`, `elder_streaks` all present with `rls_enabled: true`.

- [ ] **Step 4: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: core Supabase schema for AI老友記 (elder_profiles, lessons, completions, streaks)"
```

---

## Task 2: Auth-support schema (OTP outbox, pairing codes, RPCs, Send SMS hook)

**Files:**
- Modify: `supabase/schema.sql` (append)

- [ ] **Step 1: Append the auth-support SQL**

Append to `supabase/schema.sql`:

```sql
-- One-time pairing codes an elder generates so a family member's account can link to them.
create table public.elder_pairing_codes (
  code text primary key,
  elder_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.elder_pairing_codes enable row level security;
-- No policies: this table is only ever touched through the SECURITY DEFINER RPCs below,
-- which bypass RLS by running as the function owner. No direct client access at all.

-- OTP outbox: the Send SMS hook writes here instead of dispatching a real SMS;
-- get_pending_otp() below is how the client reads the code back to display it.
create table public.elder_login_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  otp text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

alter table public.elder_login_otps enable row level security;
-- No policies here either — same reasoning, RPC-only access.

-- Called by an authenticated elder to generate a fresh pairing code.
create or replace function public.create_pairing_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_tries int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  loop
    v_code := lpad(floor(random() * 1000000)::text, 6, '0');
    v_tries := v_tries + 1;
    begin
      insert into public.elder_pairing_codes (code, elder_user_id, expires_at)
      values (v_code, auth.uid(), now() + interval '10 minutes');
      exit;
    exception when unique_violation then
      if v_tries > 10 then
        raise exception 'could not generate a unique pairing code, try again';
      end if;
    end;
  end loop;

  return v_code;
end;
$$;

revoke all on function public.create_pairing_code() from public;
grant execute on function public.create_pairing_code() to authenticated;

-- Called by an authenticated family member to redeem a pairing code and link to that elder.
create or replace function public.redeem_pairing_code(p_code text)
returns table (elder_user_id uuid, elder_display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.elder_pairing_codes;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.elder_pairing_codes where code = p_code for update;

  if v_row.code is null then
    raise exception '配對碼錯誤';
  end if;
  if v_row.used_at is not null then
    raise exception '配對碼已經用咗';
  end if;
  if v_row.expires_at < now() then
    raise exception '配對碼過期';
  end if;

  update public.elder_pairing_codes set used_at = now() where code = p_code;

  insert into public.elder_family_links (elder_user_id, family_user_id)
  values (v_row.elder_user_id, auth.uid())
  on conflict do nothing;

  return query
    select p.user_id, p.display_name from public.elder_profiles p where p.user_id = v_row.elder_user_id;
end;
$$;

revoke all on function public.redeem_pairing_code(text) from public;
grant execute on function public.redeem_pairing_code(text) to authenticated;

-- Called by the client (still signed out, mid-login) to read back the OTP the hook just wrote.
-- Matches on digits-only so client-side E.164 formatting differences from what Supabase Auth
-- itself recorded can never cause a lookup miss. One-time reveal: marks the row consumed.
create or replace function public.get_pending_otp(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp text;
begin
  select otp into v_otp
  from public.elder_login_otps
  where regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
    and consumed_at is null
    and created_at > now() - interval '5 minutes'
  order by created_at desc
  limit 1;

  if v_otp is not null then
    update public.elder_login_otps
    set consumed_at = now()
    where regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
      and otp = v_otp
      and consumed_at is null;
  end if;

  return v_otp;
end;
$$;

revoke all on function public.get_pending_otp(text) from public;
grant execute on function public.get_pending_otp(text) to anon, authenticated;

-- Supabase Auth calls this instead of dispatching a real SMS. event shape per
-- https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook :
-- { "user": {...}, "sms": { "otp": "123456" } }
create or replace function public.send_sms(event jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.elder_login_otps (phone, otp)
  values (event->'user'->>'phone', event->'sms'->>'otp');
end;
$$;

revoke all on function public.send_sms(jsonb) from public, anon, authenticated;
grant execute on function public.send_sms(jsonb) to supabase_auth_admin;
```

- [ ] **Step 2: Apply the migration**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: cmtubaxlniglklmdwlzs`, `name: elder_auth_support`, `query: <the SQL from Step 1>`.

- [ ] **Step 3: Verify**

Call `mcp__claude_ai_Supabase__list_tables` again — expect `elder_pairing_codes` and `elder_login_otps` now present alongside Task 1's tables.

- [ ] **Step 4: Manual Supabase Dashboard wiring (cannot be done via SQL/API)**

This step must be done by Stephanie in the Supabase Dashboard for project `cmtubaxlniglklmdwlzs` — it isn't reachable through any available MCP tool:

1. **Authentication → Sign In / Providers → Phone**: enable the Phone provider. If the dashboard insists on an SMS provider (Twilio/MessageBird/Vonage) being configured before it lets you save, fill in placeholder values (any non-empty Account SID / Auth Token / Message Service SID) — per Supabase's docs, the Send SMS Hook fully replaces the built-in SMS sending step once enabled, so these fields become unused, but the UI may still require them to be non-blank.
2. **Authentication → Hooks**: enable the "Send SMS hook", type "Postgres function", and select `public.send_sms`.
3. If the current dashboard UI differs from this description (Supabase changes their console periodically), follow `https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook` for the up-to-date steps — the goal is just "phone provider enabled" + "Send SMS hook wired to `public.send_sms`".

- [ ] **Step 5: Smoke-test the OTP + hook wiring end-to-end**

From any machine with `curl`, using the project's anon key (get it via `mcp__claude_ai_Supabase__get_publishable_keys` with `project_id: cmtubaxlniglklmdwlzs` if you don't have it handy):

```bash
PROJECT_URL="https://cmtubaxlniglklmdwlzs.supabase.co"
ANON_KEY="<paste anon key here, do not commit it anywhere>"
TEST_PHONE="+85261234567"   # use a real test number you control, or any unused number — no real SMS will be sent

curl -s -X POST "$PROJECT_URL/auth/v1/otp" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"phone\": \"$TEST_PHONE\"}"
```
Expected: `{}` (success, no error field).

Then read the code back:
```bash
curl -s -X POST "$PROJECT_URL/rest/v1/rpc/get_pending_otp" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"p_phone\": \"$TEST_PHONE\"}"
```
Expected: a 6-digit string in quotes, e.g. `"561166"`. If this returns `null`, the hook isn't wired correctly — re-check Step 4.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: pairing-code and OTP-outbox schema + Send SMS hook for AI老友記 login"
```

---

## Task 3: Frontend Supabase client wiring

**Files:**
- Modify: `app/package.json`
- Create: `app/src/lib/supabaseClient.ts`
- Create: `app/.env.example`
- Create: `app/.env` (gitignored — not pushed)
- Create: `app/src/types/auth.ts`

- [ ] **Step 1: Install the client library**

```bash
cd "AI for elderly/app"
npm install @supabase/supabase-js@^2.110.0
```

- [ ] **Step 2: Get the real project URL and anon key**

Call `mcp__claude_ai_Supabase__get_project_url` with `project_id: cmtubaxlniglklmdwlzs` (expect `https://cmtubaxlniglklmdwlzs.supabase.co`) and `mcp__claude_ai_Supabase__get_publishable_keys` with the same `project_id` (use the first key where `disabled` is not `true`).

- [ ] **Step 3: Write `.env.example` (committed, blank) and `.env` (real values, gitignored)**

`app/.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`app/.env` (fill in the real values from Step 2):
```
VITE_SUPABASE_URL=https://cmtubaxlniglklmdwlzs.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon key from Step 2>
```

Verify it's actually gitignored before moving on: `git check-ignore -v "AI for elderly/app/.env"` from the repo root should print a match against the root `.gitignore`'s `.env` line. If it doesn't match, stop and fix `.gitignore` before proceeding (do not push a real key).

- [ ] **Step 4: Write the auth role type**

`app/src/types/auth.ts`:
```ts
export type UserRole = 'elder' | 'family';
```

- [ ] **Step 5: Write the Supabase client singleton**

`app/src/lib/supabaseClient.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 未設定，login 會失敗');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');
```

- [ ] **Step 6: Verify the app still builds**

```bash
npm run build
```
Expected: succeeds with no TypeScript errors.

- [ ] **Step 7: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: wire up Supabase client for AI老友記 app"
```

---

## Task 4: Auth library (`lib/auth.ts`)

**Files:**
- Create: `app/src/lib/auth.ts`
- Test: `app/src/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

`app/src/lib/auth.test.ts`:
```ts
import { vi } from 'vitest';

const rpcMock = vi.fn();
const signInWithOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { toE164, requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from './auth';

describe('toE164', () => {
  it('prepends +852 to a bare 8-digit HK number', () => {
    expect(toE164('91234567')).toBe('+85291234567');
  });

  it('leaves an already-international number untouched', () => {
    expect(toE164('+85291234567')).toBe('+85291234567');
  });

  it('strips spaces before normalizing', () => {
    expect(toE164('9123 4567')).toBe('+85291234567');
  });
});

describe('requestOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signInWithOtp with the normalized phone and returns no error on success', async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    const result = await requestOtp('91234567');
    expect(signInWithOtpMock).toHaveBeenCalledWith({ phone: '+85291234567' });
    expect(result.error).toBeNull();
  });

  it('surfaces the error message on failure', async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: 'boom' } });
    const result = await requestOtp('91234567');
    expect(result.error).toBe('boom');
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

  it('calls supabase verifyOtp with the sms type', async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    const result = await verifyOtp('91234567', '561166');
    expect(verifyOtpMock).toHaveBeenCalledWith({ phone: '+85291234567', token: '561166', type: 'sms' });
    expect(result.error).toBeNull();
  });
});

describe('ensureProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing role without inserting if a profile already exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'family' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn();
    fromMock.mockReturnValue({ select, insert });

    const role = await ensureProfile('elder');
    expect(role).toBe('family');
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a new profile with the chosen role when none exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ select, insert });

    const role = await ensureProfile('elder');
    expect(role).toBe('elder');
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', role: 'elder' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/auth.test.ts
```
Expected: FAIL — `./auth` has no exports (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`app/src/lib/auth.ts`:
```ts
import { supabase } from './supabaseClient';
import type { UserRole } from '../types/auth';

export function toE164(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('852')) return `+${digits}`;
  return `+852${digits}`;
}

export async function requestOtp(phone: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
  return { error: error?.message ?? null };
}

export async function fetchDisplayedOtp(phone: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_pending_otp', { p_phone: toE164(phone) });
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function verifyOtp(phone: string, code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'sms' });
  return { error: error?.message ?? null };
}

export async function ensureProfile(chosenRole: UserRole): Promise<UserRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { data: existing } = await supabase
    .from('elder_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return existing.role as UserRole;

  await supabase.from('elder_profiles').insert({ user_id: user.id, role: chosenRole });
  return chosenRole;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/auth.test.ts
```
Expected: PASS, all 9 tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: auth library (phone OTP request/verify, profile role resolution)"
```

---

## Task 5: `useAuth` hook

**Files:**
- Create: `app/src/hooks/useAuth.ts`
- Test: `app/src/hooks/useAuth.test.ts`

- [ ] **Step 1: Write the failing test**

`app/src/hooks/useAuth.test.ts`:
```ts
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { useAuth } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('reports signed-out when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useAuth());
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('signed-out'));
    expect(result.current.userId).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('resolves the role from elder_profiles when a session exists', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'elder' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe('signed-in'));
    expect(result.current.userId).toBe('u1');
    expect(result.current.role).toBe('elder');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/hooks/useAuth.test.ts
```
Expected: FAIL — module `./useAuth` not found.

- [ ] **Step 3: Write the implementation**

`app/src/hooks/useAuth.ts`:
```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { UserRole } from '../types/auth';

export interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  userId: string | null;
  role: UserRole | null;
}

const initialState: AuthState = { status: 'loading', userId: null, role: null };

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let active = true;

    async function resolve(userId: string) {
      const { data } = await supabase
        .from('elder_profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active) return;
      setState({ status: 'signed-in', userId, role: (data?.role as UserRole) ?? null });
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: { id: string } } | null } }) => {
      if (!active) return;
      if (session?.user) resolve(session.user.id);
      else setState({ status: 'signed-out', userId: null, role: null });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: { id: string } } | null) => {
        if (session?.user) resolve(session.user.id);
        else setState({ status: 'signed-out', userId: null, role: null });
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/hooks/useAuth.test.ts
```
Expected: PASS, both tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: useAuth hook (session + role resolution)"
```

---

## Task 6: `LoginScreen` component

**Files:**
- Create: `app/src/components/LoginScreen.tsx`
- Test: `app/src/components/LoginScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

`app/src/components/LoginScreen.test.tsx`:
```ts
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

  it('walks through role choice -> phone -> OTP confirm -> onLoggedIn', async () => {
    requestOtpMock.mockResolvedValue({ error: null });
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue({ error: null });
    ensureProfileMock.mockResolvedValue('elder');

    const onLoggedIn = vi.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    await userEvent.click(screen.getByText('我係長者'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('561166')).toBeInTheDocument();

    await userEvent.click(screen.getByText('確認登入'));

    expect(verifyOtpMock).toHaveBeenCalledWith('91234567', '561166');
    expect(ensureProfileMock).toHaveBeenCalledWith('elder');
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('shows an error and stays on the phone step when sending fails', async () => {
    requestOtpMock.mockResolvedValue({ error: 'boom' });

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係仔女'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('傳送失敗，check 下電話號碼啱唔啱')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/LoginScreen.test.tsx
```
Expected: FAIL — module `./LoginScreen` not found.

- [ ] **Step 3: Write the implementation**

`app/src/components/LoginScreen.tsx`:
```tsx
import { useState } from 'react';
import { requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from '../lib/auth';
import type { UserRole } from '../types/auth';

type Step = 'choose-role' | 'enter-phone' | 'confirm-otp';

interface LoginScreenProps {
  onLoggedIn: () => void;
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [step, setStep] = useState<Step>('choose-role');
  const [role, setRole] = useState<UserRole | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendOtp() {
    setBusy(true);
    setError(null);
    const { error: reqError } = await requestOtp(phone);
    if (reqError) {
      setError('傳送失敗，check 下電話號碼啱唔啱');
      setBusy(false);
      return;
    }

    let code = await fetchDisplayedOtp(phone);
    if (!code) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      code = await fetchDisplayedOtp(phone);
    }
    if (!code) {
      setError('攞唔到驗證碼，撳「傳送驗證碼」再試多次');
      setBusy(false);
      return;
    }

    setOtp(code);
    setStep('confirm-otp');
    setBusy(false);
  }

  async function handleConfirm() {
    if (!otp || !role) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await verifyOtp(phone, otp);
    if (verifyError) {
      setError('驗證失敗，撳返去重新傳送');
      setBusy(false);
      return;
    }
    await ensureProfile(role);
    setBusy(false);
    onLoggedIn();
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
              setStep('enter-phone');
            }}
          >
            我係長者
          </button>
          <button
            className="bigbtn"
            onClick={() => {
              setRole('family');
              setStep('enter-phone');
            }}
          >
            我係仔女
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
          {error && <p className="error-text">{error}</p>}
          <button className="bigbtn" disabled={busy || phone.length < 8} onClick={handleSendOtp}>
            {busy ? '傳送緊…' : '傳送驗證碼'}
          </button>
        </div>
      )}

      {step === 'confirm-otp' && (
        <div className="fam-card">
          <p>驗證碼：</p>
          <p className="otp-display">{otp}</p>
          {error && <p className="error-text">{error}</p>}
          <button className="bigbtn" disabled={busy} onClick={handleConfirm}>
            {busy ? '確認緊…' : '確認登入'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/components/LoginScreen.test.tsx
```
Expected: PASS, both tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: LoginScreen (role choice, phone entry, in-app OTP confirm)"
```

---

## Task 7: Rewrite `useProgress` to be Supabase-backed

**Files:**
- Create: `app/src/lib/progressApi.ts`
- Test: `app/src/lib/progressApi.test.ts`
- Modify: `app/src/hooks/useProgress.ts`
- Modify: `app/src/hooks/useProgress.test.ts`

- [ ] **Step 1: Write the failing test for `progressApi`**

`app/src/lib/progressApi.test.ts`:
```ts
import { vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { fetchProgress, markLessonCompleted, touchStreak, setFamilyShareEnabled } from './progressApi';

describe('fetchProgress', () => {
  it('combines completions, streak, and share-flag queries', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_lesson_completions') {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ lesson_id: 'l1' }, { lesson_id: 'l2' }] }) }) };
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

    const result = await fetchProgress('u1');
    expect(result).toEqual({
      completedLessonIds: ['l1', 'l2'],
      streakCount: 3,
      lastActiveDate: '2026-07-16',
      familyShareEnabled: false,
    });
  });
});

describe('markLessonCompleted', () => {
  it('upserts with ignoreDuplicates so re-completing is a no-op', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert });

    await markLessonCompleted('u1', 'l1');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'u1', lesson_id: 'l1' },
      { onConflict: 'user_id,lesson_id', ignoreDuplicates: true },
    );
  });
});

describe('touchStreak', () => {
  it('does not write again if already active today', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { streak_count: 4, last_active_date: '2026-07-16' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const upsert = vi.fn();
    fromMock.mockReturnValue({ select, upsert });

    const calcStreak = vi.fn();
    const result = await touchStreak('u1', '2026-07-16', calcStreak);

    expect(result).toEqual({ streakCount: 4, lastActiveDate: '2026-07-16' });
    expect(upsert).not.toHaveBeenCalled();
    expect(calcStreak).not.toHaveBeenCalled();
  });

  it('computes and upserts the new streak when the day changed', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { streak_count: 4, last_active_date: '2026-07-15' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ select, upsert });

    const calcStreak = vi.fn().mockReturnValue(5);
    const result = await touchStreak('u1', '2026-07-16', calcStreak);

    expect(calcStreak).toHaveBeenCalledWith('2026-07-15', '2026-07-16', 4);
    expect(result).toEqual({ streakCount: 5, lastActiveDate: '2026-07-16' });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', streak_count: 5, last_active_date: '2026-07-16' }),
    );
  });
});

describe('setFamilyShareEnabled', () => {
  it('updates the profile row', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    await setFamilyShareEnabled('u1', false);
    expect(update).toHaveBeenCalledWith({ family_share_enabled: false });
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/progressApi.test.ts
```
Expected: FAIL — module `./progressApi` not found.

- [ ] **Step 3: Write `progressApi.ts`**

`app/src/lib/progressApi.ts`:
```ts
import { supabase } from './supabaseClient';

export interface RemoteProgress {
  completedLessonIds: string[];
  streakCount: number;
  lastActiveDate: string | null;
  familyShareEnabled: boolean;
}

export async function fetchProgress(userId: string): Promise<RemoteProgress> {
  const [{ data: completions }, { data: streak }, { data: profile }] = await Promise.all([
    supabase.from('elder_lesson_completions').select('lesson_id').eq('user_id', userId),
    supabase.from('elder_streaks').select('streak_count,last_active_date').eq('user_id', userId).maybeSingle(),
    supabase.from('elder_profiles').select('family_share_enabled').eq('user_id', userId).maybeSingle(),
  ]);

  return {
    completedLessonIds: (completions ?? []).map((row: { lesson_id: string }) => row.lesson_id),
    streakCount: streak?.streak_count ?? 0,
    lastActiveDate: streak?.last_active_date ?? null,
    familyShareEnabled: profile?.family_share_enabled ?? true,
  };
}

export async function markLessonCompleted(userId: string, lessonId: string): Promise<void> {
  await supabase
    .from('elder_lesson_completions')
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true });
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
  await supabase
    .from('elder_streaks')
    .upsert({ user_id: userId, streak_count: nextCount, last_active_date: today, updated_at: new Date().toISOString() });

  return { streakCount: nextCount, lastActiveDate: today };
}

export async function setFamilyShareEnabled(userId: string, enabled: boolean): Promise<void> {
  await supabase.from('elder_profiles').update({ family_share_enabled: enabled }).eq('user_id', userId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/progressApi.test.ts
```
Expected: PASS, all 5 tests.

- [ ] **Step 5: Write the failing test for the rewritten `useProgress`**

Replace `app/src/hooks/useProgress.test.ts` entirely with:
```ts
import { renderHook, waitFor } from '@testing-library/react';
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

  it('completeLesson calls markLessonCompleted and updates local state optimistically', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: todayISO(),
      familyShareEnabled: true,
    });
    markLessonCompletedMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProgress('u1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await result.current.completeLesson('l9');

    expect(markLessonCompletedMock).toHaveBeenCalledWith('u1', 'l9');
    expect(result.current.state.completedLessonIds).toContain('l9');
  });

  it('setFamilyShare calls setFamilyShareEnabled and updates local state', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: todayISO(),
      familyShareEnabled: true,
    });
    setFamilyShareEnabledMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProgress('u1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await result.current.setFamilyShare(false);

    expect(setFamilyShareEnabledMock).toHaveBeenCalledWith('u1', false);
    expect(result.current.state.familyShareEnabled).toBe(false);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
npx vitest run src/hooks/useProgress.test.ts
```
Expected: FAIL — `useProgress` still reads/writes `localStorage` and takes no `userId` argument.

- [ ] **Step 7: Rewrite `useProgress.ts`**

Replace `app/src/hooks/useProgress.ts` entirely with:
```ts
import { useCallback, useEffect, useState } from 'react';
import { fetchProgress, markLessonCompleted, setFamilyShareEnabled, touchStreak } from '../lib/progressApi';

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
  const [state, setState] = useState<ProgressState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const remote = await fetchProgress(userId);
      const today = todayISO();
      let next = remote;
      if (remote.lastActiveDate !== today) {
        const touched = await touchStreak(userId, today, calcStreak);
        next = { ...remote, streakCount: touched.streakCount, lastActiveDate: touched.lastActiveDate };
      }
      if (!active) return;
      setState(next);
      setLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const completeLesson = useCallback(
    async (lessonId: string) => {
      if (!userId || state.completedLessonIds.includes(lessonId)) return;
      await markLessonCompleted(userId, lessonId);
      setState((prev) => ({ ...prev, completedLessonIds: [...prev.completedLessonIds, lessonId] }));
    },
    [userId, state.completedLessonIds],
  );

  const setFamilyShare = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      await setFamilyShareEnabled(userId, enabled);
      setState((prev) => ({ ...prev, familyShareEnabled: enabled }));
    },
    [userId],
  );

  return { state, loaded, completeLesson, setFamilyShare };
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
npx vitest run src/hooks/useProgress.test.ts
```
Expected: PASS, all 8 tests.

- [ ] **Step 9: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: move progress/streak/family-share from localStorage to Supabase"
```

---

## Task 8: Family pairing library (`lib/family.ts`)

**Files:**
- Create: `app/src/lib/family.ts`
- Test: `app/src/lib/family.test.ts`

- [ ] **Step 1: Write the failing test**

`app/src/lib/family.test.ts`:
```ts
import { vi } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { createPairingCode, redeemPairingCode, fetchFamilyLink } from './family';

describe('createPairingCode', () => {
  it('returns the code from the RPC', async () => {
    rpcMock.mockResolvedValue({ data: '384920', error: null });
    const code = await createPairingCode();
    expect(rpcMock).toHaveBeenCalledWith('create_pairing_code');
    expect(code).toBe('384920');
  });

  it('throws with a friendly message on error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'db error' } });
    await expect(createPairingCode()).rejects.toThrow('攞唔到配對碼，請再試');
  });
});

describe('redeemPairingCode', () => {
  it('returns the elder info on success', async () => {
    rpcMock.mockResolvedValue({ data: [{ elder_user_id: 'e1', elder_display_name: '陳生' }], error: null });
    const result = await redeemPairingCode('384920');
    expect(rpcMock).toHaveBeenCalledWith('redeem_pairing_code', { p_code: '384920' });
    expect(result).toEqual({ elderUserId: 'e1', elderDisplayName: '陳生' });
  });

  it('throws the database error message on failure', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: '配對碼過期' } });
    await expect(redeemPairingCode('000000')).rejects.toThrow('配對碼過期');
  });
});

describe('fetchFamilyLink', () => {
  it('returns null when no link exists yet', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    expect(await fetchFamilyLink('fam1')).toBeNull();
  });

  it('returns the elder user id and display name when a link exists', async () => {
    const linkMaybeSingle = vi.fn().mockResolvedValue({ data: { elder_user_id: 'e1' } });
    const linkEq = vi.fn(() => ({ maybeSingle: linkMaybeSingle }));
    const linkSelect = vi.fn(() => ({ eq: linkEq }));

    const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { display_name: '陳生' } });
    const profileEq = vi.fn(() => ({ maybeSingle: profileMaybeSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_family_links') return { select: linkSelect };
      if (table === 'elder_profiles') return { select: profileSelect };
      throw new Error(`unexpected table ${table}`);
    });

    expect(await fetchFamilyLink('fam1')).toEqual({ elderUserId: 'e1', elderDisplayName: '陳生' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/family.test.ts
```
Expected: FAIL — module `./family` not found.

- [ ] **Step 3: Write the implementation**

`app/src/lib/family.ts`:
```ts
import { supabase } from './supabaseClient';

export async function createPairingCode(): Promise<string> {
  const { data, error } = await supabase.rpc('create_pairing_code');
  if (error || !data) throw new Error('攞唔到配對碼，請再試');
  return data as string;
}

export async function redeemPairingCode(
  code: string,
): Promise<{ elderUserId: string; elderDisplayName: string | null }> {
  const { data, error } = await supabase.rpc('redeem_pairing_code', { p_code: code });
  if (error) throw new Error(error.message);
  const row = (data as { elder_user_id: string; elder_display_name: string | null }[])[0];
  return { elderUserId: row.elder_user_id, elderDisplayName: row.elder_display_name };
}

export async function fetchFamilyLink(
  familyUserId: string,
): Promise<{ elderUserId: string; elderDisplayName: string | null } | null> {
  const { data: link } = await supabase
    .from('elder_family_links')
    .select('elder_user_id')
    .eq('family_user_id', familyUserId)
    .maybeSingle();
  if (!link) return null;

  const { data: profile } = await supabase
    .from('elder_profiles')
    .select('display_name')
    .eq('user_id', link.elder_user_id)
    .maybeSingle();

  return { elderUserId: link.elder_user_id, elderDisplayName: profile?.display_name ?? null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/family.test.ts
```
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: family pairing library (create/redeem code, fetch link)"
```

---

## Task 9: `PairingScreen` + `FamilyScreen` updates

**Files:**
- Create: `app/src/components/PairingScreen.tsx`
- Test: `app/src/components/PairingScreen.test.tsx`
- Modify: `app/src/components/FamilyScreen.tsx`
- Modify: `app/src/components/FamilyScreen.test.tsx`

- [ ] **Step 1: Write the failing test for `PairingScreen`**

`app/src/components/PairingScreen.test.tsx`:
```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const redeemPairingCodeMock = vi.fn();

vi.mock('../lib/family', () => ({
  redeemPairingCode: (...args: unknown[]) => redeemPairingCodeMock(...args),
}));

import { PairingScreen } from './PairingScreen';

describe('PairingScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redeems the entered code and calls onPaired with the elder info', async () => {
    redeemPairingCodeMock.mockResolvedValue({ elderUserId: 'e1', elderDisplayName: '陳生' });
    const onPaired = vi.fn();

    render(<PairingScreen onPaired={onPaired} />);
    await userEvent.type(screen.getByPlaceholderText('配對碼'), '384920');
    await userEvent.click(screen.getByText('配對'));

    expect(redeemPairingCodeMock).toHaveBeenCalledWith('384920');
    expect(onPaired).toHaveBeenCalledWith({ elderUserId: 'e1', elderDisplayName: '陳生' });
  });

  it('shows the thrown error message when redemption fails', async () => {
    redeemPairingCodeMock.mockRejectedValue(new Error('配對碼過期'));

    render(<PairingScreen onPaired={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('配對碼'), '000000');
    await userEvent.click(screen.getByText('配對'));

    expect(await screen.findByText('配對碼過期')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npx vitest run src/components/PairingScreen.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write `PairingScreen.tsx`**

`app/src/components/PairingScreen.tsx`:
```tsx
import { useState } from 'react';
import { redeemPairingCode } from '../lib/family';

interface PairingScreenProps {
  onPaired: (elder: { elderUserId: string; elderDisplayName: string | null }) => void;
}

export function PairingScreen({ onPaired }: PairingScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePair() {
    setBusy(true);
    setError(null);
    try {
      const elder = await redeemPairingCode(code);
      onPaired(elder);
    } catch (err) {
      setError(err instanceof Error ? err.message : '配對失敗');
    } finally {
      setBusy(false);
    }
  }

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
        <button className="bigbtn" disabled={busy || code.length < 6} onClick={handlePair}>
          {busy ? '配對緊…' : '配對'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npx vitest run src/components/PairingScreen.test.tsx
```
Expected: PASS, both tests.

- [ ] **Step 5: Update the failing test for `FamilyScreen`**

Replace `app/src/components/FamilyScreen.test.tsx` entirely with:
```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createPairingCodeMock = vi.fn();

vi.mock('../lib/family', () => ({
  createPairingCode: (...args: unknown[]) => createPairingCodeMock(...args),
}));

import { FamilyScreen } from './FamilyScreen';

describe('FamilyScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggles share via the callback', async () => {
    const onToggleShare = vi.fn();
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} />);
    await userEvent.click(screen.getByRole('button', { name: '' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
  });

  it('generates and displays a pairing code on tap', async () => {
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('384920')).toBeInTheDocument();
  });

  it('does not show the pairing prompt when sharing is off', () => {
    render(<FamilyScreen shareEnabled={false} onToggleShare={vi.fn()} />);
    expect(screen.queryByText('產生配對碼')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test, verify it fails**

```bash
npx vitest run src/components/FamilyScreen.test.tsx
```
Expected: FAIL — `FamilyScreen` has no "產生配對碼" button yet.

- [ ] **Step 7: Update `FamilyScreen.tsx`**

Replace `app/src/components/FamilyScreen.tsx` entirely with:
```tsx
import { useState } from 'react';
import { createPairingCode } from '../lib/family';

interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
}

export function FamilyScreen({ shareEnabled, onToggleShare }: FamilyScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGenerateCode() {
    setBusy(true);
    try {
      const code = await createPairingCode();
      setPairingCode(code);
    } finally {
      setBusy(false);
    }
  }

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
            onClick={() => onToggleShare(!shareEnabled)}
            aria-pressed={shareEnabled}
          />
        </div>
      </div>
      {shareEnabled && (
        <div className="fam-card">
          {pairingCode ? (
            <>
              <p>配對碼（俾屋企人 10 分鐘內輸入）：</p>
              <p className="otp-display">{pairingCode}</p>
            </>
          ) : (
            <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
              {busy ? '產生緊…' : '產生配對碼'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run the test, verify it passes**

```bash
npx vitest run src/components/FamilyScreen.test.tsx
```
Expected: PASS, all 3 tests.

- [ ] **Step 9: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: PairingScreen + FamilyScreen pairing-code generation"
```

---

## Task 10: `FamilyProgressView` (family's read-only view)

**Files:**
- Create: `app/src/components/FamilyProgressView.tsx`
- Test: `app/src/components/FamilyProgressView.test.tsx`

- [ ] **Step 1: Write the failing test**

`app/src/components/FamilyProgressView.test.tsx`:
```ts
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const fetchProgressMock = vi.fn();

vi.mock('../lib/progressApi', () => ({
  fetchProgress: (...args: unknown[]) => fetchProgressMock(...args),
}));

import { FamilyProgressView } from './FamilyProgressView';

describe('FamilyProgressView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the elder streak and completed-lesson count once loaded', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: ['l1', 'l2'],
      streakCount: 5,
      lastActiveDate: '2026-07-17',
      familyShareEnabled: true,
    });

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    await waitFor(() => expect(screen.getByText(/5/)).toBeInTheDocument());
    expect(screen.getByText(/陳生/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('shows a sharing-off message when the elder has since turned sharing off', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: false,
    });

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    expect(await screen.findByText('對方而家冇分享緊進度')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npx vitest run src/components/FamilyProgressView.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`app/src/components/FamilyProgressView.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { fetchProgress, type RemoteProgress } from '../lib/progressApi';

interface FamilyProgressViewProps {
  elderUserId: string;
  elderDisplayName: string | null;
}

export function FamilyProgressView({ elderUserId, elderDisplayName }: FamilyProgressViewProps) {
  const [progress, setProgress] = useState<RemoteProgress | null>(null);

  useEffect(() => {
    let active = true;
    fetchProgress(elderUserId).then((result) => {
      if (active) setProgress(result);
    });
    return () => {
      active = false;
    };
  }, [elderUserId]);

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
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npx vitest run src/components/FamilyProgressView.test.tsx
```
Expected: PASS, both tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: FamilyProgressView (read-only elder progress for paired family accounts)"
```

---

## Task 11: DB-driven lesson content

**Files:**
- Create: `app/src/hooks/useLessons.ts`
- Test: `app/src/hooks/useLessons.test.ts`

(`App.tsx` starts consuming this hook in Task 12, alongside the auth-gate rewrite — not touched in this task.)

- [ ] **Step 1: Write the failing test for `useLessons`**

`app/src/hooks/useLessons.test.ts`:
```ts
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
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npx vitest run src/hooks/useLessons.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write `useLessons.ts`**

`app/src/hooks/useLessons.ts`:
```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Lesson } from '../types/lesson';

export function useLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('elder_lessons')
      .select('id,layer,number,title,subtitle,steps')
      .eq('status', 'published')
      .order('layer', { ascending: true })
      .order('number', { ascending: true })
      .then(({ data }: { data: Lesson[] | null }) => {
        if (!active) return;
        setLessons(data ?? []);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { lessons, loaded };
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npx vitest run src/hooks/useLessons.test.ts
```
Expected: PASS.

- [ ] **Step 5: Seed the existing hardcoded lesson into `elder_lessons`**

Read `app/src/data/seedLesson.ts` to get the exact current values, then call `mcp__claude_ai_Supabase__execute_sql` with `project_id: cmtubaxlniglklmdwlzs` and a query of this shape (substitute the real field values from that file — do not paraphrase the Cantonese copy):

```sql
insert into public.elder_lessons (id, layer, number, title, subtitle, steps, status)
values (
  '<seedLesson.id>',
  <seedLesson.layer>,
  <seedLesson.number>,
  '<seedLesson.title>',
  '<seedLesson.subtitle>',
  '<seedLesson.steps as a JSON string, single-quoted, with internal single quotes doubled>'::jsonb,
  'published'
)
on conflict (id) do nothing;
```

Verify with a follow-up `execute_sql` call: `select id, layer, title from public.elder_lessons;` — expect exactly one row matching the seed lesson.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: useLessons hook + seed lesson migrated into elder_lessons"
```

---

## Task 12: Wire the auth gate + role-based routing into `App.tsx`

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/App.test.tsx`

- [ ] **Step 1: Update the failing integration test**

Replace `app/src/App.test.tsx` entirely with:
```ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const useAuthMock = vi.fn();
vi.mock('./hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const useLessonsMock = vi.fn();
vi.mock('./hooks/useLessons', () => ({ useLessons: () => useLessonsMock() }));

const useProgressMock = vi.fn();
vi.mock('./hooks/useProgress', async () => {
  const actual = await vi.importActual<typeof import('./hooks/useProgress')>('./hooks/useProgress');
  return {
    ...actual,
    useProgress: (...args: unknown[]) => useProgressMock(...args),
  };
});

const fetchFamilyLinkMock = vi.fn();
vi.mock('./lib/family', () => ({
  fetchFamilyLink: (...args: unknown[]) => fetchFamilyLinkMock(...args),
  createPairingCode: vi.fn(),
  redeemPairingCode: vi.fn(),
}));

import { App } from './App';

const seedLesson = {
  id: 'lesson-001',
  layer: 1 as const,
  number: 1,
  title: 'AI 係咩',
  subtitle: '第一課',
  steps: [
    { kind: 'why' as const, title: 'W', body: ['x'], speak: 's' },
    { kind: 'demo' as const, title: 'D', bubbles: [], body: ['x'], speak: 's' },
    {
      kind: 'quiz' as const,
      title: 'Q',
      options: [
        { text: 'A', correct: true },
        { text: 'B', correct: false },
      ] as [{ text: string; correct: boolean }, { text: string; correct: boolean }],
      feedbackCorrect: 'yes',
      feedbackWrong: 'no',
    },
  ],
};

describe('App auth gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows LoginScreen while signed out', () => {
    useAuthMock.mockReturnValue({ status: 'signed-out', userId: null, role: null });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText('邊個登入？')).toBeInTheDocument();
  });

  it('shows the elder 4-tab shell once signed in as elder', () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
    useLessonsMock.mockReturnValue({ lessons: [seedLesson], loaded: true });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 2, lastActiveDate: '2026-07-17', familyShareEnabled: true },
      loaded: true,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText('主頁')).toBeInTheDocument();
  });

  it('shows PairingScreen for a signed-in family account with no link yet', async () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'fam1', role: 'family' });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });
    fetchFamilyLinkMock.mockResolvedValue(null);

    render(<App />);
    await waitFor(() => expect(screen.getByText('輸入配對碼')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npx vitest run src/App.test.tsx
```
Expected: FAIL — `App` still renders the 4-tab shell unconditionally with no auth gate.

- [ ] **Step 3: Rewrite `App.tsx`**

Replace `app/src/App.tsx` entirely with:
```tsx
import { useEffect, useState } from 'react';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './components/HomeScreen';
import { LessonScreen } from './components/LessonScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { FamilyScreen } from './components/FamilyScreen';
import { LoginScreen } from './components/LoginScreen';
import { PairingScreen } from './components/PairingScreen';
import { FamilyProgressView } from './components/FamilyProgressView';
import { useAuth } from './hooks/useAuth';
import { useLessons } from './hooks/useLessons';
import { useProgress, computeBadges } from './hooks/useProgress';
import { fetchFamilyLink } from './lib/family';
import type { ScreenName } from './types/screen';

function ElderShell({ userId }: { userId: string }) {
  const [screen, setScreen] = useState<ScreenName>('home');
  const { lessons, loaded: lessonsLoaded } = useLessons();
  const { state, completeLesson, setFamilyShare } = useProgress(userId);

  if (!lessonsLoaded) return <div className="app" />;

  const todayLesson = lessons[0] ?? null;
  const layer1Total = lessons.filter((l) => l.layer === 1).length;
  const layer1Completed = lessons.filter((l) => l.layer === 1 && state.completedLessonIds.includes(l.id)).length;

  const badges = computeBadges({
    completedCount: state.completedLessonIds.length,
    streakCount: state.streakCount,
    antiFraudDone: false,
    allLayersDone: false,
  });

  return (
    <div className="app">
      {screen === 'home' && todayLesson && (
        <HomeScreen todayLesson={todayLesson} streakCount={state.streakCount} onStartLesson={() => setScreen('lesson')} />
      )}
      {screen === 'lesson' && todayLesson && (
        <LessonScreen
          lesson={todayLesson}
          onComplete={() => {
            completeLesson(todayLesson.id);
            setScreen('progress');
          }}
        />
      )}
      {screen === 'progress' && (
        <ProgressScreen
          layers={[
            { layer: 1, name: 'AI 入門（淺）', totalLessons: layer1Total, completedLessons: layer1Completed },
            { layer: 2, name: '生活應用（中）', totalLessons: 0, completedLessons: 0 },
            { layer: 3, name: '進階玩法（深）', totalLessons: 0, completedLessons: 0 },
          ]}
          badges={badges}
        />
      )}
      {screen === 'family' && <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} />}
      <NavBar active={screen} onNavigate={setScreen} />
    </div>
  );
}

function FamilyFlow({ userId }: { userId: string }) {
  const [link, setLink] = useState<{ elderUserId: string; elderDisplayName: string | null } | null | undefined>(
    undefined,
  );

  useEffect(() => {
    fetchFamilyLink(userId).then(setLink);
  }, [userId]);

  if (link === undefined) return <div className="app" />;
  if (link === null) {
    return (
      <div className="app">
        <PairingScreen onPaired={(elder) => setLink(elder)} />
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
        <LoginScreen onLoggedIn={() => window.location.reload()} />
      </div>
    );
  }

  if (auth.role === 'family') return <FamilyFlow userId={auth.userId as string} />;

  return <ElderShell userId={auth.userId as string} />;
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npx vitest run src/App.test.tsx
```
Expected: PASS, all 3 tests.

- [ ] **Step 5: Run the full test suite and the build**

```bash
npm test
npm run build
npm run lint
```
Expected: all green.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: wire auth gate + role-based routing into App"
```

---

## Task 13: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the smoke-test from Task 2 Step 5 again** to reconfirm the live hook/OTP path still works after all schema changes.

- [ ] **Step 2: Run the app locally**

```bash
cd "AI for elderly/app"
npm run dev
```

- [ ] **Step 3: Elder walkthrough** — using a headless-Chromium/Playwright session (same tooling Plan 1 used; see its plan doc Task 11 if it needs reinstalling), or manually in a real browser:
1. Open the app → see `LoginScreen` → tap "我係長者" → enter a real test phone number → tap "傳送驗證碼" → confirm the OTP appears on screen within ~1s → tap "確認登入".
2. Confirm the 4-tab elder shell appears, showing the migrated seed lesson.
3. Complete the lesson (三步 + quiz) → confirm it shows as completed on `ProgressScreen`.
4. Reload the page → confirm you land straight back in the elder shell (no re-login) and the completed lesson still shows as completed.
5. On `FamilyScreen`, tap "產生配對碼" → note the 6-digit code shown.

- [ ] **Step 4: Family walkthrough** (separate browser context / incognito window, so it's a distinct session from the elder's)
1. Open the app → `LoginScreen` → tap "我係仔女" → log in with a different test phone number.
2. Confirm `PairingScreen` appears → enter the code from Step 3.5 → confirm it transitions to `FamilyProgressView` showing the elder's real streak/completed-count numbers.
3. Back in the elder's session, toggle family sharing off on `FamilyScreen`. Reload the family session and confirm it now shows "對方而家冇分享緊進度" instead of the numbers.

- [ ] **Step 5: Confirm the acceptance criteria from the design doc**
- [ ] An elder device, once logged in, stays logged in across reload/app close-reopen — confirmed in Step 3.4.
- [ ] A family member entering the correct pairing code immediately sees the elder's real progress numbers — confirmed in Step 4.2.
- [ ] Lessons with `status != 'published'` are unreachable via the API — spot-check by calling `execute_sql`: `update public.elder_lessons set status='pending' where id='<seed id>';` then re-running the elder walkthrough's home screen load and confirming no lesson shows; then revert with `update ... set status='published' ...`.

- [ ] **Step 6: Update `README.md`**

In `AI for elderly/README.md`, under "下一步", replace the Plan 2 bullet with a `✅ Plan 2 已完成` note (following the same style Plan 1 used), and update the "最後更新" line at the bottom.

- [ ] **Step 7: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "docs: mark Plan 2 (Supabase backend + phone-OTP login) complete"
```
