# Plan 4 — Family Companion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add family-to-elder encouragement comments with elder-side per-comment likes, fix the display-name gap (no user currently has a way to set one, even though the column and read-paths have existed since Plan 2), and polish the pairing code's UX (countdown + regenerate) — closing out the family-companion work Plan 2 explicitly deferred here.

**Architecture:** One new table (`elder_family_comments`) reusing the existing `elder_family_links`/`family_share_enabled` gating pattern for RLS, consistent with `elder_lesson_completions`/`elder_streaks`. A new `lib/comments.ts` module (throw-on-error convention, matching `lib/family.ts`/`lib/progressApi.ts`) does two sequential queries (comments, then author names) rather than a PostgREST embedded join, since `elder_family_comments` has no direct FK to `elder_profiles` (both reference `auth.users` independently) — same pattern `lib/family.ts`'s `fetchFamilyLink` already uses. A small shared `CommentList.tsx` presentational component avoids duplicating list-rendering between the elder's own screen (`FamilyScreen`, read+like) and the family member's screen (`FamilyProgressView`, read+post).

**Tech Stack:** Same Vite + React 19 + TypeScript + Vitest stack as every prior plan. No new dependencies.

**Design doc:** `docs/superpowers/specs/2026-07-18-plan4-family-companion-design.md` — this plan implements that approved design; don't re-litigate decisions already made there.

**Repo push convention:** never `git add`/`git commit`/`git push` directly. Push via `python3 scripts/github_push.py "<message>"` from the repo root (`AI for elderly/`). Each task ends with one push.

---

## File Structure

```
AI for elderly/
├── supabase/
│   └── schema.sql                        # MODIFY: new elder_family_comments table + RLS + column-scoped grant
└── app/src/
    ├── lib/
    │   ├── auth.ts                       # MODIFY: ensureProfile(chosenRole, displayName) writes display_name
    │   ├── auth.test.ts                  # MODIFY
    │   ├── comments.ts                   # NEW: fetchComments/postComment/likeComment
    │   └── comments.test.ts              # NEW
    ├── components/
    │   ├── LoginScreen.tsx               # MODIFY: new enter-name step between role-choice and phone
    │   ├── LoginScreen.test.tsx          # MODIFY
    │   ├── CommentList.tsx               # NEW: shared read(+optional like) comment rendering
    │   ├── CommentList.test.tsx          # NEW
    │   ├── FamilyScreen.tsx              # MODIFY: userId prop, comment list (elder reads+likes), pairing-code countdown/regenerate
    │   ├── FamilyScreen.test.tsx         # MODIFY
    │   ├── FamilyProgressView.tsx        # MODIFY: comment composer + shared comment list (family reads+posts)
    │   └── FamilyProgressView.test.tsx   # MODIFY
    ├── App.tsx                           # MODIFY: pass userId to FamilyScreen (one-line wiring)
    └── styles/global.css                 # MODIFY: .comment-row/.comment-author/.comment-text/.like-btn/.comment-input
```

---

## Task 1: `elder_family_comments` schema + RLS

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Write the schema SQL**

Append to `supabase/schema.sql` (after the last existing table/policy block, before the RPC function definitions):
```sql
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
```

- [ ] **Step 2: Apply the migration**

Call `mcp__claude_ai_Supabase__apply_migration`:
```
project_id: cmtubaxlniglklmdwlzs
name: elder_family_comments
query: <the full SQL from Step 1>
```

- [ ] **Step 3: Verify**

Call `mcp__claude_ai_Supabase__list_tables` with `project_id: cmtubaxlniglklmdwlzs`, `schemas: ["public"]` — expect `elder_family_comments` present with `rls_enabled: true`.

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: cmtubaxlniglklmdwlzs`:
```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'elder_family_comments' and privilege_type = 'UPDATE';
```
Expected: exactly one row, `grantee = 'authenticated'`, `column_name = 'liked'` — confirms the column-scoped grant took effect (an elder cannot UPDATE `comment_text`/`family_user_id`/etc. even on their own row).

- [ ] **Step 4: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: elder_family_comments schema (shared comment feed, elder-only per-comment likes)"
```

---

## Task 2: `ensureProfile` writes `display_name`

**Files:**
- Modify: `app/src/lib/auth.ts`
- Modify: `app/src/lib/auth.test.ts`

- [ ] **Step 1: Update the failing tests**

