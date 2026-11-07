import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MILESTONES, MILESTONE_BY_ID } from '../src/data/milestones';
import { combatLevel, milestoneStatus, readyMilestones, allMilestoneStatuses, milestoneQuestPrereqs, milestoneSkillPrereqs } from '../src/lib/milestones';
import { parseWikiSyncExport } from '../src/lib/wikisync';
import { effectiveLevels, selectNextUp } from '../src/lib/completion';
import { SKILLS } from '../src/lib/xp';
import questNames from '../src/data/questNames.json';
import guideJson from '../src/data/guide.json';
import reqsJson from '../src/data/questReqs.json';
import type { GuideStep, QuestReqs } from '../src/lib/types';

const player = parseWikiSyncExport(readFileSync(new URL('../fixtures/wikisync-2025-10-31.json', import.meta.url), 'utf8'), Date.parse('2025-10-31T23:00:00Z'));
const levels = effectiveLevels(player, null).levels;
const ctx = { player, levels, manual: {} };
const steps = guideJson.steps as GuideStep[];
const reqs = reqsJson.reqs as Record<string, QuestReqs>;

describe('milestone data', () => {
  it('has unique ids and valid references', () => {
    const ids = MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(questNames as string[]);
    for (const m of MILESTONES) {
      for (const skill of Object.keys(m.reqs.skills ?? {})) expect(SKILLS).toContain(skill);
      for (const q of m.reqs.quests ?? []) expect(known.has(q), `${m.id} → ${q}`).toBe(true);
      for (const dep of m.reqs.milestones ?? []) expect(MILESTONE_BY_ID[dep], `${m.id} → ${dep}`).toBeDefined();
      for (const d of m.reqs.diaries ?? []) expect(d).toMatch(/^.+:(Easy|Medium|Hard|Elite)$/);
      expect(m.how).not.toMatch(/grand exchange|\bGE\b|buy from (a|another) player|trade/i);
    }
  });

  it('covers gear, combat and slayer', () => {
    for (const c of ['gear', 'combat', 'slayer']) expect(MILESTONES.filter((m) => m.category === c).length).toBeGreaterThanOrEqual(8);
  });
});

describe('combat level', () => {
  it('matches the Wise Old Man combat level for the fixture levels', () => {
    expect(combatLevel(levels)).toBe(79);
  });
  it('uses the standard formula', () => {
    const l = (n: number) => ({ level: n });
    expect(combatLevel({ attack: l(1), strength: l(1), defence: l(1), hitpoints: l(10), ranged: l(1), magic: l(1), prayer: l(1) })).toBe(3);
    expect(combatLevel({ attack: l(99), strength: l(99), defence: l(99), hitpoints: l(99), ranged: l(99), magic: l(99), prayer: l(99) })).toBe(126);
  });
});

describe('milestone status', () => {
  it('auto-completes unlocks once every requirement is met', () => {
    expect(milestoneStatus(MILESTONE_BY_ID['protect-prayers'], ctx).done).toBe(true);
    expect(milestoneStatus(MILESTONE_BY_ID['slayer-konar'], ctx).done).toBe(true);
  });

  it('lists what is missing with both numbers', () => {
    const base60 = milestoneStatus(MILESTONE_BY_ID['base-60'], ctx);
    expect(base60.done).toBe(false);
    expect(base60.missing).toEqual([expect.objectContaining({ kind: 'skill', key: 'skill:defence:60', have: 48, need: 60 })]);
    const ava = milestoneStatus(MILESTONE_BY_ID['avas-accumulator'], ctx);
    expect(ava.missing.map((r) => r.key)).toEqual(['quest:Animal Magnetism']);
    expect(ava.missing[0].auto).toBe(true);
  });

  it('never auto-completes gear; it becomes ready, then done by hand', () => {
    const graceful = milestoneStatus(MILESTONE_BY_ID['graceful'], ctx);
    expect(graceful).toMatchObject({ done: false, ready: true, missing: [] });
    expect(milestoneStatus(MILESTONE_BY_ID['graceful'], { ...ctx, manual: { graceful: { done: true } } })).toMatchObject({ done: true, ready: false });
  });

  it('follows milestone dependencies', () => {
    const dd = milestoneStatus(MILESTONE_BY_ID['dragon-defender'], ctx);
    expect(dd.missing.map((r) => r.key)).toEqual(['milestone:rune-defender']);
    const withRune = milestoneStatus(MILESTONE_BY_ID['dragon-defender'], { ...ctx, manual: { 'rune-defender': { done: true } } });
    expect(withRune.ready).toBe(true);
    expect(milestoneQuestPrereqs(MILESTONE_BY_ID['avas-assembler']).sort()).toEqual(['Animal Magnetism', 'Dragon Slayer II']);
    expect(milestoneSkillPrereqs(MILESTONE_BY_ID['fire-cape'])).toEqual({ ranged: 70, prayer: 43 });
  });

  it('honours manually ticked requirements', () => {
    const s = milestoneStatus(MILESTONE_BY_ID['dragon-defender'], { ...ctx, ticked: ['milestone:rune-defender'] });
    expect(s.ready).toBe(true);
  });

  it('ready list is earliest-stage first and capped', () => {
    const ready = readyMilestones(ctx, 3);
    expect(ready).toHaveLength(3);
    expect(ready.every((r) => r.ready)).toBe(true);
    expect(ready.map((r) => r.milestone.stage)).toEqual(['early', 'early', 'early']);
    const all = allMilestoneStatuses(ctx);
    expect(all.filter((s) => s.ready).map((s) => s.milestone.id)).toContain('graceful');
  });

  it('tags Next Up steps that help a pinned milestone goal', () => {
    const goal = { id: 'g', type: 'milestone' as const, target: 'avas-accumulator', label: "Ava's accumulator", pinned: true, prereqsDone: [], createdAt: 1 };
    const next = selectNextUp({ steps, player, progress: {}, reqs, levels, goals: [goal], limit: 5 });
    const am = next.find((n) => n.step.quest === 'Animal Magnetism')!;
    expect(am).toBeDefined();
    expect(am.helps).toEqual(["Ava's accumulator"]);
  });
});
