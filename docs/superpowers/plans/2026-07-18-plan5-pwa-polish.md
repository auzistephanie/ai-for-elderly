# Plan 5 — PWA Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app installable as a real PWA (manifest + service worker via `vite-plugin-pwa`), cache published lesson content for offline use, add minimal "started but not completed" analytics visible in the admin tool, and replace the leftover Vite-scaffold branding (favicon, page title, `lang` attribute) with the app's real identity. This is the last of the 5 planned MVP phases.

**Architecture:** `vite-plugin-pwa` (Workbox under the hood) generates the manifest and service worker with zero custom service-worker code — configured entirely in `vite.config.ts`. A Workbox runtime-caching rule intercepts the single Supabase REST call `useLessons.ts` already makes (fetching all published lessons in one request), giving offline lesson access for free without new app-side caching logic. A new `elder_lesson_starts` table (write-only from the app's perspective, RLS-gated to self-insert, no select policy) feeds a new analytics section in the existing `admin/app.py` Streamlit tool.

**Tech Stack:** `vite-plugin-pwa` (new devDependency). Python + Pillow (already installed on this Mac) for one-off icon generation — not a runtime/build dependency, just a script run once to produce committed PNG assets.

**Design doc:** `docs/superpowers/specs/2026-07-18-plan5-pwa-polish-design.md` — this plan implements that approved design; don't re-litigate decisions already made there.

**Repo push convention:** never `git add`/`git commit`/`git push` directly. Push via `python3 scripts/github_push.py "<message>"` from the repo root (`AI for elderly/`). Each task ends with one push.

---

## File Structure

```
AI for elderly/
├── scripts/
│   └── generate_icons.py            # NEW: one-off Pillow script producing the PNG icons below
├── app/
│   ├── public/
│   │   ├── icon-192.png             # NEW: PWA manifest icon
│   │   ├── icon-512.png             # NEW: PWA manifest icon (also used as maskable)
│   │   ├── favicon.svg              # MODIFY: replaced with branded green/cream mark
│   │   └── icons.svg                # DELETE: unused Vite-scaffold social-icon sprite sheet
│   ├── index.html                   # MODIFY: title, lang
│   ├── vite.config.ts                # MODIFY: add VitePWA plugin (manifest + runtime caching)
│   ├── package.json                  # MODIFY: + vite-plugin-pwa devDependency
│   └── src/
│       ├── lib/
│       │   ├── lessonStarts.ts       # NEW: logLessonStart
│       │   └── lessonStarts.test.ts  # NEW
│       ├── components/
│       │   ├── LessonScreen.tsx      # MODIFY: userId prop, logs a start on mount
│       │   └── LessonScreen.test.tsx # MODIFY
│       └── App.tsx                   # MODIFY: pass userId to LessonScreen
├── admin/
│   └── app.py                        # MODIFY: new "started vs completed" analytics section
└── supabase/
    └── schema.sql                    # MODIFY: new elder_lesson_starts table + RLS
```

---

## Task 1: App icons

**Files:**
- Create: `scripts/generate_icons.py`
- Create: `app/public/icon-192.png`
- Create: `app/public/icon-512.png`
- Modify: `app/public/favicon.svg`
- Delete: `app/public/icons.svg`

- [ ] **Step 1: Confirm the unused scaffold file is genuinely dead before deleting it**

```bash
cd "AI for elderly"
grep -rn "icons.svg" app/src app/index.html
```
Expected: no output (already confirmed during planning — `icons.svg` is an unreferenced Vite-scaffold sprite sheet of social-media icons, unrelated to this app). If this grep DOES find a reference, stop and investigate before deleting.

- [ ] **Step 2: Write the icon-generation script**

Create `scripts/generate_icons.py`:
```python
"""One-off generator for the AI老友記 PWA manifest icons (192x192, 512x512 PNG),
replacing the unmodified Vite-scaffold defaults. Not part of any build step --
run manually whenever the icon design needs to change; the PNG output is what
gets committed to app/public/.

Uses the app's existing palette: #2f6f4f (primary green) background,
#faf8f4 (cream) foreground -- same colors used everywhere else in the app
(see app/src/styles/global.css).
"""

from PIL import Image, ImageDraw, ImageFont

GREEN = "#2f6f4f"
CREAM = "#faf8f4"
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def make_icon(size):
    img = Image.new("RGB", (size, size), GREEN)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, int(size * 0.42))
    text = "AI"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), text, fill=CREAM, font=font)
    return img


if __name__ == "__main__":
    make_icon(192).save("app/public/icon-192.png")
    make_icon(512).save("app/public/icon-512.png")
    print("Wrote app/public/icon-192.png and app/public/icon-512.png")
```

- [ ] **Step 3: Run it from the repo root**

```bash
cd "AI for elderly"
python3 scripts/generate_icons.py
```
Expected: `Wrote app/public/icon-192.png and app/public/icon-512.png`, and both files exist. Verify their actual pixel dimensions match:
```bash
python3 -c "from PIL import Image; print(Image.open('app/public/icon-192.png').size); print(Image.open('app/public/icon-512.png').size)"
```
Expected: `(192, 192)` and `(512, 512)`.

- [ ] **Step 4: Replace `favicon.svg`**

Replace `app/public/favicon.svg` entirely with:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="#2f6f4f"/>
  <text x="24" y="31" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="20" fill="#faf8f4" text-anchor="middle">AI</text>
</svg>
```

- [ ] **Step 5: Delete the unused scaffold sprite sheet**

```bash
cd "AI for elderly"
rm app/public/icons.svg
```

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: replace Vite-scaffold icons with branded AI老友記 icon set"
```

---

## Task 2: `vite-plugin-pwa` — manifest + offline lesson caching

**Files:**
- Modify: `app/package.json`
- Modify: `app/vite.config.ts`

- [ ] **Step 1: Install the plugin**

```bash
cd "AI for elderly/app"
npm install -D vite-plugin-pwa@^1.3.0
```

- [ ] **Step 2: Update `vite.config.ts`**

Replace `app/vite.config.ts` entirely with:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AI老友記',
        short_name: 'AI老友記',
        description: '老友記嘅 AI 生活學堂',
        theme_color: '#2f6f4f',
        background_color: '#faf8f4',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // useLessons.ts fetches ALL published lessons in one request -- caching this
            // single endpoint is enough to make every published lesson's content available
            // offline, without any per-lesson caching logic. stale-while-revalidate: serve
            // the cached copy immediately (works offline), refresh it in the background
            // whenever there IS a connection.
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/elder_lessons'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'elder-lessons-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
  },
})
```

- [ ] **Step 3: Build and verify the manifest/service-worker output**

```bash
cd "AI for elderly/app"
npm run build
cat dist/manifest.webmanifest
ls dist/sw.js dist/registerSW.js
```
Expected: `manifest.webmanifest` contains `"name":"AI老友記"`, `"theme_color":"#2f6f4f"`, `"background_color":"#faf8f4"`, `"display":"standalone"`, and an `icons` array with both PNG entries; `dist/sw.js` and `dist/registerSW.js` both exist.

- [ ] **Step 4: Run the full test suite and lint (build already verified above)**

```bash
npm test
npm run lint
```
Expected: all green — this task doesn't touch any app logic, so no test should be affected.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: vite-plugin-pwa manifest + service worker + offline lesson caching"
```

