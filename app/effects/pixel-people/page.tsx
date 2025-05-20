'use client';

import { PixelPeople } from '@/components/effects/pixel-people';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'pixel-people',
  overlay: {
    title: 'Pixel People',
    subtitle: 'Procedurally generated pixel art characters',
    details: [<span key="regen">Click to regenerate people</span>],
  },
};

export default function PixelPeoplePage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <PixelPeople />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
