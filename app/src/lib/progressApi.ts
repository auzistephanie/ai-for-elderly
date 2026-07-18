import { supabase } from './supabaseClient';

export interface RemoteProgress {
  completedLessonIds: string[];
  streakCount: number;
  lastActiveDate: string | null;
  familyShareEnabled: boolean;
}

export async function fetchProgress(userId: string): Promise<RemoteProgress> {
  const [
    { data: completions, error: completionsError },
    { data: streak, error: streakError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase.from('elder_lesson_completions').select('lesson_id').eq('user_id', userId),
    supabase.from('elder_streaks').select('streak_count,last_active_date').eq('user_id', userId).maybeSingle(),
    supabase.from('elder_profiles').select('family_share_enabled').eq('user_id', userId).maybeSingle(),
  ]);

  if (completionsError) throw new Error('攞唔到進度，請再試');
  if (streakError) throw new Error('攞唔到進度，請再試');
  if (profileError) throw new Error('攞唔到進度，請再試');

  return {
    completedLessonIds: (completions ?? []).map((row: { lesson_id: string }) => row.lesson_id),
    streakCount: streak?.streak_count ?? 0,
    lastActiveDate: streak?.last_active_date ?? null,
    familyShareEnabled: profile?.family_share_enabled ?? true,
  };
}

export async function markLessonCompleted(userId: string, lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('elder_lesson_completions')
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true });

  if (error) throw new Error('完成課堂紀錄唔到，請再試');
}

export async function touchStreak(
  userId: string,
  today: string,
  calcStreak: (lastActiveDate: string | null, today: string, prevCount: number) => number,
): Promise<{ streakCount: number; lastActiveDate: string }> {
  const { data: existing } = await supabase
    .from('elder_streaks')
    .select('streak_count,last_active_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.last_active_date === today) {
    return { streakCount: existing.streak_count, lastActiveDate: today };
  }

  const nextCount = calcStreak(existing?.last_active_date ?? null, today, existing?.streak_count ?? 0);
  const { error } = await supabase
    .from('elder_streaks')
    .upsert({ user_id: userId, streak_count: nextCount, last_active_date: today, updated_at: new Date().toISOString() });

  if (error) throw new Error('攞唔到進度，請再試');

  return { streakCount: nextCount, lastActiveDate: today };
}

export async function setFamilyShareEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('elder_profiles').update({ family_share_enabled: enabled }).eq('user_id', userId);

  if (error) throw new Error('設定失敗，請再試');
}
