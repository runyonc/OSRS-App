import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseWikiSyncExport } from '../src/lib/wikisync';
import { parseWomPlayer } from '../src/lib/wom';
import {
  selectNextUp, isStepDone, effectiveLevels, stepBlockers, questPoints, diaryProgress, bottleneckFlags, allPrereqQuests,
} from '../src/lib/completion';
import { findQuestKey, normalizeName } from '../src/lib/names';
import guideJson from '../src/data/guide.json';
import reqsJson from '../src/data/questReqs.json';
import type { GuideStep, QuestReqs } from '../src/lib/types';

const steps = guideJson.steps as GuideStep[];
const reqs = reqsJson.reqs as Record<string, QuestReqs>;
const exportText = readFileSync(new URL('../fixtures/wikisync-2025-10-31.json', import.meta.url), 'utf8');
const player = parseWikiSyncExport(exportText, Date.parse('2025-10-31T23:00:00Z'));
const levels = effectiveLevels(player, null).levels;
const byName = (n: string) => steps.find((s) => s.name === n)!;

describe('WikiSync import', () => {
  it('reads quests, diaries, levels and combat achievements', () => {
    expect(player.username).toBe('Iron Funyon');
    expect(player.quests["Cook's Assistant"]).toBe(2);
    expect(player.quests['Imp Catcher']).toBe(1);
    expect(player.diaries.Ardougne.Easy?.complete).toBe(true);
    expect(player.levels.agility.level).toBeGreaterThan(1);
    expect(player.levels.sailing).toBeDefined(); // unknown/new skills must not crash
    expect(player.combatAchievements.length).toBe(7);
    expect(player.exportedAt).toBe(Date.parse('2025-10-31T22:14:09Z'));
  });

  it('rejects exports without a quests map', () => {
    expect(() => parseWikiSyncExport('{"levels":{}}')).toThrow(/quests/);
  });
});

describe('name matching', () => {
  it('normalizes apostrophes, dashes, roman numerals and slashes', () => {
    expect(normalizeName("Cook’s Assistant")).toBe(normalizeName("Cook's Assistant"));
    expect(normalizeName('Fairytale II - Cure a Queen')).toBe(normalizeName('Fairytale II – Cure a Queen'));
    expect(normalizeName('Rag and Bone Man II')).toBe('rag and bone man 2');
    expect(findQuestKey('Recipe for Disaster/Freeing Evil Dave', player.quests)).toBe('Recipe for Disaster - Freeing Evil Dave');
    expect(findQuestKey('Not A Quest', player.quests)).toBeUndefined();
  });
});

