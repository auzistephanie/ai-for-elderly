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
