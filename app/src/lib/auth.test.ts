import { vi } from 'vitest';

const rpcMock = vi.fn();
const signInWithOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { toE164, requestOtp, fetchDisplayedOtp, verifyOtp, ensureProfile } from './auth';

describe('toE164', () => {
  it('prepends +852 to a bare 8-digit HK number', () => {
    expect(toE164('91234567')).toBe('+85291234567');
  });

  it('leaves an already-international number untouched', () => {
    expect(toE164('+85291234567')).toBe('+85291234567');
  });

  it('strips spaces before normalizing', () => {
    expect(toE164('9123 4567')).toBe('+85291234567');
  });

  it('prepends +852 to an 8-digit number that happens to start with 852', () => {
    expect(toE164('85212345')).toBe('+85285212345');
  });
});

describe('requestOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls signInWithOtp with the normalized phone on success', async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    await requestOtp('91234567');
    expect(signInWithOtpMock).toHaveBeenCalledWith({ phone: '+85291234567' });
  });

  it('throws a friendly message on failure', async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: 'boom' } });
    await expect(requestOtp('91234567')).rejects.toThrow('傳送失敗，check 下電話號碼啱唔啱');
  });
});

describe('fetchDisplayedOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the code from the RPC', async () => {
    rpcMock.mockResolvedValue({ data: '561166', error: null });
    const code = await fetchDisplayedOtp('91234567');
    expect(rpcMock).toHaveBeenCalledWith('get_pending_otp', { p_phone: '+85291234567' });
    expect(code).toBe('561166');
  });

  it('returns null on error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await fetchDisplayedOtp('91234567')).toBeNull();
  });
});

describe('verifyOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls supabase verifyOtp with the sms type on success', async () => {
    verifyOtpMock.mockResolvedValue({ error: null });
    await verifyOtp('91234567', '561166');
    expect(verifyOtpMock).toHaveBeenCalledWith({ phone: '+85291234567', token: '561166', type: 'sms' });
  });

  it('throws a friendly message on failure', async () => {
    verifyOtpMock.mockResolvedValue({ error: { message: 'boom' } });
    await expect(verifyOtp('91234567', '561166')).rejects.toThrow('驗證失敗，撳返去重新傳送');
  });
});

describe('ensureProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing role without inserting if a profile already exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'family' } });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn();
    fromMock.mockReturnValue({ select, insert });

    const role = await ensureProfile('elder', '陳生');
    expect(role).toBe('family');
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a new profile with the chosen role and display name when none exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ select, insert });

    const role = await ensureProfile('elder', '陳生');
    expect(role).toBe('elder');
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', role: 'elder', display_name: '陳生' });
  });

  it('throws when the insert fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    fromMock.mockReturnValue({ select, insert });

    await expect(ensureProfile('elder', '陳生')).rejects.toThrow('boom');
  });
});
