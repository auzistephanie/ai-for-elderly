import { useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAsyncData } from './useAsyncData';
import type { Lesson } from '../types/lesson';

export function useLessons() {
  const fetcher = useCallback(async () => {
    const { data, error } = await supabase
      .from('elder_lessons')
      .select('id,layer,number,title,subtitle,steps')
      .eq('status', 'published')
      .order('layer', { ascending: true })
      .order('number', { ascending: true });
    if (error) throw new Error(error.message ?? '攞唔到課堂內容');
    return (data ?? []) as Lesson[];
  }, []);

  const { data, error, loaded, reload } = useAsyncData<Lesson[]>(fetcher, [], '攞唔到課堂內容');

  return { lessons: data ?? [], loaded, error, reload };
}
