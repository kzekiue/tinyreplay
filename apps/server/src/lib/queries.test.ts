import { describe, it, expect, beforeEach } from 'vitest';
import { resetDbForTests } from './db';
import {
  ingestBatch,
  getSession,
  listSessions,
  countSessions,
  getSessionEvents,
  searchSessions,
  countSearchSessions,
  deleteSessions,
  listProjects,
  __test,
} from './queries';

describe('buildFilter', () => {
  it('empty → match all', () => {
    expect(__test.buildFilter('  ')).toEqual({ where: '1=1', params: [] });
  });
  it('device token → equality', () => {
    expect(__test.buildFilter('device:Mobile')).toEqual({ where: 'device_type = ?', params: ['mobile'] });
  });
  it('numeric ops and dur seconds→ms', () => {
    expect(__test.buildFilter('pages:>3')).toEqual({ where: 'page_count > ?', params: [3] });
    expect(__test.buildFilter('dur:<10s')).toEqual({ where: 'duration_ms < ?', params: [10000] });
    expect(__test.buildFilter('events:100')).toEqual({ where: 'event_count = ?', params: [100] });
  });
  it('date range: after >= midnight, before < next midnight', () => {
    expect(__test.buildFilter('after:2026-06-01')).toEqual({
      where: 'started_at >= ?',
      params: [Date.parse('2026-06-01')],
    });
    expect(__test.buildFilter('before:2026-06-10')).toEqual({
      where: 'started_at < ?',
      params: [Date.parse('2026-06-10') + 86_400_000],
    });
  });
  it('relative range: last:Nd/h/m → started_at >= now - window', () => {
    const now = 1_000_000_000_000;
    expect(__test.buildFilter('last:7d', now)).toEqual({
      where: 'started_at >= ?',
      params: [now - 7 * 86_400_000],
    });
    expect(__test.buildFilter('last:24h', now)).toEqual({
      where: 'started_at >= ?',
      params: [now - 24 * 3_600_000],
    });
    expect(__test.buildFilter('last:bogus', now).where).toBe('(id LIKE ? OR url LIKE ? OR device_type LIKE ?)');
  });
  it('free text → LIKE, combined with tokens via AND', () => {
    const { where, params } = __test.buildFilter('checkout device:mobile');
    expect(where).toBe('device_type = ? AND (id LIKE ? OR url LIKE ? OR device_type LIKE ?)');
    expect(params).toEqual(['mobile', '%checkout%', '%checkout%', '%checkout%']);
  });
  it('has:error / has:errors → error_count > 0, no param', () => {
    expect(__test.buildFilter('has:error')).toEqual({ where: 'error_count > 0', params: [] });
    expect(__test.buildFilter('has:errors')).toEqual({ where: 'error_count > 0', params: [] });
  });
  it('project:<id> → project_id = ?', () => {
    expect(__test.buildFilter('project:my-app')).toEqual({ where: 'project_id = ?', params: ['my-app'] });
  });
  it('unknown field or non-numeric value falls back to free text', () => {
    expect(__test.buildFilter('foo:bar')).toEqual({
      where: '(id LIKE ? OR url LIKE ? OR device_type LIKE ?)',
      params: ['%foo:bar%', '%foo:bar%', '%foo:bar%'],
    });
  });
});

const SID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const batchId = (label: string): string => `batch-${label}`;
const recording = (instance: string, order: number = 1) => ({
  recordingInstanceId: `recording-${instance}`,
  recordingOrder: order,
});

function seedSession(id: string, startedAt: number) {
  ingestBatch({
    projectId: 'p',
    sessionId: id,
    batchId: batchId(`seed-${id}-${startedAt}`),
    ...recording('seed'),
    seq: 0,
    eventsJson: JSON.stringify([{ type: 2, data: {}, timestamp: startedAt }]),
    eventCount: 1,
    routeDelta: 0, errorDelta: 0,
    endedAt: startedAt + 1000,
    startedAt,
    url: 'https://example.com/',
    userAgent: 'test-ua',
    viewportW: 1280,
    viewportH: 720,
    deviceType: 'desktop',
  });
}

