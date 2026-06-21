'use server';

import { revalidatePath } from 'next/cache';
import { deleteSessions, deleteAllSessions } from '@/lib/queries';
import { setRetentionDays, reclaimSpace } from '@/lib/db';

/** Delete sessions by id, then refresh the list. Runs behind the dashboard
 *  middleware auth - anyone past the password may delete. */
export async function deleteSessionsAction(ids: string[]): Promise<void> {
  deleteSessions(ids);
  revalidatePath('/');
}

/** Persist the retention window (days; 0 = keep forever). */
export async function setRetentionAction(days: number): Promise<void> {
  setRetentionDays(days);
  revalidatePath('/settings');
}

/** Apply retention now and compact the database file. */
export async function reclaimSpaceAction(): Promise<void> {
  reclaimSpace();
  revalidatePath('/settings');
  revalidatePath('/');
}

/** Delete every recording. Destructive - gated by the armed confirm in the UI. */
export async function deleteAllSessionsAction(): Promise<void> {
  deleteAllSessions();
  revalidatePath('/settings');
  revalidatePath('/');
}
