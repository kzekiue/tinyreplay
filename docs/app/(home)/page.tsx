import { Hero } from '@/components/home/hero';
import { FeatureGrid } from '@/components/home/feature-grid';
import { ArchitectureSection } from '@/components/home/architecture-section';
import { Footer } from '@/components/home/footer';

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <ArchitectureSection />
      <Footer />
    </>
  );
}
