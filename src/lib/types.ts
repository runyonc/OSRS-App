export type StepType = 'quest' | 'miniquest' | 'unlock' | 'skilling' | 'diary' | 'gather';

export type SkillName =
  | 'attack' | 'defence' | 'strength' | 'hitpoints' | 'ranged' | 'prayer' | 'magic'
  | 'cooking' | 'woodcutting' | 'fletching' | 'fishing' | 'firemaking' | 'crafting'
  | 'smithing' | 'mining' | 'herblore' | 'agility' | 'thieving' | 'slayer' | 'farming'
  | 'runecraft' | 'hunter' | 'construction' | 'sailing';

export interface GuideStep {
  id: string;
  order: number;
  name: string;
  type: StepType;
  partial: boolean;
  /** Wiki page / quest name this step completes or progresses (quest, miniquest, partial). */
  quest?: string;
  /** For diary steps: area ("Ardougne") and tier ("Easy"). area "All" = every area. */
  diary?: { area: string; tier: DiaryTier };
  /** For training steps: which skill and the level to reach. */
  train?: { skill: string; level: number };
  location: string;
  /** XP the guide expects this step to grant, per skill. */
  xpGained: Partial<Record<string, number>>;
  /** Level in each touched skill after this step (per the guide's running totals). */
  levelsAfter: Partial<Record<string, number>>;
  qp: number;
  totalQp: number;
  notes: string[];
  /** Raw wiki row id, for debugging. */
  rowId?: string;
}

export type DiaryTier = 'Easy' | 'Medium' | 'Hard' | 'Elite';

export interface ParseResult {
  steps: GuideStep[];
  unparsed: { index: number; reason: string; raw: string }[];
  totalRows: number;
}

export interface SkillReq {
  skill: string;
  level: number;
  boostable: boolean;
}

export interface QuestReqs {
  skills: SkillReq[];
  quests: string[];
  questPoints?: number;
  fetchedAt?: number;
}

export interface DiaryTierData {
  complete: boolean;
  tasks: boolean[];
}

export interface PlayerData {
  username: string;
  importedAt: number;
  /** Timestamp the export itself carried, if any. */
  exportedAt?: number;
  quests: Record<string, number>;
  diaries: Record<string, Partial<Record<DiaryTier, DiaryTierData>>>;
  levels: Record<string, { level: number; xp?: number }>;
  combatAchievements: number[];
}

export interface LiveLevels {
  fetchedAt: number;
  levels: Record<string, { level: number; xp: number }>;
  combatLevel?: number;
  accountType?: string;
}

export interface StepProgress {
  done?: boolean;
  skipped?: boolean;
  reason?: string;
  at: number;
}

export type GoalType = 'skill' | 'quest' | 'diary' | 'milestone' | 'combat' | 'text';

export interface Goal {
  id: string;
  type: GoalType;
  /** skill: "agility:70"; quest: quest name; diary: "Ardougne:Medium"; milestone: milestone id; combat: "100"; text: free text */
  target: string;
  label: string;
  pinned: boolean;
  /** Manually ticked prerequisite keys. */
  prereqsDone: string[];
  done?: boolean;
  createdAt: number;
}

export type TodoTag = 'Supplies' | 'Unlock' | 'Training' | 'Diary' | 'Boss';

export interface Todo {
  id: string;
  text: string;
  tags: TodoTag[];
  done: boolean;
  doneAt?: number;
  linkedStepId?: string;
  createdAt: number;
}

export interface GearSetup {
  id: string;
  name: string;
  slots: Record<string, string>;
  notes: string;
  createdAt: number;
}

export interface XpMethod {
  id: string;
  skill: string;
  name: string;
  xpPerAction: number;
  /** Optional actions per hour, for a time estimate. */
  perHour?: number;
}

export interface MilestoneProgress {
  done: boolean;
  at: number;
}

export type Bottleneck = 'Herblore' | 'Farming' | 'Construction' | 'Runecraft' | 'Slayer';
