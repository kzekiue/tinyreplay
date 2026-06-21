'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CopyButton } from './CopyButton';
import { SDK_SNIPPET } from '@/lib/snippet';

/** First-run onboarding: setup steps beside the copyable SDK snippet, with a
 *  live "waiting for first recording" footer. No count endpoint - the SDK
 *  flushes ~every 5s, so we re-pull the RSC on the same cadence; the instant a
 *  session lands, Workspace re-renders out of first-run and this unmounts. */
export function FirstRun() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="empty">
      <div className="empty-grid">
        <div>
          <h2>Ready to record</h2>
          <p className="empty-lead">
            No sessions yet. Drop the snippet into any site, interact with the page, and
            recordings land here automatically.
          </p>
          <ol className="steps">
            <li>Add the SDK snippet to your site.</li>
            <li>Click, type, and navigate as a user would.</li>
            <li>Sessions flush every ~5s - then replay them here.</li>
          </ol>
        </div>

        <div className="snippet">
          <div className="snippet-head">
            index.html
            <CopyButton value={SDK_SNIPPET} label="Copy snippet" />
          </div>
          <pre className="scroll">
            <code>{SDK_SNIPPET}</code>
          </pre>
          <p className="snippet-note">The bundle is served from this server - no CDN, no external calls.</p>
        </div>
      </div>

      <div className="waiting" role="status">
        <span className="lamp is-rec" aria-hidden="true" />
        Listening for sessions - this view updates on its own.
      </div>
    </div>
  );
}
