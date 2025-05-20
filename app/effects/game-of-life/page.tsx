'use client';

import { GameOfLife } from '@/components/effects/game-of-life';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'game-of-life',
  overlay: {
    title: "Conway's Game of Life",
    subtitle: 'A cellular automaton with emergent complexity',
    details: [
      <span key="draw">
        <strong>Left-click and drag</strong> to draw cells, <strong>right-click</strong> to erase
      </span>,
      <span key="random">Try the pattern buttons or click "Random" to get started</span>,
    ],
  },
};

export default function GameOfLifePage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <GameOfLife />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
