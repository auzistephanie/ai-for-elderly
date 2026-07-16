import { render, screen } from '@testing-library/react';
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
    render(<ProgressScreen layers={layers} badges={badges} />);
    expect(screen.getByText('✅ 完成晒 1 / 1 課')).toBeInTheDocument();
    expect(screen.getAllByText('🔒 未有課程')).toHaveLength(2);
  });

  it('renders unlocked badges without the locked class and locked ones with it', () => {
    render(<ProgressScreen layers={layers} badges={badges} />);
    expect(screen.getByText('初次見面').closest('.badge')).not.toHaveClass('locked');
    expect(screen.getByText('連學 5 日').closest('.badge')).toHaveClass('locked');
  });
});