---

## Task 3: `index.html` polish

**Files:**
- Modify: `app/index.html`

- [ ] **Step 1: Update the file**

Replace `app/index.html` entirely with:
```html
<!doctype html>
<html lang="zh-HK">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI老友記</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Verify the build still works and the title is correct**

```bash
cd "AI for elderly/app"
npm run build
grep -o '<title>[^<]*</title>' dist/index.html
grep -o 'lang="[^"]*"' dist/index.html
```
Expected: `<title>AI老友記</title>` and `lang="zh-HK"`.

- [ ] **Step 3: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "fix: correct index.html title and lang (were leftover Vite scaffold defaults)"
```

---

## Task 4: `elder_lesson_starts` schema

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Write the schema SQL**

Append to `supabase/schema.sql` (after `elder_family_comments`, before the RPC function definitions):
```sql
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
```

- [ ] **Step 2: Apply the migration**

Call `mcp__claude_ai_Supabase__apply_migration`:
```
project_id: cmtubaxlniglklmdwlzs
name: elder_lesson_starts
query: <the full SQL from Step 1>
```

- [ ] **Step 3: Verify**

Call `mcp__claude_ai_Supabase__list_tables` with `project_id: cmtubaxlniglklmdwlzs`, `schemas: ["public"]` — expect `elder_lesson_starts` present with `rls_enabled: true`.

