import type { GuideStep, ParseResult, StepType, DiaryTier } from './types';
import { levelForXp, xpForLevel, skillKey } from './xp';
import { slugify } from './names';

export const DIARY_TIERS: DiaryTier[] = ['Easy', 'Medium', 'Hard', 'Elite'];

/** Pages in Category:Miniquests (and the guide's unofficial ones). Used only to classify steps. */
export const MINIQUESTS = new Set([
  "Alfred Grimhand's Barcrawl", 'Ancient key (Tombs of Amascut)', 'Architectural Alliance', 'Barbarian Training',
  'Bear Your Soul', 'Curse of the Empty Lord', 'The Enchanted Key', 'Enter the Abyss', 'Family Pest',
  'The Frozen Door', "The General's Shadow", 'His Faithful Servants', "Hopespear's Will", 'In Search of Knowledge',
  'Into the Tombs', 'Knight Waves Training Ground', 'Knight Waves Training Grounds', 'Lair of Tarn Razorlor',
  'Lost Lover', 'Mage Arena I', 'Mage Arena II', 'Natural history quiz', 'Rogue Trader', 'Sacred Bone Burner',
  'Skippy and the Mogres', 'Spirit of Adventure', 'The Fractured Archive', 'Vale Totems', 'Daddy\'s Home',
]);

// ---------- wikitext cleaning ----------

const SKILL_WORDS = /^(attack|defence|strength|hitpoints|ranged|prayer|magic|cooking|woodcutting|fletching|fishing|firemaking|crafting|smithing|mining|herblore|agility|thieving|slayer|farming|runecraft|hunter|construction|sailing|combat|quest)$/i;

/** Replace the innermost {{template|...}} occurrences until none remain. */
function stripTemplates(text: string): string {
  let out = text;
  let guard = 0;
  const re = /\{\{([^{}]*)\}\}/g;
  while (re.test(out) && guard++ < 50) {
    out = out.replace(re, (_m, body: string) => renderTemplate(body));
  }
  return out;
}

function renderTemplate(body: string): string {
  const parts = body.split('|');
  const name = parts[0].trim().toLowerCase();
  const positional = parts.slice(1).filter((p) => !p.includes('='));
  const named: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const i = p.indexOf('=');
    if (i > 0) named[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
  }
  switch (name) {
    case 'scp': {
      const skill = positional[0] ?? '';
      const lvl = positional[1];
      return lvl ? `${lvl} ${skill}` : skill;
    }
    case 'coins':
      return `${positional[0] ?? ''} coins`;
    case 'plink':
    case 'plinkp':
    case 'plinkt':
      return positional[0] ?? '';
    case 'floornumber': {
      const uk = named['uk'];
      if (uk === '0') return 'ground floor';
      if (uk === '1') return '1st floor';
      if (uk === '2') return '2nd floor';
      if (uk === '3') return '3rd floor';
      return uk ? `floor ${uk}` : 'upper floor';
    }
    case 'fairycode':
      return `fairy ring ${(positional[0] ?? '').toUpperCase()}`;
    case 'checklist':
      return positional.join('|');
    case 'boostable':
      return '';
    case 'okay':
    case 'sync':
    case 'clear':
      return '';
    default:
      // Keep the first positional argument of unknown templates if it reads like prose, else drop it.
      if (positional.length && /^[\w' ,.-]+$/.test(positional[0]) && !SKILL_WORDS.test(positional[0])) return positional[0];
      return '';
  }
}

export function cleanWikitext(text: string): string {
  let t = text.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/\[\[File:[^\]]*\]\]/gi, '');
  t = t.replace(/\[\[Category:[^\]]*\]\]/gi, '');
  t = stripTemplates(t);
  // Unclosed templates (wiki typos): keep the skill name, drop the rest of the fragment.
  t = t.replace(/\{\{SCP\|([A-Za-z]+)[^}]*/g, '$1').replace(/\{\{[^}]*$/g, '');
  // [[target|label]] → label, [[target]] → target
  t = t.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, (_m, _target, label: string) => label);
  t = t.replace(/\[\[([^\]]*)\]\]/g, (_m, target: string) => target.replace(/#.*$/, ''));
  // external links [url label]
  t = t.replace(/\[(?:https?:)?\/\/[^\s\]]+\s+([^\]]*)\]/g, '$1');
  t = t.replace(/'''''|'''|''/g, '');
  t = t.replace(/<br\s*\/?>/gi, ' ');
  t = t.replace(/<\/?(u|b|i|abbr|span|div|small|sup|sub|poem)[^>]*>/gi, '');
  t = t.replace(/&nbsp;/g, ' ');
  t = t.replace(/[ \t]+/g, ' ');
  return t.trim();
}

