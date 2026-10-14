# CHANGELOG — AI老友記（AI for Elderly）

- 2026-10-13：**Generate seed lessons workflow 失敗原因（run 29592803091，2026-07-17）係 lesson-006 嘅 JSON，唔係缺 secret**。Job log 顯示 `DEEPSEEK_API_KEY` 同 `SUPABASE_SERVICE_ROLE_KEY` 都有傳入（已遮罩），lesson-002 至 005、007 至 012 都寫入成功；lesson-006 喺 `Expecting value: line 20 column 35` 爆，因為模型用「」開咗個字串（`"text": 「親愛嘅媽咪……」"`）。`parse_lesson_response` 而家會先修呢類引號再 parse；`call_deepseek` 加 `response_format: json_object` 同 `max_tokens: 4096`。Workflow 嘅 `actions/checkout` v4→v7、`actions/setup-python` v5→v7。

- 2026-10-13：**刪走成個「讀出嚟俾我聽」**。Stephanie 確認 Mac 上 speechSynthesis／PWA 朗讀不穩，唔再修，直接拆走。課堂「點解要學」「睇示範」唔再有 `SpeakButton`；刪 `speech.ts`、`visibleLessonText`（淨係用嚟砌朗讀稿）、對應測試同 Web Speech mock。`steps[].speak` 留喺 JSON／資料庫，app 同 admin 都唔再讀或者改寫。生成管道唔再把 `speak` 覆蓋成畫面文字。宣傳頁同 mockup 一併去掉朗讀字眼。pytest 10 個、vitest 200 個、`tsc -b`、oxlint、`vite build` 過。本機用課堂畫面行過三步（點解要學 → 睇示範 → 考一考），冇朗讀掣。**未做**：生產版真電話 OTP 登入；資料庫欄位冇 drop。

- 2026-10-13：**「讀出嚟俾我聽」改讀畫面上嘅字**。已發佈課堂嘅 `steps[].speak` 同畫面 `body`／對話氣泡脫節（例：lesson-002「點解要學」畫面係「你有冇試過想查啲嘢…」，朗讀卻係另一句「AI 係一個可以幫你解答問題…」；示範步嘅 `speak` 亦唔包含氣泡）。`LessonScreen` 改為讀 `visibleLessonText`（標題 → 示範氣泡 → 正文），唔再讀 `speak`。`speak` 欄留喺 JSON；新生成同 admin 儲存會寫返同一段畫面文字，避免再分叉。語音語言邏輯冇改。213 個 vitest、`tsc -b`、generator pytest 10 個過。**未做**：真機 PWA 登入後撳掣（要電話 OTP）。

- 2026-10-13：**大字模式易用性（登入／上堂／家人配對）**。手機 390px、根字 24px（約 150% 大字）行過登入→上課→家人。修：① 分享掣由 70×40px 無字色塊改成至少 4rem、寫明「開咗／閂咗」② 登入加「第 N 步，共 4 步」，長者／仔女各有一句說明；電話未打齊會講仲差幾多個數字 ③ 課堂步驟標明點解要學／睇示範／考一考，下一步掣寫明去邊；答錯加「唔緊要，撳另一個再試」④ 錯誤訊息集中 `lib/messages.ts`，口語繁中、講明撳邊個（去掉「check」）⑤ 載入唔再空白，改「載入緊，請等一陣」；錯誤加紅底⑥ 大字時獎章圓圈跟 rem 放大，唔再裁走圖案；進度卡唔再闊過畫面 ⑦ 未解鎖課堂寫明「先學完上一層」，唔再淡到睇唔清。冇加新課。208 個測試、`tsc -b`、oxlint 過。**未做**：真機 PWA、真電話 OTP（今次用本機畫面＋模擬課堂資料，冇寫 production）。

