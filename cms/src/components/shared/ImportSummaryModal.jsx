import React from 'react';

// CMS rework Phase 2. Summary shown after "Import from Game" runs: per-collection
// counts (added vs refreshed) and the surfaced anomaly list (F13). Anomalies are
// grouped by type so a long list of dangling references stays digestible, while
// the load-bearing "missing preset" row is always visible.

const ANOMALY_LABELS = {
  missing_preset: 'Missing preset',
  unknown_skill: 'Unknown skill (not a skill, subskill, or alias)',
  dangling_item_ref: 'Dangling item reference',
  dangling_enemy_ref: 'Dangling enemy reference',
  duplicate_id: 'Duplicate card id (across files)',
};

const COLLECTION_LABELS = {
  items: 'Items',
  tasks: 'Cards (tasks)',
  recipes: 'Recipes',
  stations: 'Stations',
  enemies: 'Enemies',
  areas: 'Areas',
  quests: 'Quests',
  subskills: 'Subskills',
  effects: 'Effects',
  encounters: 'Encounters',
};

export const ImportSummaryModal = ({ isOpen, onClose, result, error }) => {
  if (!isOpen) return null;

  const merge = result?.merge || {};

  // Group anomalies by type for a compact display.
  const grouped = {};
  for (const a of result?.anomalies || []) {
    (grouped[a.type] = grouped[a.type] || []).push(a);
  }
  const anomalyTypes = Object.keys(grouped);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#121214] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Import from Game</h2>
            <p className="text-sm text-gray-400">
              Merged <code>data/</code> into the CMS store. CMS values win on conflict; import fills what was absent.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              Import failed: {error}
            </div>
          ) : (
            <>
              {/* Per-collection counts */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Imported</h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-gray-500">
                      <th className="pb-2">Collection</th>
                      <th className="pb-2 text-right">In data/</th>
                      <th className="pb-2 text-right">Added</th>
                      <th className="pb-2 text-right">Refreshed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(merge).map(([name, m]) => (
                      <tr key={name} className="border-b border-white/5">
                        <td className="py-1.5 text-gray-200">{COLLECTION_LABELS[name] || name}</td>
                        <td className="py-1.5 text-right text-gray-300">{m.incoming}</td>
                        <td className="py-1.5 text-right text-emerald-400">{m.added}</td>
                        <td className="py-1.5 text-right text-gray-400">{m.refreshed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Anomalies */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Anomalies ({result?.anomalies?.length || 0})
                </h3>
                {anomalyTypes.length === 0 ? (
                  <p className="text-sm text-gray-400">None found.</p>
                ) : (
                  <div className="space-y-3">
                    {anomalyTypes.map((type) => (
                      <div key={type} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        <div className="mb-1 text-sm font-semibold text-amber-300">
                          {ANOMALY_LABELS[type] || type}{' '}
                          <span className="text-amber-500/70">({grouped[type].length})</span>
                        </div>
                        <ul className="space-y-0.5 text-xs text-gray-400">
                          {grouped[type].slice(0, 8).map((a, i) => (
                            <li key={i}>{a.message}</li>
                          ))}
                          {grouped[type].length > 8 && (
                            <li className="text-gray-500">…and {grouped[type].length - 8} more.</li>
                          )}
                        </ul>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">
                      Anomalies are surfaced, not auto-fixed. Nothing was normalized on your behalf.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-white/5 bg-white/5 px-6 py-3">
          <button onClick={onClose} className="btn-primary">Done</button>
        </div>
      </div>
    </div>
  );
};

export default ImportSummaryModal;
