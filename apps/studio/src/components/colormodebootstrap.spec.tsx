import { render } from '@testing-library/react';
import { useTheme } from '@e-burgos/tucu-ui';
import { ColorModeBootstrap } from './ColorModeBootstrap';

describe('ColorModeBootstrap', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.studioInitialMode;
    useTheme.setState({ mode: 'dark' });
  });

  it('applies the system preference recorded on the first visit', async () => {
    document.documentElement.dataset.studioInitialMode = 'light';
    render(<ColorModeBootstrap />);
    await Promise.resolve();
    expect(useTheme.getState().mode).toBe('light');
    expect(document.documentElement.dataset.studioInitialMode).toBeUndefined();
  });

  it('leaves the persisted mode alone when there is no first-visit marker', async () => {
    useTheme.setState({ mode: 'light' });
    render(<ColorModeBootstrap />);
    await Promise.resolve();
    expect(useTheme.getState().mode).toBe('light');
  });
});
