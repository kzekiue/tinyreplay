import { describe, it, expect } from 'vitest';
import { isAuthorized } from './auth';

function basic(user: string, pass: string): string {
  return 'Basic ' + btoa(`${user}:${pass}`);
}

describe('isAuthorized', () => {
  it('accepts the correct password with any username', () => {
    expect(isAuthorized(basic('admin', 'hunter2'), 'hunter2')).toBe(true);
    expect(isAuthorized(basic('', 'hunter2'), 'hunter2')).toBe(true);
    expect(isAuthorized(basic('someone-else', 'hunter2'), 'hunter2')).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(isAuthorized(basic('admin', 'wrong'), 'hunter2')).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(isAuthorized(null, 'hunter2')).toBe(false);
    expect(isAuthorized('', 'hunter2')).toBe(false);
    expect(isAuthorized('Bearer hunter2', 'hunter2')).toBe(false);
    expect(isAuthorized('Basic not-base64!!!', 'hunter2')).toBe(false);
    expect(isAuthorized('Basic ' + btoa('no-colon'), 'hunter2')).toBe(false);
  });

  it('handles passwords containing colons', () => {
    expect(isAuthorized(basic('admin', 'a:b:c'), 'a:b:c')).toBe(true);
  });
});
