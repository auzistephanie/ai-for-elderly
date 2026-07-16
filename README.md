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
   下一步：Plan 2（Supabase 後端 + 電話 OTP 登入）— 見
   `docs/superpowers/plans/2026-07-16-mvp-walking-skeleton.md` 頂部嘅 5-plan roadmap。
2. **Deploy landing page**：揀 domain，換走 placeholder（footer email、CTA link、form 後端）。
3. **確認首次 push**：雙擊 `push-now.command` 或等 daemon 跑一輪，check
   https://github.com/auzistephanie/ai-for-elderly 有冇見到啲檔案。

## 未決事項（要 Stephanie 之後拍板）

- ❓ Deploy domain（landing page + PWA）
- ❓ 定價 / 基金申請路線幾時啟動
- ❓ 首批 8–10 課種子課程嘅場景清單（想唔想自己揀）

---

*最後更新：2026-07-17（Plan 1 walking skeleton 完成）*
