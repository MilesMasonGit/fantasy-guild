import { useMemo } from 'react';
import { Fish, Plus, X } from 'lucide-react';
import { useEntityStore, makeTokenConfig } from '../../stores/useEntityStore';
import { TOOL_KINDS, toolKindLabel, isConsumableCategory } from '../../utils/constants';
import { Section } from '../shared/EditorLayout';

/**
 * A water Token's catch pools (`catchPools: [{ tool, bait?, catches: [{ itemId, weight }] }]`):
 * one weighted pool per tool kind and bait, the pool with no bait being the water's basic one. The
 * game's reader is `src/config/registries/catchPools.js`; the catch replaces the Token's Outputs,
 * and the Token never runs out.
 *
 * Written only when a pool exists: removing the last one drops the key, so every other Token's
 * record stays byte-identical. Adding the first pool to a Token with no work cycle gives it one
 * (Fishing, 10 s, 1 XP), since a pool is fished by a hero's work.
 */

const NEW_CONFIG = { skill: 'fishing', cycleTimeMs: 10000, xp: 1 };

/** A share of the pool's weight, as the author reads it: `50%`, `33.3%`. */
function share(weight, total) {
  const w = Number(weight);
  if (!(w > 0) || !(total > 0)) return '—';
  return `${Math.round((w / total) * 1000) / 10}%`;
}

