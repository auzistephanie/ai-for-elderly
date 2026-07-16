import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

describe('App walkthrough', () => {
  beforeEach(() => localStorage.clear());

  it('goes home -> lesson -> quiz -> progress with buttons only, and updates progress', async () => {
    render(<App />);

    // Home: start today's lesson
    expect(screen.getByText('影張相，問 AI 呢隻藥點樣食')).toBeInTheDocument();
    await userEvent.click(screen.getByText('開始上堂 ▶'));

    // Lesson: walk the 3 steps
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('下一步 ▶'));
    await userEvent.click(screen.getByText('當參考，有疑問問返醫生'));
    await userEvent.click(screen.getByText('完成課堂 🎉'));

    // Lands on Progress, showing Layer 1 fully complete and the first badge unlocked
    expect(screen.getByText('✅ 完成晒 1 / 1 課')).toBeInTheDocument();
    expect(screen.getByText('初次見面').closest('.badge')).not.toHaveClass('locked');

    // Family tab is reachable and toggle works
    await userEvent.click(screen.getByText('家人'));
    expect(screen.getByText(/WhatsApp 邀請/)).toBeInTheDocument();
  });
});
