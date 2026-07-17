import { vi } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { createPairingCode, redeemPairingCode, fetchFamilyLink } from './family';

describe('createPairingCode', () => {
  it('returns the code from the RPC', async () => {
    rpcMock.mockResolvedValue({ data: '384920', error: null });
    const code = await createPairingCode();
    expect(rpcMock).toHaveBeenCalledWith('create_pairing_code');
    expect(code).toBe('384920');
  });

  it('throws with a friendly message on error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'db error' } });
    await expect(createPairingCode()).rejects.toThrow('攞唔到配對碼，請再試');
  });
});

describe('redeemPairingCode', () => {
  it('returns the elder info on success', async () => {
    rpcMock.mockResolvedValue({ data: [{ elder_user_id: 'e1', elder_display_name: '陳生' }], error: null });
    const result = await redeemPairingCode('384920');
    expect(rpcMock).toHaveBeenCalledWith('redeem_pairing_code', { p_code: '384920' });
    expect(result).toEqual({ elderUserId: 'e1', elderDisplayName: '陳生' });
  });

  it('throws the database error message on failure', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: '配對碼過期' } });
    await expect(redeemPairingCode('000000')).rejects.toThrow('配對碼過期');
  });

  it('throws a friendly message when the RPC succeeds but returns no rows', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(redeemPairingCode('384920')).rejects.toThrow('配對碼錯誤');
  });
});

describe('fetchFamilyLink', () => {
  it('returns null when no link exists yet', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    fromMock.mockReturnValue({ select });

    expect(await fetchFamilyLink('fam1')).toBeNull();
  });

  it('returns the elder user id and display name when a link exists', async () => {
    const linkMaybeSingle = vi.fn().mockResolvedValue({ data: { elder_user_id: 'e1' } });
    const linkEq = vi.fn(() => ({ maybeSingle: linkMaybeSingle }));
    const linkSelect = vi.fn(() => ({ eq: linkEq }));

    const profileMaybeSingle = vi.fn().mockResolvedValue({ data: { display_name: '陳生' } });
    const profileEq = vi.fn(() => ({ maybeSingle: profileMaybeSingle }));
    const profileSelect = vi.fn(() => ({ eq: profileEq }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'elder_family_links') return { select: linkSelect };
      if (table === 'elder_profiles') return { select: profileSelect };
      throw new Error(`unexpected table ${table}`);
    });

    expect(await fetchFamilyLink('fam1')).toEqual({ elderUserId: 'e1', elderDisplayName: '陳生' });
  });
});
