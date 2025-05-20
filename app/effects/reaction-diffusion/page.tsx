'use client';

import { ReactionDiffusion } from '@/components/effects/reaction-diffusion';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'reaction-diffusion',
  overlay: {
    title: 'Reaction Diffusion',
    subtitle: 'Gray-Scott model simulation',
    details: [<span key="draw">Left-click to draw, right-click to erase</span>],
  },
};

export default function ReactionDiffusionPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <ReactionDiffusion />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
