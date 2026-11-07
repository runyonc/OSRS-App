import { useStore } from '../store';
import { fetchWomPlayer, requestWomUpdate } from '../lib/wom';
import { fetchGuideSteps, fetchQuestReqs } from '../lib/wiki';
import { WOM_CACHE_MS, GUIDE_CACHE_MS, IMPORT_STALE_MS } from '../config';

export interface RefreshReport {
  wom: 'fresh' | 'updated' | 'failed' | 'offline';
  guide: 'fresh' | 'updated' | 'failed' | 'offline';
  importStale: boolean;
  reqsFetched: number;
  errors: string[];
}

/** One button: re-pull WOM levels (1 h cache), re-check the guide (7 d cache), report if the import is stale. */
export async function refreshAll(opts: { force?: boolean } = {}): Promise<RefreshReport> {
  const s = useStore.getState();
  const report: RefreshReport = { wom: 'fresh', guide: 'fresh', importStale: !s.player || Date.now() - s.player.importedAt > IMPORT_STALE_MS, reqsFetched: 0, errors: [] };
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!online) return { ...report, wom: 'offline', guide: 'offline' };

  const womStale = !s.liveLevels || Date.now() - s.liveLevels.fetchedAt > WOM_CACHE_MS;
  if (womStale || opts.force) {
    try {
      if (opts.force && !s.ui.womUpdateRequested) {
        // Ask WOM to re-scrape once per session, then read whatever it has.
        await requestWomUpdate().catch(() => false);
        useStore.getState().setWomUpdateRequested();
      }
      const live = await fetchWomPlayer();
      // Keep our own fetch time so the 1 h cache is measured from now, not from WOM's snapshot time.
      useStore.getState().setLiveLevels({ ...live, fetchedAt: Math.max(live.fetchedAt, Date.now() - 1000) });
      report.wom = 'updated';
    } catch (e) {
      report.wom = 'failed';
      report.errors.push(`Wise Old Man: ${(e as Error).message}`);
    }
  }

  // The guide changes rarely; re-check it only when the 7-day cache has expired, even on a manual refresh.
  const guideStale = Date.now() - s.guide.fetchedAt > GUIDE_CACHE_MS;
  if (guideStale) {
    try {
      const { steps, unparsed, totalRows } = await fetchGuideSteps();
      if (steps.length > 100 && unparsed / Math.max(totalRows, 1) < 0.02) {
        useStore.getState().setGuide(steps, Date.now());
        report.guide = 'updated';
      } else {
        report.guide = 'failed';
        report.errors.push(`Guide parse looked wrong (${steps.length} steps, ${unparsed} unparsed rows); kept the previous copy.`);
      }
    } catch (e) {
      report.guide = 'failed';
      report.errors.push(`Wiki guide: ${(e as Error).message}`);
    }
  }

  report.reqsFetched = await fillMissingQuestReqs(10);
  return report;
}

/** Fetch requirements for quest steps we have no cached data for (a few at a time). */
export async function fillMissingQuestReqs(max = 5): Promise<number> {
  const s = useStore.getState();
  const missing = s.guide.steps.filter((st) => st.quest && (st.type === 'quest' || st.type === 'miniquest') && !s.questReqs[st.quest]).map((st) => st.quest!);
  const unique = Array.from(new Set(missing)).slice(0, max);
  let n = 0;
  for (const quest of unique) {
    try {
      const reqs = await fetchQuestReqs(quest);
      useStore.getState().setQuestReqs(quest, reqs);
      n++;
    } catch (e) {
      console.warn('[reqs] failed for', quest, e);
    }
  }
  return n;
}
