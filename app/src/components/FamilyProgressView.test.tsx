import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const fetchProgressMock = vi.fn();

vi.mock('../lib/progressApi', () => ({
  fetchProgress: (...args: unknown[]) => fetchProgressMock(...args),
}));

import { FamilyProgressView } from './FamilyProgressView';

describe('FamilyProgressView', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