Call `mcp__claude_ai_Supabase__execute_sql`:
```sql
select policyname, cmd from pg_policies where tablename = 'elder_lesson_starts';
```
Expected: exactly one row, `elder_lesson_starts_self_insert`, `cmd = 'INSERT'`.

- [ ] **Step 4: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: elder_lesson_starts schema (write-only lesson-start analytics)"
```

---

## Task 5: `lib/lessonStarts.ts`

**Files:**
- Create: `app/src/lib/lessonStarts.ts`
- Test: `app/src/lib/lessonStarts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/lessonStarts.test.ts`:
```ts
import { vi } from 'vitest';

const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { logLessonStart } from './lessonStarts';

describe('logLessonStart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a start record for the given user and lesson', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await logLessonStart('u1', 'l1');

    expect(fromMock).toHaveBeenCalledWith('elder_lesson_starts');
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', lesson_id: 'l1' });
  });

  it('throws when the insert fails', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    fromMock.mockReturnValue({ insert });

    await expect(logLessonStart('u1', 'l1')).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "AI for elderly/app"
npx vitest run src/lib/lessonStarts.test.ts
```
Expected: FAIL — `./lessonStarts` has no exports (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/lessonStarts.ts`:
```ts
import { supabase } from './supabaseClient';

export async function logLessonStart(userId: string, lessonId: string): Promise<void> {
  const { error } = await supabase.from('elder_lesson_starts').insert({ user_id: userId, lesson_id: lessonId });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/lib/lessonStarts.test.ts
```
Expected: PASS, both tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: logLessonStart data-layer function"
```

---

## Task 6: Wire `logLessonStart` into `LessonScreen`

**Files:**
- Modify: `app/src/components/LessonScreen.tsx`
- Modify: `app/src/components/LessonScreen.test.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/App.test.tsx`

- [ ] **Step 1: Update the failing tests**

Replace `app/src/components/LessonScreen.test.tsx` entirely with:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const logLessonStartMock = vi.fn();
vi.mock('../lib/lessonStarts', () => ({
  logLessonStart: (...args: unknown[]) => logLessonStartMock(...args),
}));

import { LessonScreen } from './LessonScreen';
import { seedLesson } from '../data/seedLesson';

describe('LessonScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logLessonStartMock.mockResolvedValue(undefined);
  });

  it('walks through all three steps and only completes after the correct quiz answer', async () => {
    const onComplete = vi.fn();
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={onComplete} />);

    // Step 1: why
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    await userEvent.click(screen.getByText('下一步 ▶'));

    // Step 2: demo
    expect(screen.getByText('睇下 AI 點答')).toBeInTheDocument();
    expect(screen.getByText(/呢隻係血壓藥/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('下一步 ▶'));

    // Step 3: quiz — wrong answer first
    expect(screen.getByText('AI 話你知藥物資料之後，你應該——')).toBeInTheDocument();
    await userEvent.click(screen.getByText('即刻自己停藥'));
    expect(screen.getByText(/再諗下/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText('完成課堂 🎉')).not.toBeInTheDocument();

    // Now the correct answer
    await userEvent.click(screen.getByText('當參考，有疑問問返醫生'));
    expect(screen.getByText(/啱晒/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('完成課堂 🎉'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not reveal the correct/wrong icon before an option is clicked', async () => {
    const onComplete = vi.fn();
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={onComplete} />);

    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));

    // Quiz step is visible, but no option has been clicked yet.
    expect(screen.getByText('AI 話你知藥物資料之後，你應該——')).toBeInTheDocument();
    expect(screen.queryByText('✅')).not.toBeInTheDocument();
    expect(screen.queryByText('❌')).not.toBeInTheDocument();
  });

  it('logs a lesson start on mount', () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);
    expect(logLessonStartMock).toHaveBeenCalledWith('u1', seedLesson.id);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "AI for elderly/app"
npx vitest run src/components/LessonScreen.test.tsx
```
Expected: FAIL — `LessonScreen` doesn't accept a `userId` prop yet and never calls `logLessonStart`.

- [ ] **Step 3: Update `LessonScreen.tsx`**

Add this import to `app/src/components/LessonScreen.tsx` (alongside the existing ones), and change the `useState` import to also bring in `useEffect`:
```tsx
import { useEffect, useState } from 'react';
import type { Lesson } from '../types/lesson';
import { SpeakButton } from './SpeakButton';
import { logLessonStart } from '../lib/lessonStarts';
```

Update the props interface and function signature:
```tsx
interface LessonScreenProps {
  lesson: Lesson;
  userId: string;
  onComplete: () => void;
}

export function LessonScreen({ lesson, userId, onComplete }: LessonScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    // Best-effort analytics: a failed write here must never block the lesson itself, and
    // there's nothing actionable for the user to do about it, so it's silently swallowed
    // rather than shown as an error (unlike user-initiated actions elsewhere in this app).
    logLessonStart(userId, lesson.id).catch(() => {});
  }, [lesson.id, userId]);

  const step = lesson.steps[stepIndex];
```
(the rest of the component body — `quizStep`, `answeredCorrect`, and the full JSX return — stays exactly as it already is, unchanged).

- [ ] **Step 4: Wire `userId` into `LessonScreen` from `App.tsx`**

In `app/src/App.tsx`, find:
```tsx
      {screen === 'lesson' && activeLesson && (
        <LessonScreen
          lesson={activeLesson}
          onComplete={() => {
            completeLesson(activeLesson.id);
            navigate('progress');
          }}
        />
      )}
```
Replace with:
```tsx
      {screen === 'lesson' && activeLesson && (
        <LessonScreen
          lesson={activeLesson}
          userId={userId}
          onComplete={() => {
            completeLesson(activeLesson.id);
            navigate('progress');
          }}
        />
      )}
```

- [ ] **Step 5: Mock `lib/lessonStarts` in `App.test.tsx`**

`App.test.tsx` renders the real `LessonScreen` component (not mocked) in several of its course-engine tests — without mocking `lib/lessonStarts`, those tests would make a real network call to Supabase on every run. Add this mock near the top of `app/src/App.test.tsx`, alongside the existing `vi.mock('./lib/family', ...)`/`vi.mock('./lib/progressApi', ...)` mocks:
```tsx
vi.mock('./lib/lessonStarts', () => ({
  logLessonStart: vi.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd "AI for elderly/app"
npx vitest run src/components/LessonScreen.test.tsx
```
Expected: PASS, all 3 tests.

```bash
npx vitest run src/App.test.tsx
```
Expected: PASS, all 13 tests (unaffected by this change other than the new mock).

- [ ] **Step 7: Run the full suite, build, lint**

```bash
npm test
npm run build
npm run lint
```
Expected: all green.

- [ ] **Step 8: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: log a lesson-start event when LessonScreen mounts"
```

---

## Task 7: Admin analytics view

**Files:**
- Modify: `admin/app.py`

- [ ] **Step 1: Add the analytics-fetching function**

In `admin/app.py`, add this function near the existing `fetch_pending_lessons`/`update_lesson`/`delete_lesson` functions (same file, same style — plain `requests` calls against the PostgREST API, matching the rest of this script):
```python
def fetch_lesson_analytics():
    lessons_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"select": "id,subtitle,layer,number", "order": "layer.asc,number.asc"},
        timeout=15,
    )
    lessons_resp.raise_for_status()
    lessons = lessons_resp.json()

    starts_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lesson_starts",
        headers=HEADERS,
        params={"select": "user_id,lesson_id"},
        timeout=15,
    )
    starts_resp.raise_for_status()
    starts = starts_resp.json()

    completions_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lesson_completions",
        headers=HEADERS,
        params={"select": "user_id,lesson_id"},
        timeout=15,
    )
    completions_resp.raise_for_status()
    completions = completions_resp.json()

    started_by_lesson = {}
    for row in starts:
        started_by_lesson.setdefault(row["lesson_id"], set()).add(row["user_id"])

    completed_by_lesson = {}
    for row in completions:
        completed_by_lesson.setdefault(row["lesson_id"], set()).add(row["user_id"])

    result = []
    for lesson in lessons:
        lid = lesson["id"]
        started = len(started_by_lesson.get(lid, set()))
        completed = len(completed_by_lesson.get(lid, set()))
        result.append(
            {
                "課堂": lesson["subtitle"],
                "層": lesson["layer"],
                "開咗（不重複人數）": started,
                "完成咗": completed,
                "未完成": max(0, started - completed),
            }
        )
    return result
