import { useMemo, useState } from 'react';
import { Package, Boxes, X, Plus, Search, Coins } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { OUTPUT_CURRENCIES } from '../../../../src/config/registries/tokenConstants.js';
import InlineItemModal from './InlineItemModal';

/**
 * **The** Input / Output list.
 *
 * The rows, the number cells and the search-or-create picker that the Token
 * editor's supply-chain columns have used since CMS-59, lifted out so the
 * Recipe editor renders the identical control instead of a second, shallower
 * copy of it (rework P6b, concept §4.1). `SupplyChainColumn` supplies the
 * column chrome around it and nothing else.
 *
 * Three kinds of entry live in one list, told apart by which id field they
 * carry — the same test `BoardRunner`'s output loop makes:
 *
 * * `itemId` — an item. Inputs are always this shape.
 * * `currency` — a payout (D-141). Outputs only.
 * * `tokenId` — a Token dropped on the floor (P5). Outputs only.
 *
 * ⚠️ **Inputs are always an exact item, never a tag** (CMS-43, R-17). Tools and
 * context are a separate axis with their own tier hierarchy; they are not
 * materials and are not authored here.
 */
export default function IOEntryList({
  entries = [],
  kind = 'input',
  onAdd,
  onAddCurrency,
  onAddToken,
  onUpdate,
  onRemove,
  emptyHint,
}) {
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);

  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const isOutput = kind === 'output';

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.values(items)
      .filter((i) => (i.name || '').toLowerCase().includes(q) || (i.id || '').includes(q))
      .slice(0, 6);
  }, [query, items]);

  const tokenMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !onAddToken) return [];
    return Object.values(tokens)
      .filter((t) => (t.name || '').toLowerCase().includes(q) || (t.id || '').includes(q))
      .slice(0, 6);
  }, [query, tokens, onAddToken]);

  // A search that finds nothing is not a dead end, it is the moment to create
  // the thing you were looking for (CMS-63).
  const exactExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !!q && Object.values(items).some((i) => (i.name || '').toLowerCase() === q);
  }, [query, items]);

  const pick = (itemId) => {
    onAdd(itemId);
    setQuery('');
  };

  const pickToken = (tokenId) => {
    onAddToken(tokenId);
    setQuery('');
  };

  return (
    <div className="space-y-1.5">
      {entries.length === 0 && (
        <p className="text-[11px] text-gray-600 px-2 py-3 text-center leading-relaxed">
          {emptyHint || 'Nothing yet.'}
        </p>
      )}

      {entries.map((entry, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-2">
          <div className="flex items-center gap-1.5">
            {/*
              A currency payout is not an item — no id to open, no sprite and no
              Bank slot — so it gets a coin and a plain label. A Token drop has
              an id, and it opens the Token editor rather than the Item editor.
            */}
            {entry.currency ? (
              <>
                <Coins size={12} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                <span className="flex-1 text-xs truncate text-amber-200">
                  {currencyLabel(entry.currency)}
                </span>
              </>
            ) : entry.tokenId ? (
              <>
                <Boxes size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <button
                  onClick={() => setActiveEntity(entry.tokenId, 'token')}
                  className="flex-1 text-left text-xs truncate text-gray-200 hover:text-white"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  title="Open this Token"
                >
                  {tokens[entry.tokenId]?.name || entry.tokenId}
                </button>
              </>
            ) : (
              <>
                <Package size={12} style={{ color: 'var(--color-item)', flexShrink: 0 }} />
                <button
                  onClick={() => setActiveEntity(entry.itemId, 'item')}
                  className="flex-1 text-left text-xs truncate text-gray-200 hover:text-white"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  title="Open this item"
                >
                  {items[entry.itemId]?.name || entry.itemId}
                </button>
              </>
            )}
            <button
              onClick={() => onRemove(i)}
              className="text-gray-600 hover:text-red-400"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              title="Remove"
            >
              <X size={12} />
            </button>
          </div>

          {!isOutput ? (
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
            placeholder={onAddToken ? 'Add an item or Token…' : 'Add an item…'}
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
                className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded-md text-xs text-gray-300 hover:bg-white/5"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <Package size={11} style={{ color: 'var(--color-item)', flexShrink: 0 }} />
                {i.name}
              </button>
            ))}

            {tokenMatches.map((t) => (
              <button
                key={t.id}
                onClick={() => pickToken(t.id)}
                className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded-md text-xs text-gray-300 hover:bg-white/5"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                title="Drop this Token on the floor when the recipe completes"
              >
                <Boxes size={11} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                {t.name}
                <span className="ml-auto text-[9px] uppercase tracking-wide text-gray-600">token</span>
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

        {/*
          What makes a Market a Market (D-141). Its own button rather than a
          toggle on an item row, because a payout has no item to pick first —
          the search box above would have nothing to find.
        */}
        {onAddCurrency && (
          <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
            {OUTPUT_CURRENCIES.map((c) => (
              <button
                key={c.id}
                onClick={() => onAddCurrency(c.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-bold"
                style={{
                  background: 'rgba(255,180,0,0.10)',
                  color: 'var(--color-warning)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="Pay out currency instead of an item — this is what makes a Market"
              >
                <Coins size={12} /> Pays {c.label}
              </button>
            ))}
          </div>
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

/** A currency id in the words the game declares for it. */
function currencyLabel(id) {
  return OUTPUT_CURRENCIES.find((c) => c.id === id)?.label || id;
}

export function NumberCell({ label, value, onChange, min, max, step }) {
  return (
    <label className="block">
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ fontSize: 11, padding: '3px 6px' }}
      />
    </label>
  );
}
