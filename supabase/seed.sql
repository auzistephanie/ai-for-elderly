-- Seeds the Plan-1 hardcoded lesson (formerly app/src/data/seedLesson.ts) into
-- elder_lessons. Idempotent: safe to re-run against a fresh/restored project.
insert into public.elder_lessons (id, layer, number, title, subtitle, steps, status)
values (
  'lesson-001',
  1,
  1,
  '第 1 課',
  '影張相，問 AI 呢隻藥點樣食',
  '[{"kind":"why","title":"點解要學呢樣嘢？","body":["藥袋上面啲字好細，又多英文。","其實你只要影張相，AI 就會用中文話你知：呢隻藥係咩、幾時食、有咩要注意。"],"speak":"藥袋上面啲字好細，又多英文。其實你只要影張相，AI 就會用中文話你知，呢隻藥係咩、幾時食、有咩要注意。"},{"kind":"demo","title":"睇下 AI 點答","bubbles":[{"speaker":"user","text":"📷（藥袋相片）\n呢隻藥係咩嚟？"},{"speaker":"ai","text":"呢隻係血壓藥。每日食一次，最好朝早食。記住唔好自己停藥，有疑問要問醫生。💊"}],"body":["就係咁簡單！唔使打字，影相 + 撳一下就得。"],"speak":"就係咁簡單，唔使打字，影相加撳一下就得。"},{"kind":"quiz","title":"AI 話你知藥物資料之後，你應該——","options":[{"text":"即刻自己停藥","correct":false},{"text":"當參考，有疑問問返醫生","correct":true}],"feedbackCorrect":"👏 啱晒！AI 係好幫手，但健康大事都要問醫生。","feedbackWrong":"再諗下 — AI 講嘅嘢係參考，藥唔可以自己亂停㗎。"}]'::jsonb,
  'published'
)
on conflict (id) do nothing;
