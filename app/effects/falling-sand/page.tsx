'use client';

import { FallingSand } from '@/components/effects/falling-sand';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'falling-sand',
  overlay: {
    title: 'Falling Sand',
    subtitle: 'A cellular automata sandbox',
    details: [
      <span key="draw">Left-click to add sand, right-click to erase, try different elements!</span>,
    ],
  },
};

export default function FallingSandPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <FallingSand />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
