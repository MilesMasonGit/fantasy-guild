import { useMemo, useState } from 'react';
import { Settings2, Coins, Package, Boxes, X, Plus, Search, Percent } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty, IdSyncField, DerivedMark } from '../shared/EditorLayout';
import InlineItemModal from '../shared/InlineItemModal';
import { derivedWeight } from '../../engine/sim/mapPass';

/**
 * The Map editor — the Cartographer's catalogue (Phase 7).
 *
 * A Map is the game's progression system and its primary gold sink (D-99,
 * D-96), which are deliberately the same thing. Buying one bursts it into 3–6
 * things from its pool (D-167).
 *
 * ## What this screen deliberately does NOT do
 * **No pass/fail on price** (CMS-57). Map price is the one hand-authored
 * anchor the whole economy hangs from — every downstream value is *derived*
 * from it, so there is nothing to validate it against. The screen's job after a
 * recalculate is to show what the price produced, not to grade it.
 *
 * **No live ROI feedback** (CMS-55). Recalculation is on demand everywhere in
 * the CMS (CMS-16); this screen gets no exception, so there is one mental model
 * rather than some screens updating live and others not.
 *
 * **No category filter on the pool picker** (CMS-56). One flat searchable list
 * of every Token — you filter by eye. A Token may appear in several Maps'
 * pools; a common resource legitimately belonging to more than one Map is
 * normal.
 *
 * **No kit-completeness check.** D-139 says a pool should be a complete kit —
 * producers, their context, their buffs, their Manager, a Market, the enemies
 * that belong there — but CMS-10 explicitly deferred validating that. The
 * composition tally below is a read-out, not a verdict.
 */
export default function MapEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const map = useEntityStore((s) => s.maps[activeId]);
  const tokens = useEntityStore((s) => s.tokens);
  const items = useEntityStore((s) => s.items);
  const updateMap = useEntityStore((s) => s.updateMap);
  const deleteMap = useEntityStore((s) => s.deleteMap);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  if (!map) return <Empty text="Select a Map from the sidebar to edit" />;

  const update = (key, value) => updateMap(activeId, { [key]: value });
  const pool = map.pool || [];

  /** Which Token bursts into this Map — a Map Token carries `mapId` (D-155). */
  const mapTokens = Object.values(tokens).filter((t) => t.mapId === activeId);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <Header name={map.name} id={map.id} onDelete={() => deleteMap(activeId)} />

      <Section title="Identity" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" className="col-span-2">
            <input type="text" value={map.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <IdSyncField entity={map} entityType="map" onUpdate={update} />
          </div>
          {/* The "Theme" dropdown that sat here was removed 2026-08-24
              (CR2-125). `theme` was never a feature (`concept_audit.md` §A);
              nothing in the game read it, and every shipped Map had it blank. */}
        </div>

        {mapTokens.length > 0 && (
          <p className="text-[11px] text-gray-500">
            Bought as:{' '}
            {mapTokens.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveEntity(t.id, 'token')}
                className="underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 0 }}
              >
                {t.name}
              </button>
            ))}
          </p>
        )}
        {mapTokens.length === 0 && (
          <p className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
            ⚠️ No Map Token points at this Map, so there is no way to buy it. Create a
            Token with type <code>map</code> and set its Map to this one.
          </p>
        )}
      </Section>

      <Section title="Cost" icon={<Coins size={14} />}>
        <Field label="Price (gold)">
          <input
            type="number"
            min={0}
            step={10}
            value={map.price ?? 0}
            onChange={(e) => update('price', Math.max(0, Number(e.target.value)))}
            className="w-full"
          />
        </Field>
        {/* CMS-57: price is the hand-authored anchor, so there is nothing to
            check it against. D-166: it must never rise with repeat purchases. */}
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Every other value in the game is derived from this one, so nothing checks
          it — you are setting the anchor, not answering to it.
          <br />
          ⚠️ Never raise a Map's price for repeat purchases. Restocking stays cheap
          forever; moving up to a costlier Map is the milestone.
        </p>

        <MaterialList
          label="Material cost"
          entries={map.materials || []}
          items={items}
          onChange={(materials) => update('materials', materials)}
        />
        {/* D-150: taken from the Bank on purchase, as Token inputs are.
            CMS-108: counts toward the value anchor alongside gold. */}
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Taken from the Bank when the Map is bought, exactly as a Token takes its
          inputs. Counts toward the price anchor alongside the gold.
        </p>
      </Section>

      <PoolSection
        pool={pool}
        tokens={tokens}
        items={items}
        onChange={(next) => update('pool', next)}
        onOpen={(id, type) => setActiveEntity(id, type)}
      />
    </div>
  );
}

