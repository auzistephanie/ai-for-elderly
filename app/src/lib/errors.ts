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
