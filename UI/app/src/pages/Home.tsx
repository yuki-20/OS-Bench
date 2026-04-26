import { HeroSection } from '@/sections/HeroSection';
import { CapabilitiesSection } from '@/sections/CapabilitiesSection';
import { CoreFeaturesSection } from '@/sections/CoreFeaturesSection';
import { UseCasesSection } from '@/sections/UseCasesSection';
import { TestimonialsSection } from '@/sections/TestimonialsSection';
import { ArchitectureSection } from '@/sections/ArchitectureSection';
import { CtaBannerSection } from '@/sections/CtaBannerSection';

export default function Home() {
  return (
    <>
      <HeroSection />
      <CapabilitiesSection />
      <CoreFeaturesSection />
      <UseCasesSection />
      <TestimonialsSection />
      <ArchitectureSection />
      <CtaBannerSection />
    </>
  );
}