- 2026-10-12：**PWA 更新提示＋禁用掣更易認**。① `vite.config.ts` `registerType: 'autoUpdate'` → `'prompt'`，新增 `UpdateBanner`（`main.tsx` 掛喺 `<App/>` 旁）：新版喺背景下載好後頂部彈出「🎉 有新版本喇」＋「立即更新」／「遲啲先」，唔再要長者重開 app 兩次先見到新版，亦唔會上堂中途自動 reload。測試用 `tests/setup.ts` 預設 mock `virtual:pwa-register/react`；`tsconfig.app.json` 加 `vite-plugin-pwa/react` types。② `.bigbtn:disabled:not([style])` 改實色深灰底＋深灰字＋灰框（有自訂底色嘅防騙班掣照舊半透明）。208 個測試、`tsc -b`、`vite build` 全過。**未驗證**：更新提示喺真機彈出（需要先有一個舊版 SW 嘅裝置，下次再有新 push 時睇）。**舊裝置**：仍然行緊 autoUpdate 嘅舊 SW，會靜靜更新一次去新版，之後先有提示。

- 2026-10-11：**修正生產網址一直停喺舊版**。`ai-elder-app.vercel.app` 係 2026-07-19 用 `vercel alias set` 手動釘去某次部署（見 gemini-app-demo plan），唔會跟之後 push 更新，所以 landing page「免費開始學」、私隱聲明連去嘅一直係舊版。已用 Vercel 將呢個域名正式加為 `ai-elder-app` 項目域名（`app-delta-two-31.vercel.app` 同時有效），之後每次 push 自動更新；已驗證兩個網址都載入最新 bundle（含登入「◀ 返去」同朗讀「撳一下停」）。**教訓：唔好再用手動 `vercel alias set` 指生產域名。** CLAUDE.md／README／landing 網址冇改（網址本身正確）。

- 2026-10-11：**主頁 5 項長者易用性修正**。① 問候語按時間（早晨／午安／晚安）＋長者名（新增 `fetchDisplayName`，best-effort，攞唔到就唔講名）② 連續 0 日唔再「好叻呀」，改「今日學一課，就係你嘅第 1 日」③ 刪走同「今日新課」大卡重複嘅「上堂」掣（連帶「暫時得閒」字眼消失）；大卡加 `role=button`＋鍵盤 Enter/Space＋focus 外框 ④ `global.css` 字體 `px` → `rem`（預設 16px 下數值不變，但跟隨手機大字體設定）。205 個測試、`tsc -b`、`vite build` 全過；未實機開 PWA、未 push（token 401）。

- 2026-10-11：**長者試用評審後改 6 項易用性**（登入／上堂／朗讀，未動 OTP 架構）。① 登入每步加「◀ 返去」② 禁用嘅「下一步」加提示字 ③ 驗證碼畫面改「已經幫你填好，撳確認就得」④ 電話欄自動去空格同 +852、`inputMode=numeric` ⑤ 課堂加「◀ 上一步」⑥ 朗讀：語速 0.85、讀緊時變「撳一下停」、離開該步即收聲、不支援裝置顯示提示（`speech.ts` 新增 `isSpeechSupported`/`stopSpeaking`，`speakCantonese` 加 `onDone`）；另 Gemini 提示卡字 18/20px → 22px。202 個測試、`tsc -b`、`vite build` 全過。**未做**：實機瀏覽器行 flow（生產版要真電話 OTP）、push（`github_push.py --check` 回 401，token 失效）。

- 2026-10-11：**已知風險（Stephanie 拍板：MVP 階段接受，未改）——`get_pending_otp` 等同「知電話號碼就登入到」**。Supabase security advisor 報 `public.get_pending_otp(p_phone)` 係 SECURITY DEFINER 而 anon 可 call。呢個係 Plan 2 刻意設計（未登入 client 要讀返 OTP 顯示喺畫面，冇真 SMS），revoke anon 會令登入完全壞。但後果係：任何人知道某長者電話號碼 → `signInWithOtp` → call `get_pending_otp` 攞 code → 以佢身份登入（睇進度、家人連結、留言）。**有真用戶之前要處理**：轉真 SMS（Send-SMS hook 改 dispatch 去供應商＋drop `get_pending_otp`），或者設計 device-binding。同次 advisor 嘅 `create_pairing_code`／`redeem_pairing_code`（authenticated 可 call）屬設計如此（入面 check `auth.uid()`、固定 search_path），接受。

