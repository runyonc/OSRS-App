import { useMemo } from 'react';
import { useStore } from '../store';
import { useNextUp } from '../hooks/useDerived';
import StepCard from './StepCard';
import { isStepDone, goalWants } from '../lib/completion';
import { useReadyMilestones, useMilestoneContext } from '../hooks/useMilestones';
import { milestoneStatus } from '../lib/milestones';
import { MILESTONE_BY_ID } from '../data/milestones';
import { useLevels } from '../hooks/useDerived';
import MilestoneCard from './MilestoneCard';
import SkillIcon from './SkillIcon';
import { skillLabel } from '../lib/xp';
import { NEXT_UP_DEFAULT, NEXT_UP_EXPANDED } from '../config';

export default function NextUp({ onImport }: { onImport: () => void }) {
  const items = useNextUp();
  const expanded = useStore((s) => s.ui.expanded);
  const setExpanded = useStore((s) => s.setExpanded);
  const player = useStore((s) => s.player);
  const goals = useStore((s) => s.goals);
  const steps = useStore((s) => s.guide.steps);
  const progress = useStore((s) => s.progress);
  const unskipStep = useStore((s) => s.unskipStep);
  const setTab = useStore((s) => s.setTab);
  const markDone = useStore((s) => s.markDone);
  const window20 = useNextUp(NEXT_UP_EXPANDED);
  const reqs = useStore((s) => s.questReqs);
  const { levels } = useLevels();
  const ready = useReadyMilestones(3);
  const mctx = useMilestoneContext();

  const pinnedLines = useMemo(() => {
    const windowSteps = window20.map((n) => n.step);
    return goals.filter((g) => g.pinned && !g.done).map((g) => {
      let hit = window20.find((n) => n.helps.includes(g.label));
      if (!hit) {
        const wanted = goalWants(g, reqs, levels, windowSteps);
        hit = window20.find((n) => wanted.has(n.step.id) || (n.step.quest !== undefined && wanted.has(n.step.quest)));
      }
      if (!hit && g.type === 'skill') {
        const [skill] = g.target.split(':');
        hit = window20.find((n) => n.step.xpGained[skill]);
      }
      const m = g.type === 'milestone' ? MILESTONE_BY_ID[g.target] : undefined;
      const readyNow = m ? milestoneStatus(m, { ...mctx, ticked: g.prereqsDone }).ready : false;
      return { goal: g, step: hit?.step, readyNow };
    });
  }, [goals, window20, reqs, levels, mctx]);

  const skipped = useMemo(() => steps.filter((s) => progress[s.id]?.skipped), [steps, progress]);
  const doneCount = useMemo(() => steps.filter((s) => isStepDone(s, player, progress).done).length, [steps, player, progress]);
  const manualDone = useMemo(() => steps.filter((s) => progress[s.id]?.done === true).slice(-5).reverse(), [steps, progress]);

  return (
    <section className="space-y-3">
      {!player ? (
        <div className="card border-amber-700/60 text-sm">
          <p className="font-medium text-amber-200">No WikiSync import yet.</p>
          <p className="mt-1 text-zinc-300">Everything below assumes nothing is done. Import your WikiSync JSON export to skip what you have finished.</p>
          <button className="btn-primary mt-2" onClick={onImport}>Import now</button>
        </div>
      ) : null}

      {pinnedLines.length ? (
        <div className="card text-xs">
          <div className="mb-1 font-medium text-zinc-300">Pinned goals</div>
          <ul className="space-y-0.5">
            {pinnedLines.map(({ goal, step, readyNow }) => (
              <li key={goal.id} className="flex gap-2">
                <span className="text-violet-300">{goal.type === 'skill' ? <SkillIcon skill={goal.target.split(':')[0]} size={13} /> : '📌'} {goal.label}</span>
                <span className={readyNow ? 'text-emerald-300' : 'text-zinc-400'}>{readyNow ? '→ ready now, go get it' : step ? `→ next: ${step.name}` : '→ no step in the next 20 helps this yet'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{doneCount} / {steps.length} guide steps done</span>
        <button className="btn-ghost !py-1" onClick={() => setExpanded(!expanded)}>
          {expanded ? `show ${NEXT_UP_DEFAULT}` : `show ${NEXT_UP_EXPANDED}`}
        </button>
      </div>

      <ol className="space-y-2">
        {items.map((item, i) => <StepCard key={item.step.id} item={item} index={i} />)}
      </ol>
      {!items.length ? <p className="card text-sm text-zinc-300">Nothing left in the guide. Quest cape time.</p> : null}

      {ready.length ? (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs text-zinc-400">
            <span>Ready now · gear, combat and Slayer milestones you meet every requirement for</span>
            <button className="text-amber-400 hover:underline" onClick={() => setTab('goals')}>all milestones</button>
          </div>
          <ul className="space-y-2">{ready.map((st) => <MilestoneCard key={st.milestone.id} status={st} compact />)}</ul>
        </div>
      ) : null}

      {manualDone.length ? (
        <details className="card text-xs">
          <summary className="cursor-pointer text-zinc-300">Recently marked done ({manualDone.length})</summary>
          <ul className="mt-1 space-y-1">
            {manualDone.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">{s.name}</span>
                <button className="btn-ghost !px-2 !py-0.5" onClick={() => markDone(s.id, undefined)}>undo</button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {skipped.length ? (
        <details className="card text-xs">
          <summary className="cursor-pointer text-zinc-300">Skipped steps ({skipped.length})</summary>
          <ul className="mt-1 space-y-1">
            {skipped.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">
                  {s.name}
                  {progress[s.id]?.reason ? <span className="text-zinc-500"> · {progress[s.id].reason}</span> : null}
                  {s.train ? <span className="text-zinc-500"> · {skillLabel(s.train.skill)}</span> : null}
                </span>
                <button className="btn-ghost !px-2 !py-0.5" onClick={() => unskipStep(s.id)}>unskip</button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
