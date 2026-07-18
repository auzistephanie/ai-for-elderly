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
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue(undefined);
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
    requestOtpMock.mockRejectedValue(new Error('傳送失敗，check 下電話號碼啱唔啱'));

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係仔女'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));

    expect(await screen.findByText('傳送失敗，check 下電話號碼啱唔啱')).toBeInTheDocument();
  });

  it('shows an error when the OTP never becomes available after a retry', async () => {
    // The 1s internal retry delay in handleSendOtp races against RTL's default ~1000ms
    // findByText timeout — fake timers avoid a flaky test, same approach as
    // FamilyScreen.test.tsx's countdown tests already use in this suite.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue(null);

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await user.click(screen.getByText('我係仔女'));
    await user.type(screen.getByPlaceholderText('你個名'), '陳小姐');
    await user.click(screen.getByText('下一步'));
    await user.type(screen.getByPlaceholderText('912345678'), '91234567');
    await user.click(screen.getByText('傳送驗證碼'));

    await vi.advanceTimersByTimeAsync(1000);

    expect(await screen.findByText('攞唔到驗證碼，撳「傳送驗證碼」再試多次')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows verifyOtp\'s thrown message when verification fails', async () => {
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockRejectedValue(new Error('驗證失敗，撳返去重新傳送'));

    render(<LoginScreen onLoggedIn={vi.fn()} />);
    await userEvent.click(screen.getByText('我係長者'));
    await userEvent.type(screen.getByPlaceholderText('你個名'), '陳生');
    await userEvent.click(screen.getByText('下一步'));
    await userEvent.type(screen.getByPlaceholderText('912345678'), '91234567');
    await userEvent.click(screen.getByText('傳送驗證碼'));
    expect(await screen.findByText('561166')).toBeInTheDocument();

    await userEvent.click(screen.getByText('確認登入'));

    expect(await screen.findByText('驗證失敗，撳返去重新傳送')).toBeInTheDocument();
  });

  it('recovers when ensureProfile throws after a successful verifyOtp', async () => {
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockResolvedValue(undefined);
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

  it('going back to the phone step from a failed confirm clears the error and allows a fresh resend', async () => {
    requestOtpMock.mockResolvedValue(undefined);
    fetchDisplayedOtpMock.mockResolvedValue('561166');
    verifyOtpMock.mockRejectedValueOnce(new Error('驗證失敗，撳返去重新傳送')).mockResolvedValueOnce(undefined);
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
    expect(await screen.findByText('驗證失敗，撳返去重新傳送')).toBeInTheDocument();

    await userEvent.click(screen.getByText('撳呢度返去重新輸入電話'));

    // Back on the phone step, with no leftover confirm-error visible anywhere.
    expect(screen.getByPlaceholderText('912345678')).toBeInTheDocument();
    expect(screen.queryByText('驗證失敗，撳返去重新傳送')).not.toBeInTheDocument();

    // A fresh resend + confirm succeeds cleanly (proves confirm.error was actually cleared,
    // not just visually hidden by navigating away from the step that renders it).
    await userEvent.click(screen.getByText('傳送驗證碼'));
    expect(await screen.findByText('561166')).toBeInTheDocument();
    await userEvent.click(screen.getByText('確認登入'));

    expect(onLoggedIn).toHaveBeenCalledTimes(1);
  });
});
