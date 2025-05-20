'use client';

import { Waves } from '@/components/effects/waves';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'waves',
  overlay: {
    title: 'The Endless Ocean',
    subtitle: 'The waves crash against the shore as you stand on the beach.',
    details: [
      <span key="desc">
        The vast ocean stretches out before you, hiding countless mysteries beneath its surface. A
        weathered boat is tied to a nearby dock.
      </span>,
    ],
  },
};

export default function WavesEffectPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <Waves />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}