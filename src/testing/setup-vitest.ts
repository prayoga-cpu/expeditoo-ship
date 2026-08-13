import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

// Reset mocks between tests to prevent pollution
afterEach(() => {
  vi.clearAllMocks();
});
