-- AI老友記 — Supabase schema (shared project cmtubaxlniglklmdwlzs, elder_ prefix)
-- Applied via the Supabase MCP tool / SQL editor. This file is the committed source of truth;
-- keep it in sync whenever schema changes are applied live.
-- Design rationale: docs/superpowers/specs/2026-07-17-plan2-supabase-backend-design.md
-- (§3 Auth Mechanism, §4 Data Model). Every table is elder_-prefixed because this project
-- is shared with other apps (novel_*, coach_*, trips, ...) — the prefix avoids name collisions.

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
--
-- NOTE (fixed 2026-07-17 during Plan 2 Task 13 end-to-end verification): this policy must NOT
-- gate visibility on family_share_enabled = true. A linked family member needs to be able to
-- read this row's family_share_enabled column PRECISELY WHEN IT IS FALSE, so the client can
-- render "對方而家冇分享緊進度" instead of misreading a hidden row as "still sharing" (the
-- client's fetchProgress() defaults family_share_enabled to true when no row comes back, which
-- is meant for "no profile yet", not "row exists but hidden by RLS"). The actual progress data
-- (elder_streaks, elder_lesson_completions) stays correctly hidden while sharing is off via
-- those tables' OWN family-read policies, which still require family_share_enabled = true --
-- this table only exposes the boolean flag itself, which isn't sensitive.
create policy "elder_profiles_family_read"
  on public.elder_profiles for select
  using (
    role = 'elder'
    and exists (
      select 1 from public.elder_family_links l
      where l.elder_user_id = elder_profiles.user_id
        and l.family_user_id = auth.uid()
    )
  );

-- Symmetric counterpart, added during Plan 4 Task 9 end-to-end verification: an elder needs to
-- read a LINKED family member's display_name too (elder_family_comments' fetchComments() joins
-- against elder_profiles to resolve comment authors' names) — without this, the elder-side
-- comment list silently fell back to the generic "家人" label instead of the real name, even
-- though the family member's own view correctly showed it (that direction was already covered
-- by ensureProfile always being able to read/write its own row). No family_share_enabled gate
-- here: that flag only governs an ELDER's progress-sharing opt-out, not a family member's own
-- name visibility — a family member who has actively paired with an elder has no comparable
-- "hide my name" toggle, by design.
create policy "elder_profiles_elder_read_family"
  on public.elder_profiles for select
  using (
    role = 'family'
    and exists (
      select 1 from public.elder_family_links l
      where l.family_user_id = elder_profiles.user_id
        and l.elder_user_id = auth.uid()
    )
  );

-- Lesson content (replaces the hardcoded seed lesson file).
create table public.elder_lessons (
  id text primary key,
  -- layer 0 is reserved for the standalone 防騙必修班 (anti-fraud) class, which per
  -- product spec §5.1 is always unlocked regardless of layer-1/2/3 progress.
  layer smallint not null check (layer in (0, 1, 2, 3)),
  number integer not null,
  title text not null,
  subtitle text not null,
  steps jsonb not null,
  status text not null default 'published' check (status in ('published', 'pending')),
  created_at timestamptz not null default now(),
  unique (layer, number)
);

alter table public.elder_lessons enable row level security;

create policy "elder_lessons_published_read"
  on public.elder_lessons for select
  using (status = 'published');

-- Which user completed which lesson (normalized, not a jsonb array — Plan 5 analytics needs to query this directly).
-- NOTE: lesson_id has ON DELETE CASCADE — a future admin flow that regenerates content must UPDATE
-- existing elder_lessons rows in place, never DELETE + re-insert, or every user's completion record
-- for that lesson silently disappears.
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
        and p.role = 'elder'
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
        and p.role = 'elder'
        and p.family_share_enabled = true
        and l.family_user_id = auth.uid()
    )
  );

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

-- Family-to-elder encouragement comments, with elder-only per-comment likes.
-- Shared feed: any family member currently linked+shared-with an elder can read ALL comments
-- for that elder (not just their own) — see design doc §3 for the "shared list, not private
-- threads" decision.
create table public.elder_family_comments (
  id uuid primary key default gen_random_uuid(),
  elder_user_id uuid not null references auth.users(id) on delete cascade,
  family_user_id uuid not null references auth.users(id) on delete cascade,
  comment_text text not null,
  liked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.elder_family_comments enable row level security;

create policy "elder_family_comments_shared_select"
  on public.elder_family_comments for select
  using (
    auth.uid() = elder_user_id
    or exists (
      select 1
      from public.elder_profiles p
      join public.elder_family_links l on l.elder_user_id = p.user_id
      where p.user_id = elder_family_comments.elder_user_id
        and p.role = 'elder'
        and p.family_share_enabled = true
        and l.family_user_id = auth.uid()
    )
  );

create policy "elder_family_comments_family_insert"
  on public.elder_family_comments for insert
  with check (
    auth.uid() = family_user_id
    and exists (
      select 1
      from public.elder_profiles p
      join public.elder_family_links l on l.elder_user_id = p.user_id
      where p.user_id = elder_family_comments.elder_user_id
        and p.role = 'elder'
        and p.family_share_enabled = true
        and l.family_user_id = auth.uid()
    )
  );

create policy "elder_family_comments_elder_update"
  on public.elder_family_comments for update
  using (auth.uid() = elder_user_id)
  with check (auth.uid() = elder_user_id);

-- Column-scope the elder's update grant to `liked` only, so a crafted request can't rewrite
-- the family member's comment text or reassign authorship — matches this schema's existing
-- care around minimal-necessary grants (see the create_pairing_code/redeem_pairing_code
-- revoke/grant pairs above).
revoke update on public.elder_family_comments from authenticated;
grant update (liked) on public.elder_family_comments to authenticated;

-- Minimal analytics (spec §9): which lessons get started but never completed, so Stephanie
-- can spot content that's too hard or too boring. Write-only from the app's perspective --
-- only the admin Streamlit tool (service_role key, bypasses RLS) ever reads this back, so
-- there's deliberately no select policy for regular users.
create table public.elder_lesson_starts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.elder_lessons(id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table public.elder_lesson_starts enable row level security;

create policy "elder_lesson_starts_self_insert"
  on public.elder_lesson_starts for insert
  with check (auth.uid() = user_id);

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

revoke all on function public.create_pairing_code() from public, anon, authenticated;
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

revoke all on function public.redeem_pairing_code(text) from public, anon, authenticated;
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
