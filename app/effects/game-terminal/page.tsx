'use client';

import { GameTerminal } from '@/components/effects/game-terminal';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'game-terminal',
  overlay: {
    title: 'Game Terminal Effect',
    subtitle: 'Type commands to interact with the text adventure',
    details: [<span key="commands">Try: look, inventory, take key, go north, help</span>],
  },
};

export default function GameTerminalPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <GameTerminal />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
