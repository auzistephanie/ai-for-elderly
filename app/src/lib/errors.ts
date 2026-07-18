// Only trusts a plain `new Error('...')` — the shape every lib/*.ts function in this codebase
// uses when it deliberately throws a ready-to-display Cantonese message. Native runtime
// exceptions (TypeError from a failed fetch(), SyntaxError from bad JSON, etc.) are NOT plain
// Error instances (their constructor is TypeError/SyntaxError/...), so they fall through to the
// fallback instead of leaking raw English text like "TypeError: Failed to fetch" to the user —
// found live while testing this app offline, not caught by any mocked unit test.
export function toFriendlyMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.constructor === Error && err.message) return err.message;
  return fallback;
}

// Some Supabase RPC calls (e.g. redeem_pairing_code) can raise a genuine, deliberately-authored
// Cantonese business message ("配對碼過期") that's worth showing verbatim — but the exact same
// error.message field is also where Supabase silently stuffs a stringified native exception
// ("TypeError: Failed to fetch") when the network call itself fails, which must NOT reach the
// user. Both arrive as plain strings with no reliable structural marker to tell them apart, but
// every business message this app's own RPCs raise is Cantonese (this app is Cantonese-first by
// design), while a network failure's stringified exception is always English/Latin script. This
// is a heuristic, not a guarantee (a handful of this app's own RPC exceptions are also plain
// English, e.g. "not authenticated" — those fall back to the generic message too, which is an
// acceptable trade since they were already showing as unhelpful raw text before this existed).
const CJK_PATTERN = /[一-鿿]/;

export function looksLikeAuthoredMessage(message: string): boolean {
  return CJK_PATTERN.test(message);
}
