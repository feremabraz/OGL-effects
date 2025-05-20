'use client';

import { PixelLandscape } from '@/components/effects/pixel-landscape';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'pixel-landscape',
  overlay: {
    title: 'Pixel Landscape',
    subtitle: 'Procedurally generated pixel art landscapes',
    details: [<span key="regen">Click to regenerate landscape</span>],
  },
};

export default function PixelLandscapePage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <PixelLandscape />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
