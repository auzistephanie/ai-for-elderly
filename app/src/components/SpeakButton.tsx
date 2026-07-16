import { speakCantonese } from '../lib/speech';

interface SpeakButtonProps {
  text: string;
}

export function SpeakButton({ text }: SpeakButtonProps) {
  return (
    <button className="bigbtn listen-btn" onClick={() => speakCantonese(text)}>
      <span className="ico">🔊</span>
      <span>讀出嚟俾我聽</span>
    </button>
  );
}
