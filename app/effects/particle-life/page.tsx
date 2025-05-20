'use client';

import { ParticleLife } from '@/components/effects/particle-life';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'particle-life',
  overlay: {
    title: 'Particle Life',
    subtitle: 'Emergent behavior from simple rules',
    details: [
      <span key="drag">Drag to spawn new particles, scroll to zoom</span>,
    ],
  },
};

export default function ParticleLifePage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <ParticleLife />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
