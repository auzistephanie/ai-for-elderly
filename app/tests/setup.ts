import '@testing-library/jest-dom/vitest';

class MockSpeechSynthesisUtterance {
  lang = '';
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

const mockSpeechSynthesis = {
  cancel: () => {},
  speak: () => {},
};

// @ts-expect-error jsdom does not implement the Web Speech API
globalThis.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
// @ts-expect-error jsdom does not implement the Web Speech API
window.speechSynthesis = mockSpeechSynthesis;
