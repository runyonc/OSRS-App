/**
 * Max hit calculators, following the OSRS Wiki's "Maximum melee hit", "Maximum ranged hit" and "Maximum magic hit" pages.
 * Everything is integer maths with floors at the same points the game applies them.
 */

export type MeleeStyle = 'accurate' | 'aggressive' | 'controlled' | 'defensive';
export type RangedStyle = 'accurate' | 'rapid' | 'longrange';

export const MELEE_PRAYERS = [
  { id: 'none', label: 'None', mult: 1 },
  { id: 'burst', label: 'Burst of Strength (5%)', mult: 1.05 },
  { id: 'superhuman', label: 'Superhuman Strength (10%)', mult: 1.1 },
  { id: 'ultimate', label: 'Ultimate Strength (15%)', mult: 1.15 },
  { id: 'chivalry', label: 'Chivalry (18%)', mult: 1.18 },
  { id: 'piety', label: 'Piety (23%)', mult: 1.23 },
] as const;

export const RANGED_PRAYERS = [
  { id: 'none', label: 'None', mult: 1 },
  { id: 'sharp', label: 'Sharp Eye (5%)', mult: 1.05 },
  { id: 'hawk', label: 'Hawk Eye (10%)', mult: 1.1 },
  { id: 'eagle', label: 'Eagle Eye (15%)', mult: 1.15 },
  { id: 'rigour', label: 'Rigour (23%)', mult: 1.23 },
] as const;

export const MELEE_POTIONS = [
  { id: 'none', label: 'None', boost: () => 0 },
  { id: 'strength', label: 'Strength potion (+3 +10%)', boost: (l: number) => 3 + Math.floor(l * 0.1) },
  { id: 'super', label: 'Super strength (+5 +15%)', boost: (l: number) => 5 + Math.floor(l * 0.15) },
  { id: 'overload', label: 'Overload (+5 +13%)', boost: (l: number) => 5 + Math.floor(l * 0.13) },
  { id: 'smelling', label: 'Smelling salts (+11 +16%)', boost: (l: number) => 11 + Math.floor(l * 0.16) },
] as const;

export const RANGED_POTIONS = [
  { id: 'none', label: 'None', boost: () => 0 },
  { id: 'ranging', label: 'Ranging potion (+4 +10%)', boost: (l: number) => 4 + Math.floor(l * 0.1) },
  { id: 'overload', label: 'Overload (+5 +13%)', boost: (l: number) => 5 + Math.floor(l * 0.13) },
  { id: 'smelling', label: 'Smelling salts (+11 +16%)', boost: (l: number) => 11 + Math.floor(l * 0.16) },
] as const;

export const MAGIC_POTIONS = [
  { id: 'none', label: 'None', boost: () => 0 },
  { id: 'magic', label: 'Magic potion (+4)', boost: () => 4 },
  { id: 'heart', label: 'Imbued heart (+1 +10%)', boost: (l: number) => 1 + Math.floor(l * 0.1) },
  { id: 'saturated', label: 'Saturated heart (+4 +10%)', boost: (l: number) => 4 + Math.floor(l * 0.1) },
  { id: 'overload', label: 'Overload (+5 +13%)', boost: (l: number) => 5 + Math.floor(l * 0.13) },
] as const;

export interface MeleeInput {
  strengthLevel: number;
  potionBoost: number;
  prayerMult: number;
  style: MeleeStyle;
  strengthBonus: number;
  void: boolean;
  /** Slayer helmet / black mask on task: ×7/6. */
  slayerHelm?: boolean;
  /** Salve amulet (e): ×1.2 (overrides the slayer helm; they do not stack). */
  salveE?: boolean;
  /** Berserker necklace with an obsidian weapon: ×1.2. */
  obsidian?: boolean;
}

export interface MaxHitResult {
  maxHit: number;
  effectiveLevel: number;
  steps: string[];
}

export function meleeMaxHit(i: MeleeInput): MaxHitResult {
  const steps: string[] = [];
  let eff = Math.floor((i.strengthLevel + i.potionBoost) * i.prayerMult);
  steps.push(`floor((${i.strengthLevel} + ${i.potionBoost}) × ${i.prayerMult}) = ${eff}`);
  const styleBonus = i.style === 'aggressive' ? 3 : i.style === 'controlled' ? 1 : 0;
  eff += styleBonus + 8;
  steps.push(`+ ${styleBonus} style + 8 = ${eff}`);
  if (i.void) { eff = Math.floor(eff * 1.1); steps.push(`× 1.1 void = ${eff}`); }
  let max = Math.floor(0.5 + (eff * (i.strengthBonus + 64)) / 640);
  steps.push(`floor(0.5 + ${eff} × (${i.strengthBonus} + 64) / 640) = ${max}`);
  if (i.salveE) { max = Math.floor(max * 1.2); steps.push(`× 1.2 salve (e) = ${max}`); }
  else if (i.slayerHelm) { max = Math.floor((max * 7) / 6); steps.push(`× 7/6 slayer helm = ${max}`); }
  if (i.obsidian) { max = Math.floor(max * 1.2); steps.push(`× 1.2 berserker necklace = ${max}`); }
  return { maxHit: max, effectiveLevel: eff, steps };
}

