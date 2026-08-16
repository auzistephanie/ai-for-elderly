# AI老友記（AI for Elderly）

教香港活躍初老（60–72 歲）由淺入深將 AI 融入日常生活嘅教學 PWA —— 大字、撳掣、唔使打字。

> **開新 session 先睇 `README.md`**（總覽/已鎖定表/交付物/下一步）＋ `AI-elder-app-SPEC.md`（完整 product spec）。逐個 Plan 記錄 → `docs/superpowers/plans/*.md`（Plan1–5 全部完成）。改動記錄 → `CHANGELOG.md`。

## ⚙️ Standards（MANDATORY — 正本：`stephanie-personal/docs/ai-governance/STANDARDS.md`，改規則只改正本）

Push（`github_push.py`，永不 git CLI・HTTPS・一 run 一 commit・**開工前 `--check`**・**收工即推**・三道閘 刪檔／SHA／交叉 review，撞閘唔好即刻 `--force`）・寫入分流（改動記錄 → `CHANGELOG.md` **頂部**；本檔上限 100 行/6KB）・清理 mv `_to_delete/`・方向性決定先 preview（STANDARDS §S3）・改完以用家身份 run 一次先報完成・governance DIAGNOSIS+STANDARDS（完成前過 STANDARDS §S2；冇 mount stephanie-personal 就叫 Stephanie 連埋）。**Codex 讀同層 `AGENTS.md`**。詳文＋例外表 → 正本。

## 架構

- `app/` — 正式 PWA 本體（電話 OTP 登入、長者/家人角色分流、配對碼、課堂內容/進度、vite-plugin-pwa manifest + SW）。生產 https://ai-elder-app.vercel.app（Vercel project 名 = `ai-elder-app`）
- `admin/` — Streamlit（睇/edit/unpublish 課堂）。**唔係出街前置關卡**，純事後補救 —— 見下面內容管道決定
- `supabase/` — 後端（`cmtubaxlniglklmdwlzs`），RLS 例：`elder_profiles_family_read`、`elder_profiles_elder_read_family`
- `scripts/generate_lessons.py` — DeepSeek 生成課堂 draft 管道（單元測試 `scripts/test_generate_lessons.py`）· `scripts/generate_icons.py` — PWA icon set（192/512 + maskable）
- `ai-elder-app-mockup.html` — 已獲批視覺/互動參考 · `landing/index.html` — 宣傳頁，生產 https://ai-elder-landing.vercel.app

## 已鎖定決定（唔使再問 — SPEC §2/§4/§5/§6/§7/§10 + README 已鎖定表）

- App 名：AI老友記，副題「老友記嘅 AI 生活學堂」。Persona：活躍初老 60–72 歲，識 WhatsApp/YouTube，未掂過 AI。
- 商業模式：MVP 全免費，A 收費 / C 基金兩條路保留、留 feature flag。出街形式：**先 PWA**，原生 App 係 Phase2（未做）。
- 課程結構：三層（入門/生活應用/進階）+ 防騙必修班獨立成章，逐層解鎖。課堂形式：每課三步（點解要學→睇示範→考一考，二選一大掣）+ 每步「🔊 讀出嚟」。
- **內容管道：AI 生成即自動 `status='published'` 出街**，每週 2–3 課。⚠️ 早期「人手 approve 先出街」嗰條規 **2026-07-19 已由 Stephanie 本人取消**，唔好因為覺得高風險就自己加返個 approve gate。
- **UI 鐵律**：正文/按鈕/選項最細 **22px**、全程撳掣唔使打字、touch target ≥60px、廣東話鼓勵語氣、底部四個 tab（主頁/上堂/進度/家人）。**例外**：純裝飾性 chrome 文字（用戶唔需要睇嚟完成課堂嗰啲，例：`.comment-author`）可以 20px。
- 家人同行：optional，長者可隨時閂分享；仔女睇進度 + 留言鼓勵（**共享 feed，唔係 private thread**）。
- 配色：米白 `#faf8f4` + 深綠 `#2f6f4f`。
- 未決（要 Stephanie 拍板）：自訂 domain（暫唔跟）、定價/基金申請時機（遲啲先）。

## ✅ 完成前檢查（本 repo 專屬 DoD；通用四格 → STANDARDS.md §S2）

1. 改咗 `scripts/generate_lessons.py` → 真跑 `python3 -m pytest scripts/test_generate_lessons.py`，貼 output
2. HTML（mockup / landing）有改 → 瀏覽器實開驗一次；`app/` 有改 → 實開 PWA 行一次受影響 flow
3. Push：`python3 scripts/github_push.py "<msg>"`＋核實 GitHub HEAD（→ Standards §S1）

GitHub `auzistephanie/ai-for-elderly` · push kit 三樣齊（script／`.env`／registry 已登記）
