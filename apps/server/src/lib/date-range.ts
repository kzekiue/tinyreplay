/** Decide the next [after, before] when day `v` is clicked in the date picker.
 *  No start yet, or a full range already set → start a fresh range; otherwise
 *  extend, ordering the two ends so after ≤ before. Pure (no React) so it lives
 *  here and is unit-tested directly. */
export function nextRange(after: string, before: string, v: string): [string, string] {
  if (!after || (after && before)) return [v, ''];
  return v < after ? [v, after] : [after, v];
}
