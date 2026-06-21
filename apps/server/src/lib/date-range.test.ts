import { describe, it, expect } from 'vitest';
import { nextRange } from '@/lib/date-range';

// nextRange drives the click-start-then-end date picker: first click sets the
// start, second click sets the end (ordering the two), a third click restarts.
describe('nextRange', () => {
  it('empty -> sets start', () => {
    expect(nextRange('', '', '2026-06-10')).toEqual(['2026-06-10', '']);
  });
  it('extends forward', () => {
    expect(nextRange('2026-06-10', '', '2026-06-15')).toEqual(['2026-06-10', '2026-06-15']);
  });
  it('extends backward and orders the ends', () => {
    expect(nextRange('2026-06-10', '', '2026-06-05')).toEqual(['2026-06-05', '2026-06-10']);
  });
  it('full range -> restarts from the new click', () => {
    expect(nextRange('2026-06-10', '2026-06-15', '2026-06-20')).toEqual(['2026-06-20', '']);
  });
});
