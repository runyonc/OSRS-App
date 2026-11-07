import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useLevels, useHeaderStats, formatAge } from '../hooks/useDerived';
import { levelOf, totalLevel } from '../lib/completion';
import { combatLevel } from '../lib/milestones';
import { skillLabel, xpForLevel, levelForXp, SKILLS } from '../lib/xp';
import { planXp, actionsNeeded, hoursNeeded, STATS_ORDER, GEAR_SLOTS } from '../lib/xpcalc';
import { wikiPageUrl, trainingUrl } from '../lib/wiki';

const fmt = (n: number) => n.toLocaleString();

export default function Stats() {
  return (
    <section className="space-y-5">
      <StatsGrid />
      <XpCalculator />
      <GearSetups />
    </section>
  );
}

function StatsGrid() {
  const { levels, source } = useLevels();
  const header = useHeaderStats();
  const hasXp = Object.values(levels).some((v) => v.xp != null);
  const total = totalLevel(levels);
  const totalXp = Object.values(levels).reduce((sum, v) => sum + (v.xp ?? 0), 0);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Stats</h2>
        <span className="text-[11px] text-zinc-500">
          {source === 'wom' ? `Wise Old Man, ${formatAge(header.levelsAt)}` : source === 'import' ? `WikiSync import, ${formatAge(header.levelsAt)} (levels only)` : 'no data yet: import or refresh'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {STATS_ORDER.map((skill) => {
          const v = levels[skill];
          const level = levelOf(levels, skill);
          const xp = v?.xp;
          const next = level >= 99 ? null : xpForLevel(level + 1);
          const start = xpForLevel(level);
          const pct = xp != null && next ? Math.round(((xp - start) / (next - start)) * 100) : null;
          return (
            <a key={skill} href={trainingUrl(skill)} target="_blank" rel="noreferrer" className={`rounded-md border px-2 py-1.5 ${v ? 'border-zinc-800 bg-zinc-900' : 'border-dashed border-zinc-800 bg-transparent'}`} title={xp != null ? `${fmt(xp)} XP${next ? ` · ${fmt(next - xp)} to ${level + 1}` : ''}` : skillLabel(skill)}>
              <div className="flex items-baseline justify-between">
                <span className="truncate text-[11px] text-zinc-400">{skillLabel(skill)}</span>
                <span className={`text-sm font-semibold tabular-nums ${level >= 99 ? 'text-amber-300' : ''}`}>{v ? level : '—'}</span>
              </div>
              {pct !== null ? (
                <div className="mt-1 h-1 w-full overflow-hidden rounded bg-zinc-800"><div className="h-full bg-amber-500" style={{ width: `${pct}%` }} /></div>
              ) : <div className="mt-1 h-1" />}
              {xp != null ? (
                <div className="mt-0.5 text-[10px] tabular-nums text-zinc-500">{next ? `${fmt(next - xp)} to ${level + 1}` : `${fmt(xp)} XP`}</div>
              ) : <div className="mt-0.5 text-[10px] text-zinc-600">{v ? 'no XP in import' : ''}</div>}
            </a>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-400">
        <span>Total <b className="text-zinc-100 tabular-nums">{total}</b></span>
        <span>Combat <b className="text-zinc-100 tabular-nums">{combatLevel(levels)}</b></span>
        {hasXp ? <span>XP <b className="text-zinc-100 tabular-nums">{fmt(totalXp)}</b></span> : null}
        <span>QP <b className="text-zinc-100 tabular-nums">{header.qp}</b></span>
      </div>
    </div>
  );
}

function XpCalculator() {
  const { levels } = useLevels();
  const methods = useStore((s) => s.methods);
  const addMethod = useStore((s) => s.addMethod);
  const removeMethod = useStore((s) => s.removeMethod);
  const [skill, setSkill] = useState('agility');
  const [targetOverride, setTargetOverride] = useState('');
  const [xpOverride, setXpOverride] = useState('');
  const [methodName, setMethodName] = useState('');
  const [perAction, setPerAction] = useState('');
  const [perHour, setPerHour] = useState('');

  const known = levels[skill];
  const knownXp = known?.xp ?? (known ? xpForLevel(known.level) : 0);
  const currentXp = xpOverride.trim() ? Number(xpOverride) || 0 : knownXp;
  const currentLevel = levelForXp(currentXp, 126);
  const nextLevel = Math.min(126, currentLevel + 1);
  const target = targetOverride.trim() ? Math.max(1, Math.min(126, Number(targetOverride) || nextLevel)) : nextLevel;
  const plan = useMemo(() => planXp(currentXp, target), [currentXp, target]);
  const quick = [
    { label: `Next (${nextLevel})`, value: '' },
    { label: '+5', value: String(Math.min(126, currentLevel + 5)) },
    { label: '+10', value: String(Math.min(126, currentLevel + 10)) },
    { label: '99', value: '99' },
  ];
  const skillMethods = methods.filter((m) => m.skill === skill);
  const liveMethod = Number(perAction) > 0 ? { name: methodName.trim() || 'this method', xpPerAction: Number(perAction), perHour: Number(perHour) > 0 ? Number(perHour) : undefined } : null;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold">XP calculator</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <label className="text-xs text-zinc-400">Skill
          <select id="calc-skill" className="input mt-0.5" value={skill} onChange={(e) => { setSkill(e.target.value); setXpOverride(''); setTargetOverride(''); }}>
            {SKILLS.map((s) => <option key={s} value={s}>{skillLabel(s)}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-400">Target level <span className="text-zinc-500">(defaults to next)</span>
          <input id="calc-target" className="input mt-0.5" type="number" min={2} max={126} placeholder={String(nextLevel)} value={targetOverride} onChange={(e) => setTargetOverride(e.target.value)} />
        </label>
        <div className="col-span-2 flex flex-wrap gap-1">
          {quick.map((q) => (
            <button key={q.label} type="button" onClick={() => setTargetOverride(q.value)} className={`chip border ${(targetOverride.trim() || '') === q.value ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}>{q.label}</button>
          ))}
        </div>
        <label className="col-span-2 text-xs text-zinc-400">Current XP <span className="text-zinc-500">(from {known?.xp != null ? 'Wise Old Man' : known ? 'import level, XP estimated at the level floor' : 'nothing yet'}; type to override)</span>
          <input id="calc-xp" className="input mt-0.5 tabular-nums" inputMode="numeric" placeholder={fmt(knownXp)} value={xpOverride} onChange={(e) => setXpOverride(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
      </div>
      <div className="mt-3 rounded-md bg-zinc-800/60 p-2 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span>Level <b className="tabular-nums">{plan.currentLevel}</b> → <b className="tabular-nums">{plan.targetLevel}</b></span>
          <span className="text-zinc-300"><b className="tabular-nums text-amber-300">{fmt(plan.remaining)}</b> XP to {plan.targetLevel === nextLevel ? 'level up' : 'go'}</span>
          <span className="text-xs text-zinc-500 tabular-nums">{fmt(plan.currentXp)} / {fmt(plan.targetXp)}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-zinc-900"><div className="h-full bg-amber-500" style={{ width: `${Math.round(plan.progress * 100)}%` }} /></div>
        {plan.remaining === 0 ? <div className="mt-1 text-xs text-emerald-300">Already there.</div> : null}
      </div>

      <div className="mt-3 text-xs font-medium text-zinc-300">Actions needed</div>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        <input id="calc-method" className="input" placeholder="Method (e.g. Canifis lap)" value={methodName} onChange={(e) => setMethodName(e.target.value)} />
        <input id="calc-per-action" className="input tabular-nums" inputMode="decimal" placeholder="XP each" value={perAction} onChange={(e) => setPerAction(e.target.value.replace(/[^0-9.]/g, ''))} />
        <input id="calc-per-hour" className="input tabular-nums" inputMode="numeric" placeholder="per hour" value={perHour} onChange={(e) => setPerHour(e.target.value.replace(/[^0-9]/g, ''))} />
      </div>
      {liveMethod ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm">
          <span><b className="tabular-nums">{fmt(actionsNeeded(plan.remaining, liveMethod.xpPerAction))}</b> × {liveMethod.name}</span>
          {liveMethod.perHour ? <span className="text-zinc-400">≈ <b className="tabular-nums text-zinc-100">{hoursNeeded(plan.remaining, liveMethod.xpPerAction * liveMethod.perHour)}</b> h at {fmt(Math.round(liveMethod.xpPerAction * liveMethod.perHour))} XP/h</span> : null}
          <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => { addMethod({ skill, name: liveMethod.name, xpPerAction: liveMethod.xpPerAction, perHour: liveMethod.perHour }); setMethodName(''); setPerAction(''); setPerHour(''); }}>save</button>
        </div>
      ) : null}
      {skillMethods.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {skillMethods.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className="flex-1">
                <b className="tabular-nums">{fmt(actionsNeeded(plan.remaining, m.xpPerAction))}</b> × {m.name} <span className="text-zinc-500">({m.xpPerAction} XP{m.perHour ? ` · ≈ ${hoursNeeded(plan.remaining, m.xpPerAction * m.perHour)} h` : ''})</span>
              </span>
              <button className="text-zinc-600 hover:text-red-300" onClick={() => removeMethod(m.id)} aria-label={`Remove ${m.name}`}>×</button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-zinc-500">Level {levelForXp(plan.targetXp, 126)} starts at {fmt(plan.targetXp)} XP. Saved methods stay with the skill.</p>
    </div>
  );
}

function GearSetups() {
  const gear = useStore((s) => s.gear);
  const addGearSetup = useStore((s) => s.addGearSetup);
  const updateGearSetup = useStore((s) => s.updateGearSetup);
  const removeGearSetup = useStore((s) => s.removeGearSetup);
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Gear I'm using</h2>
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const id = addGearSetup(name || 'Setup'); setName(''); setOpen(id); }}>
          <input id="gear-name" className="input !w-36" placeholder="Melee, Ranged, Slayer…" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn-primary whitespace-nowrap">+ Setup</button>
        </form>
      </div>
      {!gear.length ? <p className="card mt-2 text-xs text-zinc-400">No setups yet. Add one per style (melee, ranged, magic, Slayer, skilling) and fill the slots with what you actually own.</p> : null}
      <ul className="mt-2 space-y-2">
        {gear.map((g) => {
          const filled = GEAR_SLOTS.filter((s) => g.slots[s]?.trim()).length;
          const isOpen = open === g.id;
          return (
            <li key={g.id} className="card">
              <div className="flex items-center gap-2">
                <button className="flex-1 text-left" onClick={() => setOpen(isOpen ? null : g.id)}>
                  <span className="text-sm font-semibold">{g.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">{filled}/{GEAR_SLOTS.length} slots</span>
                </button>
                <button className="btn-danger !px-2 !py-0.5" onClick={() => removeGearSetup(g.id)} aria-label={`Remove ${g.name}`}>×</button>
              </div>
              {!isOpen ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {GEAR_SLOTS.filter((s) => g.slots[s]?.trim()).map((s) => (
                    <a key={s} className="chip bg-zinc-800 text-zinc-300" href={wikiPageUrl(g.slots[s])} target="_blank" rel="noreferrer">{g.slots[s]}</a>
                  ))}
                </div>
              ) : (
                <div className="mt-2 space-y-1.5">
                  <input className="input" value={g.name} onChange={(e) => updateGearSetup(g.id, { name: e.target.value })} aria-label="Setup name" />
                  {GEAR_SLOTS.map((slot) => (
                    <label key={slot} className="flex items-center gap-2 text-xs">
                      <span className="w-14 shrink-0 capitalize text-zinc-400">{slot}</span>
                      <input id={`gear-${g.id}-${slot}`} className="input" placeholder="—" value={g.slots[slot] ?? ''} onChange={(e) => updateGearSetup(g.id, { slot: { key: slot, value: e.target.value } })} />
                      {g.slots[slot]?.trim() ? <a className="shrink-0 text-amber-400" href={wikiPageUrl(g.slots[slot])} target="_blank" rel="noreferrer" title="Open on the wiki">↗</a> : <span className="w-3" />}
                    </label>
                  ))}
                  <textarea className="input min-h-[3rem] text-xs" placeholder="Notes: inventory, switches, what to upgrade next" value={g.notes} onChange={(e) => updateGearSetup(g.id, { notes: e.target.value })} aria-label="Setup notes" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
