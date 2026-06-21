import { Recorder } from './recorder';
import type { TinyReplayConfig } from './types';

export type { TinyReplayConfig, DeviceType, ViewportMeta, IngestPayload } from './types';

let recorder: Recorder | null = null;

/**
 * Start recording the current page. Safe to call multiple times - subsequent
 * calls are a no-op while a recording is already active.
 */
function init(config: TinyReplayConfig): void {
  if (recorder) return;
  if (typeof window === 'undefined') return; // never run during SSR
  if (!config || !config.endpoint || !config.projectId) {
    console.error('[TinyReplay] init() requires { endpoint, projectId }');
    return;
  }
  recorder = new Recorder(config);
  recorder.start();
}

/** Stop recording and flush any buffered events. */
async function stop(): Promise<void> {
  if (!recorder) return;
  const r = recorder;
  recorder = null;
  await r.stop();
}

export const TinyReplay = { init, stop };
export default TinyReplay;
