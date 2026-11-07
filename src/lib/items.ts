import itemsJson from '../data/items.json';
import equipmentJson from '../data/equipment.json';

/** Every item name in the game, sorted. */
export const ALL_ITEMS: string[] = itemsJson as string[];
/** Item names per equipment slot (weapon includes two-handed). */
export const EQUIPMENT: Record<string, string[]> = equipmentJson as Record<string, string[]>;

const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Rank items for a query: exact match, then names starting with the query, then names with a word starting with it,
 * then anything containing it. Ties keep alphabetical order.
 */
export function searchItems(query: string, pool: string[] = ALL_ITEMS, limit = 8): string[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const tiers: string[][] = [[], [], [], []];
  for (const name of pool) {
    const n = norm(name);
    if (n === q) tiers[0].push(name);
    else if (n.startsWith(q)) tiers[1].push(name);
    else if (n.includes(' ' + q)) tiers[2].push(name);
    else if (n.includes(q)) tiers[3].push(name);
    if (tiers[0].length + tiers[1].length >= limit) break;
  }
  return tiers.flat().slice(0, limit);
}

export function slotItems(slot: string): string[] {
  return EQUIPMENT[slot] ?? [];
}

export function isKnownItem(name: string): boolean {
  const n = norm(name);
  return ALL_ITEMS.some((i) => norm(i) === n);
}
