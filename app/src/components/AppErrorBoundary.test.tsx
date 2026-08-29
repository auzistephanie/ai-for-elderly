import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('AppErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <div>正常內容</div>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('正常內容')).toBeInTheDocument();
  });

  it('shows a friendly Cantonese message + 重新載入 button when a child throws, and reload calls window.location.reload', async () => {
    // React logs the caught error to console.error by default (in addition to our own
    // componentDidCatch log) — silence both so the test output stays clean.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    // window.location can't be reassigned directly (it's a getter-only accessor in jsdom's
    // Location type), so redefine the property itself — restored via the same mechanism below.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('哎呀，個 app 出咗少少問題')).toBeInTheDocument();
    expect(screen.queryByText('正常內容')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新載入' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });
});
