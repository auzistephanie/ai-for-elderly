import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LessonScreen } from './LessonScreen';
import { seedLesson } from '../data/seedLesson';

describe('LessonScreen', () => {
  it('walks through all three steps and only completes after the correct quiz answer', async () => {
    const onComplete = vi.fn();
    render(<LessonScreen lesson={seedLesson} onComplete={onComplete} />);

    // Step 1: why
    expect(screen.getByText('點解要學呢樣嘢？')).toBeInTheDocument();
    await userEvent.click(screen.getByText('下一步 ▶'));

    // Step 2: demo
    expect(screen.getByText('睇下 AI 點答')).toBeInTheDocument();
    expect(screen.getByText(/呢隻係血壓藥/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('下一步 ▶'));

    // Step 3: quiz — wrong answer first
    expect(screen.getByText('AI 話你知藥物資料之後，你應該——')).toBeInTheDocument();
    await userEvent.click(screen.getByText('即刻自己停藥'));
    expect(screen.getByText(/再諗下/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText('完成課堂 🎉')).not.toBeInTheDocument();

    // Now the correct answer
    await userEvent.click(screen.getByText('當參考，有疑問問返醫生'));
    expect(screen.getByText(/啱晒/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('完成課堂 🎉'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not reveal the correct/wrong icon before an option is clicked', async () => {
    const onComplete = vi.fn();
    render(<LessonScreen lesson={seedLesson} onComplete={onComplete} />);

    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));

    // Quiz step is visible, but no option has been clicked yet.
    expect(screen.getByText('AI 話你知藥物資料之後，你應該——')).toBeInTheDocument();
    expect(screen.queryByText('✅')).not.toBeInTheDocument();
    expect(screen.queryByText('❌')).not.toBeInTheDocument();
  });
});
