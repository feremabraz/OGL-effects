import type { ReactNode } from 'react';

interface EffectOverlayInfoProps {
  title: string;
  subtitle?: string;
  details?: ReactNode[];
}

export function EffectOverlayInfo({ title, subtitle, details }: EffectOverlayInfoProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-black/30 backdrop-blur-sm p-6 rounded-lg border border-white/20 pointer-events-auto">
        <h2 className="text-2xl font-bold mb-2 text-white">{title}</h2>
        {subtitle && <p className="text-white/80">{subtitle}</p>}
        {details &&
          details.map((d, i) => (
            <p key={i} className="text-white/60 text-sm mt-2">
              {d}
            </p>
          ))}
      </div>
    </div>
  );
}
