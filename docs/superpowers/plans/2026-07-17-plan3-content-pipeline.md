# Plan 3 — Content Pipeline + Course-Engine UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-hardcoded-lesson MVP with a real 12-lesson, 3-tier course (plus a standalone anti-fraud class) — building the course-browsing/layer-unlock UI that was missing, migrating existing content, generating the remaining 11 lessons via a DeepSeek-powered GitHub Action into a review queue, and giving Stephanie a simple Streamlit tool to approve/edit/reject them.

**Architecture:** No new tables — reuses `elder_lessons`'s existing `status` ('pending'/'published') column from Plan 2. One schema change (extend the `layer` CHECK constraint to allow `0` for the standalone anti-fraud lesson). Course-engine unlock logic lives in a new pure-function module (`app/src/lib/courseEngine.ts`) consumed by a new lesson-list screen and the existing `App.tsx`/`HomeScreen.tsx`. Content generation is a manually-triggered (`workflow_dispatch`, not cron) GitHub Action calling the DeepSeek API and writing drafts via the Supabase `service_role` key. The admin approve tool is a standalone local Streamlit script, matching Stephanie's existing pattern for single-user internal tools.

**Tech Stack:** Same Vite + React 19 + TypeScript + Vitest stack for the app portion. Python 3 (stdlib `unittest` + `requests`, no new frontend-side dependency) for the generation script and its tests — **must stay Python 3.9-compatible syntax** (no `X | Y` union type hints, no `match` statements) since this Mac's local Python is 3.9.6; use `typing.Optional`/`typing.Dict`/`typing.List` instead. Streamlit for the admin tool (already installed locally, version 1.50.0).

**Design doc:** `docs/superpowers/specs/2026-07-17-plan3-content-pipeline-design.md` — this plan implements that approved design; don't re-litigate decisions already made there.

**Repo push convention:** never `git add`/`git commit`/`git push` directly. Push via `python3 scripts/github_push.py "<message>"` from the repo root (`AI for elderly/`). Each task ends with one push.

**⚠️ Manual credential needed:** Task 9 and Task 10 both need the Supabase project's `service_role` key (project `cmtubaxlniglklmdwlzs`) — this is a highly privileged key (bypasses all RLS) that no MCP tool exposes programmatically. Stephanie must retrieve it herself from the Supabase Dashboard → Settings → API → `service_role` `secret` key, and provide it when Task 9 is reached. Do not proceed with Task 9 without it — do not attempt to guess, derive, or use any other key in its place.

---

## File Structure

```
AI for elderly/
├── .github/
│   └── workflows/
│       └── generate-lessons.yml         # NEW: workflow_dispatch-only trigger for the generation script
├── scripts/
│   ├── generate_lessons.py              # NEW: scenario list, DeepSeek call, response parser/validator, Supabase insert
│   └── test_generate_lessons.py         # NEW: pytest/unittest tests for the pure parsing logic (no network/DB)
├── admin/
│   ├── app.py                           # NEW: Streamlit approve/edit/reject UI for pending lessons
│   ├── requirements.txt                 # NEW: streamlit, requests, python-dotenv
│   ├── .env.example                     # NEW: blank SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
│   └── .env                             # NEW, gitignored: real values (already covered by root .gitignore's bare `.env` pattern)
├── supabase/
│   ├── schema.sql                       # MODIFY: widen elder_lessons' layer CHECK to allow 0 (standalone anti-fraud)
│   └── seed.sql                         # MODIFY: lesson-001's insert now targets (layer:2, number:4), matching the live migration
└── app/src/
    ├── types/lesson.ts                  # MODIFY: Lesson.layer becomes 0 | 1 | 2 | 3
    ├── lib/
    │   ├── courseEngine.ts              # NEW: isLayerCompleted/isLayerUnlocked/getLessonState/getNextLesson/LAYER_NAMES
    │   └── courseEngine.test.ts         # NEW
    ├── components/
    │   ├── LessonListScreen.tsx         # NEW: 上堂 tab's lesson browser (per-layer sections + standalone anti-fraud section)
    │   ├── LessonListScreen.test.tsx    # NEW
    │   ├── HomeScreen.tsx               # MODIFY: nextLesson (nullable) + antiFraudLesson props instead of required todayLesson
    │   └── HomeScreen.test.tsx          # MODIFY
    ├── App.tsx                          # MODIFY: ElderShell gets activeLessonId + LessonListScreen wiring + real layer totals
    └── App.test.tsx                     # MODIFY
```

---

## Task 1: Widen `elder_lessons`' layer constraint to allow the standalone anti-fraud lesson

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Update the schema file**

In `supabase/schema.sql`, find this line (inside the `elder_lessons` table definition):

```sql
  layer smallint not null check (layer in (1, 2, 3)),
```

Replace it with:

```sql
  -- layer 0 is reserved for the standalone 防騙必修班 (anti-fraud) class, which per
  -- product spec §5.1 is always unlocked regardless of layer-1/2/3 progress.
  layer smallint not null check (layer in (0, 1, 2, 3)),
```

- [ ] **Step 2: Apply the migration live**

The constraint already exists in the live database under the name `elder_lessons_layer_check` (confirmed via `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.elder_lessons'::regclass and contype = 'c';` → `CHECK ((layer = ANY (ARRAY[1, 2, 3])))`). Call `mcp__claude_ai_Supabase__apply_migration`:
```
project_id: cmtubaxlniglklmdwlzs
name: elder_lessons_allow_standalone_layer
query: |
  alter table public.elder_lessons drop constraint elder_lessons_layer_check;
  alter table public.elder_lessons add constraint elder_lessons_layer_check check (layer in (0, 1, 2, 3));
```

- [ ] **Step 3: Verify**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: cmtubaxlniglklmdwlzs`:
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.elder_lessons'::regclass and contype = 'c';
```
Expected: `elder_lessons_layer_check` now shows `CHECK ((layer = ANY (ARRAY[0, 1, 2, 3])))`.

- [ ] **Step 4: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: allow layer=0 in elder_lessons for the standalone anti-fraud class"
```

---

## Task 2: Migrate `lesson-001` to `(layer:2, number:4)`

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Move the live row**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: cmtubaxlniglklmdwlzs`:
```sql
update public.elder_lessons set layer = 2, number = 4 where id = 'lesson-001';
```

This is safe to run directly (no temp slot needed) because layer 2 is currently completely empty — nothing else occupies `(2, 4)`.

- [ ] **Step 2: Verify**

```sql
select id, layer, number, subtitle from public.elder_lessons where id = 'lesson-001';
```
Expected: `layer = 2`, `number = 4`, `subtitle` unchanged (`影張相，問 AI 呢隻藥點樣食`).

- [ ] **Step 3: Update `supabase/seed.sql` to match**

