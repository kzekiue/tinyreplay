/**
 * Masking is mapped onto rrweb's built-in privacy primitives. We deliberately do
 * not implement our own DOM scrubbing - rrweb already strips content at capture
 * time, which is the only safe place to do it (before anything is serialized).
 *
 *  - data-tr-mask    -> rrweb "mask text": element + descendants have their text
 *                       replaced with asterisks in the snapshot and every mutation.
 *  - data-tr-unmask  -> opt a non-sensitive input OUT of masking: its value is
 *                       captured in the clear. Masking is on by default, so this
 *                       is the escape hatch for fields like search or quantity.
 *  - data-tr-ignore  -> rrweb "block": element + descendants are not recorded at
 *                       all (a same-size placeholder is captured instead).
 *
 * Input values are masked globally by rrweb (maskAllInputs). Per-input control is
 * not a built-in rrweb option, so the opt-out is implemented in maskInputFn, which
 * rrweb (>= 2.0.0-alpha.18) calls with the element - letting us check whether the
 * input sits inside a [data-tr-unmask] subtree and, if so, return the real value.
 */

export const MASK_SELECTOR = '[data-tr-mask]';
export const UNMASK_SELECTOR = '[data-tr-unmask]';
export const IGNORE_SELECTOR = '[data-tr-ignore]';

export interface MaskingOptions {
  maskAllInputs: boolean;
  maskTextSelector: string;
  blockSelector: string;
  maskInputFn: (text: string, element: HTMLElement) => string;
}

const star = (text: string) => '*'.repeat(text.length);
const isUnmasked = (el: HTMLElement) =>
  typeof el?.closest === 'function' && el.closest(UNMASK_SELECTOR) !== null;

/**
 * Build the masking-related subset of rrweb's record() options.
 * @param maskAllInputs when true (the default), every input/textarea/select
 *        value is masked before it ever leaves the page, except inputs the page
 *        explicitly opts out with data-tr-unmask. When false, only password
 *        inputs are masked (rrweb's irreducible safety floor).
 */
export function buildMaskingOptions(maskAllInputs: boolean): MaskingOptions {
  const textBase = `${MASK_SELECTOR}, ${MASK_SELECTOR} *`;
  return {
    maskAllInputs,
    // Mask tagged text and its descendants; when masking all inputs, also mask
    // <textarea> content (a text node, not a value) unless it opts out.
    maskTextSelector: maskAllInputs
      ? `${textBase}, textarea:not(${UNMASK_SELECTOR})`
      : textBase,
    blockSelector: IGNORE_SELECTOR,
    // Per-input opt-out: a value inside [data-tr-unmask] is captured in the clear;
    // everything else is masked to asterisks.
    maskInputFn: (text, el) => (isUnmasked(el) ? text : star(text)),
  };
}
