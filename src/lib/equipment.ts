import equipmentJson from '../data/equipment.json';
import spriteJson from '../data/equipmentSprite.json';

export const STAT_KEYS = ['astab', 'aslash', 'acrush', 'amagic', 'arange', 'dstab', 'dslash', 'dcrush', 'dmagic', 'drange', 'str', 'rstr', 'mdmg', 'prayer'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export interface Equipment {
  /** Item name (wiki page title). */
  n: string;
  slot: string;
  /** Two-handed weapon. */
  two: boolean;
  /** Bonuses in STAT_KEYS order. */
  s: number[];
  /** Attack speed in ticks (weapons). */
  sp?: number;
  /** Wiki combat style group, e.g. "Slash Sword", "Crossbow", "Powered Staff". */
  cs?: string;
  /** Level requirements to wear or wield. */
  req?: Record<string, number>;
}

export const EQUIPMENT: Equipment[] = equipmentJson as Equipment[];
const SPRITE = spriteJson as { cell: number; cols: number; index: Record<string, number> };

const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9 ()]+/g, ' ').replace(/\s+/g, ' ').trim();
const BY_NORM = new Map<string, Equipment>();
for (const e of EQUIPMENT) BY_NORM.set(norm(e.n), e);

export function findEquipment(name: string): Equipment | undefined {
  if (!name) return undefined;
  return BY_NORM.get(norm(name));
}

export function statsOf(e: Equipment | undefined): Stats {
  const out = {} as Stats;
  STAT_KEYS.forEach((k, i) => { out[k] = e ? e.s[i] ?? 0 : 0; });
  return out;
}

export function emptyStats(): Stats {
  return statsOf(undefined);
}

/** Sum bonuses over a gear setup's slot → item name map. A two-handed weapon ignores the shield slot. */
export function setupStats(slots: Record<string, string>): { total: Stats; items: Record<string, Equipment | undefined>; speed?: number; twoHanded: boolean; unknown: string[] } {
  const total = emptyStats();
  const items: Record<string, Equipment | undefined> = {};
  const unknown: string[] = [];
  const weapon = findEquipment(slots.weapon ?? '');
  const twoHanded = Boolean(weapon?.two);
  for (const [slot, name] of Object.entries(slots)) {
    if (!name?.trim()) continue;
    if (slot === 'shield' && twoHanded) continue;
    const e = findEquipment(name);
    items[slot] = e;
    if (!e) { unknown.push(name); continue; }
    STAT_KEYS.forEach((k, i) => { total[k] += e.s[i] ?? 0; });
  }
  return { total, items, speed: weapon?.sp, twoHanded, unknown };
}

/** Search equipment by name, preferring the given slot, exact and prefix matches first. */
export function searchEquipment(query: string, slot?: string, limit = 8): Equipment[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const tiers: Equipment[][] = [[], [], [], []];
  const pools = slot ? [EQUIPMENT.filter((e) => e.slot === slot), EQUIPMENT.filter((e) => e.slot !== slot)] : [EQUIPMENT];
  for (const pool of pools) {
    for (const e of pool) {
      const n = norm(e.n);
      if (n === q) tiers[0].push(e);
      else if (n.startsWith(q)) tiers[1].push(e);
      else if (n.includes(' ' + q)) tiers[2].push(e);
      else if (n.includes(q)) tiers[3].push(e);
    }
    const found = tiers.flat();
    if (found.length >= limit) return found.slice(0, limit);
  }
  return tiers.flat().slice(0, limit);
}

/** Replaced with a data: URI in the single-file build. */
export const SPRITE_URL = `${import.meta.env.BASE_URL}equipment-sprite.png`;

export function spriteStyle(name: string, size = 32): React.CSSProperties | undefined {
  const i = SPRITE.index[name] ?? SPRITE.index[findEquipment(name)?.n ?? ''];
  if (i === undefined) return undefined;
  const scale = size / SPRITE.cell;
  const x = (i % SPRITE.cols) * SPRITE.cell;
  const y = Math.floor(i / SPRITE.cols) * SPRITE.cell;
  return {
    width: size,
    height: size,
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundPosition: `-${x * scale}px -${y * scale}px`,
    backgroundSize: `${SPRITE.cols * SPRITE.cell * scale}px auto`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}

export const STAT_LABELS: Record<StatKey, string> = {
  astab: 'Stab', aslash: 'Slash', acrush: 'Crush', amagic: 'Magic', arange: 'Ranged',
  dstab: 'Stab', dslash: 'Slash', dcrush: 'Crush', dmagic: 'Magic', drange: 'Ranged',
  str: 'Melee str', rstr: 'Ranged str', mdmg: 'Magic dmg %', prayer: 'Prayer',
};

/** Gear-driven max hit modifiers, detected from item names in a setup. */
export function detectModifiers(slots: Record<string, string>) {
  const names = Object.values(slots).map((n) => norm(n ?? ''));
  const has = (re: RegExp) => names.some((n) => re.test(n));
  const voidPieces = ['void knight top', 'void knight robe', 'void knight gloves'].every((p) => names.some((n) => n.startsWith(p) || n.startsWith('elite ' + p.replace('void knight ', 'void '))));
  const eliteBody = has(/^elite void top/) && has(/^elite void robe/);
  const voidHelm = { melee: has(/^void melee helm/), ranged: has(/^void ranger helm/), magic: has(/^void mage helm/) };
  return {
    voidMelee: voidPieces && voidHelm.melee,
    voidRanged: voidPieces && voidHelm.ranged,
    eliteVoidRanged: voidPieces && eliteBody && voidHelm.ranged,
    eliteVoidMagic: voidPieces && eliteBody && voidHelm.magic,
    slayerHelm: has(/^slayer helmet|^black mask/),
    slayerHelmImbued: has(/^slayer helmet \(i\)|^black mask \(i\)/),
    salveE: has(/^salve amulet ?\(e\)|^salve amulet\(e\)/),
    salveEi: has(/^salve amulet ?\(ei\)|^salve amulet\(ei\)/),
    berserkerNecklace: has(/^berserker necklace/),
    obsidianWeapon: has(/^(toktz-xil-ak|tzhaar-ket-om|toktz-xil-ek|tzhaar-ket-em|toktz-mej-tal)/),
    chaosGauntlets: has(/^chaos gauntlets/),
    tomeOfFire: has(/^tome of fire/),
  };
}