/** First [[link]] target in a chunk of wikitext (ignoring File:/Category: links). */
export function firstLink(text: string): { target: string; label: string } | undefined {
  const re = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const target = m[1].trim();
    if (/^(file|category|image):/i.test(target)) continue;
    return { target, label: (m[2] ?? target).trim() };
  }
  return undefined;
}

// ---------- table parsing ----------

interface RawRow {
  index: number;
  header: string; // the "|- ..." line
  cells: string[];
  isHeaderRow: boolean;
  trainLines: { skill: string; level: number; extra: string }[];
  raw: string;
}

export function extractQuestingOrderTable(wikitext: string): string {
  const secIdx = wikitext.search(/^==\s*Questing Order\s*==\s*$/m);
  const from = secIdx >= 0 ? secIdx : 0;
  const start = wikitext.indexOf('{|', from);
  if (start < 0) throw new Error('Questing Order table not found');
  const end = wikitext.indexOf('\n|}', start);
  return wikitext.slice(start, end < 0 ? undefined : end);
}

const TRAIN_RE = /\{\{Optimal quest\/train\|([a-z]+)\|(\d+)\}\}(.*)/i;

function splitRows(table: string): RawRow[] {
  const lines = table.split('\n');
  const rows: RawRow[] = [];
  let current: string[] | null = null;
  let header = '';
  const flush = () => {
    if (!current) return;
    const raw = current.join('\n');
    const trainLines: RawRow['trainLines'] = [];
    const body: string[] = [];
    for (const line of current) {
      const m = TRAIN_RE.exec(line);
      if (m) trainLines.push({ skill: skillKey(m[1]), level: Number(m[2]), extra: cleanWikitext(m[3] ?? '') });
      else body.push(line);
    }
    const cells = splitCells(body);
    const isHeaderRow = body.some((l) => l.startsWith('!')) && !body.some((l) => /^\|[^-}+]/.test(l));
    rows.push({ index: rows.length, header, cells, isHeaderRow, trainLines, raw });
  };
  for (const line of lines) {
    if (line.startsWith('|-')) {
      flush();
      current = [];
      header = line;
      continue;
    }
    if (line.startsWith('{|') || line.startsWith('|+') || line.startsWith('|}')) continue;
    if (current === null) current = [];
    current.push(line);
  }
  flush();
  return rows;
}

/** Split a row's lines into cell strings. A line starting with | or ! opens a cell; other lines continue the previous one. */
function splitCells(lines: string[]): string[] {
  const cells: string[] = [];
  for (const line of lines) {
    if (line.startsWith('|') || line.startsWith('!')) {
      const rest = line.slice(1);
      const pieces = rest.split(line.startsWith('!') ? '!!' : '||');
      for (const piece of pieces) cells.push(stripCellAttributes(piece));
    } else if (cells.length) {
      cells[cells.length - 1] += '\n' + line;
    } else if (line.trim()) {
      cells.push(line);
    }
  }
  return cells;
}

