import type { GuideStep, PlayerData, LiveLevels, StepProgress, QuestReqs, Goal, Bottleneck } from './types';
import { findQuestKey } from './names';
import { diaryTierSummary } from './wikisync';
import { levelForXp } from './xp';
import { MILESTONE_BY_ID } from '../data/milestones';
import { milestoneQuestPrereqs, milestoneSkillPrereqs } from './milestones';

const COMBAT_SKILLS = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer'];

export type Levels = Record<string, { level: number; xp?: number }>;

/** The newer of the WikiSync import and the Wise Old Man snapshot wins. Unknown skills pass through. */
export function effectiveLevels(player: PlayerData | null, live: LiveLevels | null): { levels: Levels; source: 'wom' | 'import' | 'none'; at?: number } {
  const importAt = player?.importedAt ?? 0;
  const liveAt = live?.fetchedAt ?? 0;
  if (live && (!player || liveAt >= importAt)) {
    const levels: Levels = { ...(player?.levels ?? {}), ...live.levels };
    return { levels, source: 'wom', at: liveAt };
  }
  if (player) return { levels: { ...(live?.levels ?? {}), ...player.levels }, source: 'import', at: importAt };
  return { levels: {}, source: 'none' };
}

export function levelOf(levels: Levels, skill: string): number {
  const v = levels[skill];
  if (!v) return 1;
  if (v.level) return v.level;
  if (v.xp != null) return levelForXp(v.xp);
  return 1;
}

export function totalLevel(levels: Levels): number {
  return Object.values(levels).reduce((sum, v) => sum + (v.level || (v.xp != null ? levelForXp(v.xp) : 1)), 0);
}

export type DoneSource = 'manual' | 'import' | 'none';

/** Whether the import says this step is done. Manual overrides are applied by `isStepDone`. */
export function importSaysDone(step: GuideStep, player: PlayerData | null): boolean | undefined {
  if (!player) return undefined;
  if ((step.type === 'quest' || step.type === 'miniquest') && step.quest) {
    const key = findQuestKey(step.quest, player.quests);
    if (key === undefined) return undefined; // not tracked → manual only
    const status = player.quests[key];
    return step.partial ? status >= 1 : status === 2;
  }
  if (step.type === 'diary' && step.diary) {
    const { area, tier } = step.diary;
    if (area === 'All') {
      const areas = Object.values(player.diaries);
      if (!areas.length) return undefined;
      return areas.every((a) => a[tier]?.complete);
    }
    const entry = findDiaryArea(player, area)?.[tier];
    return entry ? entry.complete : undefined;
  }
  return undefined;
}

export function findDiaryArea(player: PlayerData, area: string): PlayerData['diaries'][string] | undefined {
  if (player.diaries[area]) return player.diaries[area];
  const want = area.toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(player.diaries)) {
    const have = k.toLowerCase().replace(/[^a-z]/g, '');
    if (have === want || have.includes(want) || want.includes(have)) return v;
  }
  return undefined;
}

export function isStepDone(step: GuideStep, player: PlayerData | null, progress: Record<string, StepProgress>): { done: boolean; source: DoneSource } {
  const manual = progress[step.id];
  if (manual?.done !== undefined) return { done: manual.done, source: 'manual' };
  const imported = importSaysDone(step, player);
  if (imported !== undefined) return { done: imported, source: 'import' };
  return { done: false, source: 'none' };
}

export function isInProgress(step: GuideStep, player: PlayerData | null): boolean {
  if (!player || !step.quest || (step.type !== 'quest' && step.type !== 'miniquest')) return false;
  const key = findQuestKey(step.quest, player.quests);
  return key !== undefined && player.quests[key] === 1;
}

export interface Blocker {
  skill: string;
  needed: number;
  have: number;
  boostable: boolean;
}

export function stepBlockers(step: GuideStep, reqs: Record<string, QuestReqs>, levels: Levels): Blocker[] {
  if (!step.quest) return [];
  const r = reqs[step.quest];
  if (!r) return [];
  const out: Blocker[] = [];
  for (const s of r.skills) {
    const have = levelOf(levels, s.skill);
    if (have < s.level) out.push({ skill: s.skill, needed: s.level, have, boostable: s.boostable });
  }
  return out;
}

export interface NextUpItem {
  step: GuideStep;
  inProgress: boolean;
  blockers: Blocker[];
  helps: string[];
}

export interface NextUpInput {
  steps: GuideStep[];
  player: PlayerData | null;
  progress: Record<string, StepProgress>;
  reqs: Record<string, QuestReqs>;
  levels: Levels;
  goals: Goal[];
  limit: number;
}

/** Step ids / quest names that move a goal forward, used for "Helps:" tags and the pinned-goal lines. */
export function goalWants(goal: Goal, reqs: Record<string, QuestReqs>, levels: Levels, window: GuideStep[]): Set<string> {
  const wanted = new Set<string>();
  const wantTrain = (skill: string, need?: number) => {
    for (const step of window) {
      if (step.train?.skill !== skill) continue;
      if (need !== undefined && levelOf(levels, skill) >= need) continue;
      wanted.add(step.id);
    }
  };
  if (goal.type === 'quest') {
    wanted.add(goal.target);
    for (const q of allPrereqQuests(goal.target, reqs)) wanted.add(q);
  } else if (goal.type === 'skill') {
    const [skill, lvl] = goal.target.split(':');
    wantTrain(skill, Number(lvl));
  } else if (goal.type === 'diary') {
    const [area, tier] = goal.target.split(':');
    for (const step of window) if (step.diary && step.diary.area === area && step.diary.tier === tier) wanted.add(step.id);
  } else if (goal.type === 'milestone') {
    const m = MILESTONE_BY_ID[goal.target];
    if (m) {
      for (const q of milestoneQuestPrereqs(m)) {
        wanted.add(q);
        for (const p of allPrereqQuests(q, reqs)) wanted.add(p);
      }
      for (const [skill, need] of Object.entries(milestoneSkillPrereqs(m))) wantTrain(skill, need);
    }
  } else if (goal.type === 'combat') {
    for (const skill of COMBAT_SKILLS) wantTrain(skill);
  }
  return wanted;
}

