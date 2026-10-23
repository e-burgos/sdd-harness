import '@testing-library/jest-dom/vitest';

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = ResizeObserverStub;

if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  URL.createObjectURL = () => `blob:test/${++counter}`;
  URL.revokeObjectURL = () => undefined;
}
