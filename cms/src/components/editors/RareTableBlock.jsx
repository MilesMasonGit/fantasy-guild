import { useMemo } from 'react';
import { Gem, Plus, X } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { NumberCell } from '../shared/IOEntryList';

/**
 * A Token's rare drop table (`rareTable: { chance, entries: [{ itemId, weight, minQty, maxQty }] }`):
 * one chance a cycle (or a kill), and on a hit one entry picked by weight, which drops like any
 * output after the Token's own lines. Lucky raises the chance. Any Token with drops may carry one:
 * a vein, a tree, a station, water, an enemy. The game's reader is
 * `src/config/registries/rareTables.js`.
 *
 * Written only while it has an entry: removing the last drops the key, so every other Token's record
 * stays byte-identical. A new table starts at 1 %.
 */

const NEW_CHANCE = 1;
const NEW_ENTRY = Object.freeze({ itemId: '', weight: 10, minQty: 1, maxQty: 1 });

/** A share of the table's hits, or a chance, as the author reads it: `75%`, `0.25%`. */
function percent(value) {
  const v = Number(value);
  if (!(v > 0)) return '—';
  return `${v >= 1 ? Math.round(v * 10) / 10 : Number(v.toPrecision(2))}%`;
}

export default function RareTableBlock({ token, onPatch }) {
  const items = useEntityStore((s) => s.items);
  const table = token?.rareTable && typeof token.rareTable === 'object' ? token.rareTable : null;
  const entries = Array.isArray(table?.entries) ? table.entries : [];
  const chance = Number(table?.chance) || 0;
  const total = entries.reduce((sum, e) => sum + (Number(e.weight) > 0 ? Number(e.weight) : 0), 0);

  const itemList = useMemo(
    () => Object.values(items || {}).filter((i) => i?.id).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [items]
  );

  const write = (next) => onPatch({ rareTable: next.entries.length ? next : undefined });
  const setEntry = (i, patch) => write({ ...table, entries: entries.map((e, k) => (k === i ? { ...e, ...patch } : e)) });

  return (
    <Section title="Rare drop table" icon={<Gem size={14} />}>
      <div data-field="rare-table" className="space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          A chance each cycle (or each kill of an enemy) to roll this table; on a hit one find, picked
          by weight, drops like any output, after the Token&apos;s own. Double Loot and Double Item work
          on it, a failed cycle rolls nothing, and Lucky raises the chance.
        </p>

        {table && (
          <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-end gap-3">
              <div className="w-32" data-rare-chance>
                <NumberCell
                  label="Chance %"
                  value={table.chance ?? ''}
                  min={0}
                  max={100}
                  step={0.1}
                  onChange={(v) => write({ ...table, chance: Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)) })}
                />
              </div>
              <p className="flex-1 text-[10px] text-gray-600 leading-relaxed">
                Percent a cycle rolls it; decimals allowed (0.5 is one cycle in two hundred).
                {!(chance > 0) && <span className="text-amber-400"> At 0 the table never rolls.</span>}
              </p>
            </div>

            {entries.map((e, i) => {
              const known = !e.itemId || items?.[e.itemId];
              const share = total > 0 && Number(e.weight) > 0 ? Number(e.weight) / total : 0;
              return (
                <div key={i} data-rare-index={i} className="flex items-end gap-2">
                  <label className="flex-1 min-w-0 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">Find</span>
                    <select
                      aria-label="Find"
                      data-rare-item
                      value={e.itemId || ''}
                      onChange={(ev) => setEntry(i, { itemId: ev.target.value })}
                      className="w-full"
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Choose an item</option>
                      {!known && <option value={e.itemId}>{e.itemId} (missing)</option>}
                      {itemList.map((it) => <option key={it.id} value={it.id}>{it.name || it.id}</option>)}
                    </select>
                  </label>
                  <div className="w-16" data-rare-weight>
                    <NumberCell label="Weight" value={e.weight ?? ''} min={0} onChange={(v) => setEntry(i, { weight: Math.max(0, Number.isFinite(v) ? v : 0) })} />
                  </div>
                  <div className="w-14" data-rare-min>
                    <NumberCell label="Min" value={e.minQty ?? 1} min={0} onChange={(v) => setEntry(i, { minQty: v, maxQty: Math.max(v, e.maxQty ?? 1) })} />
                  </div>
                  <div className="w-14" data-rare-max>
                    <NumberCell label="Max" value={e.maxQty ?? 1} min={0} onChange={(v) => setEntry(i, { maxQty: v, minQty: Math.min(v, e.minQty ?? 1) })} />
                  </div>
                  <span data-rare-share title="Its share of the table's hits" className="w-12 text-right text-[11px] text-gray-400 pb-1">{percent(share * 100)}</span>
                  <span data-rare-odds title="Its chance a cycle, before Lucky" className="w-14 text-right text-[11px] text-gray-300 pb-1">{percent(chance * share)}</span>
                  <button
                    type="button"
                    data-remove-rare
                    title="Remove this find"
                    onClick={() => write({ ...table, entries: entries.filter((_, k) => k !== i) })}
                    className="text-gray-500 hover:text-red-400 pb-1.5"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            <p className="text-[10px] text-gray-600 leading-relaxed">
              Weights are shares of the table: 3 and 1 read as 75 % and 25 % of its hits. The last
              column is each find&apos;s chance a cycle, before Lucky.
            </p>
          </div>
        )}

        <button
          type="button"
          data-add-rare
          onClick={() => write(table ? { ...table, entries: [...entries, { ...NEW_ENTRY }] } : { chance: NEW_CHANCE, entries: [{ ...NEW_ENTRY }] })}
          className="btn-ghost text-xs flex items-center gap-1"
          style={{ padding: '4px 10px' }}
        >
          <Plus size={12} /> Add a rare find
        </button>
      </div>
    </Section>
  );
}
