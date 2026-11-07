/** Standard OSRS XP table: XP_TABLE[level] = XP needed to be that level (index 1 = 0 XP). */
export const XP_TABLE: number[] = (() => {
  const table = [0, 0];
  let points = 0;
  for (let lvl = 1; lvl < 126; lvl++) {
    points += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table[lvl + 1] = Math.floor(points / 4);
  }
  return table;
})();

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= 126) return XP_TABLE[126];
  return XP_TABLE[level];
}

export function levelForXp(xp: number, cap = 99): number {
  let level = 1;
  while (level < cap && xp >= XP_TABLE[level + 1]) level++;
  return level;
}

/** 0..1 progress from the start of the current level toward the target level. */
export function progressToLevel(xp: number, target: number): number {
  const current = levelForXp(xp, 126);
  if (current >= target) return 1;
  const start = xpForLevel(current);
  const end = xpForLevel(target);
  if (end <= start) return 1;
  return Math.max(0, Math.min(1, (xp - start) / (end - start)));
}

export const SKILLS = [
  'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic',
  'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting',
  'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming',
  'runecraft', 'hunter', 'construction', 'sailing',
] as const;

export function skillKey(name: string): string {
  const k = name.trim().toLowerCase().replace(/\s+/g, '');
  if (k === 'runecrafting') return 'runecraft';
  if (k === 'hp' || k === 'constitution') return 'hitpoints';
  if (k === 'range') return 'ranged';
  return k;
}

export function skillLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}
