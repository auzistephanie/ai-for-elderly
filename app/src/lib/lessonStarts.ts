import { supabase } from './supabaseClient';

export async function logLessonStart(userId: string, lessonId: string): Promise<void> {
  const { error } = await supabase.from('elder_lesson_starts').insert({ user_id: userId, lesson_id: lessonId });
  // Generic query, no custom RPC business message — never trust error.message verbatim (see
  // lib/errors.ts). Doesn't actually matter for display today (LessonScreen swallows this
  // error silently), but kept consistent with every other lib/*.ts function's convention.
  if (error) throw new Error('課堂開始紀錄唔到');
}
