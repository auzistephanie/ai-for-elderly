import { toFriendlyMessage, looksLikeAuthoredMessage } from './errors';

describe('toFriendlyMessage', () => {
  it('returns the Error message when given a real Error with a message', () => {
    expect(toFriendlyMessage(new Error('攞唔到進度，請再試'), '發生錯誤，請再試')).toBe('攞唔到進度，請再試');
  });

  it('returns the fallback when given a non-Error value', () => {
    expect(toFriendlyMessage({ message: 'raw supabase error' }, '發生錯誤，請再試')).toBe('發生錯誤，請再試');
  });

  it('returns the fallback when given an Error with an empty message', () => {
    expect(toFriendlyMessage(new Error(''), '發生錯誤，請再試')).toBe('發生錯誤，請再試');
  });

  it('returns the fallback for a thrown string', () => {
    expect(toFriendlyMessage('boom', '發生錯誤，請再試')).toBe('發生錯誤，請再試');
  });

  it('returns the fallback for a native runtime exception (e.g. a failed fetch), not its raw English message', () => {
    // fetch() rejects with a TypeError on network failure — this is not a plain `new Error(...)`
    // our own lib functions throw, so its message ("Failed to fetch") must never reach the user.
    expect(toFriendlyMessage(new TypeError('Failed to fetch'), '發生錯誤，請再試')).toBe('發生錯誤，請再試');
  });
});

describe('looksLikeAuthoredMessage', () => {
  it('returns true for a Cantonese business message raised by one of this app\'s own RPCs', () => {
    expect(looksLikeAuthoredMessage('配對碼過期')).toBe(true);
  });

  it('returns false for a stringified native exception (network failure noise)', () => {
    expect(looksLikeAuthoredMessage('TypeError: Failed to fetch')).toBe(false);
  });

  it('returns false for a generic English Postgrest/network error message', () => {
    expect(looksLikeAuthoredMessage('Failed to fetch')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(looksLikeAuthoredMessage('')).toBe(false);
  });
});
