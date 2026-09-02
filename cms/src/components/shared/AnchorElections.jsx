import { useState } from 'react';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { useGlobalStore } from '../../stores/useGlobalStore';

/**
 * **Sticky-anchor re-election** (plan §3.2, phase P9) — the one click that
 * accepts a new anchor, and the one that waves it away.
 *
 * ## What this card is for
 *
 * An item's value is set by exactly one source, and that election is *sticky*:
 * once an item has an anchor it keeps it, even when a newly authored source
 * would now out-rank it. That rule is criterion 6 — *adding one Token must not
 * silently re-price half the game* — and without a way to accept the new
 * candidate it would also be a one-way door: the better anchor could never win
 * without someone hand-editing a derived field.
 *
 * So the simulator files an Info row naming both sources, and this card turns it
 * into two buttons:
 *
 * - **Re-elect** — writes the new election through the normal write path
 *   (`valueSource`, then a full Recalculate) and reports the churn it caused,
 *   because the whole reason the election is sticky is that re-pricing a chain
 *   is a real event. Accepting it silently would be the same failure with the
 *   default flipped.
 * - **Dismiss** — hides the prompt for this session. Keyed by the *candidate*,
 *   so tomorrow's better source asks again.
 *
 * ⚠️ **This path was fixture-proven for the whole rework.** No shipped item
 * carried a `valueSource` until the P5 cutover wrote one, so until then the row
 * this card is built on could not appear on real content at all.
 */
export default function AnchorElections() {
  const rows = useSimulationStore((s) => s.simRows);
  const dismissed = useSimulationStore((s) => s.dismissedElections);
  const dismissElection = useSimulationStore((s) => s.dismissElection);
  const reElectAnchor = useEntityStore((s) => s.reElectAnchor);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const globals = useGlobalStore();

  // The churn of the last acceptance, so the click reports what it cost.
  const [lastChurn, setLastChurn] = useState(null);

  const pending = (rows || [])
    .filter((r) => r.code === 'anchor-candidate-changed' && r.itemId && r.detail?.wouldElect)
    .filter((r) => !dismissed[`${r.itemId}|${r.detail.wouldElect}`]);

  if (pending.length === 0 && !lastChurn) return null;

  const handleReElect = (row) => {
    const churn = reElectAnchor(row.itemId, row.detail.wouldElect, globals);
    setLastChurn(churn ? { itemId: row.itemId, churn } : null);
  };

  return (
    <div
      className="rounded-lg border p-3 mb-4"
      style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}
    >
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>
        Anchor elections — a better source is available
      </h3>

      {pending.length > 0 && (
        <p className="text-[10px] mb-2 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Each item keeps the anchor it already has until you say otherwise, so that adding one
          Token cannot silently re-price a chain. Re-electing re-runs the whole line and reports
          what moved.
        </p>
      )}

      <div className="space-y-2">
        {pending.map((row) => (
          <div
            key={`${row.itemId}|${row.detail.wouldElect}`}
            className="flex items-start gap-3 text-[11px] leading-relaxed"
          >
            <div className="flex-1">
              <button
                onClick={() => setActiveEntity(row.itemId, 'item')}
                className="font-semibold underline decoration-dotted"
                style={{ color: 'var(--color-text-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                {row.itemId}
              </button>
              <span style={{ color: 'var(--color-text-secondary)' }}> — {row.what}</span>
              <span className="block text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                keeping {row.detail.kept}
              </span>
            </div>
            <button
              onClick={() => handleReElect(row)}
              className="px-2 py-1 rounded text-[10px] font-bold shrink-0"
              style={{ background: 'var(--color-accent)', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              Re-elect
            </button>
            <button
              onClick={() => dismissElection(`${row.itemId}|${row.detail.wouldElect}`)}
              className="px-2 py-1 rounded text-[10px] shrink-0"
              style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>

      {lastChurn && (
        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--color-success, #10b981)' }}>
          Re-elected {lastChurn.itemId}: {lastChurn.churn.valuesChanged} value
          {lastChurn.churn.valuesChanged === 1 ? '' : 's'} moved
          {lastChurn.churn.largestMovers.length > 0 && (
            <>
              {' — '}
              {lastChurn.churn.largestMovers
                .map((m) => `${m.itemId} ${m.from ?? '—'}g → ${m.to ?? '—'}g`)
                .join(', ')}
            </>
          )}
          .
        </p>
      )}
    </div>
  );
}
