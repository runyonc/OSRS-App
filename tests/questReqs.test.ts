import { describe, it, expect } from 'vitest';
import { parseQuestRequirements } from '../src/lib/questReqs';

const fairytale = `{{Quest details
|start = Talk to [[Martin the Master Gardener]].
|difficulty = Experienced
|requirements = *Completion of the following quests:
**[[Fairytale I - Growing Pains]]
***[[Lost City]]
***[[Nature Spirit]]
****[[The Restless Ghost]]
'''Note:''' some text about {{SCP|Thieving}} without a level.
*{{SCP|Thieving|40|link=yes}} {{Boostable|no}} {{Questreqstart|no}}
*{{SCP|Farming|49|link=yes}} {{Boostable|yes}}
*{{SCP|Herblore|57|link=yes}} {{Boostable|yes}}
|items = *[[Dramen staff]]
}}
==Walkthrough==`;

const dragonSlayer = `{{Quest details
|requirements = * {{SCP|Quest|32}} [[Quest points]] to enter the Champions' Guild  {{Questreqstart|yes}}
* The ability to defeat a level 83 [[Elvarg|dragon]]
|items = * [[Hammer]]
}}`;

describe('quest requirements parser', () => {
  it('reads skill levels, boostability and prerequisite quests', () => {
    const r = parseQuestRequirements(fairytale);
    expect(r.skills).toEqual([
      { skill: 'thieving', level: 40, boostable: false },
      { skill: 'farming', level: 49, boostable: true },
      { skill: 'herblore', level: 57, boostable: true },
    ]);
    expect(r.quests).toEqual(['Fairytale I - Growing Pains', 'Lost City', 'Nature Spirit', 'The Restless Ghost']);
  });

  it('filters prerequisite links to known quests when a list is given', () => {
    const r = parseQuestRequirements(fairytale, new Set(['Lost City', 'Nature Spirit']));
    expect(r.quests).toEqual(['Lost City', 'Nature Spirit']);
  });

  it('reads quest point requirements', () => {
    const r = parseQuestRequirements(dragonSlayer);
    expect(r.questPoints).toBe(32);
    expect(r.skills).toEqual([]);
  });

  it('returns empty requirements when there is no template', () => {
    expect(parseQuestRequirements('Just some page')).toEqual({ skills: [], quests: [], questPoints: undefined });
  });
});
