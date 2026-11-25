import { useMemo } from 'react';
import { Plus, X, VenetianMask } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { NumberCell } from '../shared/IOEntryList';
import RareTableBlock from './RareTableBlock';
import { crimeLevelOf } from '../../utils/constants';

/**
 * An enemy's **steal table** (`steal: { crimeLevel, xp, outputs, rareTable }`): what a thief at a
 * Hideout takes from its camp each theft, beside the enemy's fight drops. Lines roll as drops do
 * (each at its chance); the rare table after them, which a Lucky Hideout raises. `crimeLevel` is the
 * camp's Crime level a thief's is measured against (missing: the enemy's level); `xp` a theft's Crime
 * XP (missing: the Hideout's). The game's reader is `src/config/registries/crime.js`.
 *
 * Written only while it holds a line or a rare find: removing the last drops the key, so every other
 * Token's record stays byte-identical. A boss's table is never rolled: bosses are never robbed.
 */

const NEW_LINE = Object.freeze({ itemId: '', chance: 100, minQty: 1, maxQty: 1 });

/** The block without an empty part, or undefined when nothing is left in it. */
function tidy(next) {
  const out = { ...next };
  if (!Array.isArray(out.outputs) || !out.outputs.length) delete out.outputs;
  if (!out.rareTable) delete out.rareTable;
  if (out.crimeLevel == null || out.crimeLevel === '') delete out.crimeLevel;
  if (out.xp == null || out.xp === '') delete out.xp;
  return out.outputs || out.rareTable ? out : undefined;
}

export default function StealTableBlock({ token, onPatch }) {
  const items = useEntityStore((s) => s.items);
  const steal = token?.steal && typeof token.steal === 'object' ? token.steal : null;
  const lines = Array.isArray(steal?.outputs) ? steal.outputs : [];
  const itemList = useMemo(
    () => Object.values(items || {}).filter((i) => i?.id).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [items]
  );

  const write = (next) => onPatch({ steal: tidy(next) });
  const setLine = (i, patch) => write({ ...steal, outputs: lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const enemyLevel = Number(token?.enemy?.level) || 1;

  return (
    <Section title="Steal table (Crime)" icon={<VenetianMask size={14} />}>
      <div data-field="steal-table" className="space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          What a thief at a Hideout takes from this enemy&apos;s camp each theft, in place of a fight:
          what the enemy keeps (its stores and hoard), never its body parts. The enemy stays where it
          stands. Each line rolls at its chance, then the rare finds; a Lucky Hideout raises their
          chance. A thief caught takes nothing and puts a guard on the camp. Bosses are never robbed, so
          a boss&apos;s table does nothing.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div data-steal-crime-level>
            <NumberCell
              label="Crime level"
              value={steal?.crimeLevel ?? ''}
              min={1}
              onChange={(v) => write({ ...(steal || {}), crimeLevel: Number.isFinite(v) && v >= 1 ? v : undefined })}
            />
            <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
              The camp&apos;s level a thief&apos;s Crime is measured against: caught often below it, rarely
              above. Empty: the enemy&apos;s level ({enemyLevel}). Now {steal ? crimeLevelOf(token) : enemyLevel}.
            </p>
          </div>
          <div data-steal-xp>
            <NumberCell
              label="Crime XP a theft"
              value={steal?.xp ?? ''}
              min={0}
              onChange={(v) => write({ ...(steal || {}), xp: Number.isFinite(v) && v >= 0 ? v : undefined })}
            />
            <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
              Empty: the Hideout&apos;s own XP per cycle. A caught thief learns nothing.
            </p>
          </div>
        </div>

        {lines.map((l, i) => {
          const known = !l.itemId || items?.[l.itemId];
          return (
            <div key={i} data-steal-index={i} className="flex items-end gap-2">
              <label className="flex-1 min-w-0 block">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">Steals</span>
                <select
                  aria-label="Steals"
                  data-steal-item
                  value={l.itemId || ''}
                  onChange={(ev) => setLine(i, { itemId: ev.target.value })}
                  className="w-full"
                  style={{ fontSize: 12 }}
                >
                  <option value="">Choose an item</option>
                  {!known && <option value={l.itemId}>{l.itemId} (missing)</option>}
                  {itemList.map((it) => <option key={it.id} value={it.id}>{it.name || it.id}</option>)}
                </select>
              </label>
              <div className="w-20" data-steal-chance>
                <NumberCell label="Chance %" value={l.chance ?? 100} min={0} max={100} step={0.1} onChange={(v) => setLine(i, { chance: Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)) })} />
              </div>
              <div className="w-14" data-steal-min>
                <NumberCell label="Min" value={l.minQty ?? 1} min={0} onChange={(v) => setLine(i, { minQty: v, maxQty: Math.max(v, l.maxQty ?? 1) })} />
              </div>
              <div className="w-14" data-steal-max>
                <NumberCell label="Max" value={l.maxQty ?? 1} min={0} onChange={(v) => setLine(i, { maxQty: v, minQty: Math.min(v, l.minQty ?? 1) })} />
              </div>
              <button
                type="button"
                data-remove-steal
                title="Remove this line"
                onClick={() => write({ ...steal, outputs: lines.filter((_, k) => k !== i) })}
                className="text-gray-500 hover:text-red-400 pb-1.5"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          data-add-steal
          onClick={() => write({ ...(steal || {}), outputs: [...lines, { ...NEW_LINE }] })}
          className="btn-ghost text-xs flex items-center gap-1"
          style={{ padding: '4px 10px' }}
        >
          <Plus size={12} /> Add a stolen item
        </button>

        <RareTableBlock
          token={{ rareTable: steal?.rareTable }}
          title="Steal table: rare finds"
          dataField="steal-rare-table"
          onPatch={({ rareTable }) => write({ ...(steal || {}), rareTable })}
        />
      </div>
    </Section>
  );
}
