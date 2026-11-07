import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useLevels } from '../hooks/useDerived';
import { buildQuestList, stepStatus, type QuestStatus, type StepStatus } from '../lib/quests';
import { levelOf, stepBlockers } from '../lib/completion';
import { wikiPageUrl } from '../lib/wiki';
import { skillLabel } from '../lib/xp';
import SkillIcon from './SkillIcon';
import type { GuideStep } from '../lib/types';

const QUEST_STATUS_STYLE: Record<QuestStatus, string> = {
  done: 'bg-emerald-900/60 text-emerald-200',
  'in-progress': 'bg-amber-500/20 text-amber-200',
  'not-started': 'bg-zinc-800 text-zinc-400',
  unknown: 'bg-zinc-800 text-zinc-500',
};
const STEP_STATUS_STYLE: Record<StepStatus, string> = {
  done: 'bg-emerald-900/60 text-emerald-200',
  'in-progress': 'bg-amber-500/20 text-amber-200',
  skipped: 'bg-zinc-800 text-zinc-500',
  pending: 'bg-sky-900/60 text-sky-200',
};
const TYPE_STYLE: Record<string, string> = {
  quest: 'bg-sky-900/60 text-sky-200', miniquest: 'bg-indigo-900/60 text-indigo-200', unlock: 'bg-fuchsia-900/60 text-fuchsia-200',
  skilling: 'bg-emerald-900/60 text-emerald-200', diary: 'bg-orange-900/60 text-orange-200', gather: 'bg-lime-900/60 text-lime-200',
};

