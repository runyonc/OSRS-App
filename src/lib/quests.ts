import type { GuideStep, PlayerData, QuestReqs, StepProgress } from './types';
import { findQuestKey, normalizeName } from './names';
import { MINIQUESTS } from './wikitext';
import { isStepDone } from './completion';

export type QuestStatus = 'done' | 'in-progress' | 'not-started' | 'unknown';

export interface QuestEntry {
  /** In-game name (the import's key) when known, else the wiki name. */
  name: string;
  /** Wiki page / guide name when the guide has it. */
  wiki?: string;
  status: QuestStatus;
  miniquest: boolean;
  qp?: number;
  /** 1-based position of the quest's main step in the guide. */
  guideOrder?: number;
  skills?: QuestReqs['skills'];
}

/**
 * Every quest and miniquest the import knows about, joined with the guide for QP and ordering.
 * Guide quests missing from the import are added with status "unknown".
 */
export function buildQuestList(player: PlayerData | null, steps: GuideStep[], reqs: Record<string, QuestReqs>): QuestEntry[] {
  const out: QuestEntry[] = [];
  const stepByQuest = new Map<string, GuideStep>();
  for (const s of steps) if (s.quest && !s.partial && (s.type === 'quest' || s.type === 'miniquest') && !stepByQuest.has(s.quest)) stepByQuest.set(s.quest, s);
  const seenWiki = new Set<string>();
  const importKeys = player ? Object.keys(player.quests).filter((k) => k.trim() && k !== '.') : [];
  for (const key of importKeys) {
    const status = player!.quests[key];
    let wiki: string | undefined;
    for (const q of stepByQuest.keys()) {
      if (findQuestKey(q, { [key]: status }) === key) { wiki = q; break; }
    }
    if (wiki) seenWiki.add(wiki);
    const step = wiki ? stepByQuest.get(wiki) : undefined;
    out.push({
      name: key,
      wiki,
      status: status === 2 ? 'done' : status === 1 ? 'in-progress' : 'not-started',
      miniquest: MINIQUESTS.has(wiki ?? key) || MINIQUESTS.has(key) || (step?.type === 'miniquest'),
      qp: step?.qp,
      guideOrder: step ? step.order + 1 : undefined,
      skills: wiki ? reqs[wiki]?.skills : undefined,
    });
  }
  for (const [wiki, step] of stepByQuest) {
    if (seenWiki.has(wiki)) continue;
    if (out.some((e) => normalizeName(e.name) === normalizeName(wiki))) continue;
    out.push({ name: wiki, wiki, status: 'unknown', miniquest: step.type === 'miniquest', qp: step.qp, guideOrder: step.order + 1, skills: reqs[wiki]?.skills });
  }
  return out.sort((a, b) => (a.guideOrder ?? 9999) - (b.guideOrder ?? 9999) || a.name.localeCompare(b.name));
}

export type StepStatus = 'done' | 'in-progress' | 'skipped' | 'pending';

export function stepStatus(step: GuideStep, player: PlayerData | null, progress: Record<string, StepProgress>): StepStatus {
  if (progress[step.id]?.skipped) return 'skipped';
  if (isStepDone(step, player, progress).done) return 'done';
  if (player && step.quest && (step.type === 'quest' || step.type === 'miniquest')) {
    const key = findQuestKey(step.quest, player.quests);
    if (key !== undefined && player.quests[key] === 1) return 'in-progress';
  }
  return 'pending';
}
