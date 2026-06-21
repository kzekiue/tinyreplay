'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page-msg">
      <h1 className="page-title">Something went wrong</h1>
      <p className="muted">
        TinyReplay hit an unexpected error. Your recordings are safe. Reload the dashboard to try again.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Reload dashboard
      </button>
    </main>
  );
}
