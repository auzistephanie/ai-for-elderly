import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// FamilyProgressView (rendered for an already-linked family account) fetches progress itself via
// lib/progressApi — mock it here too so that branch doesn't hit the real Supabase client.
const fetchProgressMock = vi.fn();
vi.mock('./lib/progressApi', () => ({
  fetchProgress: (...args: unknown[]) => fetchProgressMock(...args),
}));

vi.mock('./lib/lessonStarts', () => ({
  logLessonStart: vi.fn().mockResolvedValue(undefined),
}));

import { App } from './App';
import type { Lesson } from './types/lesson';

const seedLesson: Lesson = {
  id: 'lesson-001',
  layer: 1 as const,
  number: 1,
  title: 'AI 係咩',
  subtitle: '第一課',
  steps: [
    { kind: 'why' as const, title: '點解要學呢樣嘢？', body: ['x'], speak: 's' },
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

const layer1: Lesson = { ...seedLesson, id: 'l1', layer: 1, number: 1, subtitle: '第一層課' };
const layer2: Lesson = { ...seedLesson, id: 'l2', layer: 2, number: 4, subtitle: '第二層課' };
const antiFraud: Lesson = { ...seedLesson, id: 'af', layer: 0, number: 1, subtitle: '防騙課' };

function mockElder(lessons: Lesson[], completedLessonIds: string[]) {
  useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
  useLessonsMock.mockReturnValue({ lessons, loaded: true, error: null, reload: vi.fn() });
  useProgressMock.mockReturnValue({
    state: { completedLessonIds, streakCount: 3, lastActiveDate: '2026-07-17', familyShareEnabled: true },
    loaded: true,
    progressError: null,
    reloadProgress: vi.fn(),
    completeLesson: vi.fn(),
    setFamilyShare: vi.fn(),
  });
}

describe('App auth gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows LoginScreen while signed out', () => {
    useAuthMock.mockReturnValue({ status: 'signed-out', userId: null, role: null });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      progressError: null,
      reloadProgress: vi.fn(),
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
      progressError: null,
      reloadProgress: vi.fn(),
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
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });
    fetchFamilyLinkMock.mockResolvedValue(null);

    render(<App />);
    await waitFor(() => expect(screen.getByText('輸入配對碼')).toBeInTheDocument());
  });

  it('shows an error+retry message when useLessons fails, and retry calls reload() (not a full remount)', async () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
    const reloadMock = vi.fn();
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true, error: '網絡有問題', reload: reloadMock });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: true,
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText(/攞唔到課堂內容/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('再試一次'));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('shows an error+retry message when useProgress fails to load, and retry calls reloadProgress()', async () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: 'elder' });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true, error: null, reload: vi.fn() });
    const reloadProgressMock = vi.fn();
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: true,
      progressError: '攞唔到進度，請再試',
      reloadProgress: reloadProgressMock,
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText('攞唔到進度，請再試')).toBeInTheDocument();
    await userEvent.click(screen.getByText('再試一次'));
    expect(reloadProgressMock).toHaveBeenCalledTimes(1);
  });

  it('completing a lesson that fails shows an inline error and does not navigate to the progress tab', async () => {
    mockElder([layer1], []);
    const completeLessonMock = vi.fn().mockRejectedValue(new Error('完成課堂紀錄唔到，請再試'));
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: true,
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: completeLessonMock,
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('A'));
    await userEvent.click(screen.getByText('完成課堂 🎉'));

    expect(await screen.findByText('完成課堂紀錄唔到，請再試')).toBeInTheDocument();
    // Still on LessonScreen, not navigated to the progress tab.
    expect(screen.getByText('完成課堂 🎉')).toBeInTheDocument();
  });

  it('shows an error+retry message when fetchFamilyLink rejects, and retry re-invokes it', async () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'fam1', role: 'family' });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true, error: null, reload: vi.fn() });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });
    fetchFamilyLinkMock.mockRejectedValueOnce(new Error('網絡逾時'));
    fetchFamilyLinkMock.mockResolvedValueOnce(null);

    render(<App />);
    await waitFor(() => expect(screen.getByText(/網絡逾時/)).toBeInTheDocument());
    await userEvent.click(screen.getByText('再試一次'));
    await waitFor(() => expect(screen.getByText('輸入配對碼')).toBeInTheDocument());
    expect(fetchFamilyLinkMock).toHaveBeenCalledTimes(2);
  });

  it('shows FamilyProgressView for a signed-in family account that already has a link', async () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'fam1', role: 'family' });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true, error: null, reload: vi.fn() });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });
    fetchFamilyLinkMock.mockResolvedValue({ elderUserId: 'e1', elderDisplayName: '陳生' });
    fetchProgressMock.mockResolvedValue({
      completedLessonIds: ['l1'],
      streakCount: 3,
      lastActiveDate: '2026-07-17',
      familyShareEnabled: true,
    });

    render(<App />);
    await waitFor(() => expect(screen.getByText(/陳生/)).toBeInTheDocument());
  });

  it('shows an error message instead of guessing a role when auth.role is null', () => {
    useAuthMock.mockReturnValue({ status: 'signed-in', userId: 'u1', role: null });
    useLessonsMock.mockReturnValue({ lessons: [], loaded: true, error: null, reload: vi.fn() });
    useProgressMock.mockReturnValue({
      state: { completedLessonIds: [], streakCount: 0, lastActiveDate: null, familyShareEnabled: true },
      loaded: false,
      progressError: null,
      reloadProgress: vi.fn(),
      completeLesson: vi.fn(),
      setFamilyShare: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText(/攞唔到你嘅身份資料/)).toBeInTheDocument();
    expect(screen.queryByText('主頁')).not.toBeInTheDocument();
  });
});

