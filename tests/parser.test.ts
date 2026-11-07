import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGuide, cleanWikitext } from '../src/lib/wikitext';
import questNames from '../src/data/questNames.json';

const wikitext = readFileSync(new URL('../fixtures/guide.wikitext', import.meta.url), 'utf8');
const result = parseGuide(wikitext, { questNames });
const steps = result.steps;
const byName = (n: string) => steps.find((s) => s.name === n)!;

describe('guide parser', () => {
  it('parses every row of the Questing Order table (fewer than 2% unparsed)', () => {
    expect(result.totalRows).toBeGreaterThan(200);
    expect(result.unparsed.length / result.totalRows).toBeLessThan(0.02);
  });

  it('keeps guide order starting from Learning the Ropes', () => {
    expect(steps[0].name).toBe('Learning the Ropes');
    expect(steps[1].name).toBe("Cook's Assistant");
    expect(steps.map((s) => s.order)).toEqual(steps.map((_, i) => i));
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it('classifies quests, miniquests, diaries, unlocks and training steps', () => {
    expect(byName("Cook's Assistant").type).toBe('quest');
    expect(byName('Natural history quiz').type).toBe('miniquest');
    expect(byName('Easy Ardougne Diary')).toMatchObject({ type: 'diary', diary: { area: 'Ardougne', tier: 'Easy' } });
    expect(byName('All Easy Achievement Diaries').diary).toEqual({ area: 'All', tier: 'Easy' });
    expect(byName('Unlock: Anti-dragon shield').type).toBe('unlock');
    const train = steps.find((s) => s.train?.skill === 'agility' && s.train.level === 22)!;
    expect(train).toMatchObject({ type: 'skilling', name: 'Train Agility to 22' });
    expect(steps.filter((s) => s.train).length).toBeGreaterThan(90);
  });

  it('marks partial quest steps and keeps the quest name for matching', () => {
    const partial = byName("Partial: Pirate's Treasure");
    expect(partial).toMatchObject({ partial: true, quest: "Pirate's Treasure", type: 'quest' });
    expect(byName("Pirate's Treasure").partial).toBe(false);
    expect(byName('Partial: Enter the Abyss').type).toBe('miniquest');
  });

  it('tracks running XP totals, levels after each step and quest points', () => {
    expect(byName('Learning the Ropes').levelsAfter).toEqual({ hitpoints: 10 });
    expect(byName("Cook's Assistant")).toMatchObject({ xpGained: { cooking: 300 }, levelsAfter: { cooking: 4 }, qp: 1, totalQp: 2 });
    const train = steps.find((s) => s.train?.skill === 'agility' && s.train.level === 22)!;
    expect(train.levelsAfter).toEqual({ agility: 22 });
    expect(steps[steps.length - 1].totalQp).toBeGreaterThan(300);
  });

  it('cleans wiki markup out of notes and locations', () => {
    const notes = byName('Learning the Ropes').notes;
    expect(notes.length).toBeGreaterThan(5);
    expect(notes.some((n) => n.startsWith('Pickpocket a nearby man'))).toBe(true);
    for (const s of steps) {
      for (const n of s.notes) {
        expect(n).not.toMatch(/\[\[|\]\]|\{\{|\}\}/);
      }
      expect(s.location).not.toMatch(/\[\[|\{\{/);
    }
    expect(byName("Cook's Assistant").location).toBe('Lumbridge');
  });

  it('keeps Recipe for Disaster subquests as distinct quest steps', () => {
    const rfd = steps.filter((s) => s.quest?.startsWith('Recipe for Disaster/'));
    expect(rfd.length).toBeGreaterThanOrEqual(10);
    expect(rfd[0].name).toBe("RFD: Another Cook's Quest");
  });

  it('renders common templates in cleanWikitext', () => {
    expect(cleanWikitext('Pay {{Coins|30}} on the {{FloorNumber|uk=1}} for {{SCP|Herblore|link=yes}} with [[Cook (Lumbridge)|the Cook]]')).toBe(
      'Pay 30 coins on the 1st floor for Herblore with the Cook',
    );
  });
});
