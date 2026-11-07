import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PlayerData, LiveLevels, GuideStep, QuestReqs, StepProgress, Goal, Todo, Bottleneck, TodoTag, MilestoneProgress, GearSetup, XpMethod } from '../lib/types';
import guideJson from '../data/guide.json';
import reqsJson from '../data/questReqs.json';
import { DEFAULT_FLAG_NOTES } from '../lib/completion';
import { STORAGE_KEY, MAX_PINNED_GOALS } from '../config';

export interface AppState {
  player: PlayerData | null;
  liveLevels: LiveLevels | null;
  guide: { fetchedAt: number; steps: GuideStep[]; source: 'bundled' | 'wiki' };
  questReqs: Record<string, QuestReqs>;
  progress: Record<string, StepProgress>;
  goals: Goal[];
  todos: Todo[];
  flags: Record<Bottleneck, string>;
  milestones: Record<string, MilestoneProgress>;
  gear: GearSetup[];
  methods: XpMethod[];
  ui: { tab: 'next' | 'goals' | 'todo' | 'stats'; expanded: boolean; womUpdateRequested: boolean };

  setPlayer: (p: PlayerData) => void;
  setLiveLevels: (l: LiveLevels) => void;
  setGuide: (steps: GuideStep[], fetchedAt: number) => void;
  setQuestReqs: (quest: string, reqs: QuestReqs) => void;
  markDone: (stepId: string, done: boolean | undefined) => void;
  skipStep: (stepId: string, reason: string) => void;
  unskipStep: (stepId: string) => void;
  addGoal: (g: Omit<Goal, 'id' | 'createdAt' | 'pinned' | 'prereqsDone'>) => void;
  removeGoal: (id: string) => void;
  togglePin: (id: string) => boolean;
  toggleGoalDone: (id: string) => void;
  togglePrereq: (goalId: string, key: string) => void;
  addTodo: (text: string, tags?: TodoTag[], linkedStepId?: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  setFlagNote: (flag: Bottleneck, note: string) => void;
  setMilestoneDone: (id: string, done: boolean | undefined) => void;
  addGearSetup: (name: string) => string;
  updateGearSetup: (id: string, patch: Partial<Pick<GearSetup, 'name' | 'notes'>> & { slot?: { key: string; value: string } }) => void;
  removeGearSetup: (id: string) => void;
  addMethod: (m: Omit<XpMethod, 'id'>) => void;
  removeMethod: (id: string) => void;
  setTab: (tab: AppState['ui']['tab']) => void;
  setExpanded: (v: boolean) => void;
  setWomUpdateRequested: () => void;
  exportState: () => string;
  importState: (json: string) => void;
  resetAll: () => void;
}

const bundledGuide = { fetchedAt: (guideJson as any).fetchedAt as number, steps: (guideJson as any).steps as GuideStep[], source: 'bundled' as const };
const bundledReqs = (reqsJson as any).reqs as Record<string, QuestReqs>;

export const PERSISTED_KEYS = ['player', 'liveLevels', 'guide', 'questReqs', 'progress', 'goals', 'todos', 'flags', 'milestones', 'gear', 'methods', 'ui'] as const;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      player: null,
      liveLevels: null,
      guide: bundledGuide,
      questReqs: bundledReqs,
      progress: {},
      goals: [],
      todos: [],
      flags: { ...DEFAULT_FLAG_NOTES },
      milestones: {},
      gear: [],
      methods: [],
      ui: { tab: 'next', expanded: false, womUpdateRequested: false },