In `app/src/lib/auth.test.ts`, replace the `describe('ensureProfile', ...)` block entirely with:
```ts
describe('ensureProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing role without inserting if a profile already exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'family' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn();
    fromMock.mockReturnValue({ select, insert });

    const role = await ensureProfile('elder', '陳生');
    expect(role).toBe('family');
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a new profile with the chosen role and display name when none exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ select, insert });

    const role = await ensureProfile('elder', '陳生');
    expect(role).toBe('elder');
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', role: 'elder', display_name: '陳生' });
  });

  it('throws when the insert fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    fromMock.mockReturnValue({ select, insert });

    await expect(ensureProfile('elder', '陳生')).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "AI for elderly/app"
npx vitest run src/lib/auth.test.ts
```
Expected: FAIL — `ensureProfile` still takes one argument and the insert call doesn't include `display_name`.

- [ ] **Step 3: Update `ensureProfile`**

In `app/src/lib/auth.ts`, replace the `ensureProfile` function with:
```ts
export async function ensureProfile(chosenRole: UserRole, displayName: string): Promise<UserRole> {
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

  const { error: insertError } = await supabase
    .from('elder_profiles')
    .insert({ user_id: user.id, role: chosenRole, display_name: displayName });
  if (insertError) throw new Error(insertError.message);
  return chosenRole;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/lib/auth.test.ts
```
Expected: PASS, all 12 tests (9 existing across `toE164`/`requestOtp`/`fetchDisplayedOtp`/`verifyOtp` + 3 `ensureProfile`).

- [ ] **Step 5: Run the full suite to confirm the expected `LoginScreen` breakage**

