import { FeatureCard } from '@/components/mdx/feature-card';

const FEATURES: { label: string; body: string }[] = [
  {
    label: 'Self-hosted',
    body: 'One app writing to a local SQLite file. Mount a data directory and your sessions survive restarts.',
  },
  {
    label: 'Privacy-conscious',
    body: 'Inputs are masked in the browser before replay events are sent to your server.',
  },
  {
    label: 'Fast Replay',
    body: 'Open a session and scrub straight to the moment you care about. No loading spinners in the way.',
  },
  {
    label: 'Not Analytics',
    body: 'No funnels, heatmaps, or user profiles to wade through. Only the recording of what happened.',
  },
];

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-12">
      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.label} label={f.label} index={i}>
            {f.body}
          </FeatureCard>
        ))}
      </div>
    </section>
  );
}
