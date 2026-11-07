import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useLevels } from '../hooks/useDerived';
import { useEquipment } from '../hooks/useEquipment';
import { levelOf } from '../lib/completion';
import {
  meleeMaxHit, rangedMaxHit, magicMaxHit, SPELLS, MELEE_PRAYERS, RANGED_PRAYERS, MELEE_POTIONS, RANGED_POTIONS, MAGIC_POTIONS,
  type MeleeStyle, type RangedStyle,
} from '../lib/maxhit';
import SkillIcon from './SkillIcon';
import ItemIcon from './ItemIcon';

type Mode = 'melee' | 'ranged' | 'magic';

function modeFor(cs?: string): Mode {
  if (!cs) return 'melee';
  if (/powered staff|staff|bladed staff|salamander/i.test(cs) && /powered|salamander/i.test(cs)) return 'magic';
  if (/bow|crossbow|thrown|chinchompa|dart|knife|javelin|ballista|atlatl/i.test(cs)) return 'ranged';
  return 'melee';
}

export default function MaxHit() {
  const gear = useStore((s) => s.gear);
  const { levels } = useLevels();
  const eq = useEquipment();
  const [setupId, setSetupId] = useState<string>('');
  const [modeOverride, setModeOverride] = useState<Mode | ''>('');
  const [meleeStyle, setMeleeStyle] = useState<MeleeStyle>('aggressive');
  const [rangedStyle, setRangedStyle] = useState<RangedStyle>('rapid');
  const [prayer, setPrayer] = useState('none');
  const [potion, setPotion] = useState('none');
  const [onTask, setOnTask] = useState(false);
  const [undead, setUndead] = useState(false);
  const [spellId, setSpellId] = useState('fire-bolt');
  const [manualStr, setManualStr] = useState('');

  const setup = gear.find((g) => g.id === setupId) ?? gear[0];
  const computed = useMemo(() => (eq && setup ? eq.setupStats(setup.slots) : null), [eq, setup]);
  const mods = useMemo(() => (eq && setup ? eq.detectModifiers(setup.slots) : null), [eq, setup]);
  const weapon = computed?.items.weapon;
  const mode: Mode = modeOverride || modeFor(weapon?.cs);

  const str = levelOf(levels, 'strength');
  const rng = levelOf(levels, 'ranged');
  const mag = levelOf(levels, 'magic');

  const result = useMemo(() => {
    if (!computed) return null;
    const t = computed.total;
    const strBonus = manualStr.trim() ? Number(manualStr) || 0 : t.str;
    if (mode === 'melee') {
      const pot = MELEE_POTIONS.find((p) => p.id === potion) ?? MELEE_POTIONS[0];
      const pr = MELEE_PRAYERS.find((p) => p.id === prayer) ?? MELEE_PRAYERS[0];
      return meleeMaxHit({ strengthLevel: str, potionBoost: pot.boost(str), prayerMult: pr.mult, style: meleeStyle, strengthBonus: strBonus, void: Boolean(mods?.voidMelee), slayerHelm: onTask && Boolean(mods?.slayerHelm), salveE: undead && Boolean(mods?.salveE || mods?.salveEi), obsidian: Boolean(mods?.berserkerNecklace && mods?.obsidianWeapon) });
    }
    if (mode === 'ranged') {
      const pot = RANGED_POTIONS.find((p) => p.id === potion) ?? RANGED_POTIONS[0];
      const pr = RANGED_PRAYERS.find((p) => p.id === prayer) ?? RANGED_PRAYERS[0];
      const rstr = manualStr.trim() ? Number(manualStr) || 0 : t.rstr;
      return rangedMaxHit({ rangedLevel: rng, potionBoost: pot.boost(rng), prayerMult: pr.mult, style: rangedStyle, rangedStrength: rstr, void: Boolean(mods?.voidRanged), eliteVoid: Boolean(mods?.eliteVoidRanged), slayerHelm: onTask && Boolean(mods?.slayerHelmImbued), salveEi: undead && Boolean(mods?.salveEi) });
    }
    const pot = MAGIC_POTIONS.find((p) => p.id === potion) ?? MAGIC_POTIONS[0];
    const spell = SPELLS.find((s) => s.id === spellId) ?? SPELLS[0];
    return magicMaxHit({ magicLevel: mag, potionBoost: pot.boost(mag), spell, magicDamagePct: t.mdmg, eliteVoid: Boolean(mods?.eliteVoidMagic), slayerHelm: onTask && Boolean(mods?.slayerHelmImbued), salveEi: undead && Boolean(mods?.salveEi), chaosGauntlets: Boolean(mods?.chaosGauntlets), tomeOfFire: Boolean(mods?.tomeOfFire) });
  }, [computed, mode, potion, prayer, meleeStyle, rangedStyle, onTask, undead, spellId, manualStr, mods, str, rng, mag]);

  const prayers = mode === 'melee' ? MELEE_PRAYERS : mode === 'ranged' ? RANGED_PRAYERS : [];
  const potions = mode === 'melee' ? MELEE_POTIONS : mode === 'ranged' ? RANGED_POTIONS : MAGIC_POTIONS;
  const skill = mode === 'melee' ? 'strength' : mode === 'ranged' ? 'ranged' : 'magic';

  return (
    <div className="card">
      <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold"><SkillIcon skill={skill} /> Max hit</h2>
      {!gear.length ? (
        <p className="mt-1 text-xs text-zinc-400">Add a gear setup below and this fills in from its bonuses and your levels.</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <label>Setup
              <select id="mh-setup" className="input mt-0.5" value={setup?.id ?? ''} onChange={(e) => { setSetupId(e.target.value); setModeOverride(''); setPrayer('none'); setPotion('none'); }}>
                {gear.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label>Style
              <select id="mh-mode" className="input mt-0.5" value={mode} onChange={(e) => { setModeOverride(e.target.value as Mode); setPrayer('none'); setPotion('none'); }}>
                <option value="melee">Melee</option>
                <option value="ranged">Ranged</option>
                <option value="magic">Magic</option>
              </select>
            </label>
            {mode === 'melee' ? (
              <label>Attack style
                <select id="mh-mstyle" className="input mt-0.5" value={meleeStyle} onChange={(e) => setMeleeStyle(e.target.value as MeleeStyle)}>
                  <option value="aggressive">Aggressive (+3 str)</option>
                  <option value="controlled">Controlled (+1)</option>
                  <option value="accurate">Accurate</option>
                  <option value="defensive">Defensive</option>
                </select>
              </label>
            ) : mode === 'ranged' ? (
              <label>Attack style
                <select id="mh-rstyle" className="input mt-0.5" value={rangedStyle} onChange={(e) => setRangedStyle(e.target.value as RangedStyle)}>
                  <option value="rapid">Rapid</option>
                  <option value="accurate">Accurate (+3)</option>
                  <option value="longrange">Longrange</option>
                </select>
              </label>
            ) : (
              <label>Spell
                <select id="mh-spell" className="input mt-0.5" value={spellId} onChange={(e) => setSpellId(e.target.value)}>
                  {(['standard', 'ancient', 'staff'] as const).map((book) => (
                    <optgroup key={book} label={book === 'staff' ? 'Powered staves' : book === 'ancient' ? 'Ancient Magicks' : 'Standard spellbook'}>
                      {SPELLS.filter((s) => s.book === book).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.level})</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            {prayers.length ? (
              <label>Prayer
                <select id="mh-prayer" className="input mt-0.5" value={prayer} onChange={(e) => setPrayer(e.target.value)}>
                  {prayers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
            ) : null}
            <label>Potion
              <select id="mh-potion" className="input mt-0.5" value={potion} onChange={(e) => setPotion(e.target.value)}>
                {potions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label>{mode === 'ranged' ? 'Ranged strength' : mode === 'magic' ? 'Magic dmg % (from gear)' : 'Strength bonus'} <span className="text-zinc-500">(override)</span>
              <input id="mh-bonus" className="input mt-0.5 tabular-nums" inputMode="numeric" placeholder={String(mode === 'ranged' ? computed?.total.rstr ?? 0 : mode === 'magic' ? computed?.total.mdmg ?? 0 : computed?.total.str ?? 0)} value={manualStr} onChange={(e) => setManualStr(e.target.value.replace(/[^0-9-]/g, ''))} disabled={mode === 'magic'} />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-300">
            <label className="flex items-center gap-1"><input type="checkbox" className="accent-amber-500" checked={onTask} onChange={(e) => setOnTask(e.target.checked)} /> On Slayer task {mods?.slayerHelm ? '' : <span className="text-zinc-500">(no slayer helm in setup)</span>}</label>
            <label className="flex items-center gap-1"><input type="checkbox" className="accent-amber-500" checked={undead} onChange={(e) => setUndead(e.target.checked)} /> Undead target {mods?.salveE || mods?.salveEi ? '' : <span className="text-zinc-500">(no salve amulet)</span>}</label>
          </div>
          {result ? (
            <div className="mt-3 rounded-md bg-zinc-800/60 p-2">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-bold text-amber-400 tabular-nums">{result.maxHit}</span>
                <span className="text-sm text-zinc-300">max hit</span>
                {weapon ? <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400"><ItemIcon name={weapon.n} size={20} /> {weapon.n}{computed?.speed ? ` · ${computed.speed}t` : ''}</span> : null}
              </div>
              <ol className="mt-1.5 space-y-0.5 text-[11px] tabular-nums text-zinc-400">
                {result.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
                <span><SkillIcon skill={skill} size={12} /> {skill === 'strength' ? str : skill === 'ranged' ? rng : mag} {skill}</span>
                {mods?.voidMelee && mode === 'melee' ? <span>void ✓</span> : null}
                {(mods?.voidRanged || mods?.eliteVoidRanged) && mode === 'ranged' ? <span>{mods.eliteVoidRanged ? 'elite void ✓' : 'void ✓'}</span> : null}
                {computed?.unknown.length ? <span className="text-amber-300">not in database: {computed.unknown.join(', ')}</span> : null}
              </div>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-zinc-500">Formulas from the wiki's Maximum melee, ranged and magic hit pages. Void, slayer helm, salve and berserker necklace are read from the setup; special attacks are not modelled.</p>
        </>
      )}
    </div>
  );
}
