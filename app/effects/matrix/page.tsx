'use client';

import { Matrix } from '@/components/effects/matrix';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'matrix',
  overlay: {
    title: 'Matrix Effect',
    subtitle: 'This effect works as a full-screen background',
    details: [],
  },
};

export default function MatrixPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <Matrix />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
