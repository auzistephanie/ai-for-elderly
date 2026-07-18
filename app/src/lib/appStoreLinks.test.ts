import { getGeminiAppStoreInfo } from './appStoreLinks';

describe('getGeminiAppStoreInfo', () => {
  it('returns the iOS App Store link+label for an iPhone user agent', () => {
    expect(getGeminiAppStoreInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)')).toEqual({
      url: 'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
      label: '📲 去 App Store 攞 Gemini',
    });
  });

  it('returns the iOS App Store link+label for an iPad user agent', () => {
    expect(getGeminiAppStoreInfo('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)').url).toBe(
      'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
    );
  });

  it('returns the Android Play Store link+label for an Android user agent', () => {
    expect(getGeminiAppStoreInfo('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toEqual({
      url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
      label: '📲 去 Google Play 攞 Gemini',
    });
  });

  it('defaults to the Android link for an unrecognized user agent', () => {
    expect(getGeminiAppStoreInfo('some-unknown-agent').url).toBe(
      'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
    );
  });

  it('returns the iOS App Store link for a modern iPad (Mac-like UA + multiple touch points)', () => {
    // Since iPadOS 13, Safari's default UA has no "iPad" token at all — it looks like a Mac's.
    // maxTouchPoints > 1 is the standard secondary signal to tell a real iPad apart from a Mac.
    const macLikeIpadUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
    expect(getGeminiAppStoreInfo(macLikeIpadUA, 5).url).toBe(
      'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
    );
  });

  it('treats a Mac-like UA with no/low touch points as a real Mac, not an iPad (defaults to Android link)', () => {
    const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
    expect(getGeminiAppStoreInfo(macUA, 0).url).toBe(
      'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
    );
  });

  it('matches user agent tokens case-insensitively', () => {
    expect(getGeminiAppStoreInfo('mozilla/5.0 (iphone; cpu iphone os 17_4)').url).toBe(
      'https://apps.apple.com/us/app/gemini-chat-with-ai-app/id6477489729',
    );
  });
});
