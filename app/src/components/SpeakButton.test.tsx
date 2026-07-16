import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeakButton } from './SpeakButton';

describe('SpeakButton', () => {
  it('renders the 讀出嚟 label', () => {
    render(<SpeakButton text="你好" />);
    expect(screen.getByText('讀出嚟俾我聽')).toBeInTheDocument();
  });

  it('speaks the given text in Cantonese when tapped', async () => {
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');
    render(<SpeakButton text="你好嗎" />);
    await userEvent.click(screen.getByText('讀出嚟俾我聽'));
    expect(speakSpy).toHaveBeenCalledTimes(1);
    const utterance = speakSpy.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('你好嗎');
    expect(utterance.lang).toBe('zh-HK');
  });
});
