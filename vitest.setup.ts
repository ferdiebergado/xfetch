import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  // ---- Mock document.cookie ----
  let cookieStore = '';

  Object.defineProperty(globalThis, 'document', {
    value: {},
    writable: true,
  });

  Object.defineProperty(document, 'cookie', {
    get: vi.fn(() => cookieStore),
    set: vi.fn((val: string) => {
      cookieStore = val;
    }),
    configurable: true,
  });
});
