import { HAND_CATEGORY, isConsumableCategory, isCatchKind, fishOf, lureOf, baitSavingOf } from '../../utils/constants';
import { Field } from '../shared/EditorLayout';

/**
 * An item's fishing fields (`src/config/registries/fishRules.js`):
 * - a fishing tool's **Bait saved** each catch (`tool.baitSaving`);
 * - a lure, on a Consumable: the **fish it picks** and its **chance to break** each catch (`lure`);
 * - a catch, on an item a water lands that a hero does not hold or carry: its **Fishing level**, **catch time**,
 *   **Bait** a catch spends and **XP** a catch teaches (`fish`), each left blank to take the water's own.
 * A block with nothing left in it is dropped, so an item that is no fish or lure keeps no trace.
 */
export default function FishingItemFields({ item, items = {}, landed = false, onTool, onChange }) {
  if (!item) return null;
  const isHand = item.equipSlot === HAND_CATEGORY;
  const catchTool = isHand && isCatchKind(item.tool?.kind);
  const carried = isConsumableCategory(item.equipSlot);
  // Only a fish a water lands (or one already given its terms): every ore and plank needs none.
  const catchable = !isHand && !carried && (landed || !!item.fish);

  const fish = fishOf(item) || {};
  const setFish = (key, raw) => {
    const n = Number(raw);
    const value = raw === '' || !Number.isFinite(n) || n < 0 ? undefined : key === 'cycleMs' ? Math.round(n * 1000) : Math.floor(n);
    const next = { ...(item.fish || {}), [key]: value };
    if (key === 'level' && !(value >= 1)) delete next.level;
    if (key === 'cycleMs' && !(value > 0)) delete next.cycleMs;
    if (next[key] === undefined) delete next[key];
    onChange({ fish: Object.keys(next).length ? next : undefined });
  };

  const lure = lureOf(item);
  const lureFish = lure?.fish || [];
  const setLure = (patch) => {
    const next = { fish: lureFish, ...(lure?.breakChance ? { breakChance: lure.breakChance } : {}), ...patch };
    if (!(next.breakChance > 0)) delete next.breakChance;
    onChange({ lure: next.fish.length ? next : undefined });
  };
  const catches = Object.values(items || {}).filter((i) => i?.id && i.id !== item.id && !i.equipSlot)
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));

  return (
    <>
      {catchTool && (
        <Field label="Bait saved per catch" className="col-span-1">
          <input
            type="number"
            min={0}
            aria-label="Bait saved per catch"
            data-field="tool-bait-saving"
            value={baitSavingOf(item) || ''}
            placeholder="0"
            onChange={(e) => onTool({ baitSaving: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            className="w-full"
          />
          <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
            Bait off each catch with this tool. A catch that spends any Bait never spends less than 1.
          </p>
        </Field>
      )}

      {carried && (
        <div className="col-span-2 grid grid-cols-2 gap-4" data-lure>
          <Field label="Lure: fish it picks" className="col-span-2">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {lureFish.map((id) => (
                <button
                  key={id}
                  type="button"
                  data-lure-fish={id}
                  onClick={() => setLure({ fish: lureFish.filter((f) => f !== id) })}
                  className="text-[11px] px-2 py-0.5 rounded bg-sky-900/40 border border-sky-500/30 text-sky-200"
                  title="Remove"
                >
                  {items?.[id]?.name || id} ×
                </button>
              ))}
            </div>
            <select
              aria-label="Add a fish to the lure"
              data-field="lure-add-fish"
              value=""
              onChange={(e) => e.target.value && setLure({ fish: [...lureFish, e.target.value] })}
              className="w-full"
            >
              <option value="">{lureFish.length ? 'Add another fish…' : 'Not a lure (add a fish to make it one)'}</option>
              {catches.filter((c) => !lureFish.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Carried in a Consumable cell with a rod, it picks the first of its fish the spot holds. A map holds at most one fish per lure (the audit checks).
            </p>
          </Field>
          {lure && (
            <Field label="Lure break chance (%)" className="col-span-1">
              <input
                type="number"
                min={0}
                max={100}
                aria-label="Lure break chance"
                data-field="lure-break-chance"
                value={lure.breakChance || ''}
                placeholder="0"
                onChange={(e) => setLure({ breakChance: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                className="w-full"
              />
            </Field>
          )}
        </div>
      )}

      {catchable && (
        <div className="col-span-2 grid grid-cols-4 gap-4" data-fish>
          <Field label="Catch: Fishing level" className="col-span-1">
            <input type="number" min={1} aria-label="Catch Fishing level" data-field="fish-level"
              value={fish.level ?? ''} placeholder="water's" onChange={(e) => setFish('level', e.target.value)} className="w-full" />
          </Field>
          <Field label="Catch time (s)" className="col-span-1">
            <input type="number" min={0} step="0.1" aria-label="Catch time" data-field="fish-cycle"
              value={fish.cycleMs ? fish.cycleMs / 1000 : ''} placeholder="water's" onChange={(e) => setFish('cycleMs', e.target.value)} className="w-full" />
          </Field>
          <Field label="Bait a catch" className="col-span-1">
            <input type="number" min={0} aria-label="Bait a catch" data-field="fish-bait"
              value={fish.bait ?? ''} placeholder="1" onChange={(e) => setFish('bait', e.target.value)} className="w-full" />
          </Field>
          <Field label="XP a catch" className="col-span-1">
            <input type="number" min={0} aria-label="XP a catch" data-field="fish-xp"
              value={fish.xp ?? ''} placeholder="spot's" onChange={(e) => setFish('xp', e.target.value)} className="w-full" />
          </Field>
          <p className="col-span-4 text-[10px] text-gray-600 -mt-2 leading-relaxed">
            Only for a fish a water lands. Blank takes the water's own level, time and XP, and 1 Bait. With no lure a hero's catch takes the longest time of the fish they may land.
          </p>
        </div>
      )}
    </>
  );
}
