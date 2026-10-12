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

// vite-plugin-pwa 嘅 virtual module 喺 jsdom 解析唔到，預設當冇新版本。
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }),
}));
