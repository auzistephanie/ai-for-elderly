import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Lesson } from '../types/lesson';

export function useLessons() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by reload() to re-run the effect below in isolation — this must stay local to this
  // hook (not a `key` remount at the call site) so retrying a failed lessons fetch never
  // disturbs sibling state such as useProgress's streak/completion data.
  const [reloadToken, setReloadToken] = useState(0);

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
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { lessons, loaded, error, reload };
}
