# Plan 3 — Content Pipeline + Course-Engine UI (Design)

> This is Plan 3 of 5 for the AI老友記 MVP (see `README.md` "下一步" and the roadmap at the top of `docs/superpowers/plans/2026-07-16-mvp-walking-skeleton.md`). Plan 1 (walking skeleton) and Plan 2 (Supabase backend + phone-OTP login) are complete. This doc is the approved design; the next step is a task-by-task implementation plan (superpowers:writing-plans).

## 1. Goal

Move from "one hardcoded/DB-seeded lesson always shown" to a real multi-lesson course: a fixed batch of 12 seed lessons across the spec's 3 tiers + 1 standalone anti-fraud class, an AI-assisted (DeepSeek) content-drafting pipeline that writes drafts into the existing `pending` queue, a simple single-user Streamlit admin tool for Stephanie to approve/edit/reject those drafts, and — discovered as a gap during design, not originally split out in the 5-plan roadmap — the actual course-browsing + layer-unlock UI, since the app currently has no way to reach any lesson other than `lessons[0]`.

**Out of scope for this plan:** a recurring/scheduled generation pipeline (spec's "每週 2-3 課" ongoing cadence) — this plan's GitHub Action is manually triggered (`workflow_dispatch`) and only responsible for producing this one batch of 12. A steady-state recurring pipeline is a future decision, not designed here. Family comment/like UI (Plan 4). PWA offline/installable polish (Plan 5).

## 2. Seed Lesson Scenario List (approved 2026-07-17)

12 lessons across layer 1 (淺), layer 2 (中), layer 3 (深), plus a standalone anti-fraud class that ignores layer-unlock gating entirely, per spec §5.1's "防騙必修班獨立成章、任何時候都入到."

| Layer | # | Scenario | Notes |
|---|---|---|---|
| 1 | 1 | AI 係咩 —— first "hello", building comfort | **New** — replaces the old L1N1 slot |
| 1 | 2 | 點同 AI 讲嘢 —— basic typed-question technique | New |
| 1 | 3 | 語音輸入 —— no typing, just talk | New |
| 2 | 4 | 影相問AI藥物 | **Existing `lesson-001`, re-tagged from (1,1) to (2,4)** |
| 2 | 5 | 睇唔明嘅信影相翻譯 —— govt/bank letters | New |
| 2 | 6 | 寫祝壽詞/心意卡 | New |
| 2 | 7 | 搵食譜 | New |
| 2 | 8 | 同 AI 傾偈解悶 | New |
| 3 | 9 | AI 執靚張相 | New |
| 3 | 10 | 計劃旅行 | New |
| 3 | 11 | 幫手覆 WhatsApp | New |
| — | 12 | 防騙班：AI假電話／deepfake點認 | New, standalone, always-unlocked |

All 12 (including the "AI 係咩" replacement for L1N1) are generated via the DeepSeek pipeline (§5) rather than hand-written, so every draft goes through the same approve flow — no special-cased first lesson.

## 3. Data Migration

The existing `lesson-001` row must move from `(layer:1, number:1)` to `(layer:2, number:4)` **before** the new L1N1 lesson ("AI 係咩") is inserted, so the `(1,1)` slot is free when that insert happens (the `unique(layer, number)` constraint added at the end of Plan 2 would otherwise reject it).

This is a single, direct one-off `execute_sql` update — no temporary slot needed, since layer 2 is currently completely empty (nothing else occupies `(2, 4)`):

```sql
update public.elder_lessons set layer = 2, number = 4 where id = 'lesson-001';
```

Run this once, before the generation pipeline (§5) inserts any new rows. No RLS/schema change needed — this is a data-only migration within the existing `elder_lessons` table shape.

## 4. Course-Engine UI (gap discovered during design)

The current app only ever shows `lessons[0]` as "今日新課" (`App.tsx`'s `ElderShell`) and has no lesson list, no layer-unlock enforcement, and a hardcoded `disabled` "快將推出" button for 防騙必修班 in `HomeScreen`. This must be built now, or the other 11 approved lessons would be generated, approved, and completely unreachable in the running app.

**「上堂」tab (`ScreenName: 'lesson'`)** changes from directly rendering `LessonScreen` for `todayLesson` to a new **lesson-list screen**:
- One section per layer (1/2/3), following `ProgressScreen`'s existing per-layer visual grouping.
- Each lesson renders as a card: title/subtitle, and one of three states — 🔒 **locked** (layer not yet unlocked — greyed out, not tappable), **available** (tappable, opens `LessonScreen`), or ✅ **completed** (tappable to revisit, checkmark shown).
- A separate, always-unlocked section for 防騙必修班 (the one standalone lesson), regardless of layer progress.

**Unlock rule:** layer 1 always unlocked. Layer 2 unlocks once *all* layer-1 lessons are in `completedLessonIds`. Layer 3 unlocks once all layer-2 lessons are completed. (Matches spec §5.1 "完成上一層先解鎖下一層" literally — no partial/percentage unlock.)

**`HomeScreen`'s "今日新課"** changes from `lessons[0]` to "the next incomplete, unlocked lesson" (first lesson in layer/number order whose `id` is not in `completedLessonIds` and whose layer is unlocked). If every unlocked lesson is completed (e.g. finished layer 1, layer 2 not yet unlocked), Home shows an encouraging placeholder instead of a lesson card — exact copy TBD at implementation time, kept in the same tone as existing Cantonese copy.

The 防騙必修班 button in `HomeScreen` (currently hardcoded `disabled`) becomes a real, always-tappable entry point once the anti-fraud lesson exists and is published.

## 5. Content Generation Pipeline

**Trigger:** `.github/workflows/generate-lessons.yml` in the `AI for elderly` repo, `workflow_dispatch` only (manually run from the GitHub Actions tab or `gh workflow run`) — **not** a recurring cron. This batch produces all 12 lessons in one run (or a small number of manually re-triggered runs if content needs regenerating); no steady-state scheduling is built in this plan.

**Generation:** calls the DeepSeek API (`DEEPSEEK_API_KEY` GitHub secret) with a prompt built from: the spec's fixed 3-step lesson structure (點解要學/睇示範/考一考), the UI/tone rules (§7 of `AI-elder-app-SPEC.md` — Cantonese, encouraging, 22px-appropriate short copy), the 12-item scenario list from §2 above (one generation call per lesson, or a batched call — implementation detail for the task plan), and the existing published/pending lessons (to avoid content duplication and to double check layer/number assignment).

Known quality tradeoff, accepted: DeepSeek is primarily Simplified-Chinese-trained; Cantonese colloquial authenticity may be weaker than Claude's. Mitigation is Stephanie's existing manual approve/edit step in the admin UI (§6) — not a pipeline-level fix. Revisit if approve-stage edits turn out to be extensive.

**Write path:** each generated lesson is inserted into `public.elder_lessons` with `status = 'pending'`, using the Supabase `SUPABASE_SERVICE_ROLE_KEY` GitHub secret (required because `elder_lessons` has no client-facing insert policy — by design, so an arbitrary authenticated client can never write lesson content). This is a materially more sensitive credential than the app's anon/publishable key; scope: stored only as a GitHub Actions secret, never logged, never exposed to the built frontend.

**Output shape:** each draft matches the `Lesson` TS type exactly (`id`, `layer`, `number`, `title`, `subtitle`, `steps: WhyStep | DemoStep | QuizStep[]`) so it renders in `LessonScreen` identically to hand-written/migrated lessons with zero special-casing.

## 6. Admin Approve UI

**Location:** new `admin/` folder inside the `AI for elderly` repo (not folded into the unrelated `venturenix-lab-seminar` Streamlit app — keeps this project self-contained, no cross-project Supabase-key sharing).

**Stack:** Streamlit, matching Stephanie's existing pattern for single-user internal tools (venturenix-lab-seminar, SleekFlow Reply Helper). Run locally (`streamlit run admin/app.py`), connects directly to Supabase using the `SUPABASE_SERVICE_ROLE_KEY` from a local `.env` (gitignored, never committed — same convention as `app/.env`).

**Features:**
- List all `elder_lessons` rows where `status = 'pending'`, grouped by layer.
- Expand any row to see its full content: title, subtitle, all 3 steps' body text, quiz options/feedback, TTS `speak` text.
- Inline text-editing of any field before deciding (drafts are rarely perfect first-pass, per the DeepSeek quality tradeoff in §5).
- **Approve** button: sets `status = 'published'` (any edits made are saved first).
- **Reject** button: deletes the row outright (no soft-delete/history — a rejected draft just isn't wanted, no need to keep it).

No auth/access-control needed beyond "only Stephanie has the service-role key and runs this locally" — matches the SPEC's explicit allowance ("Admin 介面可以好簡陋，俾 Stephanie 一個人用").

## 7. Testing

- Course-engine UI (lesson-list screen, unlock logic, updated `HomeScreen` "next lesson" logic): unit-tested with Vitest/RTL, following this project's existing TDD convention — mock `useLessons`/`useProgress`, assert locked/unlocked/completed rendering and the unlock-boundary logic (all-layer-1-done → layer 2 unlocked, not-all-done → still locked) directly, without needing live Supabase data.
- Data migration (§3) and the generation pipeline's writes (§5): verified live against the actual Supabase project (`execute_sql`/`list_tables` checks), same verification style used throughout Plan 2 — not unit-testable in the traditional sense since it's one-off SQL + an external API call.
- Admin UI (§6): manual verification only (Streamlit has no unit-test convention in this project so far, and it's explicitly a throwaway single-user tool) — confirm approve/reject/edit actually mutate `elder_lessons` correctly via a live walkthrough, similar to Task 13's style in Plan 2.

## 8. Open Items Not Decided Here

- Exact Cantonese copy for "all unlocked lessons completed, next layer not yet open" state on `HomeScreen` — left for implementation time, not a design blocker.
- Whether/when a recurring content-generation cadence gets built (spec's "每週 2-3 課") — explicitly deferred past this plan.
