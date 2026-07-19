import { speakCantonese } from './speech';

function makeVoice(lang: string, name: string): SpeechSynthesisVoice {
  return { lang, name } as SpeechSynthesisVoice;
}

describe('speakCantonese', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('picks the yue-HK Cantonese voice when the device only exposes it under the yue tag, not zh-HK', () => {
    const cantonese = makeVoice('yue-HK', 'Sinji');
    const voices = [makeVoice('en-US', 'Samantha'), cantonese, makeVoice('zh-CN', 'Tingting')];
    vi.spyOn(window.speechSynthesis, 'getVoices').mockReturnValue(voices);
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');

    speakCantonese('你好嗎');

    const utterance = speakSpy.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(cantonese);
  });

  it('picks the zh-HK voice when that is the only Cantonese tag available, e.g. Android TTS engines', () => {
    const cantonese = makeVoice('zh-HK', 'Cantonese (Hong Kong)');
    const voices = [makeVoice('en-US', 'Samantha'), makeVoice('zh-CN', 'Tingting'), cantonese];
    vi.spyOn(window.speechSynthesis, 'getVoices').mockReturnValue(voices);
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');

    speakCantonese('你好嗎');

    const utterance = speakSpy.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBe(cantonese);
  });

  it('leaves the voice unset (browser default) rather than crashing when no Chinese voice exists at all', () => {
    vi.spyOn(window.speechSynthesis, 'getVoices').mockReturnValue([makeVoice('en-US', 'Samantha')]);
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');

    speakCantonese('你好嗎');

    const utterance = speakSpy.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).toBeNull();
  });

  it('2026-07-19: does NOT force a Mandarin (zh-CN) voice when no Cantonese voice exists — many desktop browsers only ship zh-CN, and reading Mandarin to a Cantonese-speaking elder is wrong even though "zh" technically matches', () => {
    const mandarin = makeVoice('zh-CN', 'Tingting');
    vi.spyOn(window.speechSynthesis, 'getVoices').mockReturnValue([makeVoice('en-US', 'Samantha'), mandarin]);
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');

    speakCantonese('你好嗎');

    const utterance = speakSpy.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice).not.toBe(mandarin);
    expect(utterance.voice).toBeNull();
    // lang stays zh-HK so the browser's own fallback logic still has a hint to work with
    expect(utterance.lang).toBe('zh-HK');
  });
});
