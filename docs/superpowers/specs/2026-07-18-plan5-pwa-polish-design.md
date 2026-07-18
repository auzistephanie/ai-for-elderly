# Plan 5 — PWA Polish (Design)

> This is Plan 5 of 5 for the AI老友記 MVP — the final phase (see `README.md` "下一步" and the roadmap at the top of `docs/superpowers/plans/2026-07-16-mvp-walking-skeleton.md`). Plans 1-4 are complete. This doc is the approved design; the next step is a task-by-task implementation plan (superpowers:writing-plans).

## 1. Goal

Close out the remaining SPEC §9/§11 requirements that haven't been addressed by any prior plan: installable PWA (manifest + service worker), offline access to already-published lesson content, and minimal analytics (which lessons get started but not completed). This is the last of the 5 planned MVP phases.

**Out of scope:** anything beyond SPEC §10's explicit MVP boundary (native app store packaging, payments, multi-language, social features, live human support) — none of that changes here. A production domain/HTTPS deploy is a separate, already-tracked open item (README's "未決事項") — this plan builds everything needed for Lighthouse's installable audit to pass, but doesn't itself pick/configure a deploy target.

## 2. PWA Tooling

Use `vite-plugin-pwa` (the standard Vite-ecosystem PWA plugin, built on Workbox) rather than hand-writing a service worker. It generates the web app manifest, generates and registers the service worker, precaches the app shell (HTML/JS/CSS/fonts), and auto-injects the required `<link rel="manifest">` and service-worker-registration script into `index.html` — no manual service worker code to write or maintain.

Manifest fields: `name: "AI老友記"`, `short_name: "AI老友記"`, `theme_color: "#2f6f4f"`, `background_color: "#faf8f4"`, `display: "standalone"`, icons (see §3).

## 3. App Icons

The current `favicon.svg`/`icons.svg` in `app/public/` are unmodified Vite scaffold defaults (a generic purple abstract mark, plus a sprite sheet of social-media icons like Bluesky/Discord/GitHub) — entirely unrelated to this app's actual branding. Manifest icons will be freshly designed in this plan, using the app's existing palette (`#faf8f4` background, `#2f6f4f` primary green — same as every other screen in the app), at the two sizes a PWA manifest needs: 192×192 and 512×512 PNG. The old scaffold `favicon.svg`/`icons.svg` get replaced, not kept alongside the new ones.

## 4. Offline Lesson Caching

Workbox runtime caching (configured via `vite-plugin-pwa`, not custom code) intercepts the Supabase REST call `useLessons.ts` makes to `elder_lessons` and caches the response. Because `useLessons` already fetches *all* published lessons in a single request (not one request per lesson), this single runtime-cache entry is sufficient to satisfy the SPEC's "已解鎖課程離線可讀" requirement: once a user has opened the app online at least once, every published lesson's content (not just ones they've already unlocked/completed) is available offline — unlock/lock *state* is still computed client-side from `courseEngine.ts` as normal, this only affects whether the underlying content bytes are reachable without network. No additional filtering logic needed; the existing single-query shape happens to make this simple.

## 5. Analytics — Lesson Start Tracking

New table `elder_lesson_starts` (`user_id`, `lesson_id`, `started_at`), written once per `LessonScreen` mount (every open, including revisits — no dedup logic needed since the analytics question is "did this user ever start vs. ever finish," not "how many times"). RLS: `insert` where `auth.uid() = user_id` only — no `select` policy, since only the Streamlit admin tool (using the `service_role` key, which bypasses RLS entirely) ever needs to read this table; regular users never read their own start history back in-app.

`admin/app.py` gains a new view: per-lesson "started count" vs. "completed count" (a simple diff query joining `elder_lesson_starts` against `elder_lesson_completions`), so Stephanie can spot lessons with a big started-but-not-finished gap (too hard / too boring, per SPEC §9's own framing).

## 6. `index.html` Polish

`<title>app</title>` → `<title>AI老友記</title>`. `lang="en"` → `lang="zh-HK"` (the entire UI is Cantonese; the current `en` is a leftover scaffold default that was never corrected in Plan 1). Remaining PWA-required head tags (manifest link, theme-color meta, apple-mobile-web-app tags) are auto-injected by `vite-plugin-pwa`, not manually added.

## 7. Testing & Verification Approach

Manifest/service-worker/offline-caching are infrastructure, not application logic — genuinely hard to unit-test meaningfully with Vitest/jsdom (jsdom has no service worker support), and the acceptance criteria themselves are live-audit-shaped ("Lighthouse PWA installable ✅", "手機離線開已學課程 ✅"). Following the same precedent set for schema/infra work in Plans 2-3 (verified live via `execute_sql`/`list_tables` rather than forced into Vitest), this plan verifies PWA infra via:
- Build-artifact inspection: after `npm run build`, read `dist/manifest.webmanifest` and confirm its JSON shape/fields directly.
- A real Lighthouse PWA audit (Chrome DevTools, against the built `dist/` served locally — Chrome treats `localhost` as a secure context, so this doesn't require an actual HTTPS deploy first) confirming the installable checks pass.
- A manual offline check: build, serve, load once online, then toggle DevTools' "Offline" network throttling and confirm the app shell loads and a previously-viewed lesson's content is still reachable.

The one piece of genuine application logic this plan adds — the lesson-start logging function — gets normal TDD treatment matching every other `lib/*.ts` module in this codebase (mocked Supabase client, throw-on-error convention, Vitest).

## 8. Open Items Not Decided Here

- Production deploy domain/HTTPS hosting — already tracked as an open item in README, not resolved by this plan.
- Exact icon artwork (a simple green/cream design using the existing palette) is deferred to implementation time — no further product decision needed, just execution.
