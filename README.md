# AI老友記 — Project 總覽

> 開新 session 先睇呢份。呢度係「AI老友記」項目嘅 single source of truth，
> 記低咗定位、已鎖定決定、交付物同下一步。詳細建置規格睇 `AI-elder-app-SPEC.md`。

---

## 一句話

**AI老友記**（副題：老友記嘅 AI 生活學堂）——教香港「活躍初老」（60–72 歲）長者，
由淺入深學識將 AI 融入日常生活嘅教學 PWA。內容定時更新，全程大字、撳掣操作、唔使打字。

名嘅由來：「老友記」係香港對長者最親切嘅叫法，加「AI」前綴令個名獨特、搜得到、仔女同長者都秒懂。

---

## 已鎖定決定（唔使再問）

| 項目 | 決定 |
|---|---|
| App 名 | **AI老友記**（2026-07-12 確認） |
| 主 persona | 活躍初老 60–72 歲，識用 WhatsApp／YouTube，未掂過 AI |
| 商業模式 | A 收費 + C 基金／NGO 兩條路都保留；MVP 全免費，預留 feature flag |
| 出街形式 | 先 PWA（Phase 1）→ 內容跑通後先包原生 App（Phase 2） |
| 課程結構 | 三層由淺入深（入門→生活應用→進階）＋防騙必修班獨立成章 |
| 課堂形式 | 每課三步：點解要學 → 睇示範 → 考一考（二選一大掣），每步有「🔊 讀出嚟」 |
| 內容管道 | AI 生成 draft → Stephanie 人手 approve → 出街，每週 2–3 課，**嚴禁全自動** |
| UI 鐵律 | 最細字 22px、全程撳掣唔使打字、touch target ≥60px、廣東話鼓勵語氣 |
| 家人同行 | Optional，長者可隨時閂分享；仔女睇進度＋留言鼓勵 |
| 配色 | 米白 #faf8f4 + 深綠 #2f6f4f 主色（landing page 用復古花磚方向） |

---

## 交付物（全部喺呢個 project 入面）

| 檔案 | 係咩 | 用途 |
|---|---|---|
| `AI-elder-app-SPEC.md` | 完整 product spec | 交俾 Claude Code CLI（配 superpowers）自行起 MVP |
| `ai-elder-app-mockup.html` | App 互動 mockup | 已獲批嘅視覺／互動參考，4 個 tab 都撳得 |
| `ai-elder-landing.html` | 宣傳 landing page | 滾動旅程式，validator PASS，可直接 deploy |
| `README.md` | 本檔 | Project 總覽 / 接手指引 |

---

## 本機存放規則（全部新 project 通用）

Stephanie 嘅電腦本機路徑：`~/Desktop/Stephanie-Google Drive/dev/`
每次開新 project／有 deliverable 要落地，統一存喺呢個 dev 資料夾（每個 project 開返個子資料夾）。
執行方法：透過 device bridge（`mcp__remote-devices__device_commit_files`）寫入，
前提係 desktop app 嗰邊要先 grant 咗 `dev` 呢個資料夾嘅存取權（未 grant 就寫唔到，要提 Stephanie 撳
「Add folder」）。

## GitHub Auto-Push（已裝妥，2026-07-12）

跟 `stephanie-personal` 現有做法裝嘅，唔使每個 Cowork session 問 Stephanie 攞 GitHub token：

- Repo：https://github.com/auzistephanie/ai-for-elderly.git
- 本機已做：`git init`（HEAD → `refs/heads/main`）、`git remote add origin`、
  複製 `stephanie-personal/scripts/github_push.py` 落 `scripts/`、
  `.env`（`GITHUB_TOKEN` 同 `stephanie-personal` 用返同一個 PAT，`.gitignore` 已包 `.env`）
- 已加入 `~/.../stephanie-personal/scripts/autopush-registry.txt`
- ⚠️ **冇背景 daemon**（2026-07-16 起，已拆除）：Cowork 改完 → 經 `desktop-commander` MCP 喺真 Mac 直接跑
  `python3 scripts/github_push.py "msg"` 即刻推；desktop-commander 唔通先雙擊 `push-now.command`
  （sweep 全部已註冊 repo）。裝機步驟正本 → `stephanie-personal/docs/PUSH-SETUP.md`
- ⚠️ 未喺呢個 session 驗證過真正 push 成功 → 首次要用 GitHub API 核實 HEAD commit 時間
  （private repo 記得帶 `Authorization: Bearer $GITHUB_TOKEN`，否則假 404），唔准假設推咗

**呢套係全域 SOP，每次開新 project／要 push GitHub 都跟返呢個做法**（詳細步驟見上面呢段）。

## 下一步（未做）

