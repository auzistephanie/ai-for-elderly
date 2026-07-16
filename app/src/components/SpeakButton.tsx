export function speakCantonese(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-HK';
  window.speechSynthesis.speak(utterance);
}

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
