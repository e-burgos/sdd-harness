import { render, screen } from '@testing-library/react';
import { AppShell, DOCUMENT_LOCK_ATTRIBUTE } from './AppShell';

describe('AppShell', () => {
  it('anchors the app to the viewport and locks the document scroll while mounted', () => {
    const { unmount } = render(<AppShell><p>hola</p></AppShell>);
    expect(screen.getByTestId('app-shell')).toHaveClass('fixed', 'inset-0', 'overflow-hidden');
    expect(document.documentElement).toHaveAttribute(DOCUMENT_LOCK_ATTRIBUTE);
    unmount();
    expect(document.documentElement).not.toHaveAttribute(DOCUMENT_LOCK_ATTRIBUTE);
  });
});