export interface RangedInput {
  rangedLevel: number;
  potionBoost: number;
  prayerMult: number;
  style: RangedStyle;
  rangedStrength: number;
  void: boolean;
  eliteVoid: boolean;
  slayerHelm?: boolean;
  salveEi?: boolean;
}

export function rangedMaxHit(i: RangedInput): MaxHitResult {
  const steps: string[] = [];
  let eff = Math.floor((i.rangedLevel + i.potionBoost) * i.prayerMult);
  steps.push(`floor((${i.rangedLevel} + ${i.potionBoost}) × ${i.prayerMult}) = ${eff}`);
  const styleBonus = i.style === 'accurate' ? 3 : 0;
  eff += styleBonus + 8;
  steps.push(`+ ${styleBonus} style + 8 = ${eff}`);
  if (i.eliteVoid) { eff = Math.floor(eff * 1.125); steps.push(`× 1.125 elite void = ${eff}`); }
  else if (i.void) { eff = Math.floor(eff * 1.1); steps.push(`× 1.1 void = ${eff}`); }
  let max = Math.floor(0.5 + (eff * (i.rangedStrength + 64)) / 640);
  steps.push(`floor(0.5 + ${eff} × (${i.rangedStrength} + 64) / 640) = ${max}`);
  if (i.salveEi) { max = Math.floor(max * 1.2); steps.push(`× 1.2 salve (ei) = ${max}`); }
  else if (i.slayerHelm) { max = Math.floor(max * 1.15); steps.push(`× 1.15 slayer helm (i) = ${max}`); }
  return { maxHit: max, effectiveLevel: eff, steps };
}

export interface Spell {
  id: string;
  name: string;
  book: 'standard' | 'ancient' | 'staff';
  /** Fixed base max hit, or a function of the (boosted) magic level for powered staves. */
  base: number | ((magicLevel: number) => number);
  level: number;
}

