import { useState } from 'react';
import { FolderInput, X } from 'lucide-react';

/**
 * The Recolor tab's Import button: lists the palette files in the drop folder (`cms/palettes-inbox/`)
 * and adds the one the owner clicks to the Material Library. The server does the write, through the
 * same library files the editor saves to; `onImported` re-reads the library afterwards.
 */
export default function PaletteImport({ library, onImported }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');

  const refresh = async () => {
    setStatus('');
    try {
      const res = await fetch('/api/palette-inbox');
      setFiles(res.ok ? await res.json() : []);
      if (!res.ok) setStatus('Could not read the drop folder.');
    } catch (err) {
      setFiles([]);
      setStatus('Could not read the drop folder: ' + err.message);
    }
  };

  const toggle = () => {
    if (!open) refresh();
    setOpen(!open);
  };

  const importFile = async (entry, overwrite = false) => {
    const res = await fetch('/api/palette-inbox/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: entry.file, overwrite }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      if (window.confirm(`"${body.name}" is already in the Material Library. Replace it with ${entry.file}?`)) {
        return importFile(entry, true);
      }
      return;
    }
    if (!res.ok) {
      setStatus(body.error || 'Import failed.');
      return;
    }
    setStatus(`Imported "${body.name}" (${body.colors} colours).`);
    await onImported?.();
  };

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-bold border hover:bg-white/5"
        style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)' }}
      >
        {open ? <X size={13} /> : <FolderInput size={13} />}
        {open ? 'Close import' : 'Import'}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2" aria-label="Palette drop folder">
          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            Files in <code>cms/palettes-inbox/</code>
          </p>
          {files.length === 0 && (
            <p className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>The drop folder is empty.</p>
          )}
          {files.map((entry) => (
            <div key={entry.file} className="flex flex-col gap-1 p-2 rounded border" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold truncate" title={entry.file}>{entry.name || entry.file}</span>
                {!entry.error && (
                  <button
                    type="button"
                    onClick={() => importFile(entry)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {library?.[entry.name] ? 'Re-import' : 'Import'}
                  </button>
                )}
              </div>
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {entry.file}{entry.group ? ` · ${entry.group}` : ''}
              </span>
              {entry.error ? (
                <span className="text-[10px] text-red-400">{entry.error}</span>
              ) : (
                <div className="flex flex-wrap gap-0.5">
                  {entry.colors.map((c, i) => (
                    <span key={i} title={c} className="w-3.5 h-3.5 rounded-sm border border-black/40" style={{ background: c }} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {status && <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{status}</p>}
        </div>
      )}
    </div>
  );
}
