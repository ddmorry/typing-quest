// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Global test setup if needed
beforeEach(() => {
  // Reset any mocks between tests
  jest.clearAllMocks();
});

// Mock Next.js router if needed in tests
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    push: jest.fn(),
    prefetch: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => ({
    get: () => {},
  }),
}));

// Mock Phaser for components that use it
jest.mock('phaser', () => ({
  Game: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
  Scene: jest.fn(),
  GameObjects: {
    Text: jest.fn(),
    Image: jest.fn(),
  },
}));
