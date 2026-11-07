import { useState } from 'react';
import { useHeaderStats, formatAge, formatDate } from '../hooks/useDerived';
import { PLAYER } from '../config';
import { refreshAll, type RefreshReport } from '../services/refresh';

interface Props { onImport: () => void }

export default function Header({ onImport }: Props) {
  const stats = useHeaderStats();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<RefreshReport | null>(null);

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await refreshAll({ force: true });
      setReport(r);
      setTimeout(() => setReport(null), 8000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-2 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">
            <span className="text-iron">⚙</span> {PLAYER}
            {stats.combatLevel ? <span className="ml-2 text-xs font-normal text-zinc-400">cmb {stats.combatLevel}</span> : null}
          </h1>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-400">
            <span><b className="text-zinc-100">{stats.totalLevel}</b> total</span>
            <span><b className="text-zinc-100">{stats.qp}</b> QP</span>
            <span title={`Levels from ${stats.levelSource === 'wom' ? 'Wise Old Man' : stats.levelSource === 'import' ? 'WikiSync import' : 'nowhere yet'}`}>
              lvls {stats.levelSource === 'none' ? '—' : formatAge(stats.levelsAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button className="btn-ghost" onClick={onImport} aria-label="Import WikiSync export">Import</button>
          <button className="btn-primary" onClick={refresh} disabled={busy} aria-label="Refresh data">{busy ? '…' : 'Refresh'}</button>
        </div>
      </div>
      <div className="mx-auto mt-1.5 flex max-w-xl flex-wrap items-center gap-x-3 text-[11px] text-zinc-500">
        <span className={stats.importStale ? 'text-amber-400' : ''}>
          WikiSync: {stats.importedAt ? `imported ${formatDate(stats.importedAt)} (${formatAge(stats.importedAt)})` : 'not imported'}
          {stats.importStale && stats.importedAt ? ' · older than 7 days, re-import' : ''}
        </span>
        <span>WOM: {formatAge(stats.womAt)}</span>
        <span>Guide: {stats.guideSource === 'wiki' ? 'wiki' : 'bundled'} {formatDate(stats.guideAt)}</span>
      </div>
      {report ? (
        <div className="mx-auto mt-1.5 max-w-xl rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300">
          WOM {report.wom} · guide {report.guide}
          {report.reqsFetched ? ` · fetched reqs for ${report.reqsFetched} quests` : ''}
          {report.importStale ? ' · WikiSync import is stale: export a new one from the wiki and import it.' : ''}
          {report.errors.map((e) => <div key={e} className="text-red-300">{e}</div>)}
        </div>
      ) : null}
    </header>
  );
}
