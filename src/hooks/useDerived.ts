import { useMemo } from 'react';
import { useStore } from '../store';
import { effectiveLevels, selectNextUp, questPoints, totalLevel } from '../lib/completion';
import { NEXT_UP_DEFAULT, NEXT_UP_EXPANDED, IMPORT_STALE_MS } from '../config';

export function useLevels() {
  const player = useStore((s) => s.player);
  const live = useStore((s) => s.liveLevels);
  return useMemo(() => effectiveLevels(player, live), [player, live]);
}

export function useNextUp(limitOverride?: number) {
  const steps = useStore((s) => s.guide.steps);
  const player = useStore((s) => s.player);
  const progress = useStore((s) => s.progress);
  const reqs = useStore((s) => s.questReqs);
  const goals = useStore((s) => s.goals);
  const expanded = useStore((s) => s.ui.expanded);
  const { levels } = useLevels();
  const limit = limitOverride ?? (expanded ? NEXT_UP_EXPANDED : NEXT_UP_DEFAULT);
  return useMemo(() => selectNextUp({ steps, player, progress, reqs, levels, goals, limit }), [steps, player, progress, reqs, levels, goals, limit]);
}

export function useHeaderStats() {
  const steps = useStore((s) => s.guide.steps);
  const player = useStore((s) => s.player);
  const progress = useStore((s) => s.progress);
  const live = useStore((s) => s.liveLevels);
  const guide = useStore((s) => s.guide);
  const { levels, source, at } = useLevels();
  return useMemo(() => {
    const qp = questPoints(steps, player, progress);
    const total = totalLevel(levels);
    const importAge = player ? Date.now() - player.importedAt : Infinity;
    return {
      qp,
      totalLevel: total,
      levelSource: source,
      levelsAt: at,
      importedAt: player?.importedAt,
      importStale: !player || importAge > IMPORT_STALE_MS,
      womAt: live?.fetchedAt,
      guideAt: guide.fetchedAt,
      guideSource: guide.source,
      combatLevel: live?.combatLevel,
    };
  }, [steps, player, progress, live, guide, levels, source, at]);
}

export function formatAge(ts?: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
