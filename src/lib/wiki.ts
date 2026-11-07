import { WIKI_API, GUIDE_PAGE } from '../config';
import { parseGuide } from './wikitext';
import { parseQuestRequirements } from './questReqs';
import type { GuideStep, QuestReqs } from './types';
import questNamesJson from '../data/questNames.json';

export const QUEST_NAMES = new Set<string>(questNamesJson as string[]);

async function wikiParse(page: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', page);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');
  const res = await fetchImpl(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Wiki responded ${res.status} for ${page}`);
  const data = await res.json();
  const text = data?.parse?.wikitext;
  if (typeof text !== 'string') throw new Error(`No wikitext for ${page}`);
  return text;
}

export async function fetchGuideSteps(fetchImpl?: typeof fetch): Promise<{ steps: GuideStep[]; unparsed: number; totalRows: number }> {
  const wikitext = await wikiParse(GUIDE_PAGE, fetchImpl);
  const result = parseGuide(wikitext, { questNames: QUEST_NAMES });
  for (const u of result.unparsed) console.warn('[guide] unparsed row', u.index, u.reason, u.raw.split('\n')[0]);
  return { steps: result.steps, unparsed: result.unparsed.length, totalRows: result.totalRows };
}

export async function fetchQuestReqs(quest: string, fetchImpl?: typeof fetch): Promise<QuestReqs> {
  const wikitext = await wikiParse(quest, fetchImpl);
  return { ...parseQuestRequirements(wikitext, QUEST_NAMES), fetchedAt: Date.now() };
}

export function wikiPageUrl(title: string): string {
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function trainingUrl(skill: string): string {
  const name = skill.charAt(0).toUpperCase() + skill.slice(1);
  return wikiPageUrl(`Pay-to-play ${name} training`);
}
