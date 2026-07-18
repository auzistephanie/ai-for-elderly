# CHANGELOG — AI老友記（AI for Elderly）

> 改動記錄出口：新條目一律插喺呢個檔案頂部。CLAUDE.md 只放路由同現行規則。Plan1–5 開發史詳情 → `README.md` + `docs/superpowers/plans/*.md`（唔喺度重複）。

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