describe('App course engine (elder)', () => {
  beforeEach(() => vi.clearAllMocks());

  // HomeScreen's own "上堂" quick-action button label shares its exact text with the NavBar's
  // "上堂" tab (RTL's default text matcher reads each element's own direct text node, and both
  // the NavBar <button> and the bigbtn's inner <span> have "上堂" as a direct text child), so a
  // bare screen.getByText('上堂') is ambiguous whenever Home is on screen. Scoping to the <nav>
  // disambiguates without touching HomeScreen/NavBar markup, which are out of scope for this task.
  function clickNavTab(label: string) {
    return userEvent.click(within(screen.getByRole('navigation')).getByText(label));
  }

  it('opening a lesson from the 上堂 tab list shows that specific LessonScreen', async () => {
    mockElder([layer1, layer2], []);
    render(<App />);
    await clickNavTab('上堂');
    expect(screen.getByText('第一層課')).toBeInTheDocument();
    await userEvent.click(screen.getByText('第一層課'));
    // LessonScreen renders the lesson's first (why) step title, plus its subtitle in the
    // topbar — both inherited from the shared `seedLesson` fixture except subtitle, which
    // was overridden per-lesson above, so this confirms both "we're on LessonScreen now"
    // and "specifically for lesson l1", not just any lesson.
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    expect(screen.getByText('第一層課')).toBeInTheDocument();
  });

  it("tapping home's today-card opens that lesson directly, skipping the list", async () => {
    mockElder([layer1], []);
    render(<App />);
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
  });

  it('tapping a layer card on the 進度 tab navigates to the 上堂 lesson list (not into a specific lesson)', async () => {
    mockElder([layer1, layer2], ['l1']);
    render(<App />);
    await clickNavTab('進度');
    expect(screen.getByText('✅ 完成晒 1 / 1 課')).toBeInTheDocument();

    await userEvent.click(screen.getByText('✅ 完成晒 1 / 1 課').closest('button')!);

    // '揀一課，慢慢學' is LessonListScreen's own topbar subtitle — proves we landed on the
    // list, not a specific opened lesson (which would show the lesson's own subtitle instead).
    expect(screen.getByText('揀一課，慢慢學')).toBeInTheDocument();
  });

  it('navigating to a different tab and back to 上堂 shows the list again, not the previously-open lesson', async () => {
    mockElder([layer1], []);
    render(<App />);
    await clickNavTab('上堂');
    // '揀一課，慢慢學' is LessonListScreen's own topbar subtitle — a marker that's only
    // present on the list view, unlike the lesson's own subtitle text which appears in
    // both the list row AND (relocated) the opened LessonScreen's topbar.
    expect(screen.getByText('揀一課，慢慢學')).toBeInTheDocument();
    await userEvent.click(screen.getByText('第一層課'));
    expect(screen.queryByText('揀一課，慢慢學')).not.toBeInTheDocument();
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    await clickNavTab('主頁');
    await clickNavTab('上堂');
    expect(screen.getByText('揀一課，慢慢學')).toBeInTheDocument();
  });

  it('locks layer-2 lessons until layer 1 is fully completed', async () => {
    mockElder([layer1, layer2], []);
    render(<App />);
    await clickNavTab('上堂');
    expect(screen.getByText('第二層課').closest('button')).toBeDisabled();
  });

  it('shows the encouragement placeholder on Home when every unlocked lesson is completed', () => {
    mockElder([layer1], ['l1']);
    render(<App />);
    expect(screen.getByText('今層學晒喇', { exact: false })).toBeInTheDocument();
  });

  it('enables the always-unlocked anti-fraud button once that lesson exists', async () => {
    mockElder([layer1, antiFraud], []);
    render(<App />);
    const btn = screen.getByText('防騙必修班').closest('button')!;
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    expect(screen.getByText('防騙課')).toBeInTheDocument();
  });
});
