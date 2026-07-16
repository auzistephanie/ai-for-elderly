import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavBar } from './NavBar';

describe('NavBar', () => {
  it('renders all four tabs and marks the active one', () => {
    render(<NavBar active="home" onNavigate={() => {}} />);
    expect(screen.getByText('主頁').closest('button')).toHaveClass('on');
    expect(screen.getByText('上堂').closest('button')).not.toHaveClass('on');
    expect(screen.getByText('進度')).toBeInTheDocument();
    expect(screen.getByText('家人')).toBeInTheDocument();
  });

  it('calls onNavigate with the tapped tab name', async () => {
    const onNavigate = vi.fn();
    render(<NavBar active="home" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText('進度'));
    expect(onNavigate).toHaveBeenCalledWith('progress');
  });
});
