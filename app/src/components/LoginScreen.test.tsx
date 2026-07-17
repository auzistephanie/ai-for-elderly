import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const requestOtpMock = vi.fn();
const fetchDisplayedOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const ensureProfileMock = vi.fn();

vi.mock('../lib/auth', () => ({
  requestOtp: (...args: unknown[]) => requestOtpMock(...args),
  fetchDisplayedOtp: (...args: unknown[]) => fetchDisplayedOtpMock(...args),
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
  ensureProfile: (...args: unknown[]) => ensureProfileMock(...args),
}));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('walks through role choice -> name -> phone -> OTP confirm -> onLoggedIn', async () => {
    requestOtpMock.mockResolvedValue({ error: null });
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue({ error: null });
    ensureProfileMock.mockResolvedValue('elder');

    const onLoggedIn = vi.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    await userEvent.click(screen.getByText('我係長者'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳生');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('561166')).toBeInTheDocument();

    await userEvent.click(screen.getByText('確認登入'));

    expect(verifyOtpMock).toHaveBeenCalledWith('91234567', '561166');
    expect(ensureProfileMock).toHaveBeenCalledWith('elder', '陳生');
    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });

  it('disables the next button until a name is entered', async () => {
    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係仔女'));
    expect(screen.getByText('下一步')).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    expect(screen.getByText('下一步')).not.toBeDisabled();
  });

  it('shows an error and stays on the phone step when sending fails', async () => {
    requestOtpMock.mockResolvedValue({ error: 'boom' });

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係仔女'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('傳送失敗，check 下電話號碼啱唔啱')).toBeInTheDocument();
  });

  it('recovers when ensureProfile throws after a successful verifyOtp', async () => {
    requestOtpMock.mockResolvedValue({ error: null });
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue({ error: null });
    ensureProfileMock.mockRejectedValue(new Error('boom'));

    const onLoggedIn = vi.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    await userEvent.click(screen.getByText('我係長者'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳生');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('561166')).toBeInTheDocument();

    const confirmBtn = screen.getByText('確認登入');
    await userEvent.click(confirmBtn);

    expect(await screen.findByText('登入失敗，請再試一次')).toBeInTheDocument();
    expect(onLoggedIn).not.toHaveBeenCalled();
    expect(confirmBtn).not.toBeDisabled();
  });
});
