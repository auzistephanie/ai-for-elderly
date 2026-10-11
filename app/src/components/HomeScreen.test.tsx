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

  it('shows an encouragement message and no lesson card when there is no next lesson', () => {
    render(<HomeScreen nextLesson={null} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.getByText('今層學晒喇', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('開始上堂 ▶')).not.toBeInTheDocument();
  });

  it('greets by time of day and by name', () => {
    const at = (h: number) => new Date(2026, 9, 11, h, 0);
    const { rerender } = render(
      <HomeScreen nextLesson={null} antiFraudLesson={null} streakCount={0} displayName="陳生" now={at(9)} onSelectLesson={() => {}} />,
    );
    expect(screen.getByText(/早晨，陳生/)).toBeInTheDocument();
    rerender(<HomeScreen nextLesson={null} antiFraudLesson={null} streakCount={0} displayName="陳生" now={at(15)} onSelectLesson={() => {}} />);
    expect(screen.getByText(/午安，陳生/)).toBeInTheDocument();
    rerender(<HomeScreen nextLesson={null} antiFraudLesson={null} streakCount={0} now={at(20)} onSelectLesson={() => {}} />);
    expect(screen.getByText(/晚安/)).toBeInTheDocument();
    expect(screen.getByText(/晚安/).textContent).not.toContain('，');
  });

  it('does not praise a zero-day streak', () => {
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.queryByText(/好叻呀/)).not.toBeInTheDocument();
    expect(screen.getByText(/第 1 日/)).toBeInTheDocument();
  });

  it('opens the lesson from the keyboard on the today-card', async () => {
    const onSelectLesson = vi.fn();
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={onSelectLesson} />);
    screen.getByRole('button', { name: /開始上堂/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelectLesson).toHaveBeenCalledWith(seedLesson.id);
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

  it('keeps the anti-fraud button disabled when unavailable', () => {
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.getByText('防騙必修班').closest('button')).toBeDisabled();
  });

  it('does not render the removed 唔識就撳我 stub button', () => {
    render(<HomeScreen nextLesson={seedLesson} antiFraudLesson={null} streakCount={0} onSelectLesson={() => {}} />);
    expect(screen.queryByText('唔識就撳我')).not.toBeInTheDocument();
  });
});
