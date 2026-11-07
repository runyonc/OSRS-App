/**
 * Build the bundled item database:
 *   src/data/items.json      every item name in the game (from RuneLite's public cache listing)
 *   src/data/equipment.json  item names per equipment slot (from the OSRS Wiki's slot categories)
 *
 *   npm run build-items
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKI_API, USER_AGENT } from '../src/config';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, 'src/data');
const NAMES_URL = 'https://static.runelite.net/cache/item/names.json';

/** Wiki category → app slot key. Two-handed weapons go in the weapon slot. */
const SLOT_CATEGORIES: Record<string, string> = {
  'Head slot items': 'head',
  'Cape slot items': 'cape',
  'Neck slot items': 'neck',
  'Ammunition slot items': 'ammo',
  'Weapon slot items': 'weapon',
  'Two-handed slot items': 'weapon',
  'Body slot items': 'body',
  'Shield slot items': 'shield',
  'Legs slot items': 'legs',
  'Hands slot items': 'hands',
  'Feet slot items': 'feet',
  'Ring slot items': 'ring',
};

async function wikiGet(params: Record<string, string>): Promise<any> {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchCategory(name: string): Promise<string[]> {
  const out: string[] = [];
  let cont: string | undefined;
  do {
    const data = await wikiGet({ action: 'query', list: 'categorymembers', cmtitle: `Category:${name}`, cmlimit: '500', cmnamespace: '0', ...(cont ? { cmcontinue: cont } : {}) });
    out.push(...data.query.categorymembers.map((m: any) => m.title as string));
    cont = data.continue?.cmcontinue;
  } while (cont);
  return out;
}

/** Drop wiki page titles that are not single items (lists, set pages, disambiguation). */
function isItemTitle(t: string): boolean {
  return !/\/|\(disambiguation\)|^List of|^Category:/.test(t);
}

async function main() {
  mkdirSync(dataDir, { recursive: true });
  console.log('Fetching item names…');
  const res = await fetch(NAMES_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} for ${NAMES_URL}`);
  const raw = (await res.json()) as Record<string, string>;
  const names = Array.from(new Set(Object.values(raw).filter((n) => n && n !== 'null' && !/^(Dwarf remains|Null)$/i.test(n)))).sort((a, b) => a.localeCompare(b));
  writeFileSync(resolve(dataDir, 'items.json'), JSON.stringify(names));
  console.log(`  ${names.length} unique item names`);

  const equipment: Record<string, string[]> = {};
  for (const [cat, slot] of Object.entries(SLOT_CATEGORIES)) {
    console.log(`Fetching ${cat}…`);
    const titles = (await fetchCategory(cat)).filter(isItemTitle);
    equipment[slot] = Array.from(new Set([...(equipment[slot] ?? []), ...titles])).sort((a, b) => a.localeCompare(b));
  }
  writeFileSync(resolve(dataDir, 'equipment.json'), JSON.stringify(equipment));
  for (const [slot, list] of Object.entries(equipment)) console.log(`  ${slot}: ${list.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
