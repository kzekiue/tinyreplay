// The search box and the hardware controls share one source of truth: the `?q=`
// string of `field:value` tokens (parsed server-side by buildFilter). These read/
// write a single token in that string so every control stays in sync for free.
const token = (k: string) => new RegExp(`(?:^|\\s)${k}:(\\S+)`, 'i');

export const readToken = (q: string, k: string) => q.match(token(k))?.[1] ?? '';

export const setToken = (q: string, k: string, v: string) => {
  const without = q.replace(token(k), '').replace(/\s+/g, ' ').trim();
  return v ? `${without} ${k}:${v}`.trim() : without;
};
