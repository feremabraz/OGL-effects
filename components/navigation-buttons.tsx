'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { atom, useAtom } from 'jotai';

// Define the list of effects
export const effectsAtom = atom<string[]>([
  'waves',
  'matrix',
  'crt',
  'video-crt',
  'game-terminal',
  'reaction-diffusion',
  'ray-marching',
  'simple-ray-marching',
  'metaballs',
  'game-of-life',
  'pixel-fire',
  'pixel-people',
  'pixel-landscape',
  'falling-sand',
]);

interface NavigationButtonsProps {
  currentEffect: string;
}

export function NavigationButtons({ currentEffect }: NavigationButtonsProps) {
  const [effects] = useAtom(effectsAtom);

  const currentIndex = effects.indexOf(currentEffect);
  const prevEffect = currentIndex > 0 ? effects[currentIndex - 1] : effects[effects.length - 1];
  const nextEffect = currentIndex < effects.length - 1 ? effects[currentIndex + 1] : effects[0];

  return (
    <div className="fixed top-4 right-4 flex gap-2 z-50">
      <Button variant="outline" size="icon" asChild>
        <Link href="/" aria-label="Home">
          <Home className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="outline" size="icon" asChild>
        <Link href={`/effects/${prevEffect}`} aria-label="Previous effect">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="outline" size="icon" asChild>
        <Link href={`/effects/${nextEffect}`} aria-label="Next effect">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
