import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './HomeScreen';
import { seedLesson } from '../data/seedLesson';

describe('HomeScreen', () => {
  it('shows today\'s lesson and the current streak', () => {
    render(<HomeScreen todayLesson={seedLesson} streakCount={5} onStartLesson={() => {}} />);
    expect(screen.getByText(seedLesson.subtitle)).toBeInTheDocument();
    expect(screen.getByText('5', { exact: false })).toBeInTheDocument();
  });

  it('starts the lesson when the today-card is tapped', async () => {
    const onStartLesson = vi.fn();
    render(<HomeScreen todayLesson={seedLesson} streakCount={0} onStartLesson={onStartLesson} />);
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    expect(onStartLesson).toHaveBeenCalledTimes(1);
  });

  it('renders the not-yet-available features as disabled, not clickable', () => {
    render(<HomeScreen todayLesson={seedLesson} streakCount={0} onStartLesson={() => {}} />);
    expect(screen.getByText('防騙必修班').closest('button')).toBeDisabled();
    expect(screen.getByText('唔識就撳我').closest('button')).toBeDisabled();
  });
});
