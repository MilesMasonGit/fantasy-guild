import { useEntityStore } from '../../stores/useEntityStore';
import { workspaceWorldFrom } from '../../engine/worldTables';
import { normaliseWorldTables, STRICT_RINGS, grownPrice } from '../../../../src/config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../../../../src/config/worldPlaceholder.js';
import { NumberBox } from './BiomeTable';

const sectionHead = 'text-[10px] font-black uppercase tracking-wider text-gray-400';
const card = 'rounded-xl border bg-[#1a1a1e] border-white/10 p-4';

const ORDINAL = ['1st', '2nd', '3rd'];
const ordinal = (n) => ORDINAL[n - 1] || `${n}th`;
const whole = (n) => Math.round(n).toLocaleString('en-US');

/** Which places of a ring the table shows: the first three and the ring's last (a ring holds 6 per step out). */
function shownPlaces(ring) {
  const last = 6 * ring;
  return [...new Set([1, 2, 3, last])].filter((n) => n <= last);
}

/**
 * The settle prices of the strict rings, place by place: each further place settled in a ring asks
 * the ring's coins and item quantities times the growth once more, the level unchanged (owner,
 * 2026-11-27). The growth is the world tables' `placePriceGrowth`, edited here and Synced.
 */
export default function PlacePrices() {
  const worldRecord = useEntityStore((s) => s.world);
  const setGrowth = useEntityStore((s) => s.setPlacePriceGrowth);
  const raw = workspaceWorldFrom(worldRecord) || PLACEHOLDER_WORLD_TABLES;
  const tables = normaliseWorldTables(raw);
  const editable = !!worldRecord;
  const growth = tables.placePriceGrowth;
  const rings = Array.from({ length: STRICT_RINGS }, (_, i) => i + 1);

  return (
    <section className={`${card} space-y-2`} aria-label="Place prices">
      <h3 className={sectionHead}>Place prices by order</h3>
      <p className="text-[10px] text-gray-500">
        Each further place a guild settles in a ring asks its coins and every item quantity times this growth once more (rounded); the
        levels asked stay the same. The count is the places already settled in that ring, in the order the player picks, and starts again
        in each ring, so a ring&apos;s first place asks the ring&apos;s price as written.
      </p>
      <label className="text-[11px] text-gray-300 flex items-center gap-2">
        Growth per further place
        <NumberBox key={`g${growth}`} value={growth} min={1} max={3} step={0.01} label="Place price growth"
          disabled={!editable} onCommit={(v) => setGrowth(v)} />
        <span className="text-gray-500">×, {Math.round((growth - 1) * 100)} % more each</span>
      </label>
      {!editable && (
        <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>
          This workspace holds no world tables, so this shows the game&apos;s built-in prices and cannot be edited here.
        </p>
      )}
      <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="text-left text-gray-400">
            <th style={{ padding: '4px 6px', width: 60 }}>Ring</th>
            <th style={{ padding: '4px 6px', width: 70 }}>Place</th>
            <th style={{ padding: '4px 6px' }}>Coins</th>
            <th style={{ padding: '4px 6px' }}>Items</th>
            <th style={{ padding: '4px 6px' }}>Levels</th>
          </tr>
        </thead>
        <tbody>
          {rings.flatMap((ring) => {
            const price = tables.prices[ring];
            const levels = price.skills.map((s) => `${s.skill} ${s.level}`).join(', ') || 'none';
            return shownPlaces(ring).map((n, i) => (
              <tr key={`${ring}:${n}`} data-place-price={`${ring}:${n}`} style={{ borderTop: i === 0 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                <td style={{ padding: '3px 6px' }} className="font-bold">{i === 0 ? ring : ''}</td>
                <td style={{ padding: '3px 6px' }}>{ordinal(n)}</td>
                <td style={{ padding: '3px 6px' }} data-place-coins>{whole(grownPrice(price.coins || 0, tables, n - 1))}</td>
                <td style={{ padding: '3px 6px' }}>{price.items.map((s) => grownPrice(s.qty, tables, n - 1)).join(' + ') || 'none'}</td>
                <td style={{ padding: '3px 6px' }} className="text-gray-400">{levels}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </section>
  );
}
