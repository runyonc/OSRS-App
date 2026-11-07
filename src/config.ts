/** The one and only player this app plans for. */
export const PLAYER = 'Iron Funyon';
export const PLAYER_ENCODED = encodeURIComponent(PLAYER); // "Iron%20Funyon"

export const WOM_PLAYER_URL = `https://api.wiseoldman.net/v2/players/${PLAYER_ENCODED.toLowerCase()}`;
export const WIKI_API = 'https://oldschool.runescape.wiki/api.php';
export const GUIDE_PAGE = 'Optimal_quest_guide/Ironman';
export const GUIDE_URL = `https://oldschool.runescape.wiki/w/${GUIDE_PAGE}`;

/** Contact User-Agent requested by Wise Old Man and the wiki. Browsers may drop it; harmless when they do. */
export const USER_AGENT = 'IronFunyonPlanner/0.1 (single-user ironman planner; runrunyon93@gmail.com)';

export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * ONE_HOUR;
export const WOM_CACHE_MS = ONE_HOUR;
export const GUIDE_CACHE_MS = 7 * ONE_DAY;
export const IMPORT_STALE_MS = 7 * ONE_DAY;
export const NEXT_UP_DEFAULT = 5;
export const NEXT_UP_EXPANDED = 20;
export const MAX_PINNED_GOALS = 3;
export const STORAGE_KEY = 'ironPlanner:v1';