describe('queries', () => {
  beforeEach(() => {
    process.env.TINYREPLAY_DB_PATH = ':memory:';
    resetDbForTests();
  });

  it('getSession returns null for an unknown id', () => {
    expect(getSession('nope')).toBeNull();
  });

  it('inserts a session on seq 0 and computes duration', () => {
    seedSession(SID_A, 1000);
    const s = getSession(SID_A);
    expect(s).not.toBeNull();
    expect(s!.url).toBe('https://example.com/');
    expect(s!.duration_ms).toBe(1000);
    expect(s!.event_count).toBe(1);
    expect(s!.page_count).toBe(1);
    expect(countSessions()).toBe(1);
  });

  it('accumulates event_count and page_count on later batches', () => {
    seedSession(SID_A, 1000);
    ingestBatch({
      projectId: 'p',
      sessionId: SID_A,
      batchId: batchId('later'),
      ...recording('seed'),
      seq: 1,
      eventsJson: JSON.stringify([
        { type: 3, data: {}, timestamp: 1500 },
        { type: 5, data: { tag: 'tinyreplay/route', payload: {} }, timestamp: 1600 },
      ]),
      eventCount: 2,
      routeDelta: 1, errorDelta: 0,
      endedAt: 3000,
    });
    const s = getSession(SID_A)!;
    expect(s.event_count).toBe(3);
    expect(s.page_count).toBe(2);
    expect(s.duration_ms).toBe(2000);
  });

  it('ignores a retried batch with the same batch id', () => {
    const batch = {
      projectId: 'p',
      sessionId: SID_A,
      batchId: batchId('retry'),
      ...recording('retry'),
      seq: 0,
      eventsJson: JSON.stringify([
        { type: 2, data: {}, timestamp: 1000 },
        { type: 5, data: { tag: 'tinyreplay/route', payload: {} }, timestamp: 1100 },
        { type: 5, data: { tag: 'tinyreplay/error', payload: {} }, timestamp: 1200 },
      ]),
      eventCount: 3,
      routeDelta: 1,
      errorDelta: 1,
      endedAt: 1300,
      startedAt: 1000,
      url: 'https://example.com/',
      userAgent: 'test-ua',
      viewportW: 1280,
      viewportH: 720,
      deviceType: 'desktop' as const,
    };
    ingestBatch(batch);
    ingestBatch(batch);

    expect(getSession(SID_A)).toMatchObject({ event_count: 3, page_count: 2, error_count: 1 });
    expect(getSessionEvents(SID_A)).toHaveLength(3);
  });

  it('propagates a non-idempotency constraint failure', () => {
    expect(() =>
      ingestBatch({
        projectId: 'p',
        sessionId: SID_A,
        batchId: null as unknown as string,
        ...recording('invalid'),
        seq: 0,
        eventsJson: '[]',
        eventCount: 0,
        routeDelta: 0,
        errorDelta: 0,
        endedAt: 1000,
        startedAt: 1000,
        url: 'https://example.com/',
      }),
    ).toThrow(/NOT NULL constraint failed/);
    expect(getSession(SID_A)).toBeNull();
  });

  it('accepts a new seq-0 batch after a full-page reload', () => {
    const first = {
      projectId: 'p', sessionId: SID_A, batchId: batchId('reload-first'), ...recording('page-1'), seq: 0,
      eventsJson: JSON.stringify([{ type: 2, data: {}, timestamp: 1000 }]),
      eventCount: 1, routeDelta: 0, errorDelta: 0, endedAt: 1100, startedAt: 1000,
      url: 'https://example.com/checkout', userAgent: 'ua', viewportW: 1280, viewportH: 720,
      deviceType: 'desktop' as const,
    };
    ingestBatch(first);
    ingestBatch({
      ...first,
      batchId: batchId('reload-second'),
      ...recording('page-2', 2),
      eventsJson: JSON.stringify([{ type: 2, data: {}, timestamp: 2000 }]),
      endedAt: 2100,
      startedAt: 2000,
      url: 'https://example.com/confirmation',
    });

    expect(getSession(SID_A)).toMatchObject({ event_count: 2, url: 'https://example.com/confirmation' });
    expect(getSessionEvents(SID_A)).toHaveLength(2);
  });

  it('keeps conflicting payloads that share a session and sequence', () => {
    seedSession(SID_A, 1000);
    ingestBatch({
      projectId: 'p', sessionId: SID_A, batchId: batchId('conflict-a'), ...recording('seed'), seq: 1,
      eventsJson: JSON.stringify([{ type: 3, data: { id: 1 }, timestamp: 1500 }]),
      eventCount: 1, routeDelta: 0, errorDelta: 0, endedAt: 1600,
    });
    ingestBatch({
      projectId: 'p', sessionId: SID_A, batchId: batchId('conflict-b'), ...recording('seed'), seq: 1,
      eventsJson: JSON.stringify([{ type: 3, data: { id: 2 }, timestamp: 1700 }]),
      eventCount: 1, routeDelta: 0, errorDelta: 0, endedAt: 1800,
    });

    expect(getSession(SID_A)!.event_count).toBe(3);
    expect(getSessionEvents(SID_A)).toHaveLength(3);
  });

  it('orders replay by recorder lifecycle while summary metadata stays with the newest lifecycle', () => {
    // Page 1 seq 1 arrives first, then a reloaded page (seq 0), then Page 1
    // seq 0. All event timestamps are equal, so retrieval must not rely on them.
    const batch = (label: string, instance: string, order: number, seq: number) => ({
      projectId: 'p',
      sessionId: SID_A,
      batchId: batchId(label),
      ...recording(instance, order),
      seq,
      eventsJson: JSON.stringify([{ label, timestamp: 1000 }]),
      eventCount: 1,
      routeDelta: 0,
      errorDelta: 0,
      endedAt: 1000,
      ...(seq === 0
        ? { startedAt: 1000, url: `https://example.com/${label}`, userAgent: 'ua', viewportW: 1, viewportH: 1, deviceType: 'desktop' as const }
        : {}),
    });
    ingestBatch(batch('page-1-seq-1', 'page-1', 1, 1));
    ingestBatch({
      ...batch('page-2-seq-0', 'page-2', 2, 0),
      endedAt: 4000,
      startedAt: 2000,
      url: 'https://example.com/newest',
      userAgent: 'newest-ua',
      viewportW: 2,
      viewportH: 2,
    });
    // This delayed seq 0 is from the older lifecycle. It must still appear in
    // replay order, but it cannot roll the session summary or ended_at back.
    ingestBatch({
      ...batch('page-1-seq-0', 'page-1', 1, 0),
      endedAt: 3000,
      startedAt: 1000,
      url: 'https://example.com/older',
      userAgent: 'older-ua',
      viewportW: 1,
      viewportH: 1,
    });

    expect((getSessionEvents(SID_A) as { label: string }[]).map((event) => event.label)).toEqual([
      'page-1-seq-0',
      'page-1-seq-1',
      'page-2-seq-0',
    ]);
    expect(getSession(SID_A)).toMatchObject({
      url: 'https://example.com/newest',
      started_at: 2000,
      user_agent: 'newest-ua',
      viewport_w: 2,
      viewport_h: 2,
      ended_at: 4000,
      metadata_recording_order: 2,
      metadata_recording_instance_id: 'recording-page-2',
    });
  });

  it('listSessions returns most-recent first', () => {
    seedSession(SID_A, 1000);
    seedSession(SID_B, 5000);
    const list = listSessions(50, 0);
    expect(list.map((s) => s.id)).toEqual([SID_B, SID_A]);
  });

  it('getSessionEvents flattens batches in sequence order', () => {
    seedSession(SID_A, 1000);
    ingestBatch({
      projectId: 'p',
      sessionId: SID_A,
      batchId: batchId('flatten'),
      ...recording('seed'),
      seq: 1,
      eventsJson: JSON.stringify([{ type: 3, data: {}, timestamp: 1500 }]),
      eventCount: 1,
      routeDelta: 0, errorDelta: 0,
      endedAt: 1600,
    });
    const events = getSessionEvents(SID_A);
    expect(events).toHaveLength(2);
    expect((events[0] as { type: number }).type).toBe(2);
    expect((events[1] as { type: number }).type).toBe(3);
  });

  it('getSessionEvents skips corrupted batches and keeps the rest', () => {
    seedSession(SID_A, 1000);
    ingestBatch({
      projectId: 'p',
      sessionId: SID_A,
      batchId: batchId('corrupt'),
      ...recording('seed'),
      seq: 1,
      eventsJson: '{"truncated": tru', // simulated corrupt write
      eventCount: 1,
      routeDelta: 0, errorDelta: 0,
      endedAt: 1600,
    });
    ingestBatch({
      projectId: 'p',
      sessionId: SID_A,
      batchId: batchId('after-corrupt'),
      ...recording('seed'),
      seq: 2,
      eventsJson: JSON.stringify([{ type: 3, data: {}, timestamp: 1700 }]),
      eventCount: 1,
      routeDelta: 0, errorDelta: 0,
      endedAt: 1800,
    });
    const events = getSessionEvents(SID_A);
    expect(events).toHaveLength(2);
    expect((events[1] as { type: number }).type).toBe(3);
  });

  it('searchSessions with empty query returns all, newest first', () => {
    seedSession(SID_A, 1000);
    seedSession(SID_B, 2000);
    const rows = searchSessions('', 50, 0);
    expect(rows.map((r) => r.id)).toEqual([SID_B, SID_A]);
    expect(countSearchSessions('')).toBe(2);
  });

  it('searchSessions matches on url substring', () => {
    ingestBatch({
      projectId: 'p', sessionId: SID_A, batchId: batchId('checkout'), ...recording('checkout'), seq: 0,
      eventsJson: JSON.stringify([{ type: 2, data: {}, timestamp: 1000 }]),
      eventCount: 1, routeDelta: 0, errorDelta: 0, endedAt: 2000, startedAt: 1000,
      url: 'https://shop.example.com/checkout', userAgent: 'ua',
      viewportW: 1280, viewportH: 720, deviceType: 'desktop',
    });
    ingestBatch({
      projectId: 'p', sessionId: SID_B, batchId: batchId('blog'), ...recording('blog'), seq: 0,
      eventsJson: JSON.stringify([{ type: 2, data: {}, timestamp: 1000 }]),
      eventCount: 1, routeDelta: 0, errorDelta: 0, endedAt: 2000, startedAt: 1000,
      url: 'https://blog.example.com/post', userAgent: 'ua',
      viewportW: 390, viewportH: 844, deviceType: 'mobile',
    });
    expect(searchSessions('checkout', 50, 0).map((r) => r.id)).toEqual([SID_A]);
    expect(countSearchSessions('checkout')).toBe(1);
  });

  it('searchSessions matches on device_type and id prefix', () => {
    seedSession(SID_A, 1000); // device 'desktop'
    ingestBatch({
      projectId: 'p', sessionId: SID_B, batchId: batchId('mobile'), ...recording('mobile'), seq: 0,
      eventsJson: JSON.stringify([{ type: 2, data: {}, timestamp: 1000 }]),
      eventCount: 1, routeDelta: 0, errorDelta: 0, endedAt: 2000, startedAt: 1000,
      url: 'https://example.com/', userAgent: 'ua',
      viewportW: 390, viewportH: 844, deviceType: 'mobile',
    });
    expect(searchSessions('mobile', 50, 0).map((r) => r.id)).toEqual([SID_B]);
    expect(searchSessions('bbbbbbbb', 50, 0).map((r) => r.id)).toEqual([SID_B]);
  });

  it('accumulates error_count from errorDelta and filters with has:error', () => {
    seedSession(SID_A, 1000); // no errors
    seedSession(SID_B, 2000);
    ingestBatch({
      projectId: 'p',
      sessionId: SID_B,
      batchId: batchId('error'),
      ...recording('seed'),
      seq: 1,
      eventsJson: JSON.stringify([
        { type: 5, data: { tag: 'tinyreplay/error', payload: { message: 'boom' } }, timestamp: 2100 },
      ]),
      eventCount: 1,
      routeDelta: 0,
      errorDelta: 1,
      endedAt: 2200,
    });
    expect(getSession(SID_B)!.error_count).toBe(1);
    expect(getSession(SID_A)!.error_count).toBe(0);
    expect(searchSessions('has:error', 50, 0).map((r) => r.id)).toEqual([SID_B]);
    expect(countSearchSessions('has:error')).toBe(1);
  });

  it('survives a batch arriving before seq 0 and backfills metadata when it lands', () => {
    // seq 1 arrives first (reordered/concurrent flush): must not crash on the FK,
    // and must not lose events.
    expect(() =>
      ingestBatch({
        projectId: 'p', sessionId: SID_A, batchId: batchId('out-of-order'), ...recording('seed'), seq: 1,
        eventsJson: JSON.stringify([{ type: 3, data: {}, timestamp: 1500 }]),
        eventCount: 1, routeDelta: 1, errorDelta: 0, endedAt: 1600,
      }),
    ).not.toThrow();
    expect(getSession(SID_A)).not.toBeNull();
    expect(getSessionEvents(SID_A)).toHaveLength(1);

    // seq 0 lands late and backfills the real metadata.
    seedSession(SID_A, 1000); // url https://example.com/, started_at 1000
    const s = getSession(SID_A)!;
    expect(s.url).toBe('https://example.com/');
    expect(s.started_at).toBe(1000);
    expect(s.event_count).toBe(2); // both batches counted, none lost
    expect(s.page_count).toBe(2); // stub base 1 + seq1 routeDelta
    expect((getSessionEvents(SID_A) as { type: number }[]).map((event) => event.type)).toEqual([2, 3]);
  });

  it('deleteSessions removes sessions (and cascades events) and is idempotent', () => {
    seedSession(SID_A, 1000);
    seedSession(SID_B, 2000);
    expect(deleteSessions([SID_A])).toBe(1);
    expect(getSession(SID_A)).toBeNull();
    expect(getSessionEvents(SID_A)).toHaveLength(0); // cascaded
    expect(getSession(SID_B)).not.toBeNull();
    expect(deleteSessions([SID_A])).toBe(0); // already gone
    expect(deleteSessions([])).toBe(0); // empty no-op
  });

  it('listProjects returns distinct project ids', () => {
    seedSession(SID_A, 1000); // project 'p'
    ingestBatch({
      projectId: 'other', sessionId: SID_B, batchId: batchId('other-project'), ...recording('other-project'), seq: 0,
      eventsJson: JSON.stringify([{ type: 2, data: {}, timestamp: 1000 }]),
      eventCount: 1, routeDelta: 0, errorDelta: 0, endedAt: 2000, startedAt: 1000,
      url: 'https://example.com/', userAgent: 'ua',
      viewportW: 1280, viewportH: 720, deviceType: 'desktop',
    });
    expect(listProjects()).toEqual(['other', 'p']);
  });
});
