import { useEffect, useMemo, useRef, useState } from 'react';
import { useEquipment } from '../hooks/useEquipment';
import ItemIcon from './ItemIcon';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Equipment slot to search first. */
  slot?: string;
  placeholder?: string;
  className?: string;
}

/** Text input with equipment suggestions (name, icon, key bonus) from the bundled database. */
export default function ItemInput({ id, value, onChange, slot, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const eq = useEquipment();
  const wrap = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => (open && eq ? eq.searchEquipment(value, slot, 8) : []), [value, slot, open, eq]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (name: string) => { onChange(name); setOpen(false); };
  const summary = (e: { s: number[]; slot: string; sp?: number }) => {
    const [astab, aslash, acrush, amagic, arange, , , , , , str, rstr, mdmg] = e.s;
    if (e.slot === 'weapon') return `${Math.max(astab, aslash, acrush, amagic, arange)} atk · ${str || rstr} str${e.sp ? ` · ${e.sp}t` : ''}`;
    if (e.slot === 'ammo') return `${rstr} rstr`;
    const def = e.s.slice(5, 10).reduce((a, b) => a + b, 0);
    return `${def} def · ${str || rstr || mdmg} ${mdmg ? 'mdmg' : 'str'}`;
  };

  return (
    <div ref={wrap} className={`relative ${className ?? ''}`}>
      <input
        id={id}
        className="input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[active].n); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && suggestions.length ? (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-lg" role="listbox">
          {suggestions.map((s, i) => (
            <li key={s.n} role="option" aria-selected={i === active}>
              <button type="button" className={`flex w-full items-center gap-2 px-2 py-1 text-left text-sm ${i === active ? 'bg-amber-500/20 text-amber-100' : 'text-zinc-200 hover:bg-zinc-800'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s.n)}>
                <ItemIcon name={s.n} size={24} />
                <span className="min-w-0 flex-1 truncate">{s.n}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">{summary(s)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