```bash
npx vitest run
```
Expected: `LoginScreen.test.tsx` now FAILS (it still calls `ensureProfile(role)` with one argument) — this is expected and gets fixed in Task 3, which also updates `LoginScreen.tsx` itself. Do not fix `LoginScreen.tsx` in this task.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: ensureProfile persists display_name at signup"
```

---

## Task 3: `LoginScreen` — collect display name

**Files:**
- Modify: `app/src/components/LoginScreen.tsx`
- Modify: `app/src/components/LoginScreen.test.tsx`

- [ ] **Step 1: Replace the failing tests**

Replace `app/src/components/LoginScreen.test.tsx` entirely with:
```tsx
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
    requestOtpMock.mockResolvedValue({ error: null });
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue({ error: null });
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
    requestOtpMock.mockResolvedValue({ error: 'boom' });

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係仔女'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('傳送失敗，check 下電話號碼啱唔啱')).toBeInTheDocument();
  });

  it('recovers when ensureProfile throws after a successful verifyOtp', async () => {
    requestOtpMock.mockResolvedValue({ error: null });
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue({ error: null });
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

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "AI for elderly/app"
npx vitest run src/components/LoginScreen.test.tsx
```
Expected: FAIL — no `enter-name` step exists yet, `ensureProfile` still called with one argument.

- [ ] **Step 3: Rewrite `LoginScreen.tsx`**

Replace `app/src/components/LoginScreen.tsx` entirely with:
```tsx
import { useState } from 'react';
import { requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from '../lib/auth';
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSendOtp() {
    if (busy) return;
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

  function handleBackToPhone() {
    setOtp(null);
    setError(null);
    setStep('enter-phone');
  }

  async function handleConfirm() {
    if (busy || !otp || !role) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await verifyOtp(phone, otp);
    if (verifyError) {
      setError('驗證失敗，撳返去重新傳送');
      setBusy(false);
      return;
    }
    try {
      await ensureProfile(role, name);
    } catch {
      setError('登入失敗，請再試一次');
      setBusy(false);
      return;
    }
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
          {error && <p className="error-text">{error}</p>}
          <button className="bigbtn" disabled={busy || phone.length < 8} onClick={handleSendOtp}>
            {busy ? '傳送緊…' : '傳送驗證碼'}
          </button>
        </div>
      )}

      {step === 'confirm-otp' && (
        <div className="fam-card">
          <p>驗證碼：</p>
          {/* 呢個 app 用自訂 Send SMS Auth Hook 代替真實短訊，所以直接喺畫面度顯示驗證碼係故意噉樣設計，唔係漏咗做保安 — 詳見 Plan 2 設計文件。 */}
          <p className="otp-display">{otp}</p>
          {error && <p className="error-text">{error}</p>}
          <button className="bigbtn" disabled={busy} onClick={handleConfirm}>
            {busy ? '確認緊…' : '確認登入'}
          </button>
          {error && (
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

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/LoginScreen.test.tsx
```
Expected: PASS, all 4 tests.

- [ ] **Step 5: Run the full suite, build, lint**

```bash
npm test
npm run build
npm run lint
```
Expected: all green — this closes out the `LoginScreen`/`ensureProfile` mismatch from Task 2.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: LoginScreen collects display name before phone entry"
```

---

## Task 4: `lib/comments.ts`

**Files:**
- Create: `app/src/lib/comments.ts`
- Test: `app/src/lib/comments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/comments.test.ts`:
```ts
import { vi } from 'vitest';

const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  },
}));

import { fetchComments, postComment, likeComment } from './comments';

describe('fetchComments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('joins comment rows with author display names', async () => {
    const commentsOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'c1', family_user_id: 'f1', comment_text: '好叻呀！', liked: false, created_at: '2026-07-18T10:00:00Z' },
        { id: 'c2', family_user_id: 'f2', comment_text: '加油！', liked: true, created_at: '2026-07-17T10:00:00Z' },
      ],
      error: null,
    });
    const commentsEq = vi.fn(() => ({ order: commentsOrder }));
    const commentsSelect = vi.fn(() => ({ eq: commentsEq }));

    const profilesIn = vi.fn().mockResolvedValue({
      data: [
        { user_id: 'f1', display_name: '陳小姐' },
        { user_id: 'f2', display_name: null },
      ],
      error: null,
    });
    const profilesSelect = vi.fn(() => ({ in: profilesIn }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_family_comments') return { select: commentsSelect };
      if (table === 'elder_profiles') return { select: profilesSelect };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await fetchComments('e1');

    expect(commentsEq).toHaveBeenCalledWith('elder_user_id', 'e1');
    expect(commentsOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(profilesIn).toHaveBeenCalledWith('user_id', ['f1', 'f2']);
    expect(result).toEqual([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
      { id: 'c2', familyUserId: 'f2', familyDisplayName: null, commentText: '加油！', liked: true, createdAt: '2026-07-17T10:00:00Z' },
    ]);
  });

  it('returns an empty array without querying profiles when there are no comments', async () => {
    const commentsOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const commentsEq = vi.fn(() => ({ order: commentsOrder }));
    const commentsSelect = vi.fn(() => ({ eq: commentsEq }));
    const profilesSelect = vi.fn();
    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_family_comments') return { select: commentsSelect };
      if (table === 'elder_profiles') return { select: profilesSelect };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await fetchComments('e1');

    expect(result).toEqual([]);
    expect(profilesSelect).not.toHaveBeenCalled();
  });

  it('throws when the comments query errors', async () => {
    const commentsOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const commentsEq = vi.fn(() => ({ order: commentsOrder }));
    const commentsSelect = vi.fn(() => ({ eq: commentsEq }));
    fromMock.mockReturnValue({ select: commentsSelect });

    await expect(fetchComments('e1')).rejects.toThrow('boom');
  });
});

describe('postComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a comment authored by the current user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'f1' } } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await postComment('e1', '好叻呀！');

    expect(insert).toHaveBeenCalledWith({ elder_user_id: 'e1', family_user_id: 'f1', comment_text: '好叻呀！' });
  });

  it('throws when not authenticated', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(postComment('e1', '好叻呀！')).rejects.toThrow('not authenticated');
  });

  it('throws when the insert fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'f1' } } });
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    fromMock.mockReturnValue({ insert });

    await expect(postComment('e1', '好叻呀！')).rejects.toThrow('boom');
  });
});

describe('likeComment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets liked to true for the given comment id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    await likeComment('c1');

    expect(update).toHaveBeenCalledWith({ liked: true });
    expect(eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('throws when the update fails', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const update = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ update });

    await expect(likeComment('c1')).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "AI for elderly/app"
npx vitest run src/lib/comments.test.ts
```
Expected: FAIL — `./comments` has no exports (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/comments.ts`:
```ts
import { supabase } from './supabaseClient';

// elder_family_comments has no direct foreign key to elder_profiles (both reference
// auth.users independently), so author display names can't be embedded in one PostgREST
// query — same reasoning as lib/family.ts's fetchFamilyLink, which does the same two-query
// pattern rather than relying on an embedded join.

export interface FamilyComment {
  id: string;
  familyUserId: string;
  familyDisplayName: string | null;
  commentText: string;
  liked: boolean;
  createdAt: string;
}

export async function fetchComments(elderUserId: string): Promise<FamilyComment[]> {
  const { data: comments, error } = await supabase
    .from('elder_family_comments')
    .select('id, family_user_id, comment_text, liked, created_at')
    .eq('elder_user_id', elderUserId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!comments || comments.length === 0) return [];

  const familyUserIds = [...new Set(comments.map((c: { family_user_id: string }) => c.family_user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('elder_profiles')
    .select('user_id, display_name')
    .in('user_id', familyUserIds);
  if (profilesError) throw new Error(profilesError.message);

  const nameByUserId = new Map(
    (profiles ?? []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name]),
  );

  return comments.map((c: { id: string; family_user_id: string; comment_text: string; liked: boolean; created_at: string }) => ({
    id: c.id,
    familyUserId: c.family_user_id,
    familyDisplayName: nameByUserId.get(c.family_user_id) ?? null,
    commentText: c.comment_text,
    liked: c.liked,
    createdAt: c.created_at,
  }));
}

export async function postComment(elderUserId: string, commentText: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { error } = await supabase
    .from('elder_family_comments')
    .insert({ elder_user_id: elderUserId, family_user_id: user.id, comment_text: commentText });
  if (error) throw new Error(error.message);
}

export async function likeComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('elder_family_comments').update({ liked: true }).eq('id', commentId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/comments.test.ts
```
Expected: PASS, all 7 tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: comments data layer (fetch/post/like, two-query author-name join)"
```

---

## Task 5: `CommentList` shared component

**Files:**
- Create: `app/src/components/CommentList.tsx`
- Test: `app/src/components/CommentList.test.tsx`

- [ ] **Step 1: Add the CSS this component needs**

In `app/src/styles/global.css`, after the existing `/* ---------- 家人 ---------- */` block's last rule (`.toggle::after{...}`), add:
```css
.comment-row{border-top:2px solid #f0f0f0; padding:14px 0; display:flex; align-items:flex-start; gap:12px;}
.comment-row:first-child{border-top:none;}
.comment-author{font-size:20px; font-weight:700; color:#2f6f4f; margin-bottom:4px;}
.comment-text{font-size:22px; color:#333; flex:1;}
.like-btn{font-size:30px; background:none; border:none; padding:0 4px; flex-shrink:0;}
.comment-input{
  width:100%; font-size:22px; padding:14px; margin-top:10px; min-height:80px;
  border:2.5px solid #ddd; border-radius:16px; color:#1c1c1e; background:#fff; resize:vertical;
}
```

- [ ] **Step 2: Write the failing test**

Create `app/src/components/CommentList.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';

const comments: FamilyComment[] = [
  { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
  { id: 'c2', familyUserId: 'f2', familyDisplayName: null, commentText: '加油！', liked: true, createdAt: '2026-07-17T10:00:00Z' },
];

describe('CommentList', () => {
  it('shows the error text when given one, instead of the list', () => {
    render(<CommentList comments={comments} error="攞唔到留言" emptyText="仲未有留言" />);
    expect(screen.getByText('攞唔到留言')).toBeInTheDocument();
    expect(screen.queryByText('好叻呀！')).not.toBeInTheDocument();
  });

  it('shows the empty-state text when there are no comments', () => {
    render(<CommentList comments={[]} error={null} emptyText="仲未有留言" />);
    expect(screen.getByText('仲未有留言')).toBeInTheDocument();
  });

  it('renders each comment with author (or a fallback) and text', () => {
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" />);
    expect(screen.getByText('陳小姐')).toBeInTheDocument();
    expect(screen.getByText('好叻呀！')).toBeInTheDocument();
    expect(screen.getByText('家人')).toBeInTheDocument();
    expect(screen.getByText('加油！')).toBeInTheDocument();
  });

  it('shows a read-only like indicator (not a button) when onLike is not given', () => {
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('🤍')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('shows a tappable like button for an unliked comment when onLike is given, and calls it with the comment id', async () => {
    const onLike = vi.fn();
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" onLike={onLike} likingId={null} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // only the unliked comment gets a tappable button
    await userEvent.click(buttons[0]);
    expect(onLike).toHaveBeenCalledWith('c1');
  });

  it('disables the like button for whichever comment is currently being liked', () => {
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" onLike={vi.fn()} likingId="c1" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd "AI for elderly/app"
npx vitest run src/components/CommentList.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `app/src/components/CommentList.tsx`:
```tsx
import type { FamilyComment } from '../lib/comments';

interface CommentListProps {
  comments: FamilyComment[];
  error: string | null;
  emptyText: string;
  onLike?: (commentId: string) => void;
  likingId?: string | null;
}

export function CommentList({ comments, error, emptyText, onLike, likingId }: CommentListProps) {
  if (error) return <p className="error-text">{error}</p>;
  if (comments.length === 0) return <p>{emptyText}</p>;

  return (
    <>
      {comments.map((c) => (
        <div className="comment-row" key={c.id}>
          <div style={{ flex: 1 }}>
            <p className="comment-author">{c.familyDisplayName ?? '家人'}</p>
            <p className="comment-text">{c.commentText}</p>
          </div>
          {onLike ? (
            <button
              className="like-btn"
              disabled={c.liked || likingId === c.id}
              onClick={() => onLike(c.id)}
            >
              {c.liked ? '❤️' : '🤍'}
            </button>
          ) : (
            <span className="like-btn">{c.liked ? '❤️' : '🤍'}</span>
          )}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/components/CommentList.test.tsx
```
Expected: PASS, all 6 tests.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: CommentList shared component (read-only or elder-likeable comment rendering)"
```

---

## Task 6: `FamilyScreen` — comment list (elder reads + likes)

**Files:**
- Modify: `app/src/components/FamilyScreen.tsx`
- Modify: `app/src/components/FamilyScreen.test.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Add the failing tests**

Replace `app/src/components/FamilyScreen.test.tsx` entirely with:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createPairingCodeMock = vi.fn();
vi.mock('../lib/family', () => ({
  createPairingCode: (...args: unknown[]) => createPairingCodeMock(...args),
}));

const fetchCommentsMock = vi.fn();
const likeCommentMock = vi.fn();
vi.mock('../lib/comments', () => ({
  fetchComments: (...args: unknown[]) => fetchCommentsMock(...args),
  likeComment: (...args: unknown[]) => likeCommentMock(...args),
}));

import { FamilyScreen } from './FamilyScreen';

describe('FamilyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCommentsMock.mockResolvedValue([]);
  });

  it('toggles share via the callback', async () => {
    const onToggleShare = vi.fn();
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} userId="u1" />);
    await userEvent.click(screen.getByRole('button', { name: '' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
  });

  it('generates and displays a pairing code on tap', async () => {
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('384920')).toBeInTheDocument();
  });

  it('does not show the pairing prompt when sharing is off', () => {
    render(<FamilyScreen shareEnabled={false} onToggleShare={vi.fn()} userId="u1" />);
    expect(screen.queryByText('產生配對碼')).not.toBeInTheDocument();
  });

  it('shows the thrown error message when code generation fails', async () => {
    createPairingCodeMock.mockRejectedValue(new Error('攞唔到配對碼，請再試'));
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('攞唔到配對碼，請再試')).toBeInTheDocument();
  });

  it('loads and shows family comments', async () => {
    fetchCommentsMock.mockResolvedValue([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
    ]);
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    expect(fetchCommentsMock).toHaveBeenCalledWith('u1');
    expect(await screen.findByText('好叻呀！')).toBeInTheDocument();
    expect(screen.getByText('陳小姐')).toBeInTheDocument();
  });

  it('likes a comment and updates it to the liked state', async () => {
    fetchCommentsMock.mockResolvedValue([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
    ]);
    likeCommentMock.mockResolvedValue(undefined);
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    const likeBtn = await screen.findByText('🤍');
    await userEvent.click(likeBtn);

    expect(likeCommentMock).toHaveBeenCalledWith('c1');
    expect(await screen.findByText('❤️')).toBeInTheDocument();
  });

  it('shows the empty-comments message when there are none', async () => {
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);
    expect(await screen.findByText('仲未有家人留言，快啲叫佢哋嚟支持你啦')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "AI for elderly/app"
npx vitest run src/components/FamilyScreen.test.tsx
```
Expected: FAIL — `FamilyScreen` doesn't accept a `userId` prop yet and has no comment list.

- [ ] **Step 3: Update `FamilyScreen.tsx`**

Replace `app/src/components/FamilyScreen.tsx` entirely with:
```tsx
import { useEffect, useState } from 'react';
import { createPairingCode } from '../lib/family';
import { fetchComments, likeComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';

interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
  userId: string;
}

export function FamilyScreen({ shareEnabled, onToggleShare, userId }: FamilyScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [comments, setComments] = useState<FamilyComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchComments(userId)
      .then((result) => {
        if (active) setComments(result);
      })
      .catch((err) => {
        if (active) setCommentsError(err instanceof Error ? err.message : '攞唔到留言，請再試');
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function handleGenerateCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const code = await createPairingCode();
      setPairingCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : '攞唔到配對碼，請再試');
    } finally {
      setBusy(false);
    }
  }

  async function handleLike(commentId: string) {
    if (likingId) return;
    setLikingId(commentId);
    try {
      await likeComment(commentId);
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, liked: true } : c)));
    } catch {
      // Best-effort: leave the comment unliked so the user can tap again.
    } finally {
      setLikingId(null);
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
            <>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生配對碼'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </>
          )}
        </div>
      )}
      <div className="fam-card">
        <h4>家人留言</h4>
        <CommentList
          comments={comments}
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

- [ ] **Step 4: Wire `userId` into `FamilyScreen` from `App.tsx`**

In `app/src/App.tsx`, find this line (inside `ElderShell`):
```tsx
      {screen === 'family' && <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} />}
```
Replace it with:
```tsx
      {screen === 'family' && (
        <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} userId={userId} />
      )}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "AI for elderly/app"
npx vitest run src/components/FamilyScreen.test.tsx
```
Expected: PASS, all 7 tests.

- [ ] **Step 6: Run the full suite, build, lint**

```bash
npm test
npm run build
npm run lint
```
Expected: all green.

- [ ] **Step 7: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: FamilyScreen shows family comments with elder-side per-comment likes"
```

---

## Task 7: `FamilyScreen` — pairing-code countdown + regenerate

**Files:**
- Modify: `app/src/components/FamilyScreen.tsx`
- Modify: `app/src/components/FamilyScreen.test.tsx`

- [ ] **Step 1: Add the failing tests**

In `app/src/components/FamilyScreen.test.tsx`, add three new tests at the end of the `describe('FamilyScreen', ...)` block (right before the final closing `});`). **Do not** add fake timers to the shared `beforeEach`/`afterEach` — that would affect all 10 tests in the file and risk hanging the other 7, since `userEvent`'s internal delays rely on real timers unless explicitly told otherwise. Instead, each of these 3 new tests sets up and tears down its own fake-timer scope, and uses a locally-configured `userEvent` instance with `delay: null` (which disables userEvent's own internal setTimeout-based delays, avoiding a deadlock against the fake clock) instead of the file's default `userEvent.click(...)` calls:

```tsx
  it('shows a countdown after generating a code', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await user.click(screen.getByText('產生配對碼'));
    expect(await screen.findByText('384920')).toBeInTheDocument();
    expect(screen.getByText('10:00 後過期')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(screen.getByText('9:00 後過期')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows an expired message and a regenerate button once the countdown reaches zero', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await user.click(screen.getByText('產生配對碼'));
    expect(await screen.findByText('384920')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(screen.getByText('配對碼已過期')).toBeInTheDocument();
    expect(screen.queryByText('384920')).not.toBeInTheDocument();
    expect(screen.getByText('產生新碼')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('replaces the current code with a fresh one when 產生新碼 is tapped', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    createPairingCodeMock.mockResolvedValueOnce('384920').mockResolvedValueOnce('111222');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await user.click(screen.getByText('產生配對碼'));
    expect(await screen.findByText('384920')).toBeInTheDocument();

    await user.click(screen.getByText('產生新碼'));
    expect(await screen.findByText('111222')).toBeInTheDocument();
    expect(screen.queryByText('384920')).not.toBeInTheDocument();
    expect(screen.getByText('10:00 後過期')).toBeInTheDocument();

    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "AI for elderly/app"
npx vitest run src/components/FamilyScreen.test.tsx
```
Expected: FAIL — no countdown, no "產生新碼" button, no expiry handling yet.

- [ ] **Step 3: Add the countdown/regenerate logic to `FamilyScreen.tsx`**

In `app/src/components/FamilyScreen.tsx`, add this constant near the top of the file (after the imports):
```ts
const PAIRING_CODE_TTL_SECONDS = 10 * 60;
```

Add two new pieces of state inside the `FamilyScreen` function, alongside the existing `pairingCode`/`error`/`busy` state:
```tsx
  const [codeGeneratedAt, setCodeGeneratedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
```

Add an effect that ticks `now` once a second while a code is showing (place it after the existing comments-loading `useEffect`):
```tsx
  useEffect(() => {
    if (!pairingCode) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pairingCode]);
```

Update `handleGenerateCode` to record the generation time:
```tsx
  async function handleGenerateCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const code = await createPairingCode();
      setPairingCode(code);
      setCodeGeneratedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : '攞唔到配對碼，請再試');
    } finally {
      setBusy(false);
    }
  }
```

Add the countdown computation right before the `return` statement:
```tsx
  const secondsElapsed = codeGeneratedAt ? Math.floor((now - codeGeneratedAt) / 1000) : 0;
  const secondsLeft = Math.max(0, PAIRING_CODE_TTL_SECONDS - secondsElapsed);
  const isExpired = pairingCode !== null && secondsLeft === 0;
  const countdownLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')} 後過期`;
```

Replace the pairing-code card's JSX (the `{shareEnabled && (...)}` block) with:
```tsx
      {shareEnabled && (
        <div className="fam-card">
          {pairingCode && !isExpired && (
            <>
              <p>配對碼（俾屋企人 10 分鐘內輸入）：</p>
              <p className="otp-display">{pairingCode}</p>
              <p>{countdownLabel}</p>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {pairingCode && isExpired && (
            <>
              <p>配對碼已過期</p>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生新碼'}
              </button>
            </>
          )}
          {!pairingCode && (
            <>
              <button className="bigbtn" disabled={busy} onClick={handleGenerateCode}>
                {busy ? '產生緊…' : '產生配對碼'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </>
          )}
        </div>
      )}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/FamilyScreen.test.tsx
```
Expected: PASS, all 10 tests (7 from Task 6 + 3 new).

- [ ] **Step 5: Run the full suite, build, lint**

```bash
npm test
npm run build
npm run lint
```
Expected: all green.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: pairing-code countdown + regenerate button"
```

---

## Task 8: `FamilyProgressView` — comment composer + shared list (family reads + posts)

**Files:**
- Modify: `app/src/components/FamilyProgressView.tsx`
- Modify: `app/src/components/FamilyProgressView.test.tsx`

- [ ] **Step 1: Add the failing tests**

Read the current `app/src/components/FamilyProgressView.test.tsx` first (it already has 5 tests from Plan 2 Task 10's review fixes: initial success, sharing-off message, retry-after-error, retry-recovery, null-name fallback). Add this mock near the top of the file, alongside the existing `vi.mock('../lib/progressApi', ...)`:
```tsx
const fetchCommentsMock = vi.fn();
const postCommentMock = vi.fn();
vi.mock('../lib/comments', () => ({
  fetchComments: (...args: unknown[]) => fetchCommentsMock(...args),
  postComment: (...args: unknown[]) => postCommentMock(...args),
}));
```

Add `fetchCommentsMock.mockResolvedValue([]);` to whichever `beforeEach` already exists in the file (or add a `beforeEach` if none exists — check the file first), so every existing test still passes without needing to know about comments.

Then add these new tests to the file's `describe('FamilyProgressView', ...)` block:
```tsx
  it('loads and shows the shared comment list when sharing is enabled', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: ['l1'],
      streakCount: 5,
      lastActiveDate: '2026-07-18',
      familyShareEnabled: true,
    });
    fetchCommentsMock.mockResolvedValue([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: true, createdAt: '2026-07-18T10:00:00Z' },
    ]);

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    expect(await screen.findByText('好叻呀！')).toBeInTheDocument();
    expect(fetchCommentsMock).toHaveBeenCalledWith('e1');
  });

  it('does not fetch comments when sharing is off', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: false,
    });

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    await screen.findByText('對方而家冇分享緊進度');
    expect(fetchCommentsMock).not.toHaveBeenCalled();
  });

  it('posts a new comment and refreshes the list', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: true,
    });
    fetchCommentsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '加油！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
      ]);
    postCommentMock.mockResolvedValue(undefined);

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);
    await screen.findByText('仲未有留言');

    await userEvent.type(screen.getByPlaceholderText('寫幾句鼓勵嘅說話…'), '加油！');
    await userEvent.click(screen.getByText('送出鼓勵'));

    expect(postCommentMock).toHaveBeenCalledWith('e1', '加油！');
    expect(await screen.findByText('加油！', { selector: '.comment-text' })).toBeInTheDocument();
  });

  it('shows an error and keeps the draft when posting fails', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: true,
    });
    fetchCommentsMock.mockResolvedValue([]);
    postCommentMock.mockRejectedValue(new Error('boom'));

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);
    await screen.findByText('仲未有留言');

    const input = screen.getByPlaceholderText('寫幾句鼓勵嘅說話…');
    await userEvent.type(input, '加油！');
    await userEvent.click(screen.getByText('送出鼓勵'));

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(input).toHaveValue('加油！');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "AI for elderly/app"
npx vitest run src/components/FamilyProgressView.test.tsx
```
Expected: FAIL — no comment composer or list exists yet.

- [ ] **Step 3: Update `FamilyProgressView.tsx`**

Replace `app/src/components/FamilyProgressView.tsx` entirely with:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { fetchProgress, type RemoteProgress } from '../lib/progressApi';
import { fetchComments, postComment, type FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';

interface FamilyProgressViewProps {
  elderUserId: string;
  elderDisplayName: string | null;
}

export function FamilyProgressView({ elderUserId, elderDisplayName }: FamilyProgressViewProps) {
  const [progress, setProgress] = useState<RemoteProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [comments, setComments] = useState<FamilyComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setBusy(true);
    fetchProgress(elderUserId)
      .then((result) => {
        if (active) {
          setProgress(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '攞唔到進度，請再試');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [elderUserId, reloadToken]);

  useEffect(() => {
    if (!progress?.familyShareEnabled) return;
    let active = true;
    fetchComments(elderUserId)
      .then((result) => {
        if (active) setComments(result);
      })
      .catch((err) => {
        if (active) setCommentsError(err instanceof Error ? err.message : '攞唔到留言，請再試');
      });
    return () => {
      active = false;
    };
  }, [elderUserId, progress?.familyShareEnabled, reloadToken]);

  const handleRetry = useCallback(() => setReloadToken((n) => n + 1), []);

  async function handlePostComment() {
    if (posting || !commentText.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      await postComment(elderUserId, commentText.trim());
      setCommentText('');
      const updated = await fetchComments(elderUserId);
      setComments(updated);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : '送出失敗，請再試');
    } finally {
      setPosting(false);
    }
  }

  if (error) {
    return (
      <div className="screen">
        <div className="topbar">
          <h2>{elderDisplayName ?? '長者'}嘅進度</h2>
        </div>
        <div className="fam-card">
          <p className="error-text">攞唔到進度：{error}</p>
          <button className="bigbtn" disabled={busy} onClick={handleRetry}>
            {busy ? '再試緊…' : '再試一次'}
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
        {postError && <p className="error-text">{postError}</p>}
        <button className="bigbtn" disabled={posting || !commentText.trim()} onClick={handlePostComment}>
          {posting ? '送緊出…' : '送出鼓勵'}
        </button>
      </div>
      <div className="fam-card">
        <h4>留言紀錄</h4>
        <CommentList comments={comments} error={commentsError} emptyText="仲未有留言" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/FamilyProgressView.test.tsx
```
Expected: PASS, all 9 tests (5 existing + 4 new).

- [ ] **Step 5: Run the full suite, build, lint**

```bash
cd "AI for elderly/app"
npm test
npm run build
npm run lint
```
Expected: all green.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: FamilyProgressView comment composer + shared comment list"
```

---

## Task 9: Final verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Live walkthrough**

```bash
cd "AI for elderly/app"
npm run dev
```
Using Playwright with two separate browser contexts (elder + family), same style as Plan 2 Task 13 / Plan 3 Task 11:

1. Sign up a fresh elder account (new test phone number) — confirm the new "你個名係？" step appears before phone entry, enter a name, complete login.
2. Sign up a fresh family account (different test phone number) — same name step, then pair with the elder using a pairing code generated from the elder's `FamilyScreen`.
3. On the elder's `FamilyScreen`: confirm the pairing code shows a live countdown; tap "產生新碼" and confirm the code changes.
4. On the family's `FamilyProgressView`: post a comment via the textarea + "送出鼓勵" button. Confirm it appears in the list with the family account's real display name (not null/blank — this is the live proof the display-name gap is actually fixed).
5. Back on the elder's `FamilyScreen`: confirm the new comment appears, tap its 🤍 to like it — confirm it becomes ❤️.
6. Reload the family session's `FamilyProgressView`: confirm the comment now shows ❤️ (the like round-tripped back).

Stop the dev server when done.

- [ ] **Step 2: Update `README.md`**

Under "下一步", replace the Plan 4 line with a `✅ Plan 4 已完成` note (same style as Plans 1-3), summarizing: display-name gap fixed (collected at signup for both roles), family comment/like feature (shared feed per elder, elder-only likes), pairing-code countdown + regenerate. Update the "最後更新" line at the bottom.

- [ ] **Step 3: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "docs: mark Plan 4 (family companion polish) complete"
```
