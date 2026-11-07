import { describe, it, expect } from 'vitest';
import { EQUIPMENT, findEquipment, setupStats, searchEquipment, detectModifiers, STAT_KEYS } from '../src/lib/equipment';

describe('equipment database', () => {
  it('bundles every equippable with bonuses, slots and icons', () => {
    expect(EQUIPMENT.length).toBeGreaterThan(3500);
    for (const slot of ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring']) {
      expect(EQUIPMENT.filter((e) => e.slot === slot).length, slot).toBeGreaterThan(50);
    }
    const whip = findEquipment('Abyssal whip')!;
    expect(whip).toMatchObject({ slot: 'weapon', two: false, sp: 4, req: { attack: 70 } });
    expect(whip.s[STAT_KEYS.indexOf('aslash')]).toBe(82);
    expect(whip.s[STAT_KEYS.indexOf('str')]).toBe(82);
    expect(findEquipment('toxic blowpipe')).toMatchObject({ two: true });
    expect(findEquipment('trident of the seas')?.n).toBe('Trident of the Seas');
    expect(findEquipment('Not a thing')).toBeUndefined();
  });

  it('sums a setup and ignores the shield with a two-handed weapon', () => {
    const r = setupStats({ weapon: 'Abyssal whip', body: 'Fighter torso', hands: 'Barrows gloves', shield: 'Dragon defender' });
    expect(r.total.str).toBe(82 + 4 + 12 + findEquipment('Dragon defender')!.s[STAT_KEYS.indexOf('str')]);
    expect(r.speed).toBe(4);
    const two = setupStats({ weapon: 'Toxic blowpipe', shield: 'Dragon defender', ammo: 'Rune arrow' });
    expect(two.twoHanded).toBe(true);
    expect(two.total.rstr).toBe(20 + 49);
    expect(setupStats({ head: 'Mystery hat 9000' }).unknown).toEqual(['Mystery hat 9000']);
  });

  it('searches by slot first and ranks prefix matches', () => {
    expect(searchEquipment('dragon sc', 'weapon')[0].n).toBe('Dragon scimitar');
    expect(searchEquipment('fire', 'cape')[0].n).toBe('Fire cape');
    expect(searchEquipment('a')).toEqual([]);
  });

  it('detects gear-driven modifiers', () => {
    const m = detectModifiers({ head: 'Slayer helmet (i)', neck: 'Salve amulet (ei)', weapon: 'Abyssal whip' });
    expect(m).toMatchObject({ slayerHelm: true, slayerHelmImbued: true, salveEi: true, voidMelee: false });
    const v = detectModifiers({ head: 'Void melee helm', body: 'Void knight top', legs: 'Void knight robe', hands: 'Void knight gloves' });
    expect(v.voidMelee).toBe(true);
    const ev = detectModifiers({ head: 'Void ranger helm', body: 'Elite void top', legs: 'Elite void robe', hands: 'Void knight gloves' });
    expect(ev).toMatchObject({ voidRanged: true, eliteVoidRanged: true });
  });
});
