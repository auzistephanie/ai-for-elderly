# AI老友記（AI for Elderly）

一句定位：教香港活躍初老（60–72 歲）長者，由淺入深學識將 AI 融入日常生活嘅教學 PWA，大字、撳掣、唔使打字（README §一句話 / SPEC §1）。

## ⚙️ Standards（MANDATORY — 正本：`stephanie-personal/docs/ai-governance/06-STANDARDS.md`，改規則只改正本）

Push（`github_push.py` 永不 git CLI・HTTPS・一次 run 一 commit）・寫入分流（改動記錄 → `CHANGELOG.md` **頂部**，唔准 append 落本檔；本檔上限 100 行/6KB）・清理 mv `_to_delete/`・改舊檔先 `.bak-YYYYMMDD`・方向性決定先 preview・改完以用家身份 run 一次先報完成・governance 00–05（派 subagent 先讀 01+03；報完成前過 02 §R2；冇 mount stephanie-personal → 叫 Stephanie 連埋）。詳文＋例外表 → 正本。

## 文件讀取規則

- Single source of truth：root `README.md`（project 總覽/已鎖定決定/交付物/下一步）+ `AI-elder-app-SPEC.md`（完整 product spec）。開新 session 先睇 README。
- 逐個 Plan 詳細記錄 → `docs/superpowers/plans/*.md`（Plan1 walking skeleton、Plan2 Supabase 後端、Plan3 內容管道、Plan4 家人同行、Plan5 PWA polish，五個全部已完成 — README）。

## 架構/關鍵檔案（以 README 交付物表 + Plan 記錄為準）

- `app/` — 正式 PWA 本體（Plan1 walking skeleton + Plan2 Supabase 後端：電話 OTP 登入、長者/家人角色分流、配對碼、課堂內容/進度；Plan5 加咗 vite-plugin-pwa manifest + service worker）。已部署生產網址 https://ai-elder-app.vercel.app （Vercel project 07-19 由「app」改名做「ai-elder-app」）；stephanie-portfolio elder section 07-19 已轉正「● 運作中」。
- `admin/` — Streamlit 介面（Plan3，睇/edit/unpublish 課堂用）。2026-07-19 起唔再係出街前必經嘅gate，純粹俾 Stephanie 事後補救用。
- `supabase/` — 後端專案（`cmtubaxlniglklmdwlzs`），RLS policies（例：`elder_profiles_family_read`、`elder_profiles_elder_read_family`）。
- `scripts/generate_lessons.py` — AI（DeepSeek）生成課堂 draft 管道（Plan3）；`scripts/test_generate_lessons.py` 係佢嘅單元測試。
- `scripts/generate_icons.py` — 產生 PWA 品牌 icon set（Plan5，192/512px + maskable，配色 #2f6f4f/#faf8f4）。
- `ai-elder-app-mockup.html` — 已獲批視覺/互動參考（README 交付物表）。
- `landing/index.html` — 宣傳 landing page，已部署 https://ai-elder-landing.vercel.app （原 `ai-elder-landing.html` 搬咗嚟呢度，見 README）。
- build/dev/test 具體指令：README/SPEC 冇列明 npm/vite 指令 →（待核實）。

## 已鎖定決定（唔使再問 — SPEC §2/§4/§5/§6/§7/§10 + README 已鎖定表）

- App 名：AI老友記（2026-07-12 確認），副題「老友記嘅 AI 生活學堂」。
- Persona：活躍初老 60–72 歲，識 WhatsApp/YouTube，未掂過 AI。
- 商業模式：MVP 全免費，A 收費 / C 基金兩條路保留、留 feature flag，定價/基金路線未決。
- 出街形式：先 PWA（Phase1，而家），原生 App 係 Phase2（未做）。
- 課程結構：三層（入門/生活應用/進階）+ 防騙必修班獨立成章，逐層解鎖。
- 課堂形式：每課三步（點解要學→睇示範→考一考，二選一大掣）+ 每步「🔊 讀出嚟」。
- 內容管道：AI 生成即自動 `status='published'` 出街，每週 2–3 課（**2026-07-19 政策改變**：原本「Stephanie 人手 approve 先出街、嚴禁全自動」呢條規已由 Stephanie 本人拍板取消，佢話信得過 DeepSeek，唔想再逐課撳approve；admin/ Streamlit 淨係做事後補救，唔再係出街前置關卡）。
- UI 鐵律：最細字 22px（**例外，2026-07-19 Stephanie 拍板**：裝飾性/品牌 chrome 文字可以細過22px，例如 Gemini demo 個header標籤、`.comment-author`，兩個都係20px——呢條例外淨係適用於用戶唔需要睇嚟完成課堂嘅裝飾文字，正文/按鈕/選項一律照舊≥22px）、全程撳掣唔使打字、touch target ≥60px、廣東話鼓勵語氣、底部四個 tab（主頁/上堂/進度/家人）。
- 家人同行：optional，長者可隨時閂分享；仔女睇進度 + 留言鼓勵（共享 feed，唔係 private thread）。
- 配色：米白 #faf8f4 + 深綠 #2f6f4f。
- 未決事項（要 Stephanie 拍板）：自訂 domain（暫唔跟）、定價/基金申請時機（遲啲先）。

## ✅ 完成前檢查（本 repo 專屬 DoD；通用四格 → 02-JUDGMENT §R2）

1. 改咗 `scripts/generate_lessons.py` → 真跑 `python3 -m pytest scripts/test_generate_lessons.py`，貼 output。
2. HTML（mockup / landing）有改 → 瀏覽器實開驗一次；`app/` 有改 → 實開 PWA 行一次受影響 flow。
3. Push：`python3 scripts/github_push.py "<msg>"`＋核實 GitHub HEAD（→ Standards §S1）。

## Push

Repo：`https://github.com/auzistephanie/ai-for-elderly.git`；push kit（`scripts/github_push.py`＋`.env`）已喺 repo（registry 登記狀態待核實）。其餘規則 → ⚙️ Standards §S1。

## Backlog（README §下一步 / §未決事項）

- MVP 五個計劃（Plan1–5）+ error/retry consolidation + Gemini app demo 全部完成，已部署。
- 未決：自訂 domain（暫唔跟）、定價/基金申請時機（遲啲先）。
