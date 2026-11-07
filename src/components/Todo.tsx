import { useState } from 'react';
import { useStore } from '../store';
import type { TodoTag } from '../lib/types';
import { formatDate } from '../hooks/useDerived';

const TAGS: TodoTag[] = ['Supplies', 'Unlock', 'Training', 'Diary', 'Boss'];
const TAG_STYLE: Record<TodoTag, string> = {
  Supplies: 'bg-lime-900/60 text-lime-200',
  Unlock: 'bg-fuchsia-900/60 text-fuchsia-200',
  Training: 'bg-emerald-900/60 text-emerald-200',
  Diary: 'bg-orange-900/60 text-orange-200',
  Boss: 'bg-red-900/60 text-red-200',
};

export default function Todo() {
  const todos = useStore((s) => s.todos);
  const addTodo = useStore((s) => s.addTodo);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const removeTodo = useStore((s) => s.removeTodo);
  const steps = useStore((s) => s.guide.steps);
  const [text, setText] = useState('');
  const [tags, setTags] = useState<TodoTag[]>([]);
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addTodo(text, tags);
    setText('');
    setTags([]);
  };

  return (
    <section className="space-y-3">
      <form onSubmit={submit} className="card space-y-2">
        <input className="input" placeholder="Add a todo… (no GE, no trading: gather it yourself)" value={text} onChange={(e) => setText(e.target.value)} aria-label="New todo" />
        <div className="flex flex-wrap items-center gap-1">
          {TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
              className={`chip border ${tags.includes(t) ? 'border-amber-500 ' + TAG_STYLE[t] : 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}
            >
              {t}
            </button>
          ))}
          <button type="submit" className="btn-primary ml-auto">Add</button>
        </div>
      </form>
      <ul className="space-y-1.5">
        {open.map((t) => (
          <li key={t.id} className="card flex items-start gap-2 !py-2">
            <input type="checkbox" checked={false} onChange={() => toggleTodo(t.id)} className="mt-1 h-4 w-4 accent-amber-500" aria-label={`Complete ${t.text}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm">{t.text}</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {t.tags.map((tag) => <span key={tag} className={`chip ${TAG_STYLE[tag]}`}>{tag}</span>)}
                {t.linkedStepId ? <span className="chip bg-zinc-800 text-zinc-400">guide #{(steps.find((s) => s.id === t.linkedStepId)?.order ?? -1) + 1 || '?'}</span> : null}
              </div>
            </div>
            <button className="btn-danger !px-2 !py-0.5" onClick={() => removeTodo(t.id)} aria-label="Remove">×</button>
          </li>
        ))}
      </ul>
      {!open.length ? <p className="card text-sm text-zinc-300">Nothing on the list. Add supplies to gather, unlocks to chase, or quick-add from a Next Up card.</p> : null}
      {done.length ? (
        <details className="card text-xs">
          <summary className="cursor-pointer text-zinc-300">Done ({done.length})</summary>
          <ul className="mt-1 space-y-1">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <input type="checkbox" checked onChange={() => toggleTodo(t.id)} className="accent-amber-500" aria-label={`Reopen ${t.text}`} />
                <span className="flex-1 text-zinc-500 line-through">{t.text}</span>
                <span className="text-zinc-600">{formatDate(t.doneAt)}</span>
                <button className="text-zinc-600 hover:text-red-300" onClick={() => removeTodo(t.id)} aria-label="Remove">×</button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