/** `data-sort-value="x" |content` → content. A lone leading | (from "||") also counts as empty attributes. */
function stripCellAttributes(cell: string): string {
  const m = /^\s*([^|\[{]*?)\|(.*)$/s.exec(cell);
  if (m && (m[1].trim() === '' || /=/.test(m[1]))) return m[2];
  return cell;
}

// ---------- step building ----------

function parseXpTemplate(cell: string): Record<string, number> {
  const out: Record<string, number> = {};
  const m = /\{\{Optimal quest\|([^}]*)\}\}/i.exec(cell);
  if (!m) return out;
  for (const part of m[1].split('|')) {
    const [k, v] = part.split('=');
    if (k && v && /^\d+$/.test(v.trim())) out[skillKey(k)] = Number(v.trim());
  }
  return out;
}

function parseQp(cell: string): number {
  const m = /\{\{Optimal quest\/qp\|(\d+)/i.exec(cell);
  return m ? Number(m[1]) : 0;
}

function parseNotes(cell: string): string[] {
  const notes: string[] = [];
  const text = cell
    .replace(/\{\{Checklist\|/gi, '')
    .replace(/^\}\}\s*$/gm, '');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line === '}}') continue;
    const m = /^(\*+)\s*(.*)$/.exec(line);
    const depth = m ? m[1].length - 1 : 0;
    const body = cleanWikitext((m ? m[2] : line).replace(/\}\}\s*$/, ''));
    if (!body) continue;
    notes.push(depth > 0 ? `${'  '.repeat(depth)}- ${body}` : body);
  }
  return notes;
}

interface Classified {
  name: string;
  type: StepType;
  partial: boolean;
  quest?: string;
  diary?: { area: string; tier: DiaryTier };
}

function classify(nameCell: string, rowId: string, qgCell: string, questNames: Set<string>): Classified {
  const firstLine = nameCell.split('\n')[0].trim();
  const link = firstLink(nameCell);
  const cleaned = cleanWikitext(firstLine);
  const diaryMatch = /^(Easy|Medium|Hard|Elite)\s+\[\[([^\]|]+?)\s+Diary(?:\|[^\]]*)?\]\]/i.exec(firstLine);
  if (diaryMatch) {
    const tier = (diaryMatch[1][0].toUpperCase() + diaryMatch[1].slice(1).toLowerCase()) as DiaryTier;
    return { name: `${tier} ${diaryMatch[2]} Diary`, type: 'diary', partial: false, diary: { area: diaryMatch[2].trim(), tier } };
  }
  const allMatch = /^All\s+(Easy|Medium|Hard|Elite)\s+\[\[Achievement Diar/i.exec(firstLine);
  if (allMatch) {
    const tier = (allMatch[1][0].toUpperCase() + allMatch[1].slice(1).toLowerCase()) as DiaryTier;
    return { name: `All ${tier} Achievement Diaries`, type: 'diary', partial: false, diary: { area: 'All', tier } };
  }
  if (/^Partially complete:/i.test(firstLine) || /^Partial completion of/i.test(rowId)) {
    const quest = link?.target ?? rowId.replace(/^Partial completion of\s*/i, '');
    const type: StepType = MINIQUESTS.has(quest) ? 'miniquest' : 'quest';
    return { name: `Partial: ${quest}`, type, partial: true, quest };
  }
  if (/^Unlock:/i.test(firstLine)) {
    return { name: cleaned, type: 'unlock', partial: false, quest: link?.target };
  }
  if (/\(miniquest\)/i.test(firstLine) || (link && MINIQUESTS.has(link.target))) {
    const quest = link?.target ?? cleaned.replace(/\s*\(miniquest\)/i, '');
    return { name: quest, type: 'miniquest', partial: false, quest };
  }
  if (link && (questNames.has(link.target) || /\/Quick guide\|QG\]\]/.test(qgCell) || /Recipe for Disaster\//.test(link.target))) {
    const quest = link.target;
    const name = quest.startsWith('Recipe for Disaster/') ? quest.replace('Recipe for Disaster/', 'RFD: ') : quest;
    return { name, type: 'quest', partial: false, quest };
  }
  if (/diary/i.test(cleaned)) return { name: cleaned, type: 'diary', partial: false };
  if (/\b(train|gather|collect|mine|fish|chop|cut)\b/i.test(cleaned)) return { name: cleaned, type: 'skilling', partial: false };
  return { name: cleaned || rowId, type: 'unlock', partial: false, quest: link?.target };
}

export interface ParseOptions {
  /** Known quest page titles; anything linked from the first column that is in here is a quest. */
  questNames?: Iterable<string>;
}

/**
 * Parse the Optimal quest guide (ironman) wikitext into ordered steps.
 * Training rows the guide inserts between quests become `skilling` steps with a `train` target.
 */
