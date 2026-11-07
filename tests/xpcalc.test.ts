import { describe, it, expect } from 'vitest';
import { planXp, actionsNeeded, hoursNeeded } from '../src/lib/xpcalc';
import { xpForLevel } from '../src/lib/xp';
import { useStore } from '../src/store';

describe('xp calculator', () => {
  it('matches the wiki Experience table', () => {
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(50)).toBe(101333);
    expect(xpForLevel(57)).toBe(203254);
    expect(xpForLevel(77)).toBe(1475581);
    expect(xpForLevel(99)).toBe(13034431);
    expect(xpForLevel(126)).toBe(188884740);
  });
  it('plans from current XP to a target level', () => {
    const p = planXp(300000, 70);
    expect(p.currentLevel).toBe(60);
    expect(p.targetXp).toBe(737627);
    expect(p.remaining).toBe(437627);
    expect(p.progress).toBeGreaterThan(0);
    expect(p.progress).toBeLessThan(1);
    expect(planXp(800000, 70)).toMatchObject({ remaining: 0, progress: 1 });
  });
  it('counts actions and hours', () => {
    expect(actionsNeeded(437627, 240)).toBe(1824);
    expect(actionsNeeded(100, 0)).toBe(0);
    expect(hoursNeeded(437627, 55000)).toBe(8);
  });
});

describe('gear setups and methods persist', () => {
  it('round-trips through export/import', () => {
    const s = useStore.getState();
    s.resetAll();
    const id = s.addGearSetup('Melee');
    useStore.getState().updateGearSetup(id, { slot: { key: 'weapon', value: 'Dragon scimitar' } });
    useStore.getState().addMethod({ skill: 'agility', name: 'Canifis lap', xpPerAction: 240, perHour: 230 });
    const json = useStore.getState().exportState();
    useStore.getState().resetAll();
    useStore.getState().importState(json);
    expect(useStore.getState().gear[0]).toMatchObject({ name: 'Melee', slots: { weapon: 'Dragon scimitar' } });
    expect(useStore.getState().methods[0]).toMatchObject({ skill: 'agility', xpPerAction: 240 });
  });
});
