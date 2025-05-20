'use client';

import type { Key } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAtom } from 'jotai';
import { effectsAtom } from '@/store/effects';

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
  const [{ data: effects, isLoading, error }] = useAtom(effectsAtom);
  if (isLoading) return <div className="text-center py-10">Loading effects…</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error loading effects</div>;
  return (
    <div
      className={clsx(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto',
        className
      )}
    >
      {effects?.map((effect: Key) => (
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
