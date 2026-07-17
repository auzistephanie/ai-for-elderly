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
    const onToggleShare = vi.fn();
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} userId="u1" />);
    await userEvent.click(screen.getByRole('button', { name: '' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
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
    createPairingCodeMock.mockRejectedValue(new Error('攞唔到配對碼，請再試'));
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('攞唔到配對碼，請再試')).toBeInTheDocument();
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

  it('shows the empty-comments message when there are none', async () => {
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} userId="u1" />);
    expect(await screen.findByText('仲未有家人留言，快啲叫佢哋嚟支持你啦')).toBeInTheDocument();
  });
});
