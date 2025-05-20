'use client';

import { CRT } from '@/components/effects/crt';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'crt',
  overlay: {
    title: 'CRT Effect',
    subtitle: 'This effect simulates an old cathode ray tube monitor',
    details: [],
  },
};

export default function CRTEffectPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <CRT />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
