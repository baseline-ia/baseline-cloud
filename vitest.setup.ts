/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}
