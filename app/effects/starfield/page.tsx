'use client';

import { Starfield } from '@/components/effects/starfield';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'starfield',
  overlay: {
    title: 'Starfield',
    subtitle: 'A classic starfield screensaver',
    details: [<span key="mouse">Move your mouse to control direction</span>],
  },
};

export default function StarfieldEffectPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <Starfield />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
