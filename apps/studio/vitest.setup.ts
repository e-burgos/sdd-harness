import '@testing-library/jest-dom/vitest';

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = ResizeObserverStub;

if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => undefined;

let objectUrlCounter = 0;
URL.createObjectURL = () => `blob:test/${++objectUrlCounter}`;
URL.revokeObjectURL = () => undefined;
