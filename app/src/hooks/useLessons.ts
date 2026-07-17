import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Lesson } from '../types/lesson';

export function useLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('elder_lessons')
      .select('id,layer,number,title,subtitle,steps')
      .eq('status', 'published')
      .order('layer', { ascending: true })
      .order('number', { ascending: true })
      .then(({ data, error: fetchError }: { data: Lesson[] | null; error: { message?: string } | null }) => {
        if (!active) return;
        // A fetch failure must stay distinguishable from "genuinely zero
        // published lessons" — both would otherwise resolve to an empty
        // array and look identical to the consumer.
        setError(fetchError ? (fetchError.message ?? '攞唔到課堂內容') : null);
        setLessons(data ?? []);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { lessons, loaded, error };
}
