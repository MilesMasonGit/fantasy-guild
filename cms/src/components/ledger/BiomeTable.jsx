import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { useEntityStore } from '../../stores/useEntityStore';
import { workspaceWorldFrom } from '../../engine/worldTables';
import { BIOMES, WATER_SHAPES, BIOME_TERRAIN_DEFAULTS, biomeRowOf } from '../../../../src/config/biomeTerrain.js';
import { MAX_WATER_SHARE } from '../../../../src/systems/atlas/TerrainMap.js';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const card = 'rounded-xl border bg-[#1a1a1e] border-white/10 p-4';

const BIOME_NAME = {
  meadow: 'Meadow', flower_meadow: 'Flower meadow', forest: 'Forest', cherry_grove: 'Cherry grove', mountain: 'Mountain',
  yellowstone: 'Yellowstone', volcano: 'Volcano', coast: 'Coast', bog: 'Bog',
};
const SHAPE_NAME = {
  lake: 'Lake', lake_river: 'Lake and river', river: 'River', split: 'Split river', spring: 'Spring and river',
  mountain_river: 'Mountain river', pond: 'Pond', tarn: 'Tarn', sulphur: 'Sulphur springs', marsh: 'Marsh',
};
const MAX_SEA_PERCENT = Math.round(MAX_WATER_SHARE * 100);
const MAX_STONE = 30;

/** A shape list as `[shape, count]` in the order each shape first appears. */
function counted(list) {
  const out = new Map();
  for (const k of list) out.set(k, (out.get(k) || 0) + 1);
  return [...out];
}

/** The list without the last of `shape`, so every other shape keeps its place in the roll. */
function withoutOne(list, shape) {
  const at = list.lastIndexOf(shape);
  return at < 0 ? list : [...list.slice(0, at), ...list.slice(at + 1)];
}

const percentOf = (share) => Math.round(share * 1000) / 10;

/**
 * A number typed in and kept on Enter or on leaving the box; anything not a number goes back.
 * Keyed by its value where it is used, so a value changed elsewhere starts it afresh.
 */
export function NumberBox({ value, min, max, step = 1, label, onCommit, disabled }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, step === 1 ? Math.round(n) : n));
    if (clamped !== value) onCommit(clamped);
    else setText(String(value));
  };
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={text}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      style={{ width: 56, padding: '3px 6px', fontSize: 11 }}
    />
  );
}

/** A `[least, most]` pair: moving one past the other moves the other with it. */
function RangeBoxes({ range, min, max, step, label, onChange, disabled, toShown = (v) => v, fromShown = (v) => v }) {
  const [lo, hi] = range.map(toShown);
  return (
    <span className="flex items-center gap-1">
      <NumberBox key={`lo${lo}`} value={lo} min={min} max={max} step={step} label={`${label}, least`} disabled={disabled}
        onCommit={(v) => onChange([fromShown(v), fromShown(Math.max(v, hi))])} />
      <span className="text-gray-500">–</span>
      <NumberBox key={`hi${hi}`} value={hi} min={min} max={max} step={step} label={`${label}, most`} disabled={disabled}
        onCommit={(v) => onChange([fromShown(Math.min(v, lo)), fromShown(v)])} />
    </span>
  );
}

/**
 * The biome table: each biome's inland water shapes, its sea's share and its Stone patches, the
 * ranges every new place of that biome rolls within (`src/config/biomeTerrain.js`). Grass is what
 * is left. Edits land in the workspace's world tables and reach the game with Sync.
 */
export default function BiomeTable() {
  const worldRecord = useEntityStore((s) => s.world);
  const setBiomeRow = useEntityStore((s) => s.setBiomeRow);
  const world = workspaceWorldFrom(worldRecord);
  const editable = !!worldRecord;
  const rowOf = (biome) => biomeRowOf(world?.biomes?.[biome], BIOME_TERRAIN_DEFAULTS[biome]);
  const write = (biome, patch) => setBiomeRow(biome, { ...rowOf(biome), ...patch });

  return (
    <section className={`${card} space-y-2`} aria-label="Biome terrain">
      <h3 className={sectionHead}>Biome terrain</h3>
      <p className="text-[10px] text-gray-500">
        What ground each biome brings to a new place: the inland water shapes it can roll (one picked per place; a shape listed twice
        comes twice as often), how much of the mat its sea takes, and how many Stone patches it has. Grass is what is left. Each new
        place rolls every range once from its own seed; a range of one number gives exactly that. A wild place&apos;s odd layout still
        adds its own water or Stone on top.
      </p>
      {!editable && (
        <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
          This workspace holds no world tables, so the table shows the game&apos;s built-in rows and cannot be edited here.
        </p>
      )}
      <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="text-left text-gray-400">
            <th style={{ padding: '4px 6px', width: 120 }}>Biome</th>
            <th style={{ padding: '4px 6px' }}>Inland water shapes</th>
            <th style={{ padding: '4px 6px', width: 150 }}>Sea, % of the mat</th>
            <th style={{ padding: '4px 6px', width: 150 }}>Stone patches</th>
          </tr>
        </thead>
        <tbody>
          {BIOMES.map((biome) => {
            const row = rowOf(biome);
            return (
              <tr key={biome} data-biome-row={biome} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: '4px 6px' }} className="font-bold">{BIOME_NAME[biome] || biome}</td>
                <td style={{ padding: '4px 6px' }}>
                  <span className="flex flex-wrap items-center gap-1">
                    {row.water.length === 0 && <span className="text-gray-500">none</span>}
                    {counted(row.water).map(([shape, n]) => (
                      <span key={shape} className="flex items-center gap-1 px-2 py-0.5 rounded"
                        style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-secondary)' }}>
                        {SHAPE_NAME[shape] || shape}{n > 1 ? ` ×${n}` : ''}
                        {editable && (
                          <button onClick={() => write(biome, { water: withoutOne(row.water, shape) })}
                            title={`One ${SHAPE_NAME[shape] || shape} fewer`} aria-label={`Remove one ${SHAPE_NAME[shape] || shape} from ${BIOME_NAME[biome]}`}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                            <X size={10} />
                          </button>
                        )}
                      </span>
                    ))}
                    {editable && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Plus size={10} />
                        <select value="" aria-label={`Add a water shape to ${BIOME_NAME[biome]}`}
                          onChange={(e) => { if (e.target.value) write(biome, { water: [...row.water, e.target.value] }); }}
                          style={{ fontSize: 11, padding: '1px 4px' }}>
                          <option value="">add</option>
                          {WATER_SHAPES.map((shape) => <option key={shape} value={shape}>{SHAPE_NAME[shape] || shape}</option>)}
                        </select>
                      </span>
                    )}
                  </span>
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <RangeBoxes range={row.sea} min={0} max={MAX_SEA_PERCENT} step={0.1} label={`${BIOME_NAME[biome]} sea`} disabled={!editable}
                    toShown={percentOf} fromShown={(v) => v / 100} onChange={(sea) => write(biome, { sea })} />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <RangeBoxes range={row.stone} min={0} max={MAX_STONE} step={1} label={`${BIOME_NAME[biome]} Stone`} disabled={!editable}
                    onChange={(stone) => write(biome, { stone })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
