import { supabase } from './supabaseClient';
import { looksLikeAuthoredMessage } from './errors';

// All three functions below throw on failure — callers (PairingScreen.tsx, FamilyScreen.tsx,
// FamilyFlow in App.tsx) must wrap calls in try/catch or .catch(). fetchFamilyLink returns null
// only for the genuine "not paired yet" steady state (no row in elder_family_links) — a query
// error on either of its two lookups throws instead, so callers can tell "not paired" apart from
// "couldn't check" and don't misreport a real DB/network failure as an invitation to re-pair.

export async function createPairingCode(): Promise<string> {
  const { data, error } = await supabase.rpc('create_pairing_code');
  if (error || !data) throw new Error('攞唔到配對碼，請再試');
  return data as string;
}

export async function redeemPairingCode(
  code: string,
): Promise<{ elderUserId: string; elderDisplayName: string | null }> {
  const { data, error } = await supabase.rpc('redeem_pairing_code', { p_code: code });
  // redeem_pairing_code raises genuine Cantonese business exceptions worth showing verbatim
  // (e.g. "配對碼過期") — but error.message is also where a network failure gets a stringified
  // native exception stuffed in (e.g. "TypeError: Failed to fetch"), which must not leak to the
  // user. looksLikeAuthoredMessage's CJK heuristic tells the two apart (see lib/errors.ts).
  if (error) throw new Error(looksLikeAuthoredMessage(error.message) ? error.message : '配對失敗，請再試');
  const rows = data as { elder_user_id: string; elder_display_name: string | null }[];
  const row = rows?.[0];
  // The RPC succeeding with zero rows means the link WAS created (redeem_pairing_code already
  // inserted into elder_family_links) but the trailing elder_profiles lookup came back empty —
  // e.g. createPairingCode() was called before ensureProfile() ran. This is distinct from "wrong
  // code" (which the DB itself rejects via a raised exception, caught above as `error`), so it
  // must not share that message or a successfully-paired user gets told pairing failed.
  if (!row) throw new Error('配對成功，但攞唔到長者資料');
  return { elderUserId: row.elder_user_id, elderDisplayName: row.elder_display_name };
}

export async function fetchFamilyLink(
  familyUserId: string,
): Promise<{ elderUserId: string; elderDisplayName: string | null } | null> {
  const { data: link, error: linkError } = await supabase
    .from('elder_family_links')
    .select('elder_user_id')
    .eq('family_user_id', familyUserId)
    .maybeSingle();
  // Generic queries, no custom RPC business message — never trust error.message verbatim
  // (could be a stringified native exception on a network failure, see lib/errors.ts).
  if (linkError) throw new Error('攞唔到配對狀態，請再試');
  if (!link) return null;

  const { data: profile, error: profileError } = await supabase
    .from('elder_profiles')
    .select('display_name')
    .eq('user_id', link.elder_user_id)
    .maybeSingle();
  if (profileError) throw new Error('攞唔到長者資料，請再試');

  return { elderUserId: link.elder_user_id, elderDisplayName: profile?.display_name ?? null };
}
