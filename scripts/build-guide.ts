/**
 * Fetch the Optimal quest guide (ironman) wikitext and each quest's requirements from the OSRS Wiki,
 * then write src/data/guide.json and src/data/questReqs.json so the app works offline and parsing
 * can be tested without the network.
 *
 *   npm run build-guide            # fetch from the wiki
 *   npm run build-guide -- --offline  # re-parse fixtures/guide.wikitext only
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGuide } from '../src/lib/wikitext';
import { parseQuestRequirements } from '../src/lib/questReqs';
import { WIKI_API, GUIDE_PAGE, USER_AGENT } from '../src/config';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = resolve(root, 'fixtures/guide.wikitext');
const dataDir = resolve(root, 'src/data');
const offline = process.argv.includes('--offline');

async function wikiGet(params: Record<string, string>): Promise<any> {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchGuideWikitext(): Promise<string> {
  const data = await wikiGet({ action: 'parse', page: GUIDE_PAGE, prop: 'wikitext' });
  return data.parse.wikitext as string;
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
    const redirects: Record<string, string> = {};
    for (const r of data.query.redirects ?? []) redirects[r.to] = r.from;
    for (const p of data.query.pages ?? []) {
      const content = p.revisions?.[0]?.slots?.main?.content;
      if (!content) continue;
      out[p.title] = content;
      if (redirects[p.title]) out[redirects[p.title]] = content;
    }
  }
  return out;
}

async function main() {
  mkdirSync(dataDir, { recursive: true });
  let wikitext: string;
  let questNames: string[] = [];
  if (offline) {
    wikitext = readFileSync(fixturePath, 'utf8');
    if (existsSync(resolve(dataDir, 'questNames.json'))) questNames = JSON.parse(readFileSync(resolve(dataDir, 'questNames.json'), 'utf8'));
  } else {
    console.log('Fetching guide wikitext…');
    wikitext = await fetchGuideWikitext();
    writeFileSync(fixturePath, wikitext);
    console.log('Fetching quest list…');
    questNames = (await fetchCategory('Quests')).filter((t) => !t.startsWith('Quests') && !/^Quest /.test(t) && !/Optimal quest guide|Required Quest|Recipe for Disaster\/Full guide|Recipe for Disaster$/.test(t));
    writeFileSync(resolve(dataDir, 'questNames.json'), JSON.stringify(questNames, null, 2));
  }

  const result = parseGuide(wikitext, { questNames });
  const pct = result.totalRows ? (100 * result.unparsed.length) / result.totalRows : 0;
  console.log(`Parsed ${result.steps.length} steps from ${result.totalRows} rows; ${result.unparsed.length} unparsed (${pct.toFixed(1)}%).`);
  for (const u of result.unparsed) console.warn(`  row ${u.index}: ${u.reason}\n    ${u.raw.split('\n')[0]}`);
  writeFileSync(
    resolve(dataDir, 'guide.json'),
    JSON.stringify({ fetchedAt: Date.now(), source: `https://oldschool.runescape.wiki/w/${GUIDE_PAGE}`, steps: result.steps }, null, 1),
  );

  if (!offline) {
    const questTitles = Array.from(new Set(result.steps.filter((s) => s.quest && (s.type === 'quest' || s.type === 'miniquest')).map((s) => s.quest!)));
    console.log(`Fetching requirements for ${questTitles.length} quest pages…`);
    const pages = await fetchPages(questTitles);
    const knownQuests = new Set([...questNames, ...questTitles]);
    const reqs: Record<string, ReturnType<typeof parseQuestRequirements>> = {};
    let missing = 0;
    for (const title of questTitles) {
      const text = pages[title];
      if (!text) { missing++; console.warn(`  no page for ${title}`); continue; }
      reqs[title] = parseQuestRequirements(text, knownQuests);
    }
    console.log(`Wrote requirements for ${Object.keys(reqs).length} quests (${missing} missing).`);
    writeFileSync(resolve(dataDir, 'questReqs.json'), JSON.stringify({ fetchedAt: Date.now(), reqs }, null, 1));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
