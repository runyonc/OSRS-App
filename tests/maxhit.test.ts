import { describe, it, expect } from 'vitest';
import { meleeMaxHit, rangedMaxHit, magicMaxHit, SPELLS } from '../src/lib/maxhit';

describe('max hit', () => {
  it('melee matches the wiki worked example', () => {
    // 99 Strength, super strength (+19), Piety, aggressive, +100 strength bonus → 40
    const r = meleeMaxHit({ strengthLevel: 99, potionBoost: 19, prayerMult: 1.23, style: 'aggressive', strengthBonus: 100, void: false });
    expect(r.effectiveLevel).toBe(156);
    expect(r.maxHit).toBe(40);
    // No boosts, 1 strength, no bonus → 1
    expect(meleeMaxHit({ strengthLevel: 1, potionBoost: 0, prayerMult: 1, style: 'accurate', strengthBonus: 0, void: false }).maxHit).toBe(1);
  });

  it('applies slayer helm, salve and void in the right order', () => {
    const base = meleeMaxHit({ strengthLevel: 79, potionBoost: 0, prayerMult: 1, style: 'aggressive', strengthBonus: 82, void: false });
    const helm = meleeMaxHit({ strengthLevel: 79, potionBoost: 0, prayerMult: 1, style: 'aggressive', strengthBonus: 82, void: false, slayerHelm: true });
    expect(helm.maxHit).toBe(Math.floor((base.maxHit * 7) / 6));
    const salve = meleeMaxHit({ strengthLevel: 79, potionBoost: 0, prayerMult: 1, style: 'aggressive', strengthBonus: 82, void: false, slayerHelm: true, salveE: true });
    expect(salve.maxHit).toBe(Math.floor(base.maxHit * 1.2));
    const v = meleeMaxHit({ strengthLevel: 79, potionBoost: 0, prayerMult: 1, style: 'aggressive', strengthBonus: 82, void: true });
    expect(v.effectiveLevel).toBe(Math.floor((79 + 3 + 8) * 1.1));
  });

  it('ranged uses ranged strength and the accurate bonus', () => {
    // 99 Ranged, ranging potion (+13), Rigour, accurate, +80 ranged strength (dragon arrows etc.)
    const r = rangedMaxHit({ rangedLevel: 99, potionBoost: 13, prayerMult: 1.23, style: 'accurate', rangedStrength: 80, void: false, eliteVoid: false });
    expect(r.effectiveLevel).toBe(Math.floor(112 * 1.23) + 3 + 8);
    expect(r.maxHit).toBe(Math.floor(0.5 + (r.effectiveLevel * 144) / 640));
    const rapid = rangedMaxHit({ rangedLevel: 63, potionBoost: 0, prayerMult: 1, style: 'rapid', rangedStrength: 46, void: false, eliteVoid: false });
    expect(rapid.maxHit).toBe(Math.floor(0.5 + ((63 + 8) * 110) / 640));
  });

  it('magic uses spell base hits, powered staves scale with level, and damage % multiplies', () => {
    const fireBolt = SPELLS.find((s) => s.id === 'fire-bolt')!;
    expect(magicMaxHit({ magicLevel: 58, potionBoost: 0, spell: fireBolt, magicDamagePct: 0, eliteVoid: false }).maxHit).toBe(12);
    expect(magicMaxHit({ magicLevel: 58, potionBoost: 0, spell: fireBolt, magicDamagePct: 0, eliteVoid: false, chaosGauntlets: true }).maxHit).toBe(15);
    const trident = SPELLS.find((s) => s.id === 'trident-seas')!;
    expect(magicMaxHit({ magicLevel: 75, potionBoost: 0, spell: trident, magicDamagePct: 0, eliteVoid: false }).maxHit).toBe(20);
    expect(magicMaxHit({ magicLevel: 99, potionBoost: 0, spell: trident, magicDamagePct: 10, eliteVoid: false }).maxHit).toBe(Math.floor(28 * 1.1));
    const barrage = SPELLS.find((s) => s.id === 'ice-barrage')!;
    expect(magicMaxHit({ magicLevel: 94, potionBoost: 0, spell: barrage, magicDamagePct: 15, eliteVoid: false, slayerHelm: true }).maxHit).toBe(Math.floor(30 * 1.3));
  });
});
