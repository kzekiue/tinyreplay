import { z } from 'zod';

/** rrweb custom-event tag the SDK emits on SPA route changes (EventType.Custom = 5). */
export const ROUTE_EVENT_TAG = 'tinyreplay/route';
/** rrweb custom-event tag the SDK emits for uncaught JS errors. */
export const ERROR_EVENT_TAG = 'tinyreplay/error';
const RRWEB_CUSTOM_EVENT = 5;

const viewportSchema = z.object({
  w: z.number().int().nonnegative(),
  h: z.number().int().nonnegative(),
  deviceType: z.enum(['desktop', 'mobile', 'tablet']),
  userAgent: z.string(),
});

export const ingestSchema = z
  .object({
    projectId: z.string().min(1).max(64),
    // Optional ingestion token (also accepted as an Authorization bearer
    // header). Carried in the body because sendBeacon cannot set headers.
    // Checked by the route, never persisted.
    token: z.string().max(256).optional(),
    sessionId: z.string().uuid(),
    // New SDKs send a stable id for each payload. Optional only so existing
    // deployed SDK bundles remain ingestible during rollout.
    batchId: z.string().uuid().optional(),
    recordingInstanceId: z.string().uuid().optional(),
    recordingOrder: z.number().int().nonnegative().optional(),
    seq: z.number().int().min(0),
    startedAt: z.number().int().positive().optional(),
    url: z.string().optional(),
    viewport: viewportSchema.optional(),
    events: z.array(z.unknown()).min(1).max(500),
  })
  // seq 0 establishes the session, so it must carry the session metadata.
  .superRefine((data, ctx) => {
    const recordingFields = [data.batchId, data.recordingInstanceId, data.recordingOrder];
    if (recordingFields.some((value) => value !== undefined) && recordingFields.some((value) => value === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['batchId'],
        message: 'batchId, recordingInstanceId, and recordingOrder must be supplied together',
      });
    }
    if (data.seq === 0) {
      if (data.startedAt === undefined)
        ctx.addIssue({ code: 'custom', path: ['startedAt'], message: 'required when seq=0' });
      if (data.url === undefined)
        ctx.addIssue({ code: 'custom', path: ['url'], message: 'required when seq=0' });
      if (data.viewport === undefined)
        ctx.addIssue({ code: 'custom', path: ['viewport'], message: 'required when seq=0' });
    }
  });

export type IngestBody = z.infer<typeof ingestSchema>;

/** Count custom events carrying a given tag in a batch. */
function countCustomEvents(events: unknown[], tag: string): number {
  let n = 0;
  for (const e of events) {
    if (
      e &&
      typeof e === 'object' &&
      (e as { type?: unknown }).type === RRWEB_CUSTOM_EVENT &&
      (e as { data?: { tag?: unknown } }).data?.tag === tag
    ) {
      n++;
    }
  }
  return n;
}

/** Count route-change custom events in a batch (drives page_count server-side). */
export const countRouteEvents = (events: unknown[]): number => countCustomEvents(events, ROUTE_EVENT_TAG);

/** Count error custom events in a batch (drives error_count server-side). */
export const countErrorEvents = (events: unknown[]): number => countCustomEvents(events, ERROR_EVENT_TAG);
