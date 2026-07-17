import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const useAuthMock = vi.fn();
vi.mock('./hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const useLessonsMock = vi.fn();
vi.mock('./hooks/useLessons', () => ({ useLessons: () => useLessonsMock() }));

const useProgressMock = vi.fn();
vi.mock('./hooks/useProgress', async () => {
  const actual = await vi.importActual<typeof import('./hooks/useProgress')>('./hooks/useProgress');
  return {
    ...actual,
    useProgress: (...args: unknown[]) => useProgressMock(...args),
  };
});

const fetchFamilyLinkMock = vi.fn();
vi.mock('./lib/family', () => ({
  fetchFamilyLink: (...args: unknown[]) => fetchFamilyLinkMock(...args),
  createPairingCode: vi.fn(),
  redeemPairingCode: vi.fn(),
}));

import { App } from './App';

const seedLesson = {
  id: 'lesson-001',
  layer: 1 as const,
  number: 1,
  title: 'AI 係咩',
  subtitle: '第一課',
  steps: [
    { kind: 'why' as const, title: 'W', body: ['x'], speak: 's' },
    { kind: 'demo' as const, title: 'D', bubbles: [], body: ['x'], speak: 's' },
    {
      kind: 'quiz' as const,
      title: 'Q',
      options: [
        { text: 'A', correct: true },
        { text: 'B', correct: false },
      ] as [{ text: string; correct: boolean }, { text: string; correct: boolean }],
      feedbackCorrect: 'yes',
      feedbackWrong: 'no',
    },
  ],
};

describe('App auth gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows LoginScreen while signed out', () => {
    useAuthMock.mockReturnValue({ status: 'signed-out', userId: null, role: null });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText('邊個登入？')).toBeInTheDocument();
  });

  it('shows the elder 4-tab shell once signed in as elder', () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
    useLessonsMock.mockReturnValue({ lessons: [seedLesson], loaded: true });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 2, lastActiveDate: '2026-07-17', familyShareEnabled: true },
      loaded: true,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText('主頁')).toBeInTheDocument();
  });

  it('shows PairingScreen for a signed-in family account with no link yet', async () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'fam1', role: 'family' });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });
    fetchFamilyLinkMock.mockResolvedValue(null);

    render(<App />);
    await waitFor(() => expect(screen.getByText('輸入配對碼')).toBeInTheDocument());
  });
});