```

- [ ] **Step 2: Render it in the Streamlit UI**

Find this line in `admin/app.py`:
```python
st.title("AI老友記 · 待審批課堂")
```
Add this immediately after it (before the `pending = fetch_pending_lessons()` line):
```python
st.header("📊 課堂開始/完成統計")
st.dataframe(fetch_lesson_analytics(), use_container_width=True)

st.title("AI老友記 · 待審批課堂")
```
(i.e. the analytics section renders first, above the existing pending-approval list — adjust so the analytics `st.header` comes before the existing `st.title`, or after; either order is fine, just make sure both sections end up in the file and neither replaces the other).

- [ ] **Step 3: Manual verification — run it locally**

```bash
cd "AI for elderly/admin"
streamlit run app.py --server.headless true &
```
Confirm (via a headless-browser check, e.g. Playwright, or by curling the running Streamlit server and checking for expected text) that the "📊 課堂開始/完成統計" section renders with a table showing all published lessons, each with a 開咗/完成咗/未完成 count (counts will be low/zero for lessons nobody has started yet — that's expected, not a bug). Kill the process when done.

- [ ] **Step 4: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: admin analytics view (started vs completed lesson counts)"
```

---

## Task 8: Final verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Build-artifact verification**

```bash
cd "AI for elderly/app"
npm run build
cat dist/manifest.webmanifest
```
Confirm the JSON has `name`, `short_name`, `theme_color: "#2f6f4f"`, `background_color: "#faf8f4"`, `display: "standalone"`, and both icon entries with correct `sizes`/`type`.

