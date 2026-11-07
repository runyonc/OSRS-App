import { useState } from 'react';
import type { Bottleneck } from '../lib/types';
import { useStore } from '../store';

const ICON: Record<Bottleneck, string> = { Herblore: '🌿', Farming: '🌱', Construction: '🔨', Runecraft: '🔮', Slayer: '💀' };

export default function FlagBadges({ flags }: { flags: Bottleneck[] }) {
  const notes = useStore((s) => s.flags);
  const setFlagNote = useStore((s) => s.setFlagNote);
  const [open, setOpen] = useState<Bottleneck | null>(null);
  if (!flags.length) return null;
  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap gap-1">
        {flags.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setOpen(open === f ? null : f)}
            className={`chip border ${open === f ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}
            title={`Ironman bottleneck: ${f}`}
          >
            <span aria-hidden>{ICON[f]}</span> {f}
          </button>
        ))}
      </div>
      {open ? (
        <div className="mt-1.5 rounded-md border border-amber-900/50 bg-amber-950/30 p-2 text-xs">
          <div className="mb-1 font-medium text-amber-200">{open} · save vs. use</div>
          <textarea
            className="input min-h-[3.5rem] text-xs"
            value={notes[open]}
            onChange={(e) => setFlagNote(open, e.target.value)}
            aria-label={`${open} note`}
          />
        </div>
      ) : null}
    </div>
  );
}