Open `supabase/seed.sql`. Find the `insert into public.elder_lessons (...) values (...)` statement for `lesson-001`. Change its `layer` value from `1` to `2` and its `number` value from `1` to `4`, so that if this project is ever restored from `schema.sql` + `seed.sql` alone, the row lands in the correct final position (not the old Plan-1 position). Do not change any other field — title/subtitle/steps/status stay exactly as they are.

- [ ] **Step 4: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: migrate lesson-001 to layer 2 (生活應用) to make room for the new layer-1 opener"
```

---

## Task 3: `courseEngine.ts` — pure unlock/state logic

**Files:**
- Create: `app/src/lib/courseEngine.ts`
- Test: `app/src/lib/courseEngine.test.ts`

- [ ] **Step 1: Update the `Lesson` type to allow layer 0**

In `app/src/types/lesson.ts`, change:
```ts
export interface Lesson {
  id: string;
  layer: 1 | 2 | 3;
  number: number;
  title: string;
  subtitle: string;
  steps: [WhyStep, DemoStep, QuizStep];
}
```
to:
```ts
export interface Lesson {
  id: string;
  layer: 0 | 1 | 2 | 3;
  number: number;
  title: string;
  subtitle: string;
  steps: [WhyStep, DemoStep, QuizStep];
}
```

- [ ] **Step 2: Write the failing test**

Create `app/src/lib/courseEngine.test.ts`:
```ts
import type { Lesson } from '../types/lesson';
import { isLayerCompleted, isLayerUnlocked, getLessonState, getNextLesson, LAYER_NAMES } from './courseEngine';

function makeLesson(id: string, layer: 0 | 1 | 2 | 3, number: number): Lesson {
  return {
    id,
    layer,
    number,
    title: `title-${id}`,
    subtitle: `subtitle-${id}`,
    steps: [
      { kind: 'why', title: 'W', body: ['x'], speak: 's' },
      { kind: 'demo', title: 'D', bubbles: [], body: ['x'], speak: 's' },
      {
        kind: 'quiz',
        title: 'Q',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: false },
        ],
        feedbackCorrect: 'yes',
        feedbackWrong: 'no',
      },
    ],
  };
}

describe('isLayerCompleted', () => {
  it('is false when the layer has no lessons at all', () => {
    expect(isLayerCompleted([], 1, [])).toBe(false);
  });

  it('is false when some lessons in the layer are not completed', () => {
    const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 1, 2)];
    expect(isLayerCompleted(lessons, 1, ['l1'])).toBe(false);
  });

  it('is true when every lesson in the layer is completed', () => {
    const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 1, 2)];
    expect(isLayerCompleted(lessons, 1, ['l1', 'l2'])).toBe(true);
  });
});

describe('isLayerUnlocked', () => {
  const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 2, 1)];

  it('layer 0 (standalone) is always unlocked', () => {
    expect(isLayerUnlocked(0, lessons, [])).toBe(true);
  });

  it('layer 1 is always unlocked', () => {
    expect(isLayerUnlocked(1, lessons, [])).toBe(true);
  });

  it('layer 2 is locked until layer 1 is fully completed', () => {
    expect(isLayerUnlocked(2, lessons, [])).toBe(false);
    expect(isLayerUnlocked(2, lessons, ['l1'])).toBe(true);
  });

  it('layer 3 is locked until layer 2 is fully completed', () => {
    const withL3 = [...lessons, makeLesson('l3', 3, 1)];
    expect(isLayerUnlocked(3, withL3, ['l1'])).toBe(false);
    expect(isLayerUnlocked(3, withL3, ['l1', 'l2'])).toBe(true);
  });
});

describe('getLessonState', () => {
  const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 2, 1)];

  it('returns completed when the lesson id is in completedLessonIds', () => {
    expect(getLessonState(lessons[1], lessons, ['l2'])).toBe('completed');
  });

  it("returns locked when the lesson's layer is not unlocked yet", () => {
    expect(getLessonState(lessons[1], lessons, [])).toBe('locked');
  });

  it('returns available when the layer is unlocked and the lesson is not yet completed', () => {
    expect(getLessonState(lessons[0], lessons, [])).toBe('available');
    expect(getLessonState(lessons[1], lessons, ['l1'])).toBe('available');
  });
});

describe('getNextLesson', () => {
  it('returns the first available layer-1-or-above lesson in order', () => {
    const lessons = [makeLesson('l1', 1, 1), makeLesson('l2', 1, 2)];
    expect(getNextLesson(lessons, [])?.id).toBe('l1');
    expect(getNextLesson(lessons, ['l1'])?.id).toBe('l2');
  });

  it('excludes the standalone layer-0 lesson from the rotation', () => {
    const lessons = [makeLesson('standalone', 0, 1), makeLesson('l1', 1, 1)];
    expect(getNextLesson(lessons, [])?.id).toBe('l1');
  });

  it('returns null once every unlocked lesson is completed', () => {
    const lessons = [makeLesson('l1', 1, 1)];
    expect(getNextLesson(lessons, ['l1'])).toBeNull();
  });
});

