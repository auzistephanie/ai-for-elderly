# Lesson Demo — Real App Reference (Google Gemini) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lesson's demo step visually references the real, free Google Gemini app (code-drawn brand shell, not a screenshot) instead of generic chat bubbles, and the very first lesson explicitly prompts the elder to install it via a verified real app-store link.

**Architecture:** A small pure-function module resolves the right app-store link+label from a user-agent string; `LessonScreen.tsx` wraps its existing demo-step bubbles in a Gemini-branded shell (new CSS classes, no content/schema changes) and conditionally renders a "get the app" card only when the active lesson is layer 1 number 1. A one-line copy addition to the landing page's family-setup step.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, plain CSS (this project's existing convention — no CSS framework).

**Design doc:** `docs/superpowers/specs/2026-07-19-gemini-app-demo-design.md`

**Repo root for all paths below:** `/Users/stephanieau/Desktop/Stephanie-Google Drive/dev/AI for elderly/` — note this plan touches both `app/` (Vite project) and `landing/` (static site), unlike the previous plan which only touched `app/`.

**Test command (from `app/`):** `npm test`. **Lint:** `npm run lint`. **Build:** `npm run build`.

---

## Task 1: `getGeminiAppStoreInfo` — platform-aware app store link

**Files:**
- Create: `app/src/lib/appStoreLinks.ts`
- Test: `app/src/lib/appStoreLinks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/appStoreLinks.test.ts
import { getGeminiAppStoreInfo } from './appStoreLinks';

describe('getGeminiAppStoreInfo', () => {
  it('returns the iOS App Store link+label for an iPhone user agent', () => {
    expect(getGeminiAppStoreInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)')).toEqual({
      url: 'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
      label: '📲 去 App Store 攞 Gemini',
    });
  });

  it('returns the iOS App Store link+label for an iPad user agent', () => {
    expect(getGeminiAppStoreInfo('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)').url).toBe(
      'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
    );
  });

  it('returns the Android Play Store link+label for an Android user agent', () => {
    expect(getGeminiAppStoreInfo('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toEqual({
      url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
      label: '📲 去 Google Play 攞 Gemini',
    });
  });

  it('defaults to the Android link for an unrecognized user agent', () => {
    expect(getGeminiAppStoreInfo('some-unknown-agent').url).toBe(
      'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/appStoreLinks.test.ts`
Expected: FAIL — `Cannot find module './appStoreLinks'`

- [ ] **Step 3: Write the implementation**

```ts
// app/src/lib/appStoreLinks.ts
// Real, verified app-store URLs for the official Google Gemini app (checked 2026-07-19).
// The Android package id still says "bard" — a leftover from before the product was renamed
// Gemini — but the listing itself is the current official Gemini app; this is not a mistake.
const ANDROID = {
  url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
  label: '📲 去 Google Play 攞 Gemini',
};

const IOS = {
  url: 'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
  label: '📲 去 App Store 攞 Gemini',
};

export interface AppStoreInfo {
  url: string;
  label: string;
}

export function getGeminiAppStoreInfo(userAgent: string): AppStoreInfo {
  return /iPhone|iPad|iPod/i.test(userAgent) ? IOS : ANDROID;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/appStoreLinks.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/appStoreLinks.ts src/lib/appStoreLinks.test.ts
git commit -m "feat: add getGeminiAppStoreInfo (real, verified Play Store / App Store links)"
```

## Task 2: Gemini-styled demo shell

**Files:**
- Modify: `app/src/components/LessonScreen.tsx`
- Modify: `app/src/components/LessonScreen.test.tsx`
- Modify: `app/src/styles/global.css`

- [ ] **Step 1: Write the failing test**

Add to `app/src/components/LessonScreen.test.tsx`, inside the existing `describe('LessonScreen', ...)` block:

```tsx
  it("wraps the demo step's bubbles in a Gemini-branded shell", async () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    expect(screen.getByText('Gemini')).toBeInTheDocument();
    // The existing bubble content must still render, unchanged, inside the new shell.
    expect(screen.getByText(/呢隻係血壓藥/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/LessonScreen.test.tsx`
Expected: FAIL — no element with text "Gemini" exists yet.

- [ ] **Step 3: Add the CSS**

Add to `app/src/styles/global.css`, right after the existing `.demo-box{...}` rule (`app/src/styles/global.css:48-51`):

```css
.gemini-shell{ margin:20px 0; border-radius:20px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,.1); }
.gemini-header{
  background:linear-gradient(90deg,#4285f4,#9b72cb); padding:12px 18px; color:#fff;
  display:flex; align-items:center; gap:8px; font-weight:700; font-size:20px;
}
.gemini-input-bar{
  background:#fff; border-top:1px solid #eee; padding:12px 18px;
  display:flex; align-items:center; gap:14px;
}
.gemini-input-bar .icon{ font-size:24px; }
.gemini-input-bar .field{ flex:1; background:#f2f2f2; border-radius:20px; height:40px; }
```

Then change the existing `.demo-box` rule from:

