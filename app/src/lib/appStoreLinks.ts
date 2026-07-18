// Real, verified app-store URLs for the official Google Gemini app (checked 2026-07-19).
// The Android package id still says "bard" — a leftover from before the product was renamed
// Gemini — but the listing itself is the current official Gemini app; this is not a mistake.
const ANDROID = {
  url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
  label: '📲 去 Google Play 攞 Gemini',
};

const IOS = {
  url: 'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
  label: '📲 去 App Store 攞 Gemini',
};

export interface AppStoreInfo {
  url: string;
  label: string;
}

// Since iPadOS 13 (2019), Safari's default user-agent on iPad drops the "iPad" token entirely —
// a real modern iPad reports itself as a plain Mac ("Macintosh; Intel Mac OS X ..."), which is
// indistinguishable from an actual Mac by UA string alone. The standard workaround is to combine
// the UA check with `navigator.maxTouchPoints`: a Mac reports 0 touch points, while a modern iPad
// reports a positive number even though its UA looks like a Mac's. `maxTouchPoints` is passed in
// (rather than read from `navigator` here) so this function stays pure and easily testable.
export function getGeminiAppStoreInfo(userAgent: string, maxTouchPoints = 0): AppStoreInfo {
  const isModernIpad = /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(userAgent) || isModernIpad ? IOS : ANDROID;
}
