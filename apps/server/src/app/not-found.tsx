import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { ArrowLeftIcon } from '@/components/icons';

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="page-msg">
        <p className="mono muted">404</p>
        <h1 className="page-title">Session not found</h1>
        <p className="muted">
          TinyReplay could not find a recording with that ID. It may have been deleted, or the link
          may be wrong.
        </p>
        <Link href="/" className="btn">
          <ArrowLeftIcon size={14} /> Back to sessions
        </Link>
      </main>
    </>
  );
}
