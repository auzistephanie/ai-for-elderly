import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Lesson } from '../types/lesson';

export function useLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from('elder_lessons')
      .select('id,layer,number,title,subtitle,steps')
      .eq('status', 'published')
      .order('layer', { ascending: true })
      .order('number', { ascending: true })
      .then(({ data, error }: { data: Lesson[] | null; error: unknown }) => {
        if (!active) return;
        if (error) {
          // Fetch failed — surface it instead of silently rendering as
          // "no lessons published yet", which would otherwise look identical.
          console.error('[useLessons] failed to load lessons:', error);
        }
        setLessons(data ?? []);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { lessons, loaded };
}
