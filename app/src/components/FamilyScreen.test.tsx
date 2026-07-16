import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FamilyScreen } from './FamilyScreen';

describe('FamilyScreen', () => {
  it('shows the invite prompt when sharing is enabled', () => {
    render(<FamilyScreen shareEnabled={true} onToggleShare={() => {}} />);
    expect(screen.getByText(/WhatsApp 邀請/)).toBeInTheDocument();
  });

  it('hides the invite prompt when sharing is disabled', () => {
    render(<FamilyScreen shareEnabled={false} onToggleShare={() => {}} />);
    expect(screen.queryByText(/WhatsApp 邀請/)).not.toBeInTheDocument();
  });

  it('calls onToggleShare with the flipped value when the toggle is tapped', async () => {
    const onToggleShare = vi.fn();
    render(<FamilyScreen shareEnabled={true} onToggleShare={onToggleShare} />);
    await userEvent.click(screen.getByRole('button', { name: '' }));
    expect(onToggleShare).toHaveBeenCalledWith(false);
  });
});