- 2026-08-29：**刪走主頁「唔識就撳我」死掣**——Cowork code review 揪出呢個掣一直 `disabled`、寫住「快將推出」，spec §7 原本鎖定要有,但成個 codebase／landing page 搵唔到任何真聯絡方式（冇WhatsApp號碼、冇電話、冇FAQ內容）,唔想亂作假嘅求助渠道呃長者。Stephanie 拍板：而家寧願刪走個掣都好過留低一個永遠撳唔郁嘅死掣。`HomeScreen.tsx` 移除咗個 button block，`HomeScreen.test.tsx` 對應斷言改做「確認個掣冇再render」；`AI-elder-app-SPEC.md` §7.8 同步標記為已取消,留低原因方便日後有真聯絡方式先再加返。197 個測試（原196+1個新斷言）、`tsc -b`、`oxlint`、`vite build` 全部行過、全綠。

- 2026-08-29：**新增 top-level `AppErrorBoundary`**——之前所有 error 處理都靠 `useAsyncData`/`useAsyncAction` 包住,但漏網之魚（例如某課 lesson JSON 格式壞咗喺 render 途中先炸）會令成個 app 變白畫面,長者見到會唔知發生咩事、亦唔知撳邊度救返。加咗 `app/src/components/AppErrorBoundary.tsx`（React class component,`main.tsx` 包住 `<App />`）,catch 到任何未接住嘅 render/lifecycle error 就顯示「哎呀，個 app 出咗少少問題」+ 「重新載入」掣,同 `ErrorRetry.tsx` 嘅視覺風格一致。緣起：Cowork code review 揪出呢個缺口,連埋 `get_pending_otp` RPC 保安漏動、主頁「唔識就撳我」永久 disabled stub 一齊記低咗（後兩樣未修,見 project memory `ai-elder-app-audit-2026-08-29.md`,需要 Stephanie 拍板先郁）。196 個測試（含新增 2 個）、`tsc -b`、`oxlint`、`vite build` 全部行過、全綠。

- 2026-08-01（承 07-31 制度複檢）：**`scripts/github_push.py` 修靜默故障** — 舊版 `_PUSH_STATE_DIR` 用 `os.path.dirname(REPO)` 當 stephanie-personal 係隔籬 folder；04-MAINTENANCE §6 將 5 個 repo 搬出 Drive Mirror 後假設崩咗，`makedirs` 靜靜咁喺 `~/Desktop/dev`、`~/dev`、`daily-novel/` 開咗 3 個假 stephanie-personal，concurrent-push 偵測對 6 個 repo 死咗都冇人知（真 state 檔停留喺 7/26–7/30）。改為 `STEPHANIE_PERSONAL_DIR` 環境變數 → Drive 正本絕對路徑 → legacy sibling 三段 resolve，搵唔到就**唔寫兼出聲**（S5「死咗邊個會知」）。12 份 script 一齊改，py_compile 全過，sales-trainer 實跑驗證真 state 有更新。假 folder 已收入 `_to_delete/`。

- 2026-07-31：`.gitignore` 加 `*.bak-*` 第二道防線 — 配合 06-STANDARDS §S3「備份一律開喺 `_to_delete/`」，就算漏咗 mv 都唔會畀 `github_push.py` 誤推上 GitHub（2026-07-25 事故嘅根治）。本 repo 冇 governance `backups/`，所以唔需要 negation 例外。

