import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App.tsx';
import { UpdateBanner } from './components/UpdateBanner.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
      <UpdateBanner />
    </AppErrorBoundary>
  </StrictMode>,
);
