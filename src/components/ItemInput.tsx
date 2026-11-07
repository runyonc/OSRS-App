import { useEffect, useMemo, useRef, useState } from 'react';
import { loadItems, type ItemsModule } from '../lib/itemsLazy';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Equipment slot to search first; falls back to every item. */
  slot?: string;
  placeholder?: string;
  className?: string;
}

/** Text input with item-name suggestions from the bundled item database. */
export default function ItemInput({ id, value, onChange, slot, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<ItemsModule | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && !items) loadItems().then(setItems).catch(() => undefined);
  }, [open, items]);
  const suggestions = useMemo(() => {
    if (!open || !items) return [];
    const { searchItems, slotItems, ALL_ITEMS } = items;
    const pool = slot ? slotItems(slot) : ALL_ITEMS;
    const first = searchItems(value, pool, 8);
    if (first.length >= 4 || !slot) return first;
    const more = searchItems(value, ALL_ITEMS, 8).filter((n) => !first.includes(n));
    return [...first, ...more].slice(0, 8);
  }, [value, slot, open, items]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (name: string) => { onChange(name); setOpen(false); };

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
          else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && suggestions.length ? (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-lg" role="listbox">
          {suggestions.map((s, i) => (
            <li key={s} role="option" aria-selected={i === active}>
              <button type="button" className={`w-full px-2 py-1.5 text-left text-sm ${i === active ? 'bg-amber-500/20 text-amber-100' : 'text-zinc-200 hover:bg-zinc-800'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
