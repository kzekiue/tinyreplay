import Link from 'next/link';
import {
  ThemeControl,
  HealthProvider,
  HealthBanner,
  SettingsLink,
} from './faceplate-controls';
import { CommandPalette } from './command-palette';
import { listProjectStats } from '@/lib/queries';

/** The faceplate: one edge-to-edge command strip, identical on every surface -
 *  brand + project scope on the left, instruments (⌘K, settings, theme) on the
 *  right. The scope selector hides itself when there's nothing to choose. */
export function AppHeader() {
  const projects = listProjectStats();
  return (
    <HealthProvider>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="fp-zone fp-left">
            <Link href="/" className="brand" aria-label="tinyreplay - all sessions">
              <span className="brand-name">
                tinyreplay<span className="brand-dot">.</span>
              </span>
              <span className="brand-tag">session replay</span>
            </Link>
          </div>

          <div className="fp-zone fp-right">
            <CommandPalette projects={projects} />
            <SettingsLink />
            <ThemeControl />
          </div>
        </div>
      </header>
      <HealthBanner />
    </HealthProvider>
  );
}