/** The weighted burst pool. */
function PoolSection({ pool, tokens, items, onChange, onOpen }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('token');
  const [modalOpen, setModalOpen] = useState(false);

  const source = kind === 'token' ? tokens : items;

  // The weights the next Recalculate will write, and the shares they imply.
  // Computed here rather than read off the records so the screen shows the
  // consequence of a rarity edit immediately, without a recalculation.
  const derivedWeights = pool.map((entry) => {
    const ref = entry.kind === 'item' ? items[entry.refId] : tokens[entry.refId];
    return derivedWeight(ref?.rarity);
  });
  const derivedTotal = derivedWeights.reduce((sum, w) => sum + w, 0);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return Object.values(source)
      .filter((e) => (e.name || '').toLowerCase().includes(q) || (e.id || '').includes(q))
      .slice(0, 8);
  }, [query, source]);

  const exactExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    return !!q && Object.values(source).some((e) => (e.name || '').toLowerCase() === q);
  }, [query, source]);

  const add = (refId) => {
    const entry = { kind, refId, weight: 10 };
    if (kind === 'item') entry.quantity = 1;
    onChange([...pool, entry]);
    setQuery('');
  };
  const patch = (i, p) => onChange(pool.map((e, idx) => (idx === i ? { ...e, ...p } : e)));

  /** Read-out only — a tally of what is in here, not a verdict (CMS-10). */
  const composition = useMemo(() => {
    const counts = {};
    for (const e of pool) {
      const key = e.kind === 'item' ? 'item' : tokens[e.refId]?.tokenType || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [pool, tokens]);

  return (
    <Section title="Burst Pool" icon={<Boxes size={14} />}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
          <span>{pool.length} entr{pool.length === 1 ? 'y' : 'ies'} · total weight {derivedTotal}</span>
          {pool.length > 0 && <DerivedMark />}
        </span>
        {composition.length > 0 && (
          <span className="text-[10px] text-gray-600">
            {composition.map(([k, n]) => `${n} ${k}`).join(' · ')}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {/* D-139: a pool should be a complete, self-contained kit. */}
        {pool.length === 0 && (
          <p className="text-[11px] text-gray-600">
            Empty pool. A Map should hand over everything needed to use what is in it —
            the producers, the tools and buffs they need, their Manager, and the enemies
            that belong there.
          </p>
        )}

        {pool.map((entry, i) => {
          const ref = entry.kind === 'item' ? items[entry.refId] : tokens[entry.refId];
          const share = derivedTotal > 0 ? (100 * derivedWeights[i]) / derivedTotal : 0;
          const missing = !ref;
          return (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border p-2"
              style={{
                background: 'rgba(0,0,0,0.2)',
                borderColor: missing ? 'var(--color-error)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {entry.kind === 'item' ? (
                <Package size={12} style={{ color: 'var(--color-item)', flexShrink: 0 }} />
              ) : (
                <Boxes size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
              )}

              <button
                onClick={() => ref && onOpen(entry.refId, entry.kind)}
                className="flex-1 text-left text-xs truncate"
                style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: ref ? 'pointer' : 'default',
                  color: missing ? 'var(--color-error)' : 'var(--color-text-secondary)',
                }}
              >
                {ref ? ref.name : `${entry.refId} — missing`}
              </button>

              {entry.kind === 'item' && (
                <label className="flex items-center gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-gray-600">qty</span>
                  <input
                    type="number"
                    min={1}
                    value={entry.quantity ?? 1}
                    onChange={(e) => patch(i, { quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-14"
                    style={{ fontSize: 11, padding: '3px 6px' }}
                  />
                </label>
              )}

              {/* ⚠️ **Read-only-derived** (CMS-124, economic simulator P7).
                  This used to be a free numeric input under CMS-54 — "full
                  author control over this Map's specific pool". It is now the
                  referenced Token's rarity read through one global table, and
                  the number below is what the next Recalculate will write. The
                  lever a designer has here is the **rarity tag**, one screen
                  over; shares still renormalise within the pool, so pool
                  composition — not tier — sets what a burst actually feels
                  like. */}
              <label className="flex items-center gap-1" title={`Derived from rarity: ${ref?.rarity ?? 'common'}`}>
                <span className="text-[9px] uppercase tracking-wider text-gray-600">wt</span>
                <span
                  className="w-14 text-[11px] font-mono text-center rounded"
                  style={{ padding: '3px 6px', background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-muted)' }}
                >
                  {derivedWeight(ref?.rarity)}
                </span>
              </label>

              <span className="text-[10px] font-mono w-12 text-right" style={{ color: 'var(--color-text-muted)' }}>
                {share.toFixed(1)}%
              </span>

              <button
                onClick={() => onChange(pool.filter((_, idx) => idx !== i))}
                className="text-gray-600 hover:text-red-400"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* CMS-56: one flat searchable list, no category filter. */}
      <div>
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => { setKind(e.target.value); setQuery(''); }}
            style={{ fontSize: 11, width: 90 }}
          >
            <option value="token">Token</option>
            <option value="item">Item</option>
          </select>
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Add a ${kind}…`}
              className="w-full pl-7"
              style={{ fontSize: 11 }}
            />
          </div>
        </div>

        {query.trim() && (
          <div className="mt-1.5 space-y-1">
            {matches.map((e) => (
              <button
                key={e.id}
                onClick={() => add(e.id)}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs text-gray-300 hover:bg-white/5"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                {e.name}
                {e.tokenType && <span className="text-[10px] text-gray-600 ml-1.5">{e.tokenType}</span>}
              </button>
            ))}
            {kind === 'item' && !exactExists && (
              <button
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-bold"
                style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer' }}
              >
                <Plus size={12} /> Create “{query.trim()}”
              </button>
            )}
            {kind === 'token' && matches.length === 0 && (
              <p className="text-[10px] text-gray-600 px-2 py-1">
                No Token matches. Tokens are created on the Tokens tab.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Percent size={12} className="text-gray-600 mt-0.5 flex-shrink-0" />
        {/* CMS-124 weights are derived from rarity; CMS-129 the first of three
            draws is always a Token; CMS-57 no pass/fail on price. */}
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Percentages are each entry's share of one draw. Weights are
          <strong> derived from rarity</strong> — to change how often something turns
          up, change its rarity.
          <br />
          A burst is three draws and the first is always a Token, so a Token's real
          odds are better than its share suggests.
          <br />
          This Map's verdict is on the <strong>Economy Audit → Map Economics</strong> tab.
        </p>
      </div>

      <InlineItemModal
        isOpen={modalOpen}
        initialName={query.trim()}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => add(id)}
      />
    </Section>
  );
}

/** The Map's material cost — a simple {itemId, quantity} list. */
function MaterialList({ label, entries, items, onChange }) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const matches = query.trim()
    ? Object.values(items)
        .filter((i) => (i.name || '').toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 5)
    : [];
  const exactExists = Object.values(items).some(
    (i) => (i.name || '').toLowerCase() === query.trim().toLowerCase()
  );

  const add = (itemId) => {
    onChange([...entries, { itemId, quantity: 1 }]);
    setQuery('');
  };

  return (
    <Field label={label}>
      <div className="space-y-1.5">
        {entries.length === 0 && <p className="text-[11px] text-gray-600">Gold only.</p>}
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <Package size={12} style={{ color: 'var(--color-item)', flexShrink: 0 }} />
            <span className="flex-1 text-xs truncate text-gray-300">
              {items[e.itemId]?.name || `${e.itemId} — missing`}
            </span>
            <input
              type="number"
              min={1}
              value={e.quantity ?? 1}
              onChange={(ev) =>
                onChange(entries.map((x, idx) => (idx === i ? { ...x, quantity: Math.max(1, Number(ev.target.value)) } : x)))
              }
              className="w-16"
              style={{ fontSize: 11, padding: '3px 6px' }}
            />
            <button
              onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
              className="text-gray-600 hover:text-red-400"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="relative mt-1.5">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a material…"
          className="w-full pl-6"
          style={{ fontSize: 11 }}
        />
      </div>
      {query.trim() && (
        <div className="mt-1 space-y-1">
          {matches.map((i) => (
            <button
              key={i.id}
              onClick={() => add(i.id)}
              className="w-full text-left px-2 py-1 rounded text-[11px] text-gray-300 hover:bg-white/5"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {i.name}
            </button>
          ))}
          {!exactExists && (
            <button
              onClick={() => setModalOpen(true)}
              className="w-full flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold"
              style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={11} /> Create “{query.trim()}”
            </button>
          )}
        </div>
      )}

      <InlineItemModal
        isOpen={modalOpen}
        initialName={query.trim()}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => add(id)}
      />
    </Field>
  );
}
