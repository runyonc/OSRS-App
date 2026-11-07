import { describe, it, expect } from 'vitest';
import { buildQuestList, stepStatus } from '../src/lib/quests';
import { parseWikiSyncExport } from '../src/lib/wikisync';
import initialImport from '../src/data/initialImport.json';
import guideJson from '../src/data/guide.json';
import reqsJson from '../src/data/questReqs.json';
import type { GuideStep, QuestReqs } from '../src/lib/types';

const steps = guideJson.steps as GuideStep[];
const reqs = reqsJson.reqs as Record<string, QuestReqs>;
const player = parseWikiSyncExport(initialImport, Date.parse('2026-11-07T03:00:00Z'));

describe('quest list', () => {
  it('lists every quest from the import with status, QP and guide position', () => {
    const list = buildQuestList(player, steps, reqs);
    expect(list.length).toBeGreaterThan(200);
    const cook = list.find((e) => e.name === "Cook's Assistant")!;
    expect(cook).toMatchObject({ status: 'done', qp: 1, wiki: "Cook's Assistant" });
    expect(cook.guideOrder).toBe(2);
    expect(list.find((e) => e.name === 'Imp Catcher')?.status).toBe('in-progress');
    const dave = list.find((e) => e.name === 'Recipe for Disaster - Evil Dave')!;
    expect(dave.wiki).toBe('Recipe for Disaster/Freeing Evil Dave');
    expect(list.find((e) => e.name === "Alfred Grimhand's Barcrawl")?.miniquest).toBe(true);
    // Sorted by guide order, then name.
    const orders = list.filter((e) => e.guideOrder).map((e) => e.guideOrder!);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
    expect(list.filter((e) => e.name === '.')).toHaveLength(0);
  });

  it('reports step status including skipped and in-progress', () => {
    const cook = steps.find((s) => s.name === "Cook's Assistant")!;
    expect(stepStatus(cook, player, {})).toBe('done');
    const imp = steps.find((s) => s.quest === 'Imp Catcher')!;
    expect(stepStatus(imp, player, {})).toBe('in-progress');
    expect(stepStatus(imp, player, { [imp.id]: { skipped: true, at: 1 } })).toBe('skipped');
    const unlock = steps.find((s) => s.name === 'Unlock: Anti-dragon shield')!;
    expect(stepStatus(unlock, player, {})).toBe('pending');
  });
});
