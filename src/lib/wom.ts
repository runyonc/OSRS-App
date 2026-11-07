import type { LiveLevels } from './types';
import { WOM_PLAYER_URL, USER_AGENT } from '../config';
import { skillKey } from './xp';

/** GET the player from Wise Old Man. Callers decide caching (1 hour minimum). */
export async function fetchWomPlayer(fetchImpl: typeof fetch = fetch): Promise<LiveLevels> {
  const res = await fetchImpl(WOM_PLAYER_URL, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Wise Old Man responded ${res.status}`);
  const data = await res.json();
  return parseWomPlayer(data);
}

export function parseWomPlayer(data: any): LiveLevels {
  const skills = data?.latestSnapshot?.data?.skills ?? {};
  const levels: LiveLevels['levels'] = {};
  for (const [metric, v] of Object.entries(skills as Record<string, any>)) {
    const key = skillKey(metric);
    if (key === 'overall') continue;
    if (v && typeof v === 'object') levels[key] = { level: Number(v.level ?? 1), xp: Number(v.experience ?? 0) };
  }
  const fetchedAt = Date.parse(data?.latestSnapshot?.createdAt ?? data?.updatedAt ?? '') || Date.now();
  return { fetchedAt, levels, combatLevel: data?.combatLevel, accountType: data?.type };
}

/** Ask WOM to re-scrape the hiscores. Spec: at most once per session; the store enforces that. */
export async function requestWomUpdate(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const res = await fetchImpl(WOM_PLAYER_URL, { method: 'POST', headers: { 'User-Agent': USER_AGENT } });
  return res.ok;
}
