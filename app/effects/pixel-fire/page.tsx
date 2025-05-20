'use client';

import { PixelFire } from '@/components/effects/pixel-fire';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'pixel-fire',
  overlay: {
    title: 'Pixel Fire',
    subtitle: 'A retro fire simulation',
    details: [<span key="draw">Left-click to draw fire, right-click to erase</span>],
  },
};

export default function PixelFirePage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <PixelFire />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
