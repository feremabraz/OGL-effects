'use client';

import { Metaballs } from '@/components/effects/metaballs';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'metaballs',
  overlay: {
    title: 'Metaballs',
    subtitle: 'Organic blobby shapes that merge together',
    details: [<span key="move">Move your mouse to interact with the metaballs</span>],
  },
};

export default function MetaballsPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <Metaballs />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
