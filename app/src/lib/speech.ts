function findCantoneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  // 2026-07-19 修：拎走咗最尾嗰個 `v.lang.startsWith('zh')` fallback——呢個會
  // 撈到 zh-CN（普通話）嘅聲，喺淨得普通話聲、冇 zh-HK/yue 嘅裝置（好多桌面
  // 瀏覽器都係）會強行揀咗佢，讀普通話俾以粵語為主嘅長者聽。冇 yue/zh-HK
  // voice 就寧願唔明確揀（返 undefined），落面 `speakCantonese()` 會照舊set
  // `utterance.lang = 'zh-HK'`，等瀏覽器自己嘅語言比對邏輯揀（通常好過我哋
  // 手動撈一個確定唔啱嘅普通話聲出嚟）。
  return (
    voices.find((v) => v.lang === 'yue-HK') ??
    voices.find((v) => v.lang === 'zh-HK') ??
    voices.find((v) => v.lang.startsWith('yue'))
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
