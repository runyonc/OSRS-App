import attack from '../assets/icons/attack.png';
import strength from '../assets/icons/strength.png';
import defence from '../assets/icons/defence.png';
import ranged from '../assets/icons/ranged.png';
import prayer from '../assets/icons/prayer.png';
import magic from '../assets/icons/magic.png';
import runecraft from '../assets/icons/runecraft.png';
import construction from '../assets/icons/construction.png';
import hitpoints from '../assets/icons/hitpoints.png';
import agility from '../assets/icons/agility.png';
import herblore from '../assets/icons/herblore.png';
import thieving from '../assets/icons/thieving.png';
import crafting from '../assets/icons/crafting.png';
import fletching from '../assets/icons/fletching.png';
import slayer from '../assets/icons/slayer.png';
import hunter from '../assets/icons/hunter.png';
import mining from '../assets/icons/mining.png';
import smithing from '../assets/icons/smithing.png';
import fishing from '../assets/icons/fishing.png';
import cooking from '../assets/icons/cooking.png';
import firemaking from '../assets/icons/firemaking.png';
import woodcutting from '../assets/icons/woodcutting.png';
import farming from '../assets/icons/farming.png';
import sailing from '../assets/icons/sailing.png';
import quest from '../assets/icons/quest.png';
import combat from '../assets/icons/combat.png';
import diary from '../assets/icons/diary.png';
import stats from '../assets/icons/stats.png';
import skills from '../assets/icons/skills.png';
import coins from '../assets/icons/coins.png';
import { skillLabel } from '../lib/xp';

/** Icons from the OSRS Wiki (CC BY-NC-SA 3.0), inlined at build time. */
export const ICONS: Record<string, string> = {
  attack, strength, defence, ranged, prayer, magic, runecraft, construction, hitpoints, agility, herblore, thieving,
  crafting, fletching, slayer, hunter, mining, smithing, fishing, cooking, firemaking, woodcutting, farming, sailing,
  quest, combat, diary, stats, skills, coins,
};

export default function SkillIcon({ skill, size = 16, className = '' }: { skill: string; size?: number; className?: string }) {
  const src = ICONS[skill];
  if (!src) return null;
  return <img src={src} alt="" title={skillLabel(skill)} width={size} height={size} className={`inline-block shrink-0 align-[-3px] ${className}`} style={{ imageRendering: 'pixelated' }} />;
}
