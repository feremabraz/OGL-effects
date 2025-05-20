'use client';

import { VideoCRT } from '@/components/effects/video-crt';
import { EffectErrorBoundary } from '@/components/effect-error-boundary';
import { EffectOverlayInfo } from '@/components/effect-overlay-info';
import { NavigationButtons } from '@/components/navigation-buttons';

const effectConfig = {
  currentEffect: 'video-crt',
  overlay: {
    title: 'Video CRT',
    subtitle: 'CRT effect applied to a video source',
    details: [<span key="video">Drop a video file to play with CRT effect</span>],
  },
};

export default function VideoCRTPage() {
  return (
    <EffectErrorBoundary currentEffect={effectConfig.currentEffect}>
      <VideoCRT videoUrl="https://videos.pexels.com/video-files/6043511/6043511-uhd_2560_1440_24fps.mp4" />
      <NavigationButtons currentEffect={effectConfig.currentEffect} />
      <EffectOverlayInfo {...effectConfig.overlay} />
    </EffectErrorBoundary>
  );
}
