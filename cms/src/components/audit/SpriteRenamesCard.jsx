import { useMemo, useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { pendingSpriteRenames } from '../../engine/spriteRenames';

/**
 * "Apply art renames": the art was renamed (docs/reference/ASSET_NAMING.md), and the workspace's
 * sprite fields may still hold the old names. Lists them and rewrites them on one click; Sync to
 * Game then writes them to `data/`.
 */
export default function SpriteRenamesCard() {
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const applySpriteRenames = useEntityStore((s) => s.applySpriteRenames);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const [applied, setApplied] = useState(null);

  const pending = useMemo(() => pendingSpriteRenames({ items, tokens }), [items, tokens]);
  const inItems = pending.filter((r) => r.collection === 'items').length;
  const inTokens = pending.filter((r) => r.collection === 'tokens').length;

  const apply = () => setApplied(applySpriteRenames());

  return (
    <div data-sprite-renames className="flex flex-col gap-3 p-5 rounded-xl border bg-black/10" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <div className="flex items-center justify-between gap-3 pb-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <RefreshCw size={16} style={{ color: 'var(--color-accent)' }} />
          Art renames
        </h3>
        <button
          type="button"
          onClick={apply}
          disabled={pending.length === 0}
          className="px-3 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-40"
          style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: pending.length ? 'pointer' : 'default' }}
        >
          Apply renames
        </button>
      </div>

      {pending.length === 0 ? (
        <p data-sprite-renames-status className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
          <Check size={13} />
          {applied ? `Renamed ${applied} sprite name${applied === 1 ? '' : 's'}. Now press Sync to Game.` : 'Every sprite name is current. Nothing to rename.'}
        </p>
      ) : (
        <>
          <p data-sprite-renames-status className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {pending.length} sprite name{pending.length === 1 ? '' : 's'} from before the art was renamed:
            {' '}{inItems} in items, {inTokens} in Tokens. Apply renames changes them here; Sync to Game then writes them to the game.
          </p>
          <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1 pr-1">
            {pending.map((r) => (
              <div key={`${r.collection}:${r.id}:${r.field}`} className="flex items-center gap-2 text-[11px] font-mono">
                <span
                  className="font-sans font-semibold cursor-pointer hover:underline"
                  style={{ color: 'var(--color-text-primary)' }}
                  onClick={() => setActiveEntity(r.id, r.collection === 'items' ? 'item' : 'token')}
                >
                  {r.name}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{r.from}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{r.to}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
