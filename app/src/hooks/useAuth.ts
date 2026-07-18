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
      requestId += 1;
      const myRequestId = requestId;
      const { data, error } = await supabase
        .from('elder_profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active || myRequestId !== requestId) return;
      // A query error is treated the same as "no role row yet" rather than a separate error
      // state — App.tsx already renders a full error+retry screen whenever role is null
      // (it can't tell "signup didn't finish" from "the lookup itself failed", and doesn't
      // need to: both cases dead-end the same way, "attempt again").
      setState({ status: 'signed-in', userId, role: error ? null : ((data?.role as UserRole) ?? null) });
    }

    function clearSession() {
      // Invalidate any in-flight resolve() so it can't resurrect a stale session.
      requestId += 1;
      setState({ status: 'signed-out', userId: null, role: null });
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: { id: string } } | null } }) => {
      if (!active) return;
      if (session?.user) resolve(session.user.id);
      else clearSession();
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: { id: string } } | null) => {
        if (session?.user) resolve(session.user.id);
        else clearSession();
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
