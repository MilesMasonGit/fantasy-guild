import { useMemo, useState } from 'react';
import { Activity, Package, Boxes, Map as MapIcon, X, Plus, Search } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import InlineItemModal from '../shared/InlineItemModal';

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
 * ⚠️ **Inputs are always an exact item, never a tag** (CMS-43). The old column
 * had a tag-matching picker; the Token runtime has no tag-matching path at all,
 * so offering one would author something the game cannot resolve.
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
  onUpdate,
  onRemove,
  emptyHint,
}) {
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const maps = useEntityStore((s) => s.maps);
  const collections = { items, tokens, maps };

  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const nameOf = (id, type = 'item') => {
    const meta = TYPE_META[type] || TYPE_META.item;
    return collections[meta.collection]?.[id]?.name || id;
  };

  const matches = useMemo(() => {
    if (!editable || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return Object.values(items)
      .filter((i) => (i.name || '').toLowerCase().includes(q) || (i.id || '').includes(q))
      .slice(0, 6);
  }, [editable, query, items]);

  // The heart of CMS-63: a search that finds nothing is not a dead end, it is
  // the moment to create the thing you were looking for.
  const exactExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !!q && Object.values(items).some((i) => (i.name || '').toLowerCase() === q);
  }, [query, items]);

  const pick = (itemId) => {
    onAdd(itemId);
    setQuery('');
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
          <>
            {entries.length === 0 && (
              <p className="text-[11px] text-gray-600 px-2 py-3 text-center leading-relaxed">
                {emptyHint || 'Nothing yet.'}
              </p>
            )}

            {entries.map((entry, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Package size={12} style={{ color: 'var(--color-item)', flexShrink: 0 }} />
                  <button
                    onClick={() => setActiveEntity(entry.itemId, 'item')}
                    className="flex-1 text-left text-xs truncate text-gray-200 hover:text-white"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title="Open this item"
                  >
                    {nameOf(entry.itemId)}
                  </button>
                  <button
                    onClick={() => onRemove(i)}
                    className="text-gray-600 hover:text-red-400"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>

                {side === 'left' ? (
                  <NumberCell
                    label="Qty"
                    value={entry.quantity ?? 1}
                    min={1}
                    onChange={(v) => onUpdate(i, { quantity: v })}
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    <NumberCell
                      label="Min"
                      value={entry.minQty ?? 1}
                      min={0}
                      onChange={(v) => onUpdate(i, { minQty: v, maxQty: Math.max(v, entry.maxQty ?? 1) })}
                    />
                    <NumberCell
                      label="Max"
                      value={entry.maxQty ?? 1}
                      min={0}
                      onChange={(v) => onUpdate(i, { maxQty: v, minQty: Math.min(v, entry.minQty ?? 1) })}
                    />
                    <NumberCell
                      label="Chance %"
                      value={entry.chance ?? 100}
                      min={0}
                      max={100}
                      onChange={(v) => onUpdate(i, { chance: Math.max(0, Math.min(100, v)) })}
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="pt-1">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Add an item…"
                  className="w-full pl-7"
                  style={{ fontSize: 11 }}
                />
              </div>

              {query.trim() && (
                <div className="mt-1.5 space-y-1">
                  {matches.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => pick(i.id)}
                      className="w-full text-left px-2 py-1.5 rounded-md text-xs text-gray-300 hover:bg-white/5"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      {i.name}
                    </button>
                  ))}

                  {!exactExists && (
                    <button
                      onClick={() => setModalOpen(true)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold"
                      style={{
                        background: 'var(--color-accent-muted)',
                        color: 'var(--color-accent-hover)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={12} /> Create “{query.trim()}”
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <InlineItemModal
        isOpen={modalOpen}
        initialName={query.trim()}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => pick(id)}
      />
    </div>
  );
}

function NumberCell({ label, value, onChange, min, max }) {
  return (
    <label className="block">
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ fontSize: 11, padding: '3px 6px' }}
      />
    </label>
  );
}
