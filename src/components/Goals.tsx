import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Goal, GoalType, DiaryTier } from '../lib/types';
import { useLevels } from '../hooks/useDerived';
import { levelOf, questStatus, diaryProgress, bottleneckFlags, allPrereqQuests } from '../lib/completion';
import { progressToLevel, skillLabel, SKILLS } from '../lib/xp';
import { QUEST_NAMES, wikiPageUrl } from '../lib/wiki';
import { DIARY_TIERS } from '../lib/wikitext';
import FlagBadges from './FlagBadge';
import { MAX_PINNED_GOALS } from '../config';

const DIARY_AREAS = ['Ardougne', 'Desert', 'Falador', 'Fremennik', 'Kandarin', 'Karamja', 'Kourend & Kebos', 'Lumbridge & Draynor', 'Morytania', 'Varrock', 'Western Provinces', 'Wilderness'];

export default function Goals() {
  const goals = useStore((s) => s.goals);
  const [adding, setAdding] = useState(false);
  const active = goals.filter((g) => !g.done).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt - b.createdAt);
  const done = goals.filter((g) => g.done);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">{goals.filter((g) => g.pinned).length}/{MAX_PINNED_GOALS} pinned · pinned goals get a "next step" line on Next Up</p>
        <button className="btn-primary whitespace-nowrap" onClick={() => setAdding(!adding)}>{adding ? 'Close' : '+ Goal'}</button>
      </div>
      {adding ? <AddGoal onDone={() => setAdding(false)} /> : null}
      <ul className="space-y-2">
        {active.map((g) => <GoalCard key={g.id} goal={g} />)}
      </ul>
      {!active.length && !adding ? <p className="card text-sm text-zinc-300">No goals yet. Add a skill level, a quest, a diary tier, or anything in your own words.</p> : null}
      {done.length ? (
        <details className="card text-xs">
          <summary className="cursor-pointer text-zinc-300">Completed goals ({done.length})</summary>
          <ul className="mt-1 space-y-1">{done.map((g) => <GoalCard key={g.id} goal={g} compact />)}</ul>
        </details>
      ) : null}
    </section>
  );
}

