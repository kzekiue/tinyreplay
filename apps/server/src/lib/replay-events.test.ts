import { describe, it, expect } from 'vitest';
import { parseReplay, type ReplayEntry } from './replay-events';

// rrweb constants used in fixtures
const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const META = 4;
const CUSTOM = 5;
const PLUGIN = 6;
const SRC_MOUSE_INTERACTION = 2;
const MOUSE_CLICK = 2;

const T0 = 1_000_000;
const meta = { type: META, timestamp: T0, data: { href: 'https://shop.test/', width: 1280, height: 720 } };
const snapshot = { type: FULL_SNAPSHOT, timestamp: T0 + 10, data: {} };

function click(tOffset: number, id: number) {
  return {
    type: INCREMENTAL,
    timestamp: T0 + tOffset,
    data: { source: SRC_MOUSE_INTERACTION, type: MOUSE_CLICK, id, x: 1, y: 1 },
  };
}

describe('parseReplay', () => {
  it('derives meta from the first timestamp and the Meta event', () => {
    const { meta: m } = parseReplay([meta, snapshot]);
    expect(m.startTimestamp).toBe(T0);
    expect(m.width).toBe(1280);
    expect(m.height).toBe(720);
    expect(m.entryUrl).toBe('https://shop.test/');
  });

  it('maps route custom events to route entries with offset time', () => {
    const ev = { type: CUSTOM, timestamp: T0 + 3000, data: { tag: 'tinyreplay/route', payload: { url: 'https://shop.test/checkout' } } };
    const { entries } = parseReplay([meta, snapshot, ev]);
    const route = entries.find((e) => e.kind === 'route');
    expect(route).toMatchObject({ kind: 'route', t: 3000, url: 'https://shop.test/checkout' });
  });

  it('emits a click entry per MouseInteraction click', () => {
    const { entries } = parseReplay([meta, snapshot, click(1000, 9)]);
    expect(entries.filter((e) => e.kind === 'click')).toHaveLength(1);
  });

  it('collapses ≥3 clicks on the same node within 700ms into one rageclick', () => {
    const { entries } = parseReplay([
      meta, snapshot,
      click(1000, 9), click(1150, 9), click(1300, 9),
    ]);
    const rage = entries.filter((e) => e.kind === 'rageclick');
    const clicks = entries.filter((e) => e.kind === 'click');
    expect(rage).toHaveLength(1);
    expect((rage[0] as Extract<ReplayEntry, { kind: 'rageclick' }>).count).toBe(3);
    expect(clicks).toHaveLength(0); // the 3 clicks are subsumed
  });

  it('does NOT rage-collapse clicks spread beyond the window', () => {
    const { entries } = parseReplay([
      meta, snapshot,
      click(1000, 9), click(2000, 9), click(3000, 9),
    ]);
    expect(entries.filter((e) => e.kind === 'rageclick')).toHaveLength(0);
    expect(entries.filter((e) => e.kind === 'click')).toHaveLength(3);
  });

  it('parses console plugin events into console entries', () => {
    const ev = {
      type: PLUGIN, timestamp: T0 + 500,
      data: { plugin: 'rrweb/console@1', payload: { level: 'error', trace: [], payload: ['"boom"', '42'] } },
    };
    const { entries } = parseReplay([meta, snapshot, ev]);
    expect(entries.find((e) => e.kind === 'console')).toMatchObject({
      kind: 'console', level: 'error', t: 500, text: 'boom 42',
    });
  });

  it('parses tinyreplay/network custom events into network entries', () => {
    const ev = {
      type: CUSTOM, timestamp: T0 + 800,
      data: { tag: 'tinyreplay/network', payload: { method: 'GET', url: '/api/cart', status: 200, durationMs: 42 } },
    };
    const { entries } = parseReplay([meta, snapshot, ev]);
    expect(entries.find((e) => e.kind === 'network')).toMatchObject({
      kind: 'network', method: 'GET', url: '/api/cart', status: 200, durationMs: 42, t: 800,
    });
  });

  it('parses tinyreplay/error custom events into error entries', () => {
    const ev = {
      type: CUSTOM, timestamp: T0 + 1200,
      data: { tag: 'tinyreplay/error', payload: { message: 'TypeError: x', stack: 'at a\nat b' } },
    };
    const { entries } = parseReplay([meta, snapshot, ev]);
    expect(entries.find((e) => e.kind === 'error')).toMatchObject({
      kind: 'error', message: 'TypeError: x', t: 1200,
    });
  });

  it('returns entries sorted by time and reports replayable=false for <2 events', () => {
    expect(parseReplay([meta]).meta.replayable).toBe(false);
    const { entries } = parseReplay([meta, snapshot, click(2000, 1), click(500, 1)]);
    const ts = entries.map((e) => e.t);
    expect([...ts]).toEqual([...ts].sort((a, b) => a - b));
  });

  it('reports replayable=false when there is no FullSnapshot', () => {
    const { meta: m } = parseReplay([meta, click(1000, 1), click(2000, 1)]);
    expect(m.replayable).toBe(false);
  });

  it('drops malformed events and returns only usable ones for the Replayer', () => {
    const { meta: m, events } = parseReplay([
      null, 'garbage', 42, { type: 'x' }, { timestamp: NaN, type: 3 },
      meta, snapshot, click(1000, 1),
    ]);
    expect(events).toHaveLength(3);
    expect(m.replayable).toBe(true);
    expect(m.startTimestamp).toBe(T0);
  });

  it('sorts out-of-order batches by timestamp before computing meta', () => {
    const { meta: m } = parseReplay([snapshot, meta]);
    expect(m.startTimestamp).toBe(T0);
    expect(m.totalTime).toBe(10);
  });
});
