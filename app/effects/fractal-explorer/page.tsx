'use client';

import { FractalExplorer } from '@/components/effects/fractal-explorer';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'fractal-explorer',
  overlay: {
    title: 'Fractal Explorer',
    subtitle: 'Drag to pan, scroll to zoom',
    details: [
      <span key="keys">Use arrow keys to change fractal shape, press R to reset view</span>,
    ],
  },
};

export default function FractalExplorerPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <FractalExplorer />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