/**
 * Next Up: in-progress quests first (guide order), then the first N incomplete, unskipped steps in guide order.
 * Blocked steps are kept, with their missing requirements attached.
 */
export function selectNextUp(input: NextUpInput): NextUpItem[] {
  const { steps, player, progress, reqs, levels, goals, limit } = input;
  const pending = steps.filter((s) => !progress[s.id]?.skipped && !isStepDone(s, player, progress).done);
  const inProgress = pending.filter((s) => isInProgress(s, player));
  const rest = pending.filter((s) => !isInProgress(s, player));
  const ordered = [...inProgress, ...rest];
  const window = ordered.slice(0, Math.max(limit, 20));
  const helpsIndex = helpsMap(goals, reqs, player, progress, levels, window);
  return ordered.slice(0, limit).map((step) => ({
    step,
    inProgress: isInProgress(step, player),
    blockers: stepBlockers(step, reqs, levels),
    helps: helpsIndex.get(step.id) ?? [],
  }));
}

/** For each step in the next-20 window, the pinned goals it is a prerequisite of. */
function helpsMap(goals: Goal[], reqs: Record<string, QuestReqs>, player: PlayerData | null, progress: Record<string, StepProgress>, levels: Levels, window: GuideStep[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const goal of goals.filter((g) => g.pinned && !g.done)) {
    const wanted = goalWants(goal, reqs, levels, window);
    for (const step of window) {
      const hit = wanted.has(step.id) || (step.quest !== undefined && wanted.has(step.quest));
      if (!hit) continue;
      if (isStepDone(step, player, progress).done) continue;
      const list = map.get(step.id) ?? [];
      if (!list.includes(goal.label)) list.push(goal.label);
      map.set(step.id, list);
    }
  }
  return map;
}

export function allPrereqQuests(quest: string, reqs: Record<string, QuestReqs>, seen = new Set<string>()): string[] {
  const r = reqs[quest];
  if (!r) return [];
  const out: string[] = [];
  for (const q of r.quests) {
    if (seen.has(q)) continue;
    seen.add(q);
    out.push(q, ...allPrereqQuests(q, reqs, seen));
  }
  return out;
}

export function questStatus(quest: string, player: PlayerData | null): number | undefined {
  if (!player) return undefined;
  const key = findQuestKey(quest, player.quests);
  return key === undefined ? undefined : player.quests[key];
}

/** Quest points earned, derived from the guide's per-quest QP and the import's completed quests. */
export function questPoints(steps: GuideStep[], player: PlayerData | null, progress: Record<string, StepProgress>): number {
  let qp = 0;
  for (const step of steps) {
    if (step.type !== 'quest' || step.partial || !step.qp) continue;
    if (isStepDone(step, player, progress).done) qp += step.qp;
  }
  return qp;
}

export function diaryProgress(player: PlayerData | null, area: string, tier: string): { done: number; total: number; complete: boolean } {
  if (!player) return { done: 0, total: 0, complete: false };
  const entry = findDiaryArea(player, area)?.[tier as keyof PlayerData['diaries'][string]];
  return diaryTierSummary(entry);
}

// ---------- Ironman bottleneck flags ----------

const BOTTLENECK_PATTERNS: { flag: Bottleneck; re: RegExp }[] = [
  { flag: 'Herblore', re: /\bherblore\b|\bherb\b|\bherbs\b|secondar|\bpotion/i },
  { flag: 'Farming', re: /\bfarming\b|\bseeds?\b|\bfarm run|\ballotment|\bsapling/i },
  { flag: 'Construction', re: /\bconstruction\b|\bplanks?\b|\bnails\b|\bsawmill/i },
  { flag: 'Runecraft', re: /\brunecraft|\bessence\b|\btalisman|\btiara/i },
  { flag: 'Slayer', re: /\bslayer\b/i },
];

export function bottleneckFlags(text: string, skills: string[] = []): Bottleneck[] {
  const out = new Set<Bottleneck>();
  for (const { flag, re } of BOTTLENECK_PATTERNS) {
    if (re.test(text) || skills.some((s) => s.toLowerCase() === flag.toLowerCase())) out.add(flag);
  }
  return Array.from(out);
}

export function stepFlags(step: GuideStep, reqs: Record<string, QuestReqs>): Bottleneck[] {
  const text = [step.name, ...step.notes].join('\n');
  const skills = [
    ...Object.keys(step.xpGained),
    ...(step.train ? [step.train.skill] : []),
    ...((step.quest && reqs[step.quest]?.skills.map((s) => s.skill)) ?? []),
  ];
  return bottleneckFlags(text, skills);
}

export const DEFAULT_FLAG_NOTES: Record<Bottleneck, string> = {
  Herblore: 'Save every herb and secondary; lamps go on Herblore. Do not drink potions you cannot replace.',
  Farming: 'Run herb patches whenever you pass one; save ranarr and snapdragon seeds.',
  Construction: 'Save oak logs and nails; use the sawmill only for planks you actually need.',
  Runecraft: 'Keep pure essence for quests first; Abyss runs for runes you cannot buy.',
  Slayer: 'Use task-only drops for supplies; keep Slayer points for unlocks before skips.',
};
