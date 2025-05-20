'use client';

import { VoronoiFlow } from '@/components/effects/voronoi-flow';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'voronoi-flow',
  overlay: {
    title: 'Voronoi Flow',
    subtitle: 'Animated Voronoi diagram with flow field',
    details: [<span key="mouse">Drag to interact with cells</span>],
  },
};

export default function VoronoiFlowPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <VoronoiFlow />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