      setPlayer: (player) => set({ player }),
      setLiveLevels: (liveLevels) => set({ liveLevels }),
      setGuide: (steps, fetchedAt) => set({ guide: { steps, fetchedAt, source: 'wiki' } }),
      setQuestReqs: (quest, reqs) => set((s) => ({ questReqs: { ...s.questReqs, [quest]: reqs } })),
      markDone: (stepId, done) =>
        set((s) => {
          const progress = { ...s.progress };
          if (done === undefined) {
            const { done: _d, ...rest } = progress[stepId] ?? { at: Date.now() };
            progress[stepId] = { ...rest, at: Date.now() };
          } else {
            progress[stepId] = { ...progress[stepId], done, skipped: false, at: Date.now() };
          }
          return { progress };
        }),
      skipStep: (stepId, reason) => set((s) => ({ progress: { ...s.progress, [stepId]: { ...s.progress[stepId], skipped: true, reason, at: Date.now() } } })),
      unskipStep: (stepId) => set((s) => ({ progress: { ...s.progress, [stepId]: { ...s.progress[stepId], skipped: false, reason: undefined, at: Date.now() } } })),
      addGoal: (g) => set((s) => ({ goals: [...s.goals, { ...g, id: uid(), createdAt: Date.now(), pinned: false, prereqsDone: [] }] })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      togglePin: (id) => {
        const s = get();
        const goal = s.goals.find((g) => g.id === id);
        if (!goal) return false;
        if (!goal.pinned && s.goals.filter((g) => g.pinned).length >= MAX_PINNED_GOALS) return false;
        set({ goals: s.goals.map((g) => (g.id === id ? { ...g, pinned: !g.pinned } : g)) });
        return true;
      },
      toggleGoalDone: (id) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, done: !g.done, pinned: g.done ? g.pinned : false } : g)) })),
      togglePrereq: (goalId, key) =>
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== goalId) return g;
            const has = g.prereqsDone.includes(key);
            return { ...g, prereqsDone: has ? g.prereqsDone.filter((k) => k !== key) : [...g.prereqsDone, key] };
          }),
        })),
      addTodo: (text, tags = [], linkedStepId) =>
        set((s) => ({ todos: [{ id: uid(), text: text.trim(), tags, done: false, linkedStepId, createdAt: Date.now() }, ...s.todos] })),
      toggleTodo: (id) =>
        set((s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() } : t)) })),
      removeTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
      setFlagNote: (flag, note) => set((s) => ({ flags: { ...s.flags, [flag]: note } })),
      setMilestoneDone: (id, done) =>
        set((s) => {
          const milestones = { ...s.milestones };
          if (done === undefined) delete milestones[id];
          else milestones[id] = { done, at: Date.now() };
          return { milestones };
        }),
      addGearSetup: (name) => {
        const id = uid();
        set((s) => ({ gear: [...s.gear, { id, name: name.trim() || 'Setup', slots: {}, notes: '', createdAt: Date.now() }] }));
        return id;
      },
      updateGearSetup: (id, patch) =>
        set((s) => ({
          gear: s.gear.map((g) => {
            if (g.id !== id) return g;
            const next = { ...g };
            if (patch.name !== undefined) next.name = patch.name;
            if (patch.notes !== undefined) next.notes = patch.notes;
            if (patch.slot) next.slots = { ...g.slots, [patch.slot.key]: patch.slot.value };
            return next;
          }),
        })),
      removeGearSetup: (id) => set((s) => ({ gear: s.gear.filter((g) => g.id !== id) })),
      addMethod: (m) => set((s) => ({ methods: [...s.methods.filter((x) => !(x.skill === m.skill && x.name === m.name)), { ...m, id: uid() }] })),
      removeMethod: (id) => set((s) => ({ methods: s.methods.filter((m) => m.id !== id) })),
      setTab: (tab) => set((s) => ({ ui: { ...s.ui, tab } })),
      setExpanded: (expanded) => set((s) => ({ ui: { ...s.ui, expanded } })),
      setWomUpdateRequested: () => set((s) => ({ ui: { ...s.ui, womUpdateRequested: true } })),
      exportState: () => {
        const s = get();
        const data: Record<string, unknown> = { version: 1, exportedAt: Date.now() };
        for (const k of PERSISTED_KEYS) data[k] = s[k];
        return JSON.stringify(data, null, 2);
      },
      importState: (json) => {
        const data = JSON.parse(json);
        if (!data || typeof data !== 'object' || data.version !== 1) throw new Error('Not an Iron Funyon Planner backup');
        const patch: Partial<AppState> = {};
        for (const k of PERSISTED_KEYS) if (k in data) (patch as any)[k] = data[k];
        set(patch);
      },
      resetAll: () => set({ player: null, liveLevels: null, guide: bundledGuide, questReqs: bundledReqs, progress: {}, goals: [], todos: [], flags: { ...DEFAULT_FLAG_NOTES }, milestones: {}, gear: [], methods: [], ui: { tab: 'next', expanded: false, womUpdateRequested: false } }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeLocalStorage()),
      partialize: (s) => Object.fromEntries(PERSISTED_KEYS.map((k) => [k, s[k]])) as any,
      merge: (persisted: any, current) => {
        const merged = { ...current, ...(persisted ?? {}) } as AppState;
        // Always carry the newest bundled guide/reqs when the saved copy is older or missing.
        if (!persisted?.guide?.steps?.length || (persisted.guide.source === 'bundled' && persisted.guide.fetchedAt < bundledGuide.fetchedAt)) merged.guide = bundledGuide;
        merged.questReqs = { ...bundledReqs, ...(persisted?.questReqs ?? {}) };
        merged.flags = { ...DEFAULT_FLAG_NOTES, ...(persisted?.flags ?? {}) };
        merged.milestones = persisted?.milestones ?? {};
        merged.gear = persisted?.gear ?? [];
        merged.methods = persisted?.methods ?? [];
        merged.ui = { tab: 'next', expanded: false, ...(persisted?.ui ?? {}), womUpdateRequested: false };
        return merged;
      },
    },
  ),
);

function safeLocalStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem('__probe');
      return localStorage;
    }
  } catch { /* fall through */ }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i) => Array.from(mem.keys())[i] ?? null,
    get length() { return mem.size; },
  };
}
