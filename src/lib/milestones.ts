import type { Milestone } from '../data/milestones';
import { MILESTONES, MILESTONE_BY_ID, STAGE_ORDER } from '../data/milestones';
import type { PlayerData } from './types';
import { levelOf, questStatus, diaryProgress, type Levels } from './completion';
import { skillLabel } from './xp';

/** OSRS combat level from skill levels. */
export function combatLevel(levels: Levels): number {
  const l = (s: string) => levelOf(levels, s);
  const base = 0.25 * (l('defence') + l('hitpoints') + Math.floor(l('prayer') / 2));
  const melee = 0.325 * (l('attack') + l('strength'));
  const ranged = 0.325 * Math.floor(l('ranged') * 1.5);
  const magic = 0.325 * Math.floor(l('magic') * 1.5);
  return Math.floor(base + Math.max(melee, ranged, magic));
}

export interface MissingReq {
  kind: 'skill' | 'combat' | 'quest' | 'diary' | 'milestone' | 'qp';
  key: string;
  label: string;
  /** Known from data (true) or unknowable here (false → counts as unmet until ticked). */
  auto: boolean;
  have?: number;
  need?: number;
}

export interface MilestoneStatus {
  milestone: Milestone;
  done: boolean;
  /** Every requirement met and not done yet. */
  ready: boolean;
  missing: MissingReq[];
  /** All requirements, met or not, for checklists. */
  reqs: (MissingReq & { met: boolean })[];
}

export interface MilestoneContext {
  player: PlayerData | null;
  levels: Levels;
  /** Manual milestone completion. */
  manual: Record<string, { done: boolean } | undefined>;
  /** Manually ticked requirement keys (goal.prereqsDone), optional. */
  ticked?: string[];
}

export function milestoneStatus(m: Milestone, ctx: MilestoneContext, depth = 0): MilestoneStatus {
  const reqs: MilestoneStatus['reqs'] = [];
  const ticked = new Set(ctx.ticked ?? []);
  const push = (r: MissingReq, met: boolean) => reqs.push({ ...r, met: met || ticked.has(r.key) });

  for (const [skill, need] of Object.entries(m.reqs.skills ?? {})) {
    const have = levelOf(ctx.levels, skill);
    push({ kind: 'skill', key: `skill:${skill}:${need}`, label: `${need} ${skillLabel(skill)} (you: ${have})`, auto: true, have, need }, have >= need);
  }
  if (m.reqs.combat) {
    const have = combatLevel(ctx.levels);
    push({ kind: 'combat', key: `combat:${m.reqs.combat}`, label: `Combat level ${m.reqs.combat} (you: ${have})`, auto: true, have, need: m.reqs.combat }, have >= m.reqs.combat);
  }
  for (const q of m.reqs.quests ?? []) {
    const st = questStatus(q, ctx.player);
    push({ kind: 'quest', key: `quest:${q}`, label: q.startsWith('Recipe for Disaster/') ? q.replace('Recipe for Disaster/', 'RFD: ') : q, auto: st !== undefined }, st === 2);
  }
  for (const d of m.reqs.diaries ?? []) {
    const [area, tier] = d.split(':');
    const p = diaryProgress(ctx.player, area, tier);
    push({ kind: 'diary', key: `diary:${d}`, label: `${area} ${tier} diary${p.total ? ` (${p.done}/${p.total})` : ''}`, auto: p.total > 0 }, p.complete);
  }
  for (const id of m.reqs.milestones ?? []) {
    const dep = MILESTONE_BY_ID[id];
    if (!dep) continue;
    const depDone = depth < 5 ? milestoneStatus(dep, ctx, depth + 1).done : Boolean(ctx.manual[id]?.done);
    push({ kind: 'milestone', key: `milestone:${id}`, label: dep.name, auto: Boolean(dep.auto) }, depDone);
  }
  if (m.reqs.questPoints) {
    push({ kind: 'qp', key: `qp:${m.reqs.questPoints}`, label: `${m.reqs.questPoints} quest points`, auto: false }, false);
  }

  const allMet = reqs.every((r) => r.met);
  const manual = ctx.manual[m.id]?.done;
  const done = manual !== undefined ? manual : Boolean(m.auto && allMet);
  return { milestone: m, done, ready: !done && allMet, missing: reqs.filter((r) => !r.met), reqs };
}

export function allMilestoneStatuses(ctx: MilestoneContext): MilestoneStatus[] {
  return MILESTONES.map((m) => milestoneStatus(m, ctx));
}

/** Milestones the player can start right now, earliest stage first, in list order. */
export function readyMilestones(ctx: MilestoneContext, limit = 3): MilestoneStatus[] {
  return allMilestoneStatuses(ctx)
    .filter((s) => s.ready)
    .sort((a, b) => STAGE_ORDER[a.milestone.stage] - STAGE_ORDER[b.milestone.stage])
    .slice(0, limit);
}

/** Quests (transitively through milestone deps) a milestone still needs. */
export function milestoneQuestPrereqs(m: Milestone, seen = new Set<string>()): string[] {
  const out = [...(m.reqs.quests ?? [])];
  for (const id of m.reqs.milestones ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = MILESTONE_BY_ID[id];
    if (dep) out.push(...milestoneQuestPrereqs(dep, seen));
  }
  return Array.from(new Set(out));
}

/** Skills (transitively) a milestone needs, highest level per skill. */
export function milestoneSkillPrereqs(m: Milestone, seen = new Set<string>()): Record<string, number> {
  const out: Record<string, number> = { ...(m.reqs.skills ?? {}) };
  for (const id of m.reqs.milestones ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const dep = MILESTONE_BY_ID[id];
    if (!dep) continue;
    for (const [s, lvl] of Object.entries(milestoneSkillPrereqs(dep, seen))) out[s] = Math.max(out[s] ?? 0, lvl);
  }
  return out;
}
