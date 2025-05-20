import { atomWithQuery } from 'jotai-tanstack-query';

export const effectsAtom = atomWithQuery<string[]>(() => ({
  queryKey: ['effects-folders'],
  queryFn: async () => {
    const res = await fetch('/api/effects');
    if (!res.ok) throw new Error('Failed to fetch effects list');
    return res.json();
  },
}));