export function parseGuide(wikitext: string, opts: ParseOptions = {}): ParseResult {
  const questNames = new Set(opts.questNames ?? []);
  const table = extractQuestingOrderTable(wikitext);
  const rows = splitRows(table);
  const steps: GuideStep[] = [];
  const unparsed: ParseResult['unparsed'] = [];
  const xpTotals: Record<string, number> = {};
  const ids = new Set<string>();
  let totalQp = 0;
  let totalRows = 0;

  const makeId = (base: string) => {
    let id = slugify(base) || `step-${steps.length}`;
    if (ids.has(id)) {
      let n = 2;
      while (ids.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    ids.add(id);
    return id;
  };

  const pushTrain = (skill: string, level: number, extra: string) => {
    const before = xpTotals[skill] ?? 0;
    const target = xpForLevel(level);
    if (target > before) xpTotals[skill] = target;
    const label = skill.charAt(0).toUpperCase() + skill.slice(1);
    const name = `Train ${label} to ${level}`;
    steps.push({
      id: makeId(`train-${skill}-${level}`),
      order: steps.length,
      name,
      type: 'skilling',
      partial: false,
      train: { skill, level },
      location: '',
      xpGained: { [skill]: Math.max(0, target - before) },
      levelsAfter: { [skill]: level },
      qp: 0,
      totalQp,
      notes: extra ? [extra] : [],
    });
  };

  for (const row of rows) {
    const isDataRow = /data-rowid=/.test(row.header) || row.cells.length >= 5;
    if (row.isHeaderRow) {
      // Column headers, the "Quest point cape!" banner, or a free-text training row like "Train Combat to 85".
      const text = cleanWikitext(row.cells.join(' ')).replace(/\b(\w+) \1\b/g, '$1');
      if (/^train\b/i.test(text)) {
        totalRows++;
        steps.push({
          id: makeId(text),
          order: steps.length,
          name: text,
          type: 'skilling',
          partial: false,
          location: '',
          xpGained: {},
          levelsAfter: {},
          qp: 0,
          totalQp,
          notes: [],
        });
      }
      for (const t of row.trainLines) pushTrain(t.skill, t.level, t.extra);
      continue;
    }
    if (!isDataRow) {
      // Header chunk before the first row, or stray lines. Still honour train lines.
      for (const t of row.trainLines) pushTrain(t.skill, t.level, t.extra);
      continue;
    }
    totalRows++;
    try {
      const rowIdMatch = /data-rowid="([^"]*)"/.exec(row.header);
      const rowId = rowIdMatch?.[1] ?? '';
      const [nameCell = '', qgCell = '', levelsCell = '', qpCell = '', notesCell = '', locationCell = ''] = row.cells;
      if (!nameCell.trim() && !rowId) throw new Error('empty name cell');
      const c = classify(nameCell, rowId, qgCell, questNames);
      const xpGained = parseXpTemplate(levelsCell);
      const levelsAfter: Record<string, number> = {};
      for (const [skill, xp] of Object.entries(xpGained)) {
        xpTotals[skill] = (xpTotals[skill] ?? 0) + xp;
        levelsAfter[skill] = levelForXp(xpTotals[skill]);
      }
      const qp = parseQp(qpCell);
      totalQp += qp;
      const notes = parseNotes(notesCell);
      // A multi-line first column (e.g. "Unlock: X\nPartially complete: Y") carries extra context.
      const extraNameLines = nameCell.split('\n').slice(1).map(cleanWikitext).filter(Boolean);
      steps.push({
        id: makeId(rowId || c.name),
        order: steps.length,
        name: c.name,
        type: c.type,
        partial: c.partial,
        quest: c.quest,
        diary: c.diary,
        location: cleanWikitext(locationCell.split('\n')[0] ?? ''),
        xpGained,
        levelsAfter,
        qp,
        totalQp,
        notes: [...extraNameLines, ...notes],
        rowId: rowId || undefined,
      });
    } catch (e) {
      unparsed.push({ index: row.index, reason: (e as Error).message, raw: row.raw.slice(0, 300) });
    }
    for (const t of row.trainLines) pushTrain(t.skill, t.level, t.extra);
  }
  return { steps, unparsed, totalRows };
}