function AddGoal({ onDone }: { onDone: () => void }) {
  const addGoal = useStore((s) => s.addGoal);
  const [type, setType] = useState<GoalType>('skill');
  const [skill, setSkill] = useState('agility');
  const [level, setLevel] = useState(70);
  const [quest, setQuest] = useState('');
  const [area, setArea] = useState('Ardougne');
  const [tier, setTier] = useState<DiaryTier>('Medium');
  const [text, setText] = useState('');
  const questOptions = useMemo(() => Array.from(QUEST_NAMES).sort(), []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'skill') addGoal({ type, target: `${skill}:${level}`, label: `${level} ${skillLabel(skill)}` });
    else if (type === 'quest') { if (!quest) return; addGoal({ type, target: quest, label: quest }); }
    else if (type === 'diary') addGoal({ type, target: `${area}:${tier}`, label: `${area} ${tier}` });
    else { if (!text.trim()) return; addGoal({ type, target: text.trim(), label: text.trim() }); }
    onDone();
  };

  return (
    <form onSubmit={submit} className="card space-y-2 text-sm">
      <div className="flex gap-1">
        {(['skill', 'quest', 'diary', 'text'] as GoalType[]).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`chip border ${type === t ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{t}</button>
        ))}
      </div>
      {type === 'skill' ? (
        <div className="flex gap-2">
          <select className="input" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill">
            {SKILLS.map((s) => <option key={s} value={s}>{skillLabel(s)}</option>)}
          </select>
          <input className="input w-24" type="number" min={2} max={99} value={level} onChange={(e) => setLevel(Number(e.target.value))} aria-label="Level" />
        </div>
      ) : null}
      {type === 'quest' ? (
        <>
          <input className="input" list="quest-names" placeholder="Quest name" value={quest} onChange={(e) => setQuest(e.target.value)} aria-label="Quest" />
          <datalist id="quest-names">{questOptions.map((q) => <option key={q} value={q} />)}</datalist>
        </>
      ) : null}
      {type === 'diary' ? (
        <div className="flex gap-2">
          <select className="input" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Diary area">
            {DIARY_AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select className="input w-32" value={tier} onChange={(e) => setTier(e.target.value as DiaryTier)} aria-label="Tier">
            {DIARY_TIERS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      ) : null}
      {type === 'text' ? <input className="input" placeholder="e.g. Fire cape, base 60s, full graceful" value={text} onChange={(e) => setText(e.target.value)} aria-label="Goal" /> : null}
      <div className="flex justify-end gap-1.5">
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn-primary">Add goal</button>
      </div>
    </form>
  );
}

function GoalCard({ goal, compact }: { goal: Goal; compact?: boolean }) {
  const player = useStore((s) => s.player);
  const reqs = useStore((s) => s.questReqs);
  const progress = useStore((s) => s.progress);
  const steps = useStore((s) => s.guide.steps);
  const togglePin = useStore((s) => s.togglePin);
  const removeGoal = useStore((s) => s.removeGoal);
  const toggleGoalDone = useStore((s) => s.toggleGoalDone);
  const togglePrereq = useStore((s) => s.togglePrereq);
  const addTodo = useStore((s) => s.addTodo);
  const { levels } = useLevels();
  const [pinError, setPinError] = useState(false);

  // Auto progress
  let bar: number | undefined;
  let status = '';
  let autoDone = false;
  if (goal.type === 'skill') {
    const [skill, lvlStr] = goal.target.split(':');
    const target = Number(lvlStr);
    const have = levels[skill];
    const haveLevel = levelOf(levels, skill);
    bar = have?.xp != null ? progressToLevel(have.xp, target) : Math.min(1, haveLevel / target);
    autoDone = haveLevel >= target;
    status = `${haveLevel} / ${target}${have?.xp != null ? ` · ${have.xp.toLocaleString()} XP` : ''}`;
  } else if (goal.type === 'quest') {
    const st = questStatus(goal.target, player);
    autoDone = st === 2;
    status = st === 2 ? 'Completed' : st === 1 ? 'In progress' : st === 0 ? 'Not started' : player ? 'Not in import (tick manually)' : 'No import yet';
  } else if (goal.type === 'diary') {
    const [area, tier] = goal.target.split(':');
    const d = diaryProgress(player, area, tier);
    autoDone = d.complete;
    bar = d.total ? d.done / d.total : 0;
    status = d.total ? `${d.done} / ${d.total} tasks${d.complete ? ' · complete' : ''}` : player ? 'No diary data in import' : 'No import yet';
  }

  // Prerequisites derived from the guide/wiki
  const prereqs = useMemo(() => {
    const list: { key: string; label: string; done: boolean; auto: boolean; link?: string }[] = [];
    if (goal.type === 'quest') {
      const r = reqs[goal.target];
      for (const s of r?.skills ?? []) {
        const have = levelOf(levels, s.skill);
        list.push({ key: `skill:${s.skill}:${s.level}`, label: `${s.level} ${skillLabel(s.skill)} (you: ${have})${s.boostable ? ' · boostable' : ''}`, done: have >= s.level, auto: true });
      }
      if (r?.questPoints) list.push({ key: `qp:${r.questPoints}`, label: `${r.questPoints} quest points`, done: false, auto: false });
      for (const q of allPrereqQuests(goal.target, reqs)) {
        const st = questStatus(q, player);
        list.push({ key: `quest:${q}`, label: q, done: st === 2, auto: st !== undefined, link: wikiPageUrl(q) });
      }
    } else if (goal.type === 'diary') {
      const [area, tier] = goal.target.split(':');
      const step = steps.find((s) => s.diary?.area === area && s.diary.tier === tier);
      if (step) list.push({ key: `step:${step.id}`, label: `Guide step #${step.order + 1}: ${step.name}`, done: progress[step.id]?.done === true, auto: false });
    }
    return list.map((p) => ({ ...p, done: p.done || goal.prereqsDone.includes(p.key) }));
  }, [goal, reqs, levels, player, steps, progress]);

  const flags = bottleneckFlags(goal.label, goal.type === 'skill' ? [goal.target.split(':')[0]] : prereqs.filter((p) => p.key.startsWith('skill:')).map((p) => p.key.split(':')[1]));
  const finished = goal.done || autoDone;

  if (compact) {
    return (
      <li className="flex items-center justify-between gap-2">
        <span className="text-zinc-400 line-through">{goal.label}</span>
        <div className="flex gap-1">
          <button className="btn-ghost !px-2 !py-0.5" onClick={() => toggleGoalDone(goal.id)}>reopen</button>
          <button className="btn-danger !px-2 !py-0.5" onClick={() => removeGoal(goal.id)}>×</button>
        </div>
      </li>
    );
  }

  return (
    <li className={`card ${goal.pinned ? 'border-violet-700/70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip bg-zinc-800 text-zinc-300">{goal.type}</span>
            {goal.pinned ? <span className="chip bg-violet-900/60 text-violet-200">📌 pinned</span> : null}
            {finished ? <span className="chip bg-emerald-900/60 text-emerald-200">done</span> : null}
          </div>
          <h3 className="mt-1 text-sm font-semibold">
            {goal.type === 'quest' ? <a className="hover:underline" href={wikiPageUrl(goal.target)} target="_blank" rel="noreferrer">{goal.label}</a> : goal.label}
          </h3>
          {status ? <div className="mt-0.5 text-xs text-zinc-400">{status}</div> : null}
          {bar !== undefined ? (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
              <div className="h-full bg-amber-500" style={{ width: `${Math.round(bar * 100)}%` }} />
            </div>
          ) : null}
          <FlagBadges flags={flags} />
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            className={`btn-ghost !px-2 ${pinError ? '!bg-red-900/60' : ''}`}
            onClick={() => { const ok = togglePin(goal.id); setPinError(!ok); if (!ok) setTimeout(() => setPinError(false), 1500); }}
            title={pinError ? `Max ${MAX_PINNED_GOALS} pinned` : goal.pinned ? 'Unpin' : 'Pin'}
          >
            {goal.pinned ? 'Unpin' : pinError ? 'Max 3' : 'Pin'}
          </button>
          <button className="btn-ghost !px-2" onClick={() => toggleGoalDone(goal.id)}>{goal.done ? 'Reopen' : 'Done'}</button>
          <button className="btn-danger !px-2" onClick={() => removeGoal(goal.id)} aria-label="Remove goal">×</button>
        </div>
      </div>
      {prereqs.length ? (
        <details className="mt-2 text-xs" open={!finished}>
          <summary className="cursor-pointer text-zinc-300">Prerequisites · {prereqs.filter((p) => p.done).length}/{prereqs.length}</summary>
          <ul className="mt-1 space-y-1">
            {prereqs.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <input type="checkbox" checked={p.done} onChange={() => togglePrereq(goal.id, p.key)} className="accent-amber-500" aria-label={p.label} />
                <span className={p.done ? 'text-zinc-500 line-through' : 'text-zinc-200'}>
                  {p.link ? <a href={p.link} target="_blank" rel="noreferrer" className="hover:underline">{p.label}</a> : p.label}
                </span>
                {p.auto ? <span className="text-[10px] text-zinc-500">auto</span> : null}
                {!p.done ? <button className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-200" onClick={() => addTodo(p.label.replace(/ \(you: \d+\)/, ''), [])}>+ todo</button> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
