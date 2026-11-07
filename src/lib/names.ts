/**
 * Name matching between the wiki guide and the WikiSync quest map.
 * The export's keys come from the in-game quest list, the guide's from wiki page titles;
 * they differ in punctuation ("Recipe for Disaster/Freeing Evil Dave" vs "Recipe for Disaster - Freeing Evil Dave"),
 * so we compare normalized forms and keep a small alias table for the rest.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\(miniquest\)/g, '')
    .replace(/\s+(i{1,3}|iv|v)\s*$/i, (_m, r: string) => ' ' + romanToNumber(r))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function romanToNumber(r: string): string {
  const map: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' };
  return map[r.toLowerCase()] ?? r;
}

/** guide name → export name, for the few that normalization alone does not catch. */
export const QUEST_ALIASES: Record<string, string[]> = {
  'Recipe for Disaster/Another Cook\'s Quest': ['Recipe for Disaster - Another Cook\'s Quest', 'Recipe for Disaster: Another Cook\'s Quest'],
  'Recipe for Disaster/Defeating the Culinaromancer': ['Recipe for Disaster - Defeating the Culinaromancer', 'Recipe for Disaster: The final battle', 'Recipe for Disaster'],
  'Knight Waves Training Grounds': ['Knight Waves Training Ground'],
  'The Mage Arena': ['Mage Arena I'],
  'Desert Treasure I': ['Desert Treasure'],
  'Dragon Slayer I': ['Dragon Slayer'],
  'Elemental Workshop I': ['Elemental Workshop'],
  'Monkey Madness I': ['Monkey Madness'],
  'Fairytale I - Growing Pains': ['Fairy Tale I - Growing Pains', 'Fairytale I'],
  'Fairytale II - Cure a Queen': ['Fairy Tale II - Cure a Queen', 'Fairytale II'],
  'Desert Treasure II - The Fallen Empire': ['Desert Treasure II'],
};

/**
 * Find the key in `map` that refers to `name`. Returns undefined when nothing matches,
 * which callers treat as "not tracked by the import" rather than "not done".
 */
export function findQuestKey(name: string, map: Record<string, unknown>): string | undefined {
  if (name in map) return name;
  const want = normalizeName(name);
  const candidates = [want, ...(QUEST_ALIASES[name] ?? []).map(normalizeName)];
  for (const key of Object.keys(map)) {
    const n = normalizeName(key);
    if (candidates.includes(n)) return key;
  }
  // "Recipe for Disaster/Freeing X" vs "Recipe for Disaster - Freeing X" already collapse; try a looser subquest match.
  const tail = want.replace(/^recipe for disaster /, '');
  if (tail !== want) {
    for (const key of Object.keys(map)) {
      const n = normalizeName(key);
      if (n.startsWith('recipe for disaster') && n.endsWith(tail)) return key;
    }
  }
  return undefined;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
