import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { useAuth } from './useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('reports signed-out when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const { result } = renderHook(() => useAuth());
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('signed-out'));
    expect(result.current.userId).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it('resolves the role from elder_profiles when a session exists', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'elder' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe('signed-in'));
    expect(result.current.userId).toBe('u1');
    expect(result.current.role).toBe('elder');
  });

  it('does not let a stale role fetch overwrite a later sign-out', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });

    let resolveMaybeSingle: (value: { data: { role: string } | null }) => void = () => {};
    const maybeSingle = vi.fn(
      () => new Promise((resolvePromise) => { resolveMaybeSingle = resolvePromise; }),
    );
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    let authStateCallback: ((event: string, session: unknown) => void) | null = null;
    onAuthStateChangeMock.mockImplementation((cb: (event: string, session: unknown) => void) => {
      authStateCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth());

    // Wait until the initial getSession() resolution has kicked off the role fetch for u1.
    await waitFor(() => expect(fromMock).toHaveBeenCalled());

    // A sign-out event arrives while the u1 role fetch is still in flight.
    authStateCallback?.('SIGNED_OUT', null);
    await waitFor(() => expect(result.current.status).toBe('signed-out'));

    // The stale u1 role fetch now resolves — it must not resurrect signed-in state.
    resolveMaybeSingle({ data: { role: 'elder' } });
    await new Promise((r) => setTimeout(r, 20));

    expect(result.current.status).toBe('signed-out');
    expect(result.current.userId).toBeNull();
  });
});
