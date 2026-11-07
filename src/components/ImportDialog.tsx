import { useRef, useState } from 'react';
import { useStore } from '../store';
import { parseWikiSyncExport } from '../lib/wikisync';
import { formatDate } from '../hooks/useDerived';
import { PLAYER, wikiSyncViewUrl } from '../config';

export default function ImportDialog({ onClose }: { onClose: () => void }) {
  const setPlayer = useStore((s) => s.setPlayer);
  const player = useStore((s) => s.player);
  const exportState = useStore((s) => s.exportState);
  const importState = useStore((s) => s.importState);
  const resetAll = useStore((s) => s.resetAll);
  const [text, setText] = useState('');
  const [name, setName] = useState(PLAYER);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  const doImport = (raw: string) => {
    try {
      const data = parseWikiSyncExport(raw);
      setPlayer(data);
      const quests = Object.values(data.quests);
      setOk(`Imported ${quests.filter((q) => q === 2).length} completed quests, ${quests.filter((q) => q === 1).length} in progress, ${Object.keys(data.diaries).length} diary areas.`);
      setError(null);
      setText('');
    } catch (e) {
      setError((e as Error).message);
      setOk(null);
    }
  };

  const readFile = (file: File | undefined, cb: (s: string) => void) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(String(r.result ?? ''));
    r.readAsText(file);
  };

  const downloadBackup = () => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iron-funyon-planner-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-xl bg-zinc-900 p-4 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Import WikiSync export</h2>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Paste or upload the JSON you export from the wiki. This app never calls sync.runescape.wiki itself (the wiki asks third parties not to).
          {player ? ` Last import: ${formatDate(player.importedAt)}.` : ''}
        </p>
        <label className="mt-2 block text-xs text-zinc-400">RuneScape name
          <input id="wikisync-name" className="input mt-0.5" value={name} onChange={(e) => setName(e.target.value)} placeholder={PLAYER} aria-label="RuneScape name" />
        </label>
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-zinc-300">
          <li>
            <a className="text-amber-400 hover:underline" href={wikiSyncViewUrl(name)} target="_blank" rel="noreferrer">Open WikiSync data for {name.trim() || PLAYER} ↗</a>
            <span className="text-zinc-500"> (opens the wiki in a new tab)</span>
          </li>
          <li>Select all, copy.</li>
          <li>Paste below and tap Import.</li>
        </ol>
        <textarea className="input mt-2 min-h-[8rem] font-mono text-xs" placeholder='{"quests": {...}, "achievement_diaries": {...}, "levels": {...}}' value={text} onChange={(e) => setText(e.target.value)} aria-label="WikiSync JSON" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className="btn-primary" disabled={!text.trim()} onClick={() => doImport(text)}>Import pasted JSON</button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Upload file…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => readFile(e.target.files?.[0], doImport)} />
        </div>
        {ok ? <p className="mt-2 text-xs text-emerald-300">{ok}</p> : null}
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

        <hr className="my-4 border-zinc-800" />
        <h3 className="text-sm font-semibold">Backup</h3>
        <p className="mt-1 text-xs text-zinc-400">Everything lives in this browser's localStorage. Export a backup before clearing site data or switching phones.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className="btn-ghost" onClick={downloadBackup}>Export app state</button>
          <button className="btn-ghost" onClick={() => backupRef.current?.click()}>Restore backup…</button>
          <input ref={backupRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => readFile(e.target.files?.[0], (s) => { try { importState(s); setOk('Backup restored.'); setError(null); } catch (err) { setError((err as Error).message); } })} />
          <button className="btn-danger ml-auto" onClick={() => { if (confirm('Clear all planner data? Export a backup first.')) { resetAll(); onClose(); } }}>Reset all</button>
        </div>
      </div>
    </div>
  );
}