- 2026-07-31：repo 搬出 Google Drive Mirror，新位置 `~/Desktop/dev/AI for elderly`。原因：node_modules 嘅 npm `.bin` symlink 令 Drive 持續報 sync error。換機唔再靠 Drive 帶 secrets，詳見 `stephanie-personal/docs/NEW-MACHINE-SETUP.md` §9。

> 改動記錄出口：新條目一律插喺呢個檔案頂部。CLAUDE.md 只放路由同現行規則。Plan1–5 開發史詳情 → `README.md` + `docs/superpowers/plans/*.md`（唔喺度重複）。

## 2026-07-31 CLAUDE.md ⚙️ Standards block 事實更正（Opus 5 制度複檢連帶）

- `governance 00–05（派 subagent 先讀 01+03…）` → `governance 00–06（派工跟 01 §1 門檻表，要派先抄 03 模板…）`。
- 原因：06-STANDARDS.md 2026-07-18 已加入但 router 行仲寫 00–05；「先讀 01+03」2026-07-31 鬆綁（為派一個 agent 先燒 230 行本身就係 context 稅）。正本改動見 stephanie-personal CHANGELOG 同日條目。

## 2026-07-25 CLAUDE.md 瘦身（跟 Anthropic《new rules of context engineering for Claude 5》）

- **原則**：CLAUDE.md 要輕，token 主力花喺 **gotchas**（模型預設判斷會做相反嘅嘢），能推斷／已寫喺 spec 嘅嘢一律唔好抄多次。
- **本次**：5375 → 3889 bytes（52 → 36 行，−27%）。「架構」段夾住嘅改動史（Vercel 07-19 改名經過、portfolio section 07-19 轉正）刪走——嗰啲屬 CHANGELOG；UI 鐵律嘅 22px 例外由 5 行濃縮做 2 行；「registry 登記狀態待核實」查實咗（已登記）順手清走。
- **刻意保留（唔准當廢話刪）**：所有「反直覺」規則同「有 reason 嘅決定」——刪咗下個 session 一定會做錯。改前版本 → `_to_delete/CLAUDE.md.bak-20260725`。
- **背景**：同日 audit 咗全部 14 份 CLAUDE.md，結論係**其餘 11 份唔使大改**（全部已喺 100 行/6KB 內，整體只慳 ~27%，唔值得冒刪錯 gotcha 嘅險）。只做呢 3 份高收益嘅。

## 2026-07-25 `.active-session.lock*` 冇入 .gitignore → session 鎖檔一直推上 GitHub

- **問題**：`session-lock.sh` 喺每個 repo 根寫 `.active-session.lock`；release 嗰陣 Drive mount `rm` 唔到（device bridge 冇 rm 權限），會 fallback 改名做 `.active-session.lock.DELETE-ME-<epoch>`。兩種檔全部 repo 都**冇入 `.gitignore`**，所以 `github_push.py` 照推——最舊一個殘留檔 timestamp 係 **2026-07-14**，即係呢個洩漏行咗成十日。
- **修**：12 個 repo（含 `novel-web`）`.gitignore` 全部加 `.active-session.lock*`（一條 pattern 蓋埋活鎖同 `.DELETE-ME-*`）；現存 16 個殘留檔 mv 入各自 `_to_delete/`。
- **同類第三宗**：同日先修咗 ①`_to_delete/` 冇入 ignore、②`.bak-*` 冇入回收筒，今次係 ③鎖檔。三宗共通根因＝**新產生嘅暫存檔冇人幫佢配 ignore rule**。
- ⚠️ **未做（要 Stephanie 拍板）**：真正治本係改 `session-lock.sh`，唔好將鎖寫入 repo 樹，改寫去 `stephanie-personal/scripts/.session-locks/<repo>.lock` 集中管——咁就冇檔會落 repo，亦唔使靠 12 份 `.gitignore` 各自記得。

## 2026-07-25 `_to_delete/` 冇入 .gitignore → 回收筒檔案推咗上 GitHub（修）

