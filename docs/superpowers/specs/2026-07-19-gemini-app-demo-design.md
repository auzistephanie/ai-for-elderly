# Lesson Demo — Real App Reference (Google Gemini) Design

> Standalone follow-up, not part of the original 5-plan MVP roadmap or the error-retry-consolidation plan. Triggered by Stephanie reviewing the live app + landing page and flagging: every lesson's "demo" step is an abstract simulated chat (`{"text":..., "speaker":"user"/"ai"}`), never referencing or showing a real, actual AI app — the teaching never tells the elder *which* free app to actually open on their phone, nor what it looks like.

## 1. Goal

Close two related gaps in the actual teaching content (confirmed live against all 12 rows in `elder_lessons`, not just the 2 currently published):

1. Every lesson's demo step renders as generic chat bubbles with no visual tie to a real app — an elder finishing a lesson has no idea what icon to tap on their own phone.
2. Nothing anywhere in the app or landing page explicitly tells the elder (or the family member setting things up) which free app to actually download.

**Chosen app: Google Gemini** (Stephanie's decision, 2026-07-19) — reason given: no VPN needed (unlike some alternatives), and it's often pre-installed on Android phones already, lowering the "one more app to install" barrier for this audience.

**Out of scope (explicitly deferred, not forgotten):**
- Real photographed screenshots of the actual Gemini app — this design uses a **code-drawn stylized recreation** of Gemini's UI (brand gradient, ✨ logo, input-bar icon layout), not literal screenshots. Stephanie chose this specifically to avoid the maintenance burden of re-photographing every time Gemini's real UI changes.
- Support for recommending/showing a second app (e.g., ChatGPT) — Stephanie's words: "有其他app時再睇其他外殼" (revisit if another app becomes relevant later). Do not build an app-selection abstraction now; hardcode for Gemini.
- Editing the 12 lessons' actual JSON content in Supabase — everything in this design is a **frontend rendering change** (component styling + a new conditionally-rendered card), specifically so it does **not** require Stephanie's content-approval step (this repo's hard rule: no lesson content reaches users without her manual admin-tool approval — that rule governs *generated lesson text*, not app chrome/UI).

## 2. Gemini-Styled Demo Shell

Every lesson's `kind: 'demo'` step (rendered by `app/src/components/LessonScreen.tsx`, currently a plain dashed-border `.demo-box` containing `.bubble-user`/`.bubble-ai` divs — see `app/src/styles/global.css:48-53`) gets wrapped in a recognizable Gemini-branded shell:

- A header bar: Gemini's brand gradient (blue → purple, approximating `#4285f4` → `#9b72cb`), white text, ✨ sparkle icon + "Gemini" label.
- The existing `bubble-user`/`bubble-ai` content renders unchanged inside (same text, same data — `step.bubbles` from the lesson JSON is not touched), just inside the new shell instead of the plain dashed box.
- A bottom input-bar mockup below the bubbles: a camera icon (📷) and mic icon (🎤) flanking an empty rounded input field — decorative only, not interactive (no click handlers; this is a visual reference, not a functional chat interface). This directly mirrors real Gemini's photo-upload and voice-input affordances, which is what most of the 12 lessons' scenarios actually use (photographing a medication label, a letter, speaking a question).

This is a **pure presentational change to one shared component** — no lesson content in Supabase changes, no schema change. It applies automatically and uniformly to all 12 existing lessons (2 published, 9 pending, 1 anti-fraud) and every future DeepSeek-generated lesson, with zero per-lesson work.

**Text size:** must keep the existing ≥22px minimum text size (this repo's locked UI rule, see README "已鎖定決定" / CLAUDE.md) — the new header bar and input-bar mockup are chrome around the existing bubble text, not a redesign of the bubble text itself, so the existing `font-size:22px` on `.bubble-user`/`.bubble-ai` is untouched.

## 3. First-Lesson "Get Gemini" Card

A new card, shown **only** when the active lesson is the course's first lesson (`lesson.layer === 1 && lesson.number === 1`), inserted between the `why` step and the `demo` step's shell (i.e., appears once, at the natural point where the lesson is about to reference the app for the first time — not on every lesson).

- Same brand-gradient background as the demo shell's header (visual consistency), ✨ icon, a short line of Cantonese explaining most Android phones already have Gemini installed and it's free, and one big tappable button: "📲 去Google Play攞Gemini".
- The button links to the **real, verified** app store page for the visitor's platform:
  - Android: `https://play.google.com/store/apps/details?id=com.google.android.apps.bard`
  - iOS: `https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729`
  - Platform detection via `navigator.userAgent` (already a common, if imperfect, technique — acceptable here since the worst case is showing the Android link to an iOS user, who can trivially ignore it; not worth a heavier feature-detection approach for this low-stakes case).
- This is a **new conditionally-rendered UI element in `LessonScreen.tsx`**, not new lesson content — no Supabase write, no admin approval needed. It reads `lesson.layer`/`lesson.number` (fields the lesson object already has) to decide whether to render.

## 4. Landing Page Copy

`landing/index.html`'s existing "送給父母" (Stop 03) section, step 1 ("幫父母設定一次" — "開啟連結、加到主畫面、登入——只需你幫忙一次，大約五分鐘。") gets one added sentence mentioning installing Gemini as part of that same one-time setup, e.g. appending something like "，順手幫佢裝埋 Google Gemini App（好多 Android 機已經有）" to the existing paragraph. Small copy edit, no structural change to the section.

## 5. Testing

- `LessonScreen.test.tsx`: new test asserting the Gemini-shell header (e.g. `screen.getByText('Gemini')`) renders for a demo step regardless of which lesson fixture is used (shell is universal).
- New test asserting the "get Gemini" card renders when `lesson.layer === 1 && lesson.number === 1` and does **not** render for any other lesson (layer/number combination) — use the existing `seedLesson` fixture (layer 1 number 1) plus a second fixture overriding layer/number to confirm the negative case.
- New test asserting the card's link `href` matches one of the two verified store URLs above (exact string match — these are real external URLs, a typo here is a broken feature, not a cosmetic bug).
- No test changes needed for `App.test.tsx`, `LessonScreen.test.tsx`'s existing 3(+1 from the earlier plan) tests, or any Supabase-mocking test — this is additive UI only.
- Manual live check (per this repo's DoD, `app/` changed): open the real dev server, navigate to the first lesson, confirm the Gemini shell + get-app card render and the store link is genuinely clickable/correct; check a non-first lesson shows the shell but not the card.

## 6. Open Items Not Decided Here

- Exact gradient color stops / pixel-level styling — left for implementation time, the mockup already approved by Stephanie (`.superpowers/brainstorm/20732-1784400142/content/mockup-v1.html`) is the visual reference to match.
- Whether the anti-fraud lesson (layer 0, always-unlocked, can be reached before layer 1 number 1 in some navigation paths) should also get the "get Gemini" card — not raised during brainstorming; default to strictly `layer===1 && number===1` as specified above unless this surfaces as a real gap during implementation.