export default function CatchPoolsBlock({ token, onPatch }) {
  const items = useEntityStore((s) => s.items);
  const pools = Array.isArray(token?.catchPools) ? token.catchPools : [];

  const itemList = useMemo(
    () => Object.values(items || {}).filter((i) => i?.id).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id))),
    [items]
  );
  const baitList = useMemo(() => itemList.filter((i) => isConsumableCategory(i.equipSlot)), [itemList]);

  const write = (next) => {
    const patch = { catchPools: next.length ? next : undefined };
    if (next.length && !token.config) patch.config = makeTokenConfig(NEW_CONFIG);
    onPatch(patch);
  };
  const setPool = (n, change) => write(pools.map((p, i) => (i === n ? change(p) : p)));
  const setCatch = (n, c, patch) => setPool(n, (p) => ({
    ...p,
    catches: (p.catches || []).map((entry, i) => (i === c ? { ...entry, ...patch } : entry))
  }));

  const addPool = () => {
    const used = new Set(pools.filter((p) => !p.bait).map((p) => p.tool));
    const tool = ['fishing_rod', 'fishing_net', 'fishing_cage', ...TOOL_KINDS.map((k) => k.id)].find((k) => !used.has(k)) || 'fishing_rod';
    write([...pools, { tool, catches: [] }]);
  };

  return (
    <Section title="Catch pools" icon={<Fish size={14} />}>
      <div data-field="catch-pools" className="space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Water: what a hero catches here, picked by the tool in their hand and the bait they carry.
          One pool per tool and bait; the pool with no bait is the water&apos;s basic catch. One bait
          is spent per catch. With a pool here the Token never runs out, its Outputs are not used,
          and any tool a pool names will do, at any tier.
        </p>

        {pools.map((pool, n) => {
          const catches = Array.isArray(pool.catches) ? pool.catches : [];
          const total = catches.reduce((sum, c) => sum + (Number(c.weight) > 0 ? Number(c.weight) : 0), 0);
          const baitKnown = !pool.bait || baitList.some((i) => i.id === pool.bait);
          return (
            <div
              key={n}
              data-pool-index={n}
              className="p-3 rounded-lg space-y-2"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <select
                  aria-label="Tool"
                  data-catch-tool
                  value={pool.tool || ''}
                  onChange={(e) => setPool(n, (p) => ({ ...p, tool: e.target.value }))}
                  style={{ fontSize: 12 }}
                >
                  {pool.tool && !TOOL_KINDS.some((k) => k.id === pool.tool) && (
                    <option value={pool.tool}>{pool.tool} (unknown)</option>
                  )}
                  {TOOL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </select>
                <span className="text-[11px] text-gray-500">with</span>
                <select
                  aria-label="Bait"
                  data-catch-bait
                  value={pool.bait || ''}
                  onChange={(e) => setPool(n, (p) => {
                    const next = { ...p };
                    if (e.target.value) next.bait = e.target.value;
                    else delete next.bait;
                    return next;
                  })}
                  className="flex-1 min-w-0"
                  style={{ fontSize: 12 }}
                >
                  <option value="">No bait (the basic catch)</option>
                  {!baitKnown && <option value={pool.bait}>{items?.[pool.bait]?.name || pool.bait} (not a Consumable)</option>}
                  {baitList.map((i) => <option key={i.id} value={i.id}>{i.name || i.id}</option>)}
                </select>
                <button
                  type="button"
                  data-remove-pool
                  title="Remove this pool"
                  onClick={() => write(pools.filter((_, i) => i !== n))}
                  className="text-gray-500 hover:text-red-400"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                >
                  <X size={13} />
                </button>
              </div>

              {catches.length === 0 && (
                <p className="text-[10px] text-gray-600">Nothing to catch yet: add a fish below.</p>
              )}
              {catches.map((c, i) => (
                <div key={i} data-catch-index={i} className="flex items-center gap-2">
                  <select
                    aria-label="Catch"
                    data-catch-item
                    value={c.itemId || ''}
                    onChange={(e) => setCatch(n, i, { itemId: e.target.value })}
                    className="flex-1 min-w-0"
                    style={{ fontSize: 12 }}
                  >
                    <option value="">Choose an item</option>
                    {c.itemId && !items?.[c.itemId] && <option value={c.itemId}>{c.itemId} (missing)</option>}
                    {itemList.map((it) => <option key={it.id} value={it.id}>{it.name || it.id}</option>)}
                  </select>
                  <input
                    type="number"
                    min={0}
                    aria-label="Weight"
                    data-catch-weight
                    value={c.weight ?? ''}
                    onChange={(e) => setCatch(n, i, { weight: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-20"
                    style={{ fontSize: 12 }}
                  />
                  <span data-catch-share className="w-12 text-right text-[11px] text-gray-400">{share(c.weight, total)}</span>
                  <button
                    type="button"
                    data-remove-catch
                    title="Remove this catch"
                    onClick={() => setPool(n, (p) => ({ ...p, catches: catches.filter((_, k) => k !== i) }))}
                    className="text-gray-500 hover:text-red-400"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                data-add-catch
                onClick={() => setPool(n, (p) => ({ ...p, catches: [...catches, { itemId: '', weight: 10 }] }))}
                className="btn-ghost text-xs flex items-center gap-1"
                style={{ padding: '2px 8px' }}
              >
                <Plus size={11} /> Add a catch
              </button>
              <p className="text-[10px] text-gray-600 leading-relaxed">
                {pool.bait
                  ? <>A hero holding a {toolKindLabel(pool.tool)} and carrying {items?.[pool.bait]?.name || pool.bait} catches from this pool, spending one per catch.</>
                  : <>A hero holding a {toolKindLabel(pool.tool)} with none of its baits catches from this pool.</>}
                {' '}Weights are shares of the pool: 50, 40 and 10 read as 50 %, 40 % and 10 %.
              </p>
            </div>
          );
        })}

        <button
          type="button"
          data-add-pool
          onClick={addPool}
          className="btn-ghost text-xs flex items-center gap-1"
          style={{ padding: '4px 10px' }}
        >
          <Plus size={12} /> Add a catch pool
        </button>
        {!token?.config && (
          <p className="text-[10px] text-gray-600 leading-relaxed">
            The first pool gives this Token a Fishing work cycle (10 s, 1 XP), set in Work Cycle.
          </p>
        )}
      </div>
    </Section>
  );
}
