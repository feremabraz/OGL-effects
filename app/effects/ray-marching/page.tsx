'use client';

import { RayMarching } from '@/components/effects/ray-marching';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'ray-marching',
  overlay: {
    title: 'Ray Marching',
    subtitle: 'Signed distance field rendering',
    details: [<span key="mouse">Drag to rotate camera, scroll to zoom</span>],
  },
};

export default function RayMarchingEffectPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <RayMarching />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