- **問題**：全局規則係「清理檔案一律 mv 去 `_to_delete/`」，但本 repo `.gitignore` 冇 `_to_delete/` 一行。`github_push.py` 嘅 `working_files()` 用 `git ls-files -c -o --exclude-standard`，`--exclude-standard` 只擋 .gitignore 有列嘅嘢——冇列就當普通未追蹤檔照上傳。GitHub Git Trees API 核實 remote `main`：**實際有 1 個（`_to_delete/CLAUDE.md.bak-20260719`）**。
- **修**：`.gitignore` 加 `_to_delete/`。下次 push，`working_files()` 唔再列佢 → `deletions = [p for p in remote if p not in local_set]` 會用 `sha: None` 自動由 remote 樹刪走，唔使（亦唔准）動用 git CLI `rm --cached`。
- **範圍**：同一 session 掃晒 11 個 repo，6 個中招（AI for elderly／stephanie-portfolio／xuanli／catnu-app／MakeMyHome／fable-prompt），一次過全部補。原本已有嘅 5 個：Travel App／daily-novel／sales-trainer／stephanie-personal／venturenix-lab-seminar。
- ⚠️ **只由 HEAD 移除，舊 commit 歷史仍然有**。已 grep 過全部內容，冇 token／secret **值**（只有變數名如 `GITHUB_TOKEN` 出現喺說明文字），本 repo 為 **public**，判斷唔需要 rewrite history。

## 2026-07-25 DeepSeek 官方停用 deepseek-chat → scripts/generate_lessons.py 換 deepseek-v4-flash

- **背景**：DeepSeek 官方 2026-07-24 停用舊 model 名 `deepseek-chat`/`deepseek-reasoner`，迎代 `deepseek-v4-flash`/`deepseek-v4-pro`；跨 5 個 repo 掃描發現本 repo `scripts/generate_lessons.py`（課堂內容生成管道）仲用緊已死嘅 `deepseek-chat`。
- **修**：`call_deepseek()` 個 request body 換做 `"model": "deepseek-v4-flash"` + `"thinking": {"type": "disabled"}`（新 model 預設開 thinking mode，會加時間/成本，加呢個 key 保持原本非thinking快速生成行為）。
- **驗證**：`py_compile` 過；真 Mac + 真 API key 實測同一個 request 格式（curl 式呼叫）：status=200、回覆正常、`reasoning_content` 為空確認 thinking 已關。⚠️ 未做：`pytest scripts/test_generate_lessons.py`（Cowork sandbox 冇 pytest 亦冇網絡裝，未跑）——純 model 名替換無邏輯改動，風險低，但建議下次本機 session 補跑一次單元測試。
- **檔案**：`scripts/generate_lessons.py`。

## 2026-07-19 Code review 🟡🟢 三單一齊補（admin/app.py 名不副實、speech.ts Mandarin 誤選、App.tsx 錯誤訊息重複字）

