# CHANGELOG — AI老友記（AI for Elderly）

> 改動記錄出口：新條目一律插喺呢個檔案頂部。CLAUDE.md 只放路由同現行規則。Plan1–5 開發史詳情 → `README.md` + `docs/superpowers/plans/*.md`（唔喺度重複）。

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
