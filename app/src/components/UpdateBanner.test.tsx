import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const updateSW = vi.fn();
const setNeedRefresh = vi.fn();
let needRefresh = true;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, () => {}],
    updateServiceWorker: updateSW,
  }),
}));

import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    needRefresh = true;
  });

  it('renders nothing when there is no new version', () => {
    needRefresh = false;
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reloads into the new version only after the user taps 立即更新', async () => {
    render(<UpdateBanner />);
    expect(updateSW).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('立即更新'));
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('lets the user postpone with 遲啲先 without reloading', async () => {
    render(<UpdateBanner />);
    await userEvent.click(screen.getByText('遲啲先'));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateSW).not.toHaveBeenCalled();
  });
});