```css
.demo-box{
  margin:20px 0; background:#fff; border:2.5px dashed #b7cfc2; border-radius:20px;
  padding:22px; font-size:22px; color:#333; line-height:1.6;
}
```

to (drop the outer margin/border/radius/shadow — the new `.gemini-shell` wrapper now owns those; `.demo-box` becomes just the white bubble-holding inner panel):

```css
.demo-box{
  background:#fff; padding:22px; font-size:22px; color:#333; line-height:1.6;
}
```

- [ ] **Step 4: Update the JSX**

In `app/src/components/LessonScreen.tsx`, replace the `step.kind === 'demo'` block (currently lines 53-70):

```tsx
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
```

with:

```tsx
        {step.kind === 'demo' && (
          <>
            <div className="gemini-shell">
              <div className="gemini-header">
                <span>✨</span>
                <span>Gemini</span>
              </div>
              <div className="demo-box">
                {step.bubbles.map((b, i) => (
                  <div key={i} className={b.speaker === 'user' ? 'bubble-user' : 'bubble-ai'}>
                    {b.text}
                  </div>
                ))}
              </div>
              <div className="gemini-input-bar">
                <span className="icon">📷</span>
                <div className="field" />
                <span className="icon">🎤</span>
              </div>
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/components/LessonScreen.test.tsx`
Expected: PASS (5 tests — the 4 pre-existing plus the new one). The pre-existing tests must pass unmodified: they query `screen.getByText('睇下 AI 點答')` (the step's `<h3>` title, rendered outside this block, untouched) and `screen.getByText(/呢隻係血壓藥/)` (bubble text, still rendered the same way, just now nested one level deeper inside `.gemini-shell` — `getByText` doesn't care about DOM depth).

- [ ] **Step 6: Commit**

```bash
git add src/components/LessonScreen.tsx src/components/LessonScreen.test.tsx src/styles/global.css
git commit -m "feat: wrap lesson demo-step bubbles in a Gemini-branded shell"
```

## Task 3: First-lesson "get Gemini" card

**Files:**
- Modify: `app/src/components/LessonScreen.tsx`
- Modify: `app/src/components/LessonScreen.test.tsx`
- Modify: `app/src/styles/global.css`

Depends on Task 1 (`getGeminiAppStoreInfo`) and Task 2 (the demo block this card is inserted next to).

- [ ] **Step 1: Write the failing tests**

Add to `app/src/components/LessonScreen.test.tsx`, inside the existing `describe('LessonScreen', ...)` block:

```tsx
  it('shows a "get Gemini" card only on the very first lesson (layer 1, number 1)', async () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    expect(screen.getByText('今堂要用返 Gemini App')).toBeInTheDocument();
  });

  it('does not show the "get Gemini" card on a later lesson', async () => {
    const laterLesson = { ...seedLesson, layer: 2 as const, number: 5 };
    render(<LessonScreen lesson={laterLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    expect(screen.queryByText('今堂要用返 Gemini App')).not.toBeInTheDocument();
  });

  it('the "get Gemini" card links to a real Gemini app-store URL', async () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    const link = screen.getByRole('link', { name: /攞 Gemini/ });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/(play\.google\.com|apps\.apple\.com)\//);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/LessonScreen.test.tsx`
