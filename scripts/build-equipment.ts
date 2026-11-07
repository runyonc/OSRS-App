/**
 * Build the bundled equipment database from the OSRS Wiki:
 *   src/data/equipment.json  every equippable with slot, combat bonuses, speed, combat style and level requirements
 * Then scripts/build-sprite.py downloads each item's inventory icon and packs them into public/equipment-sprite.png.
 *
 *   npm run build-equipment
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKI_API, USER_AGENT } from '../src/config';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, 'src/data');

const SLOT_CATEGORIES: Record<string, string> = {
  'Head slot items': 'head', 'Cape slot items': 'cape', 'Neck slot items': 'neck', 'Ammunition slot items': 'ammo',
  'Weapon slot items': 'weapon', 'Two-handed slot items': 'weapon', 'Body slot items': 'body', 'Shield slot items': 'shield',
  'Legs slot items': 'legs', 'Hands slot items': 'hands', 'Feet slot items': 'feet', 'Ring slot items': 'ring',
};
const STAT_KEYS = ['astab', 'aslash', 'acrush', 'amagic', 'arange', 'dstab', 'dslash', 'dcrush', 'dmagic', 'drange', 'str', 'rstr', 'mdmg', 'prayer'] as const;
/** Skills that gate wearing or wielding. Crafting/Fletching/Smithing levels in a lead are for making the item, not using it. */
const REQ_SKILLS = ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Prayer', 'Hitpoints', 'Slayer', 'Agility'];
/** Variants that duplicate another entry's stats or never matter for an ironman. */
const JUNK_VARIANT = /\((broken|l|bh|c|beta|historical|Deadman Mode|Last Man Standing|Pete Kayer's Challenges|Trailblazer[^)]*|Twisted League|Leagues?[^)]*|Shattered Relics[^)]*|Raging Echoes[^)]*)\)$/i;

export interface EquipmentEntry {
  n: string;
  slot: string;
  two: boolean;
  s: number[];
  sp?: number;
  cs?: string;
  req?: Record<string, number>;
}

async function wikiGet(params: Record<string, string>): Promise<any> {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`wiki request failed: ${url}`);
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

async function fetchPages(titles: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await wikiGet({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: batch.join('|'), redirects: '1' });
    for (const p of data.query.pages ?? []) {
      const content = p.revisions?.[0]?.slots?.main?.content;
      if (content) out[p.title] = content;
    }
    process.stdout.write(`\r  pages ${Math.min(i + 50, titles.length)}/${titles.length}`);
  }
  process.stdout.write('\n');
  return out;
}

/** Parse the top-level params of the first {{Infobox Bonuses}} on a page. */
function parseInfobox(wikitext: string): Record<string, string> | null {
  const start = wikitext.search(/\{\{Infobox Bonuses/i);
  if (start < 0) return null;
  let depth = 0;
  let i = start;
  for (; i < wikitext.length - 1; i++) {
    if (wikitext.startsWith('{{', i)) { depth++; i++; continue; }
    if (wikitext.startsWith('}}', i)) { depth--; i++; if (depth === 0) break; }
  }
  const body = wikitext.slice(start + 2, i - 1);
  // Split on top-level pipes only.
  const parts: string[] = [];
  let cur = '';
  let d = 0;
  for (let j = 0; j < body.length; j++) {
    const two = body.slice(j, j + 2);
    if (two === '{{' || two === '[[') { d++; cur += two; j++; continue; }
    if (two === '}}' || two === ']]') { d--; cur += two; j++; continue; }
    if (body[j] === '|' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += body[j];
  }
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return params;
}

function num(v: string | undefined): number {
  if (v == null) return 0;
  const m = /^[+-]?\d+(\.\d+)?/.exec(v.replace(/,/g, '').trim());
  return m ? Number(m[0]) : 0;
}

/** Pick the most useful version of a multi-version infobox (charged over uncharged, normal over broken). */
function pickVersion(params: Record<string, string>): number | null {
  const versions = Object.keys(params).filter((k) => /^version\d+$/.test(k)).map((k) => ({ n: Number(k.slice(7)), label: params[k].toLowerCase() }));
  if (!versions.length) return null;
  const bad = /uncharged|broken|locked|empty|inactive|damaged|degraded|\b0\b|unlit|deactivated/;
  const good = versions.filter((v) => !bad.test(v.label));
  const preferred = good.find((v) => /full|charged|normal|active|lit|\(i\)|imbued/.test(v.label)) ?? good[0] ?? versions[0];
  return preferred.n;
}

function requirementsFromLead(wikitext: string): Record<string, number> | undefined {
  const lead = wikitext.replace(/\{\{[^{}]*\}\}/g, '').split(/\n==/)[0].slice(0, 2500);
  const req: Record<string, number> = {};
  const skillRe = REQ_SKILLS.join('|');
  const patterns = [
    new RegExp(`(\\d+)\\s*\\[\\[(${skillRe})(?:\\|[^\\]]*)?\\]\\]`, 'gi'),
    new RegExp(`\\[\\[(${skillRe})(?:\\|[^\\]]*)?\\]\\]\\s*(?:level\\s*)?(?:of\\s*)?(\\d+)`, 'gi'),
    new RegExp(`(\\d+)\\s+(${skillRe})\\b`, 'gi'),
    new RegExp(`(${skillRe})\\s+level\\s+of\\s+(\\d+)`, 'gi'),
  ];
  // Only sentences about wearing or wielding, never about making, casting or enchanting.
  const sentences = lead.split(/(?<=[.!?])\s+/).filter((t) => /requir|wield|wear|equip|need/i.test(t) && !/\b(make|made|craft|fletch|smith|creat|enchant|cast|spell|charge|upgrade|imbue)/i.test(t));
  for (const sentence of sentences) {
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(sentence))) {
        const a = m[1], b = m[2];
        const skill = (/^\d+$/.test(a) ? b : a).toLowerCase();
        const level = Number(/^\d+$/.test(a) ? a : b);
        if (level >= 2 && level <= 99 && !(skill in req)) req[skill] = level;
      }
    }
  }
  return Object.keys(req).length ? req : undefined;
}

async function main() {
  mkdirSync(dataDir, { recursive: true });
  const slotOf: Record<string, string> = {};
  for (const [cat, slot] of Object.entries(SLOT_CATEGORIES)) {
    console.log(`Fetching ${cat}…`);
    for (const t of await fetchCategory(cat)) if (!/\/|\(disambiguation\)|^List of/.test(t) && !JUNK_VARIANT.test(t)) slotOf[t] = slot;
  }
  const titles = Object.keys(slotOf).sort();
  console.log(`Fetching ${titles.length} equipment pages…`);
  const pages = await fetchPages(titles);

  const entries: EquipmentEntry[] = [];
  let noBox = 0;
  for (const title of titles) {
    const text = pages[title];
    if (!text) { noBox++; continue; }
    const params = parseInfobox(text);
    if (!params) { noBox++; continue; }
    const v = pickVersion(params);
    const get = (k: string) => (v != null && params[`${k}${v}`] != null ? params[`${k}${v}`] : params[k]);
    const s = STAT_KEYS.map((k) => num(get(k)));
    const slotRaw = (get('slot') ?? '').toLowerCase();
    const two = slotRaw === '2h';
    const slot = two ? 'weapon' : (SLOT_CATEGORIES[slotRaw] ?? slotRaw) || slotOf[title];
    const entry: EquipmentEntry = { n: title, slot: ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'].includes(slot) ? slot : slotOf[title], two, s };
    const sp = num(get('speed'));
    if (sp) entry.sp = sp;
    const cs = get('combatstyle');
    if (cs) entry.cs = cs.replace(/\[\[|\]\]/g, '').trim();
    const req = requirementsFromLead(text);
    if (req) entry.req = req;
    entries.push(entry);
  }
  entries.sort((a, b) => a.n.localeCompare(b.n));
  writeFileSync(resolve(dataDir, 'equipment.json'), JSON.stringify(entries));
  console.log(`Wrote ${entries.length} equipment entries (${noBox} pages without a bonuses infobox skipped).`);
  const withReq = entries.filter((e) => e.req).length;
  console.log(`  ${withReq} with level requirements parsed from the lead paragraph.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
