import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeScreen } from './HomeScreen';
import { seedLesson } from '../data/seedLesson';

const antiFraudLesson = { ...seedLesson, id: 'af', subtitle: '防騙課' };

describe('HomeScreen', () => {
  it('shows the next lesson and the current streak', () => {
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={5} onSelectLesson={() => {}} />);
    expect(screen.getByText(seedLesson.subtitle)).toBeInTheDocument();
    expect(screen.getByText('5', { exact: false })).toBeInTheDocument();
  });

  it('selects the next lesson when the today-card is tapped', async () => {
    const onSelectLesson = vi.fn();
    render(
      <HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={onSelectLesson} />,
    );
    await userEvent.click(screen.getByText('開始上堂 ▶'));
    expect(onSelectLesson).toHaveBeenCalledWith(seedLesson.id);
  });

  it('shows an encouragement message and disables the 上堂 button when there is no next lesson', () => {
    render(<HomeScreen nextLesson={null} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.getByText('今層學晒喇', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('上堂').closest('button')).toBeDisabled();
  });

  it('enables the anti-fraud button once that lesson exists, and calls onSelectLesson with its id', async () => {
    const onSelectLesson = vi.fn();
    render(
      <HomeScreen
        nextLesson={seedLesson}
        antiFraudLesson={antiFraudLesson}
        streakCount={0}
        onSelectLesson={onSelectLesson}
      />,
    );
    const btn = screen.getByText('防騙必修班').closest('button')!;
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(onSelectLesson).toHaveBeenCalledWith('af');
  });

  it('keeps the anti-fraud and help buttons disabled when unavailable', () => {
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.getByText('防騙必修班').closest('button')).toBeDisabled();
    expect(screen.getByText('唔識就撳我').closest('button')).toBeDisabled();
  });
});