Expected: FAIL — no "get Gemini" card exists yet (2 new tests fail; the "does not show" test technically passes vacuously since nothing shows the card yet — that's fine, it becomes a real check once Step 4 lands).

- [ ] **Step 3: Add the CSS**

Add to `app/src/styles/global.css`, right after the `.gemini-input-bar .field{...}` rule added in Task 2:

```css
.gemini-card{
  margin:20px 0; border-radius:18px; padding:24px; text-align:center; color:#fff;
  background:linear-gradient(135deg,#4285f4,#9b72cb,#d96570);
  box-shadow:0 4px 14px rgba(0,0,0,.12);
}
.gemini-card .ico{ font-size:40px; margin-bottom:8px; }
.gemini-card h4{ font-size:22px; margin-bottom:6px; color:#fff; }
.gemini-card p{ font-size:18px; opacity:.95; margin-bottom:16px; line-height:1.6; }
.gemini-card .get-app-btn{
  display:block; background:#fff; color:#2b2b26; border-radius:12px; padding:14px;
  font-weight:700; font-size:20px; text-decoration:none;
}
```

- [ ] **Step 4: Update the JSX**

In `app/src/components/LessonScreen.tsx`:

Add the import at the top:

```tsx
import { getGeminiAppStoreInfo } from '../lib/appStoreLinks';
```

Add these two constants right after the existing `const answeredCorrect = ...` line (inside the component body, before the `return`):

```tsx
  const isFirstLesson = lesson.layer === 1 && lesson.number === 1;
  const appStoreInfo = getGeminiAppStoreInfo(navigator.userAgent, navigator.maxTouchPoints);
```

Then, in the `step.kind === 'demo'` block (from Task 2), insert the card immediately before the `<div className="gemini-shell">`:

```tsx
        {step.kind === 'demo' && (
          <>
            {isFirstLesson && (
              <div className="gemini-card">
                <div className="ico">✨</div>
                <h4>今堂要用返 Gemini App</h4>
                <p>好多 Android 手機已經有裝，冇裝嘅撳低面掣攞返一個，完全免費。</p>
                <a className="get-app-btn" href={appStoreInfo.url}>
                  {appStoreInfo.label}
                </a>
              </div>
            )}
            <div className="gemini-shell">
              <div className="gemini-header">
                <span>✨</span>
                <span>Gemini</span>
              </div>
              <div className="demo-box">
                {step.bubbles.map((b, i) => (
                  <div key={i} className={b.speaker === 'user' ? 'bubble-user' : 'bubble-ai'}>
                    {b.text}
                  </div>
                ))}
              </div>
              <div className="gemini-input-bar">
                <span className="icon">📷</span>
                <div className="field" />
                <span className="icon">🎤</span>
              </div>
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/components/LessonScreen.test.tsx`
Expected: PASS (8 tests total: 5 from before this task + 3 new).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — check in particular that `App.test.tsx`'s course-engine tests (which use their own `layer1`/`layer2`/`antiFraud` fixtures, `layer1` being layer 1 number 1 same as `seedLesson`) still pass; the new card renders there too but shouldn't collide with any existing query in that file (none of `App.test.tsx`'s assertions reference "Gemini" or "今堂要用返" text).

- [ ] **Step 7: Commit**

```bash
git add src/components/LessonScreen.tsx src/components/LessonScreen.test.tsx src/styles/global.css
git commit -m "feat: show a real, verified 'get Gemini' card on the first lesson only"
```

## Task 4: Landing page copy

**Files:**
- Modify: `landing/index.html`

- [ ] **Step 1: Make the edit**

In `landing/index.html`, find this line (inside the "送給父母" / Stop 03 section, the first `.step` card):

```html
      <div class="step reveal d1"><h3>幫父母設定一次</h3><p>開啟連結、加到主畫面、登入——只需你幫忙一次，大約五分鐘。</p></div>
```

Replace with:

```html
      <div class="step reveal d1"><h3>幫父母設定一次</h3><p>開啟連結、加到主畫面、登入，順手幫佢裝埋 Google Gemini App（好多 Android 機已經有）——只需你幫忙一次，大約五分鐘。</p></div>
```

- [ ] **Step 2: Verify visually**

Run: open `landing/index.html` directly in a browser (`file://` URL) or via a quick static server, scroll to the "送給父母" section, confirm the updated sentence reads naturally and doesn't overflow its card on a narrow (~400px) viewport.

- [ ] **Step 3: Commit**

```bash
git add landing/index.html
git commit -m "content: mention installing Gemini as part of the one-time family setup step"
```

## Task 5: Final verification, deploy, and docs

**Files:** none (verification, deployment, and doc updates only)

- [ ] **Step 1: Run the full test suite, lint, and build**

From `app/`:

```bash
npm test
npm run lint
npx tsc -b
npm run build
```

Expected: all clean. Test count should be 170 (baseline from the previous plan) + 4 (Task 1) + 1 (Task 2) + 3 (Task 3) = 178.

- [ ] **Step 2: Live walkthrough**

Run `npm run dev` from `app/`, open the served URL in a browser (or drive it with Playwright), log in as an elder test account, open the very first lesson (layer 1, number 1 — "AI 係咩？"), advance to the demo step, and confirm:
- The "get Gemini" card appears with a genuinely clickable link that opens the real Play Store or App Store Gemini listing.
- The demo step below it shows the Gemini-branded shell (gradient header, bubbles, input-bar mockup).

Then open a **different** lesson (any layer 2 or layer 3 lesson) and confirm the demo shell still appears but the "get Gemini" card does **not**.

- [ ] **Step 3: Redeploy both sites**

```bash
cd "app" && vercel --prod --yes
# The custom alias does NOT auto-follow — re-point it every time (see project memory, "Vercel quirk"):
vercel alias set app-delta-two-31.vercel.app ai-elder-app.vercel.app --scope auzistephanies-projects

cd "../landing" && vercel --prod --yes
```

Verify: `curl -s -o /dev/null -w '%{http_code}\n' https://ai-elder-app.vercel.app/` and the landing URL both return `200`.

- [ ] **Step 4: Push**

```bash
cd ..
python3 scripts/github_push.py "feat: lesson demo steps reference the real Google Gemini app instead of generic chat bubbles"
```

Verify via the GitHub API that the resulting commit contains exactly the expected files (per this repo's Standards §S1 — see `CLAUDE.md`).

- [ ] **Step 5: Update README and project memory**

If `README.md`'s deliverables/backlog sections reference the old generic-chat-bubble demo behavior anywhere, update them. Add a short entry to `CHANGELOG.md` (new entries go at the top, per this repo's own convention — see the file's own header note) summarizing: Gemini chosen as the referenced app (no-VPN reasoning), stylized (not photographed) shell, first-lesson-only get-app card with verified real store links, landing page copy addition.
