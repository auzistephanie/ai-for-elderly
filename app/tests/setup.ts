import '@testing-library/jest-dom/vitest';

// vite-plugin-pwa 嘅 virtual module 喺 jsdom 解析唔到，預設當冇新版本。
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }),
}));
