'use client';

import type { Key } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { effects } from '@/store/effects-list';

function formatEffectName(name: string) {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

import clsx from 'clsx';

interface EffectsListProps {
  className?: string;
}

export function EffectsList({ className }: EffectsListProps) {
  return (
    <div
      className={clsx(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto',
        className
      )}
    >
      {effects.map((effect: Key) => (
        <Button key={effect} className="h-auto py-4 px-6">
          <Link href={`/effects/${effect}`}>
            <div className="flex flex-col items-center">
              <span className="text-lg font-medium">{formatEffectName(effect.toString())}</span>
            </div>
          </Link>
        </Button>
      ))}
    </div>
  );
}
