import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const fetchProgressMock = vi.fn();

vi.mock('../lib/progressApi', () => ({
  fetchProgress: (...args: unknown[]) => fetchProgressMock(...args),
}));

const fetchCommentsMock = vi.fn();
const postCommentMock = vi.fn();
vi.mock('../lib/comments', () => ({
  fetchComments: (...args: unknown[]) => fetchCommentsMock(...args),
  postComment: (...args: unknown[]) => postCommentMock(...args),
}));

import { FamilyProgressView } from './FamilyProgressView';

describe('FamilyProgressView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCommentsMock.mockResolvedValue([]);
  });

  it('shows the elder streak and completed-lesson count once loaded', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: ['l1', 'l2'],
      streakCount: 5,
      lastActiveDate: '2026-07-17',
      familyShareEnabled: true,
    });

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    await waitFor(() => expect(screen.getByText(/5/)).toBeInTheDocument());
    expect(screen.getByText(/陳生/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('shows a sharing-off message when the elder has since turned sharing off', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: false,
    });

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    expect(await screen.findByText('對方而家冇分享緊進度')).toBeInTheDocument();
  });

  it('shows an error message with a retry option when fetchProgress fails', async () => {
    fetchProgressMock.mockRejectedValue(new Error('network down'));

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    expect(await screen.findByText(/攞唔到/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /再試/ })).toBeInTheDocument();
  });

  it('re-invokes fetchProgress and recovers to the success state when retry is clicked', async () => {
    const user = userEvent.setup();
    fetchProgressMock.mockRejectedValueOnce(new Error('network down'));

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    const retryButton = await screen.findByRole('button', { name: /再試/ });
    expect(fetchProgressMock).toHaveBeenCalledTimes(1);

    fetchProgressMock.mockResolvedValueOnce({
      completedLessonIds: ['l1', 'l2'],
      streakCount: 5,
      lastActiveDate: '2026-07-17',
      familyShareEnabled: true,
    });

    await user.click(retryButton);

    await waitFor(() => expect(fetchProgressMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/5/)).toBeInTheDocument());
    expect(screen.queryByText(/攞唔到/)).not.toBeInTheDocument();
  });

  it('falls back to the generic "長者" label when elderDisplayName is null', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: ['l1'],
      streakCount: 3,
      lastActiveDate: '2026-07-17',
      familyShareEnabled: true,
    });

    render(<FamilyProgressView elderUserId="e1" elderDisplayName={null} />);

    expect(await screen.findByText('長者嘅進度')).toBeInTheDocument();
  });

  it('loads and shows the shared comment list when sharing is enabled', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: ['l1'],
      streakCount: 5,
      lastActiveDate: '2026-07-18',
      familyShareEnabled: true,
    });
    fetchCommentsMock.mockResolvedValue([
      { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: true, createdAt: '2026-07-18T10:00:00Z' },
    ]);

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    expect(await screen.findByText('好叻呀！')).toBeInTheDocument();
    expect(fetchCommentsMock).toHaveBeenCalledWith('e1');
  });

  it('does not fetch comments when sharing is off', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: false,
    });

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);

    await screen.findByText('對方而家冇分享緊進度');
    expect(fetchCommentsMock).not.toHaveBeenCalled();
  });

  it('posts a new comment and refreshes the list', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: true,
    });
    fetchCommentsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '加油！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
      ]);
    postCommentMock.mockResolvedValue(undefined);

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);
    await screen.findByText('仲未有留言');

    await userEvent.type(screen.getByPlaceholderText('寫幾句鼓勵嘅說話…'), '加油！');
    await userEvent.click(screen.getByText('送出鼓勵'));

    expect(postCommentMock).toHaveBeenCalledWith('e1', '加油！');
    expect(await screen.findByText('加油！', { selector: '.comment-text' })).toBeInTheDocument();
  });

  it('shows an error and keeps the draft when posting fails', async () => {
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: [],
      streakCount: 0,
      lastActiveDate: null,
      familyShareEnabled: true,
    });
    fetchCommentsMock.mockResolvedValue([]);
    postCommentMock.mockRejectedValue(new Error('boom'));

    render(<FamilyProgressView elderUserId="e1" elderDisplayName="陳生" />);
    await screen.findByText('仲未有留言');

    const input = screen.getByPlaceholderText('寫幾句鼓勵嘅說話…');
    await userEvent.type(input, '加油！');
    await userEvent.click(screen.getByText('送出鼓勵'));

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(input).toHaveValue('加油！');
  });
});
