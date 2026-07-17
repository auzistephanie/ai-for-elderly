import { supabase } from './supabaseClient';

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
  if (!row) throw new Error('配對碼錯誤');
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
