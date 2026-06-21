import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

// Hex equivalents of the oklch design tokens in global.css.
const BG = '#151310';
const PANEL = '#1f1d19';
const INK = '#f0eeeb';
const MUTED = '#8c8982';
const ACCENT = '#d67a32';
const LINE = '#2b2825';

/** One dynamic OG template for every page. /og?title=...&description=... */
export function GET(req: Request): ImageResponse {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') ?? 'tinyreplay').slice(0, 100);
  const description = (
    searchParams.get('description') ??
    'Small self-hosted session replay.'
  ).slice(0, 160);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
          padding: 72,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: INK, letterSpacing: -1 }}>
          tinyreplay<span style={{ color: ACCENT }}>.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 13,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: ACCENT,
            }}
          >
            Self-hosted session replay
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.05,
              color: INK,
              maxWidth: 980,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 28, color: MUTED, maxWidth: 900 }}>
            {description}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: `1px solid ${LINE}`,
            paddingTop: 24,
            fontSize: 22,
            color: MUTED,
            fontFamily: 'monospace',
          }}
        >
          <span>session replay. self-hosted.</span>
          <span style={{ background: PANEL, padding: '6px 14px', borderRadius: 8 }}>
            docker compose up
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
