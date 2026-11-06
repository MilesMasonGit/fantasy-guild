import { useMemo, useState } from 'react';
import { Sparkles, Trash2, RefreshCw } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { rulesLinesOf } from '../../utils/constants';
import { normaliseHallSky, TAG_SIDES } from '../../../../src/config/hallStars.js';
import { BUILT_IN_CONSTELLATIONS } from '../../../../src/config/guildUpgrades.js';
import { PLAN_TIERS, tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import { workspacePace } from '../../engine/ledgerReport';
import { hallRows, hallRowsOf, hoursText } from '../../engine/ledgerPace';

/**
 * The Guild Hall page: the authored sky (constellations and their stars), as Sync writes it to
 * `data/hallStars.json`. A star's name, description, constellation, place and tag sit here; its
 * ranks (price, rules, Passive Production lines) show as the game reads them and come in by change
 * pack. Each rank's **tier** is the owner's, set here; the ledger then says what the rank pays back
 * in at Typical and proposes a price for it (a preview: nothing is applied). The built-in Bunk
 * Beds, Bank Tabs and Wishing Well are the game's own and are not listed.
 * ⚠️ The paybacks are the ledger's whole pace, worked out when the page opens and on Refresh, not on
 * every edit.
 */

/** Each rank's payback and proposed price over the workspace as it stands, stamped with the time. */
function workOutPricing() {
  const state = useEntityStore.getState();
  if (state.hallStars == null && state.hallConstellations == null) return null;
  const pace = workspacePace(state);
  return { rows: hallRows(pace), paybackHours: pace.settings.hallPaybackHours, at: new Date() };
}

/** A raw rank with its tier set, or cleared with `''`. */
function withTier(rank, value) {
  const rest = { ...(rank || {}) };
  delete rest.tier;
  return value === '' ? rest : { ...rest, tier: Number(value) };
}

const ALL_TOKENS = { mode: 'all', value: '' };
/** A star's rule as it holds: guild-wide, every Token unless it names some. */
const asGuildRule = (st) => ({ ...st, reach: 'board', to: st?.to?.mode || st?.to?.filters?.length ? st.to : ALL_TOKENS });

function NumberField({ label, value, onChange, step = 0.05 }) {
  return (
    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
      {label}
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="w-16" style={{ fontSize: 11, padding: '1px 4px' }} />
    </label>
  );
}

export default function HallStarsPage() {
  const hallStars = useEntityStore((s) => s.hallStars);
  const hallConstellations = useEntityStore((s) => s.hallConstellations);
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const setHallStar = useEntityStore((s) => s.setHallStar);
  const removeHallStar = useEntityStore((s) => s.removeHallStar);
  const [pricing, setPricing] = useState(workOutPricing);

  const names = useMemo(() => ({
    token: (id) => tokens[id]?.name || id,
    item: (id) => items[id]?.name || id,
  }), [tokens, items]);
  const sky = useMemo(() => normaliseHallSky({ constellations: hallConstellations || {}, stars: hallStars || {} }), [hallConstellations, hallStars]);
  const groups = useMemo(() => {
    const all = [...BUILT_IN_CONSTELLATIONS.map((c) => ({ ...c, builtIn: true })), ...sky.constellations];
    const known = new Set(all.map((c) => c.id));
    const orphans = sky.stars.filter((s) => !known.has(s.constellation));
    return [
      ...all.map((c) => ({ ...c, stars: sky.stars.filter((s) => s.constellation === c.id) })),
      ...(orphans.length ? [{ id: '', name: 'In no constellation', stars: orphans }] : []),
    ].filter((g) => g.stars.length || !g.builtIn);
  }, [sky]);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((was) => { const next = new Set(was); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (hallStars == null && hallConstellations == null) {
    return (
      <div className="p-4" data-testid="hall-stars-page">
        <Section title="Guild Hall stars" icon={<Sparkles size={14} />}>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            This workspace holds no Guild Hall sky yet. A change pack brings the first stars in; until then the game shows
            only its built-in Bunk Beds, Bank Tabs and Wishing Well, and Sync leaves data/hallStars.json alone.
          </p>
        </Section>
      </div>
    );
  }

  const setTier = (starId, index, value) => {
    const ranks = (hallStars?.[starId]?.ranks || []).map((r, j) => (j === index ? withTier(r, value) : r));
    setHallStar(starId, { ranks });
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" data-testid="hall-stars-page">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Set each rank's tier; the ledger says what it pays back in at Typical (red beyond {pricing ? hoursText(pricing.paybackHours) : 'the payback time'}) and proposes a price: the most of its tier's material it can cost and still pay back in time, never below the rank before. Proposed prices are a preview and are never applied.
        </p>
        <button
          type="button"
          onClick={() => setPricing(workOutPricing())}
          title={pricing ? `Worked out at ${pricing.at.toLocaleTimeString()}. Work it out again after edits.` : 'Work out the paybacks'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
          style={{ background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
          data-hall-pricing-refresh
        >
          <RefreshCw size={12} /> Refresh paybacks
        </button>
      </div>
      {groups.map((group) => (
        <Section key={group.id || 'none'} title={`${group.name} (${group.stars.length})`} icon={<Sparkles size={14} />}>
          <div className="space-y-2" data-hall-constellation={group.id}>
            {group.stars.map((star) => {
              const raw = hallStars?.[star.id] || star;
              const shown = open.has(star.id);
              const priced = pricing ? hallRowsOf(pricing.rows, star.id) : {};
              const late = Object.values(priced).filter((r) => r.rate && !r.pays).length;
              return (
                <div key={star.id} data-hall-star={star.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      value={raw.name || ''}
                      data-hall-star-name
                      onChange={(e) => setHallStar(star.id, { name: e.target.value })}
                      className="text-xs font-semibold flex-1 min-w-40"
                    />
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{star.id}</span>
                    {late > 0 && (
                      <span className="text-[10px] font-bold" style={{ color: 'var(--color-error)' }} data-hall-star-late>
                        {late} rank{late === 1 ? '' : 's'} slow to pay back
                      </span>
                    )}
                    <button type="button" className="btn-ghost text-[10px]" style={{ padding: '2px 6px' }} onClick={() => toggle(star.id)}>
                      {shown ? 'Hide ranks' : `${star.ranks.length} rank${star.ranks.length === 1 ? '' : 's'}`}
                    </button>
                    <button type="button" onClick={() => removeHallStar(star.id)} className="btn-ghost" style={{ padding: '2px 6px' }} title="Remove this star from the sky">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <input
                    value={raw.description || ''}
                    placeholder="Description"
                    onChange={(e) => setHallStar(star.id, { description: e.target.value })}
                    className="w-full text-[11px]"
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <NumberField label="x" value={star.node.x} onChange={(x) => setHallStar(star.id, { node: { ...star.node, x } })} />
                    <NumberField label="y" value={star.node.y} onChange={(y) => setHallStar(star.id, { node: { ...star.node, y } })} />
                    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                      tag
                      <select value={star.tag} onChange={(e) => setHallStar(star.id, { tag: e.target.value })} className="text-[11px]">
                        {TAG_SIDES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }} title="The item drawn as an outline over this star in the sky: an item id (item_oak_wood) or a sprite name (i_feather). Empty: the game picks one by the star's kind.">
                      outline
                      <input
                        value={raw.outline || ''}
                        placeholder="by kind"
                        data-hall-star-outline
                        onChange={(e) => setHallStar(star.id, { outline: e.target.value })}
                        className="text-[11px] w-32"
                      />
                    </label>
                    <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>linked to {star.links.join(', ') || 'nothing'}</span>
                  </div>
                  {shown && (
                    <ol className="text-[11px] space-y-1.5 pl-4 list-decimal" data-hall-star-ranks>
                      {star.ranks.map((rank, i) => (
                        <li key={i} style={{ color: 'var(--color-text-secondary)' }} data-hall-rank={i + 1}>
                          <div className="flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
                            <select
                              value={rank.tier == null ? '' : String(rank.tier)}
                              onChange={(e) => setTier(star.id, i, e.target.value)}
                              className="text-[11px]"
                              aria-label={`Tier of rank ${i + 1}`}
                              data-hall-rank-tier
                            >
                              <option value="">No tier set</option>
                              {[...new Set([...PLAN_TIERS, ...(rank.tier != null ? [rank.tier] : [])])].sort((a, b) => a - b).map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
                            </select>
                            <span>{rank.price.length ? rank.price.map((p) => `${p.quantity} ${names.item(p.itemId)}`).join(' + ') : 'free'}</span>
                            <RankPricing row={priced[i + 1]} />
                          </div>
                          {rulesLinesOf({ statements: rank.rules.map(asGuildRule) }, names).map((line, j) => <div key={`r${j}`}>{line}</div>)}
                          {rank.lines.map((l, j) => <div key={`l${j}`}>{l.quantity} {names.item(l.itemId)} each Passive Production lap</div>)}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
            {group.stars.length === 0 && <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>No stars yet.</p>}
          </div>
        </Section>
      ))}
    </div>
  );
}

/** One rank's payback at Typical and the ledger's proposed price, as last worked out. */
function RankPricing({ row }) {
  if (!row) return <span className="text-gray-500">· not worked out (Refresh paybacks)</span>;
  if (!row.rate) return <span className="text-gray-500" data-hall-rank-payback>· adds no rate: no payback</span>;
  return (
    <>
      <span
        data-hall-rank-payback
        style={{ color: row.enabler ? 'var(--color-text-muted)' : row.pays ? 'var(--color-success)' : 'var(--color-error)', fontWeight: row.pays ? 400 : 700 }}
        title={row.workText ? `Saves ${row.savesText} on ${row.workText}, at ${tierLabel(row.cap)}` : undefined}
      >
        · {row.priceTimeText} to gather{row.openingText ? `, ${row.openingText}` : ''}, saves {row.savesText}: pays back in {row.paybackText}
      </span>
      <span data-hall-rank-proposed style={{ color: row.proposed && !row.proposed.why && !row.proposed.pays ? 'var(--color-error)' : 'var(--color-accent-hover)' }}>
        · proposed (preview): {row.proposed?.why ? row.proposed.why : `${row.proposed.priceText}, pays back in ${hoursText(row.proposed.payback)}${row.proposed.raised ? ', raised to the rank before' : ''}`}
      </span>
    </>
  );
}
