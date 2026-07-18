import { supabase } from './supabaseClient';

export async function logLessonStart(userId: string, lessonId: string): Promise<void> {
  const { error } = await supabase.from('elder_lesson_starts').insert({ user_id: userId, lesson_id: lessonId });
  if (error) throw new Error(error.message);
}
