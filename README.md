# Iron Funyon Ironman Planner

A single-user, mobile-first web app that tells **Iron Funyon** what to do next. It walks the OSRS Wiki's
[Optimal quest guide/Ironman](https://oldschool.runescape.wiki/w/Optimal_quest_guide/Ironman) in order, skips what
the player has already done, and lets the player stack goals and todos on top. Ironman only: nothing in it suggests
buying from the GE or trading.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: parser, requirements, completion rules, store round-trip
npm run build      # type-check + static build in dist/
npm run build-guide   # re-fetch the guide + quest requirements from the wiki into src/data/
```

No backend. Everything is stored in the browser's `localStorage` under `ironPlanner:v1`, with JSON export/import for
backup (Import → Backup). Deploy `dist/` anywhere static; `.github/workflows/deploy.yml` publishes it to GitHub Pages
from `main` once Pages is enabled for the repo.

## Data sources

| Source | What it gives | How the app uses it |
| --- | --- | --- |
| WikiSync JSON export (paste or upload) | `quests` (0 / 1 / 2), `achievement_diaries`, `levels`, `combat_achievements` | Primary source for quests and diaries. The app **never calls `sync.runescape.wiki`** ([RS:SYNC](https://oldschool.runescape.wiki/w/RS:SYNC) asks third parties not to). Shows the import date and nags after 7 days. |
| [Wise Old Man](https://docs.wiseoldman.net/api) `GET /v2/players/iron%20funyon` | Skill levels + XP, combat level | Refreshes levels between imports, cached 1 hour minimum. One `POST` update request per session at most, on a manual Refresh. |
| Wiki MediaWiki API, `Optimal_quest_guide/Ironman` wikitext | The guide's Questing Order table | Parsed into ordered steps; cached 7 days; a pre-parsed `src/data/guide.json` ships as the offline fallback. |
| Wiki quest pages (`{{Quest details}}`) | Skill / quest requirements per quest | Pre-fetched into `src/data/questReqs.json` by `build-guide`; missing ones are fetched lazily at runtime and cached. |

Guide content is CC BY-NC-SA 3.0; the footer credits the wiki.

### Level precedence

The newer of the Wise Old Man snapshot and the WikiSync import wins. Unknown skills (e.g. `Sailing`) are carried
through without crashing.

## How Next Up is chosen

1. In-progress quests (status 1) first, in guide order, tagged **In progress**.
2. Then the guide from the top: steps that are not done and not skipped, until 5 (toggle to 20).
3. Blocked steps are **not hidden**. They show a red chip like `Needs 50 Agility (you: 42)` linking to the training
   page; boostable requirements show amber.
4. Steps that are prerequisites of a pinned goal within the next 20 get a `Helps: <goal>` tag.

### Completion rules

- Quest step: done when the import has the quest at status 2 (names are matched after normalising apostrophes,
  dashes, roman numerals and `/` vs ` - `, plus a small alias table in `src/lib/names.ts`).
- Partial step (the guide splits some quests): done when the quest is status 1 or 2.
- Diary step: done when `achievement_diaries[area][tier].complete`; "All Easy" needs every area.
- Training / unlock / gather steps: manual check-off only.
- Manual Done / Skip always win over imported data.

## Stats tab

- **Stats grid**: all 24 skills in the in-game order with level, XP and progress to the next level (XP from Wise
  Old Man; the WikiSync import carries levels only), plus total level, combat level, total XP and quest points.
- **XP calculator**: pick a skill and target level; current XP is prefilled and can be overridden. Enter a method's
  XP per action (and optionally actions per hour) to get the number of actions and hours; saved methods stay with
  the skill.
- **Gear I'm using**: named setups (melee, ranged, Slayer…) with the 11 equipment slots and notes. Each filled slot
  links to its wiki page. Slots autocomplete from the bundled item database: every item name in the game
  (`src/data/items.json`, from RuneLite's public cache listing) plus the wiki's per-slot equipment categories
  (`src/data/equipment.json`), so a weapon slot searches weapons first. `npm run build-items` refreshes both. The
  database loads lazily on first use.

## Milestones: gear, combat and Slayer

The quest guide is the backbone, but an ironman also plans around gear and combat unlocks. `src/data/milestones.ts`
holds a curated list (28 gear, 13 combat, 15 Slayer) with the real requirements (skills, combat level, quests, diary
tiers, other milestones), an ironman-only route in a sentence or two, and a wiki link.

- **Status from your data**: each requirement is checked against the import and Wise Old Man levels. Unlock-type
  milestones (Piety, Ancient Magicks, Konar, "85 Slayer: abyssal demons", Combat 100…) complete automatically;
  gear is never assumed and is ticked by hand.
- **Ready now** on Next Up: up to three milestones you meet every requirement for, earliest stage first.
- **Milestone browser** on Goals: Gear / Combat / Slayer tabs with done / ready / "n to go" and `Needs 58 Slayer
  (you: 41)` chips, one tap to add as a goal.
- **Goal types** now include `milestone` (prerequisite checklist derived from the data, manual ticks allowed) and
  `combat` (combat level target from the standard formula). Pinned milestone goals get `Helps:` tags on the guide
  steps that are their prerequisites, and a "ready now" line once nothing is missing.

Edit the list in `src/data/milestones.ts`; `tests/milestones.test.ts` checks every quest and milestone reference
and that no route mentions the GE or trading.

## Guide parser

`src/lib/wikitext.ts` parses the wikitext (not rendered HTML). It splits the Questing Order table on `|-`, takes the
first `[[link]]` as the step name, reads the `{{Optimal quest|skill=xp}}` running XP totals (converted to levels),
`{{Optimal quest/qp|n}}`, the checklist bullets, and the location. `{{Optimal quest/train|skill|level}}` lines, which
the guide inserts between quests, become `Train <Skill> to <level>` steps. Rows that fail to parse are logged, never
silently dropped; the test suite asserts fewer than 2% unparsed. Current snapshot: 340 steps from 237 rows, 0 unparsed.

## Bundled import

`src/data/initialImport.json` is the player's real WikiSync export. A fresh install starts from it, and a saved
import older than it is replaced on load, so the app never shows stale data after an update. Replace the file with a
newer export and merge to update everyone's baseline; the tests run against it.

## Look

OSRS interface browns and orange (`tailwind.config.js` remaps the neutral and accent scales), Cinzel for headings, and
the wiki's skill and UI icons (`src/assets/icons`, CC BY-NC-SA 3.0, inlined at build time) on stats, chips, goals and
the tab bar.

`fixtures/guide.wikitext` is the real guide wikitext as fetched; `npm run build-guide -- --offline` re-parses it
without the network.

## Layout

```
scripts/build-guide.ts   fetch wiki → src/data/{guide,questReqs,questNames}.json
src/data/milestones.ts   curated gear / combat / Slayer milestones
src/lib/                 wikitext parser, quest-requirements parser, WikiSync import, WOM client, completion + milestone logic
src/store/               zustand store persisted to localStorage (ironPlanner:v1)
src/components/          Header, NextUp/StepCard, MilestoneCard, Goals, Todo, Stats, ImportDialog, FlagBadge
tests/                   vitest suites
```
