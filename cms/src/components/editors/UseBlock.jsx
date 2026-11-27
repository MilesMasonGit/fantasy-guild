import { useMemo } from 'react';
import { PackageOpen, Plus, X } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { NumberCell } from '../shared/IOEntryList';
import { itemUseProblem } from '../../utils/constants';

/**
 * An item's Use (`use: { drops: [{ itemId, chance, minQty, maxQty }] }`): in the game's Bank, using
 * copies pays these drops at once, into the Bank, with no hero, station or time. Each copy rolls
 * every line as a work cycle rolls its outputs: its chance, then an amount from Min to Max. The
 * game's reader is `src/config/registries/itemUse.js`, its action `src/systems/inventory/ItemUse.js`.
 *
 * Written only while it has a drop: removing the last drops the key, so every other item's record
 * stays byte-identical. A new drop is sure (100 %), one of an item.
 */

const NEW_DROP = Object.freeze({ itemId: '', chance: 100, minQty: 1, maxQty: 1 });

/** What one copy gives of a line on average, as the author reads it: `1.5`, `0.25`. */
function perCopy(line) {
  const chance = Math.max(0, Math.min(100, Number(line.chance ?? 100))) / 100;
  const avg = ((Number(line.minQty ?? 1) || 0) + (Number(line.maxQty ?? 1) || 0)) / 2;
  const n = chance * avg;
  return n > 0 ? String(Number(n.toPrecision(3))) : '—';
}

export default function UseBlock({ item, onPatch }) {
  const items = useEntityStore((s) => s.items);
  const drops = Array.isArray(item?.use?.drops) ? item.use.drops : [];
  const problem = itemUseProblem(item);

  const itemList = useMemo(
    () => Object.values(items || {}).filter((i) => i?.id && i.id !== item?.id).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [items, item?.id]
  );

  const write = (next) => onPatch({ use: next.length ? { ...(item.use || {}), drops: next } : undefined });
  const setDrop = (i, patch) => write(drops.map((d, k) => (k === i ? { ...d, ...patch } : d)));

  return (
    <Section title="Use" icon={<PackageOpen size={14} />}>
      <div data-field="use" className="space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Used from the Bank (the Item drawer&apos;s Use, 1, 50 %, All -1, All or a slider), each copy pays
          these drops at once, straight into the Bank, with no hero, station or time. Every line rolls
          for every copy: its chance, then an amount from Min to Max. What a full Bank has no room for
          waits on the mat as loot. Blank: the item has no Use.
        </p>

        {drops.length > 0 && (
          <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {drops.map((d, i) => {
              const known = !d.itemId || items?.[d.itemId];
              return (
                <div key={i} data-use-index={i} className="flex items-end gap-2">
                  <label className="flex-1 min-w-0 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">Gives</span>
                    <select
                      aria-label="Gives"
                      data-use-item
                      value={d.itemId || ''}
                      onChange={(ev) => setDrop(i, { itemId: ev.target.value })}
                      className="w-full"
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Choose an item</option>
                      {!known && <option value={d.itemId}>{d.itemId} (missing)</option>}
                      {itemList.map((it) => <option key={it.id} value={it.id}>{it.name || it.id}</option>)}
                    </select>
                  </label>
                  <div className="w-16" data-use-chance>
                    <NumberCell label="Chance %" value={d.chance ?? 100} min={0} max={100} step={0.1} onChange={(v) => setDrop(i, { chance: Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)) })} />
                  </div>
                  <div className="w-14" data-use-min>
                    <NumberCell label="Min" value={d.minQty ?? 1} min={0} onChange={(v) => setDrop(i, { minQty: v, maxQty: Math.max(v, d.maxQty ?? 1) })} />
                  </div>
                  <div className="w-14" data-use-max>
                    <NumberCell label="Max" value={d.maxQty ?? 1} min={0} onChange={(v) => setDrop(i, { maxQty: v, minQty: Math.min(v, d.minQty ?? 1) })} />
                  </div>
                  <span data-use-per-copy title="What one copy gives of it on average" className="w-12 text-right text-[11px] text-gray-300 pb-1">{perCopy(d)}</span>
                  <button
                    type="button"
                    data-remove-use
                    title="Remove this drop"
                    onClick={() => write(drops.filter((_, k) => k !== i))}
                    className="text-gray-500 hover:text-red-400 pb-1.5"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <p className="text-[10px] text-gray-600 leading-relaxed">
              The last column is what one copy gives of it on average. The ledger and the Encyclopedia
              read the Use as a way to get each drop.
            </p>
          </div>
        )}

        {problem && (
          <p data-use-problem className="text-[11px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
            {problem.charAt(0).toUpperCase() + problem.slice(1)}.
          </p>
        )}

        <button
          type="button"
          data-add-use
          onClick={() => write([...drops, { ...NEW_DROP }])}
          className="btn-ghost text-xs flex items-center gap-1"
          style={{ padding: '4px 10px' }}
        >
          <Plus size={12} /> Add a drop
        </button>
      </div>
    </Section>
  );
}
