import { useState } from 'react';
import type { MilestoneStatus } from '../lib/milestones';
import { useStore } from '../store';
import { wikiPageUrl, trainingUrl } from '../lib/wiki';
import { bottleneckFlags } from '../lib/completion';
import FlagBadges from './FlagBadge';

export const CATEGORY_STYLE: Record<string, string> = {
  gear: 'bg-cyan-900/60 text-cyan-200',
  combat: 'bg-rose-900/60 text-rose-200',
  slayer: 'bg-purple-900/60 text-purple-200',
};

export default function MilestoneCard({ status, compact }: { status: MilestoneStatus; compact?: boolean }) {
  const { milestone: m, done, ready, missing, reqs } = status;
  const goals = useStore((s) => s.goals);
  const addGoal = useStore((s) => s.addGoal);
  const setMilestoneDone = useStore((s) => s.setMilestoneDone);
  const manual = useStore((s) => s.milestones[m.id]);
  const [open, setOpen] = useState(false);
  const hasGoal = goals.some((g) => g.type === 'milestone' && g.target === m.id);
  const flags = bottleneckFlags(`${m.name} ${m.how}`, Object.keys(m.reqs.skills ?? {}));

  return (
    <li className={`card ${ready ? 'border-emerald-800/70' : ''} ${done ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`chip ${CATEGORY_STYLE[m.category]}`}>{m.category}</span>
            <span className="chip bg-zinc-800 text-zinc-400">{m.stage}</span>
            {done ? <span className="chip bg-emerald-900/60 text-emerald-200">done{m.auto && manual === undefined ? ' · auto' : ''}</span> : ready ? <span className="chip bg-emerald-500/20 text-emerald-200">ready now</span> : <span className="chip bg-zinc-800 text-zinc-300">{missing.length} to go</span>}
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug">
            <a href={wikiPageUrl(m.wiki)} target="_blank" rel="noreferrer" className="hover:underline">{m.name}</a>
          </h3>
          {!compact ? <p className="mt-1 text-xs text-zinc-300">{m.how}</p> : null}
          {missing.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {missing.slice(0, compact ? 2 : 6).map((r) =>
                r.kind === 'skill' ? (
                  <a key={r.key} href={trainingUrl(r.key.split(':')[1])} target="_blank" rel="noreferrer" className="chip bg-red-900/70 text-red-100">Needs {r.label} ↗</a>
                ) : (
                  <span key={r.key} className={`chip ${r.auto ? 'bg-amber-900/60 text-amber-100' : 'bg-zinc-800 text-zinc-300'}`}>{r.kind === 'combat' ? r.label : `${r.kind}: ${r.label}`}</span>
                ),
              )}
              {missing.length > (compact ? 2 : 6) ? <span className="chip bg-zinc-800 text-zinc-400">+{missing.length - (compact ? 2 : 6)}</span> : null}
            </div>
          ) : null}
          {!compact ? <FlagBadges flags={flags} /> : null}
          {!compact && reqs.length ? (
            <button type="button" className="mt-1.5 text-xs text-zinc-400 hover:text-zinc-200" onClick={() => setOpen(!open)}>
              {open ? '▾' : '▸'} requirements ({reqs.filter((r) => r.met).length}/{reqs.length})
            </button>
          ) : null}
          {open ? (
            <ul className="mt-1 space-y-0.5 border-l border-zinc-700 pl-2 text-xs">
              {reqs.map((r) => (
                <li key={r.key} className={r.met ? 'text-zinc-500 line-through' : 'text-zinc-200'}>{r.label}{!r.auto ? <span className="text-zinc-500"> · manual</span> : null}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {!m.auto || manual !== undefined ? (
            <button className="btn-ghost !px-2" onClick={() => setMilestoneDone(m.id, done ? undefined : true)}>{done ? 'Undo' : 'Done'}</button>
          ) : null}
          <button className="btn-ghost !px-2" disabled={hasGoal || done} onClick={() => addGoal({ type: 'milestone', target: m.id, label: m.name })}>
            {hasGoal ? 'Goal ✓' : '+ Goal'}
          </button>
        </div>
      </div>
    </li>
  );
}
