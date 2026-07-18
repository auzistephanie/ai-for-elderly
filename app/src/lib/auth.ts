import { supabase } from './supabaseClient';
import type { UserRole } from '../types/auth';

export function toE164(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  // Note: does not handle the `00852` international-dialing-prefix form — out of scope for now.
  if (digits.length > 8 && digits.startsWith('852')) return `+${digits}`;
  return `+852${digits}`;
}

export async function requestOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
  if (error) throw new Error('傳送失敗，check 下電話號碼啱唔啱');
}

export async function fetchDisplayedOtp(phone: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_pending_otp', { p_phone: toE164(phone) });
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'sms' });
  if (error) throw new Error('驗證失敗，撳返去重新傳送');
}

export async function ensureProfile(chosenRole: UserRole, displayName: string): Promise<UserRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { data: existing } = await supabase
    .from('elder_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return existing.role as UserRole;

  const { error: insertError } = await supabase
    .from('elder_profiles')
    .insert({ user_id: user.id, role: chosenRole, display_name: displayName });
  if (insertError) throw new Error(insertError.message);
  return chosenRole;
}