describe('completion rules (10/31 export)', () => {
  it('marks Learning the Ropes, Cook\'s Assistant and The Restless Ghost done and leaves them out of Next Up', () => {
    for (const n of ['Learning the Ropes', "Cook's Assistant", 'The Restless Ghost']) {
      expect(isStepDone(byName(n), player, {})).toEqual({ done: true, source: 'import' });
    }
    const next = selectNextUp({ steps, player, progress: {}, reqs, levels, goals: [], limit: 20 });
    const names = next.map((n) => n.step.name);
    expect(names).not.toContain('Learning the Ropes');
    expect(names).not.toContain("Cook's Assistant");
    expect(names).not.toContain('The Restless Ghost');
  });

  it('pins in-progress quests to the top as In progress', () => {
    const next = selectNextUp({ steps, player, progress: {}, reqs, levels, goals: [], limit: 5 });
    expect(next).toHaveLength(5);
    const pinned = next.filter((n) => n.inProgress).map((n) => n.step.quest);
    expect(pinned.slice().sort()).toEqual(['Animal Magnetism', 'Fairytale II - Cure a Queen', 'Imp Catcher', 'Prince Ali Rescue', 'Rag and Bone Man II']);
    // In-progress quests keep guide order among themselves.
    const orders = next.filter((n) => n.inProgress).map((n) => n.step.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  it('treats a partial step as done once the quest is started', () => {
    const partial = byName('Partial: Fairytale II - Cure a Queen');
    expect(isStepDone(partial, player, {}).done).toBe(true);
    expect(isStepDone(byName('Fairytale II - Cure a Queen'), player, {}).done).toBe(false);
  });

  it('shows Ardougne Easy and Varrock Easy complete and other tiers as tasks done/total', () => {
    expect(isStepDone(byName('Easy Ardougne Diary'), player, {}).done).toBe(true);
    expect(isStepDone(byName('Easy Varrock Diary'), player, {}).done).toBe(true);
    expect(diaryProgress(player, 'Ardougne', 'Easy')).toMatchObject({ complete: true });
    const med = diaryProgress(player, 'Ardougne', 'Medium');
    expect(med.complete).toBe(false);
    expect(med.total).toBeGreaterThan(0);
    expect(med.done).toBeLessThan(med.total);
    expect(isStepDone(byName('All Easy Achievement Diaries'), player, {}).done).toBe(false);
  });

  it('flags a quest needing a skill above the current level with both numbers', () => {
    const song = byName('Song of the Elves');
    const blockers = stepBlockers(song, reqs, levels);
    const agility = blockers.find((b) => b.skill === 'agility')!;
    expect(agility).toMatchObject({ needed: 70, boostable: false });
    expect(agility.have).toBeLessThan(70);
    expect(agility.have).toBe(levels.agility.level);
  });

  it('keeps blocked steps in Next Up instead of hiding them', () => {
    const low = { ...levels, agility: { level: 1 } };
    const next = selectNextUp({ steps, player, progress: {}, reqs, levels: low, goals: [], limit: 20 });
    const blocked = next.filter((n) => n.blockers.length);
    expect(blocked.length).toBeGreaterThan(0);
  });

  it('lets manual overrides win over imported data', () => {
    const cook = byName("Cook's Assistant");
    expect(isStepDone(cook, player, { [cook.id]: { done: false, at: 1 } })).toEqual({ done: false, source: 'manual' });
    const unlock = byName('Unlock: Anti-dragon shield');
    expect(isStepDone(unlock, player, {}).done).toBe(false);
    expect(isStepDone(unlock, player, { [unlock.id]: { done: true, at: 1 } }).done).toBe(true);
  });

  it('skips skipped steps', () => {
    const next0 = selectNextUp({ steps, player, progress: {}, reqs, levels, goals: [], limit: 20 });
    const firstNormal = next0.find((n) => !n.inProgress)!.step;
    const next1 = selectNextUp({ steps, player, progress: { [firstNormal.id]: { skipped: true, reason: 'later', at: 1 } }, reqs, levels, goals: [], limit: 20 });
    expect(next1.map((n) => n.step.id)).not.toContain(firstNormal.id);
  });

  it('tags steps that help a pinned goal', () => {
    const goal = { id: 'g1', type: 'quest' as const, target: 'Song of the Elves', label: 'Song of the Elves', pinned: true, prereqsDone: [], createdAt: 1 };
    const prereqs = allPrereqQuests('Song of the Elves', reqs);
    expect(prereqs).toContain('Regicide');
    // Mark everything done except the Song of the Elves chain so the window reaches it.
    const progress: Record<string, { done: boolean; at: number }> = {};
    for (const s of steps) if (!prereqs.includes(s.quest ?? '') && s.quest !== 'Song of the Elves') progress[s.id] = { done: true, at: 1 };
    const next = selectNextUp({ steps, player, progress, reqs, levels, goals: [goal], limit: 5 });
    expect(next.some((n) => n.helps.includes('Song of the Elves'))).toBe(true);
  });

  it('derives quest points from completed guide quests', () => {
    const qp = questPoints(steps, player, {});
    expect(qp).toBeGreaterThan(50);
    expect(qp).toBeLessThan(200);
  });
});

describe('levels', () => {
  it('prefers the newer of the WOM snapshot and the import', () => {
    const wom = parseWomPlayer({ updatedAt: '2025-11-05T21:57:05Z', combatLevel: 79, type: 'ironman', latestSnapshot: { createdAt: '2025-11-05T21:57:05Z', data: { skills: { overall: { level: 1000, experience: 1 }, agility: { level: 60, experience: 300000 } } } } });
    expect(wom.levels.agility).toEqual({ level: 60, xp: 300000 });
    expect(effectiveLevels(player, wom).source).toBe('wom');
    expect(effectiveLevels(player, wom).levels.agility.level).toBe(60);
    expect(effectiveLevels(player, wom).levels.cooking.level).toBe(player.levels.cooking.level);
    const older = { ...wom, fetchedAt: player.importedAt - 1 };
    expect(effectiveLevels(player, older).source).toBe('import');
  });
});

describe('ironman flags', () => {
  it('detects known bottlenecks from text and skills', () => {
    expect(bottleneckFlags('Collect 50 rune essence and some planks')).toEqual(['Construction', 'Runecraft']);
    expect(bottleneckFlags('nothing here', ['herblore'])).toEqual(['Herblore']);
    expect(bottleneckFlags('Talk to the cook')).toEqual([]);
  });
});
