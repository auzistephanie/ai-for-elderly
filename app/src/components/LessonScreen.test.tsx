import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const logLessonStartMock = vi.fn();
vi.mock('../lib/lessonStarts', () => ({
  logLessonStart: (...args: unknown[]) => logLessonStartMock(...args),
}));

import { LessonScreen } from './LessonScreen';
import { seedLesson } from '../data/seedLesson';

describe('LessonScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logLessonStartMock.mockResolvedValue(undefined);
  });

  it('walks through all three steps and only completes after the correct quiz answer', async () => {
    const onComplete = vi.fn();
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={onComplete} />);

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
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={onComplete} />);

    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));

    // Quiz step is visible, but no option has been clicked yet.
    expect(screen.getByText('AI 話你知藥物資料之後，你應該——')).toBeInTheDocument();
    expect(screen.queryByText('✅')).not.toBeInTheDocument();
    expect(screen.queryByText('❌')).not.toBeInTheDocument();
  });

  it('logs a lesson start on mount', () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);
    expect(logLessonStartMock).toHaveBeenCalledWith('u1', seedLesson.id);
  });

  it('shows completeError next to the 完成課堂 button when present, without hiding the button', async () => {
    render(
      <LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} completeError="完成課堂紀錄唔到，請再試" />,
    );

    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('當參考，有疑問問返醫生'));

    expect(screen.getByText('完成課堂紀錄唔到，請再試')).toBeInTheDocument();
    expect(screen.getByText('完成課堂 🎉')).toBeInTheDocument();
  });

  it("wraps the demo step's bubbles in a Gemini-branded shell", async () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    expect(screen.getByText('Gemini')).toBeInTheDocument();
    // The existing bubble content must still render, unchanged, inside the new shell.
    expect(screen.getByText(/呢隻係血壓藥/)).toBeInTheDocument();
  });

  it('shows a "get Gemini" card only on the very first lesson (layer 1, number 1)', async () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    expect(screen.getByText('今堂要用返 Gemini App')).toBeInTheDocument();
  });

  it('does not show the "get Gemini" card on a later lesson', async () => {
    const laterLesson = { ...seedLesson, layer: 2 as const, number: 5 };
    render(<LessonScreen lesson={laterLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    expect(screen.queryByText('今堂要用返 Gemini App')).not.toBeInTheDocument();
  });

  it('does not show the "get Gemini" card on the second lesson of the same layer', async () => {
    const secondLessonSameLayer = { ...seedLesson, number: 2 };
    render(<LessonScreen lesson={secondLessonSameLayer} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    expect(screen.queryByText('今堂要用返 Gemini App')).not.toBeInTheDocument();
  });

  it('the "get Gemini" card links to a real Gemini app-store URL', async () => {
    render(<LessonScreen lesson={seedLesson} userId="u1" onComplete={vi.fn()} />);

    await userEvent.click(screen.getByText('下一步 ▶'));

    const link = screen.getByRole('link', { name: /攞 Gemini/ });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/(play\.google\.com|apps\.apple\.com)\//);
  });
});
