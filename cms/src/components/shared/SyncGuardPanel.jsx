import { AlertTriangle } from 'lucide-react';
import { SYNC_COLLECTIONS, describeSyncDiff } from '../../engine/syncGuard';

/** Lists longer than this start collapsed. */
const OPEN_LIMIT = 6;

function EntityList({ title, list }) {
  if (!list.length) return null;
  return (
    <details open={list.length <= OPEN_LIMIT} className="mb-2">
      <summary className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
        {title} ({list.length})
      </summary>
      <ul className="text-xs mt-1 ml-4" style={{ color: 'var(--color-text-muted)', listStyle: 'disc' }}>
        {list.map(({ id, name }) => (
          <li key={id}>
            {name}
            {name !== id && <span style={{ opacity: 0.6 }}> ({id})</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Section({ heading, lists, verb }) {
  const shown = SYNC_COLLECTIONS.filter(({ key }) => lists[key]?.length);
  if (!shown.length) return null;
  return (
    <div className="mb-3">
      <h3 className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--color-text-secondary, var(--color-text-muted))' }}>
        {heading}
      </h3>
      {shown.map(({ key, plural }) => (
        <EntityList key={key} title={`${plural} ${verb}`} list={lists[key]} />
      ))}
    </div>
  );
}

/** Shown instead of writing when a Sync to Game would remove content the game has. */
export default function SyncGuardPanel({ diff, busy, onRestore, onSyncAnyway, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} role="dialog" aria-label="Sync would remove content">
      <div
        className="rounded-xl shadow-2xl border flex flex-col p-5"
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', width: 560, maxHeight: '80vh' }}
      >
        <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--color-error, #ef4444)' }}>
          <AlertTriangle size={18} />
          <h2 className="text-sm font-bold">Sync would remove content</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>
          {describeSyncDiff(diff)}
        </p>
        <div className="overflow-y-auto mb-4 pr-1" style={{ minHeight: 0 }}>
          <Section heading="Would be removed" lists={diff.removed} verb="removed" />
          <Section heading="Would be added" lists={diff.added} verb="added" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs">
            Cancel
          </button>
          <button
            onClick={onSyncAnyway}
            disabled={busy}
            className="btn-ghost px-3 py-1.5 text-xs"
            style={{ color: 'var(--color-error, #ef4444)', borderColor: 'var(--color-error, #ef4444)' }}
          >
            Sync anyway
          </button>
          <button onClick={onRestore} disabled={busy} className="btn-primary px-3 py-1.5 text-xs font-semibold">
            Restore from Game instead
          </button>
        </div>
      </div>
    </div>
  );
}
