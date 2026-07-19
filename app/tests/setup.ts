import '@testing-library/jest-dom/vitest';

class MockSpeechSynthesisUtterance {
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

const mockSpeechSynthesis = {
  cancel: () => {},
  speak: () => {},
  getVoices: () => [] as SpeechSynthesisVoice[],
};

// @ts-expect-error jsdom does not implement the Web Speech API
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
// @ts-expect-error jsdom does not implement the Web Speech API
window.speechSynthesis = mockSpeechSynthesis;
