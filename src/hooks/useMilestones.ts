import { useMemo } from 'react';
import { useStore } from '../store';
import { useLevels } from './useDerived';
import { allMilestoneStatuses, readyMilestones, type MilestoneContext } from '../lib/milestones';

export function useMilestoneContext(): MilestoneContext {
  const player = useStore((s) => s.player);
  const manual = useStore((s) => s.milestones);
  const { levels } = useLevels();
  return useMemo(() => ({ player, levels, manual }), [player, levels, manual]);
}

export function useMilestoneStatuses() {
  const ctx = useMilestoneContext();
  return useMemo(() => allMilestoneStatuses(ctx), [ctx]);
}

export function useReadyMilestones(limit = 3) {
  const ctx = useMilestoneContext();
  return useMemo(() => readyMilestones(ctx, limit), [ctx, limit]);
}
