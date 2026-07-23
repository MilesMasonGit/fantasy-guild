import React from 'react';

// CMS rework Phase 3 (L9 / concept §3.2). Shown BEFORE any file is written by
// "Sync to Game": every file that will change, every field on every entity that
// will change (old → new), every entity staged for deletion, and any genuinely
// new content. Nothing is written until the user confirms. The plan the modal
// displays is exactly the plan that gets applied.

function fmt(v) {
  if (v === undefined) return '(absent)';
  if (v === null) return 'null';
  if (typeof v === 'string') return v === '' ? '(empty)' : `"${v}"`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export const SyncPreviewModal = ({ isOpen, plan, error, isSyncing, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  const fileChanges = plan?.preview?.fileChanges || [];
  const deletions = plan?.preview?.deletions || [];
  const newEntities = plan?.preview?.newEntities || [];
  const changedFileCount = Object.keys(plan?.files || {}).length;
  const nothingToDo = !error && changedFileCount === 0;

  const fieldChangeCount = fileChanges.reduce(
    (sum, f) => sum + f.entities.reduce((s, e) => s + e.changes.length, 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#121214] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Sync to Game — Preview</h2>
            <p className="text-sm text-gray-400">
              Field-level merge. Only the changes below are written; everything else in{' '}
              <code>data/</code> is left exactly as it is.
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              Could not build the sync preview: {error}
            </div>
          ) : nothingToDo ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
              Nothing to sync — the game's <code>data/</code> already matches the CMS. No files
              will be written.
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-400">
                {changedFileCount} file{changedFileCount === 1 ? '' : 's'} will change ·{' '}
                {fieldChangeCount} field change{fieldChangeCount === 1 ? '' : 's'} ·{' '}
                {newEntities.length} new · {deletions.length} deletion
                {deletions.length === 1 ? '' : 's'}.
              </div>

              {/* Field changes, grouped by file */}
              {fileChanges.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Changed fields
                  </h3>
                  <div className="space-y-3">
                    {fileChanges.map((f) => (
                      <div key={f.file} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 font-mono text-xs text-indigo-300">{f.file}</div>
                        <div className="space-y-2">
                          {f.entities.map((e) => (
                            <div key={e.id}>
                              <div className="text-sm font-semibold text-gray-200">{e.id}</div>
                              <ul className="mt-0.5 space-y-0.5 text-xs">
                                {e.changes.map((c, i) => (
                                  <li key={i} className="text-gray-400">
                                    <span className="text-gray-300">{c.path}</span>:{' '}
                                    <span className="text-red-300">{fmt(c.old)}</span>
                                    {' → '}
                                    <span className="text-emerald-300">{fmt(c.new)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New entities */}
              {newEntities.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    New content ({newEntities.length})
                  </h3>
                  <ul className="space-y-0.5 text-xs text-gray-400">
                    {newEntities.map((n) => (
                      <li key={`${n.collection}:${n.id}`}>
                        <span className="text-emerald-300">{n.id}</span>{' '}
                        <span className="text-gray-500">({n.collection})</span> →{' '}
                        <span className="font-mono text-indigo-300">{n.file}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Deletions */}
              {deletions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Staged deletions ({deletions.length})
                  </h3>
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <ul className="space-y-0.5 text-xs text-gray-400">
                      {deletions.map((d) => (
                        <li key={`${d.collection}:${d.id}`}>
                          <span className="text-red-300">{d.id}</span>{' '}
                          <span className="text-gray-500">({d.collection})</span> — removed from{' '}
                          <span className="font-mono text-indigo-300">{d.file}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-gray-500">
                      These were deleted in the CMS and will be removed from <code>data/</code> on sync.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/5 bg-white/5 px-6 py-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
          >
            Cancel
          </button>
          {!error && !nothingToDo && (
            <button onClick={onConfirm} disabled={isSyncing} className="btn-primary" style={{ opacity: isSyncing ? 0.6 : 1 }}>
              {isSyncing ? 'Writing…' : `Write ${changedFileCount} file${changedFileCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncPreviewModal;
