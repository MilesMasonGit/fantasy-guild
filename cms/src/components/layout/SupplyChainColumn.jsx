import { Activity, Package, Boxes, Map as MapIcon } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import IOEntryList from '../shared/IOEntryList';

/**
 * One side column: what feeds the selected entity, or what it feeds.
 *
 * Two modes:
 *
 * * **Reference** (Items) — a read-only, clickable list of the Tokens and Maps
 *   on either side of this item. That is the dependency check CMS-9's backward
 *   chaining needs: is this ingredient actually reachable?
 * * **Editable** (Tokens) — CMS-59's literal Inputs and Outputs, authored here
 *   rather than in the middle of the screen, so the centre stays free for the
 *   effect blocks Phase 5 adds.
 *
 * The editable half is `IOEntryList`, which the Recipe editor renders too
 * (rework P6b). This file is the column chrome around it.
 */
const TYPE_META = {
  item: { icon: Package, collection: 'items', color: 'var(--color-item)' },
  token: { icon: Boxes, collection: 'tokens', color: 'var(--color-accent)' },
  map: { icon: MapIcon, collection: 'maps', color: 'var(--color-area)' },
};

export default function SupplyChainColumn({
  title,
  side,
  entities = [],
  editable = false,
  entries = [],
  onAdd,
  onAddCurrency,
  onUpdate,
  onRemove,
  emptyHint,
}) {
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const maps = useEntityStore((s) => s.maps);
  const collections = { items, tokens, maps };

  const nameOf = (id, type = 'item') => {
    const meta = TYPE_META[type] || TYPE_META.item;
    return collections[meta.collection]?.[id]?.name || id;
  };

  return (
    <div className="flex flex-col h-full bg-[#16161a] border-x border-white/5 w-80 shrink-0 overflow-hidden">
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          {side === 'left' ? <Activity size={12} className="rotate-180" /> : <Activity size={12} />}
          {title}
        </h3>
        {(editable ? entries.length : entities.length) > 0 && (
          <span className="text-[10px] font-bold text-gray-600">
            {editable ? entries.length : entities.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {!editable && (
          entities.length === 0 ? (
            <p className="text-[11px] text-gray-600 px-2 py-4 text-center leading-relaxed">
              {emptyHint || 'Nothing yet.'}
            </p>
          ) : (
            entities.map((entry) => {
              const meta = TYPE_META[entry.type] || TYPE_META.item;
              const Icon = meta.icon;
              return (
                <button
                  key={`${entry.type}:${entry.id}`}
                  onClick={() => setActiveEntity(entry.id, entry.type)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors hover:bg-white/5"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <Icon size={13} style={{ color: meta.color, flexShrink: 0 }} />
                  <span className="flex-1 text-xs truncate text-gray-300">{nameOf(entry.id, entry.type)}</span>
                  <span className="text-[9px] uppercase tracking-wide text-gray-600">{entry.type}</span>
                </button>
              );
            })
          )
        )}

        {editable && (
          <IOEntryList
            entries={entries}
            kind={side === 'left' ? 'input' : 'output'}
            emptyHint={emptyHint}
            onAdd={onAdd}
            onAddCurrency={onAddCurrency}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        )}
      </div>
    </div>
  );
}