export const SPELLS: Spell[] = [
  { id: 'wind-strike', name: 'Wind Strike', book: 'standard', base: 2, level: 1 },
  { id: 'water-strike', name: 'Water Strike', book: 'standard', base: 4, level: 5 },
  { id: 'earth-strike', name: 'Earth Strike', book: 'standard', base: 6, level: 9 },
  { id: 'fire-strike', name: 'Fire Strike', book: 'standard', base: 8, level: 13 },
  { id: 'wind-bolt', name: 'Wind Bolt', book: 'standard', base: 9, level: 17 },
  { id: 'water-bolt', name: 'Water Bolt', book: 'standard', base: 10, level: 23 },
  { id: 'earth-bolt', name: 'Earth Bolt', book: 'standard', base: 11, level: 29 },
  { id: 'fire-bolt', name: 'Fire Bolt', book: 'standard', base: 12, level: 35 },
  { id: 'wind-blast', name: 'Wind Blast', book: 'standard', base: 13, level: 41 },
  { id: 'water-blast', name: 'Water Blast', book: 'standard', base: 14, level: 47 },
  { id: 'iban-blast', name: 'Iban Blast', book: 'standard', base: 25, level: 50 },
  { id: 'earth-blast', name: 'Earth Blast', book: 'standard', base: 15, level: 53 },
  { id: 'fire-blast', name: 'Fire Blast', book: 'standard', base: 16, level: 59 },
  { id: 'wind-wave', name: 'Wind Wave', book: 'standard', base: 17, level: 62 },
  { id: 'water-wave', name: 'Water Wave', book: 'standard', base: 18, level: 65 },
  { id: 'earth-wave', name: 'Earth Wave', book: 'standard', base: 19, level: 70 },
  { id: 'fire-wave', name: 'Fire Wave', book: 'standard', base: 20, level: 75 },
  { id: 'wind-surge', name: 'Wind Surge', book: 'standard', base: 21, level: 81 },
  { id: 'water-surge', name: 'Water Surge', book: 'standard', base: 22, level: 85 },
  { id: 'earth-surge', name: 'Earth Surge', book: 'standard', base: 23, level: 90 },
  { id: 'fire-surge', name: 'Fire Surge', book: 'standard', base: 24, level: 95 },
  { id: 'smoke-rush', name: 'Smoke Rush', book: 'ancient', base: 13, level: 50 },
  { id: 'shadow-rush', name: 'Shadow Rush', book: 'ancient', base: 14, level: 52 },
  { id: 'blood-rush', name: 'Blood Rush', book: 'ancient', base: 15, level: 56 },
  { id: 'ice-rush', name: 'Ice Rush', book: 'ancient', base: 16, level: 58 },
  { id: 'smoke-burst', name: 'Smoke Burst', book: 'ancient', base: 17, level: 62 },
  { id: 'shadow-burst', name: 'Shadow Burst', book: 'ancient', base: 18, level: 64 },
  { id: 'blood-burst', name: 'Blood Burst', book: 'ancient', base: 21, level: 68 },
  { id: 'ice-burst', name: 'Ice Burst', book: 'ancient', base: 22, level: 70 },
  { id: 'smoke-blitz', name: 'Smoke Blitz', book: 'ancient', base: 23, level: 74 },
  { id: 'shadow-blitz', name: 'Shadow Blitz', book: 'ancient', base: 24, level: 76 },
  { id: 'blood-blitz', name: 'Blood Blitz', book: 'ancient', base: 25, level: 80 },
  { id: 'ice-blitz', name: 'Ice Blitz', book: 'ancient', base: 26, level: 82 },
  { id: 'smoke-barrage', name: 'Smoke Barrage', book: 'ancient', base: 27, level: 86 },
  { id: 'shadow-barrage', name: 'Shadow Barrage', book: 'ancient', base: 28, level: 88 },
  { id: 'blood-barrage', name: 'Blood Barrage', book: 'ancient', base: 29, level: 92 },
  { id: 'ice-barrage', name: 'Ice Barrage', book: 'ancient', base: 30, level: 94 },
  { id: 'trident-seas', name: 'Trident of the seas', book: 'staff', base: (l) => Math.floor(l / 3) - 5, level: 75 },
  { id: 'trident-swamp', name: 'Trident of the swamp', book: 'staff', base: (l) => Math.floor(l / 3) - 2, level: 75 },
  { id: 'sanguinesti', name: 'Sanguinesti staff', book: 'staff', base: (l) => Math.floor(l / 3) - 1, level: 82 },
  { id: 'harmonised', name: 'Harmonised / volatile / eldritch nightmare staff', book: 'staff', base: (l) => Math.floor(l / 3) - 1, level: 82 },
  { id: 'shadow', name: "Tumeken's shadow", book: 'staff', base: (l) => Math.floor(l / 3) + 1, level: 85 },
  { id: 'warped-sceptre', name: 'Warped sceptre', book: 'staff', base: (l) => Math.floor((8 * l + 96) / 37), level: 62 },
  { id: 'bone-staff', name: 'Bone staff', book: 'staff', base: (l) => Math.floor(l / 3) - 5, level: 50 },
];

export interface MagicInput {
  magicLevel: number;
  potionBoost: number;
  spell: Spell;
  /** Total magic damage % from gear (occult 10, tormented bracelet 5, …). */
  magicDamagePct: number;
  eliteVoid: boolean;
  slayerHelm?: boolean;
  salveEi?: boolean;
  /** Chaos gauntlets with a bolt spell: +3 base. */
  chaosGauntlets?: boolean;
  /** Tome of fire with a fire spell: +50% damage. */
  tomeOfFire?: boolean;
}

export function magicMaxHit(i: MagicInput): MaxHitResult {
  const steps: string[] = [];
  const level = i.magicLevel + i.potionBoost;
  let base = typeof i.spell.base === 'function' ? i.spell.base(level) : i.spell.base;
  steps.push(typeof i.spell.base === 'function' ? `base from magic level ${level} = ${base}` : `base ${base}`);
  if (i.chaosGauntlets && /bolt/i.test(i.spell.name)) { base += 3; steps.push(`+ 3 chaos gauntlets = ${base}`); }
  let pct = i.magicDamagePct;
  if (i.eliteVoid) pct += 2.5;
  if (i.salveEi) pct += 20;
  else if (i.slayerHelm) pct += 15;
  if (i.tomeOfFire && /^fire/i.test(i.spell.name)) pct += 50;
  // Tumeken's shadow triples gear magic damage (capped at 100%).
  if (i.spell.id === 'shadow') pct = Math.min(100, i.magicDamagePct * 3) + (pct - i.magicDamagePct);
  const max = Math.floor(base * (1 + pct / 100));
  steps.push(`floor(${base} × (1 + ${pct}%)) = ${max}`);
  return { maxHit: max, effectiveLevel: level, steps };
}
