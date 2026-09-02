import { useSimulationStore } from '../../stores/useSimulationStore';
import { useEntityStore } from '../../stores/useEntityStore';

/**
 * The **chain inspector** (plan §15.2, phase P9) — criterion 11's
 * explainability surface, reachable from any item.
 *
 * > "Oak Wood 3g ← anchors: Oakwood Grove (L1, Medium, GPH) → Charcoal 6g =
 * > 4×3g inputs ÷ 2 + margin…"
 *
 * One sentence, then the same thing broken into its parts for anyone who wants
 * to walk it. Every named item is a link, so the trail is navigable a step at a
 * time rather than drawn as a tree — a tree of a real corpus is unreadable at
 * the third level, and the question this answers is always local: *why is
 * **this** worth **that**?*
 *
 * ⚠️ Every word of economics here comes from `engine/sim/chain.js`. This file
 * decides layout and nothing else; the moment it starts computing a value, the
 * CMS has two pricing rules.
 */
export default function ChainInspector({ itemId }) {
  const trail = useSimulationStore((s) => s.simChains[itemId]);
  const lastRun = useSimulationStore((s) => s.lastRunTimestamp);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  if (!lastRun) {
    return (
      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        Press <strong>Recalculate</strong> in the top bar and the derivation of this item's value
        appears here.
      </p>
    );
  }

  if (!trail) {
    return (
      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        The last run had nothing to say about this item — no source produces it and no Map hands
        it over, so it is not part of any chain.
      </p>
    );
  }

  const link = (id) => (
    <button
      key={id}
      onClick={() => setActiveEntity(id, 'item')}
      className="underline decoration-dotted"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent-hover, #93c5fd)' }}
    >
      {id}
    </button>
  );

  return (
    <div className="space-y-2">
      <p
        className="text-[11px] leading-relaxed font-mono rounded p-2"
        style={{ background: 'rgba(0,0,0,0.25)', color: 'var(--color-text-secondary)' }}
      >
        {trail.sentence}
      </p>

      {trail.sourceName && (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          <strong style={{ color: 'var(--color-text-primary)' }}>{trail.sourceName}</strong>
          {' '}sets this value{trail.sourceTag ? ` (${trail.sourceTag})` : ''} — {trail.reason}.
          {trail.sticky && ' Kept from a previous run; a newer source may out-rank it.'}
        </p>
      )}

      {trail.unpricedReason && (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-warning, #f59e0b)' }}>
          {trail.unpricedReason}
        </p>
      )}

      {trail.upstream.length > 0 && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold">Built out of: </span>
          {trail.upstream.map((u, i) => (
            <span key={u.itemId}>
              {i > 0 && ', '}
              {u.quantity}× {link(u.itemId)} at {u.value == null ? '—' : `${u.value}g`}
            </span>
          ))}
        </p>
      )}

      {trail.downstream.length > 0 && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold">Feeds: </span>
          {trail.downstream.map((d, i) => (
            <span key={`${d.via}|${d.itemId}`}>
              {i > 0 && ', '}
              {link(d.itemId)} ({d.value == null ? '—' : `${d.value}g`}) via {d.viaName}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
