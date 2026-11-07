import type { PlayerData, DiaryTier, DiaryTierData } from './types';
import { levelForXp, skillKey } from './xp';
import { PLAYER } from '../config';

/**
 * Parse a WikiSync JSON export (the file you download from the wiki, never fetched from sync.runescape.wiki).
 * Tolerant of small shape differences: levels may be levels or XP, diary tasks may be arrays or objects.
 */
export function parseWikiSyncExport(input: string | unknown, importedAt = Date.now()): PlayerData {
  const raw: any = typeof input === 'string' ? JSON.parse(input) : input;
  if (!raw || typeof raw !== 'object') throw new Error('Export is not a JSON object');
  const quests = raw.quests ?? raw.Quests;
  if (!quests || typeof quests !== 'object') throw new Error('Export has no "quests" map');

  const questMap: Record<string, number> = {};
  for (const [name, status] of Object.entries(quests as Record<string, unknown>)) {
    const n = typeof status === 'number' ? status : typeof status === 'boolean' ? (status ? 2 : 0) : Number(status);
    questMap[name] = Number.isFinite(n) ? n : 0;
  }

  const diaries: PlayerData['diaries'] = {};
  const rawDiaries = raw.achievement_diaries ?? raw.diaries ?? {};
  for (const [area, tiers] of Object.entries(rawDiaries as Record<string, any>)) {
    diaries[area] = {};
    for (const [tier, data] of Object.entries((tiers ?? {}) as Record<string, any>)) {
      const t = (tier[0].toUpperCase() + tier.slice(1).toLowerCase()) as DiaryTier;
      diaries[area][t] = normalizeTier(data);
    }
  }

  const levels: PlayerData['levels'] = {};
  for (const [skill, value] of Object.entries((raw.levels ?? {}) as Record<string, any>)) {
    const key = skillKey(skill);
    if (key === 'overall') continue;
    if (typeof value === 'number') {
      // WikiSync stores levels; be safe if someone feeds XP instead.
      if (value > 126) levels[key] = { level: levelForXp(value), xp: value };
      else levels[key] = { level: value };
    } else if (value && typeof value === 'object') {
      const lvl = Number(value.level ?? (value.xp != null ? levelForXp(Number(value.xp)) : NaN));
      if (Number.isFinite(lvl)) levels[key] = { level: lvl, xp: value.xp != null ? Number(value.xp) : undefined };
    }
  }

  const ca = raw.combat_achievements ?? raw.combatAchievements ?? [];
  const combatAchievements = Array.isArray(ca) ? ca.map(Number).filter(Number.isFinite) : [];

  let exportedAt: number | undefined;
  if (raw.timestamp) {
    const t = typeof raw.timestamp === 'number' ? raw.timestamp * (raw.timestamp < 1e12 ? 1000 : 1) : Date.parse(raw.timestamp);
    if (Number.isFinite(t)) exportedAt = t;
  }

  return {
    username: typeof raw.username === 'string' && raw.username ? raw.username : PLAYER,
    importedAt,
    exportedAt,
    quests: questMap,
    diaries,
    levels,
    combatAchievements,
  };
}

function normalizeTier(data: any): DiaryTierData {
  if (Array.isArray(data)) return { complete: data.every(Boolean), tasks: data.map(Boolean) };
  if (data && typeof data === 'object') {
    const tasksRaw = data.tasks ?? data.Tasks ?? [];
    const tasks = Array.isArray(tasksRaw) ? tasksRaw.map(Boolean) : Object.values(tasksRaw as Record<string, unknown>).map(Boolean);
    const complete = typeof data.complete === 'boolean' ? data.complete : tasks.length > 0 && tasks.every(Boolean);
    return { complete, tasks };
  }
  return { complete: Boolean(data), tasks: [] };
}

export function diaryTierSummary(tier: DiaryTierData | undefined): { done: number; total: number; complete: boolean } {
  if (!tier) return { done: 0, total: 0, complete: false };
  return { done: tier.tasks.filter(Boolean).length, total: tier.tasks.length, complete: tier.complete };
}
