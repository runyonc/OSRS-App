import { levelForXp, xpForLevel } from './xp';

export interface XpPlan {
  currentLevel: number;
  currentXp: number;
  targetLevel: number;
  targetXp: number;
  remaining: number;
  /** 0..1 of the way from current level to target. */
  progress: number;
}

export function planXp(currentXp: number, targetLevel: number): XpPlan {
  const target = Math.max(1, Math.min(126, Math.floor(targetLevel)));
  const targetXp = xpForLevel(target);
  const currentLevel = levelForXp(currentXp, 126);
  const remaining = Math.max(0, targetXp - currentXp);
  const start = xpForLevel(currentLevel);
  const progress = targetXp <= start ? 1 : Math.max(0, Math.min(1, (currentXp - start) / (targetXp - start)));
  return { currentLevel, currentXp, targetLevel: target, targetXp, remaining, progress };
}

export function actionsNeeded(remainingXp: number, xpPerAction: number): number {
  if (!(xpPerAction > 0)) return 0;
  return Math.ceil(remainingXp / xpPerAction);
}

/** Hours at a given XP/hour rate, rounded to one decimal. */
export function hoursNeeded(remainingXp: number, xpPerHour: number): number {
  if (!(xpPerHour > 0)) return 0;
  return Math.round((remainingXp / xpPerHour) * 10) / 10;
}

/** The classic skill-tab ordering: three columns read left to right, top to bottom. */
export const STATS_ORDER = [
  'attack', 'hitpoints', 'mining',
  'strength', 'agility', 'smithing',
  'defence', 'herblore', 'fishing',
  'ranged', 'thieving', 'cooking',
  'prayer', 'crafting', 'firemaking',
  'magic', 'fletching', 'woodcutting',
  'runecraft', 'slayer', 'farming',
  'construction', 'hunter', 'sailing',
] as const;

export const GEAR_SLOTS = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];
