import { useEffect, useState } from 'react';
import { useStore } from './store';
import Header from './components/Header';
import NextUp from './components/NextUp';
import Goals from './components/Goals';
import Todo from './components/Todo';
import ImportDialog from './components/ImportDialog';
import { refreshAll } from './services/refresh';
import { GUIDE_URL } from './config';

const TABS = [
  { id: 'next', label: 'Next Up', icon: '🧭' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'todo', label: 'Todo', icon: '☑️' },
] as const;

export default function App() {
  const tab = useStore((s) => s.ui.tab);
  const setTab = useStore((s) => s.setTab);
  const goals = useStore((s) => s.goals);
  const todos = useStore((s) => s.todos);
  const [importOpen, setImportOpen] = useState(false);

  // On load: silently top up WOM levels / guide if their caches have expired. Failures are fine offline.
  useEffect(() => {
    refreshAll().catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen pb-20">
      <Header onImport={() => setImportOpen(true)} />
      <main className="mx-auto max-w-xl px-4 py-3">
        {tab === 'next' ? <NextUp onImport={() => setImportOpen(true)} /> : null}
        {tab === 'goals' ? <Goals /> : null}
        {tab === 'todo' ? <Todo /> : null}
        <footer className="mt-8 text-center text-[11px] leading-relaxed text-zinc-600">
          Guide content from the <a className="underline" href={GUIDE_URL} target="_blank" rel="noreferrer">OSRS Wiki — Optimal quest guide/Ironman</a>, licensed{' '}
          <a className="underline" href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 3.0</a>.
          Levels from <a className="underline" href="https://wiseoldman.net" target="_blank" rel="noreferrer">Wise Old Man</a>. Ironman only: nothing here will tell you to buy it.
        </footer>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => {
            const count = t.id === 'goals' ? goals.filter((g) => !g.done).length : t.id === 'todo' ? todos.filter((x) => !x.done).length : 0;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${tab === t.id ? 'text-amber-400' : 'text-zinc-400'}`}
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <span className="text-lg leading-none" aria-hidden>{t.icon}</span>
                <span>{t.label}{count ? ` (${count})` : ''}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {importOpen ? <ImportDialog onClose={() => setImportOpen(false)} /> : null}
    </div>
  );
}
