import { describe, it, expect, afterEach } from 'vitest';
import { record } from 'rrweb';
import {
  buildMaskingOptions,
  MASK_SELECTOR,
  UNMASK_SELECTOR,
  IGNORE_SELECTOR,
} from './masking';

/**
 * These tests run the *real* rrweb recorder against a jsdom DOM and inspect the
 * serialized full-snapshot event. The contract we verify: secret strings must
 * never appear anywhere in the captured event stream, while opted-out fields do.
 */

function recordSnapshot(): Promise<string> {
  return new Promise((resolve) => {
    const events: unknown[] = [];
    const m = buildMaskingOptions(true);
    const stop = record({
      emit: (e) => events.push(e),
      maskAllInputs: m.maskAllInputs,
      maskInputFn: m.maskInputFn,
      maskTextSelector: m.maskTextSelector,
      blockSelector: m.blockSelector,
    });
    // Full snapshot is emitted synchronously on record start.
    setTimeout(() => {
      stop?.();
      resolve(JSON.stringify(events));
    }, 0);
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('masking', () => {
  it('builds the expected selectors', () => {
    const m = buildMaskingOptions(true);
    expect(m.maskTextSelector).toContain(MASK_SELECTOR);
    expect(m.blockSelector).toBe(IGNORE_SELECTOR);
    expect(m.maskAllInputs).toBe(true);
    expect(typeof m.maskInputFn).toBe('function');
  });

  it('never captures <input> values', async () => {
    document.body.innerHTML = `<input id="pw" type="password" value="supersecret123" />`;
    const dump = await recordSnapshot();
    expect(dump).not.toContain('supersecret123');
  });

  it('masks a typeless <input> value (the type-attribute hole)', async () => {
    document.body.innerHTML = `<input value="typeless-secret-xyz" />`;
    const dump = await recordSnapshot();
    expect(dump).not.toContain('typeless-secret-xyz');
  });

  it('masks <textarea> content (a text node, not an input value)', async () => {
    document.body.innerHTML = `<textarea>textarea-secret-xyz</textarea>`;
    const dump = await recordSnapshot();
    expect(dump).not.toContain('textarea-secret-xyz');
  });

  it('captures a [data-tr-unmask] input in the clear', async () => {
    document.body.innerHTML = `
      <input data-tr-unmask value="visible-search-term" />
      <input value="still-masked-secret" />`;
    const dump = await recordSnapshot();
    expect(dump).toContain('visible-search-term');
    expect(dump).not.toContain('still-masked-secret');
  });

  it('masks text content of [data-tr-mask] elements and their children', async () => {
    document.body.innerHTML = `<div data-tr-mask><span>secret-email@example.com</span></div>`;
    const dump = await recordSnapshot();
    expect(dump).not.toContain('secret-email@example.com');
  });

  it('does not record [data-tr-ignore] subtrees', async () => {
    document.body.innerHTML = `<div data-tr-ignore><p>private-chat-message</p></div>`;
    const dump = await recordSnapshot();
    expect(dump).not.toContain('private-chat-message');
  });

  it('still records ordinary text and UI labels', async () => {
    document.body.innerHTML = `<h1>Public Heading XYZ</h1><button>Pay Now</button>`;
    const dump = await recordSnapshot();
    expect(dump).toContain('Public Heading XYZ');
    expect(dump).toContain('Pay Now');
  });

  it('exports the unmask selector', () => {
    expect(UNMASK_SELECTOR).toBe('[data-tr-unmask]');
  });
});
