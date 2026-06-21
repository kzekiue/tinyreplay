import { describe, it, expect } from 'vitest';
import { isThemePref, isThemeFamily, THEME_SCRIPT, THEME_FAMILIES } from './theme';

describe('theme prefs', () => {
  it('validates appearance prefs', () => {
    expect(isThemePref('system')).toBe(true);
    expect(isThemePref('dark')).toBe(true);
    expect(isThemePref('neon')).toBe(false);
    expect(isThemePref(undefined)).toBe(false);
  });

  it('validates theme families', () => {
    for (const f of ['classic', 'foundry', 'signal', 'modern']) {
      expect(isThemeFamily(f)).toBe(true);
    }
    expect(isThemeFamily('paper')).toBe(false);
    expect(isThemeFamily('monokai')).toBe(false);
    expect(isThemeFamily(undefined)).toBe(false);
  });

  it('pre-paint script carries the expected cookie names and fallbacks', () => {
    expect(THEME_SCRIPT).toContain('tr_theme');
    expect(THEME_SCRIPT).toContain('tr_theme_family');
    expect(THEME_SCRIPT).toContain("'system'");
    expect(THEME_SCRIPT).toContain("'classic'");
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_FAMILIES));
  });
});
