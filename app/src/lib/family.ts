import { supabase } from './supabaseClient';

// All three functions below throw on failure — callers (PairingScreen.tsx, FamilyScreen.tsx)
// must wrap calls in try/catch. The one exception is fetchFamilyLink, which returns null for
// BOTH "not paired yet" and "query error" rather than throwing, since a missing link is an
// expected steady state, not a failure.

export async function createPairingCode(): Promise<string> {
  const { data, error } = await supabase.rpc('create_pairing_code');
  if (error || !data) throw new Error('攞唔到配對碼，請再試');
  return data as string;
}

export async function redeemPairingCode(
  code: string,
): Promise<{ elderUserId: string; elderDisplayName: string | null }> {
  const { data, error } = await supabase.rpc('redeem_pairing_code', { p_code: code });
  if (error) throw new Error(error.message);
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
  const { data: link } = await supabase
    .from('elder_family_links')
    .select('elder_user_id')
    .eq('family_user_id', familyUserId)
    .maybeSingle();
  if (!link) return null;

  const { data: profile } = await supabase
    .from('elder_profiles')
    .select('display_name')
    .eq('user_id', link.elder_user_id)
    .maybeSingle();

  return { elderUserId: link.elder_user_id, elderDisplayName: profile?.display_name ?? null };
}