1. ~~起 MVP：開新 repo，放入...~~ ✅ Plan 1（walking skeleton）已完成，喺 `app/`。
   ✅ Plan 2（Supabase 後端 + 電話 OTP 登入）已完成 —
   真 Supabase 專案（`cmtubaxlniglklmdwlzs`）電話 OTP 登入（自訂 Send SMS Hook 代替真短訊）、
   長者／家人角色分流、配對碼、課堂內容同進度全部搬咗去 Supabase（唔再靠 localStorage）。
   End-to-end 手動驗證（2026-07-17）全部通過，順便執到並修好一個真 bug：
   長者閂咗「分享進度」之後，家人畫面本應顯示「對方而家冇分享緊進度」，
   實際卻因為 RLS policy 太嚴（連 family_share_enabled 呢個 flag 本身都俾政策擋咗）
   錯誤顯示成「0 日 / 0 課」，已經修好 `elder_profiles_family_read` policy 解決咗。
   詳細計劃見 `docs/superpowers/plans/2026-07-17-plan2-supabase-backend.md`。
   ✅ Plan 3（內容管道 + 課程引擎 UI）已完成 —
   12 課場景清單拍咗板；設計期間發現原有 UI 冇地方睇齊全課程，
   於是整埋「上堂」課程瀏覽畫面（三層 + 防騙必修班分節、🔒/▶️/✅ 狀態、逐層解鎖）；
   DeepSeek 生成課堂 draft 嘅管道，同埋 Stephanie 人手 approve 用嘅 Streamlit admin 工具都已出街；
   `lesson-001` 搬咗去佢啱嘅 tier。內容審批完全由 Stephanie 自己一課一課 approve，
   唔會全自動出街。詳細計劃見 `docs/superpowers/plans/2026-07-17-plan3-content-pipeline.md`。
   ✅ Plan 4（家人同行功能 polish）已完成 —
   補返 display name 缺口（長者、家人登入時都要打自己個名，唔再靠 `elder_profiles.display_name`
   長期得 `null`）；加咗家人留言鼓勵功能（一個長者一條共享留言 feed，任何已配對＋已開分享嘅
   家人都睇到全部留言，唔係一人一條 private thread；淨長者可以幫每條留言按 ❤️）；
   配對碼加咗倒數計時＋一鍵重新產生。Live walkthrough（6 步全走一次）揪出一個單元測試冚唔到嘅
   真 bug：家人喺長者畫面度嘅留言，作者名一直顯示做 generic「家人」字眼，而唔係佢個真名 ——
   root cause 係 `elder_profiles` RLS 淨得 `elder_profiles_family_read`（家人讀長者），
   冇對稱嘅 policy 俾長者讀已配對家人嗰邊嘅 `display_name`。加咗新 policy
   `elder_profiles_elder_read_family` 之後，Task 9 重新做多次 live walkthrough 確認長者畫面
   已經正確顯示返家人真名，而且冇影響返轉頭（家人畫面見長者真名嗰個方向本身冇壞過）。
   單元測試（133 個）、build、lint 三項都保持全綠。詳細計劃見
   `docs/superpowers/plans/2026-07-18-plan4-family-companion.md`。
   ✅ Plan 5（PWA polish，MVP 五個計劃入面最後一個）已完成 —
   用 `vite-plugin-pwa` 裝咗完整 PWA manifest + service worker，換埋自家品牌 icon set
   （192/512px + maskable，配色跟返 #2f6f4f 深綠／#faf8f4 米白主色）；已出街課堂內容
   （`elder_lessons` REST call）用 Workbox StaleWhileRevalidate 離線快取，離線都睇到上次
   攞過嘅課堂；Streamlit admin 工具加咗簡單「開始 vs 完成」分析（`elder_lesson_starts` 表
   淨寫入，配合原有 completions 做返個對照）；順手執埋 `index.html` 遺留低嘅 Vite scaffold
   default title/lang。真 Lighthouse PWA audit（Lighthouse 11.7.1，`--only-categories=pwa`，
   對住 `vite preview` 起嘅 production build 跑，非模擬）第一輪 0.88 分，
   淨得 `themed-omnibox`（冇 `<meta name="theme-color">`）唔過；加返呢個 meta tag 之後
   重新 build + 重新跑，全部 installability audit（`installable-manifest`／`splash-screen`／
   `themed-omnibox`／`content-width`／`viewport`／`maskable-icon`）滿分過，PWA 分數 **1.0（100%）**
   （另外 3 個 manual-only audit `pwa-cross-browser`／`pwa-page-transitions`／
   `pwa-each-page-has-url` 本身就冇自動化分數，唔算失敗）。用 Playwright headless
   真係驗證咗 service worker 註冊、precache 生效、離線 reload 之後 App shell
   （登入畫面）仍然完整 render 出嚟，唔係一片空白／network error；因為攞課堂內容嗰步
   需要真 Supabase 電話 OTP 登入，headless 環境冇辦法一次過走完，所以呢次淨止實測到
   「App shell 離線可用」，未實測到「已登入長者離線都攞到課堂內容」呢一層。
   單元測試（137 個，22 個檔案）、build、lint 三項都保持全綠。詳細計劃見
   `docs/superpowers/plans/2026-07-18-plan5-pwa-polish.md`。

   **MVP 五個計劃（Plan 1–5）全部完成** —
   由 walking skeleton 到 Supabase 後端、內容管道、家人同行、PWA polish，
   工程層面嘅 MVP roadmap 已經跑晒。之後未做嘅唔再係「計劃階段」，而係下面
   「未決事項」入面已經記緊嘅現實世界決定：deploy domain、定價／基金申請時機。
2. **Deploy landing page**：揀 domain，換走 placeholder（footer email、CTA link、form 後端）。

## 未決事項（要 Stephanie 之後拍板）

- ❓ Deploy domain（landing page + PWA）
- ❓ 定價 / 基金申請路線幾時啟動

---

*最後更新：2026-07-18（Plan 5 PWA polish 完成，Lighthouse PWA 100 分，MVP 五個計劃全部完成）*
