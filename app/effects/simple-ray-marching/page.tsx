'use client';

import { SimpleRayMarching } from '@/components/effects/simple-ray-marching';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'simple-ray-marching',
  overlay: {
    title: 'Simple Ray Marching',
    subtitle: 'A minimal ray marching demo',
    details: [<span key="mouse">Drag to rotate camera, scroll to zoom</span>],
  },
};

export default function SimpleRayMarchingEffectPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <SimpleRayMarching />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
