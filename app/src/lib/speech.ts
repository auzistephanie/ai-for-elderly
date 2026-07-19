function findCantoneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((v) => v.lang === 'yue-HK') ??
    voices.find((v) => v.lang === 'zh-HK') ??
    voices.find((v) => v.lang.startsWith('yue')) ??
    voices.find((v) => v.lang.startsWith('zh'))
  );
}

export function speakCantonese(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-HK';
  const voice = findCantoneseVoice(window.speechSynthesis.getVoices());
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
