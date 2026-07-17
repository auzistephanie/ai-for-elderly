import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const createPairingCodeMock = vi.fn();

vi.mock('../lib/family', () => ({
  createPairingCode: (...args: unknown[]) => createPairingCodeMock(...args),
}));

import { FamilyScreen } from './FamilyScreen';

describe('FamilyScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggles share via the callback', async () => {
    const onToggleShare = vi.fn();
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} />);
    await userEvent.click(screen.getByRole('button', { name: '' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
  });

  it('generates and displays a pairing code on tap', async () => {
    createPairingCodeMock.mockResolvedValue('384920');
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('384920')).toBeInTheDocument();
  });

  it('does not show the pairing prompt when sharing is off', () => {
    render(<FamilyScreen shareEnabled={false} onToggleShare={vi.fn()} />);
    expect(screen.queryByText('產生配對碼')).not.toBeInTheDocument();
  });

  it('shows the thrown error message when code generation fails', async () => {
    createPairingCodeMock.mockRejectedValue(new Error('攞唔到配對碼，請再試'));
    render(<FamilyScreen shareEnabled={true} onToggleShare={vi.fn()} />);

    await userEvent.click(screen.getByText('產生配對碼'));

    expect(await screen.findByText('攞唔到配對碼，請再試')).toBeInTheDocument();
  });
});
