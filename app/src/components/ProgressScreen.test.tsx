import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ProgressScreen } from './ProgressScreen';

const layers = [
  { layer: 1, name: 'AI 入門（淺）', totalLessons: 1, completedLessons: 1 },
  { layer: 2, name: '生活應用（中）', totalLessons: 0, completedLessons: 0 },
  { layer: 3, name: '進階玩法（深）', totalLessons: 0, completedLessons: 0 },
];

const badges = [
  { id: 'first-lesson', icon: '🐣', label: '初次見面', locked: false },
  { id: 'streak-5', icon: '🔥', label: '連學 5 日', locked: true },
  { id: 'anti-fraud', icon: '🛡️', label: '防騙高手', locked: true },
  { id: 'ai-master', icon: '🎓', label: 'AI 達人', locked: true },
];

describe('ProgressScreen', () => {
  it('shows a completed layer 1 and locked empty layers 2/3', () => {
    render(<ProgressScreen layers={layers} badges={badges} onSelectLessons={vi.fn()} />);
    expect(screen.getByText('✅ 完成晒 1 / 1 課')).toBeInTheDocument();
    expect(screen.getAllByText('🔒 未有課程')).toHaveLength(2);
  });

  it('renders unlocked badges without the locked class and locked ones with it', () => {
    render(<ProgressScreen layers={layers} badges={badges} onSelectLessons={vi.fn()} />);
    expect(screen.getByText('初次見面').closest('.badge')).not.toHaveClass('locked');
    expect(screen.getByText('連學 5 日').closest('.badge')).toHaveClass('locked');
  });

  it('tapping a layer card navigates to the lesson list (does not jump into a specific lesson)', async () => {
    const onSelectLessons = vi.fn();
    render(<ProgressScreen layers={layers} badges={badges} onSelectLessons={onSelectLessons} />);

    await userEvent.click(screen.getByText('✅ 完成晒 1 / 1 課').closest('.prog-card')!);

    expect(onSelectLessons).toHaveBeenCalledTimes(1);
  });

  it('each layer card is reachable by keyboard (button role) for a screen-reader/keyboard user', () => {
    render(<ProgressScreen layers={layers} badges={badges} onSelectLessons={vi.fn()} />);
    // 3 layer cards + the badges card must NOT itself be a button (it isn't tappable).
    expect(screen.getAllByRole('button', { name: /第.層/ })).toHaveLength(3);
  });
});
