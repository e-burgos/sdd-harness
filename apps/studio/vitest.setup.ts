import '@testing-library/jest-dom/vitest';

class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = ResizeObserverStub;

let objectUrlCounter = 0;
URL.createObjectURL = () => `blob:test/${++objectUrlCounter}`;
URL.revokeObjectURL = () => undefined;
