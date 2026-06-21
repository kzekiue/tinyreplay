import { Workspace } from '@/components/Workspace';

export const dynamic = 'force-dynamic';

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const current = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  return <Workspace q={q ?? ''} page={current} />;
}
