/**
 * Single source of truth for the documented limits, mirrored from the code:
 *   packages/sdk/src/recorder.ts, packages/sdk/src/types.ts,
 *   packages/sdk/src/transport.ts, apps/server/src/lib/validate.ts,
 *   apps/server/src/lib/config.ts
 * Keep these rows in sync if those constants change.
 */
type Row = { name: string; value: string; note: string };

const SDK_ROWS: Row[] = [
  { name: 'flushInterval', value: '5000 ms', note: 'Batch flush cadence (configurable).' },
  { name: 'maxDurationMs', value: '30 min', note: 'Recording auto-stops and flushes (configurable).' },
  { name: 'maskAllInputs', value: 'true', note: 'All input/textarea/select values masked at capture.' },
  { name: 'Events per batch', value: '500', note: 'A flush never exceeds this; overflow rolls forward.' },
  { name: 'Event buffer ceiling', value: '5000', note: 'Hard cap; new events dropped when a network stalls.' },
  { name: 'Beacon chunk', value: '120 events', note: 'Unload flushes go out in small sendBeacon chunks.' },
  { name: 'Transport retry', value: '1× after 2 s', note: 'Then the batch is dropped - never blocks the page.' },
];

const SERVER_ROWS: Row[] = [
  { name: 'Events per request', value: '1–500', note: 'Enforced by the ingest schema.' },
  { name: 'projectId length', value: '1–64 chars', note: 'Validated on ingest.' },
  { name: 'token length', value: '≤ 256 chars', note: 'Optional ingest token.' },
  { name: 'MAX_PAYLOAD_BYTES', value: '5,000,000', note: 'Larger bodies get 413 (configurable).' },
  { name: 'RATE_LIMIT_PER_MIN', value: '100 / IP', note: 'Ingest requests per minute per IP (configurable).' },
];

function Table({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <div className="tr-raise my-5 overflow-hidden rounded-[var(--radius)]">
      <div className="tr-label border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2">
        {caption}
      </div>
      <table className="w-full border-collapse text-[0.86rem]">
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.name}
              className={i % 2 ? 'bg-[var(--desk)]/40' : undefined}
            >
              <td className="whitespace-nowrap border-t border-[var(--line)] px-4 py-2.5 font-mono text-[var(--ink)]">
                {r.name}
              </td>
              <td className="whitespace-nowrap border-t border-[var(--line)] px-4 py-2.5 font-mono tabular-nums text-[var(--accent-ink)]">
                {r.value}
              </td>
              <td className="border-t border-[var(--line)] px-4 py-2.5 text-[var(--muted)]">
                {r.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** <TinyReplayLimitsTable scope="sdk" | "server" | "all" /> */
export function TinyReplayLimitsTable({
  scope = 'all',
}: {
  scope?: 'sdk' | 'server' | 'all';
}) {
  return (
    <>
      {scope !== 'server' && <Table caption="SDK · recording" rows={SDK_ROWS} />}
      {scope !== 'sdk' && <Table caption="Server · ingest" rows={SERVER_ROWS} />}
    </>
  );
}
