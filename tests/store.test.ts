import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/store';

beforeEach(() => useStore.getState().resetAll());

describe('store', () => {
  it('round-trips app state through export/import without loss', () => {
    const s = useStore.getState();
    s.markDone('cook-s-assistant', true);
    s.skipStep('sheep-shearer', 'later');
    s.addGoal({ type: 'skill', target: 'agility:70', label: '70 Agility' });
    s.addTodo('Bank 65 logs', ['Supplies']);
    s.setFlagNote('Herblore', 'custom note');
    const before = useStore.getState();
    const goalId = before.goals[0].id;
    expect(useStore.getState().togglePin(goalId)).toBe(true);
    const json = useStore.getState().exportState();

    useStore.getState().resetAll();
    expect(useStore.getState().goals).toHaveLength(0);
    useStore.getState().importState(json);
    const after = useStore.getState();
    expect(after.progress['cook-s-assistant'].done).toBe(true);
    expect(after.progress['sheep-shearer']).toMatchObject({ skipped: true, reason: 'later' });
    expect(after.goals[0]).toMatchObject({ target: 'agility:70', pinned: true });
    expect(after.todos[0]).toMatchObject({ text: 'Bank 65 logs', tags: ['Supplies'] });
    expect(after.flags.Herblore).toBe('custom note');
    const strip = (j: string) => { const o = JSON.parse(j); delete o.exportedAt; return o; };
    expect(strip(after.exportState())).toEqual(strip(json));
  });

  it('limits pinned goals to three', () => {
    const s = useStore.getState();
    for (let i = 0; i < 4; i++) s.addGoal({ type: 'text', target: `g${i}`, label: `g${i}` });
    const ids = useStore.getState().goals.map((g) => g.id);
    expect(useStore.getState().togglePin(ids[0])).toBe(true);
    expect(useStore.getState().togglePin(ids[1])).toBe(true);
    expect(useStore.getState().togglePin(ids[2])).toBe(true);
    expect(useStore.getState().togglePin(ids[3])).toBe(false);
  });

  it('ships the bundled guide, requirements and the initial import', () => {
    const s = useStore.getState();
    expect(s.player?.username).toBe('Iron Funyon');
    expect(s.player?.quests["Cook's Assistant"]).toBe(2);
    expect(s.player?.importedAt).toBe(Date.parse('2026-11-07T02:46:22.194Z'));
    expect(s.guide.steps.length).toBeGreaterThan(300);
    expect(s.guide.steps[0].name).toBe('Learning the Ropes');
    expect(Object.keys(s.questReqs).length).toBeGreaterThan(150);
  });
});