describe('LAYER_NAMES', () => {
  it('has display names for layers 1-3', () => {
    expect(LAYER_NAMES[1]).toBe('AI 入門（淺）');
    expect(LAYER_NAMES[2]).toBe('生活應用（中）');
    expect(LAYER_NAMES[3]).toBe('進階玩法（深）');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd "AI for elderly/app"
npx vitest run src/lib/courseEngine.test.ts
```
Expected: FAIL — `./courseEngine` has no exports (file doesn't exist yet).

- [ ] **Step 4: Write the implementation**

Create `app/src/lib/courseEngine.ts`:
```ts
import type { Lesson } from '../types/lesson';

export const LAYER_NAMES: Record<1 | 2 | 3, string> = {
  1: 'AI 入門（淺）',
  2: '生活應用（中）',
  3: '進階玩法（深）',
};

export function isLayerCompleted(lessons: Lesson[], layer: number, completedLessonIds: string[]): boolean {
  const layerLessons = lessons.filter((l) => l.layer === layer);
  return layerLessons.length > 0 && layerLessons.every((l) => completedLessonIds.includes(l.id));
}

export function isLayerUnlocked(layer: number, lessons: Lesson[], completedLessonIds: string[]): boolean {
  if (layer <= 1) return true;
  return isLayerCompleted(lessons, layer - 1, completedLessonIds);
}

export function getLessonState(
  lesson: Lesson,
  lessons: Lesson[],
  completedLessonIds: string[],
): 'locked' | 'available' | 'completed' {
  if (completedLessonIds.includes(lesson.id)) return 'completed';
  if (!isLayerUnlocked(lesson.layer, lessons, completedLessonIds)) return 'locked';
  return 'available';
}

export function getNextLesson(lessons: Lesson[], completedLessonIds: string[]): Lesson | null {
  // The standalone (layer 0) anti-fraud lesson is reachable any time via its own
  // always-unlocked section/button — it's not part of the "next lesson" rotation
  // through the main 3-tier curriculum.
  const curriculum = lessons.filter((l) => l.layer >= 1);
  return curriculum.find((l) => getLessonState(l, lessons, completedLessonIds) === 'available') ?? null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/lib/courseEngine.test.ts
```
Expected: PASS, all 13 tests.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: courseEngine pure functions (layer unlock, lesson state, next-lesson selection)"
```

---

## Task 4: `LessonListScreen` — the 上堂 tab's course browser

**Files:**
- Create: `app/src/components/LessonListScreen.tsx`
- Test: `app/src/components/LessonListScreen.test.tsx`

- [ ] **Step 1: Add the CSS this screen needs**

In `app/src/styles/global.css`, after the existing `/* ---------- 進度 ---------- */` block (after the `.badge.locked .b-ico{...}` line), add:
```css
/* ---------- 上堂（課程清單） ---------- */
.lesson-row{
  display:flex; align-items:center; gap:14px; width:100%;
  min-height:60px; font-size:22px; text-align:left;
  background:#fff; border:2px solid #eee; border-radius:16px;
  padding:14px 18px; margin-top:12px;
}
.lesson-row.locked{opacity:.45; filter:grayscale(1);}
.lesson-row .l-ico{font-size:26px;}
```

- [ ] **Step 2: Write the failing test**

Create `app/src/components/LessonListScreen.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Lesson } from '../types/lesson';
import { LessonListScreen } from './LessonListScreen';

function makeLesson(id: string, layer: 0 | 1 | 2 | 3, number: number, subtitle: string): Lesson {
  return {
    id,
    layer,
    number,
    title: `title-${id}`,
    subtitle,
    steps: [
      { kind: 'why', title: 'W', body: ['x'], speak: 's' },
      { kind: 'demo', title: 'D', bubbles: [], body: ['x'], speak: 's' },
      {
        kind: 'quiz',
        title: 'Q',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: false },
        ],
        feedbackCorrect: 'yes',
        feedbackWrong: 'no',
      },
    ],
  };
}

describe('LessonListScreen', () => {
  const lessons = [makeLesson('l1', 1, 1, '第一課'), makeLesson('l2', 2, 1, '第二層課'), makeLesson('af', 0, 1, '防騙課')];

  it('shows an available layer-1 lesson as tappable', async () => {
    const onSelectLesson = vi.fn();
    render(<LessonListScreen lessons={lessons} completedLessonIds={[]} onSelectLesson={onSelectLesson} />);
    const row = screen.getByText('第一課').closest('button')!;
    expect(row).not.toBeDisabled();
    await userEvent.click(row);
    expect(onSelectLesson).toHaveBeenCalledWith('l1');
  });

  it('shows a locked layer-2 lesson as disabled and not clickable', () => {
    render(<LessonListScreen lessons={lessons} completedLessonIds={[]} onSelectLesson={() => {}} />);
    const row = screen.getByText('第二層課').closest('button')!;
    expect(row).toBeDisabled();
    expect(row).toHaveClass('locked');
  });

  it('unlocks layer 2 once layer 1 is fully completed', () => {
    render(<LessonListScreen lessons={lessons} completedLessonIds={['l1']} onSelectLesson={() => {}} />);
    expect(screen.getByText('第二層課').closest('button')).not.toBeDisabled();
  });

  it('always shows the standalone anti-fraud lesson as tappable, regardless of layer progress', async () => {
    const onSelectLesson = vi.fn();
    render(<LessonListScreen lessons={lessons} completedLessonIds={[]} onSelectLesson={onSelectLesson} />);
    const row = screen.getByText('防騙課').closest('button')!;
    expect(row).not.toBeDisabled();
    await userEvent.click(row);
    expect(onSelectLesson).toHaveBeenCalledWith('af');
  });

  it('marks a completed lesson with a checkmark icon', () => {
    render(<LessonListScreen lessons={lessons} completedLessonIds={['l1']} onSelectLesson={() => {}} />);
    expect(screen.getByText('第一課').closest('button')).toHaveTextContent('✅');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd "AI for elderly/app"
npx vitest run src/components/LessonListScreen.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

Create `app/src/components/LessonListScreen.tsx`:
```tsx
import type { Lesson } from '../types/lesson';
import { LAYER_NAMES, getLessonState } from '../lib/courseEngine';

interface LessonListScreenProps {
  lessons: Lesson[];
  completedLessonIds: string[];
  onSelectLesson: (lessonId: string) => void;
}

const LAYERS: (1 | 2 | 3)[] = [1, 2, 3];
const LAYER_NUMERAL = ['一', '二', '三'];

export function LessonListScreen({ lessons, completedLessonIds, onSelectLesson }: LessonListScreenProps) {
  const standaloneLessons = lessons.filter((l) => l.layer === 0);

  return (
    <div className="screen">
      <div className="topbar">
        <h2>📖 上堂</h2>
        <p>揀一課，慢慢學</p>
      </div>
      {LAYERS.map((layer) => {
        const layerLessons = lessons.filter((l) => l.layer === layer);
        return (
          <div className="prog-card" key={layer}>
            <h4>
              第{LAYER_NUMERAL[layer - 1]}層 · {LAYER_NAMES[layer]}
            </h4>
            {layerLessons.length === 0 && <p className="prog-num">未有課程</p>}
            {layerLessons.map((lesson) => {
              const state = getLessonState(lesson, lessons, completedLessonIds);
              const icon = state === 'locked' ? '🔒' : state === 'completed' ? '✅' : '▶️';
              return (
                <button
                  key={lesson.id}
                  className={`lesson-row${state === 'locked' ? ' locked' : ''}`}
                  disabled={state === 'locked'}
                  onClick={() => onSelectLesson(lesson.id)}
                >
                  <span className="l-ico">{icon}</span>
                  <span>{lesson.subtitle}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      <div className="prog-card">
        <h4>🛡️ 防騙必修班</h4>
        {standaloneLessons.length === 0 && <p className="prog-num">快將推出</p>}
        {standaloneLessons.map((lesson) => {
          const state = getLessonState(lesson, lessons, completedLessonIds);
          const icon = state === 'completed' ? '✅' : '▶️';
          return (
            <button key={lesson.id} className="lesson-row" onClick={() => onSelectLesson(lesson.id)}>
              <span className="l-ico">{icon}</span>
              <span>{lesson.subtitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/components/LessonListScreen.test.tsx
```
Expected: PASS, all 5 tests.

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: LessonListScreen (per-layer course browser with lock/available/completed states)"
```

---

## Task 5: `HomeScreen` — nullable next-lesson + real anti-fraud button

**Files:**
- Modify: `app/src/components/HomeScreen.tsx`
- Modify: `app/src/components/HomeScreen.test.tsx`

- [ ] **Step 1: Replace the failing test**

Replace `app/src/components/HomeScreen.test.tsx` entirely with:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './HomeScreen';
import { seedLesson } from '../data/seedLesson';

const antiFraudLesson = { ...seedLesson, id: 'af', subtitle: '防騙課' };

describe('HomeScreen', () => {
  it('shows the next lesson and the current streak', () => {
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={5} onSelectLesson={() => {}} />);
    expect(screen.getByText(seedLesson.subtitle)).toBeInTheDocument();
    expect(screen.getByText('5', { exact: false })).toBeInTheDocument();
  });

  it('selects the next lesson when the today-card is tapped', async () => {
    const onSelectLesson = vi.fn();
    render(
      <HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={onSelectLesson} />,
    );
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    expect(onSelectLesson).toHaveBeenCalledWith(seedLesson.id);
  });

  it('shows an encouragement message and disables the 上堂 button when there is no next lesson', () => {
    render(<HomeScreen nextLesson={null} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.getByText('今層學晒喇', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('上堂').closest('button')).toBeDisabled();
  });

  it('enables the anti-fraud button once that lesson exists, and calls onSelectLesson with its id', async () => {
    const onSelectLesson = vi.fn();
    render(
      <HomeScreen
        nextLesson={seedLesson}
        antiFraudLesson={antiFraudLesson}
        streakCount={0}
        onSelectLesson={onSelectLesson}
      />,
    );
    const btn = screen.getByText('防騙必修班').closest('button')!;
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(onSelectLesson).toHaveBeenCalledWith('af');
  });

  it('keeps the anti-fraud and help buttons disabled when unavailable', () => {
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.getByText('防騙必修班').closest('button')).toBeDisabled();
    expect(screen.getByText('唔識就撳我').closest('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "AI for elderly/app"
npx vitest run src/components/HomeScreen.test.tsx
```
Expected: FAIL — `HomeScreen` still requires a non-null `todayLesson` prop and has no `nextLesson`/`antiFraudLesson`/`onSelectLesson` props.

- [ ] **Step 3: Rewrite `HomeScreen.tsx`**

Replace `app/src/components/HomeScreen.tsx` entirely with:
```tsx
import type { Lesson } from '../types/lesson';

interface HomeScreenProps {
  nextLesson: Lesson | null;
  antiFraudLesson: Lesson | null;
  streakCount: number;
  onSelectLesson: (lessonId: string) => void;
}

export function HomeScreen({ nextLesson, antiFraudLesson, streakCount, onSelectLesson }: HomeScreenProps) {
  return (
    <div className="screen">
      <div className="greet">
        <div className="hello">早晨 👋</div>
        <div className="sub">今日想學啲咩？</div>
      </div>
      {nextLesson ? (
        <div className="today-card" onClick={() => onSelectLesson(nextLesson.id)}>
          <div className="label">📅 今日新課</div>
          <h3>{nextLesson.subtitle}</h3>
          <div className="go">開始上堂 ▶</div>
        </div>
      ) : (
        <div className="today-card">
          <div className="label">🎉 今層學晒喇</div>
          <h3>去「上堂」揀下一層，或者試下防騙必修班</h3>
        </div>
      )}
      <div className="home-btns">
        <button
          className="bigbtn"
          style={{ background: '#fdf4dd', color: '#8a6d1a' }}
          disabled={!nextLesson}
          onClick={() => nextLesson && onSelectLesson(nextLesson.id)}
        >
          <span className="ico">📖</span>
          <span>
            上堂
            <small>{nextLesson ? nextLesson.title : '暫時得閒'}</small>
          </span>
        </button>
        <button
          className="bigbtn"
          style={{ background: '#fdecec', color: '#a33' }}
          disabled={!antiFraudLesson}
          onClick={() => antiFraudLesson && onSelectLesson(antiFraudLesson.id)}
        >
          <span className="ico">🛡️</span>
          <span>
            防騙必修班
            <small>{antiFraudLesson ? antiFraudLesson.title : '快將推出'}</small>
          </span>
        </button>
        <button className="bigbtn" style={{ background: '#eef5fc', color: '#2a5d8f' }} disabled>
          <span className="ico">📞</span>
          <span>
            唔識就撳我
            <small>快將推出</small>
          </span>
        </button>
      </div>
      <div className="streak-strip">
        🔥 連續學咗 <b style={{ color: '#d9822b', fontSize: 26 }}>&nbsp;{streakCount}&nbsp;</b> 日，好叻呀！
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/components/HomeScreen.test.tsx
```
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: HomeScreen shows real next-lesson/anti-fraud state instead of hardcoded todayLesson"
```

---

## Task 6: Wire the course engine into `App.tsx`

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/App.test.tsx`

- [ ] **Step 1: Add new tests to `App.test.tsx`**

`App.test.tsx` currently has one `describe('App auth gate', ...)` block covering 7 scenarios (signed-out, elder shell, family pairing, lessons-error retry, family-link-error retry, already-linked family, null-role). First, add one new import near the top of the file (alongside the existing `import { App } from './App';`):
```tsx
import type { Lesson } from './types/lesson';
```

Then add a **second** `describe` block for the course-engine wiring, right after the closing `});` of the existing `describe('App auth gate', ...)` block (i.e. appended at the end of the file, same imports/mocks already at the top are reused):

```tsx
describe('App course engine (elder)', () => {
  beforeEach(() => vi.clearAllMocks());

  const layer1: Lesson = { ...seedLesson, id: 'l1', layer: 1, number: 1, subtitle: '第一層課' };
  const layer2: Lesson = { ...seedLesson, id: 'l2', layer: 2, number: 4, subtitle: '第二層課' };
  const antiFraud: Lesson = { ...seedLesson, id: 'af', layer: 0, number: 1, subtitle: '防騙課' };

  function mockElder(lessons: Lesson[], completedLessonIds: string[]) {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
    useLessonsMock.mockReturnValue({ lessons, loaded: true, error: null, reload: vi.fn() });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds, streakCount: 3, lastActiveDate: '2026-07-17', familyShareEnabled: true },
      loaded: true,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });
  }

  it('opening a lesson from the 上堂 tab list shows that specific LessonScreen', async () => {
    mockElder([layer1, layer2], []);
    render(<App />);
    await userEvent.click(screen.getByText('上堂'));
    expect(screen.getByText('第一層課')).toBeInTheDocument();
    await userEvent.click(screen.getByText('第一層課'));
    // LessonScreen renders the lesson's first (why) step title, plus its subtitle in the
    // topbar — both inherited from the shared `seedLesson` fixture except subtitle, which
    // was overridden per-lesson above, so this confirms both "we're on LessonScreen now"
    // and "specifically for lesson l1", not just any lesson.
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    expect(screen.getByText('第一層課')).toBeInTheDocument();
  });

  it("tapping home's today-card opens that lesson directly, skipping the list", async () => {
    mockElder([layer1], []);
    render(<App />);
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
  });

  it('navigating to a different tab and back to 上堂 shows the list again, not the previously-open lesson', async () => {
    mockElder([layer1], []);
    render(<App />);
    await userEvent.click(screen.getByText('上堂'));
    // '揀一課，慢慢學' is LessonListScreen's own topbar subtitle — a marker that's only
    // present on the list view, unlike the lesson's own subtitle text which appears in
    // both the list row AND (relocated) the opened LessonScreen's topbar.
    expect(screen.getByText('揀一課，慢慢學')).toBeInTheDocument();
    await userEvent.click(screen.getByText('第一層課'));
    expect(screen.queryByText('揀一課，慢慢學')).not.toBeInTheDocument();
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    await userEvent.click(screen.getByText('主頁'));
    await userEvent.click(screen.getByText('上堂'));
    expect(screen.getByText('揀一課，慢慢學')).toBeInTheDocument();
  });

  it('locks layer-2 lessons until layer 1 is fully completed', async () => {
    mockElder([layer1, layer2], []);
    render(<App />);
    await userEvent.click(screen.getByText('上堂'));
    expect(screen.getByText('第二層課').closest('button')).toBeDisabled();
  });

  it('shows the encouragement placeholder on Home when every unlocked lesson is completed', () => {
    mockElder([layer1], ['l1']);
    render(<App />);
    expect(screen.getByText('今層學晒喇', { exact: false })).toBeInTheDocument();
  });

  it('enables the always-unlocked anti-fraud button once that lesson exists', async () => {
    mockElder([layer1, antiFraud], []);
    render(<App />);
    const btn = screen.getByText('防騙必修班').closest('button')!;
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    expect(screen.getByText('防騙課')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "AI for elderly/app"
npx vitest run src/App.test.tsx
```
Expected: FAIL — `App.tsx` still shows only `lessons[0]` with no list screen, no lock/unlock behavior, no anti-fraud wiring.

- [ ] **Step 3: Rewrite the `ElderShell` function in `App.tsx`**

In `app/src/App.tsx`, add these imports at the top (alongside the existing ones):
```tsx
import { LessonListScreen } from './components/LessonListScreen';
import { LAYER_NAMES, getNextLesson, isLayerCompleted } from './lib/courseEngine';
```

Replace the entire `ElderShell` function with:
```tsx
function ElderShell({ userId }: { userId: string }) {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const { lessons, loaded: lessonsLoaded, error: lessonsError, reload: reloadLessons } = useLessons();
  const { state, completeLesson, setFamilyShare } = useProgress(userId);

  // Navigating via the bottom tabs always resets to that tab's top-level view — only an
  // explicit tap on a lesson row/card drills into a specific lesson (openLesson below).
  function navigate(next: ScreenName) {
    setActiveLessonId(null);
    setScreen(next);
  }

  function openLesson(lessonId: string) {
    setActiveLessonId(lessonId);
    setScreen('lesson');
  }

  // A fetch failure is distinct from "genuinely zero lessons" (see useLessons) and must not
  // be swallowed into a silent blank/empty-state screen — surface it with the same
  // error+retry affordance used elsewhere (e.g. FamilyProgressView). Retrying calls useLessons'
  // own reload() rather than remounting ElderShell, so useProgress's streak/completion state
  // (which had nothing to do with the failure) is left completely undisturbed.
  if (lessonsError) {
    return (
      <div className="app">
        <div className="screen">
          <div className="fam-card">
            <p className="error-text">攞唔到課堂內容：{lessonsError}</p>
            <button className="bigbtn" onClick={reloadLessons}>
              再試一次
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!lessonsLoaded) return <div className="app" />;

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
        <LessonScreen
          lesson={activeLesson}
          onComplete={() => {
            completeLesson(activeLesson.id);
            navigate('progress');
          }}
        />
      )}
      {screen === 'lesson' && !activeLesson && (
        <LessonListScreen lessons={lessons} completedLessonIds={state.completedLessonIds} onSelectLesson={openLesson} />
      )}
      {screen === 'progress' && <ProgressScreen layers={layerTotals} badges={badges} />}
      {screen === 'family' && <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} />}
      <NavBar active={screen} onNavigate={navigate} />
    </div>
  );
}
```

Do not modify `FamilyFlow` or the top-level `App` function — this task only touches `ElderShell`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/App.test.tsx
```
Expected: PASS, all tests (existing 7 + new 6 = 13).

- [ ] **Step 5: Run the full test suite, build, and lint**

```bash
npm test
npm run build
npm run lint
```
Expected: all green. (`npm run build` was already fully clean as of Plan 2 — it must stay that way.)

- [ ] **Step 6: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: wire course-engine unlock logic + lesson list into App"
```

---

## Task 7: Content-generation script (DeepSeek → pending drafts)

**Files:**
- Create: `scripts/generate_lessons.py`
- Test: `scripts/test_generate_lessons.py`

- [ ] **Step 1: Write the failing tests**

Create `scripts/test_generate_lessons.py`:
```python
import json
import unittest

from generate_lessons import SCENARIOS, build_prompt, parse_lesson_response

VALID_RESPONSE = {
    "title": "第 2 課",
    "subtitle": "AI 係咩",
    "steps": [
        {"kind": "why", "title": "W", "body": ["a", "b"], "speak": "s"},
        {
            "kind": "demo",
            "title": "D",
            "bubbles": [{"speaker": "user", "text": "u"}, {"speaker": "ai", "text": "a"}],
            "body": ["c"],
            "speak": "s2",
        },
        {
            "kind": "quiz",
            "title": "Q",
            "options": [{"text": "A", "correct": True}, {"text": "B", "correct": False}],
            "feedbackCorrect": "yes",
            "feedbackWrong": "no",
        },
    ],
}

SCENARIO = SCENARIOS[0]


class BuildPromptTests(unittest.TestCase):
    def test_includes_the_scenario_topic(self):
        prompt = build_prompt(SCENARIO)
        self.assertIn(SCENARIO["topic"], prompt)


class ParseLessonResponseTests(unittest.TestCase):
    def test_parses_a_well_formed_response(self):
        lesson = parse_lesson_response(json.dumps(VALID_RESPONSE), SCENARIO)
        self.assertEqual(lesson["id"], SCENARIO["id"])
        self.assertEqual(lesson["layer"], SCENARIO["layer"])
        self.assertEqual(lesson["number"], SCENARIO["number"])
        self.assertEqual(lesson["title"], "第 2 課")
        self.assertEqual(lesson["status"], "pending")

    def test_strips_a_markdown_json_fence(self):
        fenced = "```json\n" + json.dumps(VALID_RESPONSE) + "\n```"
        lesson = parse_lesson_response(fenced, SCENARIO)
        self.assertEqual(lesson["subtitle"], "AI 係咩")

    def test_raises_on_invalid_json(self):
        with self.assertRaises(ValueError):
            parse_lesson_response("not json at all", SCENARIO)

    def test_raises_when_a_required_field_is_missing(self):
        broken = dict(VALID_RESPONSE)
        del broken["subtitle"]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_step_count_is_wrong(self):
        broken = dict(VALID_RESPONSE)
        broken["steps"] = VALID_RESPONSE["steps"][:2]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_step_kinds_are_out_of_order(self):
        broken = dict(VALID_RESPONSE)
        broken["steps"] = [VALID_RESPONSE["steps"][1], VALID_RESPONSE["steps"][0], VALID_RESPONSE["steps"][2]]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_quiz_has_zero_correct_options(self):
        broken = json.loads(json.dumps(VALID_RESPONSE))
        broken["steps"][2]["options"] = [{"text": "A", "correct": False}, {"text": "B", "correct": False}]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)

    def test_raises_when_quiz_has_two_correct_options(self):
        broken = json.loads(json.dumps(VALID_RESPONSE))
        broken["steps"][2]["options"] = [{"text": "A", "correct": True}, {"text": "B", "correct": True}]
        with self.assertRaises(ValueError):
            parse_lesson_response(json.dumps(broken), SCENARIO)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "AI for elderly/scripts"
python3 -m pytest test_generate_lessons.py -v
```
Expected: FAIL — `generate_lessons` module not found.

- [ ] **Step 3: Write the implementation**

Create `scripts/generate_lessons.py`:
```python
"""Generates the Plan 3 seed-lesson drafts via DeepSeek and writes them into
Supabase's elder_lessons table as status='pending', for Stephanie to review
in the admin/ Streamlit app.

Manually triggered only (see ../.github/workflows/generate-lessons.yml,
workflow_dispatch) -- this script does not run on any recurring schedule.

Must stay Python-3.9-compatible (no `X | Y` union type hints, no `match`
statements) -- this project's local dev machine runs Python 3.9.6.
"""

import json
import os
import sys
from typing import Any, Dict, List

import requests

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

SCENARIOS: List[Dict[str, Any]] = [
    {"id": "lesson-002", "layer": 1, "number": 1, "topic": "AI 係咩 —— 長者第一次接觸 AI，建立親近感，唔使驚"},
    {"id": "lesson-003", "layer": 1, "number": 2, "topic": "點同 AI 讲嘢 —— 打字問 AI 問題嘅基本技巧"},
    {"id": "lesson-004", "layer": 1, "number": 3, "topic": "語音輸入 —— 唔使打字，撳一下用把口同 AI 講嘢"},
    {"id": "lesson-005", "layer": 2, "number": 5, "topic": "睇唔明嘅信影相翻譯 —— 政府信、銀行信用相機問 AI 解讀"},
    {"id": "lesson-006", "layer": 2, "number": 6, "topic": "寫祝壽詞/心意卡 —— 請 AI 幫手作賀詞、心意卡文字"},
    {"id": "lesson-007", "layer": 2, "number": 7, "topic": "搵食譜 —— 憑手上材料問 AI 應該煮咩餸"},
    {"id": "lesson-008", "layer": 2, "number": 8, "topic": "同 AI 傾偈解悶 —— 得閒可以搵 AI 傾偈"},
    {"id": "lesson-009", "layer": 3, "number": 9, "topic": "AI 執靚張相 —— 用 AI 修圖、美化相片"},
    {"id": "lesson-010", "layer": 3, "number": 10, "topic": "計劃旅行 —— 用 AI 幫手諗行程"},
    {"id": "lesson-011", "layer": 3, "number": 11, "topic": "幫手覆 WhatsApp —— 用 AI 幫手諗點覆訊息"},
    {
        "id": "lesson-012",
        "layer": 0,
        "number": 1,
        "topic": "防騙班：AI假電話／deepfake點認 —— 認清 AI 詐騙手法（呢課獨立、隨時可以學，唔受層級解鎖限制）",
    },
]

SYSTEM_PROMPT = """你係「AI老友記」呢個教香港長者（60-72歲）用 AI 嘅 app 嘅課堂設計師。
每一課要跟呢個固定結構：
1. why 步：解釋「點解要學呢樣嘢」，一段生活化嘅口語解釋 + 生活痛點。
2. demo 步：模擬一個 user 同 AI 嘅對話 demo（user bubble + AI bubble）。
3. quiz 步：1 條二選一嘅選擇題，答啱先算完成，答錯有溫柔提示再試。

語氣規則（唔可以妥協）：
- 全部用廣東話口語，唔好用書面語/普通話用詞。
- 鼓勵性語氣，當用家係精明大人，唔好居高臨下。
- 每句盡量短，啱畀 22px 大字顯示，唔好一大段長文字。

輸出格式：淨係輸出一個 JSON object，唔好有其他文字或者 markdown code fence，形狀如下：
{
  "title": "string，例如「第 2 課」",
  "subtitle": "string，一句講呢課學咩",
  "steps": [
    {"kind": "why", "title": "string", "body": ["string", "string"], "speak": "string"},
    {"kind": "demo", "title": "string", "bubbles": [{"speaker": "user", "text": "string"}, {"speaker": "ai", "text": "string"}], "body": ["string"], "speak": "string"},
    {"kind": "quiz", "title": "string", "options": [{"text": "string", "correct": true}, {"text": "string", "correct": false}], "feedbackCorrect": "string", "feedbackWrong": "string"}
  ]
}
"""


def build_prompt(scenario: Dict[str, Any]) -> str:
    return f"呢一課嘅場景係：{scenario['topic']}\n\n請跟返 system prompt 嘅結構同格式，生成呢一課嘅內容。"


def call_deepseek(scenario: Dict[str, Any], api_key: str) -> str:
    response = requests.post(
        DEEPSEEK_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_prompt(scenario)},
            ],
            "temperature": 0.7,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def parse_lesson_response(raw_text: str, scenario: Dict[str, Any]) -> Dict[str, Any]:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[len("json"):]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"AI 回應唔係合法 JSON：{exc}\n原文：{raw_text}") from exc

    for field in ("title", "subtitle", "steps"):
        if field not in data:
            raise ValueError(f"AI 回應缺少 '{field}' 欄位：{data}")

    steps = data["steps"]
    if len(steps) != 3:
        raise ValueError(f"steps 應該係 3 步，實際係 {len(steps)} 步：{steps}")

    if steps[0].get("kind") != "why":
        raise ValueError(f"第 1 步應該係 'why'，實際係 {steps[0].get('kind')}")
    if steps[1].get("kind") != "demo":
        raise ValueError(f"第 2 步應該係 'demo'，實際係 {steps[1].get('kind')}")
    if steps[2].get("kind") != "quiz":
        raise ValueError(f"第 3 步應該係 'quiz'，實際係 {steps[2].get('kind')}")

    quiz_options = steps[2].get("options", [])
    if len(quiz_options) != 2:
        raise ValueError(f"quiz options 應該係 2 個，實際係 {len(quiz_options)} 個：{quiz_options}")
    correct_count = sum(1 for opt in quiz_options if opt.get("correct") is True)
    if correct_count != 1:
        raise ValueError(f"quiz options 應該啱好有 1 個 correct=true，實際有 {correct_count} 個：{quiz_options}")

    return {
        "id": scenario["id"],
        "layer": scenario["layer"],
        "number": scenario["number"],
        "title": data["title"],
        "subtitle": data["subtitle"],
        "steps": steps,
        "status": "pending",
    }


def insert_lesson(lesson: Dict[str, Any], supabase_url: str, service_role_key: str) -> None:
    response = requests.post(
        f"{supabase_url}/rest/v1/elder_lessons",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=lesson,
        timeout=15,
    )
    response.raise_for_status()


def main() -> int:
    deepseek_key = os.environ["DEEPSEEK_API_KEY"]
    supabase_url = os.environ["SUPABASE_URL"]
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    failures = []
    for scenario in SCENARIOS:
        print(f"生成緊：{scenario['id']} — {scenario['topic']}")
        try:
            raw = call_deepseek(scenario, deepseek_key)
            lesson = parse_lesson_response(raw, scenario)
            insert_lesson(lesson, supabase_url, service_role_key)
            print(f"  ✅ 已寫入 pending：{lesson['subtitle']}")
        except Exception as exc:  # one bad scenario must not stop the whole batch
            print(f"  ❌ 失敗：{exc}")
            failures.append(scenario["id"])

    if failures:
        print(f"\n{len(failures)} 課生成失敗：{failures}")
        return 1

    print(f"\n全部 {len(SCENARIOS)} 課都成功寫入 pending 隊列。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "AI for elderly/scripts"
python3 -m pytest test_generate_lessons.py -v
```
Expected: PASS, all 9 tests.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: DeepSeek lesson-generation script (scenario list, prompt, response parser/validator)"
```

---

## Task 8: GitHub Actions workflow (manual trigger)

**Files:**
- Create: `.github/workflows/generate-lessons.yml`

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/generate-lessons.yml`:
```yaml
name: Generate seed lessons

on:
  workflow_dispatch: {}

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install requests

      - name: Generate lessons
        working-directory: scripts
        run: python3 generate_lessons.py
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
          SUPABASE_URL: https://cmtubaxlniglklmdwlzs.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

Note this is `workflow_dispatch` only — no `schedule:` trigger. Per the approved design, this plan does not build a recurring cadence; the action exists so this one seed batch (and any future manually-decided re-run) doesn't require running the script from a local machine.

- [ ] **Step 2: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: workflow_dispatch GitHub Action for the lesson-generation script"
```

---

## Task 9: Run the pipeline and produce the 12 drafts

**Files:** none (execution + live verification only)

**⚠️ Before starting this task:** you need two secrets that no MCP tool can fetch:
1. **`DEEPSEEK_API_KEY`** — reuse the same key already configured for the `daily-novel` project (`~/Desktop/Stephanie-Google Drive/dev/daily-novel/.env`), since it's Stephanie's own key across her own projects (same convention already used for `GITHUB_TOKEN`). Read it with:
   ```bash
   grep DEEPSEEK_API_KEY "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/daily-novel/.env"
   ```
2. **`SUPABASE_SERVICE_ROLE_KEY`** — Stephanie must retrieve this herself from the Supabase Dashboard (project `cmtubaxlniglklmdwlzs` → Settings → API → `service_role` `secret` key) and provide it. No MCP tool exposes this key. **Stop and ask if it hasn't been provided — do not guess or substitute another key.**

- [ ] **Step 1: Set the GitHub Actions secrets**

Install the `gh` CLI if not already present:
```bash
brew install gh
```
Authenticate using the repo's existing PAT (already in `AI for elderly/.env` as `GITHUB_TOKEN`):
```bash
cd "AI for elderly"
GH_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2) gh secret set DEEPSEEK_API_KEY --repo auzistephanie/ai-for-elderly --body "<the deepseek key from above>"
GH_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2) gh secret set SUPABASE_SERVICE_ROLE_KEY --repo auzistephanie/ai-for-elderly --body "<the service role key Stephanie provided>"
```
Verify both are set (values are never shown, just confirm they exist):
```bash
GH_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2) gh secret list --repo auzistephanie/ai-for-elderly
```
Expected: `DEEPSEEK_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` both listed.

- [ ] **Step 2: Trigger the workflow**

```bash
GH_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2) gh workflow run generate-lessons.yml --repo auzistephanie/ai-for-elderly
```
Wait ~30 seconds, then check the run status:
```bash
GH_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2) gh run list --repo auzistephanie/ai-for-elderly --workflow=generate-lessons.yml --limit 1
```
If it fails, view the log:
```bash
GH_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2) gh run view --repo auzistephanie/ai-for-elderly --log
```

- [ ] **Step 3: Verify all 11 drafts landed as pending**

Call `mcp__claude_ai_Supabase__execute_sql` with `project_id: cmtubaxlniglklmdwlzs`:
```sql
select id, layer, number, subtitle, status from public.elder_lessons order by layer, number;
```
Expected: 12 rows total — `lesson-001` at `(2, 4)` with `status = 'published'` (unchanged from Task 2), and `lesson-002` through `lesson-012` all with `status = 'pending'`, matching the layer/number assignments in `SCENARIOS` (Task 7).

If any of the 11 failed to generate (the script prints failures and exits non-zero without stopping the batch), re-run just that scenario manually — e.g. via a local Python REPL importing `scripts/generate_lessons.py` and calling `call_deepseek`/`parse_lesson_response`/`insert_lesson` directly for the one missing scenario — rather than re-running the whole workflow (which would attempt to re-insert the ones that already succeeded and hit the `id` primary-key conflict).

---

## Task 10: Admin approve UI (Streamlit)

**Files:**
- Create: `admin/app.py`
- Create: `admin/requirements.txt`
- Create: `admin/.env.example`
- Create: `admin/.env` (gitignored — not pushed)

- [ ] **Step 1: Write `admin/requirements.txt`**

```
streamlit
requests
python-dotenv
```

- [ ] **Step 2: Write `admin/.env.example` and `admin/.env`**

`admin/.env.example`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`admin/.env` (fill in the real values — same `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` used in Task 9):
```
SUPABASE_URL=https://cmtubaxlniglklmdwlzs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<the service role key>
```

Verify it's gitignored before moving on:
```bash
cd "AI for elderly"
git check-ignore -v admin/.env
```
Expected: matches the root `.gitignore`'s bare `.env` line. If it doesn't match, stop and fix `.gitignore` before proceeding — do not push a real key.

- [ ] **Step 3: Write `admin/app.py`**

```python
import os

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


def fetch_pending_lessons():
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"status": "eq.pending", "order": "layer.asc,number.asc", "select": "*"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def update_lesson(lesson_id, patch):
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"id": f"eq.{lesson_id}"},
        json=patch,
        timeout=15,
    )
    resp.raise_for_status()


def delete_lesson(lesson_id):
    resp = requests.delete(
        f"{SUPABASE_URL}/rest/v1/elder_lessons",
        headers=HEADERS,
        params={"id": f"eq.{lesson_id}"},
        timeout=15,
    )
    resp.raise_for_status()


st.set_page_config(page_title="AI老友記 - 課堂審批", layout="wide")
st.title("AI老友記 · 待審批課堂")

pending = fetch_pending_lessons()

if not pending:
    st.info("而家冇 pending 課堂。")

for lesson in pending:
    with st.expander(f"[第{lesson['layer']}層 #{lesson['number']}] {lesson['subtitle']}"):
        title = st.text_input("標題", value=lesson["title"], key=f"title-{lesson['id']}")
        subtitle = st.text_input("副標題", value=lesson["subtitle"], key=f"subtitle-{lesson['id']}")

        steps = lesson["steps"]
        why_step, demo_step, quiz_step = steps[0], steps[1], steps[2]

        st.subheader("Step 1 · 點解要學")
        why_body = st.text_area("內容（每行一段）", value="\n".join(why_step["body"]), key=f"why-body-{lesson['id']}")
        why_speak = st.text_area("讀出嚟文字", value=why_step["speak"], key=f"why-speak-{lesson['id']}")

        st.subheader("Step 2 · 睇示範")
        demo_bubbles_text = "\n".join(f"{b['speaker']}: {b['text']}" for b in demo_step["bubbles"])
        st.text(demo_bubbles_text)
        demo_body = st.text_area("內容（每行一段）", value="\n".join(demo_step["body"]), key=f"demo-body-{lesson['id']}")
        demo_speak = st.text_area("讀出嚟文字", value=demo_step["speak"], key=f"demo-speak-{lesson['id']}")

        st.subheader("Step 3 · 考一考")
        quiz_title = st.text_input("題目", value=quiz_step["title"], key=f"quiz-title-{lesson['id']}")
        opt_a = st.text_input("選項 A", value=quiz_step["options"][0]["text"], key=f"opt-a-{lesson['id']}")
        opt_b = st.text_input("選項 B", value=quiz_step["options"][1]["text"], key=f"opt-b-{lesson['id']}")
        correct_option = st.radio(
            "邊個岩",
            ["A", "B"],
            index=0 if quiz_step["options"][0]["correct"] else 1,
            key=f"correct-{lesson['id']}",
        )
        feedback_correct = st.text_input("答啱嘅回應", value=quiz_step["feedbackCorrect"], key=f"fb-correct-{lesson['id']}")
        feedback_wrong = st.text_input("答錯嘅回應", value=quiz_step["feedbackWrong"], key=f"fb-wrong-{lesson['id']}")

        col1, col2 = st.columns(2)
        if col1.button("✅ Approve", key=f"approve-{lesson['id']}"):
            new_steps = [
                {**why_step, "body": why_body.split("\n"), "speak": why_speak},
                {**demo_step, "body": demo_body.split("\n"), "speak": demo_speak},
                {
                    **quiz_step,
                    "title": quiz_title,
                    "options": [
                        {"text": opt_a, "correct": correct_option == "A"},
                        {"text": opt_b, "correct": correct_option == "B"},
                    ],
                    "feedbackCorrect": feedback_correct,
                    "feedbackWrong": feedback_wrong,
                },
            ]
            update_lesson(
                lesson["id"],
                {"title": title, "subtitle": subtitle, "steps": new_steps, "status": "published"},
            )
            st.success(f"已 approve：{subtitle}")
            st.rerun()

        if col2.button("❌ Reject（刪除）", key=f"reject-{lesson['id']}"):
            delete_lesson(lesson["id"])
            st.warning(f"已刪除：{subtitle}")
            st.rerun()
```

- [ ] **Step 4: Manual verification — run it locally**

```bash
cd "AI for elderly/admin"
pip install -r requirements.txt
streamlit run app.py
```
Expected: browser opens showing all pending lessons (from Task 9) grouped by layer, each expandable with editable fields and Approve/Reject buttons. Confirm at least one Approve click actually flips that row's `status` to `'published'` (verify via `execute_sql`), and at least one Reject click actually deletes its row. Leave the rest pending for Stephanie to review at her own pace — do not bulk-approve everything as part of this task's verification.

- [ ] **Step 5: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "feat: Streamlit admin approve UI for pending lessons"
```

---

## Task 11: Final verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Confirm the app now shows the full course**

```bash
cd "AI for elderly/app"
npm run dev
```
Using the same Playwright approach as Plan 2's Task 13, log in as an elder (any test phone number — the Send SMS hook still redirects OTP into the DB, no real SMS involved) and confirm:
1. `HomeScreen` shows a real "今日新課" (whichever lesson Stephanie approved first, in layer/number order).
2. The "上堂" tab shows a lesson-list screen with sections for all 3 layers plus 防騙必修班, correctly showing 🔒/▶️/✅ states based on what's been approved and completed so far.
3. Layer 2/3 lessons stay locked until all of layer 1 (or layer 2) is completed — confirm by completing every approved layer-1 lesson and checking layer 2 unlocks.
4. The 防騙必修班 button on Home is enabled (not "快將推出") if that lesson has been approved.

Stop the dev server when done.

- [ ] **Step 2: Update `README.md`**

Under "下一步", replace the Plan 3 bullet with a `✅ Plan 3 已完成` note (same style as the Plan 1/Plan 2 entries), summarizing: 12-lesson scenario list finalized, course-browsing/layer-unlock UI built (the gap discovered during design), DeepSeek generation pipeline + admin Streamlit approve tool shipped, `lesson-001` migrated to its correct tier. Update the "最後更新" line at the bottom.

- [ ] **Step 3: Commit and push**

```bash
cd "AI for elderly"
python3 scripts/github_push.py "docs: mark Plan 3 (content pipeline + course-engine UI) complete"
```
