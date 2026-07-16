# AI老友記 MVP Walking Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working PWA shell (4 tabs matching the approved mockup) with one real, fully-playable seed lesson (三步 + quiz + TTS) end-to-end, no typing required anywhere, progress/streak/badges persisted locally. This is Plan 1 of 5 for the AI老友記 MVP (see `README.md` "下一步"); it satisfies acceptance criteria #1–#3 from `AI-elder-app-SPEC.md` §11. Auth, Supabase, the AI content pipeline, and the family backend come in later plans.

**Architecture:** Single-page React app, no router (4 screens toggled by local state, mirroring the approved mockup's `go()` function). All content/progress is local-only for this phase — one hardcoded seed lesson (data file), progress/streak/badges in `localStorage`. TTS via the browser's native Web Speech API (`zh-HK`), no external service. Component tree: `App` owns current-screen state + the `useProgress` hook, and renders exactly one of `HomeScreen` / `LessonScreen` / `ProgressScreen` / `FamilyScreen` plus the persistent `NavBar`.

**Tech Stack:** Vite + React + TypeScript, Vitest + React Testing Library + jsdom for tests, plain CSS (ported from the approved `ai-elder-app-mockup.html`) — no CSS framework, no state library, no router.

**Scope notes (read before starting):**
- No login yet — `HomeScreen` shows a generic greeting instead of a name (auth lands in Plan 2).
- 「防騙必修班」and 「唔識就撳我」buttons render `disabled` — their content doesn't exist yet (anti-fraud content is Plan 3, help hotline is out of MVP scope per spec §10). This is a deliberate, honest scope cut, not a TODO.
- Layer 2 and Layer 3 progress bars show "🔒 未有課程" because they genuinely have zero lessons until Plan 3 adds seed content — do not fake numbers to match the mockup's illustrative `6/12`.
- Family screen shows only the share toggle + invite prompt — no fake family member card, because no real family link exists until Plan 4.
- Repo convention: **never `git add`/`git commit`/`git push`.** Push via `python3 scripts/github_push.py "<message>"` from the repo root (`AI for elderly/`), per the project's `README.md` and the existing `autopush-registry` entry. Each task ends with one push.

---

## File Structure

All new files live under `app/` (sibling to the existing `AI-elder-app-SPEC.md`, `ai-elder-app-mockup.html`, `README.md`, `scripts/` in this same repo).

```
app/
├── index.html                       # Vite entry, <title>AI老友記</title>, lang="zh-HK"
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts                   # includes Vitest config (jsdom, setupFiles)
├── tests/
│   └── setup.ts                     # jest-dom matchers + Web Speech API mocks
├── src/
│   ├── main.tsx
│   ├── App.tsx                      # screen switch + useProgress wiring
│   ├── App.test.tsx                 # full walkthrough integration test
│   ├── styles/
│   │   └── global.css               # ported from ai-elder-app-mockup.html
│   ├── types/
│   │   ├── screen.ts                # ScreenName union
│   │   └── lesson.ts                # Lesson / step / quiz types
│   ├── data/
│   │   └── seedLesson.ts            # the one hardcoded seed lesson
│   ├── hooks/
│   │   ├── useProgress.ts           # localStorage progress/streak/badges
│   │   └── useProgress.test.ts
│   └── components/
│       ├── NavBar.tsx
│       ├── NavBar.test.tsx
│       ├── SpeakButton.tsx
│       ├── SpeakButton.test.tsx
│       ├── HomeScreen.tsx
│       ├── HomeScreen.test.tsx
│       ├── LessonScreen.tsx
│       ├── LessonScreen.test.tsx
│       ├── ProgressScreen.tsx
│       ├── ProgressScreen.test.tsx
│       ├── FamilyScreen.tsx
│       └── FamilyScreen.test.tsx
```

---

### Task 1: Scaffold the Vite + React + TypeScript project

**Files:**
- Create: `app/` (entire Vite scaffold)
- Modify: `app/vite.config.ts`, `app/tsconfig.app.json`

- [ ] **Step 1: Scaffold with Vite**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
mkdir app && cd app
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 2: Install test dependencies**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly/app"
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Wire Vitest into `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
  },
})
```

- [ ] **Step 4: Add `vitest/globals` types so TypeScript recognizes `describe`/`it`/`expect`**

In `tsconfig.app.json`, add `"vitest/globals"` to the `compilerOptions.types` array (create the array if it doesn't exist):

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 5: Create the test setup file**

Create `app/tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';

class MockSpeechSynthesisUtterance {
  lang = '';
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

const mockSpeechSynthesis = {
  cancel: () => {},
  speak: () => {},
};

// @ts-expect-error jsdom does not implement the Web Speech API
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
// @ts-expect-error jsdom does not implement the Web Speech API
window.speechSynthesis = mockSpeechSynthesis;
```

- [ ] **Step 6: Add a trivial sanity test and verify the toolchain works**

Create `app/src/sanity.test.ts`:

```ts
describe('toolchain sanity check', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test` (add `"test": "vitest run"` to `package.json` scripts first if not present)
Expected: `1 passed`

- [ ] **Step 7: Verify the dev server boots**

Run: `npm run dev` (then Ctrl-C once you see the "Local: http://localhost:5173/" line)
Expected: Vite prints a local URL with no errors.

- [ ] **Step 8: Delete the sanity test and Vite's default boilerplate we don't need**

```bash
rm app/src/sanity.test.ts app/src/App.css
```

(Leave `App.tsx` and `assets/` — App.tsx gets fully rewritten in Task 10.)

- [ ] **Step 9: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: scaffold Vite+React+TS project with Vitest"
```

---

### Task 2: Global styles + NavBar

**Files:**
- Create: `app/src/styles/global.css`
- Create: `app/src/types/screen.ts`
- Create: `app/src/components/NavBar.tsx`
- Test: `app/src/components/NavBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/NavBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavBar } from './NavBar';

describe('NavBar', () => {
  it('renders all four tabs and marks the active one', () => {
    render(<NavBar active="home" onNavigate={() => {}} />);
    expect(screen.getByText('主頁').closest('button')).toHaveClass('on');
    expect(screen.getByText('上堂').closest('button')).not.toHaveClass('on');
    expect(screen.getByText('進度')).toBeInTheDocument();
    expect(screen.getByText('家人')).toBeInTheDocument();
  });

  it('calls onNavigate with the tapped tab name', async () => {
    const onNavigate = vi.fn();
    render(<NavBar active="home" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText('進度'));
    expect(onNavigate).toHaveBeenCalledWith('progress');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- NavBar`
Expected: FAIL — `Cannot find module './NavBar'`

- [ ] **Step 3: Create the screen name type**

Create `app/src/types/screen.ts`:

```ts
export type ScreenName = 'home' | 'lesson' | 'progress' | 'family';
```

- [ ] **Step 4: Implement NavBar**

Create `app/src/components/NavBar.tsx`:

```tsx
import type { ScreenName } from '../types/screen';

const TABS: { name: ScreenName; icon: string; label: string }[] = [
  { name: 'home', icon: '🏠', label: '主頁' },
  { name: 'lesson', icon: '📖', label: '上堂' },
  { name: 'progress', icon: '🌱', label: '進度' },
  { name: 'family', icon: '👨‍👩‍👧', label: '家人' },
];

interface NavBarProps {
  active: ScreenName;
  onNavigate: (name: ScreenName) => void;
}

export function NavBar({ active, onNavigate }: NavBarProps) {
  return (
    <nav className="navbar">
      {TABS.map((tab) => (
        <button
          key={tab.name}
          className={`nav-item${active === tab.name ? ' on' : ''}`}
          onClick={() => onNavigate(tab.name)}
        >
          <span className="n-ico">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- NavBar`
Expected: `2 passed`

- [ ] **Step 6: Port the mockup's CSS**

Create `app/src/styles/global.css` (ported from `../ai-elder-app-mockup.html`, dropping the phone-bezel/side-note preview-only rules and retargeting `.screen`/`.app` to fill the real viewport instead of a mock phone frame):

```css
* { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html, body, #root { height:100%; }
body {
  font-family: -apple-system, "PingFang HK", "Microsoft JhengHei", "Noto Sans TC", sans-serif;
  background:#e8e4dc;
}
.app {
  max-width:480px; margin:0 auto; height:100dvh; background:#faf8f4;
  display:flex; flex-direction:column; overflow:hidden;
}
.screen{flex:1; overflow-y:auto; display:flex; flex-direction:column; background:#faf8f4;}
/* ---------- 通用 ---------- */
.topbar{padding:26px 24px 14px; background:#faf8f4;}
.topbar h2{font-size:32px; color:#1c1c1e; font-weight:800;}
.topbar p{font-size:20px; color:#6b6b6b; margin-top:4px;}
.bigbtn{
  display:flex; align-items:center; gap:16px; width:100%;
  border:none; border-radius:22px; padding:22px 24px; margin-top:16px;
  font-size:26px; font-weight:700; cursor:pointer; text-align:left;
  box-shadow:0 3px 0 rgba(0,0,0,.12); transition:transform .08s;
  min-height:60px;
}
.bigbtn:active{transform:scale(.97);}
.bigbtn:disabled{opacity:.5; cursor:not-allowed;}
.bigbtn .ico{font-size:36px; flex-shrink:0;}
.bigbtn small{display:block; font-size:18px; font-weight:400; margin-top:4px; opacity:.85;}
/* ---------- 主頁 ---------- */
.greet{padding:30px 24px 10px;}
.greet .hello{font-size:34px; font-weight:800; color:#1c1c1e; line-height:1.3;}
.greet .sub{font-size:22px; color:#6b6b6b; margin-top:6px;}
.today-card{
  margin:20px 24px 0; background:#2f6f4f; border-radius:26px; padding:26px;
  color:#fff; cursor:pointer; box-shadow:0 4px 0 #1f4d36;
}
.today-card .label{font-size:20px; opacity:.9;}
.today-card h3{font-size:30px; font-weight:800; margin:10px 0 14px; line-height:1.35;}
.today-card .go{background:#fff; color:#2f6f4f; display:inline-block; font-size:24px; font-weight:800; padding:12px 28px; border-radius:16px;}
.home-btns{padding:8px 24px 24px;}
.streak-strip{
  margin:22px 24px 0; background:#fff; border:2px solid #eee; border-radius:20px;
  padding:16px 20px; font-size:22px; color:#444; display:flex; align-items:center; gap:12px;
}
/* ---------- 課堂 ---------- */
.lesson-body{padding:10px 24px 30px; flex:1;}
.step-pill{font-size:20px; color:#2f6f4f; font-weight:700; background:#e5f2ea; display:inline-block; padding:6px 18px; border-radius:14px; margin-bottom:14px;}
.lesson-body h3{font-size:30px; line-height:1.4; color:#1c1c1e; margin-bottom:14px;}
.lesson-body .talk{font-size:24px; line-height:1.65; color:#333; margin-bottom:12px;}
.demo-box{
  margin:20px 0; background:#fff; border:2.5px dashed #b7cfc2; border-radius:20px;
  padding:22px; font-size:22px; color:#333; line-height:1.6;
}
.bubble-user{background:#dcf3e6; border-radius:16px; padding:14px 16px; margin-bottom:12px; font-size:22px; white-space:pre-line;}
.bubble-ai{background:#f0f0f0; border-radius:16px; padding:14px 16px; font-size:22px; white-space:pre-line;}
.listen-btn{background:#fff; color:#2f6f4f; border:2.5px solid #2f6f4f;}
.next-btn{background:#2f6f4f; color:#fff; justify-content:center; text-align:center;}
.quiz-opt{background:#fff; color:#1c1c1e; border:2.5px solid #ddd;}
.quiz-opt.correct{background:#e5f2ea; border-color:#2f6f4f; color:#2f6f4f;}
.quiz-opt.wrong{background:#fdecec; border-color:#d9534f; color:#d9534f;}
.quiz-feedback{font-size:24px; font-weight:700; margin-top:18px;}
/* ---------- 進度 ---------- */
.prog-card{margin:16px 24px 0; background:#fff; border-radius:22px; border:2px solid #eee; padding:22px;}
.prog-card h4{font-size:24px; color:#1c1c1e; margin-bottom:12px;}
.prog-bar{height:26px; background:#eee; border-radius:13px; overflow:hidden;}
.prog-bar>div{height:100%; background:#2f6f4f; border-radius:13px;}
.prog-num{font-size:22px; color:#555; margin-top:10px;}
.badges{display:flex; gap:14px; margin-top:6px; flex-wrap:wrap;}
.badge{width:86px; text-align:center; font-size:17px; color:#444;}
.badge .b-ico{font-size:44px; background:#fdf4dd; border-radius:50%; width:74px; height:74px; display:flex; align-items:center; justify-content:center; margin:0 auto 6px;}
.badge.locked .b-ico{background:#f0f0f0; filter:grayscale(1); opacity:.45;}
/* ---------- 家人 ---------- */
.fam-card{margin:16px 24px 0; background:#fff; border-radius:22px; border:2px solid #eee; padding:22px; font-size:22px; line-height:1.6; color:#333;}
.toggle-row{display:flex; justify-content:space-between; align-items:center; font-size:23px; color:#1c1c1e; padding:6px 0;}
.toggle{width:70px; height:40px; border-radius:20px; position:relative; cursor:pointer; flex-shrink:0; border:none;}
.toggle::after{content:""; position:absolute; top:4px; right:4px; width:32px; height:32px; background:#fff; border-radius:50%;}
/* ---------- 底部導航 ---------- */
.navbar{
  display:flex; background:#fff; border-top:2px solid #e5e5e5; flex-shrink:0;
}
.nav-item{
  flex:1; border:none; background:none; padding:14px 4px 20px; cursor:pointer;
  font-size:19px; color:#8a8a8a; font-weight:700; min-height:60px;
}
.nav-item .n-ico{display:block; font-size:34px; margin-bottom:4px;}
.nav-item.on{color:#2f6f4f;}
```

- [ ] **Step 7: Import the stylesheet in `main.tsx`**

In `app/src/main.tsx`, replace the default `import './index.css'` with:

```ts
import './styles/global.css';
```

- [ ] **Step 8: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: port mockup CSS + NavBar component"
```

---

### Task 3: Lesson types + seed lesson content

**Files:**
- Create: `app/src/types/lesson.ts`
- Create: `app/src/data/seedLesson.ts`
- Test: `app/src/data/seedLesson.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/data/seedLesson.test.ts`:

```ts
import { seedLesson } from './seedLesson';

describe('seedLesson', () => {
  it('has exactly a why-step, a demo-step, and a quiz-step in order', () => {
    expect(seedLesson.steps.map((s) => s.kind)).toEqual(['why', 'demo', 'quiz']);
  });

  it('quiz has exactly one correct option', () => {
    const correctCount = seedLesson.steps[2].options.filter((o) => o.correct).length;
    expect(correctCount).toBe(1);
  });

  it('belongs to layer 1 so it is reachable with no prior progress', () => {
    expect(seedLesson.layer).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- seedLesson`
Expected: FAIL — `Cannot find module './seedLesson'`

- [ ] **Step 3: Create the lesson types**

Create `app/src/types/lesson.ts`:

```ts
export interface DemoBubble {
  speaker: 'user' | 'ai';
  text: string;
}

export interface WhyStep {
  kind: 'why';
  title: string;
  body: string[];
  speak: string;
}

export interface DemoStep {
  kind: 'demo';
  title: string;
  bubbles: DemoBubble[];
  body: string[];
  speak: string;
}

export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizStep {
  kind: 'quiz';
  title: string;
  options: [QuizOption, QuizOption];
  feedbackCorrect: string;
  feedbackWrong: string;
}

export interface Lesson {
  id: string;
  layer: 1 | 2 | 3;
  number: number;
  title: string;
  subtitle: string;
  steps: [WhyStep, DemoStep, QuizStep];
}
```

- [ ] **Step 4: Create the seed lesson data**

Create `app/src/data/seedLesson.ts` (content ported verbatim from the approved `ai-elder-app-mockup.html` lesson demo, filed under Layer 1 since "影相問 AI" is one of `AI-elder-app-SPEC.md` §5.1's own Layer-1 examples):

```ts
import type { Lesson } from '../types/lesson';

export const seedLesson: Lesson = {
  id: 'lesson-001',
  layer: 1,
  number: 1,
  title: '第 1 課',
  subtitle: '影張相，問 AI 呢隻藥點樣食',
  steps: [
    {
      kind: 'why',
      title: '點解要學呢樣嘢？',
      body: [
        '藥袋上面啲字好細，又多英文。',
        '其實你只要影張相，AI 就會用中文話你知：呢隻藥係咩、幾時食、有咩要注意。',
      ],
      speak:
        '藥袋上面啲字好細，又多英文。其實你只要影張相，AI 就會用中文話你知，呢隻藥係咩、幾時食、有咩要注意。',
    },
    {
      kind: 'demo',
      title: '睇下 AI 點答',
      bubbles: [
        { speaker: 'user', text: '📷（藥袋相片）\n呢隻藥係咩嚟？' },
        {
          speaker: 'ai',
          text: '呢隻係血壓藥。每日食一次，最好朝早食。記住唔好自己停藥，有疑問要問醫生。💊',
        },
      ],
      body: ['就係咁簡單！唔使打字，影相 + 撳一下就得。'],
      speak: '就係咁簡單，唔使打字，影相加撳一下就得。',
    },
    {
      kind: 'quiz',
      title: 'AI 話你知藥物資料之後，你應該——',
      options: [
        { text: '即刻自己停藥', correct: false },
        { text: '當參考，有疑問問返醫生', correct: true },
      ],
      feedbackCorrect: '👏 啱晒！AI 係好幫手，但健康大事都要問醫生。',
      feedbackWrong: '再諗下 — AI 講嘅嘢係參考，藥唔可以自己亂停㗎。',
    },
  ],
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- seedLesson`
Expected: `3 passed`

- [ ] **Step 6: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: lesson types + seed lesson content"
```

---

### Task 4: SpeakButton (TTS)

**Files:**
- Create: `app/src/components/SpeakButton.tsx`
- Test: `app/src/components/SpeakButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/SpeakButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeakButton } from './SpeakButton';

describe('SpeakButton', () => {
  it('renders the 讀出嚟 label', () => {
    render(<SpeakButton text="你好" />);
    expect(screen.getByText('讀出嚟俾我聽')).toBeInTheDocument();
  });

  it('speaks the given text in Cantonese when tapped', async () => {
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');
    render(<SpeakButton text="你好嗎" />);
    await userEvent.click(screen.getByText('讀出嚟俾我聽'));
    expect(speakSpy).toHaveBeenCalledTimes(1);
    const utterance = speakSpy.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('你好嗎');
    expect(utterance.lang).toBe('zh-HK');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SpeakButton`
Expected: FAIL — `Cannot find module './SpeakButton'`

- [ ] **Step 3: Implement SpeakButton**

Create `app/src/components/SpeakButton.tsx`:

```tsx
export function speakCantonese(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-HK';
  window.speechSynthesis.speak(utterance);
}

interface SpeakButtonProps {
  text: string;
}

export function SpeakButton({ text }: SpeakButtonProps) {
  return (
    <button className="bigbtn listen-btn" onClick={() => speakCantonese(text)}>
      <span className="ico">🔊</span>
      <span>讀出嚟俾我聽</span>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SpeakButton`
Expected: `2 passed`

- [ ] **Step 5: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: SpeakButton (Web Speech API, zh-HK)"
```

---

### Task 5: useProgress hook (streak, badges, localStorage)

**Files:**
- Create: `app/src/hooks/useProgress.ts`
- Test: `app/src/hooks/useProgress.test.ts`

- [ ] **Step 1: Write the failing tests for the pure functions first**

Create `app/src/hooks/useProgress.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { calcStreak, computeBadges, useProgress } from './useProgress';

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
    const badges = computeBadges({
      completedCount: 0,
      streakCount: 0,
      antiFraudDone: false,
      allLayersDone: false,
    });
    expect(badges.every((b) => b.locked)).toBe(true);
    expect(badges).toHaveLength(4);
  });

  it('unlocks 初次見面 after one completed lesson and 連學5日 at streak >= 5', () => {
    const badges = computeBadges({
      completedCount: 1,
      streakCount: 5,
      antiFraudDone: false,
      allLayersDone: false,
    });
    expect(badges.find((b) => b.id === 'first-lesson')?.locked).toBe(false);
    expect(badges.find((b) => b.id === 'streak-5')?.locked).toBe(false);
    expect(badges.find((b) => b.id === 'anti-fraud')?.locked).toBe(true);
    expect(badges.find((b) => b.id === 'ai-master')?.locked).toBe(true);
  });
});

describe('useProgress', () => {
  beforeEach(() => localStorage.clear());

  it('persists a completed lesson across a full remount (simulating app reload)', () => {
    const first = renderHook(() => useProgress());
    act(() => first.result.current.completeLesson('lesson-001'));
    first.unmount();

    const second = renderHook(() => useProgress());
    expect(second.result.current.state.completedLessonIds).toContain('lesson-001');
  });

  it('persists the family share toggle across a full remount', () => {
    const first = renderHook(() => useProgress());
    act(() => first.result.current.setFamilyShare(false));
    first.unmount();

    const second = renderHook(() => useProgress());
    expect(second.result.current.state.familyShareEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useProgress`
Expected: FAIL — `Cannot find module './useProgress'`

- [ ] **Step 3: Implement useProgress**

Create `app/src/hooks/useProgress.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'ai-elder-progress-v1';

export interface Badge {
  id: string;
  icon: string;
  label: string;
  locked: boolean;
}

interface ProgressState {
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
  return d.toISOString().slice(0, 10);
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

function loadState(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch {
    return defaultState;
  }
}

function saveState(state: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useProgress() {
  const [state, setState] = useState<ProgressState>(loadState);

  useEffect(() => {
    const today = todayISO();
    setState((prev) => {
      if (prev.lastActiveDate === today) return prev;
      const next = {
        ...prev,
        streakCount: calcStreak(prev.lastActiveDate, today, prev.streakCount),
        lastActiveDate: today,
      };
      saveState(next);
      return next;
    });
  }, []);

  const completeLesson = useCallback((lessonId: string) => {
    setState((prev) => {
      if (prev.completedLessonIds.includes(lessonId)) return prev;
      const next = { ...prev, completedLessonIds: [...prev.completedLessonIds, lessonId] };
      saveState(next);
      return next;
    });
  }, []);

  const setFamilyShare = useCallback((enabled: boolean) => {
    setState((prev) => {
      const next = { ...prev, familyShareEnabled: enabled };
      saveState(next);
      return next;
    });
  }, []);

  return { state, completeLesson, setFamilyShare };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useProgress`
Expected: `8 passed`

- [ ] **Step 5: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: useProgress hook (streak/badges/localStorage)"
```

---

### Task 6: LessonScreen

**Files:**
- Create: `app/src/components/LessonScreen.tsx`
- Test: `app/src/components/LessonScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/LessonScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonScreen } from './LessonScreen';
import { seedLesson } from '../data/seedLesson';

describe('LessonScreen', () => {
  it('walks through all three steps and only completes after the correct quiz answer', async () => {
    const onComplete = vi.fn();
    render(<LessonScreen lesson={seedLesson} onComplete={onComplete} />);

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- LessonScreen`
Expected: FAIL — `Cannot find module './LessonScreen'`

- [ ] **Step 3: Implement LessonScreen**

Create `app/src/components/LessonScreen.tsx`:

```tsx
import { useState } from 'react';
import type { Lesson } from '../types/lesson';
import { SpeakButton } from './SpeakButton';

interface LessonScreenProps {
  lesson: Lesson;
  onComplete: () => void;
}

export function LessonScreen({ lesson, onComplete }: LessonScreenProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const step = lesson.steps[stepIndex];
  const quizStep = step.kind === 'quiz' ? step : null;
  const answeredCorrect =
    quizStep !== null && selectedOption !== null && quizStep.options[selectedOption].correct;

  return (
    <div className="screen">
      <div className="topbar">
        <h2>📖 {lesson.title}</h2>
        <p>{lesson.subtitle}</p>
      </div>
      <div className="lesson-body">
        <div className="step-pill">
          第 {stepIndex + 1} 步 / 共 {lesson.steps.length} 步{step.kind === 'quiz' ? ' · 考下你' : ''}
        </div>
        <h3>{step.title}</h3>

        {step.kind === 'why' && (
          <>
            {step.body.map((p, i) => (
              <p className="talk" key={i}>{p}</p>
            ))}
            <SpeakButton text={step.speak} />
            <button className="bigbtn next-btn" onClick={() => setStepIndex((i) => i + 1)}>
              <span>下一步 ▶</span>
            </button>
          </>
        )}

        {step.kind === 'demo' && (
          <>
            <div className="demo-box">
              {step.bubbles.map((b, i) => (
                <div key={i} className={b.speaker === 'user' ? 'bubble-user' : 'bubble-ai'}>
                  {b.text}
                </div>
              ))}
            </div>
            {step.body.map((p, i) => (
              <p className="talk" key={i}>{p}</p>
            ))}
            <SpeakButton text={step.speak} />
            <button className="bigbtn next-btn" onClick={() => setStepIndex((i) => i + 1)}>
              <span>下一步 ▶</span>
            </button>
          </>
        )}

        {quizStep && (
          <>
            {quizStep.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const stateClass = isSelected ? (opt.correct ? ' correct' : ' wrong') : '';
              return (
                <button
                  key={i}
                  className={`bigbtn quiz-opt${stateClass}`}
                  onClick={() => setSelectedOption(i)}
                >
                  <span className="ico">{opt.correct ? '✅' : '❌'}</span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
            {selectedOption !== null && (
              <div
                className="quiz-feedback"
                style={{ color: answeredCorrect ? '#2f6f4f' : '#d9534f' }}
              >
                {answeredCorrect ? quizStep.feedbackCorrect : quizStep.feedbackWrong}
              </div>
            )}
            {answeredCorrect && (
              <button className="bigbtn next-btn" onClick={onComplete}>
                <span>完成課堂 🎉</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- LessonScreen`
Expected: `1 passed`

- [ ] **Step 5: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: LessonScreen (3-step flow + quiz gating)"
```

---

### Task 7: HomeScreen

**Files:**
- Create: `app/src/components/HomeScreen.tsx`
- Test: `app/src/components/HomeScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/HomeScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './HomeScreen';
import { seedLesson } from '../data/seedLesson';

describe('HomeScreen', () => {
  it('shows today\'s lesson and the current streak', () => {
    render(<HomeScreen todayLesson={seedLesson} streakCount={5} onStartLesson={() => {}} />);
    expect(screen.getByText(seedLesson.subtitle)).toBeInTheDocument();
    expect(screen.getByText('5', { exact: false })).toBeInTheDocument();
  });

  it('starts the lesson when the today-card is tapped', async () => {
    const onStartLesson = vi.fn();
    render(<HomeScreen todayLesson={seedLesson} streakCount={0} onStartLesson={onStartLesson} />);
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    expect(onStartLesson).toHaveBeenCalledTimes(1);
  });

  it('renders the not-yet-available features as disabled, not clickable', () => {
    render(<HomeScreen todayLesson={seedLesson} streakCount={0} onStartLesson={() => {}} />);
    expect(screen.getByText('防騙必修班').closest('button')).toBeDisabled();
    expect(screen.getByText('唔識就撳我').closest('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- HomeScreen`
Expected: FAIL — `Cannot find module './HomeScreen'`

- [ ] **Step 3: Implement HomeScreen**

Create `app/src/components/HomeScreen.tsx`:

```tsx
import type { Lesson } from '../types/lesson';

interface HomeScreenProps {
  todayLesson: Lesson;
  streakCount: number;
  onStartLesson: () => void;
}

export function HomeScreen({ todayLesson, streakCount, onStartLesson }: HomeScreenProps) {
  return (
    <div className="screen">
      <div className="greet">
        <div className="hello">早晨 👋</div>
        <div className="sub">今日想學啲咩？</div>
      </div>
      <div className="today-card" onClick={onStartLesson}>
        <div className="label">📅 今日新課</div>
        <h3>{todayLesson.subtitle}</h3>
        <div className="go">開始上堂 ▶</div>
      </div>
      <div className="home-btns">
        <button
          className="bigbtn"
          style={{ background: '#fdf4dd', color: '#8a6d1a' }}
          onClick={onStartLesson}
        >
          <span className="ico">📖</span>
          <span>
            上堂
            <small>{todayLesson.title}</small>
          </span>
        </button>
        <button className="bigbtn" style={{ background: '#fdecec', color: '#a33' }} disabled>
          <span className="ico">🛡️</span>
          <span>
            防騙必修班
            <small>快將推出</small>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- HomeScreen`
Expected: `3 passed`

- [ ] **Step 5: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: HomeScreen"
```

---

### Task 8: ProgressScreen

**Files:**
- Create: `app/src/components/ProgressScreen.tsx`
- Test: `app/src/components/ProgressScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ProgressScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { ProgressScreen } from './ProgressScreen';

const layers = [
  { layer: 1, name: 'AI 入門（淺）', totalLessons: 1, completedLessons: 1 },
  { layer: 2, name: '生活應用（中）', totalLessons: 0, completedLessons: 0 },
  { layer: 3, name: '進階玩法（深）', totalLessons: 0, completedLessons: 0 },
];

const badges = [
  { id: 'first-lesson', icon: '🐣', label: '初次見面', locked: false },
  { id: 'streak-5', icon: '🔥', label: '連學 5 日', locked: true },
  { id: 'anti-fraud', icon: '🛡️', label: '防騙高手', locked: true },
  { id: 'ai-master', icon: '🎓', label: 'AI 達人', locked: true },
];

describe('ProgressScreen', () => {
  it('shows a completed layer 1 and locked empty layers 2/3', () => {
    render(<ProgressScreen layers={layers} badges={badges} />);
    expect(screen.getByText('✅ 完成晒 1 / 1 課')).toBeInTheDocument();
    expect(screen.getAllByText('🔒 未有課程')).toHaveLength(2);
  });

  it('renders unlocked badges without the locked class and locked ones with it', () => {
    render(<ProgressScreen layers={layers} badges={badges} />);
    expect(screen.getByText('初次見面').closest('.badge')).not.toHaveClass('locked');
    expect(screen.getByText('連學 5 日').closest('.badge')).toHaveClass('locked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ProgressScreen`
Expected: FAIL — `Cannot find module './ProgressScreen'`

- [ ] **Step 3: Implement ProgressScreen**

Create `app/src/components/ProgressScreen.tsx`:

```tsx
import type { Badge } from '../hooks/useProgress';

interface LayerInfo {
  layer: number;
  name: string;
  totalLessons: number;
  completedLessons: number;
}

interface ProgressScreenProps {
  layers: LayerInfo[];
  badges: Badge[];
}

const LAYER_NUMERAL = ['一', '二', '三'];

export function ProgressScreen({ layers, badges }: ProgressScreenProps) {
  return (
    <div className="screen">
      <div className="topbar">
        <h2>🌱 我嘅進度</h2>
        <p>一步一步嚟，唔使急</p>
      </div>
      {layers.map((layer) => {
        const pct =
          layer.totalLessons === 0 ? 0 : Math.round((layer.completedLessons / layer.totalLessons) * 100);
        const label =
          layer.totalLessons === 0
            ? '🔒 未有課程'
            : layer.completedLessons === layer.totalLessons
              ? `✅ 完成晒 ${layer.completedLessons} / ${layer.totalLessons} 課`
              : `學緊 ${layer.completedLessons} / ${layer.totalLessons} 課`;
        return (
          <div className="prog-card" key={layer.layer}>
            <h4>第{LAYER_NUMERAL[layer.layer - 1]}層 · {layer.name}</h4>
            <div className="prog-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="prog-num">{label}</div>
          </div>
        );
      })}
      <div className="prog-card">
        <h4>我攞到嘅獎章</h4>
        <div className="badges">
          {badges.map((b) => (
            <div className={`badge${b.locked ? ' locked' : ''}`} key={b.id}>
              <div className="b-ico">{b.icon}</div>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ProgressScreen`
Expected: `2 passed`

- [ ] **Step 5: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: ProgressScreen"
```

---

### Task 9: FamilyScreen

**Files:**
- Create: `app/src/components/FamilyScreen.tsx`
- Test: `app/src/components/FamilyScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/src/components/FamilyScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FamilyScreen } from './FamilyScreen';

describe('FamilyScreen', () => {
  it('shows the invite prompt when sharing is enabled', () => {
    render(<FamilyScreen shareEnabled={true} onToggleShare={() => {}} />);
    expect(screen.getByText(/WhatsApp 邀請/)).toBeInTheDocument();
  });

  it('hides the invite prompt when sharing is disabled', () => {
    render(<FamilyScreen shareEnabled={false} onToggleShare={() => {}} />);
    expect(screen.queryByText(/WhatsApp 邀請/)).not.toBeInTheDocument();
  });

  it('calls onToggleShare with the flipped value when the toggle is tapped', async () => {
    const onToggleShare = vi.fn();
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} />);
    await userEvent.click(screen.getByRole('button', { name: '' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FamilyScreen`
Expected: FAIL — `Cannot find module './FamilyScreen'`

- [ ] **Step 3: Implement FamilyScreen**

Create `app/src/components/FamilyScreen.tsx`:

```tsx
interface FamilyScreenProps {
  shareEnabled: boolean;
  onToggleShare: (enabled: boolean) => void;
}

export function FamilyScreen({ shareEnabled, onToggleShare }: FamilyScreenProps) {
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
        <div className="fam-card" style={{ color: '#888', fontSize: 20 }}>
          ➕ 想加多個家人？撳呢度用 WhatsApp 邀請。
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- FamilyScreen`
Expected: `3 passed`

- [ ] **Step 5: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: FamilyScreen"
```

---

### Task 10: Wire it all together in App

**Files:**
- Modify: `app/src/App.tsx`
- Create: `app/src/App.test.tsx`
- Modify: `app/src/main.tsx` (remove default `<StrictMode>` boilerplate imports that no longer exist, if any leftover from Task 1)

- [ ] **Step 1: Write the failing full-walkthrough test**

Create `app/src/App.test.tsx` (this exercises acceptance criterion #1 from `AI-elder-app-SPEC.md` §11 — completing one lesson end-to-end with no typing):

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App walkthrough', () => {
  beforeEach(() => localStorage.clear());

  it('goes home -> lesson -> quiz -> progress with buttons only, and updates progress', async () => {
    render(<App />);

    // Home: start today's lesson
    expect(screen.getByText('影張相，問 AI 呢隻藥點樣食')).toBeInTheDocument();
    await userEvent.click(screen.getByText('開始上堂 ▶'));

    // Lesson: walk the 3 steps
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('當參考，有疑問問返醫生'));
    await userEvent.click(screen.getByText('完成課堂 🎉'));

    // Lands on Progress, showing Layer 1 fully complete and the first badge unlocked
    expect(screen.getByText('✅ 完成晒 1 / 1 課')).toBeInTheDocument();
    expect(screen.getByText('初次見面').closest('.badge')).not.toHaveClass('locked');

    // Family tab is reachable and toggle works
    await userEvent.click(screen.getByText('家人'));
    expect(screen.getByText(/WhatsApp 邀請/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App.test`
Expected: FAIL (App.tsx still has Vite's default boilerplate content)

- [ ] **Step 3: Implement App**

Replace the contents of `app/src/App.tsx`:

```tsx
import { useState } from 'react';
import { NavBar } from './components/NavBar';
import { HomeScreen } from './components/HomeScreen';
import { LessonScreen } from './components/LessonScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { FamilyScreen } from './components/FamilyScreen';
import { seedLesson } from './data/seedLesson';
import { useProgress, computeBadges } from './hooks/useProgress';
import type { ScreenName } from './types/screen';

export function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const { state, completeLesson, setFamilyShare } = useProgress();

  const layer1Total = 1; // only seedLesson exists until Plan 3 adds more content
  const layer1Completed = state.completedLessonIds.includes(seedLesson.id) ? 1 : 0;

  const badges = computeBadges({
    completedCount: state.completedLessonIds.length,
    streakCount: state.streakCount,
    antiFraudDone: false,
    allLayersDone: false,
  });

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen
          todayLesson={seedLesson}
          streakCount={state.streakCount}
          onStartLesson={() => setScreen('lesson')}
        />
      )}
      {screen === 'lesson' && (
        <LessonScreen
          lesson={seedLesson}
          onComplete={() => {
            completeLesson(seedLesson.id);
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
      {screen === 'family' && (
        <FamilyScreen shareEnabled={state.familyShareEnabled} onToggleShare={setFamilyShare} />
      )}
      <NavBar active={screen} onNavigate={setScreen} />
    </div>
  );
}
```

- [ ] **Step 4: Update `main.tsx` to use the named `App` export**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Delete the now-unused default `App.tsx` export remnants**

Confirm `app/src/App.tsx` has no leftover default export or unused imports from the Vite template (the Step 3 content above is the full file — nothing else should remain in it).

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all test files pass (NavBar, SpeakButton, seedLesson, useProgress, LessonScreen, HomeScreen, ProgressScreen, FamilyScreen, App)

- [ ] **Step 7: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: wire App — full home->lesson->progress->family walkthrough"
```

---

### Task 11: Manual visual verification against the mockup

This step is not automated — jsdom has no real layout engine, so font sizes and touch-target sizes must be checked by eye against the approved mockup. This directly verifies acceptance criterion #2 from `AI-elder-app-SPEC.md` §11.

- [ ] **Step 1: Run the dev server**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly/app"
npm run dev
```

- [ ] **Step 2: Open the app and `ai-elder-app-mockup.html` side by side**

Open `http://localhost:5173/` in a browser, and open `../ai-elder-app-mockup.html` directly (double-click) in another tab/window. Resize the browser to a phone-ish width (~400px) for a fair comparison.

- [ ] **Step 3: Checklist against the mockup**

- [ ] Body text reads at 22–24px, headings 30px+, matching mockup scale
- [ ] All buttons are visibly tall/tappable (~60px), spaced apart
- [ ] Colors match: `#faf8f4` background, `#2f6f4f` green accents
- [ ] Full lesson walkthrough (why → demo → quiz wrong → quiz correct → finish) works by tapping only, no keyboard ever needed
- [ ] 🔊 button actually speaks (test in Chrome/Safari — Web Speech API needs a real browser, not jsdom)
- [ ] Bottom nav has 4 tabs, active tab highlighted in green

- [ ] **Step 4: Note any visual mismatches and fix them inline in the relevant component's CSS/JSX before proceeding** (no separate task needed — these are the same files from Tasks 2–9).

- [ ] **Step 5: Push if any fixes were made**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "app: visual fixes from mockup comparison"
```

---

### Task 12: Update project README

**Files:**
- Modify: `README.md` (repo root)

- [ ] **Step 1: Mark Plan 1 as done in the "下一步" section**

In `README.md`, replace the existing item 1 under `## 下一步（未做）`:

```markdown
1. ~~起 MVP：開新 repo，放入...~~ ✅ Plan 1（walking skeleton）已完成，喺 `app/`。
   下一步：Plan 2（Supabase 後端 + 電話 OTP 登入）— 見
   `docs/superpowers/plans/2026-07-16-mvp-walking-skeleton.md` 頂部嘅 5-plan roadmap。
```

- [ ] **Step 2: Push**

```bash
cd "/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly"
python3 scripts/github_push.py "docs: mark Plan 1 (walking skeleton) complete in README"
```
