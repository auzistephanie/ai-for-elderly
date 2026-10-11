import { useEffect, useState } from 'react';
import { speakCantonese, stopSpeaking, isSpeechSupported } from '../lib/speech';

interface SpeakButtonProps {
  text: string;
}

export function SpeakButton({ text }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  // 離開呢一步（或者換咗段文字）就即刻收聲，唔好繼續讀上一步。
  useEffect(() => () => stopSpeaking(), [text]);

  function handleClick() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!isSpeechSupported()) {
      setUnsupported(true);
      return;
    }
    setSpeaking(true);
    speakCantonese(text, () => setSpeaking(false));
  }

  return (
    <>
      <button className="bigbtn listen-btn" onClick={handleClick}>
        <span className="ico">{speaking ? '⏹️' : '🔊'}</span>
        <span>{speaking ? '讀緊…撳一下停' : '讀出嚟俾我聽'}</span>
      </button>
      {unsupported && <p className="error-text">呢部手機讀唔到出聲，請睇上面啲字</p>}
    </>
  );
}
