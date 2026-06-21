import type { Metadata } from 'next';
import { AppHeader } from '@/components/app-header';
import { storeStats, getRetentionDays } from '@/lib/db';
import {
  RetentionSection,
  StorageSection,
  ThemeSection,
  MaskingSection,
  DangerSection,
} from '@/components/settings-sections';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings - TinyReplay' };

export default function SettingsPage() {
  const stats = storeStats();
  const retention = getRetentionDays();
  return (
    <div className="settings-shell">
      <AppHeader />
      <main className="settings-main">
        <header className="settings-title">
          <h1 className="page-title">Settings</h1>
          <p className="muted">Configuration for this self-hosted TinyReplay instance.</p>
        </header>
        <RetentionSection initial={retention} />
        <StorageSection sizeBytes={stats.sizeBytes} freeBytes={stats.freeBytes} sessions={stats.sessions} />
        <ThemeSection />
        <MaskingSection />
        <DangerSection count={stats.sessions} />
      </main>
    </div>
  );
}