- [ ] **Step 2: Lighthouse PWA audit**

Serve the production build and run a real Lighthouse audit against it:
```bash
cd "AI for elderly/app"
npx vite preview --port 4173 &
sleep 2
npx lighthouse http://localhost:4173 --only-categories=pwa --output=json --output-path=/tmp/lighthouse-pwa.json --chrome-flags="--headless"
```
Read `/tmp/lighthouse-pwa.json` and report the PWA category score and which specific installability audits passed/failed. If any fail, investigate and fix if the fix is small/clearly scoped to this plan's work (e.g. a manifest field issue); if it requires something outside this plan's scope (e.g. an actual HTTPS deploy), note it clearly rather than guessing at a fix. Kill the preview server when done.

- [ ] **Step 3: Manual offline check**

With the preview server still running (or restarted): load `http://localhost:4173` once in a real or headless browser, wait for the service worker to activate, then simulate offline (e.g. via Chrome DevTools Protocol's network-offline emulation, or Playwright's `context.setOffline(true)`) and confirm the app shell still loads and previously-viewed lesson content is still reachable (not a blank/error screen). Stop the server when done.

- [ ] **Step 4: Run the full test suite one more time**

```bash
cd "AI for elderly/app"
npm test
npm run lint
```
Expected: all green.

- [ ] **Step 5: Update `README.md`**

Under "下一步", replace the Plan 5 line with a `✅ Plan 5 已完成` note (same style as Plans 1-4), summarizing: PWA manifest + service worker (via `vite-plugin-pwa`) with branded icons, offline caching of published lesson content, minimal "started vs completed" analytics in the admin tool, and the `index.html` title/lang fix. Note the actual Lighthouse PWA audit result from Step 2. Since this is the last of the 5 planned MVP phases, also add a brief note that the full MVP roadmap (Plans 1-5) is now complete, and point to the still-open items already tracked in the "未決事項" section (deploy domain, pricing/funding timing) as the remaining real-world next steps rather than more planned engineering phases. Update the "最後更新" line at the bottom.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "docs: mark Plan 5 (PWA polish) complete — MVP roadmap finished"
```
