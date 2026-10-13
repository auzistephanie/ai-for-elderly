import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createPairingCodeMock = vi.fn();
vi.mock('../lib/family', () => ({
  createPairingCode: (...args: unknown[]) => createPairingCodeMock(...args),
}));

const fetchCommentsMock = vi.fn();
const likeCommentMock = vi.fn();
vi.mock('../lib/comments', () => ({
  fetchComments: (...args: unknown[]) => fetchCommentsMock(...args),
  likeComment: (...args: unknown[]) => likeCommentMock(...args),
}));

import { FamilyScreen } from './FamilyScreen';

describe('FamilyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCommentsMock.mockResolvedValue([]);
  });

  it('toggles share via the callback', async () => {
    const onToggleShare = vi.fn().mockResolvedValue(undefined);
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} userId="u1" />);
    await userEvent.click(screen.getByRole('button', { name: '分享進度，開咗' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
  });

  it('shows an inline error when toggling share fails', async () => {
    const onToggleShare = vi.fn().mockRejectedValue(new Error('個開關未轉到。再撳一次'));
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} userId="u1" />);

    await userEvent.click(screen.getByRole('button', { name: '分享進度，開咗' }));

    expect(await screen.findByText('個開關未轉到。再撳一次')).toBeInTheDocument();
  });

  it('generates and displays a pairing code on tap', async () => {
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('384920')).toBeInTheDocument();
  });

  it('does not show the pairing prompt when sharing is off', () => {
    render(<FamilyScreen shareEnabled={false} onToggleShare={vi.fn()} userId="u1" />);
    expect(screen.queryByText('產生配對碼')).not.toBeInTheDocument();
  });

  it('shows the thrown error message when code generation fails', async () => {
    createPairingCodeMock.mockRejectedValue(new Error('配對碼出唔到。再撳一次「產生配對碼」'));
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('配對碼出唔到。再撳一次「產生配對碼」')).toBeInTheDocument();
  });

  it('loads and shows family comments', async () => {
    fetchCommentsMock.mockResolvedValue([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
    ]);
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    expect(fetchCommentsMock).toHaveBeenCalledWith('u1');
    expect(await screen.findByText('好叻呀！')).toBeInTheDocument();
    expect(screen.getByText('陳小姐')).toBeInTheDocument();
  });

  it('likes a comment and updates it to the liked state', async () => {
    fetchCommentsMock.mockResolvedValue([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
    ]);
    likeCommentMock.mockResolvedValue(undefined);
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    const likeBtn = await screen.findByText('🤍');
    await userEvent.click(likeBtn);

    expect(likeCommentMock).toHaveBeenCalledWith('c1');
    expect(await screen.findByText('❤️')).toBeInTheDocument();
  });

  it('shows an error when liking a comment fails, and lets the user retry', async () => {
    fetchCommentsMock.mockResolvedValue([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
    ]);
    likeCommentMock.mockRejectedValue(new Error('boom'));
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    const likeBtn = await screen.findByText('🤍');
    await userEvent.click(likeBtn);

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('❤️')).not.toBeInTheDocument();
    expect(screen.getByText('🤍')).not.toBeDisabled();
  });

  it('shows the empty-comments message when there are none', async () => {
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);
    expect(await screen.findByText('仲未有留言。叫屋企人喺佢個 app 寫幾句俾你。')).toBeInTheDocument();
  });

  it('shows a countdown after generating a code', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await user.click(screen.getByText('產生配對碼'));
    expect(await screen.findByText('384920')).toBeInTheDocument();
    expect(screen.getByText('仲剩 10 分鐘')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(screen.getByText('仲剩 9 分鐘')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows an expired message and a regenerate button once the countdown reaches zero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await user.click(screen.getByText('產生配對碼'));
    expect(await screen.findByText('384920')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(screen.getByText(/呢組碼過期了/)).toBeInTheDocument();
    expect(screen.queryByText('384920')).not.toBeInTheDocument();
    expect(screen.getByText('產生新碼')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('replaces the current code with a fresh one when 產生新碼 is tapped', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    createPairingCodeMock.mockResolvedValueOnce('384920').mockResolvedValueOnce('111222');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await user.click(screen.getByText('產生配對碼'));
    expect(await screen.findByText('384920')).toBeInTheDocument();

    await user.click(screen.getByText('產生新碼'));
    expect(await screen.findByText('111222')).toBeInTheDocument();
    expect(screen.queryByText('384920')).not.toBeInTheDocument();
    expect(screen.getByText('仲剩 10 分鐘')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
