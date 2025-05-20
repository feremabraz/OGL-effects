'use client';

import type { ReactNode } from 'react';

export default function EffectsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {children}
    </div>
  );
}
