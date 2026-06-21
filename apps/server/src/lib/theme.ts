/**
 * Theme preference: hand-rolled, with no added UI dependency.
 *
 * The preference (`system` | `light` | `dark`) lives in a cookie so the server
 * can render a best-effort `data-theme` on <html>, and a tiny pre-paint script
 * resolves `system` against the OS before the first paint - no flash.
 *
 * CSS keys off the resolved `data-theme` (always `light` or `dark`); the
 * control keys off `data-theme-pref` for its active segment.
 */

export const THEME_COOKIE = 'tr_theme';
export const FAMILY_COOKIE = 'tr_theme_family';

// Single source of truth. Add/remove a theme by editing these two arrays only;
// the types, validators and the pre-paint script below all derive from them.
export const THEME_PREFS = ['system', 'light', 'dark'] as const;
export const THEME_FAMILIES = ['classic', 'foundry', 'signal', 'modern'] as const;

export type ThemePref = (typeof THEME_PREFS)[number];
export type ThemeFamily = (typeof THEME_FAMILIES)[number];

export function isThemePref(v: string | undefined): v is ThemePref {
  return (THEME_PREFS as readonly string[]).includes(v as string);
}

export function isThemeFamily(v: string | undefined): v is ThemeFamily {
  return (THEME_FAMILIES as readonly string[]).includes(v as string);
}

/** Resolve a preference to the concrete side, against the OS for `system`. */
export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Persist a theme choice and apply it live. Shared by the faceplate switch and
 *  the command palette so there's one source of truth. Browser-only. */
export function applyTheme(pref: ThemePref): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE}=${pref};path=/;max-age=31536000;samesite=lax`;
  const el = document.documentElement;
  el.setAttribute('data-theme', resolveTheme(pref));
  el.setAttribute('data-theme-pref', pref);
}

/** Persist a visual-theme choice and apply it live. Browser-only. */
export function applyThemeFamily(family: ThemeFamily): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${FAMILY_COOKIE}=${family};path=/;max-age=31536000;samesite=lax`;
  document.documentElement.setAttribute('data-theme-family', family);
}

/** Inline IIFE run in <head> before paint. Mirrors the runtime logic so a
 *  `system` preference resolves to the right side, and the visual theme family
 *  is applied, with no flash. */
export const THEME_SCRIPT = `(function(){try{var c=document.cookie;var m=c.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var p=m?decodeURIComponent(m[1]):'system';if(p!=='light'&&p!=='dark'&&p!=='system')p='system';var t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;var fm=c.match(/(?:^|; )${FAMILY_COOKIE}=([^;]*)/);var f=fm?decodeURIComponent(fm[1]):'classic';if(${JSON.stringify(THEME_FAMILIES)}.indexOf(f)<0)f='classic';var e=document.documentElement;e.setAttribute('data-theme',t);e.setAttribute('data-theme-pref',p);e.setAttribute('data-theme-family',f);}catch(_){var e2=document.documentElement;e2.setAttribute('data-theme','dark');e2.setAttribute('data-theme-family','classic');}})();`;