- **背景**：跟第一輪 🔴 review 之後，用家要求「做埋🟡同🟢之後再重新check一次」。
- **Fix 1（🟡 `admin/app.py` 頁面同 code 都仲用緊已經廢咗嘅「pending審批」語言）**：今日先拍板取消 approve gate（見上面果條 changelog entry），但 `admin/app.py` 個 `fetch_pending_lessons()` 函數名、filter（`status: eq.pending`）、頁面標題/按鈕（「✅ Approve」「❌ Reject（刪除）」）全部都仲喺講緊審批流程，同已改做「事後補救」嘅實際角色唔夾。改做 `fetch_published_lessons()`／filter `status: eq.published`／按鈕改「💾 儲存修改」「🗑 落架（刪除）」，配返 `generate_lessons.py` docstring 講嘅「retroactive view/edit/unpublish」定位。
- **Fix 2（🟡 `speech.ts` 揀 TTS 聲會誤中 Mandarin）**：`findCantoneseVoice()` 最尾行 fallback `voices.find(v => v.lang.startsWith('zh'))` 會喺得返 zh-CN Mandarin voice、冇 yue-HK/zh-HK 嘅情況下錯揀，令廣東話 app 讀出普通話。拎走呢個 fallback，冇match就跌落瀏覽器default，唔再夾硬揀錯語言。新增test case：Mandarin-only voice list 唔會俾夾硬選中，`utterance.lang` 留返 `'zh-HK'`。
- **Fix 3（🟢 `App.tsx` lessonsError 訊息重複前綴）**：`ElderShell` 嘅 `lessonsError` 分支之前再加多次「攞唔到課堂內容：」做前綴，但 `useLessons.ts` 拋出嚟嘅 error 本身已經係完整訊息，用家會見到「攞唔到課堂內容：攞唔到課堂內容」重複顯示。跟返 `progressError` 分支寫法，直接顯示 error 本身。同步改咗 `App.test.tsx` 個原本斷言緊舊前綴文字、mock 咗一個唔相關字串嘅測試，換做真實 error 字串 + 斷言啱好出現一次、冇重複。
- **驗證**：Python 兩個檔（`admin/app.py`、`generate_lessons.py`）過 `py_compile`。TypeScript 三個檔喺真 Mac 用 `npx vitest run` 跑咗：`speech.test.ts`（4 過）＋`App.test.tsx`（16 過）＝針對性 20/20 過；順手跑埋成個 app 嘅全套 vitest（28 test files，194 tests）冇任何regression。
- **檔案**：`admin/app.py`、`app/src/lib/speech.ts`、`app/src/lib/speech.test.ts`、`app/src/App.tsx`、`app/src/App.test.tsx`、`scripts/generate_lessons.py`（log 字眼配合今日政策改變同步修）。

## 2026-07-19 政策改變：內容出街唔再需要人手 approve + 進度頁面加撳掣

- **Stephanie 拍板取消「AI 生成 draft → 人手 approve → 出街」呢條由 Plan3 開始鎖定嘅硬規矩**：佢話信得過 DeepSeek 嘅生成質素，唔想再逐課撳approve。`scripts/generate_lessons.py` 由寫入 `status='pending'` 改做直接 `status='published'`，`admin/app.py`（Streamlit）保留但改做事後補救（睇/edit/unpublish），唔再係出街前必經gate。同步更新咗 `README.md`／`CLAUDE.md`／`AI-elder-app-SPEC.md` §6 三份文件嘅locked decision，`scripts/test_generate_lessons.py` 對應assertion都改咗，9個pytest全過。
  - 呢個係一個**刻意、明確拍板嘅政策逆轉**，唔係我自己加嘅假設——原本呢條規喺三份文件都寫到明「嚴禁全自動」，執行前已經同Stephanie核實過先做。
- 「我嘅進度」頁面：撳每一層嘅進度卡而家會帶去「上堂」課堂清單（原本淨係睇下唔撳得），純CSS/JSX改動，`ProgressScreen`嘅layer卡由`<div>`改做`<button>`。185個測試、build、lint全綠。
- 順手正式寫低一個之前已經有先例但未formalize嘅UI規例例外：裝飾性/品牌chrome文字（Gemini demo header、`.comment-author`）可以細過鎖定嘅22px最細字，正文/按鈕/選項唔受呢個例外影響。

## 2026-07-19 上線 — portfolio elder section 轉正

Stephanie 確認 app ready，`stephanie-portfolio` elder section 由「◌ 籌備中」轉「● 運作中」，links-row 加咗 `$ open app →`（`https://ai-elder-app.vercel.app`）。詳細改動見 stephanie-portfolio CHANGELOG「elder section 轉正」條目；本檔＋CLAUDE.md「部署」段同步補生產網址。

## 2026-07-19 Lesson Demo — 真App參考（Google Gemini）+ Vercel 改名/重新 deploy

