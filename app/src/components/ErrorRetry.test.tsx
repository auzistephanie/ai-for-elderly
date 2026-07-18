import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ErrorRetry } from './ErrorRetry';

describe('ErrorRetry', () => {
  it('shows the message and a 再試一次 button that calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorRetry message="攞唔到課堂內容：network down" onRetry={onRetry} />);

    expect(screen.getByText('攞唔到課堂內容：network down')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '再試一次' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a disabled 再試緊… state while busy', () => {
    render(<ErrorRetry message="boom" onRetry={vi.fn()} busy />);

    const button = screen.getByRole('button', { name: '再試緊…' });
    expect(button).toBeDisabled();
    expect(screen.queryByText('再試一次')).not.toBeInTheDocument();
  });
});
