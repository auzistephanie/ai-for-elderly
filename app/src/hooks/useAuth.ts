import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { UserRole } from '../types/auth';

export interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  userId: string | null;
  role: UserRole | null;
}

const initialState: AuthState = { status: 'loading', userId: null, role: null };

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let active = true;
    // Guards against a stale role fetch (started for an earlier session)
    // resolving after a later auth-state change and overwriting its result.
    let requestId = 0;

    async function resolve(userId: string) {
      const myRequestId = ++requestId;
      const { data } = await supabase
        .from('elder_profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active || myRequestId !== requestId) return;
      setState({ status: 'signed-in', userId, role: (data?.role as UserRole) ?? null });
    }

    function signOut() {
      // Invalidate any in-flight resolve() so it can't resurrect a stale session.
      requestId += 1;
      setState({ status: 'signed-out', userId: null, role: null });
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: { id: string } } | null } }) => {
      if (!active) return;
      if (session?.user) resolve(session.user.id);
      else signOut();
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: { id: string } } | null) => {
        if (session?.user) resolve(session.user.id);
        else signOut();
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
