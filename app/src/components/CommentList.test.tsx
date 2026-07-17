import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FamilyComment } from '../lib/comments';
import { CommentList } from './CommentList';

const comments: FamilyComment[] = [
  { id: 'c1', familyUserId: 'f1', familyDisplayName: '陳小姐', commentText: '好叻呀！', liked: false, createdAt: '2026-07-18T10:00:00Z' },
  { id: 'c2', familyUserId: 'f2', familyDisplayName: null, commentText: '加油！', liked: true, createdAt: '2026-07-17T10:00:00Z' },
];

describe('CommentList', () => {
  it('shows the error text when given one, instead of the list', () => {
    render(<CommentList comments={comments} error="攞唔到留言" emptyText="仲未有留言" />);
    expect(screen.getByText('攞唔到留言')).toBeInTheDocument();
    expect(screen.queryByText('好叻呀！')).not.toBeInTheDocument();
  });

  it('shows the empty-state text when there are no comments', () => {
    render(<CommentList comments={[]} error={null} emptyText="仲未有留言" />);
    expect(screen.getByText('仲未有留言')).toBeInTheDocument();
  });

  it('renders each comment with author (or a fallback) and text', () => {
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" />);
    expect(screen.getByText('陳小姐')).toBeInTheDocument();
    expect(screen.getByText('好叻呀！')).toBeInTheDocument();
    expect(screen.getByText('家人')).toBeInTheDocument();
    expect(screen.getByText('加油！')).toBeInTheDocument();
  });

  it('shows a read-only like indicator (not a button) when onLike is not given', () => {
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('🤍')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('shows a tappable like button for an unliked comment when onLike is given, and calls it with the comment id', async () => {
    const onLike = vi.fn();
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" onLike={onLike} likingId={null} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // only the unliked comment gets a tappable button
    await userEvent.click(buttons[0]);
    expect(onLike).toHaveBeenCalledWith('c1');
  });

  it('disables the like button for whichever comment is currently being liked', () => {
    render(<CommentList comments={comments} error={null} emptyText="仲未有留言" onLike={vi.fn()} likingId="c1" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
