import type { QuestReqs, SkillReq } from './types';
import { skillKey } from './xp';

/** Extract the `requirements` parameter of {{Quest details}} from a quest page's wikitext. */
export function extractRequirementsParam(wikitext: string): string {
  const start = wikitext.search(/\{\{Quest details/i);
  if (start < 0) return '';
  // Walk to the matching }} so nested templates inside parameters do not cut us short.
  let depth = 0;
  let i = start;
  for (; i < wikitext.length - 1; i++) {
    if (wikitext.startsWith('{{', i)) { depth++; i++; continue; }
    if (wikitext.startsWith('}}', i)) { depth--; i++; if (depth === 0) break; }
  }
  const block = wikitext.slice(start, i + 1);
  const m = /\|\s*requirements\s*=([\s\S]*?)(?=\n\|\s*[a-zA-Z]+\s*=|\n\}\}$)/.exec(block);
  return m ? m[1] : '';
}

/** Parse skill and quest requirements from the requirements wikitext. */
export function parseQuestRequirements(wikitext: string, knownQuests?: Set<string>): QuestReqs {
  const req = extractRequirementsParam(wikitext);
  const skills: SkillReq[] = [];
  const quests: string[] = [];
  let questPoints: number | undefined;
  const seen = new Set<string>();
  for (const rawLine of req.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const scp = /\{\{SCP\|([A-Za-z ]+)\|(\d+)[^}]*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = scp.exec(line))) {
      const skill = skillKey(m[1]);
      const level = Number(m[2]);
      if (skill === 'quest' || skill === 'questpoints') { questPoints = Math.max(questPoints ?? 0, level); continue; }
      if (skill === 'combat') continue;
      const boostable = /\{\{Boostable\|yes/i.test(line);
      const key = `${skill}:${level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push({ skill, level, boostable });
    }
    const qp = /(\d+)\s*\[\[Quest points?\]\]/i.exec(line);
    if (qp) questPoints = Math.max(questPoints ?? 0, Number(qp[1]));
    // Quest links on bullet lines: "**[[Lost City]]" (any depth). Skip skill/other article links.
    if (/^\*+\s*\[\[/.test(line) && !/\{\{SCP/.test(line)) {
      const link = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/.exec(line);
      if (link) {
        const target = link[1].trim().replace(/_/g, ' ');
        if (/^(File|Category):/i.test(target) || /#/.test(target)) continue;
        if (/^(Quest points?|Combat level|Hitpoints|Members)$/i.test(target)) continue;
        if (knownQuests && knownQuests.size && !knownQuests.has(target)) continue;
        if (!quests.includes(target)) quests.push(target);
      }
    }
  }
  return { skills, quests, questPoints };
}