- Stephanie review live app 後提出：12課demo step一直得抽象chat泡泡，冇教長者實際用邊個app、
  個app長咩樣，亦冇明確叫佢哋去裝邊個免費app。
- 揀咗 Google Gemini（理由：唔使VPN、Android機好多時已預裝）。用 brainstorming + 視覺化
  companion 傾清楚方向：風格化重現（code畫，唔係真screenshot，避免Gemini改版要重影）。
- `LessonScreen.tsx`：全部demo step而家包咗Gemini品牌外殼（gradient頂bar、輸入框mock，
  加咗`aria-hidden`因為個mock input對長者嚟講會似真嘅可以撳）；第一課（layer1/number1）
  加多張「去裝Gemini」卡，連去已核實嘅真Play Store/App Store連結，識分Android/iOS，
  仲修好現代iPad（iPadOS 13+）UA冇「iPad」字眼嗰個偵測漏洞。
- Landing page「送給父母」步驟加多句提子女順手幫手裝埋Gemini app。
- 182個測試、`tsc -b`、lint、build全綠；push前用Playwright對住真dev server行完成一次
  第一課vs第二課嘅對照，確認個卡淨係第一課先出。詳細計劃見
  `docs/superpowers/plans/2026-07-19-gemini-app-demo.md`。
- 順手將Vercel project由「app」改名做「ai-elder-app」，正式公開網址變咗
  `https://ai-elder-app.vercel.app`；landing page獨立project「ai-elder-landing」都
  一齊re-deploy埋。

## 2026-07-19 Error/Retry-Shape Consolidation（獨立於 Plan1–5 之外嘅 follow-up）+ 重新 deploy

- 統一 `lib/*.ts` 錯誤處理：全部改做拋帶廣東話訊息嘅 `Error`；新增 `useAsyncData`／`useAsyncAction`
  共用 hook 取代 8 個檔案各自手寫嘅 busy/error/try-catch；新增 `<ErrorRetry>` 共用 component。
- 修好兩個真 bug：`progressApi.ts` 拋緊 raw Supabase error object（令 `err instanceof Error`
  判斷永遠行 fallback，真訊息俾吞咗）；完成課堂／切換家人分享失敗之前完全靜默冇反應。
- Live walkthrough 揪到單元測試冚唔到嘅第三個 bug：網絡真斷咗嗰陣，`error.message` 會係原始英文
  exception 文字，漏咗英文畀長者睇——已修好一半（`toFriendlyMessage` 唔再信 native exception），
  剩返幾個 lib 檔案仲信 Supabase 自己個 `error.message`，留咗做 follow-up（記喺 project memory）。
- 170 個測試、`tsc -b`、lint、build 全綠；push 前用 Playwright 對住真 dev server + 真 Supabase
  行完成一次登入→完成課堂→切換家人分享嘅完整 flow。詳細計劃見
  `docs/superpowers/plans/2026-07-18-error-retry-consolidation.md`。
- 順手發現 PWA 原來已經有 Vercel deployment（`https://app-delta-two-31.vercel.app`，之前冇記錄喺
  README），今次改動完之後重新 deploy 咗最新 code 上去。

## 2026-07-18 首次建立 CLAUDE.md（開檔呢份 CHANGELOG）

- 本 repo 之前冇 CLAUDE.md——今日由零建立：一句定位、README/SPEC single source of truth 路由、架構表（app／admin／supabase／scripts）、已鎖定決定摘要（SPEC §2 等）、DoD（pytest／瀏覽器實開／嚴禁跳過人手 approve／push 核實）、⚙️ Standards block。
- 事實來源限定 README.md + AI-elder-app-SPEC.md，冇作新規則；build/dev 指令未有記錄 → 標（待核實）。
- 現況：Plan1–5 全部完成（見 README）；下一步 deploy landing page（domain 未拍板）。
