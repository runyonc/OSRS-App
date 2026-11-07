import { useState } from 'react';
import type { NextUpItem } from '../lib/completion';
import { stepFlags } from '../lib/completion';
import { useStore } from '../store';
import { trainingUrl, wikiPageUrl } from '../lib/wiki';
import { skillLabel } from '../lib/xp';
import FlagBadges from './FlagBadge';
import { useLevels } from '../hooks/useDerived';
import { levelOf } from '../lib/completion';

const TYPE_STYLE: Record<string, string> = {
  quest: 'bg-sky-900/60 text-sky-200',
  miniquest: 'bg-indigo-900/60 text-indigo-200',
  unlock: 'bg-fuchsia-900/60 text-fuchsia-200',
  skilling: 'bg-emerald-900/60 text-emerald-200',
  diary: 'bg-orange-900/60 text-orange-200',
  gather: 'bg-lime-900/60 text-lime-200',
};

export default function StepCard({ item, index }: { item: NextUpItem; index: number }) {
  const { step, inProgress, blockers, helps } = item;
  const reqs = useStore((s) => s.questReqs);
  const markDone = useStore((s) => s.markDone);
  const skipStep = useStore((s) => s.skipStep);
  const addTodo = useStore((s) => s.addTodo);
  const { levels } = useLevels();
  const [open, setOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState('');
  const [added, setAdded] = useState(false);
  const flags = stepFlags(step, reqs);
  const levelsAfter = Object.entries(step.levelsAfter);
  const linkTitle = step.quest ?? (step.diary ? `${step.diary.area === 'All' ? 'Achievement Diary' : `${step.diary.area} Diary`}` : undefined);
  const trainHave = step.train ? levelOf(levels, step.train.skill) : undefined;

  return (
    <li className={`card ${inProgress ? 'border-amber-700/70' : ''}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-zinc-500">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`chip ${TYPE_STYLE[step.type] ?? 'bg-zinc-800'}`}>{step.type}</span>
            {inProgress ? <span className="chip bg-amber-500/20 text-amber-200">In progress</span> : null}
            {step.partial ? <span className="chip bg-zinc-800 text-zinc-300">partial</span> : null}
            {helps.map((h) => <span key={h} className="chip bg-violet-900/60 text-violet-200">Helps: {h}</span>)}
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug">
            {linkTitle ? (
              <a href={wikiPageUrl(linkTitle)} target="_blank" rel="noreferrer" className="hover:underline">{step.name}</a>
            ) : step.name}
          </h3>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-400">
            {step.location ? <span>📍 {step.location}</span> : null}
            {step.qp ? <span>{step.qp} QP</span> : null}
            {step.train && trainHave !== undefined ? <span>you: {trainHave}/{step.train.level}</span> : null}
          </div>
          {levelsAfter.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-zinc-500" title="Levels the guide expects after this step, if you follow its lamp choices">guide after:</span>
              {levelsAfter.map(([skill, lvl]) => (
                <span key={skill} className="chip bg-zinc-800 text-zinc-300" title={`${step.xpGained[skill]?.toLocaleString()} XP`}>
                  {skillLabel(skill)} → {lvl}
                </span>
              ))}
            </div>
          ) : null}
          {blockers.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {blockers.map((b) => (
                <a
                  key={b.skill}
                  href={trainingUrl(b.skill)}
                  target="_blank"
                  rel="noreferrer"
                  className={`chip ${b.boostable ? 'bg-amber-900/70 text-amber-100' : 'bg-red-900/70 text-red-100'}`}
                  title={b.boostable ? 'Boostable — open training guide' : 'Open training guide'}
                >
                  Needs {b.needed} {skillLabel(b.skill)} (you: {b.have}){b.boostable ? ' · boostable' : ''} ↗
                </a>
              ))}
            </div>
          ) : null}
          <FlagBadges flags={flags} />
          {step.notes.length ? (
            <button type="button" className="mt-1.5 text-xs text-zinc-400 hover:text-zinc-200" onClick={() => setOpen(!open)}>
              {open ? '▾' : '▸'} details ({step.notes.length})
            </button>
          ) : null}
          {open ? (
            <ul className="mt-1 space-y-1 border-l border-zinc-700 pl-2 text-xs text-zinc-300">
              {step.notes.map((n, i) => {
                const depth = (n.match(/^\s*/)?.[0].length ?? 0) / 2;
                return <li key={i} style={{ paddingLeft: depth * 10 }}>{n.trim().replace(/^- /, '↳ ')}</li>;
              })}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="btn-ghost" onClick={() => markDone(step.id, true)}>Done</button>
            <button className="btn-ghost" onClick={() => setSkipping(!skipping)}>Skip</button>
            <button className="btn-ghost" disabled={added} onClick={() => { addTodo(step.name, [], step.id); setAdded(true); }}>
              {added ? 'Added ✓' : 'Add to Todo'}
            </button>
          </div>
          {skipping ? (
            <form
              className="mt-2 flex gap-1.5"
              onSubmit={(e) => { e.preventDefault(); skipStep(step.id, reason.trim() || 'skipped'); setSkipping(false); }}
            >
              <input className="input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              <button className="btn-danger" type="submit">Hide</button>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}
