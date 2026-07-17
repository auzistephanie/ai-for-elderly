import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const redeemPairingCodeMock = vi.fn();

vi.mock('../lib/family', () => ({
  redeemPairingCode: (...args: unknown[]) => redeemPairingCodeMock(...args),
}));

import { PairingScreen } from './PairingScreen';

describe('PairingScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redeems the entered code and calls onPaired with the elder info', async () => {
    redeemPairingCodeMock.mockResolvedValue({ elderUserId: 'e1', elderDisplayName: '陳生' });
    const onPaired = vi.fn();

    render(<PairingScreen onPaired={onPaired} />);
    await userEvent.type(screen.getByPlaceholderText('配對碼'), '384920');
    await userEvent.click(screen.getByText('配對'));

    expect(redeemPairingCodeMock).toHaveBeenCalledWith('384920');
    expect(onPaired).toHaveBeenCalledWith({ elderUserId: 'e1', elderDisplayName: '陳生' });
  });

  it('shows the thrown error message when redemption fails', async () => {
    redeemPairingCodeMock.mockRejectedValue(new Error('配對碼過期'));

    render(<PairingScreen onPaired={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('配對碼'), '000000');
    await userEvent.click(screen.getByText('配對'));

    expect(await screen.findByText('配對碼過期')).toBeInTheDocument();
  });
});