export default function Browse() {
  const [view, setView] = useState<'quests' | 'steps'>('quests');
  return (
    <section className="space-y-3">
      <div className="flex gap-1">
        <button type="button" onClick={() => setView('quests')} className={`chip border ${view === 'quests' ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}><SkillIcon skill="quest" size={13} /> Quests</button>
        <button type="button" onClick={() => setView('steps')} className={`chip border ${view === 'steps' ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}><SkillIcon skill="diary" size={13} /> All guide steps</button>
      </div>
      {view === 'quests' ? <QuestList /> : <AllSteps />}
    </section>
  );
}

function QuestList() {
  const player = useStore((s) => s.player);
  const steps = useStore((s) => s.guide.steps);
  const reqs = useStore((s) => s.questReqs);
  const { levels } = useLevels();
  const [filter, setFilter] = useState<'all' | QuestStatus>('all');
  const [kind, setKind] = useState<'all' | 'quests' | 'miniquests'>('all');
  const [q, setQ] = useState('');
  const list = useMemo(() => buildQuestList(player, steps, reqs), [player, steps, reqs]);
  const shown = list.filter((e) => (filter === 'all' || e.status === filter) && (kind === 'all' || (kind === 'miniquests') === e.miniquest) && (!q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase())));
  const counts = { done: list.filter((e) => e.status === 'done').length, inProgress: list.filter((e) => e.status === 'in-progress').length, total: list.length };
  const qpDone = list.filter((e) => e.status === 'done' && !e.miniquest).reduce((s, e) => s + (e.qp ?? 0), 0);
  const qpTotal = list.filter((e) => !e.miniquest).reduce((s, e) => s + (e.qp ?? 0), 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-zinc-400">
        <span><b className="text-zinc-100">{counts.done}</b> / {counts.total} done</span>
        <span><b className="text-amber-200">{counts.inProgress}</b> in progress</span>
        <span><SkillIcon skill="quest" size={12} /> <b className="text-zinc-100">{qpDone}</b> / {qpTotal} QP in the guide</span>
      </div>
      <input id="quest-search" className="input" placeholder="Search quests…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-1 text-xs">
        {(['all', 'not-started', 'in-progress', 'done'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`chip border ${filter === f ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{f.replace('-', ' ')}</button>
        ))}
        <span className="mx-1 text-zinc-700">|</span>
        {(['all', 'quests', 'miniquests'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`chip border ${kind === k ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{k}</button>
        ))}
      </div>
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900">
        {shown.map((e) => {
          const unmet = (e.skills ?? []).filter((s) => levelOf(levels, s.skill) < s.level);
          return (
            <li key={e.name} className="flex items-start gap-2 px-2 py-1.5">
              <span className="w-8 shrink-0 pt-0.5 text-right text-[10px] tabular-nums text-zinc-500">{e.guideOrder ? `#${e.guideOrder}` : ''}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <a className="text-sm hover:underline" href={wikiPageUrl(e.wiki ?? e.name)} target="_blank" rel="noreferrer">{e.name}</a>
                  {e.miniquest ? <span className="chip bg-indigo-900/60 text-indigo-200">miniquest</span> : null}
                  {e.qp ? <span className="text-[10px] text-zinc-500">{e.qp} QP</span> : null}
                </div>
                {unmet.length && e.status !== 'done' ? (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {unmet.map((s) => <span key={s.skill} className={`chip ${s.boostable ? 'bg-amber-900/60 text-amber-100' : 'bg-red-900/60 text-red-100'}`}><SkillIcon skill={s.skill} size={11} /> {s.level} {skillLabel(s.skill)} (you: {levelOf(levels, s.skill)})</span>)}
                  </div>
                ) : null}
              </div>
              <span className={`chip shrink-0 ${QUEST_STATUS_STYLE[e.status]}`}>{e.status === 'unknown' ? 'not in import' : e.status.replace('-', ' ')}</span>
            </li>
          );
        })}
      </ul>
      {!shown.length ? <p className="text-xs text-zinc-500">Nothing matches.</p> : null}
    </div>
  );
}

function AllSteps() {
  const steps = useStore((s) => s.guide.steps);
  const player = useStore((s) => s.player);
  const progress = useStore((s) => s.progress);
  const reqs = useStore((s) => s.questReqs);
  const markDone = useStore((s) => s.markDone);
  const skipStep = useStore((s) => s.skipStep);
  const unskipStep = useStore((s) => s.unskipStep);
  const { levels } = useLevels();
  const [filter, setFilter] = useState<'all' | StepStatus>('all');
  const [type, setType] = useState<'all' | GuideStep['type']>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => steps.map((s) => ({ step: s, status: stepStatus(s, player, progress) })), [steps, player, progress]);
  const shown = rows.filter((r) => (filter === 'all' || r.status === filter) && (type === 'all' || r.step.type === type) && (!q.trim() || r.step.name.toLowerCase().includes(q.trim().toLowerCase()) || r.step.location.toLowerCase().includes(q.trim().toLowerCase())));
  const counts = { done: rows.filter((r) => r.status === 'done').length, skipped: rows.filter((r) => r.status === 'skipped').length };
  const firstPending = rows.find((r) => r.status === 'pending' || r.status === 'in-progress')?.step.id;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-zinc-400">
        <span><b className="text-zinc-100">{counts.done}</b> / {steps.length} steps done</span>
        {counts.skipped ? <span>{counts.skipped} skipped</span> : null}
        <span>{steps.length - counts.done - counts.skipped} to go</span>
      </div>
      <input id="step-search" className="input" placeholder="Search steps or locations…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-1 text-xs">
        {(['all', 'pending', 'in-progress', 'done', 'skipped'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`chip border ${filter === f ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{f.replace('-', ' ')}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {(['all', 'quest', 'miniquest', 'skilling', 'diary', 'unlock'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`chip border ${type === t ? 'border-amber-500 ' + (TYPE_STYLE[t] ?? 'bg-amber-500/20 text-amber-200') : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{t}</button>
        ))}
      </div>
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900">
        {shown.map(({ step, status }) => {
          const isOpen = open === step.id;
          const blockers = status === 'done' ? [] : stepBlockers(step, reqs, levels);
          return (
            <li key={step.id} className={`px-2 py-1.5 ${step.id === firstPending ? 'bg-amber-500/5' : ''}`}>
              <div className="flex items-start gap-2">
                <span className="w-8 shrink-0 pt-0.5 text-right text-[10px] tabular-nums text-zinc-500">#{step.order + 1}</span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : step.id)}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`chip ${TYPE_STYLE[step.type] ?? 'bg-zinc-800'}`}>{step.type}</span>
                    <span className={`text-sm ${status === 'done' ? 'text-zinc-500 line-through' : status === 'skipped' ? 'text-zinc-500' : ''}`}>{step.name}</span>
                    {step.id === firstPending ? <span className="chip bg-amber-500/20 text-amber-200">next</span> : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-zinc-500">
                    {step.location ? <span>📍 {step.location}</span> : null}
                    {step.qp ? <span>{step.qp} QP</span> : null}
                    {Object.entries(step.levelsAfter).map(([s, l]) => <span key={s}><SkillIcon skill={s} size={11} /> {l}</span>)}
                    {blockers.map((b) => <span key={b.skill} className={b.boostable ? 'text-amber-300' : 'text-red-300'}>needs {b.needed} {skillLabel(b.skill)} (you: {b.have})</span>)}
                  </div>
                </button>
                <span className={`chip shrink-0 ${STEP_STATUS_STYLE[status]}`}>{status.replace('-', ' ')}</span>
              </div>
              {isOpen ? (
                <div className="ml-10 mt-1.5 space-y-1.5">
                  {step.notes.length ? (
                    <ul className="space-y-0.5 border-l border-zinc-700 pl-2 text-xs text-zinc-300">
                      {step.notes.map((n, i) => { const depth = (n.match(/^\s*/)?.[0].length ?? 0) / 2; return <li key={i} style={{ paddingLeft: depth * 10 }}>{n.trim().replace(/^- /, '↳ ')}</li>; })}
                    </ul>
                  ) : <p className="text-xs text-zinc-500">No notes for this step.</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {step.quest ? <a className="btn-ghost !py-1 text-xs" href={wikiPageUrl(step.quest)} target="_blank" rel="noreferrer">wiki ↗</a> : null}
                    {status === 'done' && progress[step.id]?.done ? <button className="btn-ghost !py-1 text-xs" onClick={() => markDone(step.id, undefined)}>undo done</button> : status !== 'done' ? <button className="btn-ghost !py-1 text-xs" onClick={() => markDone(step.id, true)}>mark done</button> : null}
                    {status === 'done' && !progress[step.id]?.done ? <button className="btn-ghost !py-1 text-xs" onClick={() => markDone(step.id, false)}>mark not done</button> : null}
                    {status === 'skipped' ? <button className="btn-ghost !py-1 text-xs" onClick={() => unskipStep(step.id)}>unskip</button> : status !== 'done' ? <button className="btn-ghost !py-1 text-xs" onClick={() => skipStep(step.id, 'skipped')}>skip</button> : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!shown.length ? <p className="text-xs text-zinc-500">Nothing matches.</p> : null}
    </div>
  );
}
