import { describe, it, expect } from 'vitest';
import { readToken, setToken } from './filter-token';

describe('filter-token', () => {
  it('reads a token value, empty when absent', () => {
    expect(readToken('project:web device:mobile', 'project')).toBe('web');
    expect(readToken('device:mobile', 'project')).toBe('');
  });

  it('sets, replaces, and clears a token without disturbing the rest', () => {
    expect(setToken('device:mobile', 'project', 'web')).toBe('device:mobile project:web');
    expect(setToken('project:old device:mobile', 'project', 'new')).toBe('device:mobile project:new');
    expect(setToken('project:web device:mobile', 'project', '')).toBe('device:mobile');
  });
});
