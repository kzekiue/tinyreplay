import { describe, it, expect } from 'vitest';
import { formatClock } from './format';

describe('format', () => {
  it('formatClock renders m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7000)).toBe('0:07');
    expect(formatClock(67000)).toBe('1:07');
  });
});
